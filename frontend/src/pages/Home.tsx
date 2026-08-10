import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Play, LogIn, ArrowRight, Upload, ExternalLink } from 'lucide-react';
import { Header } from '../components/Header';
import { MediaUploadModal } from '../components/MediaUploadModal';
import { TemporaryMediaList } from '../components/TemporaryMediaList';
import type { TemporaryMediaItem } from '../components/TemporaryMediaList';

export const Home: React.FC = () => {
  const [joinCode, setJoinCode] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [mediaList, setMediaList] = useState<TemporaryMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const fetchTemporaryMedia = useCallback(async () => {
    try {
      const apiHost = window.location.port === '5173' ? 'http://localhost:8000' : '';
      const response = await fetch(`${apiHost}/api/media`);
      if (response.ok) {
        const data = await response.json();
        setMediaList(data.media || []);
      }
    } catch (err) {
      console.error('Failed to fetch temporary media:', err);
    }
  }, []);

  useEffect(() => {
    fetchTemporaryMedia();
    const interval = setInterval(fetchTemporaryMedia, 10000);
    return () => clearInterval(interval);
  }, [fetchTemporaryMedia]);

  const handleDeleteMedia = async (id: string) => {
    try {
      const apiHost = window.location.port === '5173' ? 'http://localhost:8000' : '';
      const response = await fetch(`${apiHost}/api/media/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchTemporaryMedia();
      }
    } catch (err) {
      console.error('Failed to delete media:', err);
    }
  };

  const handleCreateRoom = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiHost = window.location.port === '5173' ? 'http://localhost:8000' : '';
      const response = await fetch(`${apiHost}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('No se pudo crear la sala');
      }

      const data = await response.json();
      navigate(`/room/${data.room_id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    let code = joinCode.trim();
    if (code.includes('/room/')) {
      code = code.split('/room/')[1];
    }
    code = code.toUpperCase();
    navigate(`/room/${code}`);
  };

  const getJellyfinUrl = () => {
    if (window.location.hostname.includes('feexel.tech')) {
      return 'https://jellyfin.feexel.tech';
    }
    return `http://${window.location.hostname}:8096`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-gray-100">
      <Header wsStatus="disconnected" webrtcStatus="disconnected" peerCount={0} />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-8">
        {/* Main Hero Banner */}
        <div className="glass-panel p-8 md:p-12 rounded-3xl border border-dark-600 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in duration-300">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-red to-brand-coral flex items-center justify-center glow-red shadow-xl">
              <Film className="w-8 h-8 text-white" />
            </div>

            <div>
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium mb-3">
                <span>✨ Creado por Federico · Pensado 100% para Cris ❤️</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                🍿 Watch Together
              </h2>
              <p className="text-sm md:text-base text-gray-400 mt-2 max-w-xl mx-auto">
                Sube películas temporales para ver en sincronía con Jellyfin + SyncPlay, o reproduce videos en directo P2P.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
              {error}
            </div>
          )}

          {/* Action Buttons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 max-w-3xl mx-auto">
            <button
              onClick={() => setShowUploadModal(true)}
              className="py-3.5 px-4 rounded-xl bg-brand-red hover:bg-brand-coral text-white font-semibold text-sm flex items-center justify-center space-x-2 transition-all duration-200 glow-red shadow-lg"
            >
              <Upload className="w-4 h-4" />
              <span>Subir película</span>
            </button>

            <a
              href={getJellyfinUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3.5 px-4 rounded-xl bg-dark-700 hover:bg-dark-600 text-gray-100 font-semibold text-sm flex items-center justify-center space-x-2 transition-all border border-dark-500"
            >
              <ExternalLink className="w-4 h-4 text-brand-coral" />
              <span>Abrir Jellyfin</span>
            </a>

            <button
              onClick={handleCreateRoom}
              disabled={loading}
              className="py-3.5 px-4 rounded-xl glass-button text-gray-200 hover:text-white font-semibold text-sm flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{loading ? 'Creando...' : 'Sala P2P'}</span>
            </button>

            <button
              onClick={() => setShowJoinModal(true)}
              className="py-3.5 px-4 rounded-xl glass-button text-gray-200 hover:text-white font-semibold text-sm flex items-center justify-center space-x-2 transition-all duration-200"
            >
              <LogIn className="w-4 h-4" />
              <span>Unirse a sala</span>
            </button>
          </div>
        </div>

        {/* Temporary Media List */}
        <TemporaryMediaList media={mediaList} onDeleteMedia={handleDeleteMedia} />

        {/* Upload Modal */}
        {showUploadModal && (
          <MediaUploadModal
            onClose={() => setShowUploadModal(false)}
            onUploadCompleted={fetchTemporaryMedia}
          />
        )}

        {/* Join Room Modal */}
        {showJoinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="glass-panel max-w-md w-full p-8 rounded-3xl border border-dark-600 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200 text-left">
              <div>
                <h3 className="text-xl font-bold text-white">Unirse a una sala P2P</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Introduce el código de sala (ej. ABC123) o pega el enlace completo.
                </p>
              </div>

              <form onSubmit={handleJoinRoom} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="Código o URL de la sala"
                    className="w-full px-4 py-3.5 rounded-xl bg-dark-900 border border-dark-600 text-white placeholder-gray-500 focus:outline-none focus:border-brand-coral transition-colors uppercase tracking-wider"
                    autoFocus
                  />
                </div>

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowJoinModal(false)}
                    className="flex-1 py-3 px-4 rounded-xl glass-button text-gray-300 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!joinCode.trim()}
                    className="flex-1 py-3 px-4 rounded-xl bg-brand-red hover:bg-brand-coral text-white font-semibold flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-50"
                  >
                    <span>Entrar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
