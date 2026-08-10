import os
import json
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

from app.jellyfin import is_path_currently_playing, refresh_media_path

logger = logging.getLogger("watch-together.cleanup")

MEDIA_DIR = os.getenv("MEDIA_DIR", "/media/watch-together")

def get_media_dir() -> str:
    # Ensure media directory exists locally or in container
    target_dir = MEDIA_DIR if os.path.exists("/media/watch-together") else "./data/watch-together"
    os.makedirs(target_dir, exist_ok=True)
    return target_dir

def create_sidecar_metadata(file_id: str, filename: str, original_name: str, size_bytes: int, retention_hours: int = 24) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=retention_hours)

    metadata = {
        "id": file_id,
        "filename": filename,
        "original_name": original_name,
        "size_bytes": size_bytes,
        "uploaded_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "status": "AVAILABLE"
    }

    media_dir = get_media_dir()
    json_path = os.path.join(media_dir, f"{file_id}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    return metadata

def get_all_temporary_media() -> List[Dict[str, Any]]:
    media_dir = get_media_dir()
    results = []
    now = datetime.now(timezone.utc)

    for item in os.listdir(media_dir):
        if item.endswith(".json"):
            json_path = os.path.join(media_dir, item)
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)

                # Check if corresponding media file exists
                media_path = os.path.join(media_dir, data.get("filename", ""))
                if not os.path.exists(media_path):
                    # Clean up orphan JSON
                    os.remove(json_path)
                    continue

                exp = datetime.fromisoformat(data["expires_at"])
                remaining_seconds = (exp - now).total_seconds()

                if data.get("status") != "EXPIRING_WATCHING":
                    if remaining_seconds <= 0:
                        data["status"] = "EXPIRED"
                    elif remaining_seconds <= 3600:
                        data["status"] = "EXPIRING_SOON"
                    else:
                        data["status"] = "AVAILABLE"

                data["remaining_seconds"] = max(0, int(remaining_seconds))
                results.append(data)
            except Exception as e:
                logger.error(f"Error reading sidecar JSON {json_path}: {e}")

    # Sort newest first
    results.sort(key=lambda x: x.get("uploaded_at", ""), reverse=True)
    return results

async def delete_media_by_id(file_id: str) -> bool:
    media_dir = get_media_dir()
    json_path = os.path.join(media_dir, f"{file_id}.json")

    if not os.path.exists(json_path):
        return False

    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        filename = data.get("filename")
        media_path = os.path.join(media_dir, filename) if filename else None

        if media_path and os.path.exists(media_path):
            os.remove(media_path)
            logger.info(f"Deleted media file: {media_path}")
            # Notify Jellyfin
            await refresh_media_path(media_path)

        if os.path.exists(json_path):
            os.remove(json_path)

        return True
    except Exception as e:
        logger.error(f"Failed to delete media ID {file_id}: {e}")
        return False

async def run_expiration_check():
    """Scans and deletes expired media files while preserving active Jellyfin playback sessions"""
    logger.info("Running automatic 24-hour expiration check...")
    media_items = get_all_temporary_media()
    media_dir = get_media_dir()
    now = datetime.now(timezone.utc)

    for item in media_items:
        exp = datetime.fromisoformat(item["expires_at"])
        if now >= exp:
            file_id = item["id"]
            filename = item["filename"]
            media_path = os.path.join(media_dir, filename)

            # Check if currently playing in Jellyfin
            is_playing = await is_path_currently_playing(media_path)
            if is_playing:
                logger.info(f"File {filename} is expired but actively playing in Jellyfin. Deferring deletion.")
                # Mark status as EXPIRING_WATCHING
                json_path = os.path.join(media_dir, f"{file_id}.json")
                item["status"] = "EXPIRING_WATCHING"
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump(item, f, indent=2)
            else:
                logger.info(f"File {filename} (ID: {file_id}) has expired. Deleting...")
                await delete_media_by_id(file_id)
