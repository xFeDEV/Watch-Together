import { useEffect, useRef, useState, useCallback } from 'react';
import type { RoomRole } from '../types/room';

interface UseSyncPlayerOptions {
  role: RoomRole;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  sendMediaControl: (type: 'play' | 'pause' | 'seek' | 'state', payload: any) => void;
}

export function useSyncPlayer({ role, videoRef, sendMediaControl }: UseSyncPlayerOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);

  const isRemoteActionRef = useRef(false);
  const lastEmittedTimeRef = useRef(0);

  // Sync state received from remote peer
  const handleRemoteAction = useCallback((type: string, payload: any) => {
    const video = videoRef.current;
    if (!video) return;

    isRemoteActionRef.current = true;

    if (type === 'play') {
      if (typeof payload.current_time === 'number') {
        const drift = Math.abs(video.currentTime - payload.current_time);
        if (drift > 0.5) {
          video.currentTime = payload.current_time;
        }
      }
      video.play().catch((e) => console.warn('Auto-play prevented:', e));
      setIsPlaying(true);
    } else if (type === 'pause') {
      if (typeof payload.current_time === 'number') {
        video.currentTime = payload.current_time;
      }
      video.pause();
      setIsPlaying(false);
    } else if (type === 'seek') {
      if (typeof payload.current_time === 'number') {
        video.currentTime = payload.current_time;
        setCurrentTime(payload.current_time);
      }
    } else if (type === 'state') {
      if (typeof payload.current_time === 'number') {
        const drift = Math.abs(video.currentTime - payload.current_time);
        if (drift > 0.5) {
          video.currentTime = payload.current_time;
        }
      }
      if (payload.is_playing && video.paused) {
        video.play().catch(() => {});
      } else if (!payload.is_playing && !video.paused) {
        video.pause();
      }
    }

    setTimeout(() => {
      isRemoteActionRef.current = false;
    }, 100);
  }, [videoRef]);

  // Host user actions
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(console.error);
      setIsPlaying(true);
      sendMediaControl('play', { current_time: video.currentTime });
    } else {
      video.pause();
      setIsPlaying(false);
      sendMediaControl('pause', { current_time: video.currentTime });
    }
  }, [videoRef, sendMediaControl]);

  const seekTo = useCallback((timeSeconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = timeSeconds;
    setCurrentTime(timeSeconds);
    sendMediaControl('seek', { current_time: timeSeconds });
  }, [videoRef, sendMediaControl]);

  const changeVolume = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, [videoRef]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.muted = false;
      setIsMuted(false);
      if (volume === 0) setVolume(1);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  }, [videoRef, isMuted, volume]);

  // Attach event listeners to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setIsPlaying(true);
      if (!isRemoteActionRef.current && role === 'host') {
        sendMediaControl('play', { current_time: video.currentTime });
      }
    };

    const onPause = () => {
      setIsPlaying(false);
      if (!isRemoteActionRef.current && role === 'host') {
        sendMediaControl('pause', { current_time: video.currentTime });
      }
    };

    const onSeeked = () => {
      setCurrentTime(video.currentTime);
      if (!isRemoteActionRef.current && role === 'host') {
        sendMediaControl('seek', { current_time: video.currentTime });
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // Periodically sync host time (every 3 seconds) to prevent drift
      if (role === 'host' && isPlaying && Math.abs(video.currentTime - lastEmittedTimeRef.current) > 3) {
        lastEmittedTimeRef.current = video.currentTime;
        sendMediaControl('state', {
          current_time: video.currentTime,
          is_playing: true,
        });
      }
    };

    const onLoadedMetadata = () => {
      setDuration(video.duration);
      setFormatError(null);
    };

    const onError = () => {
      console.error('Video element error:', video.error);
      const errCode = video.error ? video.error.code : 0;
      let errorMsg = 'Error al reproducir el archivo multimedia.';
      if (errCode === 3) {
        errorMsg = 'Error de decodificación de video. El formato o códec no es compatible con este navegador.';
      } else if (errCode === 4) {
        errorMsg = 'Formato no soportado por el navegador nativamente.';
      }
      setFormatError(errorMsg);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
    };
  }, [videoRef, role, isPlaying, sendMediaControl]);

  return {
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
  };
}
