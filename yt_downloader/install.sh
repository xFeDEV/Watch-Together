#!/bin/bash

# Script de Instalación e Integración de YouTube Ultra Downloader en Linux

set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$HOME/.local/bin"
LIB_DIR="$HOME/.local/lib"
DESKTOP_DIR="$HOME/.local/share/applications"

echo "🚀 Instalando YouTube Ultra Downloader en Linux..."

mkdir -p "$BIN_DIR"
mkdir -p "$LIB_DIR"
mkdir -p "$DESKTOP_DIR"

# Asegurar dependencias de Qt6 XCB (libxcb-cursor0) sin requerir sudo
if ! ldconfig -p 2>/dev/null | grep -q "libxcb-cursor.so.0" && [ ! -f "$LIB_DIR/libxcb-cursor.so.0" ]; then
    echo "📦 Configurando biblioteca Qt6 (libxcb-cursor0)..."
    cd /tmp
    if command -v apt-get >/dev/null 2>&1; then
        apt-get download libxcb-cursor0 >/dev/null 2>&1 || true
        if [ -f libxcb-cursor0*.deb ]; then
            dpkg-deb -x libxcb-cursor0*.deb /tmp/xcb_tmp
            cp -a /tmp/xcb_tmp/usr/lib/*/* "$LIB_DIR/" 2>/dev/null || true
            rm -rf /tmp/xcb_tmp *.deb
        fi
    fi
    cd "$APP_DIR"
fi

chmod +x "$APP_DIR/yt_max_hq.py"
chmod +x "$APP_DIR/gui.py"
chmod +x "$APP_DIR/cli.py"

# Wrapper para GUI con LD_LIBRARY_PATH
cat << EOF > "$BIN_DIR/yt-downloader"
#!/bin/bash
export PATH="\$HOME/.local/bin:\$PATH"
export LD_LIBRARY_PATH="\$HOME/.local/lib:\$LD_LIBRARY_PATH"
python3 "$APP_DIR/gui.py" "\$@"
EOF
chmod +x "$BIN_DIR/yt-downloader"

# Wrapper para CLI
cat << EOF > "$BIN_DIR/yt-downloader-cli"
#!/bin/bash
export PATH="\$HOME/.local/bin:\$PATH"
export LD_LIBRARY_PATH="\$HOME/.local/lib:\$LD_LIBRARY_PATH"
python3 "$APP_DIR/cli.py" "\$@"
EOF
chmod +x "$BIN_DIR/yt-downloader-cli"

# Icono SVG
ICON_PATH="$APP_DIR/icon.svg"
if [ ! -f "$ICON_PATH" ]; then
cat << 'EOF' > "$ICON_PATH"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="play" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
    <linearGradient id="arrow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="210" stroke="#334155" stroke-width="8" fill="none"/>
  <path d="M 180 140 L 360 256 L 180 372 Z" fill="url(#play)"/>
  <path d="M 330 260 L 330 380 L 270 380 L 360 470 L 450 380 L 390 380 L 390 260 Z" fill="url(#arrow)" opacity="0.95"/>
</svg>
EOF
fi

# Acceso directo .desktop
cat << EOF > "$DESKTOP_DIR/yt-downloader.desktop"
[Desktop Entry]
Version=1.0
Name=YouTube Ultra Downloader
GenericName=Descargador de Video en Máxima Calidad
Comment=Descarga videos de YouTube en 4K/8K y Audio en Idioma Original
Exec=$BIN_DIR/yt-downloader
Icon=$ICON_PATH
Terminal=false
Type=Application
Categories=AudioVideo;Network;Video;
Keywords=youtube;downloader;4k;video;audio;original;
EOF

chmod +x "$DESKTOP_DIR/yt-downloader.desktop"

if command -v update-desktop-database > /dev/null 2>&1; then
    update-desktop-database "$DESKTOP_DIR" > /dev/null 2>&1 || true
fi

echo "✅ ¡Instalación completada exitosamente!"
echo "📌 Ejecuta 'yt-downloader' en la terminal o desde el menú de aplicaciones de tu escritorio."
