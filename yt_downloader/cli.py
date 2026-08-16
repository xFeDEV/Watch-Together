#!/usr/bin/env python3
"""
Interfaz de Línea de Comandos (CLI) para YouTube Ultra Downloader.
Permite descargas en máxima calidad e idioma original desde la terminal.
"""

import sys
import argparse
import os
from yt_max_hq import YouTubeDownloader

def main():
    parser = argparse.ArgumentParser(
        description="YouTube Ultra Downloader CLI - Descarga videos en Máxima Calidad e Idioma Original en Linux"
    )
    parser.add_argument("url", help="URL del video o playlist de YouTube")
    parser.add_argument(
        "-q", "--quality",
        choices=["max", "4k", "2k", "1080p", "720p", "audio"],
        default="max",
        help="Calidad máxima de video deseada (por defecto: max)"
    )
    parser.add_argument(
        "-o", "--output",
        default=os.path.expanduser("~/Downloads"),
        help="Carpeta de salida (por defecto: ~/Downloads)"
    )
    parser.add_argument(
        "-f", "--format",
        choices=["mp4", "mkv", "mp3"],
        default="mp4",
        help="Contenedor de salida (mp4, mkv, mp3)"
    )
    parser.add_argument(
        "--no-original-audio",
        action="store_true",
        help="No forzar la pista de idioma original (usar audio predeterminado)"
    )

    args = parser.parse_args()

    height_map = {
        "max": None,
        "4k": 2160,
        "2k": 1440,
        "1080p": 1080,
        "720p": 720,
    }

    max_height = height_map.get(args.quality)
    audio_only = (args.quality == "audio")
    force_orig = not args.no_original_audio

    downloader = YouTubeDownloader(output_dir=args.output)

    print("🔍 Analizando metadatos del video...")
    try:
        info = downloader.get_info(args.url)
        print(f"📌 Título: {info['title']}")
        print(f"👤 Canal:  {info['uploader']}")
        print(f"🎞️ Resoluciones disponibles: {', '.join(info['resolutions'][:5])}")
        print(f"🎵 Audio Original detectado: {'Sí' if info['has_original_audio'] else 'Estándar'}")
    except Exception as e:
        print(f"⚠️ No se pudieron obtener metadatos preliminares ({e}). Iniciando descarga directa...")

    print(f"\n🚀 Iniciando descarga (Calidad: {args.quality.upper()}, Idioma Original: {'Sí' if force_orig else 'No'})...")

    last_pct = [-1]

    def cli_progress_hook(d):
        status = d.get('status')
        if status == 'downloading':
            pct = int(d.get('percent', 0))
            if pct != last_pct[0] and pct % 5 == 0:
                last_pct[0] = pct
                dl_mb = d.get('downloaded_bytes', 0) / (1024 * 1024)
                tot_mb = data_tot = d.get('total_bytes', 0) / (1024 * 1024)
                speed_mb = d.get('speed', 0) / (1024 * 1024)
                sys.stdout.write(f"\r progress: [{pct}%] {dl_mb:.1f}/{tot_mb:.1f} MB ({speed_mb:.2f} MB/s)")
                sys.stdout.flush()
        elif status == 'processing':
            print("\n⚙️  Fusionando transmisiones con FFmpeg...")

    try:
        filepath = downloader.download(
            url=args.url,
            max_height=max_height,
            force_original_audio=force_orig,
            audio_only=audio_only,
            container=args.format,
            output_path=args.output,
            progress_callback=cli_progress_hook
        )
        print(f"\n✅ ¡Descarga completada exitosamente!")
        print(f"📁 Guardado en: {filepath}")
    except Exception as e:
        print(f"\n❌ Error durante la descarga: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
