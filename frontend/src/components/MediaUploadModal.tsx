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

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleStartUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);
    setProgressPercent(0);
    setTransferredBytes(0);

    const apiHost = window.location.port === '5173' ? 'http://localhost:8000' : '';
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks to avoid proxy timeouts
    const totalSize = selectedFile.size;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

    const startTime = Date.now();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // 1. Initialize Chunked Upload Session
      const initRes = await fetch(`${apiHost}/api/upload/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: selectedFile.name,
          total_size: totalSize,
          chunk_size: CHUNK_SIZE,
        }),
        signal: abortController.signal,
      });

      if (!initRes.ok) {
        const errorData = await initRes.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error al iniciar la sesión de subida');
      }

      const { upload_id } = await initRes.json();
      let bytesUploaded = 0;

      // 2. Upload chunks sequentially
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (abortController.signal.aborted) return;

        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(totalSize, start + CHUNK_SIZE);
        const chunkBlob = selectedFile.slice(start, end);

        let attempts = 0;
        let success = false;

        while (attempts < 3 && !success && !abortController.signal.aborted) {
          try {
            attempts++;
            const chunkRes = await fetch(`${apiHost}/api/upload/chunk`, {
              method: 'POST',
              headers: {
                'X-Upload-Id': upload_id,
                'X-Chunk-Index': chunkIndex.toString(),
                'Content-Type': 'application/octet-stream',
              },
              body: chunkBlob,
              signal: abortController.signal,
            });

            if (chunkRes.ok) {
              success = true;
              bytesUploaded += chunkBlob.size;
              setTransferredBytes(bytesUploaded);

              const percent = Math.round((bytesUploaded / totalSize) * 100);
              setProgressPercent(percent);

              const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
              const speed = (bytesUploaded / elapsedSec) / (1024 * 1024);
              setSpeedMBps(parseFloat(speed.toFixed(2)));
            } else {
              if (attempts >= 3) {
                const errDetail = await chunkRes.json().catch(() => ({}));
                throw new Error(errDetail.detail || `Error al subir bloque ${chunkIndex + 1}`);
              }
              await new Promise((r) => setTimeout(r, 1000));
            }
          } catch (err: any) {
            if (abortController.signal.aborted) return;
            if (attempts >= 3) throw err;
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }

      setUploading(false);
      onUploadCompleted();
      onClose();
    } catch (err: any) {
      if (abortController.signal.aborted) return;
      setUploading(false);
      setError(err.message || 'Error de conexión al subir la película');
    }
  };

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setUploading(false);
    onClose();
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

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
              <p className="text-xs text-gray-400">Subida por bloques resiliente · Expira a las 24h</p>
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
