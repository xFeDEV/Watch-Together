from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_create_room():
    response = client.post("/rooms")
    assert response.status_code == 201
    data = response.json()
    assert "room_id" in data
    assert len(data["room_id"]) == 6

def test_room_lifecycle():
    # Create room
    create_res = client.post("/rooms")
    room_id = create_res.json()["room_id"]

    # Check room info
    info_res = client.get(f"/rooms/{room_id}")
    assert info_res.status_code == 200
    assert info_res.json()["peer_count"] == 0

    # Connect WebSocket client 1 (Host)
    with client.websocket_connect(f"/ws/{room_id}?client_id=client_1") as ws1:
        join_msg1 = ws1.receive_json()
        assert join_msg1["type"] == "joined"
        assert join_msg1["role"] == "host"

        state_msg1 = ws1.receive_json()
        assert state_msg1["type"] == "room_state"
        assert state_msg1["peer_count"] == 1

        # Connect WebSocket client 2 (Guest)
        with client.websocket_connect(f"/ws/{room_id}?client_id=client_2") as ws2:
            join_msg2 = ws2.receive_json()
            assert join_msg2["type"] == "joined"
            assert join_msg2["role"] == "guest"

            state_msg2 = ws2.receive_json()
            assert state_msg2["type"] == "room_state"
            assert state_msg2["peer_count"] == 2

            # Client 1 receives updated room state (2 peers)
            update_msg1 = ws1.receive_json()
            assert update_msg1["type"] == "room_state"
            assert update_msg1["peer_count"] == 2

            # Try to connect 3rd client (should be rejected)
            with client.websocket_connect(f"/ws/{room_id}?client_id=client_3") as ws3:
                err_msg = ws3.receive_json()
                assert err_msg["type"] == "error"
                assert "Room is full" in err_msg["message"]
