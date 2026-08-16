#!/usr/bin/env python3
"""
Interfaz Gráfica de Usuario (GUI) moderna en PySide6 para YouTube Ultra Downloader.
Descarga videos en máxima calidad (hasta 8K) con la pista de audio en idioma original.
"""

import os
import sys
import urllib.request
from typing import Dict, Any

from PySide6.QtCore import Qt, QThread, Signal, QSize
from PySide6.QtGui import QIcon, QPixmap, QFont, QColor, QPalette
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLineEdit, QPushButton, QLabel, QComboBox, QProgressBar,
    QFileDialog, QMessageBox, QFrame, QCheckBox, QTextEdit, QGroupBox
)

from yt_max_hq import YouTubeDownloader


class FetchInfoThread(QThread):
    info_fetched = Signal(dict)
    error_occurred = Signal(str)

    def __init__(self, downloader: YouTubeDownloader, url: str):
        super().__init__()
        self.downloader = downloader
        self.url = url

    def run(self):
        try:
            info = self.downloader.get_info(self.url)
            self.info_fetched.emit(info)
        except Exception as e:
            self.error_occurred.emit(str(e))


class DownloadThread(QThread):
    progress_signal = Signal(dict)
    finished_signal = Signal(str)
    error_signal = Signal(str)

    def __init__(
        self,
        downloader: YouTubeDownloader,
        url: str,
        max_height: int = None,
        force_original_audio: bool = True,
        audio_only: bool = False,
        container: str = "mp4",
        output_dir: str = None
    ):
        super().__init__()
        self.downloader = downloader
        self.url = url
        self.max_height = max_height
        self.force_original_audio = force_original_audio
        self.audio_only = audio_only
        self.container = container
        self.output_dir = output_dir

    def run(self):
        try:
            def _callback(data):
                self.progress_signal.emit(data)

            filepath = self.downloader.download(
                url=self.url,
                max_height=self.max_height,
                force_original_audio=self.force_original_audio,
                audio_only=self.audio_only,
                container=self.container,
                output_path=self.output_dir,
                progress_callback=_callback
            )
            self.finished_signal.emit(filepath)
        except Exception as e:
            self.error_signal.emit(str(e))


