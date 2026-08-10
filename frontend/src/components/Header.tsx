import React from 'react';
import { Film, Users } from 'lucide-react';
import { ConnectionStatus } from './ConnectionStatus';
import type { WSConnectionStatus, WebRTCConnectionStatus } from '../types/room';

interface HeaderProps {
  roomId?: string;
  wsStatus: WSConnectionStatus;
  webrtcStatus: WebRTCConnectionStatus;
  peerCount: number;
}

export const Header: React.FC<HeaderProps> = ({ roomId, wsStatus, webrtcStatus, peerCount }) => {
  return (
    <header className="w-full glass-panel sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-lg">
      <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.location.href = '/'}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-red to-brand-coral flex items-center justify-center glow-red">
          <Film className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
            <span>Watch Together</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-red/20 text-brand-coral font-medium border border-brand-red/30">
              P2P
            </span>
          </h1>
          <p className="text-xs text-gray-400">Sin servidor multimedia · Transmisión directa</p>
        </div>
      </div>

      {roomId && (
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-dark-700/60 border border-gray-800">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-200">{peerCount} / 2 conectados</span>
          </div>

          <ConnectionStatus wsStatus={wsStatus} webrtcStatus={webrtcStatus} />
        </div>
      )}
    </header>
  );
};
