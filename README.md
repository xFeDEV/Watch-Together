# 🍿 Watch Together P2P

Aplicación web privada para ver videos y archivos multimedia de forma sincronizada punto a punto (**P2P**) entre dos participantes mediante **WebRTC** y **WebSockets**.

El archivo de video **NO se sube ni se almacena en el servidor backend (VPS)**. El equipo del anfitrión (*Host*) transmite el stream multimedia directamente al navegador invitado (*Guest*) mediante WebRTC.

---

## 🏗️ Arquitectura

```text
                 FastAPI (Signaling only)
                            │
               ┌────────────┴────────────┐
               │                         │
           Browser A                 Browser B
          (Anfitrión)               (Invitado)
               │                         ▲
               │      WebRTC Stream      │
               └─────────────────────────┘
                       P2P Direct
```

* **Frontend**: React + TypeScript + Vite + Tailwind CSS + Native WebRTC (`RTCPeerConnection`, `captureStream`).
* **Backend**: Python + FastAPI + WebSockets (Signaling Server, gestión de salas en memoria, límite de 2 personas por sala).
* **Infraestructura**: Docker + Docker Compose + STUN/TURN fallback.

---

## ⚙️ Decisión Técnica: Transmisión P2P Local (`captureStream`)

Para evitar cargar el archivo completo en la memoria RAM o subirlo al VPS:
1. El **Host** selecciona un archivo local (`<input type="file">`).
2. Se genera un Blob URL local y se carga en el elemento de video HTML5.
3. Se extraen las pistas decodificadas en tiempo real mediante `HTMLMediaElement.captureStream()`.
4. Las pistas de audio y video se transmiten sobre la conexión WebRTC P2P (`RTCPeerConnection`).
5. El **Guest** recibe el `MediaStream` y lo enlaza directamente al elemento de video (`video.srcObject`).

### Ventajas:
* **0 MB de almacenamiento** en servidor.
* **Bajo consumo de RAM (~50-150 MB)** incluso con películas de gran tamaño (4 GB a 50 GB+).
* Decodificación y transmisión fluida adaptativa.

---

## 🚀 Guía de Ejecución

### Opción A: Desarrollo Local Nativo (Sin Docker)

#### 1. Backend (FastAPI)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
El backend estará disponible en `http://localhost:8000`.

#### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
La aplicación web estará disponible en `http://localhost:5173`.

---

### Opción B: Despliegue con Docker Compose

1. Crear archivo `.env` a partir de `.env.example`:
```bash
cp .env.example .env
```

2. Iniciar servicios en segundo plano:
```bash
docker compose up -d
```

3. Acceder a la aplicación:
   * Frontend: `http://localhost:5173`
   * Backend Health: `http://localhost:8000/health`

4. Detener servicios:
```bash
docker compose down
```

---

## 🔑 Configuración de STUN / TURN

Por defecto, la aplicación utiliza el servidor STUN público de Google:
`stun:stun.l.google.com:19302`

Si ambos participantes se encuentran detrás de routers NAT simétricos o cortafuegos estrictos donde una conexión P2P directa no sea posible, puedes configurar tu propio servidor **TURN** en el archivo `.env`:

```env
VITE_STUN_SERVER=stun:stun.l.google.com:19302
VITE_TURN_SERVER=turn:tu-servidor-turn.com:3478
VITE_TURN_USERNAME=tu_usuario
VITE_TURN_PASSWORD=tu_password
```

---

## 🧪 Pruebas Automatizadas

El backend incluye una suite de pruebas con `pytest` para verificar endpoints y comportamiento del WebSocket signaling:

```bash
cd backend
./venv/bin/pytest tests/
```

---

## 🎬 Compatibilidad Multimedia

Los códecs soportados dependen de las capacidades nativas del navegador:
* **Recomendados**: MP4 (H.264 / AAC), WebM (VP8 / VP9 / AV1).
* En caso de seleccionar un formato no compatible (ej. ciertos archivos MKV con audio no estándar), la interfaz mostrará una alerta clara indicando la falta de compatibilidad nativa sin bloquear la aplicación.
