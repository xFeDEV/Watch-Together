#!/usr/bin/env python3
"""
Motor central de descarga de YouTube en máxima calidad e idioma original.
Utiliza yt-dlp y FFmpeg para fusionar transmisiones separadas de alta resolución.
"""

import os
import sys
import shutil
import logging
from typing import Dict, Any, Callable, Optional, List
import yt_dlp

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("yt_max_hq")

def get_ffmpeg_dir() -> Optional[str]:
    """Retorna el directorio donde se encuentra la ejecutable de ffmpeg."""
    user_local = os.path.expanduser("~/.local/bin/ffmpeg")
    if os.path.isfile(user_local) and os.access(user_local, os.X_OK):
        return os.path.dirname(user_local)

    which_ffmpeg = shutil.which("ffmpeg")
    if which_ffmpeg:
        return os.path.dirname(which_ffmpeg)

    try:
        import static_ffmpeg
        static_ffmpeg.add_paths()
        which_ffmpeg = shutil.which("ffmpeg")
        if which_ffmpeg:
            return os.path.dirname(which_ffmpeg)
    except Exception:
        pass

    return None


class YouTubeDownloader:
    def __init__(self, output_dir: str = None):
        self.output_dir = output_dir or os.path.expanduser("~/Downloads")
        os.makedirs(self.output_dir, exist_ok=True)
        self.ffmpeg_dir = get_ffmpeg_dir()
        if self.ffmpeg_dir:
            logger.info(f"FFmpeg detectado en: {self.ffmpeg_dir}")
        else:
            logger.warning("FFmpeg no fue detectado. Las descargas pueden limitarse a resoluciones combinadas predeterminadas (720p/1080p).")

    def get_info(self, url: str, cookies_from_browser: Optional[str] = None) -> Dict[str, Any]:
        """Obtiene información y metadatos del video sin descargarlo."""
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'extract_flat': False,
            'js_runtimes': {'node': {}},
            'remote_components': ['ejs:github'],
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        }
        if cookies_from_browser:
            ydl_opts['cookiesfrombrowser'] = (cookies_from_browser,)

        if self.ffmpeg_dir:
            ydl_opts['ffmpeg_location'] = self.ffmpeg_dir

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return self._parse_metadata(info)

    def _parse_metadata(self, info: Dict[str, Any]) -> Dict[str, Any]:
        """Procesa y extrae la información relevante de los formatos."""
        title = info.get('title', 'Video sin título')
        thumbnail = info.get('thumbnail', '')
        duration = info.get('duration', 0)
        uploader = info.get('uploader', 'Canal desconocido')

        formats = info.get('formats', [])
        resolutions = set()
        audio_languages = set()
        has_original_audio = False

        for f in formats:
            # Resoluciones de video
            h = f.get('height')
            if h and f.get('vcodec') != 'none':
                resolutions.add(h)
            
            # Pistas de audio e idioma original
            fn = str(f.get('format_note', '')).lower()
            lang = f.get('language') or f.get('language_preference')
            if 'original' in fn:
                has_original_audio = True
            if lang:
                audio_languages.add(str(lang))

        sorted_res = sorted(list(resolutions), reverse=True)
        res_labels = []
        for r in sorted_res:
            if r >= 4320:
                res_labels.append(f"{r}p (8K Ultra HD)")
            elif r >= 2160:
                res_labels.append(f"{r}p (4K Ultra HD)")
            elif r >= 1440:
                res_labels.append(f"{r}p (2K Quad HD)")
            elif r >= 1080:
                res_labels.append(f"{r}p (Full HD)")
            elif r >= 720:
                res_labels.append(f"{r}p (HD)")
            else:
                res_labels.append(f"{r}p")

        return {
            'id': info.get('id'),
            'title': title,
            'uploader': uploader,
            'thumbnail': thumbnail,
            'duration': duration,
            'resolutions': res_labels,
            'available_heights': sorted_res,
            'has_original_audio': has_original_audio,
            'audio_languages': sorted(list(audio_languages)),
            'webpage_url': info.get('webpage_url', ''),
        }

    def build_format_string(self, max_height: Optional[int] = None, force_original_audio: bool = True, audio_only: bool = False, container: str = "mp4") -> str:
        """Construye la regla de selección de formato para yt-dlp garantizando máxima calidad."""
        if audio_only:
            if force_original_audio:
                return "bestaudio[format_note*='original']/bestaudio[is_original=true]/bestaudio[language_preference>=0]/bestaudio/best"
            return "bestaudio/best"

        v_rule = f"bestvideo[height<={max_height}]" if (max_height and max_height > 0) else "bestvideo"
        b_rule = f"best[height<={max_height}]" if (max_height and max_height > 0) else "best"

        if force_original_audio:
            # Cada alternativa incluye el stream de video v_rule para no caer a 360p
            return (
                f"{v_rule}+bestaudio[format_note*='original']/"
                f"{v_rule}+bestaudio[is_original=true]/"
                f"{v_rule}+bestaudio[language_preference>=0]/"
                f"{v_rule}+bestaudio/"
                f"{b_rule}"
            )
        else:
            return f"{v_rule}+bestaudio/{b_rule}"

    def download(
        self,
        url: str,
        max_height: Optional[int] = None,
        force_original_audio: bool = True,
        audio_only: bool = False,
        container: str = "mp4",
        output_path: Optional[str] = None,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> str:
        """Realiza la descarga del video en máxima calidad e idioma original."""
        target_dir = output_path or self.output_dir
        os.makedirs(target_dir, exist_ok=True)

        format_str = self.build_format_string(max_height, force_original_audio, audio_only, container)

        out_template = os.path.join(target_dir, '%(title)s [%(id)s].%(ext)s')

        def _internal_progress_hook(d):
            if not progress_callback:
                return
            status = d.get('status')
            if status == 'downloading':
                total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
                downloaded = d.get('downloaded_bytes') or 0
                speed = d.get('speed') or 0
                eta = d.get('eta') or 0
                percent = (downloaded / total * 100) if total > 0 else 0

                progress_callback({
                    'status': 'downloading',
                    'percent': percent,
                    'downloaded_bytes': downloaded,
                    'total_bytes': total,
                    'speed': speed,
                    'eta': eta,
                    'filename': d.get('filename'),
                })
            elif status == 'finished':
                progress_callback({
                    'status': 'processing',
                    'percent': 99.0,
                    'message': 'Fusionando video y audio con FFmpeg...',
                    'filename': d.get('filename'),
                })
            elif status == 'error':
                progress_callback({
                    'status': 'error',
                    'message': 'Ocurrió un error en la descarga.',
                })

        ydl_opts = {
            'format': format_str,
            'outtmpl': out_template,
            'progress_hooks': [_internal_progress_hook],
            'writethumb': True,
            'embedthumbnail': True if container in ['mp4', 'mkv', 'mp3'] else False,
            'addmetadata': True,
            'no_warnings': True,
            'quiet': True,
            'js_runtimes': {'node': {}},
            'remote_components': ['ejs:github'],
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        }

        if audio_only:
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3' if container == 'mp3' else 'm4a',
                'preferredquality': '320',
            }]
        elif self.ffmpeg_dir:
            ydl_opts['ffmpeg_location'] = self.ffmpeg_dir
            ydl_opts['merge_output_format'] = container

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            logger.info(f"Iniciando descarga: {url} | Formato: {format_str}")
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            if container and not filename.endswith(container):
                base, _ = os.path.splitext(filename)
                filename = f"{base}.{container}"

            if progress_callback:
                progress_callback({
                    'status': 'completed',
                    'percent': 100.0,
                    'filepath': filename,
                    'title': info.get('title', 'Video'),
                })

            return filename


if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_url = sys.argv[1]
        downloader = YouTubeDownloader()
        print("Obteniendo información del video...")
        info = downloader.get_info(test_url)
        print(f"Título: {info['title']}")
        print(f"Canal: {info['uploader']}")
        print(f"Resoluciones disponibles: {info['resolutions']}")
        print(f"¿Audio Original detectado?: {info['has_original_audio']}")
    else:
        print("Uso: python3 yt_max_hq.py <URL>")
