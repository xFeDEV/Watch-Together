export type RoomRole = 'host' | 'guest';

export type WSConnectionStatus = 'connected' | 'connecting' | 'disconnected';
export type WebRTCConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'failed';

export interface VideoState {
  has_video: boolean;
  video_name: string;
  is_playing: boolean;
  current_time: number;
  playback_rate: number;
  updated_at?: number;
}

export interface PeerInfo {
  client_id: string;
  role: RoomRole;
}

export interface RoomStateMessage {
  type: 'room_state';
  room_id: string;
  host_id: string;
  peer_count: number;
  peers: PeerInfo[];
  video_state: VideoState;
}

export interface JoinedMessage {
  type: 'joined';
  room_id: string;
  client_id: string;
  role: RoomRole;
  peer_count: number;
  video_state: VideoState;
}

export interface WebRTCMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  sender_id: string;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

export interface MediaControlMessage {
  type: 'play' | 'pause' | 'seek' | 'state';
  sender_id: string;
  payload: {
    current_time?: number;
    playback_rate?: number;
    video_name?: string;
  };
  video_state?: VideoState;
}
