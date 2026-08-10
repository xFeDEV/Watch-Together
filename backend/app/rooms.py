import random
import string
from typing import Dict, Optional, Tuple
from fastapi import WebSocket

def generate_room_id(length: int = 6) -> str:
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))

class Room:
    def __init__(self, room_id: str):
        self.room_id: str = room_id
        self.host_id: Optional[str] = None
        self.peers: Dict[str, WebSocket] = {}
        self.peer_roles: Dict[str, str] = {}  # client_id -> "host" | "guest"
        self.video_state: Dict = {
            "has_video": False,
            "video_name": "",
            "is_playing": False,
            "current_time": 0.0,
            "playback_rate": 1.0,
            "updated_at": 0.0
        }

    def add_peer(self, client_id: str, websocket: WebSocket) -> Tuple[bool, str]:
        if len(self.peers) >= 2 and client_id not in self.peers:
            return False, ""
        
        if not self.peers or self.host_id == client_id:
            role = "host"
            self.host_id = client_id
        else:
            role = "guest"

        self.peers[client_id] = websocket
        self.peer_roles[client_id] = role
        return True, role

    def remove_peer(self, client_id: str) -> bool:
        if client_id in self.peers:
            del self.peers[client_id]
            del self.peer_roles[client_id]
            if self.host_id == client_id:
                # Assign new host if guest is still connected
                remaining = list(self.peers.keys())
                if remaining:
                    self.host_id = remaining[0]
                    self.peer_roles[self.host_id] = "host"
                else:
                    self.host_id = None
        return len(self.peers) == 0

    def is_full() -> bool:
        return len(self.peers) >= 2


class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}

    def create_room(self) -> str:
        for _ in range(100):
            room_id = generate_room_id()
            if room_id not in self.rooms:
                self.rooms[room_id] = Room(room_id)
                return room_id
        raise RuntimeError("Failed to generate a unique room ID")

    def get_room(self, room_id: str) -> Optional[Room]:
        return self.rooms.get(room_id.upper())

    def remove_room(self, room_id: str):
        room_id_upper = room_id.upper()
        if room_id_upper in self.rooms:
            del self.rooms[room_id_upper]


room_manager = RoomManager()
