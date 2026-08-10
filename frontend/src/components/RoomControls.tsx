import React, { useState } from 'react';
import { Upload, Copy, Check, User, Heart, Film } from 'lucide-react';
import type { RoomRole, PeerInfo } from '../types/room';

interface RoomControlsProps {
  role: RoomRole;
  peers: PeerInfo[];
  videoName: string;
  onFileSelected: (file: File) => void;
}

export const RoomControls: React.FC<RoomControlsProps> = ({
  role,
  peers,
  videoName,
  onFileSelected,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelected(e.target.files[0]);
    }
  };

  const hostPeer = peers.find((p) => p.role === 'host');
  const guestPeer = peers.find((p) => p.role === 'guest');

  return (
    <div className="w-full glass-panel p-6 rounded-2xl border border-dark-600 space-y-6">
      {/* Active Participants */}
      <div className="flex items-center justify-around py-4 bg-dark-900/60 rounded-xl border border-dark-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-brand-red/20 border border-brand-red/40 flex items-center justify-center">
            <User className="w-5 h-5 text-brand-coral" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Federico 👑</p>
            <p className="text-xs text-emerald-400 font-medium">
              {hostPeer ? '🟢 Conectado' : '🟡 Esperando...'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <Heart className="w-6 h-6 text-rose-500 fill-current animate-bounce" />
        </div>

        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
            <User className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Cris ❤️</p>
            <p className="text-xs text-emerald-400 font-medium">
              {guestPeer ? '🟢 Conectada' : '🟡 Esperando...'}
            </p>
          </div>
        </div>
      </div>

      {/* Video Name Badge if loaded */}
      {videoName && (
        <div className="flex items-center justify-between p-3.5 bg-dark-800/80 rounded-xl border border-dark-600 text-sm">
          <div className="flex items-center space-x-2 truncate">
            <Film className="w-5 h-5 text-brand-coral shrink-0" />
            <span className="text-gray-200 font-medium truncate">{videoName}</span>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
            Local P2P
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {role === 'host' ? (
          <label className="w-full sm:w-auto px-5 py-3 rounded-xl bg-brand-red hover:bg-brand-coral text-white font-medium flex items-center justify-center space-x-2 cursor-pointer transition-all duration-200 glow-red shadow-lg">
            <Upload className="w-5 h-5" />
            <span>Seleccionar video local</span>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        ) : (
          <div className="text-xs text-gray-400 italic text-center sm:text-left">
            Federico controla la selección del video local.
          </div>
        )}

        <button
          onClick={handleCopyLink}
          className="w-full sm:w-auto px-5 py-3 rounded-xl glass-button text-gray-200 hover:text-white font-medium flex items-center justify-center space-x-2 transition-all duration-200"
        >
          {copied ? (
            <>
              <Check className="w-5 h-5 text-emerald-400" />
              <span className="text-emerald-400">¡Enlace copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              <span>Copiar enlace de la sala</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
