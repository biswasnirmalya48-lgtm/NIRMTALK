import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Users, Info, Phone, Video, MessageSquare, Reply, Edit2, Trash2, Smile, X, ArrowLeft, Pin, Search, Share, Check, CheckCheck, Edit, UserPlus, Paperclip, Mic, Image as ImageIcon, Camera, File, MapPin, User, BarChart2, MoreHorizontal, Languages, Volume2, Sparkles } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import confetti from 'canvas-confetti';
import { auth, db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useMessages, sendMessage, editMessage, deleteMessage, toggleReaction, togglePinMessage, markChatRead, setChatTypingStatus, useChats, forwardMessage, removeMemberFromGroup, updateGroupProfile, addMemberToGroup, clearChatHistory, deleteChat, blockUser, getTimestampMillis } from '../hooks/useFirestore';
import { useCallSystem } from '../providers/CallProvider';
import { UserProfile, Chat, Message } from '../types';
import { canViewLastSeen, canCall, getProfilePhoto, canSendReadReceipts } from '../utils/privacy';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { DynamicScenery } from './DynamicScenery';

function AudioMessage({ src, duration }: { src?: string, duration?: number }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = async () => {
    if (navigator.vibrate) navigator.vibrate(20);
    if (audioRef.current) {
       if (isPlaying) {
         audioRef.current.pause();
         setIsPlaying(false);
       } else {
         try {
           setIsPlaying(true);
           await audioRef.current.play();
         } catch (err: any) {
           console.error("Audio playback error:", err);
           setIsPlaying(false);
           alert(`Cannot play audio: ${err?.message || 'Unsupported format'}`);
         }
       }
    }
  };

  return (
    <div className="flex items-center gap-3 bg-black/5 dark:bg-white/10 rounded-full py-1.5 px-3 min-w-[160px]">
      <audio ref={audioRef} src={src} onEnded={() => setIsPlaying(false)} className="hidden" />
      <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
        {isPlaying ? (
           <div className="w-2.5 h-2.5 bg-white rounded-sm" />
        ) : (
           <div className="w-0 h-0 border-t-4 border-t-transparent border-l-6 border-l-white border-b-4 border-b-transparent ml-1" />
        )}
      </button>
      <div className="flex-1">
        <div className="h-1 w-full bg-black/10 dark:bg-white/20 rounded-full relative">
          <div className={`absolute left-0 top-0 bottom-0 bg-blue-500 rounded-full transition-all ${isPlaying ? 'w-full duration-[10000ms] ease-linear' : 'w-0'}`}></div>
        </div>
      </div>
      <span className="text-[11px] font-medium font-mono min-w-[30px]">{duration ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}` : '0:00'}</span>
    </div>
  );
}

export function ChatView({ chat, profiles, onBack }: { chat?: Chat, profiles: Record<string, UserProfile>, onBack?: () => void }) {
  const { startCall, joinGroupCall, activeCall } = useCallSystem();
  
  const triggerHaptic = (pattern: number | number[] = 50) => {
    const hapticsEnabled = currentUser && profiles[currentUser.uid]?.settings?.hapticsEnabled !== false;
    if (hapticsEnabled && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const currentUser = auth.currentUser;
  const messages = useMessages(chat?.id || null);
  const chats = useChats();
  const [text, setText] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const [attachment, setAttachment] = useState<{file: File, url: string, type: 'image' | 'video' | 'file'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [activeGroupCall, setActiveGroupCall] = useState<any | null>(null);

  useEffect(() => {
    if (!chat || chat.type !== 'group') {
      setActiveGroupCall(null);
      return;
    }
    const callRef = doc(db, 'calls', chat.id);
    const unsub = onSnapshot(callRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === 'calling' || data.status === 'accepted') {
          setActiveGroupCall({ id: snap.id, ...data });
        } else {
          setActiveGroupCall(null);
        }
      } else {
        setActiveGroupCall(null);
      }
    }, (err) => {
      console.warn("Error listening to group call snapshot:", err);
      setActiveGroupCall(null);
    });
    return () => unsub();
  }, [chat?.id, chat?.type]);

  const startRecording = async () => {
    triggerHaptic([50, 50]);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Your browser does not support audio recording.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const types = ['audio/mp4', 'audio/webm', 'audio/ogg'];
      let options = undefined;
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) {
          options = { mimeType: t };
          break;
        }
      }

      const recorder = new MediaRecorder(stream, options);
      setMediaRecorder(recorder);
      
      const audioChunks: BlobPart[] = [];
      recorder.ondataavailable = e => {
        if(e.data.size > 0) audioChunks.push(e.data);
      };
      
      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || options?.mimeType || 'audio/mp4';
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        const reader = new FileReader();
        reader.onload = async () => {
          const duration = recordingDuration;
          await sendMessage(chat.id, 'Voice message', chat.type, chat.name, undefined, {
             type: 'audio',
             url: reader.result as string,
             duration: duration,
             mimeType: mimeType
          });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };
      
      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(p => p + 1);
      }, 1000);
      
    } catch(err: any) {
      console.error(err);
      alert(`Microphone access error: ${err?.message || 'Access denied or not available.'}`);
    }
  };

  const stopRecording = () => {
    triggerHaptic(50);
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      if (recordingTimer.current) clearInterval(recordingTimer.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      setMediaRecorder(null);
      if (recordingTimer.current) clearInterval(recordingTimer.current);
    }
  };
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showPinnedMessage, setShowPinnedMessage] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [forwardingMsg, setForwardingMsg] = useState<Message | null>(null);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [groupEditName, setGroupEditName] = useState('');
  const [groupEditPhoto, setGroupEditPhoto] = useState<string | null>(null);
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState<Record<string, boolean>>({});

  const handleReaction = (msgId: string, emoji: string, reactions: any) => {
    triggerHaptic(50);
    toggleReaction(chat?.id || '', msgId, emoji, reactions);
  };

  const handleTranslate = async (msg: Message) => {
    if (translations[msg.id] || isTranslating[msg.id]) return;
    
    setIsTranslating(prev => ({ ...prev, [msg.id]: true }));
    try {
      const targetLanguage = navigator.language || 'English';
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.text, targetLanguage })
      });
      const data = await res.json();
      if (data.success && data.text) {
        setTranslations(prev => ({ ...prev, [msg.id]: data.text }));
      } else {
        alert(data.error || 'Translation failed');
      }
    } catch (e) {
      console.error(e);
      alert('Translation failed');
    } finally {
      setIsTranslating(prev => ({ ...prev, [msg.id]: false }));
    }
  };

  const [isGeneratingReply, setIsGeneratingReply] = useState(false);

  const handleMagicReply = async () => {
    if (messages.length === 0 || isGeneratingReply) return;
    triggerHaptic(20);
    setIsGeneratingReply(true);
    setText('');
    try {
      const lastMessage = messages[messages.length - 1];
      const context = lastMessage.text || 'Say something nice';
      
      const res = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `Generate a very short, friendly, and natural 1-sentence reply to this message from a friend in a casual chat:\n"${context}"\n\nDo not include quotes or surrounding text. Just the reply.` })
      });
      
      if (!res.body) throw new Error('No body');
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setText(prev => prev + chunk);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to generate reply');
    } finally {
      setIsGeneratingReply(false);
    }
  };

  const speakMessage = (text: string) => {
    if (!text) return;
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Text-to-speech is not supported in your browser.');
    }
  };

  const prevMessagesLength = useRef(0);
  
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      const newMessages = messages.slice(prevMessagesLength.current);
      newMessages.forEach(m => {
        const lower = m.text?.toLowerCase() || '';
        if (lower.includes('congratulations') || lower.includes('happy birthday') || lower.includes('congrats') || lower.includes('🎉')) {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      });
      prevMessagesLength.current = messages.length;
    }
  }, [messages]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const myProfile = currentUser ? profiles[currentUser.uid] : null;
  const bubbleStyle = myProfile?.settings?.chatBubbleStyle || 'rounded';
  
  useEffect(() => {
    if (scrollRef.current && !searchQuery) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, searchQuery]);

  useEffect(() => {
    if (chat && messages.length > 0) {
      markChatRead(chat.id);
    }
  }, [chat?.id, messages.length]);

  const displayMessages = useMemo(() => {
    let filtered = messages;
    if (currentUser && chat?.clearedHistory && currentUser.uid in chat.clearedHistory) {
      const clearTimeVal = chat.clearedHistory[currentUser.uid];
      const clearTime = clearTimeVal ? getTimestampMillis(clearTimeVal) : Date.now();
      filtered = filtered.filter(m => {
        if (!m.createdAt) return true; // keep pending messages
        const msgTime = getTimestampMillis(m.createdAt);
        return msgTime > clearTime;
      });
    }
    if (!searchQuery) return filtered;
    return filtered.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [messages, searchQuery, chat?.clearedHistory, currentUser]);

  useEffect(() => {
    if (!chat && onBack) {
      onBack();
    }
  }, [chat, onBack]);

  const chatWallpaper = myProfile?.settings?.chatWallpaper;
  
  if (!chat || !currentUser) return null;

  const lastTypingTime = useRef<number>(0);

  const handleTextChange = (e: any) => {
    setText(e.target.value);
    
    const now = Date.now();
    if (now - lastTypingTime.current > 2000) {
      setChatTypingStatus(chat.id, true);
      lastTypingTime.current = now;
    }
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setChatTypingStatus(chat.id, false);
      lastTypingTime.current = 0;
    }, 2000);
  };

  const handleSend = async (e: any) => {
    e.preventDefault();
    if (!text.trim() && !attachment) return;
    triggerHaptic(50);
    const msgText = text;
    setText('');
    setChatTypingStatus(chat.id, false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    // Process attachment to message
    let attachmentData = undefined;
    if (attachment) {
      attachmentData = {
        type: attachment.type,
        url: attachment.url,
      };
      setAttachment(null);
    }

    if (editingMsg && msgText && !attachmentData) { // Attachment editing not supported easily
      await editMessage(chat.id, editingMsg.id, msgText);
      setEditingMsg(null);
    } else {
      let replyData = undefined;
      if (replyingTo) {
        replyData = {
          id: replyingTo.id,
          text: replyingTo.text,
          senderName: profiles[replyingTo.senderId]?.displayName || 'Unknown'
        };
      }
      await sendMessage(chat.id, msgText, chat.type, chat.name, replyData, attachmentData);
      setReplyingTo(null);
      setEditingMsg(null); // Clear just in case
    }
  };

  const handleEdit = (msg: Message) => {
    setEditingMsg(msg);
    setReplyingTo(null);
    setText(msg.text);
  };

  const handleReply = (msg: Message) => {
    setReplyingTo(msg);
    setEditingMsg(null);
    setText('');
  };
  
  const handleCancelAction = () => {
    setEditingMsg(null);
    setReplyingTo(null);
    setText('');
  };

  const handlePin = async (msg: Message) => {
    const senderName = profiles[msg.senderId]?.displayName || 'Unknown';
    if (chat.pinnedMessage?.id === msg.id) {
       await togglePinMessage(chat.id, null);
    } else {
       await togglePinMessage(chat.id, msg, senderName);
    }
  };

  const getChatName = () => {
    if (chat.type === 'group') return chat.name || 'Group Chat';
    const otherId = chat.members.find((m: string) => m !== currentUser?.uid);
    return otherId && profiles[otherId] ? profiles[otherId].displayName : 'Unknown User';
  };

  const getChatPhoto = () => {
    if (chat.type === 'group') return chat.photoURL || null;
    const otherId = chat.members.find((m: string) => m !== currentUser?.uid);
    return currentUser && otherId && profiles[otherId] ? getProfilePhoto(currentUser.uid, profiles[otherId], [chat]) : null;
  };

  const getChatSubtext = () => {
    if (chat.type === 'group') return `${chat.members.length} members`;
    const otherId = chat.members.find((m: string) => m !== currentUser?.uid);
    if (otherId && profiles[otherId] && currentUser) {
      const user = profiles[otherId];
      if (!canViewLastSeen(currentUser.uid, user, [chat])) return '';
      if (user.status === 'online') return 'online';
      if (user.lastSeen) {
         try {
           const date = user.lastSeen.toDate ? user.lastSeen.toDate() : new Date(user.lastSeen);
           return `last seen ${formatDistanceToNow(date, { addSuffix: true })}`;
         } catch (e) {
           return 'offline';
         }
      }
    }
    return 'offline';
  };

  const getMessageTime = (ts: any) => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return format(date, 'HH:mm');
  };

  const isMessageReadByOther = (msg: Message) => {
    if (!currentUser) return false;
    
    // Privacy: Check if I have read receipts enabled
    const myProfile = profiles[currentUser.uid];
    if (!canSendReadReceipts(myProfile)) return false;
    
    if (chat.type === 'direct') {
       const otherId = chat.members.find((m: string) => m !== currentUser.uid);
       const otherProfile = otherId ? profiles[otherId] : null;
       if (otherProfile && !canSendReadReceipts(otherProfile)) {
          return false;
       }
    }
    
    // Check by readBy array dynamically added to messages
    if (msg.readBy && msg.readBy.length > 0) {
      const otherReadByIds = msg.readBy.filter(id => id !== currentUser.uid);
      if (chat.type === 'direct') return otherReadByIds.length > 0;
      if (chat.type === 'group') return otherReadByIds.length === chat.members.length - 1; // all others read it
    }

    // Fallback to readReceipts
    if (chat.type === 'group') return false;
    const otherId = chat.members.find((m: string) => m !== currentUser.uid);
    const otherReadTime = chat.readReceipts?.[otherId!];
    if (otherReadTime && msg.createdAt) {
      const msgTime = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
      return new Date(otherReadTime) >= msgTime;
    }
    return false;
  };

  const chatPhoto = getChatPhoto();
  const chatName = getChatName();

  const activeTypers = Object.entries(chat.typing || {})
    .filter(([uid, ts]: [string, any]) => uid !== currentUser.uid && !!ts)
    .map(([uid]) => profiles[uid]?.displayName.split(' ')[0] || 'Someone');

  return (
    <div 
      className={`flex flex-col h-full relative overflow-hidden ${chatWallpaper ? 'bg-black/5 dark:bg-black/20' : 'bg-transparent'}`}
      style={chatWallpaper ? { backgroundImage: `url(${chatWallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' } : {}}
    >
      {/* Header */}
      <div className="absolute top-2 left-2 right-2 md:top-4 md:left-4 md:right-4 z-[100] flex items-center justify-center pointer-events-none">
         <div className="h-[60px] md:h-[64px] border border-white/50 dark:border-white/20 bg-white/30 dark:bg-white/10 backdrop-blur-[40px] bg-gradient-to-br from-white/40 to-white/10 dark:from-white/10 dark:to-white/5 rounded-full px-2 md:px-6 flex items-center justify-between shadow-[0_8px_32px_rgba(31,38,135,0.15)] ring-1 ring-white/50 dark:ring-white/10 pointer-events-auto max-w-4xl w-full mx-auto">
            <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0 pr-2">
               {onBack && (
                 <button onClick={onBack} className="md:hidden w-10 h-10 -ml-2 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/10 rounded-full transition-colors shrink-0">
                   <ArrowLeft className="w-5 h-5" />
                 </button>
               )}
               {chat.type === 'group' ? (
                 <div className="w-10 h-10 shrink-0 bg-white/50 dark:bg-[#1c1c1e]/50 backdrop-blur-md text-slate-700 dark:text-slate-300 rounded-full flex items-center justify-center font-bold shadow-sm border border-white/20">
                    <Users className="w-5 h-5"/>
                 </div>
               ) : chatPhoto ? (
                  <img src={chatPhoto} alt="Avatar" className="w-10 h-10 shrink-0 rounded-full object-cover shadow-sm border border-white/20" />
               ) : (
                  <div className="w-10 h-10 shrink-0 bg-white/50 dark:bg-[#1c1c1e]/50 backdrop-blur-md text-slate-700 dark:text-slate-300 rounded-full flex items-center justify-center font-semibold text-lg shadow-sm border border-white/20">
                    {chatName.charAt(0).toUpperCase()}
                  </div>
               )}
               <button onClick={() => setShowGroupInfo(!showGroupInfo)} className="flex flex-col flex-1 min-w-0 justify-center text-left overflow-hidden">
                 <h2 className="text-[16px] font-semibold text-slate-900 dark:text-white tracking-tight leading-tight truncate w-full">{chatName || 'Chat'}</h2>
                 <div className="h-4 flex items-center w-full min-w-0 overflow-hidden">
                   {activeTypers.length > 0 ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-[13px] text-blue-600 dark:text-blue-400 capitalize font-medium min-w-0 overflow-hidden w-full">
                        <span className="truncate flex-shrink">{activeTypers.join(', ')}</span>
                        <span className="flex items-center gap-0.5 shrink-0">
                          <span>typing</span>
                          <span className="flex gap-[2px] ml-0.5 items-center justify-center translate-y-[1px]">
                            <motion.span animate={{ opacity: [0.3, 1, 0.3], y: [0, -1.5, 0] }} transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut', delay: 0 }} className="w-1 h-1 bg-current rounded-full block" />
                            <motion.span animate={{ opacity: [0.3, 1, 0.3], y: [0, -1.5, 0] }} transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut', delay: 0.15 }} className="w-1 h-1 bg-current rounded-full block" />
                            <motion.span animate={{ opacity: [0.3, 1, 0.3], y: [0, -1.5, 0] }} transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut', delay: 0.3 }} className="w-1 h-1 bg-current rounded-full block" />
                          </span>
                        </span>
                      </motion.div>
                   ) : (
                      <p className={`text-[13px] font-medium truncate w-full ${getChatSubtext() === 'online' ? 'text-blue-600 dark:text-blue-400 capitalize' : 'text-slate-600 dark:text-slate-400'}`}>{getChatSubtext()}</p>
                   )}
                 </div>
               </button>
            </div>
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
               {chat.pinnedMessage && (
                 <button onClick={() => setShowPinnedMessage(!showPinnedMessage)} className={`w-9 h-9 md:w-10 md:h-10 flex flex-shrink-0 items-center justify-center rounded-full transition-colors ${showPinnedMessage ? 'text-blue-600 bg-blue-50/50 dark:bg-blue-500/20' : 'text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-white/10'}`}>
                     <Pin className="w-4 h-4 md:w-5 md:h-5" />
                 </button>
               )}
               <button onClick={() => setIsSearching(!isSearching)} className={`w-9 h-9 md:w-10 md:h-10 flex flex-shrink-0 items-center justify-center rounded-full transition-colors ${isSearching ? 'text-blue-600 bg-blue-50/50 dark:bg-blue-500/20' : 'text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-white/10'}`}>
                   <Search className="w-4 h-4 md:w-5 md:h-5" />
               </button>
            {currentUser && chat.type === 'direct' && chat.members.find(m => m !== currentUser.uid) && profiles[chat.members.find(m => m !== currentUser.uid)!] && canCall(currentUser.uid, profiles[chat.members.find(m => m !== currentUser.uid)!], [chat]) && (
              <>
                <button onClick={() => startCall(chat.id, chat.members.find(m => m !== currentUser.uid)!, 'audio')} className="flex w-9 h-9 md:w-10 md:h-10 flex-shrink-0 items-center justify-center text-blue-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
                    <Phone className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button onClick={() => startCall(chat.id, chat.members.find(m => m !== currentUser.uid)!, 'video')} className="flex w-9 h-9 md:w-10 md:h-10 flex-shrink-0 items-center justify-center text-blue-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
                    <Video className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </>
            )}
            {chat.type === 'group' && (
              <>
                <button onClick={() => startCall(chat.id, '', 'audio', true)} className="flex w-9 h-9 md:w-10 md:h-10 flex-shrink-0 items-center justify-center text-blue-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
                    <Phone className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button onClick={() => startCall(chat.id, '', 'video', true)} className="flex w-9 h-9 md:w-10 md:h-10 flex-shrink-0 items-center justify-center text-blue-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
                    <Video className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </>
            )}
            <button onClick={() => setShowGroupInfo(!showGroupInfo)} className={`flex w-9 h-9 md:w-10 md:h-10 flex-shrink-0 items-center justify-center rounded-full transition-colors ${showGroupInfo ? 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'text-blue-500 hover:bg-slate-100 dark:hover:bg-white/10'}`}>
                <Info className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <div className="relative">
              <button onClick={() => setShowChatMenu(!showChatMenu)} className={`w-9 h-9 md:w-10 md:h-10 flex flex-shrink-0 items-center justify-center rounded-full transition-colors ${showChatMenu ? 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'}`}>
                  <MoreHorizontal className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              <AnimatePresence>
                {showChatMenu && (
                  <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowChatMenu(false)} className="fixed inset-0 z-40" />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: -10 }} 
                      animate={{ opacity: 1, scale: 1, y: 0 }} 
                      exit={{ opacity: 0, scale: 0.95, y: -10 }} 
                      className="absolute right-0 top-[110%] w-48 bg-white dark:bg-[#1c1c1e] rounded-xl shadow-xl border border-slate-200 dark:border-white/10 overflow-hidden z-50 py-1"
                    >
                      <button 
                        onClick={() => {
                          if (confirm('Are you sure you want to clear the chat history? This will delete all messages for all participants and cannot be undone.')) {
                            clearChatHistory(chat.id);
                            setShowChatMenu(false);
                          }
                        }} 
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear Chat History
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this chat? This cannot be undone.')) {
                            deleteChat(chat.id);
                            setShowChatMenu(false);
                            if (onBack) onBack();
                          }
                        }} 
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2 border-t border-slate-100 dark:border-white/5"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Chat
                      </button>
                      {chat.type === 'direct' && (
                        <button 
                          onClick={() => {
                            const otherId = chat.members.find((m: string) => m !== currentUser.uid);
                            if (!otherId) return;
                            const isBlocked = profiles[currentUser.uid]?.blockedUsers?.includes(otherId);
                            if (isBlocked) {
                                import('../hooks/useFirestore').then(m => m.unblockUser(otherId));
                            } else {
                                if (confirm('Are you sure you want to block this user?')) {
                                  blockUser(otherId);
                                  setShowChatMenu(false);
                                }
                            }
                          }} 
                          className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2 border-t border-slate-100 dark:border-white/5"
                        >
                          <User className="w-4 h-4" />
                          {profiles[currentUser.uid]?.blockedUsers?.includes(chat.members.find((m: string) => m !== currentUser.uid) || '') ? 'Unblock User' : 'Block User'}
                        </button>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
         </div>
      </div>
      </div>
      
      {/* Search Bar & Pinned message */}
      <AnimatePresence>
         {(isSearching || showPinnedMessage || (activeGroupCall && (!activeCall || activeCall.id !== chat.id))) && (
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="absolute top-[68px] md:top-[88px] left-2 right-2 md:left-4 md:right-4 z-20 pointer-events-none flex flex-col items-center gap-2">
               {isSearching && (
                 <div className="w-full max-w-lg pointer-events-auto bg-white/30 dark:bg-white/10 backdrop-blur-[40px] bg-gradient-to-br from-white/40 to-white/10 dark:from-white/10 dark:to-white/5 px-3 py-2 rounded-2xl border border-white/50 dark:border-white/20 shadow-[0_8px_32px_rgba(31,38,135,0.15)] ring-1 ring-white/50 dark:ring-white/10">
                   <div className="relative">
                     <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                     <input type="text" placeholder="Search messages..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="w-full bg-white/50 dark:bg-black/50 pl-9 pr-4 py-1.5 rounded-xl text-sm border border-white/30 dark:border-white/5 outline-none focus:ring-2 focus:ring-blue-500/50 dark:text-white transition-all shadow-inner" />
                   </div>
                 </div>
               )}
               {showPinnedMessage && chat.pinnedMessage && (
                 <div 
                   onClick={() => {
                     document.getElementById(`msg-${chat.pinnedMessage?.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                   }}
                   className="w-full max-w-md pointer-events-auto px-4 py-3 bg-white/30 dark:bg-white/10 backdrop-blur-[40px] bg-gradient-to-br from-white/40 to-white/10 dark:from-white/10 dark:to-white/5 border border-white/50 dark:border-white/20 rounded-[32px] shadow-[0_8px_32px_rgba(31,38,135,0.15)] ring-1 ring-white/50 dark:ring-white/10 flex items-center gap-3 cursor-pointer hover:bg-white/40 dark:hover:bg-white/20 transition-all"
                 >
                    <div className="w-8 h-8 rounded-full bg-blue-100/80 dark:bg-blue-500/20 flex items-center justify-center shrink-0 shadow-sm border border-white/50 dark:border-white/5">
                      <Pin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">Pinned by {chat.pinnedMessage.senderName}</div>
                       <div className="text-[13px] text-slate-800 dark:text-slate-200 truncate font-medium">{chat.pinnedMessage.text}</div>
                    </div>
                 </div>
               )}
               {chat.type === 'group' && activeGroupCall && (!activeCall || activeCall.id !== chat.id) && (
                 <div 
                   className="w-full max-w-md pointer-events-auto px-4 py-3 bg-emerald-500/10 dark:bg-emerald-500/20 backdrop-blur-[40px] border border-emerald-500/30 rounded-[32px] shadow-[0_8px_32px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20 flex items-center gap-3"
                 >
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0 shadow-sm border border-emerald-500/30 animate-pulse">
                      <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 fill-current animate-bounce" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                       <div className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">Live Group Calling</div>
                       <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium truncate">
                         {activeGroupCall.participants?.length || 1} participant(s) talking now.
                       </div>
                    </div>
                    <button
                      onClick={() => joinGroupCall(chat.id, activeGroupCall.type)}
                      className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full text-xs font-bold shadow-md shadow-emerald-500/20 transition-all hover:scale-105 pointer-events-auto"
                    >
                      Join {activeGroupCall.type === 'video' ? 'Video' : 'Call'}
                    </button>
                 </div>
               )}
            </motion.div>
         )}
      </AnimatePresence>
      
      {/* Messages */}
      <div 
        className={`flex-1 overflow-y-auto px-4 md:px-6 pb-[160px] space-y-6 relative z-10 ${
          (isSearching && showPinnedMessage && activeGroupCall) ? 'pt-[310px]' :
          ((isSearching && showPinnedMessage) || (isSearching && activeGroupCall) || (showPinnedMessage && activeGroupCall)) ? 'pt-[240px]' :
          (isSearching || showPinnedMessage || activeGroupCall) ? 'pt-[160px] md:pt-[180px]' : 'pt-[90px] md:pt-[100px]'
        }`} 
        ref={scrollRef}
      >
        {displayMessages.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-full text-center space-y-4"
          >
             <div className="w-20 h-20 bg-white/50 backdrop-blur-2xl shadow-xl shadow-black/5 dark:bg-[#1a1a1c]/50 rounded-[32px] flex items-center justify-center text-slate-800 dark:text-slate-200 border border-white/40 dark:border-white/10">
                 <MessageSquare className="w-8 h-8" />
             </div>
             <div>
                <h3 className="text-slate-900 dark:text-white font-bold text-lg">Say Hello!</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Send a message to start the conversation.</p>
             </div>
          </motion.div>
        )}
        <AnimatePresence>
          {displayMessages.map((msg, i) => {
            const isMe = msg.senderId === currentUser.uid;
            const sender = profiles[msg.senderId];
            const showAvatar = chat.type === 'group' && !isMe;
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                layout
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                 <div className={`flex max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                    {showAvatar ? (
                      sender && currentUser && getProfilePhoto(currentUser.uid, sender, [chat]) ? (
                        <img src={getProfilePhoto(currentUser.uid, sender, [chat])} alt="Avatar" className="w-6 h-6 rounded-full mb-1 shrink-0" />
                      ) : (
                        <div className="w-6 h-6 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mb-1">
                          {sender?.displayName?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )
                    ) : (
                      !isMe && chat.type === 'group' && <div className="w-6 shrink-0" />
                    )}
                    
                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {showAvatar && (
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 ml-2">{sender?.displayName}</span>
                      )}
                      <div className={`flex items-end gap-2 group/msg ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div 
                          onClick={() => setActiveMsgId(activeMsgId === msg.id ? null : msg.id)}
                          className={`px-4 py-3 relative group text-[15px] leading-relaxed cursor-pointer transition-all ${
                          isMe 
                            ? `bg-[#0b57d0] dark:bg-[#a8c7fa] text-white dark:text-[#062e6f] shadow-sm ${bubbleStyle === 'rounded' ? 'rounded-[20px] rounded-br-sm' : 'rounded-2xl'}` 
                            : `bg-slate-100 dark:bg-[#1f1f1f] text-[#1f1f1f] dark:text-[#e3e3e3] border-none shadow-sm ${bubbleStyle === 'rounded' ? 'rounded-[20px] rounded-bl-sm' : 'rounded-2xl'}`
                        }`}>
                          {msg.replyTo && (
                            <div className={`mb-3 p-2.5 rounded-xl text-[13px] border-l-[3px] cursor-pointer transition-colors ${isMe ? 'bg-black/10 dark:bg-black/10 border-white/60 dark:border-[#062e6f]/60 text-white/90 dark:text-[#062e6f]/90' : 'bg-slate-200/50 dark:bg-[#2d2d2d] border-[#0b57d0] dark:border-[#a8c7fa] text-[#444746] dark:text-[#c4c7c5]'}`}>
                              <div className="font-medium text-[11px] mb-0.5 tracking-wide opacity-80">{msg.replyTo.senderName}</div>
                              <div className="truncate opacity-80">{msg.replyTo.text}</div>
                            </div>
                          )}
                          {msg.attachment?.type === 'image' && msg.attachment.url && (
                            <div className="mb-2 -mx-1 -mt-1 overflow-hidden rounded-xl cursor-pointer" onClick={() => setActiveLightboxImage(msg.attachment!.url)}>
                              <img src={msg.attachment.url} alt="Attachment" className="w-full max-w-[280px] h-auto object-cover" />
                            </div>
                          )}
                          {msg.attachment?.type === 'audio' ? (
                            <AudioMessage src={msg.attachment.url} duration={msg.attachment.duration} />
                          ) : (
                            <div className="flex flex-col gap-1">
                              {msg.text && <span className="whitespace-pre-wrap word-break">{msg.text}</span>}
                              {isTranslating[msg.id] && (
                                <div className="mt-1 pt-1 border-t border-black/10 dark:border-white/10 text-[12px] opacity-70 italic flex items-center gap-2">
                                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                  Translating...
                                </div>
                              )}
                              {translations[msg.id] && (
                                <div className="mt-1 pt-1 border-t border-black/10 dark:border-white/10 text-[14px] opacity-90 whitespace-pre-wrap word-break">
                                  {translations[msg.id]}
                                </div>
                              )}
                            </div>
                          )}
                          <div className={`text-[10px] mt-1 text-right flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity absolute ${isMe ? '-left-16 bottom-2 font-medium text-slate-400' : '-right-16 bottom-2 font-medium text-slate-400'}`}>
                            {getMessageTime(msg.createdAt)}
                            {msg.editedAt && <span className="italic ml-0.5">(edited)</span>}
                            {isMe && isMessageReadByOther(msg) && <CheckCheck className="w-3 h-3 text-blue-500 ml-0.5" />}
                          </div>
                          
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className={`absolute -bottom-2 ${isMe ? 'right-2' : 'left-2'} bg-slate-50 dark:bg-[#2c2c2e] border border-slate-200 dark:border-white/10 rounded-full px-1.5 py-0.5 text-xs flex items-center gap-0.5 shadow-sm`}>
                              {Array.from(new Set(Object.values(msg.reactions))).map(emoji => (
                                <span key={emoji} className="text-[12px]">{emoji}</span>
                              ))}
                              <span className="text-[10px] text-slate-500 font-medium ml-0.5 pr-0.5">{Object.keys(msg.reactions).length}</span>
                            </div>
                          )}
                        </div>

                        <div className={`flex items-center gap-0.5 transition-opacity bg-white dark:bg-[#1c1c1e] rounded-full p-1 border border-slate-200 dark:border-white/5 shadow-sm mb-2 shrink-0 ${activeMsgId === msg.id ? 'opacity-100' : 'opacity-0 md:group-hover/msg:opacity-100'}`}>
                          <button onClick={() => handleReaction(msg.id, '👍', msg.reactions)} className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-[13px]">👍</button>
                          <button onClick={() => handleReaction(msg.id, '❤️', msg.reactions)} className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-[13px]">❤️</button>
                          <button onClick={() => handleTranslate(msg)} className={`w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 rounded-full ${translations[msg.id] ? 'text-blue-500' : 'text-slate-400'}`} title="Translate"><Languages className="w-3.5 h-3.5" /></button>
                          {msg.text && <button onClick={() => speakMessage(msg.text)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-full" title="Read Aloud"><Volume2 className="w-3.5 h-3.5" /></button>}
                          <button onClick={() => handleReply(msg)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-full"><Reply className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setForwardingMsg(msg)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-full"><Share className="w-3 h-3" /></button>
                          <button onClick={() => handlePin(msg)} className={`w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 rounded-full ${chat.pinnedMessage?.id === msg.id ? 'text-blue-500' : 'text-slate-400'}`}><Pin className="w-3 h-3" /></button>
                          {isMe && (
                            <>
                              <button onClick={() => handleEdit(msg)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-full"><Edit2 className="w-3 h-3" /></button>
                              <button onClick={() => deleteMessage(chat.id, msg.id)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full"><Trash2 className="w-3 h-3" /></button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                 </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        <AnimatePresence>
          {activeTypers.length > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9, originY: 1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, originY: 1 }} className="flex justify-start mt-4">
              <div className="flex bg-slate-100 dark:bg-[#1c1c1e] text-slate-500 rounded-[20px] rounded-bl-sm py-3 px-4 shadow-sm relative group items-center">
                <span className="flex gap-1.5 items-center h-2">
                  <motion.span animate={{ opacity: [0.4, 1, 0.4], y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut', delay: 0 }} className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full block" />
                  <motion.span animate={{ opacity: [0.4, 1, 0.4], y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut', delay: 0.2 }} className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full block" />
                  <motion.span animate={{ opacity: [0.4, 1, 0.4], y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut', delay: 0.4 }} className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full block" />
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="h-4" />
      </div>

      <div className="absolute bottom-2 left-2 right-2 md:bottom-4 md:left-4 md:right-4 pointer-events-none z-20 flex flex-col gap-2">
         {(replyingTo || editingMsg || attachment) && (
           <div className="max-w-4xl mx-auto w-full flex items-center justify-between pointer-events-auto bg-white/30 dark:bg-white/10 backdrop-blur-[40px] bg-gradient-to-br from-white/40 to-white/10 dark:from-white/10 dark:to-white/5 px-4 py-2 border border-white/50 dark:border-white/20 rounded-2xl shadow-[0_8px_32px_rgba(31,38,135,0.15)] ring-1 ring-white/50 dark:ring-white/10">
             <div className="flex flex-col flex-1 min-w-0 pr-4">
               {attachment ? (
                 <div className="flex items-center gap-2">
                   <img src={attachment.url} alt="Preview" className="w-10 h-10 object-cover rounded-md" />
                   <span className="text-[13px] text-slate-700 dark:text-slate-300 truncate">
                     {attachment.file.name}
                   </span>
                 </div>
               ) : (
                 <>
                   <div className="flex items-center gap-2">
                     <span className="text-[12px] font-semibold text-blue-600 dark:text-blue-400">
                       {editingMsg ? 'Edit Message' : `Replying to ${profiles[replyingTo!.senderId]?.displayName || 'Unknown'}`}
                     </span>
                   </div>
                   <span className="text-[13px] text-slate-700 dark:text-slate-300 truncate">
                     {editingMsg ? editingMsg.text : replyingTo?.text}
                   </span>
                 </>
               )}
             </div>
             <button type="button" onClick={() => { handleCancelAction(); setAttachment(null); }} className="p-1.5 hover:bg-white/50 dark:hover:bg-white/10 rounded-full text-slate-500 transition-colors">
               <X className="w-4 h-4" />
             </button>
           </div>
         )}
         <div className="max-w-4xl mx-auto w-full relative pointer-events-auto">
         {chat.type === 'direct' && profiles[currentUser.uid]?.blockedUsers?.includes(chat.members.find((m: string) => m !== currentUser.uid) || '') ? (
           <div className="w-full bg-white/40 dark:bg-[#1a1a1c]/60 backdrop-blur-3xl border border-white/40 dark:border-white/10 rounded-[32px] px-5 py-4 text-center shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
             <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">You have blocked this user. Unblock to send messages.</p>
           </div>
         ) : chat.type === 'direct' && profiles[chat.members.find((m: string) => m !== currentUser.uid) || '']?.blockedUsers?.includes(currentUser.uid) ? (
           <div className="w-full bg-white/40 dark:bg-[#1a1a1c]/60 backdrop-blur-3xl border border-white/40 dark:border-white/10 rounded-[32px] px-5 py-4 text-center shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
             <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">You cannot reply to this conversation.</p>
           </div>
         ) : (
         <form onSubmit={handleSend} className="w-full flex items-end gap-3 h-auto relative">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={e => {
             const file = e.target.files?.[0];
             if (!file) return;
             const reader = new FileReader();
             reader.onload = () => {
               setAttachment({ file, url: reader.result as string, type: file.type.startsWith('image/') ? 'image' : 'video' });
             };
             reader.readAsDataURL(file);
             e.target.value = '';
           }} />
           {isRecording ? (
             <div className="flex-1 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-[24px] px-4 py-[10px] flex items-center justify-between shadow-sm my-[2px]">
               <div className="flex items-center gap-3">
                 <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                 <span className="text-red-500 font-medium font-mono">
                   {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                 </span>
               </div>
               <button type="button" onClick={cancelRecording} className="text-slate-500 hover:text-red-500 text-sm font-medium mr-2">Cancel</button>
             </div>
           ) : (
             <div className={`flex-1 backdrop-blur-[40px] bg-gradient-to-br from-white/40 to-white/10 dark:from-white/10 dark:to-white/5 border rounded-[32px] px-4 md:px-5 py-2 md:py-3 transition-all duration-300 flex items-center ring-1 shadow-[0_8px_32px_rgba(31,38,135,0.15)] relative ${isGeneratingReply ? 'border-blue-400/50 dark:border-blue-500/50 ring-blue-400/50 shadow-[0_0_20px_rgba(59,130,246,0.2)] bg-white/50 dark:bg-[#1a1a1c]/80' : 'border-white/50 dark:border-white/20 ring-white/50 dark:ring-white/10 bg-white/30 dark:bg-white/10 focus-within:bg-white/40 dark:focus-within:bg-[#1a1a1c]/60'}`}>
               <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors mr-2 shrink-0">
                 <Paperclip className="w-5 h-5" />
               </button>
               <textarea 
                 value={text}
                 onChange={handleTextChange}
                 placeholder={isGeneratingReply && text.length === 0 ? "✨ Thinking..." : "Message..."}
                 className={`w-full bg-transparent border-none text-slate-900 dark:text-white focus:outline-none focus:ring-0 text-[15px] resize-none max-h-32 min-h-[22px] transition-all duration-300 ${isGeneratingReply && text.length === 0 ? 'animate-pulse text-blue-500 dark:text-blue-400 placeholder:text-blue-500/70 dark:placeholder:text-blue-400/70 tracking-wide font-medium' : 'placeholder-slate-400 dark:placeholder-slate-500'}`}
                 rows={1}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' && !e.shiftKey) {
                     e.preventDefault();
                     handleSend(e);
                   }
                 }}
               />
               <button 
                 type="button" 
                 onClick={handleMagicReply} 
                 disabled={isGeneratingReply}
                 className={`p-1 transition-colors ml-1 ${isGeneratingReply ? 'text-blue-500 animate-pulse' : 'text-slate-400 hover:text-blue-500 dark:hover:text-blue-400'}`}
                 title="AI Magic Reply"
               >
                 <Sparkles className={`w-5 h-5 ${isGeneratingReply ? 'animate-pulse drop-shadow-[0_0_8px_rgba(59,130,246,0.6)] text-blue-500 scale-110' : ''}`} />
               </button>
               <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors ml-1 relative">
                 <Smile className="w-5 h-5" />
               </button>
             </div>
           )}
           
           <AnimatePresence>
             {showEmojiPicker && (
               <motion.div 
                 initial={{ opacity: 0, y: 10, scale: 0.95 }}
                 animate={{ opacity: 1, y: 0, scale: 1 }}
                 exit={{ opacity: 0, y: 10, scale: 0.95 }}
                 className="absolute bottom-[calc(100%+12px)] right-10 z-[100] shadow-2xl rounded-xl overflow-hidden border border-slate-200 dark:border-white/10"
               >
                  <EmojiPicker 
                    onEmojiClick={(emojiData) => setText(prev => prev + emojiData.emoji)}
                    theme={myProfile?.settings?.theme === 'dark' ? 'dark' as any : (myProfile?.settings?.theme === 'light' ? 'light' as any : 'auto' as any)}
                  />
               </motion.div>
             )}
           </AnimatePresence>
           
           {isRecording ? (
             <button 
               type="button" 
               onClick={stopRecording}
               className="w-11 h-11 mb-0.5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors shrink-0 cursor-pointer"
             >
               <Send className="w-[18px] h-[18px] -ml-[1px] mt-[1px]" />
             </button>
           ) : text.trim() ? (
             <button 
               type="submit"
               className="w-[42px] h-[42px] mb-0.5 bg-[#0b57d0] dark:bg-[#a8c7fa] text-white dark:text-[#062e6f] rounded-full flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer"
             >
               <Send className="w-[18px] h-[18px] -ml-0.5" />
             </button>
           ) : (
             <button 
               type="button"
               onClick={startRecording}
               className="w-11 h-11 mb-0.5 bg-white/50 backdrop-blur hover:bg-white dark:bg-black/20 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-full flex items-center justify-center shadow-sm border border-slate-200/50 dark:border-white/5 transition-all shrink-0"
             >
               <Mic className="w-5 h-5" />
             </button>
           )}
         </form>
         )}
         </div>
      </div>

      <AnimatePresence>
        {forwardingMsg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
             <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-sm bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
               <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Forward Message</h3>
                  <button onClick={() => setForwardingMsg(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-500"><X className="w-5 h-5"/></button>
               </div>
               <div className="overflow-y-auto p-2">
                 {chats.map(c => {
                   let name = c.name || 'Group Chat';
                   let photo = null;
                   if (c.type === 'direct') {
                      const otherId = c.members.find(m => m !== currentUser.uid);
                      name = profiles[otherId!]?.displayName || 'Unknown';
                      photo = otherId && profiles[otherId] ? getProfilePhoto(currentUser.uid, profiles[otherId], [c]) : null;
                   }
                   return (
                     <button
                        key={c.id}
                        onClick={async () => {
                           await forwardMessage(c.id, forwardingMsg, c.type, name);
                           setForwardingMsg(null);
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors text-left"
                     >
                       {photo ? <img src={photo} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center font-semibold text-slate-500">{name.charAt(0)}</div>}
                       <span className="font-medium text-slate-900 dark:text-white flex-1 min-w-0 truncate">{name}</span>
                     </button>
                   );
                 })}
               </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGroupInfo && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowGroupInfo(false)} className="absolute inset-0 z-40 bg-black/20 dark:bg-black/40 xl:hidden" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-[#1c1c1e] shadow-2xl z-50 border-l border-slate-200 dark:border-white/10 flex flex-col">
              <div className="h-[72px] border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-6 shrink-0">
                <h3 className="font-semibold text-slate-900 dark:text-white">{chat.type === 'group' ? 'Group Profile' : 'Contact Info'}</h3>
                <button onClick={() => setShowGroupInfo(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-500 transition-colors"><X className="w-5 h-5"/></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="p-6 flex flex-col items-center border-b border-slate-200 dark:border-white/10 relative">
                  {chat.type === 'group' && (
                    <button onClick={() => { setIsEditingGroup(!isEditingGroup); setGroupEditName(chatName); setGroupEditPhoto(chat.photoURL || null); }} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-full text-slate-500 transition-colors">
                      <Edit className="w-4 h-4"/>
                    </button>
                  )}
                  <div className="w-24 h-24 bg-slate-200 dark:bg-[#2c2c2e] text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center font-semibold text-4xl mb-4 overflow-hidden relative group">
                    {chat.type === 'group' ? (
                      (isEditingGroup ? groupEditPhoto : chat.photoURL) ? <img src={(isEditingGroup ? groupEditPhoto : chat.photoURL) as string} className="w-full h-full object-cover" /> : (isEditingGroup ? groupEditName : chatName).charAt(0).toUpperCase()
                    ) : (
                      chatPhoto ? <img src={chatPhoto} className="w-full h-full object-cover" /> : chatName.charAt(0).toUpperCase()
                    )}
                    
                    {isEditingGroup && chat.type === 'group' && (
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                        <label className="cursor-pointer bg-white/20 hover:bg-white/30 text-white rounded-full p-1.5 transition-colors">
                           <Camera className="w-4 h-4" />
                           <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                             const file = e.target.files?.[0];
                             if(!file) return;
                             const reader = new FileReader();
                             reader.onload = () => setGroupEditPhoto(reader.result as string);
                             reader.readAsDataURL(file);
                           }} />
                        </label>
                        {groupEditPhoto && (
                          <button type="button" onClick={() => setGroupEditPhoto(null)} className="bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1.5 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {isEditingGroup && chat.type === 'group' ? (
                    <div className="w-full flex gap-2">
                       <input value={groupEditName} onChange={e=>setGroupEditName(e.target.value)} className="flex-1 bg-slate-100 dark:bg-[#2c2c2e] text-slate-900 dark:text-white rounded-xl px-3 py-1 text-sm outline-none" />
                       <button onClick={async () => { await updateGroupProfile(chat.id, groupEditName, groupEditPhoto); setIsEditingGroup(false); }} className="px-3 bg-blue-500 text-white rounded-xl text-sm font-medium">Save</button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white text-center break-words">{chatName}</h2>
                      {chat.type === 'group' ? (
                         <p className="text-slate-500 text-sm mt-1">{chat.members.length} members</p>
                      ) : (
                         <p className="text-slate-500 text-sm mt-1">{profiles[chat.members.find(m => m !== currentUser.uid)!]?.email}</p>
                      )}
                    </>
                  )}
                </div>
                {chat.type === 'group' ? (
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Members</h4>
                      <button onClick={() => setIsAddingMember(!isAddingMember)} className="p-1 rounded bg-blue-50 text-blue-500 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-colors">
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {isAddingMember && (
                      <div className="mb-4 bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-200 dark:border-white/10">
                         <h5 className="text-xs font-medium text-slate-500 mb-2">Add a friend to group</h5>
                         <div className="space-y-2 max-h-40 overflow-y-auto">
                           {Object.values(profiles).filter(p => p.userId !== currentUser.uid && !chat.members.includes(p.userId)).map(p => {
                              const pPhoto = getProfilePhoto(currentUser.uid, p, [chat]);
                              return (
                                <button key={p.userId} onClick={async () => { await addMemberToGroup(chat.id, chat.members, p.userId); setIsAddingMember(false); }} className="w-full flex items-center gap-2 p-2 hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-lg text-left">
                                   <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs overflow-hidden">
                                     {pPhoto ? <img src={pPhoto} className="w-full h-full object-cover"/> : p.displayName.charAt(0)}
                                   </div>
                                   <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate flex-1">{p.displayName}</span>
                                </button>
                              );
                           })}
                           {Object.values(profiles).filter(p => p.userId !== currentUser.uid && !chat.members.includes(p.userId)).length === 0 && (
                             <div className="text-xs text-slate-500 text-center py-2">No new friends to add</div>
                           )}
                         </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {chat.members.map((memberId: string) => {
                        const isMe = memberId === currentUser.uid;
                        const profile = profiles[memberId];
                        const memberPhoto = profile && getProfilePhoto(currentUser.uid, profile, [chat]);
                        return (
                          <div key={memberId} className="flex items-center gap-3 group/member">
                            {memberPhoto ? (
                              <img src={memberPhoto} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-10 h-10 bg-slate-200 dark:bg-[#2c2c2e] text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center font-semibold text-lg shrink-0">
                                {(profile?.displayName || 'U').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-900 dark:text-white truncate text-[15px]">{isMe ? 'You' : (profile?.displayName || 'Unknown')}</div>
                              {profile?.status === 'online' && <div className="text-[12px] text-blue-500">Online</div>}
                            </div>
                            {!isMe && (
                              <button onClick={() => removeMemberFromGroup(chat.id, chat.members, memberId)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full opacity-0 group-hover/member:opacity-100 transition-all">
                                <Trash2 className="w-4 h-4"/>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-6">
                     <div className="space-y-4">
                        <div className="bg-slate-50 dark:bg-[#2c2c2e] p-4 rounded-xl">
                          <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">About</h4>
                          <p className="text-sm text-slate-800 dark:text-slate-200">{profiles[chat.members.find(m => m !== currentUser.uid)!]?.bio || "Hey there! I am using this app."}</p>
                        </div>
                        {profiles[chat.members.find(m => m !== currentUser.uid)!]?.phoneNumber && (
                          <div className="bg-slate-50 dark:bg-[#2c2c2e] p-4 rounded-xl">
                            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Phone</h4>
                            <p className="text-sm text-slate-800 dark:text-slate-200">{profiles[chat.members.find(m => m !== currentUser.uid)!]?.phoneNumber}</p>
                          </div>
                        )}
                        <div className="bg-slate-50 dark:bg-[#2c2c2e] p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                           <div className="flex items-center gap-3">
                              <div className="p-1.5 bg-blue-100 dark:bg-blue-500/20 text-blue-500 rounded-lg">
                                <Search className="w-4 h-4" />
                              </div>
                              <span className="font-medium text-slate-800 dark:text-white">Search in Chat</span>
                           </div>
                        </div>
                     </div>
                  </div>
                )}
              </div>
              {chat.type === 'group' && (
                <div className="p-6 border-t border-slate-200 dark:border-white/10">
                  <button onClick={() => removeMemberFromGroup(chat.id, chat.members, currentUser.uid)} className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors font-medium">
                    <Trash2 className="w-4 h-4"/>
                    Leave Group
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeLightboxImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-sm"
          >
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-3 z-20">
              <button 
                onClick={() => setActiveLightboxImage(null)}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              src={activeLightboxImage} 
              alt="Expanded"
              className="max-w-full max-h-full object-contain rounded-sm transition-all duration-300"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
