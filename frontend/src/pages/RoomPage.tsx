import React, { useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { VideoPlayer } from '../components/VideoPlayer';
import { RoomControls } from '../components/RoomControls';
import { FormatAlert } from '../components/FormatAlert';
import { useWebSocket } from '../hooks/useWebSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { useSyncPlayer } from '../hooks/useSyncPlayer';

export const RoomPage: React.FC = () => {
  const { roomId = '' } = useParams<{ roomId: string }>();

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [videoName, setVideoName] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Incoming signaling message router
  const handleWSMessage = useCallback((data: any) => {
    const type = data.type;

    if (type === 'offer') {
      handleOffer(data.payload);
    } else if (type === 'answer') {
      handleAnswer(data.payload);
    } else if (type === 'ice-candidate') {
      handleIceCandidate(data.payload);
    } else if (type === 'play' || type === 'pause' || type === 'seek' || type === 'state') {
      if (data.payload && data.payload.video_name) {
        setVideoName(data.payload.video_name);
      }
      handleRemoteAction(type, data.payload);
    } else if (type === 'room_state') {
      if (data.video_state && data.video_state.video_name) {
        setVideoName(data.video_state.video_name);
      }
    }
  }, []);

  const { wsStatus, role, peerCount, peers, send } = useWebSocket({
    roomId,
    onMessage: handleWSMessage,
  });

  const sendSignaling = useCallback((type: string, payload: any) => {
    send(type, payload);
  }, [send]);

  const onRemoteStreamAvailable = useCallback((stream: MediaStream) => {
    console.log('Remote stream attached to state');
    setRemoteStream(stream);
  }, []);

  const {
    webrtcStatus,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    updateLocalStream,
  } = useWebRTC({
    role,
    sendSignaling,
    onRemoteStreamAvailable,
  });

  const sendMediaControl = useCallback((type: 'play' | 'pause' | 'seek' | 'state', payload: any) => {
    send(type, { ...payload, video_name: videoName });
  }, [send, videoName]);

  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    formatError,
    togglePlay,
    seekTo,
    changeVolume,
    toggleMute,
    handleRemoteAction,
    setFormatError,
  } = useSyncPlayer({
    role,
    videoRef,
    sendMediaControl,
  });

  // Host selects local video file
  const handleFileSelected = (file: File) => {
    if (!videoRef.current) return;

    setVideoName(file.name);
    const blobUrl = URL.createObjectURL(file);
    videoRef.current.src = blobUrl;

    // Check format compatibility
    if (file.name.endsWith('.mkv') || file.name.endsWith('.avi')) {
      const canPlay = videoRef.current.canPlayType('video/mp4');
      console.log('Format test for selected file:', file.type, canPlay);
    }

    videoRef.current.load();

    // Extract stream using captureStream once metadata is ready
    videoRef.current.onloadedmetadata = () => {
      if (videoRef.current) {
        try {
          if (videoRef.current.currentTime === 0) {
            videoRef.current.currentTime = 0.001;
          }
        } catch (e) {}

        const videoEl = videoRef.current as any;
        const stream: MediaStream = videoEl.captureStream
          ? videoEl.captureStream()
          : videoEl.mozCaptureStream
          ? videoEl.mozCaptureStream()
          : null;

        if (stream) {
          console.log('Captured stream tracks:', stream.getTracks());
          updateLocalStream(stream);
          // If Guest is already connected, initiate WebRTC offer
          if (peerCount >= 2) {
            createOffer(stream);
          }
        }
      }
    };

    // Broadcast video selection state to Guest
    send('state', {
      video_name: file.name,
      has_video: true,
      current_time: 0,
      is_playing: false,
    });
  };

  // If host connects to room when guest is already present, initiate WebRTC offer
  React.useEffect(() => {
    if (role === 'host' && peerCount >= 2 && videoRef.current && videoRef.current.src) {
      const videoEl = videoRef.current as any;
      const stream: MediaStream = videoEl.captureStream ? videoEl.captureStream() : null;
      if (stream) {
        createOffer(stream);
      }
    }
  }, [role, peerCount, createOffer]);

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-gray-100">
      <Header
        roomId={roomId}
        wsStatus={wsStatus}
        webrtcStatus={webrtcStatus}
        peerCount={peerCount}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        <VideoPlayer
          role={role}
          videoRef={videoRef}
          remoteStream={remoteStream}
          videoName={videoName}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          isMuted={isMuted}
          onTogglePlay={togglePlay}
          onSeek={seekTo}
          onVolumeChange={changeVolume}
          onToggleMute={toggleMute}
        />

        <RoomControls
          role={role}
          peers={peers}
          videoName={videoName}
          onFileSelected={handleFileSelected}
        />
      </main>

      {formatError && (
        <FormatAlert
          message={formatError}
          onClose={() => setFormatError(null)}
        />
      )}
    </div>
  );
};
