import React, { useState } from 'react';
import { Film, ExternalLink, Copy, Check, Trash2, Clock, Eye } from 'lucide-react';

export interface TemporaryMediaItem {
  id: string;
  filename: string;
  original_name: string;
  size_bytes: number;
  uploaded_at: string;
  expires_at: string;
  status: 'AVAILABLE' | 'EXPIRING_SOON' | 'EXPIRING_WATCHING' | 'EXPIRED';
  remaining_seconds: number;
}

interface TemporaryMediaListProps {
  media: TemporaryMediaItem[];
  onDeleteMedia: (id: string) => void;
}

function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return 'Expirado';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const TemporaryMediaList: React.FC<TemporaryMediaListProps> = ({
  media,
  onDeleteMedia,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getJellyfinUrl = () => {
    if (window.location.hostname.includes('feexel.tech')) {
      return 'https://jellyfin.feexel.tech';
    }
    return `http://${window.location.hostname}:8096`;
  };

  const handleCopyLink = (id: string) => {
    const link = `${getJellyfinUrl()}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getStatusBadge = (item: TemporaryMediaItem) => {
    switch (item.status) {
      case 'EXPIRING_WATCHING':
        return (
          <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Eye className="w-3.5 h-3.5 mr-1" /> Viendo en SyncPlay
          </span>
        );
      case 'EXPIRING_SOON':
        return (
          <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <Clock className="w-3.5 h-3.5 mr-1" /> Expira pronto
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Clock className="w-3.5 h-3.5 mr-1" /> Expirado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            🟢 Disponible
          </span>
        );
    }
  };

  if (media.length === 0) {
    return (
      <div className="w-full glass-panel p-8 rounded-3xl border border-dark-600 text-center space-y-3">
        <Film className="w-10 h-10 text-gray-500 mx-auto" />
        <h4 className="text-lg font-semibold text-white">No hay películas temporales</h4>
        <p className="text-xs text-gray-400 max-w-sm mx-auto">
          Sube una película o video para transmitirlo en sincronía con Jellyfin. Se conservará durante 24 horas.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-lg font-bold text-white flex items-center space-x-2">
          <span>🎬 Películas temporales</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-dark-700 text-gray-300">
            {media.length}
          </span>
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {media.map((item) => (
          <div
            key={item.id}
            className="glass-panel p-5 rounded-2xl border border-dark-600 hover:border-dark-500 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-start space-x-3 truncate">
              <div className="w-10 h-10 rounded-xl bg-brand-red/20 border border-brand-red/40 flex items-center justify-center shrink-0">
                <Film className="w-5 h-5 text-brand-coral" />
              </div>
              <div className="truncate">
                <h4 className="text-base font-semibold text-white truncate">{item.original_name}</h4>
                <div className="flex items-center space-x-3 text-xs text-gray-400 mt-1">
                  <span>{formatSize(item.size_bytes)}</span>
                  <span>•</span>
                  <span>Expira en: <strong className="text-gray-200">{formatRemainingTime(item.remaining_seconds)}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
              {getStatusBadge(item)}

              <div className="flex items-center space-x-2">
                <a
                  href={getJellyfinUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-brand-red hover:bg-brand-coral text-white text-xs font-semibold flex items-center space-x-1.5 transition-all glow-red"
                >
                  <span>Ver en Jellyfin</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  onClick={() => handleCopyLink(item.id)}
                  className="p-2 rounded-xl glass-button text-gray-300 hover:text-white transition-colors"
                  title="Copiar enlace"
                >
                  {copiedId === item.id ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>

                <button
                  onClick={() => onDeleteMedia(item.id)}
                  className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 transition-colors"
                  title="Eliminar película"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
