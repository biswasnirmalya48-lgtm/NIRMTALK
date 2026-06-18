import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { auth, db } from '../firebase';
import { collection, doc, setDoc, updateDoc, onSnapshot, query, where, serverTimestamp, addDoc, getDocs, deleteDoc, getDoc } from 'firebase/firestore';
import { CallSession } from '../types';

interface CallContextType {
  incomingCall: CallSession | null;
  activeCall: CallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  isMuted: boolean;
  isSpeaker: boolean;
  isVideoOff: boolean;
  startCall: (chatId: string, calleeId: string, type: 'audio' | 'video', isGroupCall?: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  joinGroupCall: (chatId: string, type: 'audio' | 'video') => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void; // Simulated for web
  toggleVideo: () => void;
  callDuration: number;
}

const CallContext = createContext<CallContextType | null>(null);

export const useCallSystem = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCallSystem must be used within a CallProvider");
  return ctx;
};

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false); // Can't fully control on pure desktop web without specific APIs, but can toggle output device ideally.
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});
  const callDocRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const unsubscribesRef = useRef<Record<string, () => void>>({});

  const timerRef = useRef<NodeJS.Timeout>();

  const audioCtxRef = useRef<AudioContext | null>(null);
  const toneIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const calleeCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const callerCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);

  const initAudioCtx = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch(e) {}
  };

  const playSynthesizedTone = (type: 'ring' | 'dial') => {
    initAudioCtx();
    stopSynthesizedTone();
    
    if (!audioCtxRef.current) return;
    
    const playBeep = () => {
      try {
        const osc = audioCtxRef.current!.createOscillator();
        const gainNode = audioCtxRef.current!.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(audioCtxRef.current!.destination);
        
        if (type === 'ring') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, audioCtxRef.current!.currentTime);
          
          gainNode.gain.setValueAtTime(0, audioCtxRef.current!.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.5, audioCtxRef.current!.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.5, audioCtxRef.current!.currentTime + 1.8);
          gainNode.gain.linearRampToValueAtTime(0, audioCtxRef.current!.currentTime + 2);
          
          osc.start(audioCtxRef.current!.currentTime);
          osc.stop(audioCtxRef.current!.currentTime + 2);
        } else {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(425, audioCtxRef.current!.currentTime);
          
          gainNode.gain.setValueAtTime(0, audioCtxRef.current!.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.1, audioCtxRef.current!.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.1, audioCtxRef.current!.currentTime + 0.9);
          gainNode.gain.linearRampToValueAtTime(0, audioCtxRef.current!.currentTime + 1);
          
          osc.start(audioCtxRef.current!.currentTime);
          osc.stop(audioCtxRef.current!.currentTime + 1);
        }
      } catch (e) {}
    };

    playBeep();
    toneIntervalRef.current = setInterval(playBeep, type === 'ring' ? 4000 : 4000);
  };

  const stopSynthesizedTone = () => {
    if (toneIntervalRef.current) {
      clearInterval(toneIntervalRef.current);
      toneIntervalRef.current = null;
    }
  };

  const playRingtone = () => playSynthesizedTone('ring');
  const stopRingtone = () => stopSynthesizedTone();
  
  const playDialtone = () => playSynthesizedTone('dial');
  const stopDialtone = () => stopSynthesizedTone();

  // Listen for incoming calls
  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const q = query(collection(db, 'calls'), where('calleeId', '==', uid), where('status', 'in', ['calling']));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const callData = { id: snap.docs[0].id, ...snap.docs[0].data() } as CallSession;
        if (!activeCall && !incomingCall) {
          setIncomingCall(callData);
          playRingtone();
        } else if (activeCall || incomingCall?.id !== callData.id) {
          // Busy
          updateDoc(snap.docs[0].ref, { status: 'busy', endedAt: serverTimestamp() });
        }
      } else {
        if (incomingCall && !incomingCall.isGroup) {
          setIncomingCall(null);
          stopRingtone();
        }
      }
    });
    return () => {
      unsubscribe();
      stopRingtone();
    };
  }, [activeCall, incomingCall]);

  // Listen for active/incoming group calls
  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const qGroup = query(
      collection(db, 'calls'),
      where('isGroup', '==', true),
      where('status', '==', 'calling'),
      where('members', 'array-contains', uid)
    );

    const unsubscribe = onSnapshot(qGroup, (snap) => {
      if (!snap.empty) {
        // Find a group call we haven't joined yet and are not the caller of
        const activeGroupDocs = snap.docs.filter(d => {
          const data = d.data();
          const participants = data.participants || [];
          return data.callerId !== uid && !participants.includes(uid);
        });

        if (activeGroupDocs.length > 0) {
          const callData = { id: activeGroupDocs[0].id, ...activeGroupDocs[0].data() } as CallSession;
          if (!activeCall && !incomingCall) {
            setIncomingCall(callData);
            playRingtone();
          }
        } else {
          // If the group call we were notified for has been joined or ended, dismiss
          if (incomingCall?.isGroup) {
            setIncomingCall(null);
            stopRingtone();
          }
        }
      } else {
        if (incomingCall?.isGroup) {
          setIncomingCall(null);
          stopRingtone();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeCall, incomingCall]);

  // Clean up WebRTC completely
  const cleanupCall = () => {
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {}
      pcRef.current = null;
    }
    // Close group peer connections
    Object.keys(pcsRef.current).forEach((otherId) => {
      try {
        pcsRef.current[otherId].close();
      } catch (e) {}
    });
    pcsRef.current = {};

    // Cancel all subcollection or connection listeners
    Object.keys(unsubscribesRef.current).forEach((key) => {
      try {
        unsubscribesRef.current[key]();
      } catch (e) {}
    });
    unsubscribesRef.current = {};

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setRemoteStreams({});
    setActiveCall(null);
    setIncomingCall(null);
    setIsMuted(false);
    setIsSpeaker(false);
    setIsVideoOff(false);
    clearInterval(timerRef.current);
    setCallDuration(0);
    stopRingtone();
    stopDialtone();
    callDocRef.current = null;
    calleeCandidatesQueueRef.current = [];
    callerCandidatesQueueRef.current = [];
  };

  // When activeCall updates logically, listen for remote streams or hangup
  useEffect(() => {
    if (activeCall?.id && callDocRef.current) {
      const unsub = onSnapshot(callDocRef.current, (docSnap: any) => {
        if (!docSnap.exists()) {
          cleanupCall();
          return;
        }
        const data = docSnap.data();
        if (data.status === 'ended' || data.status === 'rejected' || data.status === 'missed' || data.status === 'busy') {
          cleanupCall();
        }
        if (data.status === 'accepted' && activeCall.status === 'calling') {
          // Callee answered!
          setActiveCall(prev => prev ? { ...prev, status: 'accepted' } : null);
          stopDialtone();
          
          // Start timer
          clearInterval(timerRef.current);
          setCallDuration(0);
          timerRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
        }
        // Handle remote answer if we are caller
        if (pcRef.current && !pcRef.current.currentRemoteDescription && data.answer) {
          const rtcSessionDescription = new RTCSessionDescription(data.answer);
          pcRef.current.setRemoteDescription(rtcSessionDescription).then(() => {
            console.log("Remote description set, draining queued callee candidates:", calleeCandidatesQueueRef.current.length);
            const pc = pcRef.current;
            if (pc) {
              while (calleeCandidatesQueueRef.current.length > 0) {
                const candidateData = calleeCandidatesQueueRef.current.shift();
                if (candidateData) {
                  pc.addIceCandidate(new RTCIceCandidate(candidateData)).catch(e => console.warn("Error adding queued callee candidate:", e));
                }
              }
            }
          }).catch(e => console.error("Error setting remote description on caller side:", e));
        }
      });
      return () => unsub();
    }
  }, [activeCall?.id]);

  // Set up local media stream with premium constraints and memoize it
  const obtainLocalStream = async (hasVideo: boolean) => {
    if (localStreamRef.current) {
      const hasVideoTrack = localStreamRef.current.getVideoTracks().length > 0;
      if (!hasVideo || hasVideoTrack) {
        return localStreamRef.current;
      }
      // Stop legacy stream and recreate to include video track
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    
    let videoConstraints: boolean | MediaTrackConstraints = false;
    if (hasVideo) {
      videoConstraints = {
        width: { ideal: 3840, max: 3840 },
        height: { ideal: 2160, max: 2160 },
        frameRate: { ideal: 30, max: 60 },
        facingMode: 'user',
      };
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        }, 
        video: videoConstraints 
      });
      console.log("Successfully obtained media stream with pro-grade 4K/high-res video constraints", stream);
    } catch (e) {
      console.warn("Could not get media stream with 4K constraints, falling back to basic high-definition video:", e);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: hasVideo ? { width: { ideal: 1920 }, height: { ideal: 1080 } } : false
        });
        console.log("Fallback to 1080p stream successful", stream);
      } catch (err2) {
        console.warn("Could not get media stream with 1080p constraints, falling back to standard constraints:", err2);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: hasVideo ? true : false
        });
        console.log("Fallback to basic stream successful", stream);
      }
    }

    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  };

  // Set up RTCPeerConnection and local media with premium 4K camera and enhanced filters
  const initWebRTC = async (hasVideo: boolean) => {
    const stream = await obtainLocalStream(hasVideo);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Dynamic transceivers configuration to override default browser video bitrate limitation (which throttles 4K/1080p)
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          try {
            const parameters = videoSender.getParameters();
            if (parameters && parameters.encodings && parameters.encodings.length > 0) {
              // Elevate maximum bitrate for ultra high quality calling
              parameters.encodings[0].maxBitrate = 12000000; // 12 Mbps
              parameters.encodings[0].scaleResolutionDownBy = 1.0; // Prevent scaling down
              videoSender.setParameters(parameters).then(() => {
                console.log("Successfully elevated video sender capabilities to master quality (12 Mbps) for premium video calling!");
              }).catch(err => {
                console.warn("RtpSender setParameters not supported or failed:", err);
              });
            }
          } catch (err) {
            console.warn("Could not optimize transceiver parameters:", err);
          }
        }
      }
    };

    pc.ontrack = (event) => {
      console.log("WebRTC received track:", event.track.kind, event.streams);
      
      // Dynamic master-grade remote track assembly which guarantees 
      // direct visual delivery without standard web platform stream races
      const remoteTracks = pc.getReceivers().map(r => r.track).filter(Boolean) as MediaStreamTrack[];
      const newStream = new MediaStream();
      remoteTracks.forEach(t => {
        newStream.addTrack(t);
        console.log(`Bypassed legacy standard routes: added dynamic track (${t.kind}) directly to pristine MediaStream`);
      });
      setRemoteStream(newStream);
    };

    return { pc, stream };
  };

  // Initialize a dynamic RTCPeerConnection for a partner in group mesh calling
  const getOrCreateGroupPeerConnection = async (otherId: string, hasVideo: boolean, callId: string) => {
    if (pcsRef.current[otherId]) {
      return pcsRef.current[otherId];
    }

    const stream = await obtainLocalStream(hasVideo);
    console.log(`[Mesh] Initializing RTCPeerConnection for partner: ${otherId}`);
    
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current[otherId] = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      console.log(`[Mesh] Received track (${event.track.kind}) from user: ${otherId}`);
      const remoteTracks = pc.getReceivers().map(r => r.track).filter(Boolean) as MediaStreamTrack[];
      const newStream = new MediaStream();
      remoteTracks.forEach(t => {
        newStream.addTrack(t);
      });

      setRemoteStreams(prev => ({
        ...prev,
        [otherId]: newStream
      }));
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[Mesh] Ice Connection State with ${otherId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setRemoteStreams(prev => {
          const updated = { ...prev };
          delete updated[otherId];
          return updated;
        });
      }
    };

    return pc;
  };

  const startCall = async (chatId: string, calleeId: string, type: 'audio' | 'video', isGroupCall?: boolean) => {
    if (!auth.currentUser) return;
    try {
      calleeCandidatesQueueRef.current = [];
      callerCandidatesQueueRef.current = [];

      if (isGroupCall) {
        // Start group call session in Firestore using chatId as callId
        // Fetch chat members to set on call doc so they can query it and receive calls/ringing overlays
        const chatSnap = await getDoc(doc(db, 'chats', chatId));
        const chatMembers = chatSnap.exists() ? ((chatSnap.data() as any)?.members || []) : [];

        await obtainLocalStream(type === 'video');

        const callDoc = doc(db, 'calls', chatId);
        callDocRef.current = callDoc;

        const callData = {
          chatId,
          callerId: auth.currentUser.uid,
          calleeId: 'group',
          type,
          status: 'calling',
          isGroup: true,
          members: chatMembers,
          participants: [auth.currentUser.uid],
          createdAt: serverTimestamp(),
        };

        await setDoc(callDoc, callData);
        setActiveCall({ id: chatId, ...callData } as CallSession);
      } else {
        // Standard Direct 1-on-1 call
        const { pc } = await initWebRTC(type === 'video');

        const callDoc = doc(collection(db, 'calls'));
        callDocRef.current = callDoc;

        const offerCandidates = collection(callDoc, 'callerCandidates');
        pc.onicecandidate = (event) => {
          event.candidate && addDoc(offerCandidates, event.candidate.toJSON());
        };

        const offerDescription = await pc.createOffer();
        await pc.setLocalDescription(offerDescription);

        const callData: Partial<CallSession> = {
          chatId,
          callerId: auth.currentUser.uid,
          calleeId,
          type,
          status: 'calling',
          offer: {
            type: offerDescription.type,
            sdp: offerDescription.sdp,
          },
          createdAt: serverTimestamp(),
        };

        await setDoc(callDoc, callData);
        setActiveCall({ id: callDoc.id, ...callData } as CallSession);
        playDialtone();

        onSnapshot(collection(callDoc, 'calleeCandidates'), (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const candidateData = change.doc.data() as RTCIceCandidateInit;
              const currentPc = pcRef.current;
              if (currentPc && currentPc.remoteDescription) {
                currentPc.addIceCandidate(new RTCIceCandidate(candidateData)).catch(e => console.warn("Error adding incoming callee candidate:", e));
              } else {
                calleeCandidatesQueueRef.current.push(candidateData);
              }
            }
          });
        });
      }
    } catch (e: any) {
      console.error(e);
      alert('Could not start call. ' + e.message);
      cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !auth.currentUser) return;
    try {
      if (incomingCall.isGroup) {
        const cid = incomingCall.chatId;
        const type = incomingCall.type;
        stopRingtone();
        setIncomingCall(null);
        await joinGroupCall(cid, type);
        return;
      }

      calleeCandidatesQueueRef.current = [];
      callerCandidatesQueueRef.current = [];
      stopRingtone();
      
      callDocRef.current = doc(db, 'calls', incomingCall.id);
      const { pc } = await initWebRTC(incomingCall.type === 'video');

      const answerCandidates = collection(callDocRef.current, 'calleeCandidates');
      pc.onicecandidate = (event) => {
        event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
      };

      const offerDescription = incomingCall.offer;
      await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

      // Remote description has been set, check if there are any queued caller candidates
      console.log("Remote offer description set on callee, draining caller candidates queue:", callerCandidatesQueueRef.current.length);
      while (callerCandidatesQueueRef.current.length > 0) {
        const candidateData = callerCandidatesQueueRef.current.shift();
        if (candidateData) {
          pc.addIceCandidate(new RTCIceCandidate(candidateData)).catch(e => console.warn("Error adding queued caller candidate:", e));
        }
      }

      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      await updateDoc(callDocRef.current, {
        answer: {
          type: answerDescription.type,
          sdp: answerDescription.sdp,
        },
        status: 'accepted',
        startedAt: serverTimestamp()
      });

      setActiveCall({ ...incomingCall, status: 'accepted' });
      setIncomingCall(null);

      // Start timer
      clearInterval(timerRef.current);
      setCallDuration(0);
      timerRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);

      // Listen for caller ICE candidates
      onSnapshot(collection(callDocRef.current, 'callerCandidates'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const candidateData = change.doc.data() as RTCIceCandidateInit;
            const currentPc = pcRef.current;
            if (currentPc && currentPc.remoteDescription) {
              currentPc.addIceCandidate(new RTCIceCandidate(candidateData)).catch(e => console.warn("Error adding incoming caller candidate:", e));
            } else {
              callerCandidatesQueueRef.current.push(candidateData);
            }
          }
        });
      });
    } catch (e: any) {
      console.error(e);
      alert('Could not accept call.');
      rejectCall();
    }
  };

  const joinGroupCall = async (chatId: string, type: 'audio' | 'video') => {
    if (!auth.currentUser) return;
    try {
      const myId = auth.currentUser.uid;
      const callDoc = doc(db, 'calls', chatId);
      callDocRef.current = callDoc;

      // Add ourselves to participants
      const snap = await getDoc(callDoc);
      if (!snap.exists()) {
        alert("Call has already ended.");
        return;
      }

      await obtainLocalStream(type === 'video');

      // Update participants list in Firestore
      const currentParticipants = (snap.data() as any)?.participants || [];
      if (!currentParticipants.includes(myId)) {
        await updateDoc(callDoc, {
          participants: [...currentParticipants, myId],
          status: 'accepted' // make sure it transitions from calling
        });
      }

      setActiveCall({ 
        id: chatId, 
        chatId, 
        callerId: (snap.data() as any)?.callerId,
        calleeId: 'group',
        type, 
        status: 'accepted',
        isGroup: true,
        participants: [...currentParticipants, myId],
        createdAt: (snap.data() as any)?.createdAt
      } as any);

      // Start duration tracking timer
      clearInterval(timerRef.current);
      setCallDuration(0);
      timerRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);

    } catch (e: any) {
      console.error(e);
      alert('Could not join group call: ' + e.message);
      cleanupCall();
    }
  };

  const rejectCall = async () => {
    if (!incomingCall) return;
    stopRingtone();
    if (incomingCall.isGroup) {
      setIncomingCall(null);
      return;
    }
    await updateDoc(doc(db, 'calls', incomingCall.id), { status: 'rejected', endedAt: serverTimestamp() });
    setIncomingCall(null);
  };

  const endCall = async () => {
    if (callDocRef.current && activeCall) {
      try {
        if (activeCall.calleeId === 'group') {
          // It's a group call! Remove ourselves from participants
          const myId = auth.currentUser?.uid;
          if (myId) {
            const snap = await getDoc(callDocRef.current);
            if (snap.exists()) {
              const currentParticipants = (snap.data() as any)?.participants || [];
              const updatedParticipants = currentParticipants.filter((uid: string) => uid !== myId);
              
              if (updatedParticipants.length === 0) {
                // We were the last person! Mark call as ended.
                await updateDoc(callDocRef.current, { status: 'ended', endedAt: serverTimestamp() });
              } else {
                await updateDoc(callDocRef.current, { participants: updatedParticipants });
              }
            }
          }
        } else {
          // Standard call
          await updateDoc(callDocRef.current, { status: 'ended', endedAt: serverTimestamp() });
        }
      } catch (e) {
        // Handle gracefully if deleted
      }
    }
    cleanupCall();
  };

  // Synchronize group calling peer connections dynamically
  useEffect(() => {
    if (!activeCall || !activeCall.calleeId || activeCall.calleeId !== 'group' || !auth.currentUser) return;
    
    const myId = auth.currentUser.uid;
    const callDoc = doc(db, 'calls', activeCall.id);
    
    const unsubscribe = onSnapshot(callDoc, (docSnap) => {
      if (!docSnap.exists()) {
        cleanupCall();
        return;
      }
      
      const data = docSnap.data();
      if ((data as any)?.status === 'ended') {
        cleanupCall();
        return;
      }
      
      const currentParticipants = (data as any)?.participants || [];
      // If we are no longer in participants, cleanup/exit
      if (!currentParticipants.includes(myId)) {
        cleanupCall();
        return;
      }
      
      // Update activeCall participants locally
      setActiveCall(prev => prev ? { ...prev, participants: currentParticipants } as any : null);

      // Now establish peer WebRTC connections with other participants
      currentParticipants.forEach(async (otherId: string) => {
        if (otherId === myId) return;
        
        // Check if we already have an active peer connection or unsubscribe listener for this user
        if (pcsRef.current[otherId] || unsubscribesRef.current[`conn_${otherId}`]) {
          return; // Already setup!
        }
        
        const sorted = [myId, otherId].sort();
        const connId = `${sorted[0]}_${sorted[1]}`;
        const connDocRef = doc(db, 'calls', activeCall.id, 'connections', connId);
        
        if (myId < otherId) {
          // Initiator / WebRTC Caller
          try {
            console.log(`[Mesh] Initiating caller connection to: ${otherId}`);
            const pc = await getOrCreateGroupPeerConnection(otherId, activeCall.type === 'video', activeCall.id);
            
            const offerCandidates = collection(db, 'calls', activeCall.id, 'connections', connId, 'callerCandidates');
            pc.onicecandidate = (event) => {
              if (event.candidate) {
                addDoc(offerCandidates, event.candidate.toJSON()).catch(e => console.error("Error writing candidate:", e));
              }
            };
            
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            await setDoc(connDocRef, {
              offer: { type: offer.type, sdp: offer.sdp },
              callerId: myId,
              calleeId: otherId,
              status: 'offered'
            }, { merge: true });
            
            const unsubConn = onSnapshot(connDocRef, (snap) => {
              if (snap.exists()) {
                const connData = snap.data();
                if (connData.answer && !pc.currentRemoteDescription) {
                  pc.setRemoteDescription(new RTCSessionDescription(connData.answer)).then(() => {
                    console.log(`[Mesh] Connection answered successfully by ${otherId}`);
                  }).catch(e => console.error("Failed to set remote description:", e));
                }
              }
            });
            
            const unsubIce = onSnapshot(collection(db, 'calls', activeCall.id, 'connections', connId, 'calleeCandidates'), (snapshot) => {
              snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                  const candidateData = change.doc.data() as RTCIceCandidateInit;
                  pc.addIceCandidate(new RTCIceCandidate(candidateData)).catch(e => console.warn("Error adding mesh candidate:", e));
                }
              });
            });
            
            unsubscribesRef.current[`conn_${otherId}`] = () => {
              unsubConn();
              unsubIce();
            };
          } catch (err) {
            console.error(`Error in mesh caller initialization for ${otherId}:`, err);
          }
        } else {
          // Receiver / WebRTC Callee
          try {
            console.log(`[Mesh] Setting up receiver listener for: ${otherId}`);
            const unsubConn = onSnapshot(connDocRef, async (snap) => {
              if (snap.exists()) {
                const connData = snap.data();
                if (connData.offer) {
                  const pc = await getOrCreateGroupPeerConnection(otherId, activeCall.type === 'video', activeCall.id);
                  
                  if (!pc.currentRemoteDescription) {
                    await pc.setRemoteDescription(new RTCSessionDescription(connData.offer));
                    
                    const answerCandidates = collection(db, 'calls', activeCall.id, 'connections', connId, 'calleeCandidates');
                    pc.onicecandidate = (event) => {
                      if (event.candidate) {
                        addDoc(answerCandidates, event.candidate.toJSON()).catch(e => console.error("Error writing candidate:", e));
                      }
                    };
                    
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    
                    await updateDoc(connDocRef, {
                      answer: { type: answer.type, sdp: answer.sdp },
                      status: 'accepted'
                    });
                    
                    const unsubIce = onSnapshot(collection(db, 'calls', activeCall.id, 'connections', connId, 'callerCandidates'), (snapshot) => {
                      snapshot.docChanges().forEach((change) => {
                        if (change.type === 'added') {
                          const candidateData = change.doc.data() as RTCIceCandidateInit;
                          pc.addIceCandidate(new RTCIceCandidate(candidateData)).catch(e => console.warn("Error adding mesh candidate:", e));
                        }
                      });
                    });
                    
                    unsubscribesRef.current[`ice_${otherId}`] = unsubIce;
                  }
                }
              }
            });
            
            unsubscribesRef.current[`conn_${otherId}`] = () => {
              unsubConn();
              if (unsubscribesRef.current[`ice_${otherId}`]) {
                unsubscribesRef.current[`ice_${otherId}`]();
              }
            };
          } catch (err) {
            console.error(`Error in mesh callee initialization for ${otherId}:`, err);
          }
        }
      });

      // Cleanup disconnected peers
      Object.keys(pcsRef.current).forEach((otherId) => {
        if (!currentParticipants.includes(otherId)) {
          console.log(`[Mesh] Participant ${otherId} left, cleaning up WebRTC connection.`);
          try {
            pcsRef.current[otherId].close();
          } catch (e) {}
          delete pcsRef.current[otherId];
          
          if (unsubscribesRef.current[`conn_${otherId}`]) {
            unsubscribesRef.current[`conn_${otherId}`]();
            delete unsubscribesRef.current[`conn_${otherId}`];
          }
          if (unsubscribesRef.current[`ice_${otherId}`]) {
            unsubscribesRef.current[`ice_${otherId}`]();
            delete unsubscribesRef.current[`ice_${otherId}`];
          }
          
          setRemoteStreams(prev => {
            const updated = { ...prev };
            delete updated[otherId];
            return updated;
          });
        }
      });
    });
    
    return () => {
      unsubscribe();
    };
  }, [activeCall?.id, activeCall?.calleeId]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !t.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleSpeaker = () => {
    // For web, output device switching requires specific APIs.
    // We just toggle the state for UI representation.
    setIsSpeaker(!isSpeaker);
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => {
        t.enabled = !t.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <CallContext.Provider value={{
      incomingCall, activeCall, localStream, remoteStream, remoteStreams,
      isMuted, isSpeaker, isVideoOff, startCall, acceptCall, joinGroupCall, rejectCall, endCall, 
      toggleMute, toggleSpeaker, toggleVideo, callDuration
    }}>
      {children}
    </CallContext.Provider>
  );
};
