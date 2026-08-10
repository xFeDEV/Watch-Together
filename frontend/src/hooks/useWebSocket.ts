import { useEffect, useRef, useState, useCallback } from 'react';
import type { RoomRole, WSConnectionStatus, PeerInfo, VideoState } from '../types/room';

interface UseWebSocketOptions {
  roomId: string;
  onMessage?: (data: any) => void;
}

export function useWebSocket({ roomId, onMessage }: UseWebSocketOptions) {
  const [wsStatus, setWsStatus] = useState<WSConnectionStatus>('connecting');
  const [role, setRole] = useState<RoomRole>('guest');
  const [clientId, setClientId] = useState<string>('');
  const [peerCount, setPeerCount] = useState<number>(1);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [videoState, setVideoState] = useState<VideoState>({
    has_video: false,
    video_name: '',
    is_playing: false,
    current_time: 0,
    playback_rate: 1.0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<number | null>(null);

  const getWsUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // Default to port 8000 in dev mode if running Vite on 5173
    const wsHost = window.location.port === '5173' ? `${window.location.hostname}:8000` : host;
    return `${protocol}//${wsHost}/ws/${roomId.toUpperCase()}`;
  }, [roomId]);

  const send = useCallback((type: string, payload: any = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  useEffect(() => {
    if (!roomId) return;

    setWsStatus('connecting');
    const wsUrl = getWsUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
      // Setup ping heartbeat every 15s
      pingIntervalRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 15000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'joined') {
          setRole(data.role);
          setClientId(data.client_id);
          setPeerCount(data.peer_count);
          if (data.video_state) setVideoState(data.video_state);
        } else if (data.type === 'room_state') {
          setPeerCount(data.peer_count);
          setPeers(data.peers || []);
          if (data.video_state) setVideoState(data.video_state);
        }

        if (onMessage) {
          onMessage(data);
        }
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsStatus('disconnected');
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      ws.close();
    };
  }, [roomId, getWsUrl, onMessage]);

  return {
    wsStatus,
    role,
    clientId,
    peerCount,
    peers,
    videoState,
    send,
  };
}
