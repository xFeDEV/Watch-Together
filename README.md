# 🍿 Watch Together — Jellyfin + SyncPlay + Temporary 24h Media

Aplicación privada para subir películas/videos temporales y verlos en sincronía entre **Federico** y **Cris** mediante **Jellyfin + SyncPlay** o reproducción **P2P en directo**.

---

## 🚀 Inicio Rápido

### 1. Iniciar servicios en Docker

```bash
docker compose up -d --build
```

### 2. Detener servicios

```bash
docker compose down
```

---

## ⚙️ Configuración y Variables de Entorno (`.env`)

Crea o edita el archivo `.env` en la raíz del proyecto:

```env
DOMAIN=cine.feexel.tech
JELLYFIN_DOMAIN=jellyfin.feexel.tech
CERT_RESOLVER=myresolver

# Clave API generada en Jellyfin (Panel Admin -> API Keys)
JELLYFIN_API_KEY=tu_clave_api_aqui
```

> **DNS**: Recuerda apuntar los registros A de DNS de `cine.feexel.tech` y `jellyfin.feexel.tech` a la IP de tu VPS.

---

## 🍿 Configuración Inicial de Jellyfin (Primera vez)

1. Ingresa a `https://jellyfin.feexel.tech`.
2. Completa el asistente inicial creando la cuenta de administración.
3. **Crear Biblioteca de Películas Temporales**:
   - Ve a **Panel de Control (Dashboard) -> Bibliotecas**.
   - Haz clic en **Añadir Biblioteca**.
   - Tipo de contenido: **Películas**.
   - Nombre: `Películas Temporales`.
   - Carpeta: `/media/watch-together`.
4. **Crear Usuarios**:
   - Crea los usuarios **Federico** y **Cris**.
   - En sus perfiles de usuario (Pestaña *Reproducción*), se recomienda deshabilitar *Permitir la transcodificación de vídeo* para garantizar reproducción fluida por **Direct Play** sin saturar la CPU del VPS.
5. **Generar API Key para Automatización**:
   - Ve a **Panel de Control -> Claves API**.
   - Haz clic en **Añadir Clave API** (Nombre: `WatchTogether`).
   - Copia la clave generada y pégala en tu `.env` como `JELLYFIN_API_KEY`.
   - Reinicia los contenedores: `docker compose restart backend`.

---

## ⏰ Funcionamiento de los Archivos Temporales (24h)

* **Subida en Streaming (0% RAM)**: Puedes subir películas grandes (desde 500MB hasta 20GB). El backend escribe por bloques directamente en `./data/watch-together` consumiendo <30MB de memoria RAM.
* **Escaneo Automático**: Al terminar la subida, la app invoca la API de Jellyfin (`POST /Library/Media/Updated`), haciendo que la película aparezca en la biblioteca en **1-2 segundos**.
* **Expiración de 24 horas**:
  * Cada película incluye un temporizador visible (`⏳ Expira en: 18h 42m`).
  * Una tarea de fondo revisa expiraciones cada 5 minutos y al iniciar el contenedor.
  * **Protección de Reproducción Activa**: Si Federico o Cris están viendo la película en SyncPlay al cumplirse las 24h, el sistema detecta la sesión activa (`GET /Sessions`) y pospone la eliminación hasta que finalice la reproducción.

---

## 🛠️ Guía de Solución de Problemas (Troubleshooting)

| Problema | Causa | Solución |
| :--- | :--- | :--- |
| **Jellyfin no detecta el video subido** | `JELLYFIN_API_KEY` no configurada o incorrecta. | Verifica la API Key en `.env` y comprueba la consola del contenedor `watchtogether-backend`. |
| **Video en negro o consumo de CPU alto en VPS** | El video utiliza un códec no nativo web (ej. H.265 / MKV / AC3). | Procura subir archivos `.mp4` (H.264 / AAC) para forzar **Direct Play** (CPU <5%). |
| **SyncPlay desincronizado** | Diferencia de latencia o conexión inestable. | En el reproductor de Jellyfin, pulsa el icono de SyncPlay (esquina superior derecha) para reacoplar el grupo. |
| **Upload falla en archivos de >2GB** | Tiempo de espera en proxy o tamaño máximo. | Traefik procesa uploads sin límite de tamaño por defecto; asegúrate de tener espacio disponible en el disco del VPS. |
