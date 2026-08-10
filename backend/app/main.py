import time
import json
import logging
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.rooms import room_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("watch-together")

app = FastAPI(title="Watch Together P2P Signaling Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CreateRoomResponse(BaseModel):
    room_id: str

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
                # Forward WebRTC signaling to other peer
                await forward_to_other_peers(room, sender_id=client_id, message={
                    "type": msg_type,
                    "sender_id": client_id,
                    "payload": payload
                })

            elif msg_type in ("play", "pause", "seek", "state"):
                # Update room video state
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

                # Broadcast to other peer
                await forward_to_other_peers(room, sender_id=client_id, message={
                    "type": msg_type,
                    "sender_id": client_id,
                    "payload": payload,
                    "video_state": room.video_state
                })

            elif msg_type == "leave":
                break

            else:
                # Forward unknown/custom room events (e.g. video-changed, chat, etc)
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
