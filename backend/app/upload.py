import os
import math
import uuid
import time
import logging
from urllib.parse import unquote
from typing import Dict, Any, Optional, Set
from fastapi import APIRouter, Request, Header, HTTPException, status, BackgroundTasks
from pydantic import BaseModel

from app.cleanup import get_media_dir, create_sidecar_metadata
from app.jellyfin import refresh_media_path

logger = logging.getLogger("watch-together.upload")

router = APIRouter(prefix="/api", tags=["upload"])

# Global dictionary tracking active upload progress
active_uploads: Dict[str, Dict[str, Any]] = {}

UPLOAD_SECRET_TOKEN = os.getenv("UPLOAD_SECRET_TOKEN", "")

ALLOWED_EXTENSIONS = {
    ".mp4", ".mkv", ".webm", ".avi", ".mov", ".m4v",
    ".flv", ".ts", ".m2ts", ".wmv", ".3gp", ".mpg", ".mpeg"
}

def sanitize_filename(filename: str) -> str:
    clean_name = os.path.basename(filename or "video.mp4")
    base, ext = os.path.splitext(clean_name)
    if not ext and "." in clean_name and not clean_name.startswith("."):
        parts = clean_name.rsplit(".", 1)
        base, ext = parts[0], f".{parts[1]}"

    safe_base = "".join(c for c in base if c.isalnum() or c in " ._-()[]áéíóúñÁÉÍÓÚÑ")
    if not safe_base.strip():
        safe_base = "video"
    return f"{safe_base}{ext.lower()}"

class InitUploadRequest(BaseModel):
    filename: str
    total_size: int
    chunk_size: Optional[int] = 5 * 1024 * 1024  # 5MB chunk default for fast reliability

@router.post("/upload/init")
def init_chunked_upload(data: InitUploadRequest):
    original_filename = sanitize_filename(data.filename)
    ext = os.path.splitext(original_filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato '{ext}' no permitido. Formatos permitidos: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    upload_id = str(uuid.uuid4())[:8]
    unique_filename = f"{upload_id}_{original_filename}"
    media_dir = get_media_dir()
    temp_path = os.path.join(media_dir, f"{unique_filename}.part")

    chunk_size = data.chunk_size or (5 * 1024 * 1024)
    total_chunks = max(1, math.ceil(data.total_size / chunk_size))

    active_uploads[upload_id] = {
        "upload_id": upload_id,
        "original_name": original_filename,
        "filename": unique_filename,
        "temp_path": temp_path,
        "bytes_received": 0,
        "total_bytes": data.total_size,
        "received_chunks": set(),
        "total_chunks": total_chunks,
        "chunk_size": chunk_size,
        "status": "UPLOADING",
        "start_time": time.time()
    }

    # Initialize empty file
    with open(temp_path, "wb") as f:
        pass

    logger.info(f"Initialized chunked upload for {original_filename} ({data.total_size / (1024*1024):.2f} MB, {total_chunks} chunks)")

    return {
        "upload_id": upload_id,
        "total_chunks": total_chunks,
        "chunk_size": chunk_size
    }

@router.post("/upload/chunk")
async def upload_chunk(
    request: Request,
    background_tasks: BackgroundTasks,
    x_upload_id: str = Header(...),
    x_chunk_index: int = Header(...)
):
    if x_upload_id not in active_uploads:
        raise HTTPException(status_code=404, detail="Sesión de subida no encontrada o expirada")

    session = active_uploads[x_upload_id]
    temp_path = session["temp_path"]

    chunk_data = await request.body()
    chunk_len = len(chunk_data)

    offset = x_chunk_index * session["chunk_size"]
    with open(temp_path, "r+b") as f:
        f.seek(offset)
        f.write(chunk_data)

    if x_chunk_index not in session["received_chunks"]:
        session["received_chunks"].add(x_chunk_index)
        session["bytes_received"] += chunk_len

    elapsed = max(0.1, time.time() - session["start_time"])
    speed_mbps = ((session["bytes_received"] / elapsed) * 8) / (1024 * 1024)
    session["speed_mbps"] = round(speed_mbps, 2)

    # Check if all chunks have arrived
    if len(session["received_chunks"]) >= session["total_chunks"]:
        final_filename = session["filename"]
        media_dir = get_media_dir()
        final_path = os.path.join(media_dir, final_filename)

        os.rename(temp_path, final_path)
        actual_size = os.path.getsize(final_path)

        metadata = create_sidecar_metadata(
            file_id=x_upload_id,
            filename=final_filename,
            original_name=session["original_name"],
            size_bytes=actual_size,
            retention_hours=24
        )

        session["status"] = "COMPLETED"
        session["total_bytes"] = actual_size

        background_tasks.add_task(refresh_media_path, final_path)

        logger.info(f"Chunked upload finished for {session['original_name']} ({actual_size / (1024*1024):.2f} MB)")

        return {
            "status": "completed",
            "message": "Película subida y registrada exitosamente",
            "media": metadata
        }

    return {
        "status": "chunk_received",
        "chunk_index": x_chunk_index,
        "received_chunks": len(session["received_chunks"]),
        "total_chunks": session["total_chunks"]
    }

# Fallback monolithic stream route for curl / legacy clients
@router.post("/upload")
async def upload_temporary_media(
    request: Request,
    background_tasks: BackgroundTasks,
    x_filename: Optional[str] = Header(None),
    x_upload_secret: Optional[str] = Header(None)
):
    if UPLOAD_SECRET_TOKEN and x_upload_secret != UPLOAD_SECRET_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid upload authorization token")

    raw_name = ""
    file_obj: Optional[Any] = None

    if x_filename:
        raw_name = unquote(x_filename)
    else:
        try:
            form = await request.form()
            file_item = form.get("file")
            if file_item and hasattr(file_item, "filename"):
                file_obj = file_item
                raw_name = file_item.filename or "video.mp4"
        except Exception:
            pass

    if not raw_name:
        raise HTTPException(status_code=400, detail="No file or X-Filename header provided")

    original_filename = sanitize_filename(raw_name)
    ext = os.path.splitext(original_filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato '{ext}' no permitido. Formatos permitidos: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    upload_id = str(uuid.uuid4())[:8]
    unique_filename = f"{upload_id}_{original_filename}"
    media_dir = get_media_dir()
    file_path = os.path.join(media_dir, unique_filename)

    total_bytes = 0
    try:
        start_time = time.time()
        with open(file_path, "wb") as buffer:
            if x_filename:
                async for chunk in request.stream():
                    buffer.write(chunk)
                    total_bytes += len(chunk)
            elif file_obj:
                CHUNK_SIZE = 1024 * 1024
                while chunk := await file_obj.read(CHUNK_SIZE):
                    buffer.write(chunk)
                    total_bytes += len(chunk)

        metadata = create_sidecar_metadata(
            file_id=upload_id,
            filename=unique_filename,
            original_name=original_filename,
            size_bytes=total_bytes,
            retention_hours=24
        )

        background_tasks.add_task(refresh_media_path, file_path)

        return {
            "status": "ok",
            "message": "Upload completed successfully",
            "media": metadata
        }

    except Exception as e:
        logger.error(f"Error during upload of {original_filename}: {e}")
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/upload/progress/{upload_id}")
def get_upload_progress(upload_id: str):
    if upload_id not in active_uploads:
        raise HTTPException(status_code=404, detail="Upload ID not found")
    return active_uploads[upload_id]
