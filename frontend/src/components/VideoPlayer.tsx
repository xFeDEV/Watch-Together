import React, { useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Film } from 'lucide-react';
import type { RoomRole } from '../types/room';

interface VideoPlayerProps {
  role: RoomRole;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  remoteStream: MediaStream | null;
  videoName: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  onTogglePlay: () => void;
  onSeek: (timeSeconds: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  role,
  videoRef,
  remoteStream,
  videoName,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleMute,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Set guest remote stream srcObject
  useEffect(() => {
    if (role === 'guest' && videoRef.current && remoteStream) {
      console.log('Binding remote stream to guest video element');
      videoRef.current.srcObject = remoteStream;
    }
  }, [role, remoteStream, videoRef]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    onSeek(newTime);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden glass-panel border border-dark-600 shadow-2xl group flex items-center justify-center"
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        playsInline
        className="w-full h-full object-contain"
        onClick={onTogglePlay}
      />

      {/* Overlay when no video is loaded */}
      {role === 'host' && !videoName && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-dark-900/90 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-brand-red/10 border border-brand-red/30 flex items-center justify-center glow-red animate-pulse">
            <Film className="w-8 h-8 text-brand-coral" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Selecciona un archivo multimedia</h3>
            <p className="text-sm text-gray-400 max-w-sm mt-1">
              Selecciona un video local en tu PC para comenzar a reproducirlo y transmitirlo P2P al invitado.
            </p>
          </div>
        </div>
      )}

      {role === 'guest' && !remoteStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-dark-900/90 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center animate-pulse">
            <Film className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Esperando transmisión del Host...</h3>
            <p className="text-sm text-gray-400 max-w-sm mt-1">
              El anfitrión aún no ha seleccionado o transmitido un video por WebRTC.
            </p>
          </div>
        </div>
      )}

      {/* Top Overlay: Video Title */}
      {videoName && (
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none flex items-center justify-between">
          <div className="flex items-center space-x-2 text-white font-medium text-sm truncate max-w-md">
            <span>🎬</span>
            <span className="truncate">{videoName}</span>
          </div>
        </div>
      )}

      {/* Bottom Controls Bar */}
      {videoName && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col space-y-3">
          {/* Progress Slider */}
          <div className="w-full flex items-center space-x-3 text-xs text-gray-300">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleProgressChange}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-coral hover:h-2 transition-all"
            />
            <span>{formatTime(duration)}</span>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onTogglePlay}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                title={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>

              {/* Volume */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={onToggleMute}
                  className="text-gray-300 hover:text-white p-1 transition-colors"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gray-200"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={toggleFullscreen}
                className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                title="Pantalla completa"
              >
                <Maximize className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
