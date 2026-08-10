import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_upload_and_delete_media():
    # 1. Check initially empty list
    res_list = client.get("/api/media")
    assert res_list.status_code == 200
    assert "media" in res_list.json()

    # 2. Upload dummy file
    dummy_file = ("test_movie.mp4", b"dummy video content stream", "video/mp4")
    upload_res = client.post("/api/upload", files={"file": dummy_file})
    assert upload_res.status_code == 200
    data = upload_res.json()
    assert data["status"] == "ok"
    assert "media" in data
    media_info = data["media"]
    file_id = media_info["id"]
    assert media_info["original_name"] == "test_movie.mp4"
    assert "expires_at" in media_info

    # 3. Verify item appears in media list
    res_list2 = client.get("/api/media")
    assert res_list2.status_code == 200
    items = res_list2.json()["media"]
    assert any(item["id"] == file_id for item in items)

    # 4. Delete uploaded test media
    del_res = client.delete(f"/api/media/{file_id}")
    assert del_res.status_code == 200

    # 5. Verify deletion
    res_list3 = client.get("/api/media")
    assert not any(item["id"] == file_id for item in res_list3.json()["media"])
