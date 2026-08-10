import time
import json
import logging
import asyncio
from typing import Optional, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.rooms import room_manager
from app.upload import router as upload_router
from app.cleanup import get_all_temporary_media, delete_media_by_id, run_expiration_check
from app.jellyfin import get_active_sessions, JELLYFIN_URL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("watch-together")

app = FastAPI(title="Watch Together P2P & Jellyfin SyncPlay Manager")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)

class CreateRoomResponse(BaseModel):
    room_id: str

@app.on_event("startup")
async def startup_event():
    # Run initial expiration check on server start (handles server reboots)
    asyncio.create_task(run_periodic_expiration_checks())

async def run_periodic_expiration_checks():
    while True:
        try:
            await run_expiration_check()
        except Exception as e:
            logger.error(f"Error in periodic expiration check: {e}")
        await asyncio.sleep(300)  # Check every 5 minutes

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/rooms", response_model=CreateRoomResponse, status_code=status.HTTP_201_CREATED)
@app.post("/api/rooms", response_model=CreateRoomResponse, status_code=status.HTTP_201_CREATED)
def create_room():
    room_id = room_manager.create_room()
    logger.info(f"Created room: {room_id}")
    return {"room_id": room_id}

@app.get("/rooms/{room_id}")
@app.get("/api/rooms/{room_id}")
def get_room_info(room_id: str):
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return {
        "room_id": room.room_id,
        "peer_count": len(room.peers),
        "is_full": len(room.peers) >= 2,
        "video_state": room.video_state
    }

# Temporary Media Management Endpoints
@app.get("/api/media")
def list_temporary_media():
    return {"media": get_all_temporary_media()}

@app.delete("/api/media/{file_id}")
async def delete_temporary_media(file_id: str):
    success = await delete_media_by_id(file_id)
    if not success:
        raise HTTPException(status_code=404, detail="Media file not found")
    return {"status": "ok", "message": "Media deleted successfully"}

@app.get("/api/jellyfin/status")
async def jellyfin_status():
    sessions = await get_active_sessions()
    return {
        "jellyfin_url": JELLYFIN_URL,
        "active_sessions_count": len(sessions),
        "sessions": sessions
    }

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_id: Optional[str] = None):
    room_id_upper = room_id.upper()
    room = room_manager.get_room(room_id_upper)

    if not room:
        await websocket.close(code=4004, reason="Room not found")
        return

    if not client_id:
        client_id = f"peer_{int(time.time() * 1000)}_{id(websocket)}"

    await websocket.accept()

    success, role = room.add_peer(client_id, websocket)
    if not success:
        await websocket.send_json({
            "type": "error",
            "message": "Room is full (max 2 participants)"
        })
        await websocket.close(code=4001, reason="Room is full")
        return

    logger.info(f"Client {client_id} joined room {room_id_upper} as {role}")

    # Notify self of assignment
    await websocket.send_json({
        "type": "joined",
        "room_id": room_id_upper,
        "client_id": client_id,
        "role": role,
        "peer_count": len(room.peers),
        "video_state": room.video_state
    })

    # Notify all peers in room of updated room state
    await broadcast_room_state(room, exclude_client=None)

    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                msg = json.loads(raw_data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON format"})
                continue

            msg_type = msg.get("type")
            payload = msg.get("payload", {})

            if msg_type == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": time.time()
                })

            elif msg_type in ("offer", "answer", "ice-candidate"):
                await forward_to_other_peers(room, sender_id=client_id, message={
                    "type": msg_type,
                    "sender_id": client_id,
                    "payload": payload
                })

            elif msg_type in ("play", "pause", "seek", "state"):
                if msg_type == "play":
                    room.video_state["is_playing"] = True
                    if "current_time" in payload:
                        room.video_state["current_time"] = float(payload["current_time"])
                elif msg_type == "pause":
                    room.video_state["is_playing"] = False
                    if "current_time" in payload:
                        room.video_state["current_time"] = float(payload["current_time"])
                elif msg_type == "seek":
                    if "current_time" in payload:
                        room.video_state["current_time"] = float(payload["current_time"])
                elif msg_type == "state":
                    room.video_state.update(payload)
                
                room.video_state["updated_at"] = time.time()

                await forward_to_other_peers(room, sender_id=client_id, message={
                    "type": msg_type,
                    "sender_id": client_id,
                    "payload": payload,
                    "video_state": room.video_state
                })

            elif msg_type == "leave":
                break

            else:
                await forward_to_other_peers(room, sender_id=client_id, message={
                    "type": msg_type,
                    "sender_id": client_id,
                    "payload": payload
                })

    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected from {room_id_upper}")
    except Exception as e:
        logger.error(f"WebSocket error for {client_id}: {e}")
    finally:
        is_empty = room.remove_peer(client_id)
        if is_empty:
            logger.info(f"Room {room_id_upper} is empty, removing room.")
            room_manager.remove_room(room_id_upper)
        else:
            await broadcast_room_state(room, exclude_client=client_id)


async def forward_to_other_peers(room, sender_id: str, message: dict):
    for pid, ws in list(room.peers.items()):
        if pid != sender_id:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to {pid}: {e}")


async def broadcast_room_state(room, exclude_client: Optional[str] = None):
    peers_info = [
        {"client_id": pid, "role": role}
        for pid, role in room.peer_roles.items()
    ]
    msg = {
        "type": "room_state",
        "room_id": room.room_id,
        "host_id": room.host_id,
        "peer_count": len(room.peers),
        "peers": peers_info,
        "video_state": room.video_state
    }
    for pid, ws in list(room.peers.items()):
        if pid != exclude_client:
            try:
                await ws.send_json(msg)
            except Exception as e:
                logger.error(f"Error broadcasting state to {pid}: {e}")
