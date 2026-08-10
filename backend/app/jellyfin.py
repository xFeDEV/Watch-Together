import os
import logging
import httpx
from typing import List, Dict, Any, Optional

logger = logging.getLogger("watch-together.jellyfin")

JELLYFIN_URL = os.getenv("JELLYFIN_URL", "http://jellyfin:8096")
JELLYFIN_API_KEY = os.getenv("JELLYFIN_API_KEY", "")

def get_headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if JELLYFIN_API_KEY:
        headers["X-MediaBrowser-Token"] = JELLYFIN_API_KEY
    return headers

async def refresh_media_path(file_path: str) -> bool:
    """
    Notifies Jellyfin that a specific media file has been created or deleted
    using the targeted POST /Library/Media/Updated API endpoint.
    """
    if not JELLYFIN_API_KEY:
        logger.warning("JELLYFIN_API_KEY not configured. Skipping Jellyfin refresh.")
        return False

    url = f"{JELLYFIN_URL.rstrip('/')}/Library/Media/Updated"
    payload = {
        "Updates": [
            {
                "Path": file_path,
                "UpdateType": "Created"
            }
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload, headers=get_headers())
            if resp.status_code in (200, 204):
                logger.info(f"Successfully notified Jellyfin for path: {file_path}")
                return True
            else:
                logger.error(f"Jellyfin /Library/Media/Updated returned status {resp.status_code}: {resp.text}")
                # Fallback to full library refresh trigger
                return await trigger_full_refresh()
    except Exception as e:
        logger.error(f"Error calling Jellyfin API: {e}")
        return False

async def trigger_full_refresh() -> bool:
    """Fallback full library scan trigger"""
    if not JELLYFIN_API_KEY:
        return False

    url = f"{JELLYFIN_URL.rstrip('/')}/Library/Refresh"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=get_headers())
            return resp.status_code in (200, 204)
    except Exception as e:
        logger.error(f"Error triggering full Jellyfin refresh: {e}")
        return False

async def get_active_sessions() -> List[Dict[str, Any]]:
    """Retrieves active sessions from Jellyfin GET /Sessions endpoint"""
    if not JELLYFIN_API_KEY:
        return []

    url = f"{JELLYFIN_URL.rstrip('/')}/Sessions"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers=get_headers())
            if resp.status_code == 200:
                return resp.json()
            return []
    except Exception as e:
        logger.error(f"Error fetching Jellyfin active sessions: {e}")
        return []

async def is_path_currently_playing(file_path: str) -> bool:
    """Checks if any active session is currently playing the specified file path"""
    sessions = await get_active_sessions()
    norm_target = os.path.normpath(file_path).lower()

    for session in sessions:
        now_playing = session.get("NowPlayingItem")
        if now_playing and "Path" in now_playing:
            playing_path = os.path.normpath(now_playing["Path"]).lower()
            if playing_path == norm_target or norm_target.endswith(os.path.basename(playing_path)):
                logger.info(f"File {file_path} is currently playing in session {session.get('Id')}")
                return True
    return False
