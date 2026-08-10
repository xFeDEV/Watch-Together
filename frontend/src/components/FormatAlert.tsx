import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface FormatAlertProps {
  message: string;
  onClose: () => void;
}

export const FormatAlert: React.FC<FormatAlertProps> = ({ message, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-amber-500/30 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white">Formato Multimedia No Compatible</h3>
          <p className="text-sm text-gray-300 mt-2 leading-relaxed">{message}</p>
        </div>

        <div className="bg-dark-900/80 p-4 rounded-xl border border-gray-800 text-xs space-y-2">
          <p className="font-semibold text-gray-200">Formatos recomendados:</p>
          <ul className="list-disc list-inside text-gray-400 space-y-1">
            <li><strong className="text-gray-300">MP4</strong> / H.264 / AAC</li>
            <li><strong className="text-gray-300">WebM</strong> / VP8 / VP9 / AV1</li>
          </ul>
        </div>

        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-dark-900 font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/20"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
