import { useEffect, useRef, useState, useCallback } from 'react';
import type { WebRTCConnectionStatus } from '../types/room';

interface UseWebRTCOptions {
  role: 'host' | 'guest';
  sendSignaling: (type: string, payload: any) => void;
  onRemoteStreamAvailable?: (stream: MediaStream) => void;
}

export function useWebRTC({ role, sendSignaling, onRemoteStreamAvailable }: UseWebRTCOptions) {
  const [webrtcStatus, setWebrtcStatus] = useState<WebRTCConnectionStatus>('disconnected');
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);

  // Build ICE servers array (STUN/TURN fallback)
  const getIceServers = useCallback((): RTCConfiguration => {
    const stunServer = import.meta.env.VITE_STUN_SERVER || 'stun:stun.l.google.com:19302';
    const turnServer = import.meta.env.VITE_TURN_SERVER;
    const turnUsername = import.meta.env.VITE_TURN_USERNAME;
    const turnPassword = import.meta.env.VITE_TURN_PASSWORD;

    const iceServers: RTCIceServer[] = [
      { urls: stunServer }
    ];

    if (turnServer) {
      const turnConfig: RTCIceServer = { urls: turnServer };
      if (turnUsername) turnConfig.username = turnUsername;
      if (turnPassword) turnConfig.credential = turnPassword;
      iceServers.push(turnConfig);
    }

    return { iceServers };
  }, []);

  const createPeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const config = getIceServers();
    const pc = new RTCPeerConnection(config);
    pcRef.current = pc;
    setWebrtcStatus('connecting');

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignaling('ice-candidate', event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('WebRTC state change:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setWebrtcStatus('connected');
      } else if (pc.connectionState === 'connecting') {
        setWebrtcStatus('connecting');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setWebrtcStatus('disconnected');
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (event.streams && event.streams[0] && onRemoteStreamAvailable) {
        onRemoteStreamAvailable(event.streams[0]);
      }
    };

    return pc;
  }, [getIceServers, sendSignaling, onRemoteStreamAvailable]);

  // Host starts the P2P connection by sending an Offer
  const createOffer = useCallback(async (localStream?: MediaStream) => {
    const pc = createPeerConnection();

    if (localStream) {
      localStreamRef.current = localStream;
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignaling('offer', offer);
    } catch (err) {
      console.error('Error creating WebRTC offer:', err);
      setWebrtcStatus('failed');
    }
  }, [createPeerConnection, sendSignaling]);

  // Guest receives Offer and sends Answer
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    const pc = createPeerConnection();

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Process queued ICE candidates
      while (iceCandidatesQueueRef.current.length > 0) {
        const candidate = iceCandidatesQueueRef.current.shift();
        if (candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignaling('answer', answer);
    } catch (err) {
      console.error('Error handling offer:', err);
      setWebrtcStatus('failed');
    }
  }, [createPeerConnection, sendSignaling]);

  // Host receives Answer from Guest
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    if (!pcRef.current) return;
    try {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));

      // Process queued ICE candidates
      while (iceCandidatesQueueRef.current.length > 0) {
        const candidate = iceCandidatesQueueRef.current.shift();
        if (candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  }, []);

  // Handle ICE Candidate
  const handleIceCandidate = useCallback(async (candidateInit: RTCIceCandidateInit) => {
    if (pcRef.current && pcRef.current.remoteDescription) {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidateInit));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    } else {
      iceCandidatesQueueRef.current.push(candidateInit);
    }
  }, []);

  // Update tracks if Host changes local file
  const updateLocalStream = useCallback((stream: MediaStream) => {
    if (!pcRef.current) return;
    localStreamRef.current = stream;

    const senders = pcRef.current.getSenders();
    senders.forEach((sender) => {
      pcRef.current?.removeTrack(sender);
    });

    stream.getTracks().forEach((track) => {
      pcRef.current?.addTrack(track, stream);
    });

    // Re-negotiate if already connected
    if (role === 'host' && pcRef.current.connectionState === 'connected') {
      createOffer(stream);
    }
  }, [role, createOffer]);

  useEffect(() => {
    return () => {
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, []);

  return {
    webrtcStatus,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    updateLocalStream,
  };
}
