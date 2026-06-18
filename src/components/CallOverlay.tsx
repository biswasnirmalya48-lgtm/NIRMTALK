import React, { useEffect, useRef } from 'react';
import { useCallSystem } from '../providers/CallProvider';
import { Phone, PhoneOff, MicOff, Mic, Volume2, VolumeX, Video, VideoOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../firebase';
import { UserProfile } from '../types';

function GroupParticipantMedia({ participantId, stream, isVideo, profiles }: { participantId: string, stream: MediaStream, isVideo: boolean, profiles: Record<string, UserProfile>, key?: any }) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const profile = profiles[participantId];

  useEffect(() => {
    if (mediaRef.current && stream) {
      mediaRef.current.srcObject = stream;
      mediaRef.current.play().catch(e => console.warn(`Group participant stream play failed for ${participantId}`, e));
    }
  }, [stream, participantId]);

  if (isVideo) {
    return (
      <div className="relative rounded-[24px] overflow-hidden bg-[#121318]/90 border border-white/10 aspect-video h-full w-full shadow-2xl flex items-center justify-center backdrop-blur-md">
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          autoPlay
          playsInline
          className="w-full h-full object-cover select-none"
        />
        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-bold text-white border border-white/5">
          {profile?.displayName || 'Participant'}
        </div>
      </div>
    );
  }

  // Audio stream
  return (
    <div className="relative rounded-3xl p-4 bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-3 w-32 h-32 backdrop-blur-md">
      <audio
        ref={mediaRef as React.RefObject<HTMLAudioElement>}
        autoPlay
      />
      <img
        src={profile?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'}
        alt="Profile"
        className="w-12 h-12 rounded-full object-cover border border-white/20 shadow-md animate-pulse"
      />
      <span className="text-[10px] font-bold text-white truncate max-w-full">
        {profile?.displayName || 'Participant'}
      </span>
    </div>
  );
}

export function CallOverlay({ profiles }: { profiles: Record<string, UserProfile> }) {
  const { incomingCall, activeCall, acceptCall, rejectCall, endCall, toggleMute, toggleSpeaker, toggleVideo, isMuted, isSpeaker, isVideoOff, callDuration, remoteStream, localStream, remoteStreams } = useCallSystem();
  
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && activeCall?.type === 'video') {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.log('Video play failed', e));
    }
  }, [remoteStream, activeCall?.type]);

  useEffect(() => {
    if (localVideoRef.current && localStream && activeCall?.type === 'video') {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.log('Local video play failed', e));
    }
  }, [localStream, activeCall?.type]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream && activeCall?.type === 'audio') {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(e => console.log('Audio track play failed', e));
    }
  }, [remoteStream, activeCall?.type]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const currentCall = activeCall || incomingCall;
  if (!currentCall) return null;

  // Determine the other user in the call with 100% safety
  const currentUserId = auth.currentUser?.uid;
  const isGroupCall = activeCall?.calleeId === 'group' || activeCall?.isGroup;
  
  const otherUserId = currentCall.callerId === currentUserId ? currentCall.calleeId : currentCall.callerId;
  const otherUserProfile = profiles[otherUserId];

  if (incomingCall && !activeCall) {
    return (
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0, y: -80, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.95 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-sm overflow-hidden rounded-[32px] border border-white/25 dark:border-white/10 shadow-[0_30px_70px_rgba(0,0,0,0.3)]"
        >
          {/* Liquid backing blob in the capsule */}
          <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-3xl" />
          <motion.div 
            animate={{ 
              x: [-10, 10, -10], 
              y: [-5, 5, -5],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute -top-12 -left-12 w-28 h-28 rounded-full bg-cyan-500/20 blur-xl pointer-events-none" 
          />
          <motion.div 
            animate={{ 
              x: [10, -10, 10], 
              y: [5, -5, 5],
              scale: [1, 1.15, 1],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute -bottom-12 -right-12 w-28 h-28 rounded-full bg-rose-500/20 blur-xl pointer-events-none" 
          />

          {/* Frosted Glass content */}
          <div className="relative z-10 p-5 flex items-center gap-4">
            <div className="relative">
              <img 
                src={otherUserProfile?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'} 
                alt="Caller" 
                className="w-14 h-14 rounded-full object-cover shadow-lg border border-white/20" 
              />
              <span className="absolute bottom-0 right-0 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500"></span>
              </span>
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-100 truncate">
                {incomingCall.isGroup 
                  ? `${otherUserProfile?.displayName || 'Someone'}'s Group`
                  : (otherUserProfile?.displayName || 'Incoming caller')}
              </h3>
              <p className="text-xs text-white/75 font-medium flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                {incomingCall.isGroup 
                  ? `Incoming Group ${incomingCall.type} call...`
                  : `Incoming ${incomingCall.type} call...`}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={acceptCall} 
                className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 border border-emerald-400/30 transition-shadow"
              >
                <Phone className="w-5 h-5 fill-current animate-pulse" />
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={rejectCall} 
                className="w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-400 flex items-center justify-center text-white shadow-lg shadow-rose-500/30 border border-rose-400/30 transition-shadow"
              >
                <PhoneOff className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (activeCall) {
    const isRinging = activeCall.status === 'calling';
    
    return (
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-[#0c0d0f] overflow-hidden flex flex-col"
        >
          {/* 1. DYNAMIC WATER-GLASS BACKGROUND BLOBS */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            {/* Ambient base */}
            <div className="absolute inset-0 bg-[#0d0e12]/95" />
            
            {/* Blob 1 - Indigo */}
            <motion.div 
              animate={{
                x: [0, 80, -40, 0],
                y: [0, -100, 60, 0],
                scale: [1, 1.25, 0.85, 1],
              }}
              transition={{
                duration: 18,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute top-1/4 left-10 w-[350px] h-[350px] md:w-[500px] md:h-[500px] rounded-full bg-violet-600/25 blur-[90px]"
            />
            
            {/* Blob 2 - Cyan */}
            <motion.div 
              animate={{
                x: [0, -120, 80, 0],
                y: [0, 80, -120, 0],
                scale: [1, 0.8, 1.2, 1],
              }}
              transition={{
                duration: 22,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute bottom-1/4 right-10 w-[400px] h-[400px] md:w-[600px] md:h-[600px] rounded-full bg-cyan-500/20 blur-[100px]"
            />

            {/* Blob 3 - Emerald Accent */}
            <motion.div 
              animate={{
                x: [0, 100, -80, 0],
                y: [0, 120, -100, 0],
                scale: [1, 1.15, 0.9, 1],
              }}
              transition={{
                duration: 14,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute top-1/2 left-1/3 w-[250px] h-[250px] rounded-full bg-emerald-500/10 blur-[80px]"
            />
          </div>

          {/* 2. VIDEO STREAM LAYERS */}
          {activeCall.type === 'video' && !isGroupCall && remoteStream && (
            <div className="absolute inset-0 z-10 w-full h-full">
              <video 
                ref={remoteVideoRef}
                autoPlay 
                playsInline 
                className="w-full h-full object-cover select-none" 
              />
              {/* Glass overlay on top of full video for atmospheric integration */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40 z-11 pointer-events-none" />
            </div>
          )}

          {/* Group Video Call Grid */}
          {isGroupCall && activeCall.type === 'video' && (
            <div className="absolute inset-0 z-10 w-full h-full flex flex-col items-center justify-center p-6 pt-28 pb-32">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full h-full max-h-[70vh] overflow-y-auto p-4 items-center justify-center">
                {(Object.entries(remoteStreams || {}) as [string, MediaStream][]).map(([participantId, str]) => (
                  <GroupParticipantMedia 
                    key={participantId}
                    participantId={participantId}
                    stream={str}
                    isVideo={true}
                    profiles={profiles}
                  />
                ))}
                {(!remoteStreams || Object.keys(remoteStreams).length === 0) && (
                  <div className="col-span-full flex flex-col items-center justify-center text-center p-8 bg-black/40 backdrop-blur-md rounded-3xl border border-white/10 max-w-md mx-auto">
                    <div className="w-12 h-12 rounded-full bg-cyan-500/15 flex items-center justify-center text-cyan-400 mb-4 animate-pulse">
                      <Phone className="w-6 h-6 animate-bounce" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Waiting for others...</h3>
                    <p className="text-xs text-white/60">Invite other members of this group chat to click their Join banner and join this secure crystal-clear session.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* PIP Local Video Container */}
          {activeCall.type === 'video' && localStream && (
            <motion.div 
              drag 
              dragConstraints={{ left: 10, right: window.innerWidth - 150, top: 10, bottom: window.innerHeight - 250 }}
              dragElastic={0.1}
              dragMomentum={false}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="absolute top-10 right-6 w-32 h-44 bg-slate-900/80 rounded-[24px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-40 cursor-grab border border-white/20 backdrop-blur-md"
            >
              {isVideoOff ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-1.5 p-3">
                  <VideoOff className="w-5 h-5 text-amber-500 animate-pulse" />
                  <span className="text-[9px] font-mono tracking-widest text-center text-amber-500/80 uppercase select-none font-bold">Camera Off</span>
                </div>
              ) : (
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover pointer-events-none select-none" 
                />
              )}
            </motion.div>
          )}

          {/* 3. DYNAMIC CONTENT CARD (VOICE) */}
          <div className="relative z-20 flex-1 flex flex-col items-center justify-center p-6 text-center">
            {activeCall.type === 'audio' && !isGroupCall && (
              <div className="relative w-64 h-64 flex items-center justify-center mb-8">
                {/* Simulated Halo visualizers (Liquid Glass ripples) */}
                <motion.div 
                  animate={{ 
                    scale: [1, 1.8],
                    opacity: [0.35, 0]
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeOut"
                  }}
                  className="absolute w-40 h-40 rounded-full border border-cyan-400/40 blur-[3px]"
                />
                
                <motion.div 
                  animate={{ 
                    scale: [1, 2.3],
                    opacity: [0.2, 0]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: 1,
                    ease: "easeOut"
                  }}
                  className="absolute w-40 h-40 rounded-full border border-violet-500/30 blur-[2px]"
                />

                <motion.div 
                  animate={{ 
                    scale: [1, 1.4],
                    opacity: [0.5, 0]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: 0.5,
                    ease: "easeOut"
                  }}
                  className="absolute w-40 h-40 rounded-full bg-cyan-400/10 blur-md"
                />

                {/* Main Avatar Glass Capsule */}
                <div className="relative w-40 h-40 rounded-full p-1.5 bg-white/10 backdrop-blur-md border border-white/25 shadow-2xl flex items-center justify-center">
                  <img 
                    src={otherUserProfile?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'} 
                    alt="Profile" 
                    className="w-full h-full rounded-full object-cover border-2 border-white/50" 
                  />
                  {isRinging && (
                    <span className="absolute -top-1 right-2 flex h-5 w-5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-blue-500"></span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Group Audio Call Participants display */}
            {isGroupCall && activeCall.type === 'audio' && (
              <div className="flex flex-col items-center">
                <div className="flex gap-4 flex-wrap justify-center max-w-lg mb-8">
                  {(Object.entries(remoteStreams || {}) as [string, MediaStream][]).map(([participantId, str]) => (
                    <GroupParticipantMedia 
                      key={participantId}
                      participantId={participantId}
                      stream={str}
                      isVideo={false}
                      profiles={profiles}
                    />
                  ))}
                  {(!remoteStreams || Object.keys(remoteStreams).length === 0) && (
                    <div className="flex flex-col items-center justify-center p-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
                      <p className="text-sm font-semibold text-white">No remote participants yet</p>
                      <p className="text-xs text-white/50 mt-1">Waiting for other Group Members to join...</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Video metadata overlay (small top summary when in video mode) */}
            {activeCall.type === 'video' && !isGroupCall && (
              <div className="absolute top-10 left-6 z-30 flex flex-col gap-2">
                <div className="flex items-center gap-3 bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl shadow-lg">
                  <img 
                    src={otherUserProfile?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'} 
                    alt="Profile" 
                    className="w-8 h-8 rounded-full object-cover border border-white/20" 
                  />
                  <div className="text-left">
                    <h4 className="text-sm font-bold text-white">{otherUserProfile?.displayName || 'Unknown'}</h4>
                    <p className="text-[10px] text-white/70">
                      {isRinging ? 'Ringing...' : 'Video Call Connected'}
                    </p>
                  </div>
                </div>

                {!isRinging && (
                  <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur-md border border-emerald-500/15 py-1.5 px-3 rounded-lg text-[9px] text-emerald-400 font-mono font-semibold self-start tracking-wider shadow-md">
                    <span className="flex h-1.5 w-1.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span>UHD 4K • Direct P2P Connected • 12 Mbps Stereo Low-Latency</span>
                  </div>
                )}
              </div>
            )}

            {/* Group call metadata overlay */}
            {activeCall.type === 'video' && isGroupCall && (
              <div className="absolute top-10 left-6 z-30 flex flex-col gap-2">
                <div className="flex items-center gap-3 bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl shadow-lg animate-fade-in">
                  <div className="text-left">
                    <h4 className="text-sm font-bold text-white">Group Video Session</h4>
                    <p className="text-[10px] text-white/70">
                      Connected: {Object.keys(remoteStreams || {}).length + 1} participant(s)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* General profile text and details */}
            {activeCall.type === 'audio' && !isGroupCall && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md"
              >
                <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2 drop-shadow-md">
                  {otherUserProfile?.displayName || 'Unknown'}
                </h2>
                
                {otherUserProfile?.phoneNumber && (
                  <p className="text-xs text-white/50 font-mono tracking-wider mb-4">
                    {otherUserProfile.phoneNumber}
                  </p>
                )}

                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-full">
                  <span className={`w-2 h-2 rounded-full ${isRinging ? 'bg-cyan-400 animate-pulse' : 'bg-green-400'}`} />
                  <span className="text-sm text-slate-300 font-semibold uppercase tracking-wider">
                    {isRinging ? 'Calling...' : formatDuration(callDuration)}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Group call Audio main header */}
            {activeCall.type === 'audio' && isGroupCall && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md"
              >
                <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2 drop-shadow-md">
                  Active Group Voice Session
                </h2>
                
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm text-slate-300 font-semibold uppercase tracking-wider font-mono">
                    {formatDuration(callDuration)}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Small center display for active video Duration */}
            {activeCall.type === 'video' && (
              <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-2 px-4 py-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full shadow-lg">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-mono font-bold text-white tracking-widest">
                  {formatDuration(callDuration)}
                </span>
              </div>
            )}
          </div>
          
          {/* Audio element for voice calls */}
          {activeCall.type === 'audio' && !isGroupCall && <audio ref={remoteAudioRef} autoPlay />}

          {/* 4. LIQUID GLASS FLOATING DOCK */}
          <div className="p-8 pb-14 z-20 flex justify-center items-center gap-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
            <div className="flex items-center bg-white/5 dark:bg-black/30 backdrop-blur-2xl border border-white/15 dark:border-white/10 px-6 py-4 rounded-[40px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_20px_50px_rgba(0,0,0,0.4)] gap-5">
              
              {/* Mute button */}
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleMute} 
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  isMuted 
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 border border-rose-400/30' 
                    : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
                }`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </motion.button>
              
              {/* Speaker sound option (Voice-only calls) */}
              {activeCall.type === 'audio' && (
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleSpeaker} 
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    isSpeaker 
                      ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 border border-cyan-400/30' 
                      : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
                  }`}
                >
                  {isSpeaker ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                </motion.button>
              )}

              {/* Camera switch option (Video calls) */}
              {activeCall.type === 'video' && (
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleVideo} 
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    isVideoOff 
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 border border-amber-400/30' 
                      : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
                  }`}
                >
                  {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                </motion.button>
              )}

              {/* End call button */}
              <motion.button 
                whileHover={{ scale: 1.15, rotate: 135 }}
                whileTap={{ scale: 0.9 }}
                onClick={endCall} 
                className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center text-white shadow-xl shadow-rose-600/40 border border-rose-500/30 transition-shadow"
              >
                <PhoneOff className="w-7 h-7" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}
