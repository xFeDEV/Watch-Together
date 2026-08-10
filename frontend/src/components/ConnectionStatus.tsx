import React from 'react';
import type { WSConnectionStatus, WebRTCConnectionStatus } from '../types/room';

interface ConnectionStatusProps {
  wsStatus: WSConnectionStatus;
  webrtcStatus: WebRTCConnectionStatus;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ wsStatus, webrtcStatus }) => {
  const getWSBadge = () => {
    switch (wsStatus) {
      case 'connected':
        return <span className="inline-flex items-center text-xs font-medium text-emerald-400"><span className="w-2 h-2 mr-1.5 rounded-full bg-emerald-500 animate-pulse"></span>WS OK</span>;
      case 'connecting':
        return <span className="inline-flex items-center text-xs font-medium text-amber-400"><span className="w-2 h-2 mr-1.5 rounded-full bg-amber-500 animate-ping"></span>WS Conectando...</span>;
      default:
        return <span className="inline-flex items-center text-xs font-medium text-rose-400"><span className="w-2 h-2 mr-1.5 rounded-full bg-rose-500"></span>WS Desconectado</span>;
    }
  };

  const getRTCBadge = () => {
    switch (webrtcStatus) {
      case 'connected':
        return <span className="inline-flex items-center text-xs font-medium text-emerald-400"><span className="w-2 h-2 mr-1.5 rounded-full bg-emerald-500 glow-green"></span>P2P Conectado</span>;
      case 'connecting':
        return <span className="inline-flex items-center text-xs font-medium text-amber-400"><span className="w-2 h-2 mr-1.5 rounded-full bg-amber-500 animate-ping"></span>P2P Conectando...</span>;
      default:
        return <span className="inline-flex items-center text-xs font-medium text-rose-400"><span className="w-2 h-2 mr-1.5 rounded-full bg-rose-500"></span>P2P Desconectado</span>;
    }
  };

  return (
    <div className="flex items-center space-x-3 bg-dark-800/80 px-3 py-1.5 rounded-lg border border-dark-600">
      <div className="flex items-center border-r border-dark-600 pr-3">
        {getWSBadge()}
      </div>
      <div className="flex items-center">
        {getRTCBadge()}
      </div>
    </div>
  );
};
