import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Play, LogIn, ArrowRight } from 'lucide-react';
import { Header } from '../components/Header';

export const Home: React.FC = () => {
  const [joinCode, setJoinCode] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

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
    // Extract room ID if user pasted full URL (e.g. http://localhost:5173/room/ABC123)
    if (code.includes('/room/')) {
      code = code.split('/room/')[1];
    }
    code = code.toUpperCase();
    navigate(`/room/${code}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-gray-100">
      <Header wsStatus="disconnected" webrtcStatus="disconnected" peerCount={0} />

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto">
        <div className="glass-panel p-10 md:p-14 rounded-3xl border border-dark-600 shadow-2xl max-w-xl w-full space-y-8 animate-in fade-in zoom-in duration-300">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-brand-red to-brand-coral flex items-center justify-center glow-red shadow-xl">
              <Film className="w-10 h-10 text-white" />
            </div>

            <div>
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium mb-3">
                <span>✨ Creado por Federico · Pensado 100% para Cris ❤️</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                🍿 Watch Together
              </h2>
              <p className="text-base text-gray-400 mt-2">
                Mira películas y series juntos con sincronización P2P directa entre navegadores.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4 pt-2">
            <button
              onClick={handleCreateRoom}
              disabled={loading}
              className="w-full py-4 px-6 rounded-2xl bg-brand-red hover:bg-brand-coral text-white font-semibold text-lg flex items-center justify-center space-x-3 transition-all duration-200 glow-red shadow-lg disabled:opacity-50"
            >
              <Play className="w-6 h-6 fill-current" />
              <span>{loading ? 'Creando sala...' : 'Crear sala'}</span>
            </button>

            <button
              onClick={() => setShowJoinModal(true)}
              className="w-full py-4 px-6 rounded-2xl glass-button text-gray-200 hover:text-white font-semibold text-lg flex items-center justify-center space-x-3 transition-all duration-200"
            >
              <LogIn className="w-6 h-6" />
              <span>Unirse a sala</span>
            </button>
          </div>
        </div>

        {/* Join Room Modal */}
        {showJoinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="glass-panel max-w-md w-full p-8 rounded-3xl border border-dark-600 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200 text-left">
              <div>
                <h3 className="text-xl font-bold text-white">Unirse a una sala</h3>
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