class ImageLoaderThread(QThread):
    image_loaded = Signal(QPixmap)

    def __init__(self, url: str):
        super().__init__()
        self.url = url

    def run(self):
        try:
            if not self.url:
                return
            req = urllib.request.Request(self.url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                data = response.read()
                pixmap = QPixmap()
                pixmap.loadFromData(data)
                self.image_loaded.emit(pixmap)
        except Exception:
            pass


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.downloader = YouTubeDownloader()
        self.current_info = None
        self.download_thread = None
        self.fetch_thread = None
        self.image_thread = None

        self.setWindowTitle("YouTube Ultra Downloader (Máxima Calidad + Idioma Original)")
        self.setMinimumSize(850, 680)

        self._setup_theme()
        self._init_ui()

    def _setup_theme(self):
        """Aplica un tema oscuro moderno con estilos CSS/QSS."""
        qss = """
        QMainWindow {
            background-color: #0f172a;
        }
        QWidget {
            color: #f8fafc;
            font-family: 'Segoe UI', Ubuntu, sans-serif;
            font-size: 13px;
        }
        QGroupBox {
            background-color: #1e293b;
            border: 1px solid #334155;
            border-radius: 10px;
            margin-top: 12px;
            padding-top: 15px;
            font-weight: bold;
        }
        QGroupBox::title {
            subcontrol-origin: margin;
            subcontrol-position: top left;
            padding: 2px 8px;
            color: #38bdf8;
        }
        QLineEdit {
            background-color: #0f172a;
            border: 1px solid #475569;
            border-radius: 6px;
            padding: 8px 12px;
            color: #f8fafc;
            font-size: 14px;
        }
        QLineEdit:focus {
            border: 1px solid #38bdf8;
        }
        QPushButton {
            background-color: #3b82f6;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            padding: 8px 16px;
            font-weight: bold;
            font-size: 13px;
        }
        QPushButton:hover {
            background-color: #2563eb;
        }
        QPushButton:pressed {
            background-color: #1d4ed8;
        }
        QPushButton#btn_analyze {
            background-color: #0284c7;
        }
        QPushButton#btn_analyze:hover {
            background-color: #0369a1;
        }
        QPushButton#btn_download {
            background-color: #10b981;
            font-size: 15px;
            padding: 12px;
        }
        QPushButton#btn_download:hover {
            background-color: #059669;
        }
        QPushButton#btn_download:disabled {
            background-color: #334155;
            color: #94a3b8;
        }
        QComboBox {
            background-color: #0f172a;
            border: 1px solid #475569;
            border-radius: 6px;
            padding: 6px 10px;
            color: #f8fafc;
        }
        QComboBox:hover {
            border: 1px solid #38bdf8;
        }
        QComboBox QAbstractItemView {
            background-color: #1e293b;
            color: #f8fafc;
            selection-background-color: #3b82f6;
        }
        QProgressBar {
            background-color: #0f172a;
            border: 1px solid #334155;
            border-radius: 8px;
            text-align: center;
            color: #ffffff;
            font-weight: bold;
            height: 22px;
        }
        QProgressBar::chunk {
            background-color: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #3b82f6, stop:1 #10b981);
            border-radius: 7px;
        }
        QCheckBox {
            color: #f8fafc;
            font-size: 13px;
        }
        QCheckBox::indicator {
            width: 18px;
            height: 18px;
            border-radius: 4px;
            border: 1px solid #475569;
            background-color: #0f172a;
        }
        QCheckBox::indicator:checked {
            background-color: #10b981;
            border: 1px solid #10b981;
        }
        """
        self.setStyleSheet(qss)

    def _init_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(20, 20, 20, 20)
        main_layout.setSpacing(15)

        # Header Title
        header_lbl = QLabel("YouTube Ultra Downloader")
        header_lbl.setStyleSheet("font-size: 22px; font-weight: bold; color: #38bdf8;")
        sub_hdr = QLabel("Descarga en Máxima Calidad (hasta 8K) y Audio en Idioma Original")
        sub_hdr.setStyleSheet("color: #94a3b8; font-size: 13px;")

        main_layout.addWidget(header_lbl)
        main_layout.addWidget(sub_hdr)

        # 1. URL Section
        url_group = QGroupBox("1. Enlace de YouTube")
        url_layout = QHBoxLayout(url_group)

        self.url_input = QLineEdit()
        self.url_input.setPlaceholderText("Pega el enlace del video o playlist de YouTube aquí...")
        self.url_input.returnPressed.connect(self._on_analyze_clicked)

        self.btn_paste = QPushButton("Pegar")
        self.btn_paste.clicked.connect(self._on_paste_clicked)

        self.btn_analyze = QPushButton("Analizar Video")
        self.btn_analyze.setObjectName("btn_analyze")
        self.btn_analyze.clicked.connect(self._on_analyze_clicked)

        url_layout.addWidget(self.url_input, stretch=4)
        url_layout.addWidget(self.btn_paste)
        url_layout.addWidget(self.btn_analyze)

        main_layout.addWidget(url_group)

        # 2. Preview & Metadata Box
        self.meta_group = QGroupBox("2. Información del Video")
        meta_layout = QHBoxLayout(self.meta_group)

        self.lbl_thumbnail = QLabel("Sin previsualización")
        self.lbl_thumbnail.setFixedSize(220, 124)
        self.lbl_thumbnail.setAlignment(Qt.AlignCenter)
        self.lbl_thumbnail.setStyleSheet("background-color: #0f172a; border-radius: 8px; border: 1px solid #334155; color: #64748b;")

        info_vbox = QVBoxLayout()

        self.lbl_title = QLabel("Título: Pega una URL y haz clic en Analizar")
        self.lbl_title.setWordWrap(True)
        self.lbl_title.setStyleSheet("font-size: 15px; font-weight: bold; color: #f8fafc;")

        self.lbl_uploader = QLabel("Canal: --")
        self.lbl_uploader.setStyleSheet("color: #cbd5e1;")

        self.lbl_duration = QLabel("Duración: --")
        self.lbl_duration.setStyleSheet("color: #94a3b8;")

        self.lbl_orig_audio_status = QLabel("Audio Original: Detectando...")
        self.lbl_orig_audio_status.setStyleSheet("color: #34d399; font-weight: bold;")

        info_vbox.addWidget(self.lbl_title)
        info_vbox.addWidget(self.lbl_uploader)
        info_vbox.addWidget(self.lbl_duration)
        info_vbox.addWidget(self.lbl_orig_audio_status)
        info_vbox.addStretch()

        meta_layout.addWidget(self.lbl_thumbnail)
        meta_layout.addLayout(info_vbox, stretch=1)

        main_layout.addWidget(self.meta_group)

        # 3. Options Box
        opts_group = QGroupBox("3. Opciones de Descarga")
        opts_layout = QVBoxLayout(opts_group)

        row1 = QHBoxLayout()

        # Quality selector
        row1.addWidget(QLabel("Calidad de Video:"))
        self.combo_quality = QComboBox()
        self.combo_quality.addItems([
            "Máxima Calidad Disponible (Auto / 8K / 4K / 1080p)",
            "4K Ultra HD (2160p)",
            "2K Quad HD (1440p)",
            "Full HD (1080p)",
            "HD (720p)",
            "Solo Audio (MP3 320kbps / M4A)"
        ])
        row1.addWidget(self.combo_quality, stretch=2)

        # Format selector
        row1.addWidget(QLabel("Formato:"))
        self.combo_container = QComboBox()
        self.combo_container.addItems(["mp4", "mkv", "mp3"])
        row1.addWidget(self.combo_container)

        opts_layout.addLayout(row1)

        row2 = QHBoxLayout()

        # Checkbox Original Audio
        self.chk_orig_audio = QCheckBox("Forzar pista de audio en IDIOMA ORIGINAL (evitar doblajes automáticos)")
        self.chk_orig_audio.setChecked(True)
        row2.addWidget(self.chk_orig_audio)

        opts_layout.addLayout(row2)

        # Output Dir
        row3 = QHBoxLayout()
        row3.addWidget(QLabel("Carpeta Destino:"))
        self.txt_outdir = QLineEdit(self.downloader.output_dir)
        self.btn_browse = QPushButton("Examinar...")
        self.btn_browse.clicked.connect(self._on_browse_clicked)

        row3.addWidget(self.txt_outdir, stretch=3)
        row3.addWidget(self.btn_browse)

        opts_layout.addLayout(row3)

        main_layout.addWidget(opts_group)

        # 4. Progress & Action
        prog_group = QGroupBox("4. Progreso y Descarga")
        prog_layout = QVBoxLayout(prog_group)

        self.progress_bar = QProgressBar()
        self.progress_bar.setValue(0)

        self.lbl_status = QLabel("Listo para descargar.")
        self.lbl_status.setStyleSheet("color: #94a3b8;")

        btn_row = QHBoxLayout()
        self.btn_download = QPushButton("Iniciar Descarga en Máxima Calidad")
        self.btn_download.setObjectName("btn_download")
        self.btn_download.clicked.connect(self._on_download_clicked)

        self.btn_open_folder = QPushButton("Abrir Carpeta")
        self.btn_open_folder.clicked.connect(self._on_open_folder_clicked)

        btn_row.addWidget(self.btn_download, stretch=3)
        btn_row.addWidget(self.btn_open_folder, stretch=1)

        prog_layout.addWidget(self.progress_bar)
        prog_layout.addWidget(self.lbl_status)
        prog_layout.addLayout(btn_row)

        main_layout.addWidget(prog_group)

    def _on_paste_clicked(self):
        clipboard = QApplication.clipboard()
        text = clipboard.text().strip()
        if text:
            self.url_input.setText(text)
            self._on_analyze_clicked()

    def _on_analyze_clicked(self):
        url = self.url_input.text().strip()
        if not url:
            QMessageBox.warning(self, "Atención", "Por favor ingresa una URL válida de YouTube.")
            return

        self.btn_analyze.setEnabled(False)
        self.lbl_status.setText("Analizando metadatos del video...")
        self.lbl_title.setText("Cargando metadatos...")

        self.fetch_thread = FetchInfoThread(self.downloader, url)
        self.fetch_thread.info_fetched.connect(self._on_info_fetched)
        self.fetch_thread.error_occurred.connect(self._on_info_error)
        self.fetch_thread.start()

    def _on_info_fetched(self, info: dict):
        self.btn_analyze.setEnabled(True)
        self.current_info = info

        self.lbl_title.setText(info['title'])
        self.lbl_uploader.setText(f"Canal: {info['uploader']}")

        mins, secs = divmod(info['duration'], 60)
        hrs, mins = divmod(mins, 60)
        dur_str = f"{hrs}h {mins}m {secs}s" if hrs > 0 else f"{mins}m {secs}s"
        self.lbl_duration.setText(f"Duración: {dur_str}")

        if info.get('has_original_audio'):
            self.lbl_orig_audio_status.setText("Audio Original: Detectado y Priorizado ✔")
            self.lbl_orig_audio_status.setStyleSheet("color: #34d399; font-weight: bold;")
        else:
            self.lbl_orig_audio_status.setText("Audio Original: Formato estándar predeterminado ✔")
            self.lbl_orig_audio_status.setStyleSheet("color: #60a5fa; font-weight: bold;")

        # Load Thumbnail
        thumb_url = info.get('thumbnail')
        if thumb_url:
            self.image_thread = ImageLoaderThread(thumb_url)
            self.image_thread.image_loaded.connect(self._on_thumbnail_loaded)
            self.image_thread.start()

        self.lbl_status.setText("Información cargada correctamente. Elige tus opciones y haz clic en Descargar.")

    def _on_thumbnail_loaded(self, pixmap: QPixmap):
        scaled = pixmap.scaled(self.lbl_thumbnail.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation)
        self.lbl_thumbnail.setPixmap(scaled)

    def _on_info_error(self, err_msg: str):
        self.btn_analyze.setEnabled(True)
        self.lbl_status.setText("Error al analizar el video.")
        QMessageBox.critical(self, "Error", f"No se pudo extraer la información del video:\n{err_msg}")

    def _on_browse_clicked(self):
        folder = QFileDialog.getExistingDirectory(self, "Seleccionar carpeta de destino", self.txt_outdir.text())
        if folder:
            self.txt_outdir.setText(folder)

    def _on_download_clicked(self):
        url = self.url_input.text().strip()
        if not url:
            QMessageBox.warning(self, "Atención", "Por favor ingresa una URL de YouTube.")
            return

        q_idx = self.combo_quality.currentIndex()
        max_height = None
        audio_only = False

        if q_idx == 1:
            max_height = 2160
        elif q_idx == 2:
            max_height = 1440
        elif q_idx == 3:
            max_height = 1080
        elif q_idx == 4:
            max_height = 720
        elif q_idx == 5:
            audio_only = True

        container = self.combo_container.currentText()
        if audio_only and container == 'mp4':
            container = 'mp3'

        force_orig = self.chk_orig_audio.isChecked()
        out_dir = self.txt_outdir.text().strip()

        self.btn_download.setEnabled(False)
        self.btn_analyze.setEnabled(False)
        self.progress_bar.setValue(0)
        self.lbl_status.setText("Iniciando descarga en máxima calidad...")

        self.download_thread = DownloadThread(
            downloader=self.downloader,
            url=url,
            max_height=max_height,
            force_original_audio=force_orig,
            audio_only=audio_only,
            container=container,
            output_dir=out_dir
        )

        self.download_thread.progress_signal.connect(self._on_download_progress)
        self.download_thread.finished_signal.connect(self._on_download_finished)
        self.download_thread.error_signal.connect(self._on_download_error)
        self.download_thread.start()

    def _on_download_progress(self, data: dict):
        status = data.get('status')
        if status == 'downloading':
            pct = int(data.get('percent', 0))
            self.progress_bar.setValue(pct)

            dl_mb = data.get('downloaded_bytes', 0) / (1024 * 1024)
            tot_mb = data.get('total_bytes', 0) / (1024 * 1024)
            speed_mb = data.get('speed', 0) / (1024 * 1024)
            eta_sec = data.get('eta', 0)

            self.lbl_status.setText(
                f"Descargando: {pct}% ({dl_mb:.1f}MB de {tot_mb:.1f}MB) | Velocidad: {speed_mb:.2f} MB/s | ETA: {eta_sec}s"
            )
        elif status == 'processing':
            self.progress_bar.setValue(99)
            self.lbl_status.setText("Fusionando transmisiones de video HD/4K y audio original con FFmpeg...")

    def _on_download_finished(self, filepath: str):
        self.progress_bar.setValue(100)
        self.btn_download.setEnabled(True)
        self.btn_analyze.setEnabled(True)
        filename = os.path.basename(filepath)
        self.lbl_status.setText(f"¡Descarga completada con éxito!: {filename}")

        QMessageBox.information(
            self,
            "Descarga Completada",
            f"El video en máxima calidad e idioma original se descargó correctamente en:\n\n{filepath}"
        )

    def _on_download_error(self, err_msg: str):
        self.btn_download.setEnabled(True)
        self.btn_analyze.setEnabled(True)
        self.lbl_status.setText("Error durante la descarga.")
        QMessageBox.critical(self, "Error de Descarga", f"Ocurrió un error al descargar:\n{err_msg}")

    def _on_open_folder_clicked(self):
        folder = self.txt_outdir.text().strip()
        if os.path.exists(folder):
            import subprocess
            subprocess.run(['xdg-open', folder])
        else:
            QMessageBox.warning(self, "Error", "La carpeta no existe aún.")


def main():
    app = QApplication(sys.argv)
    app.setApplicationName("YouTube Ultra Downloader")
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
