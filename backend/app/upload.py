import os
import uuid
import time
import logging
from urllib.parse import unquote
from typing import Dict, Any, Optional
from fastapi import APIRouter, Request, UploadFile, File, Header, HTTPException, status, BackgroundTasks

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
    # Separate extension first to prevent dot issues
    base, ext = os.path.splitext(clean_name)
    if not ext and "." in clean_name and not clean_name.startswith("."):
        parts = clean_name.rsplit(".", 1)
        base, ext = parts[0], f".{parts[1]}"

    # Allow alphanumeric, spaces, hyphens, underscores, dots, brackets, parentheses, Spanish accents
    safe_base = "".join(c for c in base if c.isalnum() or c in " ._-()[]áéíóúñÁÉÍÓÚÑ")
    if not safe_base.strip():
        safe_base = "video"
    return f"{safe_base}{ext.lower()}"

@router.post("/upload")
async def upload_temporary_media(
    request: Request,
    background_tasks: BackgroundTasks,
    x_filename: Optional[str] = Header(None),
    x_upload_secret: Optional[str] = Header(None)
):
    # Optional authorization check if secret token is configured
    if UPLOAD_SECRET_TOKEN and x_upload_secret != UPLOAD_SECRET_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid upload authorization token")

    # Determine filename from X-Filename header or form data
    raw_name = ""
    file_obj: Optional[UploadFile] = None

    if x_filename:
        raw_name = unquote(x_filename)
    else:
        # Fallback to form parsing for legacy requests
        try:
            form = await request.form()
            file_item = form.get("file")
            if file_item and hasattr(file_item, "filename"):
                file_obj = file_item
                raw_name = file_item.filename or "video.mp4"
        except Exception:
            pass

    if not raw_name:
        raise HTTPException(status_code=400, detail="No valid file or X-Filename header provided")

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

    active_uploads[upload_id] = {
        "upload_id": upload_id,
        "original_name": original_filename,
        "filename": unique_filename,
        "bytes_received": 0,
        "total_bytes": 0,
        "speed_mbps": 0.0,
        "eta_seconds": 0,
        "status": "UPLOADING",
        "start_time": time.time()
    }

    total_bytes = 0

    try:
        start_time = time.time()
        with open(file_path, "wb") as buffer:
            if x_filename:
                # Direct HTTP request body streaming: instant start, 0MB buffer, no proxy timeout
                async for chunk in request.stream():
                    buffer.write(chunk)
                    total_bytes += len(chunk)

                    elapsed = max(0.1, time.time() - start_time)
                    speed_mbps = ((total_bytes / elapsed) * 8) / (1024 * 1024)

                    active_uploads[upload_id]["bytes_received"] = total_bytes
                    active_uploads[upload_id]["speed_mbps"] = round(speed_mbps, 2)
            elif file_obj:
                CHUNK_SIZE = 1024 * 1024
                while chunk := await file_obj.read(CHUNK_SIZE):
                    buffer.write(chunk)
                    total_bytes += len(chunk)

                    elapsed = max(0.1, time.time() - start_time)
                    speed_mbps = ((total_bytes / elapsed) * 8) / (1024 * 1024)

                    active_uploads[upload_id]["bytes_received"] = total_bytes
                    active_uploads[upload_id]["speed_mbps"] = round(speed_mbps, 2)

        # Create sidecar JSON metadata (24h retention)
        metadata = create_sidecar_metadata(
            file_id=upload_id,
            filename=unique_filename,
            original_name=original_filename,
            size_bytes=total_bytes,
            retention_hours=24
        )

        active_uploads[upload_id]["status"] = "COMPLETED"
        active_uploads[upload_id]["total_bytes"] = total_bytes

        # Schedule background notification to Jellyfin API
        background_tasks.add_task(refresh_media_path, file_path)

        logger.info(f"Successfully uploaded {original_filename} ({total_bytes / (1024*1024):.2f} MB)")

        return {
            "status": "ok",
            "message": "Upload completed successfully",
            "media": metadata
        }

    except Exception as e:
        logger.error(f"Error during upload of {original_filename}: {e}")
        active_uploads[upload_id]["status"] = "ERROR"
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/upload/progress/{upload_id}")
def get_upload_progress(upload_id: str):
    if upload_id not in active_uploads:
        raise HTTPException(status_code=404, detail="Upload ID not found")
    return active_uploads[upload_id]
