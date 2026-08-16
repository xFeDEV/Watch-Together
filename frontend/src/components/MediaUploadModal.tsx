import React, { useState, useRef } from 'react';
import { Upload, X, AlertTriangle, Film } from 'lucide-react';

interface MediaUploadModalProps {
  onClose: () => void;
  onUploadCompleted: () => void;
}

export const MediaUploadModal: React.FC<MediaUploadModalProps> = ({
  onClose,
  onUploadCompleted,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [transferredBytes, setTransferredBytes] = useState(0);
  const [speedMBps, setSpeedMBps] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleStartUpload = () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);
    setProgressPercent(0);
    setTransferredBytes(0);

    const formData = new FormData();
    formData.append('file', selectedFile);

    const apiHost = window.location.port === '5173' ? 'http://localhost:8000' : '';
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    const startTime = Date.now();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setProgressPercent(percent);
        setTransferredBytes(e.loaded);

        const elapsedSec = max(0.1, (Date.now() - startTime) / 1000);
        const speed = (e.loaded / elapsedSec) / (1024 * 1024);
        setSpeedMBps(parseFloat(speed.toFixed(2)));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        setUploading(false);
        onUploadCompleted();
        onClose();
      } else {
        setUploading(false);
        try {
          const res = JSON.parse(xhr.responseText);
          const detailMsg = typeof res.detail === 'string'
            ? res.detail
            : Array.isArray(res.detail)
            ? res.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ')
            : JSON.stringify(res.detail);

          setError(detailMsg || `Error al subir la película (HTTP ${xhr.status})`);
        } catch {
          if (xhr.status === 413) {
            setError('El archivo es demasiado grande para la configuración del servidor.');
          } else if (xhr.status === 504 || xhr.status === 502) {
            setError('Tiempo de espera agotado al conectar con el servidor.');
          } else {
            setError(`Error al conectar con el servidor (HTTP ${xhr.status})`);
          }
        }
      }
    });

    xhr.addEventListener('error', () => {
      setUploading(false);
      setError('Error de red al subir el archivo');
    });

    xhr.open('POST', `${apiHost}/api/upload`);
    xhr.send(formData);
  };

  const cancelUpload = () => {
    if (xhrRef.current && uploading) {
      xhrRef.current.abort();
    }
    onClose();
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  function max(a: number, b: number): number {
    return a > b ? a : b;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-panel max-w-lg w-full p-8 rounded-3xl border border-dark-600 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-red/20 border border-brand-red/40 flex items-center justify-center glow-red">
              <Film className="w-5 h-5 text-brand-coral" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Subir película temporal</h3>
              <p className="text-xs text-gray-400">Se eliminará automáticamente a las 24 horas</p>
            </div>
          </div>

          <button
            onClick={cancelUpload}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!uploading ? (
          <div className="space-y-4">
            <label className="border-2 border-dashed border-dark-600 hover:border-brand-coral/50 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-dark-900/40">
              <Upload className="w-10 h-10 text-gray-400 mb-3" />
              <p className="text-sm font-semibold text-gray-200">
                {selectedFile ? selectedFile.name : 'Haz clic para seleccionar película'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {selectedFile ? `${formatSize(selectedFile.size)}` : 'MP4 (H.264), WebM, MKV'}
              </p>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl glass-button text-gray-300 font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedFile}
                onClick={handleStartUpload}
                className="flex-1 py-3 px-4 rounded-xl bg-brand-red hover:bg-brand-coral text-white font-semibold flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-50 glow-red"
              >
                <span>Subir película</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-white truncate max-w-xs">{selectedFile?.name}</span>
              <span className="text-brand-coral font-bold">{progressPercent}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-dark-900 rounded-full overflow-hidden border border-dark-700">
              <div
                className="h-full bg-gradient-to-r from-brand-red to-brand-coral transition-all duration-150 glow-red"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{formatSize(transferredBytes)} / {selectedFile ? formatSize(selectedFile.size) : '0 MB'}</span>
              <span>{speedMBps} MB/s</span>
            </div>

            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={cancelUpload}
                className="px-4 py-2 rounded-xl bg-dark-800 text-rose-400 text-xs font-medium border border-dark-600 hover:bg-dark-700"
              >
                Cancelar subida
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
