import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Send,
  Users,
  Info,
  Phone,
  Video,
  MessageSquare,
  Reply,
  Edit2,
  Trash2,
  Smile,
  X,
  ArrowLeft,
  Pin,
  Search,
  Share,
  Check,
  CheckCheck,
  Edit,
  UserPlus,
  Paperclip,
  Mic,
  Image as ImageIcon,
  Camera,
  File,
  MapPin,
  User,
  BarChart2,
  MoreHorizontal,
  Languages,
  Volume2,
  Sparkles,
  CheckSquare,
  Bookmark,
  Clock,
  Eye,
  EyeOff,
  Layout,
  History,
  Shield,
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import confetti from "canvas-confetti";
import { auth, db, storage } from "../firebase";
import { doc, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { generateVideoThumbnailAndDuration, formatVideoDuration } from "../utils/videoUtils";
import VideoMessageCard from "./video/VideoMessageCard";
import {
  useMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
  togglePinMessage,
  markChatRead,
  setChatTypingStatus,
  setBotTypingStatus,
  useChats,
  forwardMessage,
  removeMemberFromGroup,
  updateGroupProfile,
  addMemberToGroup,
  clearChatHistory,
  deleteChat,
  blockUser,
  getTimestampMillis,
} from "../hooks/useFirestore";
import { useCallSystem } from "../providers/CallProvider";
import { UserProfile, Chat, Message } from "../types";
import {
  canViewLastSeen,
  canCall,
  getProfilePhoto,
  canSendReadReceipts,
} from "../utils/privacy";
import { format, formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import { DynamicScenery } from "./DynamicScenery";
import { ConfirmModal } from "./ConfirmModal";
import { NewPollModal } from "./NewPollModal";
import { ViewOnceViewer } from "./ViewOnceViewer";

function AudioMessage({ src, duration }: { src?: string; duration?: number }) {
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
          alert(`Cannot play audio: ${err?.message || "Unsupported format"}`);
        }
      }
    }
  };

  return (
    <div className="flex items-center gap-3 bg-black/5 dark:bg-white/10 rounded-full py-1.5 px-3 min-w-[160px]">
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0"
      >
        {isPlaying ? (
          <div className="w-2.5 h-2.5 bg-white rounded-sm" />
        ) : (
          <div className="w-0 h-0 border-t-4 border-t-transparent border-l-6 border-l-white border-b-4 border-b-transparent ml-1" />
        )}
      </button>
      <div className="flex-1">
        <div className="h-1 w-full bg-black/10 dark:bg-white/20 rounded-full relative">
          <div
            className={`absolute left-0 top-0 bottom-0 bg-blue-500 rounded-full transition-all ${isPlaying ? "w-full duration-[10000ms] ease-linear" : "w-0"}`}
          ></div>
        </div>
      </div>
      <span className="text-[11px] font-medium font-mono min-w-[30px]">
        {duration
          ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")}`
          : "0:00"}
      </span>
    </div>
  );
}

export function ChatView({
  chat,
  profiles,
  onBack,
  presetText,
  onClearPreset,
  externalSearchQuery,
  onClearSearchQuery,
  isFocusMode,
  onToggleFocusMode,
}: {
  chat?: Chat;
  profiles: Record<string, UserProfile>;
  onBack?: () => void;
  presetText?: string;
  onClearPreset?: () => void;
  externalSearchQuery?: string;
  onClearSearchQuery?: () => void;
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
}) {
  const { startCall, joinGroupCall, activeCall } = useCallSystem();

  const triggerHaptic = (pattern: number | number[] = 50) => {
    const hapticsEnabled =
      currentUser &&
      profiles[currentUser.uid]?.settings?.hapticsEnabled !== false;
    if (hapticsEnabled && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const currentUser = auth.currentUser;
  const messages = useMessages(chat?.id || null);
  const chats = useChats();
  const userJustSentMessageRef = useRef<boolean>(false);
  const [text, setText] = useState("");

  useEffect(() => {
    if (presetText) {
      setText(presetText);
      if (onClearPreset) {
        onClearPreset();
      }
    }
  }, [presetText, onClearPreset]);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null,
  );
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const [attachment, setAttachment] = useState<{
    file: File;
    url: string;
    type: "image" | "video" | "file";
    thumbnailUrl?: string;
    duration?: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // High-Speed resilient video upload & tasks tracking
  const uploadTasksRef = useRef<Record<string, any>>({});
  const uploadFilesRef = useRef<Record<string, File>>({});
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeGroupCall, setActiveGroupCall] = useState<any | null>(null);

  // Background resumable and cancellable video uploader
  const startVideoUpload = async (msgId: string, file: File) => {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const videoPath = `chats/${chat.id}/videos/${msgId}_${cleanFileName}`;
    const fileRef = storageRef(storage, videoPath);

    const uploadTask = uploadBytesResumable(fileRef, file);
    uploadTasksRef.current[msgId] = uploadTask;
    uploadFilesRef.current[msgId] = file;

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progressPercent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        const msgDocRef = doc(db, `chats/${chat.id}/messages`, msgId);
        updateDoc(msgDocRef, {
          "attachment.uploadProgress": progressPercent,
          "attachment.uploadStatus": "uploading"
        }).catch((err) => console.error("Error updating firebase progress:", err));
      },
      (error) => {
        console.error("Storage upload failed:", error);
        const msgDocRef = doc(db, `chats/${chat.id}/messages`, msgId);
        updateDoc(msgDocRef, {
          "attachment.uploadStatus": "failed",
          "attachment.uploadProgress": 0
        }).catch((err) => console.error(err));
        delete uploadTasksRef.current[msgId];
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          const msgDocRef = doc(db, `chats/${chat.id}/messages`, msgId);
          await updateDoc(msgDocRef, {
            "attachment.url": downloadUrl,
            "attachment.uploadStatus": "completed",
            "attachment.uploadProgress": 100
          });
        } catch (err) {
          console.error("Failed to finalize upload metadata:", err);
        }
        delete uploadTasksRef.current[msgId];
      }
    );
  };

  const handleCancelUpload = async (msgId: string) => {
    const task = uploadTasksRef.current[msgId];
    if (task) {
      try {
        task.cancel();
      } catch (err) {
        console.error("Task cancellation err:", err);
      }
      delete uploadTasksRef.current[msgId];
    }
    try {
      await deleteMessage(chat.id, msgId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRetryUpload = (msgId: string) => {
    const file = uploadFilesRef.current[msgId];
    if (file) {
      startVideoUpload(msgId, file);
    }
  };

  // Drag and Drop callbacks
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (navigator.vibrate) navigator.vibrate(40);

    if (file.type.startsWith("video/")) {
      try {
        const { thumbnailUrl, duration } = await generateVideoThumbnailAndDuration(file);
        setAttachment({
          file,
          url: URL.createObjectURL(file),
          type: "video",
          thumbnailUrl,
          duration
        });
      } catch (err) {
        console.error("Thumbnail capture err:", err);
        setAttachment({
          file,
          url: URL.createObjectURL(file),
          type: "video"
        });
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachment({
          file,
          url: reader.result as string,
          type: file.type.startsWith("image/") ? "image" : "file" as any
        });
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (!chat) {
      if (onBack) onBack();
    }
  }, [chat, onBack]);

  if (!chat) return null;

  useEffect(() => {
    if (!chat || chat.type !== "group") {
      setActiveGroupCall(null);
      return;
    }
    const callRef = doc(db, "calls", chat.id);
    const unsub = onSnapshot(
      callRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.status === "calling" || data.status === "accepted") {
            setActiveGroupCall({ id: snap.id, ...data });
          } else {
            setActiveGroupCall(null);
          }
        } else {
          setActiveGroupCall(null);
        }
      },
      (err) => {
        console.warn("Error listening to group call snapshot:", err);
        setActiveGroupCall(null);
      },
    );
    return () => unsub();
  }, [chat?.id, chat?.type]);

  const startRecording = async () => {
    triggerHaptic([50, 50]);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Your browser does not support audio recording.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const types = ["audio/mp4", "audio/webm", "audio/ogg"];
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
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || options?.mimeType || "audio/mp4";
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        const reader = new FileReader();
        reader.onload = async () => {
          const duration = recordingDuration;
          userJustSentMessageRef.current = true;
          await sendMessage(
            chat.id,
            "Voice message",
            chat.type,
            chat.name,
            undefined,
            {
              type: "audio",
              url: reader.result as string,
              duration: duration,
              mimeType: mimeType,
            },
          );
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimer.current = setInterval(() => {
        setRecordingDuration((p) => p + 1);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      alert(
        `Microphone access error: ${err?.message || "Access denied or not available."}`,
      );
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
      mediaRecorder.stream.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
      setMediaRecorder(null);
      if (recordingTimer.current) clearInterval(recordingTimer.current);
    }
  };
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showPinnedMessage, setShowPinnedMessage] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [forwardingMsg, setForwardingMsg] = useState<Message | null>(null);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [groupEditName, setGroupEditName] = useState("");
  const [groupEditPhoto, setGroupEditPhoto] = useState<string | null>(null);
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(
    null,
  );
  const [viewOncePhoto, setViewOncePhoto] = useState<Message | null>(null);

  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [isSuggestingReplies, setIsSuggestingReplies] = useState(false);
  const [showWritingTools, setShowWritingTools] = useState(false);
  const [isRewritingText, setIsRewritingText] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState<Record<string, boolean>>(
    {},
  );

  const [showPollModal, setShowPollModal] = useState(false);
  const [aiRecapLoading, setAiRecapLoading] = useState(false);
  const [aiRecapReport, setAiRecapReport] = useState<any | null>(null);
  const [semanticMatchedIds, setSemanticMatchedIds] = useState<string[]>([]);
  const [semanticSearchActive, setSemanticSearchActive] = useState(false);
  const [semanticSearchLoading, setSemanticSearchLoading] = useState(false);

  const handleTriggerSemanticSearch = async (query: string) => {
    if (!chat || messages.length === 0) return;
    setSemanticSearchLoading(true);
    setSemanticSearchActive(true);
    setSemanticMatchedIds([]);
    try {
      const chatMessagesSummary = messages.map((m) => ({
        id: m.id,
        text: m.text,
        senderId: m.senderId,
      }));
      const res = await fetch("/api/semantic-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatMessagesSummary, query }),
      });
      const data = await res.json();
      if (data.success && data.matchedIds) {
        setSemanticMatchedIds(data.matchedIds);
      } else {
        // Fallback to local keyword search
        const matched = messages
          .filter((m) => m.text?.toLowerCase().includes(query.toLowerCase()))
          .map((m) => m.id);
        setSemanticMatchedIds(matched);
      }
    } catch (e) {
      console.error("[Semantic Search Error]", e);
      const matched = messages
        .filter((m) => m.text?.toLowerCase().includes(query.toLowerCase()))
        .map((m) => m.id);
      setSemanticMatchedIds(matched);
    } finally {
      setSemanticSearchLoading(false);
    }
  };

  // Synchronize incoming search queries dispatched from our Universal Command Palette
  useEffect(() => {
    if (externalSearchQuery) {
      setSearchQuery(externalSearchQuery);
      handleTriggerSemanticSearch(externalSearchQuery);
      if (onClearSearchQuery) {
        onClearSearchQuery();
      }
    }
  }, [externalSearchQuery, onClearSearchQuery]);

  // Decoupled listeners to handle global actions (recap/poll) triggered when activeChatId is focused
  useEffect(() => {
    const handleRecapEvent = () => {
      handleTriggerRecap();
    };
    const handlePollEvent = () => {
      setShowPollModal(true);
    };
    window.addEventListener("trigger-recap", handleRecapEvent);
    window.addEventListener("trigger-poll", handlePollEvent);
    return () => {
      window.removeEventListener("trigger-recap", handleRecapEvent);
      window.removeEventListener("trigger-poll", handlePollEvent);
    };
  }, [messages, chat?.id]);

  const handleSaveBookmark = (
    msg: Message,
    category: "work" | "ideas" | "personal" | "read_later",
  ) => {
    const stored = localStorage.getItem("nirmtalk_bookmarks");
    let list = [];
    if (stored) {
      try {
        list = JSON.parse(stored);
      } catch (e) {}
    }
    const senderName = profiles[msg.senderId]?.displayName || "Unknown";
    const newItem = {
      id: msg.id,
      text: msg.text || `[${msg.attachment?.type || "attachment"}]`,
      senderName,
      timestamp: new Date().toLocaleString(),
      category,
    };
    list.push(newItem);
    localStorage.setItem("nirmtalk_bookmarks", JSON.stringify(list));
    alert("Message successfully saved in your Bookmarks Hub!");
    setActiveMsgId(null);
    triggerHaptic(15);
  };

  const handleTriggerRecap = async () => {
    if (messages.length === 0) return;
    setAiRecapLoading(true);
    setAiRecapReport(null);
    try {
      const chatMessagesSummary = messages.map((m) => ({
        id: m.id,
        text: m.text,
        senderId: m.senderId,
      }));
      const res = await fetch("/api/summarize-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatMessagesSummary }),
      });
      const data = await res.json();
      if (data.success) {
        setAiRecapReport(data.recap);
      } else {
        alert("Could not generate chat summary recap.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiRecapLoading(false);
    }
  };

  const handlePollVote = async (messageId: string, optionIndex: number) => {
    if (!currentUser) return;
    const userId = currentUser.uid;
    try {
      const msgRef = doc(db, `chats/${chat.id}/messages`, messageId);
      const msg = messages.find((m) => m.id === messageId);
      if (!msg || !msg.attachment || msg.attachment.type !== "poll") return;

      const options = msg.attachment.pollOptions
        ? [...msg.attachment.pollOptions]
        : [];
      const option = options[optionIndex];
      if (!option) return;

      let votes = option.votes || [];
      if (votes.includes(userId)) {
        votes = votes.filter((uid) => uid !== userId);
      } else {
        const isMultiple =
          msg.attachment.pollQuestion?.includes("[Multiple]") || false;
        if (!isMultiple) {
          options.forEach((opt, idx) => {
            if (idx !== optionIndex) {
              opt.votes = (opt.votes || []).filter((uid) => uid !== userId);
            }
          });
        }
        votes = [...votes, userId];
      }
      options[optionIndex] = { ...option, votes };

      await updateDoc(msgRef, {
        "attachment.pollOptions": options,
      });
      triggerHaptic(15);
    } catch (e: any) {
      console.error("Poll vote submission failed:", e);
    }
  };

  const handleCreatePoll = async (
    question: string,
    optionsList: { text: string; imageUrl?: string }[],
    isMultiple: boolean,
    isAnonymous: boolean,
  ) => {
    const formattedOptions = optionsList.map((opt) => ({
      text: opt.text,
      imageUrl: opt.imageUrl || null,
      votes: [],
    }));
    const questionLabel = isMultiple ? `${question} [Multiple]` : question;

    await sendMessage(chat.id, "", chat.type, chat.name, undefined, {
      type: "poll",
      pollQuestion: questionLabel,
      pollOptions: formattedOptions,
      isAnonymous: isAnonymous,
    });
  };

  const handleReaction = (msgId: string, emoji: string, reactions: any) => {
    triggerHaptic(50);
    toggleReaction(chat?.id || "", msgId, emoji, reactions);
  };

  const handleTranslate = async (msg: Message) => {
    if (translations[msg.id] || isTranslating[msg.id]) return;

    setIsTranslating((prev) => ({ ...prev, [msg.id]: true }));
    try {
      const targetLanguage = navigator.language || "English";
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg.text, targetLanguage }),
      });
      const data = await res.json();
      if (data.success && data.text) {
        setTranslations((prev) => ({ ...prev, [msg.id]: data.text }));
      } else {
        alert(data.error || "Translation failed");
      }
    } catch (e) {
      console.error(e);
      alert("Translation failed");
    } finally {
      setIsTranslating((prev) => ({ ...prev, [msg.id]: false }));
    }
  };

  const [isGeneratingReply, setIsGeneratingReply] = useState(false);

  const handleMagicReply = async () => {
    if (messages.length === 0 || isGeneratingReply) return;
    triggerHaptic(20);
    setIsGeneratingReply(true);
    setText("");
    try {
      const lastMessage = messages[messages.length - 1];
      const context = lastMessage.text || "Say something nice";

      const res = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Generate a very short, friendly, and natural 1-sentence reply to this message from a friend in a casual chat:\n"${context}"\n\nDo not include quotes or surrounding text. Just the reply.`,
        }),
      });

      if (!res.body) throw new Error("No body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setText((prev) => prev + chunk);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate reply");
    } finally {
      setIsGeneratingReply(false);
    }
  };

  const speakMessage = (text: string) => {
    if (!text) return;
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Text-to-speech is not supported in your browser.");
    }
  };

  const prevMessagesLength = useRef(0);

  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      const newMessages = messages.slice(prevMessagesLength.current);
      newMessages.forEach((m) => {
        const lower = m.text?.toLowerCase() || "";
        if (
          lower.includes("congratulations") ||
          lower.includes("happy birthday") ||
          lower.includes("congrats") ||
          lower.includes("🎉")
        ) {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
          });
        }
      });
      prevMessagesLength.current = messages.length;
    }
  }, [messages]);

  const lastProcessedMsgIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !chat ||
      chat.type !== "direct" ||
      messages.length === 0 ||
      !currentUser
    )
      return;

    const otherMemberId = chat.members.find(
      (m: string) => m !== currentUser.uid,
    );
    if (otherMemberId !== "nirm-ai") return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.senderId === currentUser.uid && lastMsg.text) {
      if (
        !userJustSentMessageRef.current &&
        lastProcessedMsgIdRef.current !== lastMsg.id
      ) {
        lastProcessedMsgIdRef.current = lastMsg.id;
        return;
      }

      if (lastProcessedMsgIdRef.current === lastMsg.id) return;
      lastProcessedMsgIdRef.current = lastMsg.id;
      userJustSentMessageRef.current = false;

      const triggerAiAutoReply = async (userPrompt: string) => {
        try {
          await setBotTypingStatus(chat.id, "nirm-ai", true);
        } catch (e) {}

        const history = messages.slice(-10, -1).map((m) => ({
          isUser: m.senderId === currentUser.uid,
          text: m.text || "",
        }));

        try {
          await new Promise((resolve) => setTimeout(resolve, 1200));

          const res = await fetch("/api/assistant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: userPrompt, history }),
          });
          const data = await res.json();

          if (data.success && data.text) {
            await sendMessage(
              chat.id,
              data.text,
              "direct",
              undefined,
              undefined,
              undefined,
              "nirm-ai",
            );
          }
        } catch (err) {
          console.error("Nirm AI auto-reply error:", err);
        } finally {
          try {
            await setBotTypingStatus(chat.id, "nirm-ai", false);
          } catch (e) {}
        }
      };

      triggerAiAutoReply(lastMsg.text);
    }
  }, [messages, chat?.id, currentUser]);

  const lastSuggestedMsgIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!chat || messages.length === 0 || !currentUser) {
      setSuggestedReplies([]);
      return;
    }

    const lastMsg = messages[messages.length - 1];
    
    // Only suggest replies for incoming messages from other users/bots
    if (lastMsg.senderId === currentUser.uid || !lastMsg.text) {
      setSuggestedReplies([]);
      return;
    }

    if (lastSuggestedMsgIdRef.current === lastMsg.id) {
      return;
    }

    const fetchSuggestedReplies = async () => {
      setIsSuggestingReplies(true);
      try {
        const res = await fetch("/api/suggest-replies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastMessageText: lastMsg.text }),
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.suggestions)) {
          setSuggestedReplies(data.suggestions);
          lastSuggestedMsgIdRef.current = lastMsg.id;
        } else {
          setSuggestedReplies([]);
        }
      } catch (err) {
        console.error("Failed to suggest replies:", err);
        setSuggestedReplies([]);
      } finally {
        setIsSuggestingReplies(false);
      }
    };

    fetchSuggestedReplies();
  }, [messages, chat?.id, currentUser]);

  const handleRewriteTone = async (tone: string) => {
    if (!text.trim() || isRewritingText) return;
    
    triggerHaptic(30);
    setIsRewritingText(true);
    setShowWritingTools(false);
    
    try {
      const res = await fetch("/api/rewrite-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, tone }),
      });
      const data = await res.json();
      if (data.success && data.text) {
        setText(data.text);
        if (navigator.vibrate) navigator.vibrate([10, 30]);
      } else {
        alert(data.error || "Failed to rewrite text");
      }
    } catch (err) {
      console.error("Error rephrasing message tone:", err);
      alert("Failed to rewrite text");
    } finally {
      setIsRewritingText(false);
    }
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const myProfile = currentUser ? profiles[currentUser.uid] : null;
  const bubbleStyle = myProfile?.settings?.chatBubbleStyle || "rounded";

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
    if (
      currentUser &&
      chat?.clearedHistory &&
      currentUser.uid in chat.clearedHistory
    ) {
      const clearTimeVal = chat.clearedHistory[currentUser.uid];
      const clearTime = clearTimeVal
        ? getTimestampMillis(clearTimeVal)
        : Date.now();
      filtered = filtered.filter((m) => {
        if (!m.createdAt) return true; // keep pending messages
        const msgTime = getTimestampMillis(m.createdAt);
        return msgTime > clearTime;
      });
    }

    // Wire up Semantic Search and standard query overrides
    if (semanticSearchActive) {
      if (semanticMatchedIds.length > 0) {
        return filtered.filter((m) => semanticMatchedIds.includes(m.id));
      }
      return filtered.filter((m) => semanticMatchedIds.includes(m.id));
    }

    if (!searchQuery) return filtered;
    return filtered.filter((m) =>
      m.text.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [
    messages,
    searchQuery,
    semanticSearchActive,
    semanticMatchedIds,
    chat?.clearedHistory,
    currentUser,
  ]);

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
    setText("");
    setChatTypingStatus(chat.id, false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Process attachment to message
    let attachmentData = undefined;
    let videoFileToUpload: File | null = null;
    if (attachment) {
      if (attachment.type === "video") {
        videoFileToUpload = attachment.file;
        attachmentData = {
          type: "video" as const,
          url: "", // populated after upload finishes successfully
          localBlobUrl: attachment.url,
          thumbnailUrl: attachment.thumbnailUrl || "",
          duration: attachment.duration || 0,
          name: attachment.file.name,
          size: attachment.file.size,
          uploadStatus: "uploading" as const,
          uploadProgress: 0
        };
      } else {
        attachmentData = {
          type: attachment.type,
          url: attachment.url,
          isViewOnce: !!attachment.isViewOnce,
          viewOnceSenderId: currentUser?.uid || "unknown",
          viewOnceRecipientId: chat.type === "direct" ? (chat.members.find((m: string) => m !== currentUser?.uid) || "") : "group",
          viewOnceMediaId: Math.random().toString(36).substring(2, 10),
          viewOnceStatus: attachment.isViewOnce ? ("sent" as const) : undefined,
          viewOnceViewedAt: null,
          name: attachment.file.name,
          size: attachment.file.size,
        };
      }
      setAttachment(null);
    }

    if (editingMsg && msgText && !attachmentData) {
      // Attachment editing not supported easily
      await editMessage(chat.id, editingMsg.id, msgText);
      setEditingMsg(null);
    } else {
      let replyData = undefined;
      if (replyingTo) {
        replyData = {
          id: replyingTo.id,
          text: replyingTo.text,
          senderName: profiles[replyingTo.senderId]?.displayName || "Unknown",
        };
      }
      userJustSentMessageRef.current = true;
      const sentMsgId = await sendMessage(
        chat.id,
        msgText,
        chat.type,
        chat.name,
        replyData,
        attachmentData,
      );
      
      if (videoFileToUpload && sentMsgId) {
        startVideoUpload(sentMsgId, videoFileToUpload);
      }
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
    setText("");
  };

  const handleCancelAction = () => {
    setEditingMsg(null);
    setReplyingTo(null);
    setText("");
  };

  const handleOpenViewOnce = async (msg: Message) => {
    if (!msg.attachment || !msg.attachment.url) return;
    if (msg.attachment.viewOnceStatus === "viewed") {
      return;
    }
    
    setViewOncePhoto(msg);
    
    try {
      const msgRef = doc(db, `chats/${chat.id}/messages`, msg.id);
      await updateDoc(msgRef, {
        "attachment.viewOnceStatus": "viewed",
        "attachment.viewOnceViewedAt": new Date().toISOString(),
        "attachment.url": "", // Wipe the URL completely from database to block any further access!
      });
      if (navigator.vibrate) navigator.vibrate(12);
    } catch (err) {
      console.error("Failed to mark view-once photo as viewed:", err);
    }
  };

  const handleCloseViewOnce = async () => {
    if (viewOncePhoto) {
      try {
        const msgRef = doc(db, `chats/${chat.id}/messages`, viewOncePhoto.id);
        await deleteDoc(msgRef);
        if (navigator.vibrate) navigator.vibrate(15);
      } catch (err) {
        console.error("Failed to fully delete view-once message:", err);
      }
    }
    setViewOncePhoto(null);
  };

  const handlePin = async (msg: Message) => {
    const senderName = profiles[msg.senderId]?.displayName || "Unknown";
    if (chat.pinnedMessage?.id === msg.id) {
      await togglePinMessage(chat.id, null);
    } else {
      await togglePinMessage(chat.id, msg, senderName);
    }
  };

  const getChatName = () => {
    if (chat.type === "group") return chat.name || "Group Chat";
    const otherId = chat.members.find((m: string) => m !== currentUser?.uid);
    return otherId && profiles[otherId]
      ? profiles[otherId].displayName
      : "Unknown User";
  };

  const getChatPhoto = () => {
    if (chat.type === "group") return chat.photoURL || null;
    const otherId = chat.members.find((m: string) => m !== currentUser?.uid);
    return currentUser && otherId && profiles[otherId]
      ? getProfilePhoto(currentUser.uid, profiles[otherId], [chat])
      : null;
  };

  const getChatSubtext = () => {
    if (chat.type === "group") return `${chat.members.length} members`;
    const otherId = chat.members.find((m: string) => m !== currentUser?.uid);
    if (otherId && profiles[otherId] && currentUser) {
      const user = profiles[otherId];
      if (!canViewLastSeen(currentUser.uid, user, [chat])) return "";
      if (user.status === "online") return "online";
      if (user.lastSeen) {
        try {
          const date = user.lastSeen.toDate
            ? user.lastSeen.toDate()
            : new Date(user.lastSeen);
          return `last seen ${formatDistanceToNow(date, { addSuffix: true })}`;
        } catch (e) {
          return "offline";
        }
      }
    }
    return "offline";
  };

  const getMessageTime = (ts: any) => {
    if (!ts) return "";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return format(date, "HH:mm");
  };

  const isMessageReadByOther = (msg: Message) => {
    if (!currentUser) return false;

    // Privacy: Check if I have read receipts enabled
    const myProfile = profiles[currentUser.uid];
    if (!canSendReadReceipts(myProfile)) return false;

    if (chat.type === "direct") {
      const otherId = chat.members.find((m: string) => m !== currentUser.uid);
      const otherProfile = otherId ? profiles[otherId] : null;
      if (otherProfile && !canSendReadReceipts(otherProfile)) {
        return false;
      }
    }

    // Check by readBy array dynamically added to messages
    if (msg.readBy && msg.readBy.length > 0) {
      const otherReadByIds = msg.readBy.filter((id) => id !== currentUser.uid);
      if (chat.type === "direct") return otherReadByIds.length > 0;
      if (chat.type === "group")
        return otherReadByIds.length === chat.members.length - 1; // all others read it
    }

    // Fallback to readReceipts
    if (chat.type === "group") return false;
    const otherId = chat.members.find((m: string) => m !== currentUser.uid);
    const otherReadTime = chat.readReceipts?.[otherId!];
    if (otherReadTime && msg.createdAt) {
      const msgTime = msg.createdAt.toDate
        ? msg.createdAt.toDate()
        : new Date(msg.createdAt);
      return new Date(otherReadTime) >= msgTime;
    }
    return false;
  };

  const chatPhoto = getChatPhoto();
  const chatName = getChatName();

  const activeTypers = Object.entries(chat.typing || {})
    .filter(([uid, ts]: [string, any]) => uid !== currentUser.uid && !!ts)
    .map(([uid]) => profiles[uid]?.displayName.split(" ")[0] || "Someone");

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0.9 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0.9 }}
      transition={{ type: "spring", damping: 26, stiffness: 220 }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col h-full w-full absolute inset-0 z-50 md:relative md:z-auto bg-transparent overflow-hidden ${chatWallpaper ? "bg-black/5 dark:bg-black/20" : ""}`}
      style={
        chatWallpaper
          ? {
              backgroundImage: `url(${chatWallpaper})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundAttachment: "fixed",
            }
          : {}
      }
    >
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-2 inset-y-2 z-[250] bg-blue-500/10 dark:bg-blue-500/25 backdrop-blur-md rounded-3xl border-2 border-dashed border-blue-500 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 animate-bounce mb-4">
              <Camera className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Drop Your Media Here
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
              We support images and videos. Automatic high-quality thumbnails will be generated instantly.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="absolute top-2 left-2 right-2 md:top-4 md:left-4 md:right-4 z-[100] flex items-center justify-center pointer-events-none">
        <div className="h-[60px] md:h-[64px] rounded-full px-2 md:px-6 flex items-center justify-between pointer-events-auto max-w-4xl w-full mx-auto liquid-glass-panel border border-white/50 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.25)]">
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0 pr-2">
            {onBack && (
              <button
                onClick={onBack}
                className="md:hidden w-10 h-10 -ml-2 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/10 rounded-full transition-colors shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {chat.type === "group" ? (
              <div className="w-10 h-10 shrink-0 glass-droplet text-slate-800 dark:text-slate-200 rounded-full flex items-center justify-center font-bold shadow-sm border border-white/40 dark:border-white/10">
                <Users className="w-5 h-5" />
              </div>
            ) : chatPhoto ? (
              <img
                src={chatPhoto}
                alt="Avatar"
                className="w-10 h-10 shrink-0 rounded-full object-cover shadow-sm border border-slate-200 dark:border-white/20"
              />
            ) : (
              <div className="w-10 h-10 shrink-0 glass-droplet text-slate-800 dark:text-slate-200 rounded-full flex items-center justify-center font-semibold text-lg shadow-sm border border-white/45 dark:border-white/10">
                {chatName.charAt(0).toUpperCase()}
              </div>
            )}
            <button
              onClick={() => setShowGroupInfo(!showGroupInfo)}
              className="flex flex-col flex-1 min-w-0 justify-center text-left overflow-hidden"
            >
              <h2 className="text-[16px] font-semibold text-slate-900 dark:text-white tracking-tight leading-tight truncate w-full">
                {chatName || "Chat"}
              </h2>
              <div className="h-4 flex items-center w-full min-w-0 overflow-hidden">
                {activeTypers.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-[13px] text-blue-600 dark:text-blue-400 capitalize font-medium min-w-0 overflow-hidden w-full"
                  >
                    <span className="truncate flex-shrink">
                      {activeTypers.join(", ")}
                    </span>
                    <span className="flex items-center gap-0.5 shrink-0">
                      <span>typing</span>
                      <span className="flex gap-[2px] ml-0.5 items-center justify-center translate-y-[1px]">
                        <motion.span
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -1.5, 0] }}
                          transition={{
                            repeat: Infinity,
                            duration: 1,
                            ease: "easeInOut",
                            delay: 0,
                          }}
                          className="w-1 h-1 bg-current rounded-full block"
                        />
                        <motion.span
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -1.5, 0] }}
                          transition={{
                            repeat: Infinity,
                            duration: 1,
                            ease: "easeInOut",
                            delay: 0.15,
                          }}
                          className="w-1 h-1 bg-current rounded-full block"
                        />
                        <motion.span
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -1.5, 0] }}
                          transition={{
                            repeat: Infinity,
                            duration: 1,
                            ease: "easeInOut",
                            delay: 0.3,
                          }}
                          className="w-1 h-1 bg-current rounded-full block"
                        />
                      </span>
                    </span>
                  </motion.div>
                ) : (
                  <p
                    className={`text-[13px] font-medium truncate w-full ${getChatSubtext() === "online" ? "text-blue-600 dark:text-blue-400 capitalize" : "text-slate-600 dark:text-slate-400"}`}
                  >
                    {getChatSubtext()}
                  </p>
                )}
              </div>
            </button>
          </div>
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            <button
              onClick={handleTriggerRecap}
              title="AI Summary & Decisions Recap"
              className="hidden md:flex w-9 h-9 md:w-10 md:h-10 flex-shrink-0 items-center justify-center rounded-full text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-all"
            >
              <Sparkles className="w-4 h-4 md:w-4.5 md:h-4.5" />
            </button>
            <button
              onClick={() => setShowPollModal(true)}
              title="Create Advanced Poll"
              className="hidden md:flex w-9 h-9 md:w-10 md:h-10 flex-shrink-0 items-center justify-center rounded-full text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all"
            >
              <BarChart2 className="w-4 h-4 md:w-4.5 md:h-4.5" />
            </button>
            {chat.pinnedMessage && (
              <button
                onClick={() => setShowPinnedMessage(!showPinnedMessage)}
                className={`hidden md:flex w-9 h-9 md:w-10 md:h-10 flex-shrink-0 items-center justify-center rounded-full transition-colors ${showPinnedMessage ? "text-blue-600 bg-blue-50/50 dark:bg-blue-500/20" : "text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-white/10"}`}
              >
                <Pin className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            )}
            <button
              onClick={() => setIsSearching(!isSearching)}
              className={`hidden md:flex w-9 h-9 md:w-10 md:h-10 flex-shrink-0 items-center justify-center rounded-full transition-colors ${isSearching ? "text-blue-600 bg-blue-50/50 dark:bg-blue-500/20" : "text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-white/10"}`}
            >
              <Search className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            {currentUser &&
              chat.type === "direct" &&
              chat.members.find((m) => m !== currentUser.uid) &&
              profiles[chat.members.find((m) => m !== currentUser.uid)!] &&
              canCall(
                currentUser.uid,
                profiles[chat.members.find((m) => m !== currentUser.uid)!],
                [chat],
              ) && (
                <>
                  <button
                    onClick={() =>
                      startCall(
                        chat.id,
                        chat.members.find((m) => m !== currentUser.uid)!,
                        "audio",
                      )
                    }
                    className="flex w-9 h-9 md:w-10 md:h-10 flex-shrink-0 items-center justify-center text-blue-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
                  >
                    <Phone className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                  <button
                    onClick={() =>
                      startCall(
                        chat.id,
                        chat.members.find((m) => m !== currentUser.uid)!,
                        "video",
                      )
                    }
                    className="flex w-9 h-9 md:w-10 md:h-10 flex-shrink-0 items-center justify-center text-blue-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
                  >
                    <Video className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </>
              )}
            {chat.type === "group" && (
              <>
                <button
                  onClick={() => startCall(chat.id, "", "audio", true)}
                  className="flex w-9 h-9 md:w-10 md:h-10 flex-shrink-0 items-center justify-center text-blue-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
                >
                  <Phone className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button
                  onClick={() => startCall(chat.id, "", "video", true)}
                  className="flex w-9 h-9 md:w-10 md:h-10 flex-shrink-0 items-center justify-center text-blue-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
                >
                  <Video className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </>
            )}
            <button
              onClick={() => {
                setShowDeleteConfirm(true);
              }}
              title="Delete Chat from Both Sides"
              className="hidden md:flex w-9 h-9 md:w-10 md:h-10 flex-shrink-0 items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button
              onClick={() => setShowGroupInfo(!showGroupInfo)}
              className={`hidden md:flex w-9 h-9 md:w-10 md:h-10 flex-shrink-0 items-center justify-center rounded-full transition-colors ${showGroupInfo ? "text-blue-500 bg-blue-50 dark:bg-blue-500/10" : "text-blue-500 hover:bg-slate-100 dark:hover:bg-white/10"}`}
            >
              <Info className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar & Pinned message */}
      <AnimatePresence>
        {(isSearching ||
          showPinnedMessage ||
          (activeGroupCall && (!activeCall || activeCall.id !== chat.id))) && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="absolute top-[68px] md:top-[88px] left-2 right-2 md:left-4 md:right-4 z-20 pointer-events-none flex flex-col items-center gap-2"
          >
            {isSearching && (
              <div className="w-full max-w-lg pointer-events-auto bg-[#fbfcfd]/90 dark:bg-white/10 backdrop-blur-[40px] bg-gradient-to-br from-white/95 to-white/80 dark:from-white/10 dark:to-white/5 px-3 py-2 rounded-2xl border border-slate-200 dark:border-white/20 shadow-[0_8px_32px_rgba(31,38,135,0.08)] ring-1 ring-slate-200/40 dark:ring-white/10">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-100/90 dark:bg-black/50 pl-9 pr-4 py-1.5 rounded-xl text-sm border border-slate-200/60 dark:border-white/5 outline-none focus:ring-2 focus:ring-blue-500/50 dark:text-white transition-all shadow-inner"
                  />
                </div>
              </div>
            )}
            {showPinnedMessage && chat.pinnedMessage && (
              <div
                onClick={() => {
                  document
                    .getElementById(`msg-${chat.pinnedMessage?.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="w-full max-w-md pointer-events-auto px-4 py-3 bg-[#fbfcfd]/95 dark:bg-white/10 backdrop-blur-[40px] bg-gradient-to-br from-white/100 to-white/90 dark:from-white/10 dark:to-white/5 border border-slate-200 dark:border-white/20 rounded-[32px] shadow-[0_12px_32px_rgba(0,0,0,0.06)] ring-1 ring-slate-200/40 dark:ring-white/10 flex items-center gap-3 cursor-pointer hover:bg-white dark:hover:bg-white/20 transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-blue-55 dark:bg-blue-500/20 flex items-center justify-center shrink-0 shadow-sm border border-slate-200 dark:border-white/5">
                  <Pin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    Pinned by {chat.pinnedMessage.senderName}
                  </div>
                  <div className="text-[13px] text-slate-800 dark:text-slate-200 truncate font-medium">
                    {chat.pinnedMessage.text}
                  </div>
                </div>
              </div>
            )}
            {chat.type === "group" &&
              activeGroupCall &&
              (!activeCall || activeCall.id !== chat.id) && (
                <div className="w-full max-w-md pointer-events-auto px-4 py-3 bg-emerald-500/10 dark:bg-emerald-500/20 backdrop-blur-[40px] border border-emerald-500/30 rounded-[32px] shadow-[0_8px_32px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0 shadow-sm border border-emerald-500/30 animate-pulse">
                    <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 fill-current animate-bounce" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                      Live Group Calling
                    </div>
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium truncate">
                      {activeGroupCall.participants?.length || 1} participant(s)
                      talking now.
                    </div>
                  </div>
                  <button
                    onClick={() => joinGroupCall(chat.id, activeGroupCall.type)}
                    className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full text-xs font-bold shadow-md shadow-emerald-500/20 transition-all hover:scale-105 pointer-events-auto"
                  >
                    Join {activeGroupCall.type === "video" ? "Video" : "Call"}
                  </button>
                </div>
              )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div
        className={`flex-1 overflow-y-auto px-4 md:px-6 pb-[160px] space-y-6 relative z-10 ${
          isSearching && showPinnedMessage && activeGroupCall
            ? "pt-[310px]"
            : (isSearching && showPinnedMessage) ||
                (isSearching && activeGroupCall) ||
                (showPinnedMessage && activeGroupCall)
              ? "pt-[240px]"
              : isSearching || showPinnedMessage || activeGroupCall
                ? "pt-[160px] md:pt-[180px]"
                : "pt-[90px] md:pt-[100px]"
        }`}
        ref={scrollRef}
      >
        {/* Semantic Search Status Bar */}
        {semanticSearchActive && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 mb-6 w-full max-w-xl mx-auto rounded-full bg-blue-500/10 dark:bg-blue-400/10 border border-blue-400/20 text-blue-600 dark:text-blue-400 text-xs md:text-sm flex items-center justify-between shadow-sm backdrop-blur-xl z-[90]"
          >
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>
                {semanticSearchLoading
                  ? "AI Searching conversation meaning..."
                  : `AI Semantic Search: matches for "${searchQuery}"`}
              </span>
            </div>
            <button
              onClick={() => {
                setSemanticSearchActive(false);
                setSemanticMatchedIds([]);
                setSearchQuery("");
                try {
                  if (navigator.vibrate) navigator.vibrate(10);
                } catch (e) {}
              }}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-650 text-white font-bold rounded-full text-[11px] transition-all cursor-pointer shadow-sm active:scale-95"
            >
              Show All
            </button>
          </motion.div>
        )}

        {displayMessages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-full text-center space-y-4"
          >
            <div className="w-20 h-20 bg-[#fbfcfd]/90 backdrop-blur-2xl shadow-xl shadow-black/5 dark:bg-[#1a1a1c]/50 rounded-[32px] flex items-center justify-center text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-slate-900 dark:text-white font-bold text-lg">
                Say Hello!
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Send a message to start the conversation.
              </p>
            </div>
          </motion.div>
        )}
        <AnimatePresence>
          {displayMessages.map((msg, i) => {
            const isMe = msg.senderId === currentUser.uid;
            const sender = profiles[msg.senderId];
            const showAvatar = chat.type === "group" && !isMe;

            return (
              <motion.div
                initial={
                  isMe
                    ? { opacity: 0, scale: 0.9, y: 18, rotate: -0.5 }
                    : msg.senderId === "nirm-ai"
                      ? { opacity: 0, scale: 0.96, y: 22, filter: "blur(4px)" }
                      : { opacity: 0, scale: 0.93, y: 12 }
                }
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  rotate: 0,
                  filter: "blur(0px)",
                }}
                transition={{
                  type: "spring",
                  stiffness: isMe
                    ? 260
                    : msg.senderId === "nirm-ai"
                      ? 140
                      : 210,
                  damping: isMe ? 22 : msg.senderId === "nirm-ai" ? 20 : 23,
                }}
                layout
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex max-w-[70%] ${isMe ? "flex-row-reverse" : "flex-row"} items-end gap-2`}
                >
                  {showAvatar ? (
                    sender &&
                    currentUser &&
                    getProfilePhoto(currentUser.uid, sender, [chat]) ? (
                      <img
                        src={getProfilePhoto(currentUser.uid, sender, [chat])}
                        alt="Avatar"
                        className="w-6 h-6 rounded-full mb-1 shrink-0"
                      />
                    ) : (
                      <div className="w-6 h-6 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mb-1">
                        {sender?.displayName?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )
                  ) : (
                    !isMe &&
                    chat.type === "group" && <div className="w-6 shrink-0" />
                  )}

                  <div
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    {showAvatar && (
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 ml-2">
                        {sender?.displayName}
                      </span>
                    )}
                    <div
                      className={`flex items-end gap-2 group/msg ${isMe ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <motion.div
                        onClick={() =>
                          setActiveMsgId(activeMsgId === msg.id ? null : msg.id)
                        }
                        whileHover={{
                          scale: 1.008,
                          y: -0.5,
                          boxShadow: "0 6px 16px rgba(0, 0, 0, 0.04)",
                          transition: { type: "spring", stiffness: 350, damping: 25 }
                        }}
                        whileTap={{
                          scale: 0.985,
                          transition: { type: "spring", stiffness: 450, damping: 15 }
                        }}
                        className={`px-4 py-3 relative group text-[15px] leading-relaxed cursor-pointer transition-all duration-300 ${
                          isMe
                            ? `bg-blue-500/10 dark:bg-blue-400/12 text-blue-700 dark:text-blue-300 border border-blue-400/25 dark:border-blue-400/15 shadow-[0_4px_12px_rgba(59,130,246,0.04)] rounded-[22px] rounded-br-[4px]`
                            : msg.senderId === "nirm-ai"
                              ? `bg-indigo-500/8 dark:bg-indigo-400/10 backdrop-blur-2xl border border-indigo-400/20 dark:border-indigo-400/15 text-indigo-950 dark:text-slate-100 shadow-[0_4px_12px_rgba(99,102,241,0.03)] rounded-[22px] rounded-bl-[4px]`
                              : `bg-slate-400/8 dark:bg-white/5 backdrop-blur-2xl border border-white/35 dark:border-white/10 text-slate-800 dark:text-slate-200 shadow-sm rounded-[22px] rounded-bl-[4px]`
                        }`}
                      >
                        {msg.replyTo && (
                          <div
                            className={`mb-3 p-2.5 rounded-xl text-[13px] border-l-[3px] cursor-pointer transition-colors ${isMe ? "bg-black/10 dark:bg-black/10 border-white/60 dark:border-[#062e6f]/60 text-white/90 dark:text-[#062e6f]/90" : "bg-slate-200/50 dark:bg-[#2d2d2d] border-[#0b57d0] dark:border-[#a8c7fa] text-[#444746] dark:text-[#c4c7c5]"}`}
                          >
                            <div className="font-medium text-[11px] mb-0.5 tracking-wide opacity-80">
                              {msg.replyTo.senderName}
                            </div>
                            <div className="truncate opacity-80">
                              {msg.replyTo.text}
                            </div>
                          </div>
                        )}
                        {msg.attachment?.type === "image" && (
                            msg.attachment.isViewOnce ? (
                              <div className="mb-2 min-w-[220px]">
                                {msg.attachment.viewOnceStatus === "viewed" ? (
                                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-200/40 dark:bg-black/25 border border-slate-300/[0.12] dark:border-white/5 text-slate-500 dark:text-slate-400 select-none cursor-not-allowed">
                                    <EyeOff className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                    <span className="text-[13px] font-bold tracking-wide">Photo Viewed</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenViewOnce(msg)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#059669]/10 hover:bg-[#059669]/15 border border-[#059669]/25 hover:border-[#059669]/45 transition-all text-[#059669] dark:text-[#34d399] hover:scale-[1.01] active:scale-[0.99] shadow-sm cursor-pointer group text-left"
                                  >
                                    <div className="p-1.5 rounded-lg bg-[#059669]/20 text-[#059669] dark:text-[#34d399] group-hover:animate-pulse">
                                      <Eye className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-[13px] font-bold tracking-wide">👁 View Once Photo</span>
                                      <span className="text-[9.5px] font-extrabold text-[#059669]/75 dark:text-[#34d399]/75 uppercase tracking-widest mt-0.5">Tap to Open</span>
                                    </div>
                                  </button>
                                )}
                              </div>
                            ) : (
                              msg.attachment.url && (
                                <div
                                  className="mb-2 -mx-1 -mt-1 overflow-hidden rounded-xl cursor-pointer"
                                  onClick={() =>
                                    setActiveLightboxImage(msg.attachment!.url!)
                                  }
                                >
                                  <img
                                    src={msg.attachment.url}
                                    alt="Attachment"
                                    className="w-full max-w-[280px] h-auto object-cover"
                                  />
                                </div>
                              )
                            )
                          )}
                        {msg.attachment?.type === "video" && (
                          <div className="mb-2 -mx-1 -mt-1 overflow-hidden rounded-xl">
                            <VideoMessageCard
                              message={msg}
                              isMe={isMe}
                              onCancelUpload={handleCancelUpload}
                              onRetryUpload={handleRetryUpload}
                            />
                          </div>
                        )}
                        {msg.attachment?.type === "audio" ? (
                          <AudioMessage
                            src={msg.attachment.url}
                            duration={msg.attachment.duration}
                          />
                        ) : msg.attachment?.type === "poll" &&
                          msg.attachment.pollQuestion ? (
                          <div
                            className="my-1.5 p-4 bg-white/75 dark:bg-[#1a1a1c]/75 border border-slate-200/40 dark:border-white/10 rounded-2xl flex flex-col gap-3 min-w-[305px] max-w-sm shadow-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-[13.5px] text-slate-800 dark:text-slate-100 select-text">
                              <CheckSquare className="w-4 h-4 text-blue-500 shrink-0" />
                              <span>{msg.attachment.pollQuestion}</span>
                            </div>
                            <div className="space-y-2.5">
                              {(() => {
                                const options =
                                  msg.attachment.pollOptions || [];
                                const totalVotes = options.reduce(
                                  (sum, opt) => sum + (opt.votes?.length || 0),
                                  0,
                                );
                                const maxVotes = Math.max(
                                  ...options.map((o) => o.votes?.length || 0),
                                );
                                const isAnon =
                                  msg.attachment.isAnonymous !== false;

                                return options.map((opt, idx) => {
                                  const votesCount = opt.votes?.length || 0;
                                  const ratio =
                                    totalVotes > 0
                                      ? (votesCount / totalVotes) * 100
                                      : 0;
                                  const hasVoted = opt.votes?.includes(
                                    currentUser?.uid || "",
                                  );
                                  const isWinner =
                                    votesCount > 0 && votesCount === maxVotes;
                                  const voterNames =
                                    !isAnon && opt.votes
                                      ? opt.votes
                                          .map(
                                            (vUid: string) =>
                                              profiles[
                                                vUid
                                              ]?.displayName?.split(" ")[0] ||
                                              "Member",
                                          )
                                          .join(", ")
                                      : "";

                                  return (
                                    <motion.div
                                      key={idx}
                                      onClick={() =>
                                        handlePollVote(msg.id, idx)
                                      }
                                      whileHover={{
                                        scale: 1.015,
                                        y: -0.5,
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                                      }}
                                      whileTap={{ scale: 0.985 }}
                                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                      className={`p-2.5 rounded-xl border transition-all relative overflow-hidden flex flex-col justify-center min-h-[44px] cursor-pointer ${
                                        hasVoted
                                          ? "border-blue-400 dark:border-blue-500/40 bg-blue-500/5"
                                          : isWinner
                                            ? "border-emerald-400 dark:border-emerald-500/20 bg-emerald-500/5"
                                            : "border-slate-200 dark:border-white/5 hover:border-slate-350 dark:hover:border-white/15"
                                      }`}
                                    >
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${ratio}%` }}
                                        className={`absolute left-0 top-0 bottom-0 pointer-events-none opacity-[0.08] dark:opacity-15 transition-all ${isWinner ? "bg-emerald-500" : "bg-blue-505"}`}
                                      />
                                      <div className="flex items-center gap-2.5 z-10 w-full">
                                        {opt.imageUrl && (
                                          <img
                                            src={opt.imageUrl}
                                            alt="option illustration"
                                            className="w-10 h-10 rounded-lg object-cover border border-slate-200/50 dark:border-white/10 shrink-0"
                                          />
                                        )}
                                        <div className="flex-1 min-w-0 text-xs font-semibold">
                                          <div className="flex items-center justify-between text-slate-805 dark:text-slate-200">
                                            <span className="truncate pr-2">
                                              {opt.text}
                                            </span>
                                            <span className="text-slate-500 shrink-0 font-medium">
                                              {votesCount} ({Math.round(ratio)}
                                              %)
                                            </span>
                                          </div>
                                          {voterNames && (
                                            <p className="text-[10px] text-slate-450 dark:text-slate-400 mt-1 truncate">
                                              Votes: {voterNames}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </motion.div>
                                  );
                                });
                              })()}
                            </div>
                            <div className="text-[10px] text-slate-400 flex justify-between select-none">
                              <span>Tap your vote to undo</span>
                              <span>
                                {msg.attachment.isAnonymous !== false
                                  ? "🔒 Anonymous Mode"
                                  : "📢 Public Votes"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {msg.text && (
                              <span className="whitespace-pre-wrap word-break">
                                {msg.text}
                              </span>
                            )}
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
                        <div
                          className={`text-[10px] mt-1 text-right flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute ${isMe ? "-left-24 bottom-2 font-medium text-slate-400" : "-right-24 bottom-2 font-medium text-slate-400"}`}
                        >
                          {getMessageTime(msg.createdAt)}
                          {msg.editedAt && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const histories = JSON.parse(
                                  localStorage.getItem(
                                    "nirmtalk_msg_versions",
                                  ) || "{}",
                                );
                                const list = histories[msg.id] || [];
                                if (list.length > 0) {
                                  alert(
                                    `NirmTalk Revisions History for Message:\n\n` +
                                      list
                                        .map(
                                          (l: any, idx: number) =>
                                            `V${idx + 1} (${new Date(l.editedAt).toLocaleTimeString()}): "${l.text}"`,
                                        )
                                        .join("\n\n"),
                                  );
                                } else {
                                  alert(
                                    "Original text version: " +
                                      (msg.text || "Unavailable"),
                                  );
                                }
                              }}
                              className="italic select-none font-bold hover:underline text-blue-500 cursor-pointer"
                            >
                              (edited)
                            </button>
                          )}
                          {isMe && isMessageReadByOther(msg) && (
                            <CheckCheck className="w-3 h-3 text-blue-500 ml-0.5" />
                          )}
                        </div>

                        {msg.reactions &&
                          Object.keys(msg.reactions).length > 0 && (
                            <div
                              className={`absolute -bottom-2 ${isMe ? "right-2" : "left-2"} bg-slate-50 dark:bg-[#2c2c2e] border border-slate-200 dark:border-white/10 rounded-full px-1.5 py-0.5 text-xs flex items-center gap-0.5 shadow-sm`}
                            >
                              {Array.from(
                                new Set(Object.values(msg.reactions)),
                              ).map((emoji) => (
                                <span key={emoji} className="text-[12px]">
                                  {emoji}
                                </span>
                              ))}
                              <span className="text-[10px] text-slate-500 font-medium ml-0.5 pr-0.5">
                                {Object.keys(msg.reactions).length}
                              </span>
                            </div>
                          )}
                      </motion.div>

                      <AnimatePresence>
                        {activeMsgId === msg.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 10 }}
                            transition={{
                              type: "spring",
                              damping: 15,
                              stiffness: 220,
                            }}
                            className="flex items-center gap-0.5 bg-white dark:bg-[#1c1c1e] rounded-full p-1 border border-slate-200 dark:border-white/5 shadow-sm mb-2 shrink-0 z-30"
                          >
                            <button
                              onClick={() => {
                                triggerHaptic(15);
                                handleReaction(msg.id, "👍", msg.reactions);
                              }}
                              className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-[13px] active:scale-130 transition-transform"
                            >
                              👍
                            </button>
                            <button
                              onClick={() => {
                                triggerHaptic(15);
                                handleReaction(msg.id, "❤️", msg.reactions);
                              }}
                              className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-[13px] active:scale-130 transition-transform"
                            >
                              ❤️
                            </button>
                            <button
                              onClick={() => {
                                triggerHaptic(15);
                                handleSaveBookmark(msg, "work");
                              }}
                              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-100/50 dark:hover:bg-amber-500/10 rounded-full"
                              title="Save Bookmark"
                            >
                              <Bookmark className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                triggerHaptic(15);
                                handleTranslate(msg);
                              }}
                              className={`w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 rounded-full ${translations[msg.id] ? "text-blue-500" : "text-slate-400"}`}
                              title="Translate"
                            >
                              <Languages className="w-3.5 h-3.5" />
                            </button>
                            {msg.text && (
                              <button
                                onClick={() => {
                                  triggerHaptic(15);
                                  speakMessage(msg.text);
                                }}
                                className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-full"
                                title="Read Aloud"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                triggerHaptic(15);
                                handleReply(msg);
                              }}
                              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-full"
                            >
                              <Reply className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                triggerHaptic(15);
                                setForwardingMsg(msg);
                              }}
                              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-full"
                            >
                              <Share className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => {
                                triggerHaptic(15);
                                handlePin(msg);
                              }}
                              className={`w-6 h-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 rounded-full ${chat.pinnedMessage?.id === msg.id ? "text-blue-500" : "text-slate-400"}`}
                            >
                              <Pin className="w-3 h-3" />
                            </button>
                            {isMe && (
                              <>
                                <button
                                  onClick={() => {
                                    triggerHaptic(15);
                                    handleEdit(msg);
                                  }}
                                  className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-full"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => {
                                    triggerHaptic(20);
                                    deleteMessage(chat.id, msg.id);
                                  }}
                                  className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <AnimatePresence>
          {activeTypers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, originY: 1, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, originY: 1, y: 5 }}
              className="flex justify-start mt-4"
            >
              {chat.typing?.["nirm-ai"] ? (
                <div className="flex bg-white/20 dark:bg-white/5 backdrop-blur-2xl border border-blue-400/30 dark:border-blue-400/20 text-slate-900 dark:text-white rounded-[20px] rounded-bl-sm py-2.5 px-4 shadow-[0_8px_32px_rgba(59,130,246,0.1)] items-center gap-2 relative overflow-hidden group">
                  {/* Subtle breathing aura background */}
                  <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-400/5 animate-pulse" />

                  <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 animate-pulse-slow shrink-0 z-10" />
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 select-none pr-1 z-10">
                    AI processing thoughts...
                  </span>
                  <span className="flex gap-1 items-center h-2 z-10">
                    <motion.span
                      animate={{
                        opacity: [0.3, 1, 0.3],
                        scale: [0.8, 1.2, 0.8],
                        backgroundColor: ["#3b82f6", "#6366f1", "#3b82f6"],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.2,
                        ease: "easeInOut",
                        delay: 0,
                      }}
                      className="w-1.5 h-1.5 bg-blue-500 rounded-full block"
                    />
                    <motion.span
                      animate={{
                        opacity: [0.3, 1, 0.3],
                        scale: [0.8, 1.2, 0.8],
                        backgroundColor: ["#3b82f6", "#6366f1", "#3b82f6"],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.2,
                        ease: "easeInOut",
                        delay: 0.2,
                      }}
                      className="w-1.5 h-1.5 bg-blue-500 rounded-full block"
                    />
                    <motion.span
                      animate={{
                        opacity: [0.3, 1, 0.3],
                        scale: [0.8, 1.2, 0.8],
                        backgroundColor: ["#3b82f6", "#6366f1", "#3b82f6"],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.2,
                        ease: "easeInOut",
                        delay: 0.4,
                      }}
                      className="w-1.5 h-1.5 bg-blue-500 rounded-full block"
                    />
                  </span>
                </div>
              ) : (
                <div className="flex bg-slate-100 dark:bg-[#1c1c1e] text-slate-700 dark:text-slate-350 rounded-[20px] rounded-bl-sm py-3 px-4 shadow-sm relative group items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 select-none">
                    {activeTypers[0]} is typing...
                  </span>
                  <span className="flex gap-1.5 items-center h-2">
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4], y: [0, -3, 0] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.2,
                        ease: "easeInOut",
                        delay: 0,
                      }}
                      className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full block"
                    />
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4], y: [0, -3, 0] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.2,
                        ease: "easeInOut",
                        delay: 0.2,
                      }}
                      className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full block"
                    />
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4], y: [0, -3, 0] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.2,
                        ease: "easeInOut",
                        delay: 0.4,
                      }}
                      className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full block"
                    />
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="h-4" />
      </div>

      <div className="absolute bottom-2 left-2 right-2 md:bottom-4 md:left-4 md:right-4 pointer-events-none z-20 flex flex-col gap-2">
        {(replyingTo || editingMsg || attachment) && (
          <div className="max-w-4xl mx-auto w-full flex items-center justify-between pointer-events-auto bg-[#fbfcfd]/95 dark:bg-white/10 backdrop-blur-[40px] bg-gradient-to-br from-white/100 to-white/90 dark:from-white/10 dark:to-white/5 px-4 py-2 border border-slate-200 dark:border-white/20 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.06)] ring-1 ring-slate-200/40 dark:ring-white/10">
            <div className="flex flex-col flex-1 min-w-0 pr-4">
              {attachment ? (
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <img
                      src={attachment.thumbnailUrl || attachment.url}
                      alt="Preview"
                      className="w-12 h-12 object-cover rounded-xl border border-slate-300 dark:border-white/10"
                    />
                    {attachment.type === "image" && attachment.isViewOnce && (
                      <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-1 shadow-md animate-pulse">
                        <Eye className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] text-slate-700 dark:text-slate-300 truncate font-semibold">
                        {attachment.file.name}
                      </span>
                      {attachment.type === "image" && attachment.isViewOnce && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500 text-white uppercase tracking-wider animate-bounce">
                          VIEW ONCE
                        </span>
                      )}
                    </div>
                    {attachment.type === "image" ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (navigator.vibrate) navigator.vibrate(20);
                            setAttachment(prev => prev ? { ...prev, isViewOnce: !prev.isViewOnce } : null);
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold transition-all shadow-sm cursor-pointer ${
                            attachment.isViewOnce
                              ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                              : "bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {attachment.isViewOnce ? "View Once Enabled" : "Send as View Once"}
                        </button>
                        {attachment.isViewOnce && (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold leading-none">
                            Recipient can view this photo only once.
                          </span>
                        )}
                      </div>
                    ) : (
                      attachment.type === "video" && (
                        <span className="text-[10px] text-blue-500 dark:text-blue-400 font-bold uppercase tracking-wider">
                          Video Attachment ({attachment.duration ? formatVideoDuration(attachment.duration) : "calculating..."})
                        </span>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-blue-600 dark:text-blue-400">
                      {editingMsg
                        ? "Edit Message"
                        : `Replying to ${profiles[replyingTo!.senderId]?.displayName || "Unknown"}`}
                    </span>
                  </div>
                  <span className="text-[13px] text-slate-700 dark:text-slate-300 truncate">
                    {editingMsg ? editingMsg.text : replyingTo?.text}
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                handleCancelAction();
                setAttachment(null);
              }}
              className="p-1.5 hover:bg-white/50 dark:hover:bg-white/10 rounded-full text-slate-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="max-w-4xl mx-auto w-full relative pointer-events-auto">
          {chat.type === "direct" &&
          profiles[currentUser.uid]?.blockedUsers?.includes(
            chat.members.find((m: string) => m !== currentUser.uid) || "",
          ) ? (
            <div className="w-full bg-white/40 dark:bg-[#1a1a1c]/60 backdrop-blur-3xl border border-white/40 dark:border-white/10 rounded-[32px] px-5 py-4 text-center shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                You have blocked this user. Unblock to send messages.
              </p>
            </div>
          ) : chat.type === "direct" &&
            profiles[
              chat.members.find((m: string) => m !== currentUser.uid) || ""
            ]?.blockedUsers?.includes(currentUser.uid) ? (
            <div className="w-full bg-white/40 dark:bg-[#1a1a1c]/60 backdrop-blur-3xl border border-white/40 dark:border-white/10 rounded-[32px] px-5 py-4 text-center shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                You cannot reply to this conversation.
              </p>
            </div>
          ) : (
            <div className="w-full flex flex-col relative select-none">
              {/* Smart AI Quick Reply Suggestions */}
              {suggestedReplies.length > 0 && !isRecording && (
                <div className="flex items-center gap-2 mb-2 px-3 overflow-x-auto no-scrollbar py-1">
                  <span className="text-[10px] font-extrabold text-blue-500 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-400/10 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 animate-pulse" />
                    AI Suggests
                  </span>
                  {suggestedReplies.map((replyText, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (navigator.vibrate) navigator.vibrate(15);
                        setText(replyText);
                      }}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-200/55 dark:border-white/5 rounded-full text-xs font-semibold text-slate-700 dark:text-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap shadow-sm cursor-pointer"
                    >
                      {replyText}
                    </button>
                  ))}
                </div>
              )}

              {/* AI Writing Tools & Tone Shaper Popover */}
              <AnimatePresence>
                {showWritingTools && text.trim() && (
                  <motion.div
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.95 }}
                    className="absolute bottom-16 right-4 z-50 w-64 bg-white/95 dark:bg-[#151517]/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-3 shadow-2xl flex flex-col gap-1 ring-1 ring-slate-200/40 dark:ring-white/5"
                  >
                    <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-slate-100 dark:border-white/5">
                      <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                        AI Tone Shaper
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowWritingTools(false)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-400 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRewriteTone("professional")}
                      disabled={isRewritingText}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl text-left transition-colors cursor-pointer group text-slate-700 dark:text-slate-200 font-semibold text-[13px] disabled:opacity-50"
                    >
                      <span className="text-base group-hover:scale-110 transition-transform">💼</span>
                      <div className="flex flex-col">
                        <span>Professional</span>
                        <span className="text-[9.5px] text-slate-400 dark:text-slate-500 font-medium">Polite, clean & refined</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRewriteTone("sarcastic")}
                      disabled={isRewritingText}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-xl text-left transition-colors cursor-pointer group text-slate-700 dark:text-slate-200 font-semibold text-[13px] disabled:opacity-50"
                    >
                      <span className="text-base group-hover:scale-110 transition-transform">😼</span>
                      <div className="flex flex-col">
                        <span>Nirm Sarcastic</span>
                        <span className="text-[9.5px] text-slate-400 dark:text-slate-500 font-medium font-sans">Sassy, annoyed & funny</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRewriteTone("concise")}
                      disabled={isRewritingText}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl text-left transition-colors cursor-pointer group text-slate-700 dark:text-slate-200 font-semibold text-[13px] disabled:opacity-50"
                    >
                      <span className="text-base group-hover:scale-110 transition-transform">⚡</span>
                      <div className="flex flex-col">
                        <span>Short & Sharp</span>
                        <span className="text-[9.5px] text-slate-400 dark:text-slate-500 font-medium font-sans">Cut the extra words</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRewriteTone("elaborate")}
                      disabled={isRewritingText}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl text-left transition-colors cursor-pointer group text-slate-700 dark:text-slate-200 font-semibold text-[13px] disabled:opacity-50"
                    >
                      <span className="text-base group-hover:scale-110 transition-transform">📝</span>
                      <div className="flex flex-col">
                        <span>Elaborate</span>
                        <span className="text-[9.5px] text-slate-400 dark:text-slate-500 font-medium font-sans">Add descriptive details</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRewriteTone("excited")}
                      disabled={isRewritingText}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-pink-50 dark:hover:bg-pink-500/10 rounded-xl text-left transition-colors cursor-pointer group text-slate-700 dark:text-slate-200 font-semibold text-[13px] disabled:opacity-50"
                    >
                      <span className="text-base group-hover:scale-110 transition-transform">🎉</span>
                      <div className="flex flex-col">
                        <span>Super Hype</span>
                        <span className="text-[9.5px] text-slate-400 dark:text-slate-500 font-medium font-sans">Positive vibes & energy</span>
                      </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <form
                onSubmit={handleSend}
                data-droplet-capsule="true"
                className="w-full flex items-end gap-3 h-auto relative"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*,video/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (navigator.vibrate) navigator.vibrate(30);

                    if (file.type.startsWith("video/")) {
                      try {
                        const { thumbnailUrl, duration } = await generateVideoThumbnailAndDuration(file);
                        setAttachment({
                          file,
                          url: URL.createObjectURL(file),
                          type: "video",
                          thumbnailUrl,
                          duration
                        });
                      } catch (err) {
                        console.error("Video processing error:", err);
                        setAttachment({
                          file,
                          url: URL.createObjectURL(file),
                          type: "video"
                        });
                      }
                    } else {
                      const reader = new FileReader();
                      reader.onload = () => {
                        setAttachment({
                          file,
                          url: reader.result as string,
                          type: file.type.startsWith("image/") ? "image" : "video"
                        });
                      };
                      reader.readAsDataURL(file);
                    }
                    e.target.value = "";
                  }}
                />
                {isRecording ? (
                  <div className="flex-1 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-[24px] px-4 py-[10px] flex items-center justify-between shadow-sm my-[2px]">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-red-500 font-medium font-mono">
                        {Math.floor(recordingDuration / 60)}:
                        {(recordingDuration % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="text-slate-500 hover:text-red-500 text-sm font-medium mr-2 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <motion.div
                    animate={{
                      scale: isComposerFocused ? 1.02 : 1.0,
                      boxShadow: isComposerFocused
                        ? "0 12px 44px rgba(59, 130, 246, 0.16)"
                        : isGeneratingReply || isRewritingText
                          ? "0 0 24px rgba(139, 92, 246, 0.2)"
                          : "0 8px 32px rgba(0, 0, 0, 0.05)",
                      borderColor: isComposerFocused
                        ? "rgba(59, 130, 246, 0.45)"
                        : isGeneratingReply || isRewritingText
                          ? "rgba(139, 92, 246, 0.7)"
                          : "rgba(255, 255, 255, 0.15)",
                    }}
                    transition={{ type: "spring", stiffness: 350, damping: 24 }}
                    className="flex-1 material-b border px-4 py-2 flex items-center relative rounded-[30px]"
                  >
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all rounded-full hover:bg-white/20 dark:hover:bg-white/10 mr-1.5 shrink-0 cursor-pointer"
                    >
                      <Paperclip className="w-4.5 h-4.5" />
                    </button>
                    <textarea
                      value={text}
                      onChange={handleTextChange}
                      onFocus={() => setIsComposerFocused(true)}
                      onBlur={() => setIsComposerFocused(false)}
                      placeholder={
                        isGeneratingReply && text.length === 0
                          ? "✨ Thinking..."
                          : isRewritingText
                            ? "✨ Rephrasing message..."
                            : "Message..."
                      }
                      disabled={isRewritingText}
                      className={`w-full bg-transparent border-none text-slate-900 dark:text-white focus:outline-none focus:ring-0 text-[15px] resize-none max-h-32 min-h-[22px] transition-all duration-300 ${isGeneratingReply && text.length === 0 ? "animate-pulse text-blue-500 dark:text-blue-400 placeholder:text-blue-500/70 dark:placeholder:text-blue-400/70 tracking-wide font-medium" : isRewritingText ? "animate-pulse text-violet-500 dark:text-violet-400 font-semibold" : "placeholder-slate-400 dark:placeholder-slate-500"}`}
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend(e);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (text.trim()) {
                          setShowWritingTools(!showWritingTools);
                        } else {
                          handleMagicReply();
                        }
                      }}
                      disabled={isGeneratingReply || isRewritingText}
                      className={`p-1.5 transition-all ml-1 rounded-full hover:bg-white/20 dark:hover:bg-white/10 cursor-pointer ${isGeneratingReply || showWritingTools ? "text-violet-500 animate-pulse scale-105" : "text-slate-400 hover:text-blue-500 dark:hover:text-blue-400"}`}
                      title={text.trim() ? "AI Tone Shaper" : "AI Magic Reply"}
                    >
                      <Sparkles
                        className={`w-4.5 h-4.5 ${(isGeneratingReply || showWritingTools) ? "animate-pulse drop-shadow-[0_0_8px_rgba(139,92,246,0.6)] text-violet-550 scale-110" : ""}`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all rounded-full hover:bg-white/25 dark:hover:bg-white/10 ml-0.5 relative shrink-0 mr-1.5 cursor-pointer"
                    >
                      <Smile className="w-4.5 h-4.5" />
                    </button>
                    <div className="flex items-center pl-2 border-l border-slate-300/35 dark:border-white/10 shrink-0 select-none mr-0.5">
                      {text.trim() ? (
                        <button
                          type="submit"
                          className="w-7.5 h-7.5 bg-blue-500 hover:bg-blue-455 text-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer shadow-md shadow-blue-500/10"
                        >
                          <Send className="w-3.5 h-3.5 ml-[1.5px]" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="w-7.5 h-7.5 hover:bg-white/20 dark:hover:bg-white/11 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer"
                        >
                          <Mic className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>
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
                        onEmojiClick={(emojiData) =>
                          setText((prev) => prev + emojiData.emoji)
                        }
                        theme={
                          myProfile?.settings?.theme === "dark"
                            ? ("dark" as any)
                            : myProfile?.settings?.theme === "light"
                              ? ("light" as any)
                              : ("auto" as any)
                        }
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {isRecording ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="hidden"
                  >
                    <Send className="w-[18px] h-[18px] -ml-[1px] mt-[1px]" />
                  </button>
                ) : text.trim() ? (
                  <button type="submit" className="hidden">
                    <Send className="w-4.5 h-4.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="hidden"
                  >
                    <Mic className="w-4.5 h-4.5" />
                  </button>
                )}
              </form>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {forwardingMsg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-sm bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Forward Message
                </h3>
                <button
                  onClick={() => setForwardingMsg(null)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto p-2">
                {chats.map((c) => {
                  let name = c.name || "Group Chat";
                  let photo = null;
                  if (c.type === "direct") {
                    const otherId = c.members.find(
                      (m) => m !== currentUser.uid,
                    );
                    name = profiles[otherId!]?.displayName || "Unknown";
                    photo =
                      otherId && profiles[otherId]
                        ? getProfilePhoto(currentUser.uid, profiles[otherId], [
                            c,
                          ])
                        : null;
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
                      {photo ? (
                        <img
                          src={photo}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center font-semibold text-slate-500">
                          {name.charAt(0)}
                        </div>
                      )}
                      <span className="font-medium text-slate-900 dark:text-white flex-1 min-w-0 truncate">
                        {name}
                      </span>
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGroupInfo(false)}
              className="absolute inset-0 z-40 bg-black/20 dark:bg-black/40 xl:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-[#1c1c1e] shadow-2xl z-50 border-l border-slate-200 dark:border-white/10 flex flex-col"
            >
              <div className="h-[72px] border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-6 shrink-0">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {chat.type === "group" ? "Group Profile" : "Contact Info"}
                </h3>
                <button
                  onClick={() => setShowGroupInfo(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="p-6 flex flex-col items-center border-b border-slate-200 dark:border-white/10 relative">
                  {chat.type === "group" && (
                    <button
                      onClick={() => {
                        setIsEditingGroup(!isEditingGroup);
                        setGroupEditName(chatName);
                        setGroupEditPhoto(chat.photoURL || null);
                      }}
                      className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-full text-slate-500 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  <div className="w-24 h-24 bg-slate-200 dark:bg-[#2c2c2e] text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center font-semibold text-4xl mb-4 overflow-hidden relative group">
                    {chat.type === "group" ? (
                      (isEditingGroup ? groupEditPhoto : chat.photoURL) ? (
                        <img
                          src={
                            (isEditingGroup
                              ? groupEditPhoto
                              : chat.photoURL) as string
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (isEditingGroup ? groupEditName : chatName)
                          .charAt(0)
                          .toUpperCase()
                      )
                    ) : chatPhoto ? (
                      <img
                        src={chatPhoto}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      chatName.charAt(0).toUpperCase()
                    )}

                    {isEditingGroup && chat.type === "group" && (
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                        <label className="cursor-pointer bg-white/20 hover:bg-white/30 text-white rounded-full p-1.5 transition-colors">
                          <Camera className="w-4 h-4" />
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () =>
                                setGroupEditPhoto(reader.result as string);
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                        {groupEditPhoto && (
                          <button
                            type="button"
                            onClick={() => setGroupEditPhoto(null)}
                            className="bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1.5 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {isEditingGroup && chat.type === "group" ? (
                    <div className="w-full flex gap-2">
                      <input
                        value={groupEditName}
                        onChange={(e) => setGroupEditName(e.target.value)}
                        className="flex-1 bg-slate-100 dark:bg-[#2c2c2e] text-slate-900 dark:text-white rounded-xl px-3 py-1 text-sm outline-none"
                      />
                      <button
                        onClick={async () => {
                          await updateGroupProfile(
                            chat.id,
                            groupEditName,
                            groupEditPhoto,
                          );
                          setIsEditingGroup(false);
                        }}
                        className="px-3 bg-blue-500 text-white rounded-xl text-sm font-medium"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white text-center break-words">
                        {chatName}
                      </h2>
                      {chat.type === "group" ? (
                        <p className="text-slate-500 text-sm mt-1">
                          {chat.members.length} members
                        </p>
                      ) : (
                        <p className="text-slate-500 text-sm mt-1">
                          {
                            profiles[
                              chat.members.find((m) => m !== currentUser.uid)!
                            ]?.email
                          }
                        </p>
                      )}
                    </>
                  )}
                </div>
                {chat.type === "group" ? (
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Members
                      </h4>
                      <button
                        onClick={() => setIsAddingMember(!isAddingMember)}
                        className="p-1 rounded bg-blue-50 text-blue-500 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>

                    {isAddingMember && (
                      <div className="mb-4 bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-200 dark:border-white/10">
                        <h5 className="text-xs font-medium text-slate-500 mb-2">
                          Add a friend to group
                        </h5>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {Object.values(profiles)
                            .filter(
                              (p) =>
                                p.userId !== currentUser.uid &&
                                !chat.members.includes(p.userId),
                            )
                            .map((p) => {
                              const pPhoto = getProfilePhoto(
                                currentUser.uid,
                                p,
                                [chat],
                              );
                              return (
                                <button
                                  key={p.userId}
                                  onClick={async () => {
                                    await addMemberToGroup(
                                      chat.id,
                                      chat.members,
                                      p.userId,
                                    );
                                    setIsAddingMember(false);
                                  }}
                                  className="w-full flex items-center gap-2 p-2 hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-lg text-left"
                                >
                                  <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs overflow-hidden">
                                    {pPhoto ? (
                                      <img
                                        src={pPhoto}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      p.displayName.charAt(0)
                                    )}
                                  </div>
                                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate flex-1">
                                    {p.displayName}
                                  </span>
                                </button>
                              );
                            })}
                          {Object.values(profiles).filter(
                            (p) =>
                              p.userId !== currentUser.uid &&
                              !chat.members.includes(p.userId),
                          ).length === 0 && (
                            <div className="text-xs text-slate-500 text-center py-2">
                              No new friends to add
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {chat.members.map((memberId: string) => {
                        const isMe = memberId === currentUser.uid;
                        const profile = profiles[memberId];
                        const memberPhoto =
                          profile &&
                          getProfilePhoto(currentUser.uid, profile, [chat]);
                        return (
                          <div
                            key={memberId}
                            className="flex items-center gap-3 group/member"
                          >
                            {memberPhoto ? (
                              <img
                                src={memberPhoto}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-slate-200 dark:bg-[#2c2c2e] text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center font-semibold text-lg shrink-0">
                                {(profile?.displayName || "U")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-900 dark:text-white truncate text-[15px]">
                                {isMe
                                  ? "You"
                                  : profile?.displayName || "Unknown"}
                              </div>
                              {profile?.status === "online" && (
                                <div className="text-[12px] text-blue-500">
                                  Online
                                </div>
                              )}
                            </div>
                            {!isMe && (
                              <button
                                onClick={() =>
                                  removeMemberFromGroup(
                                    chat.id,
                                    chat.members,
                                    memberId,
                                  )
                                }
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full opacity-0 group-hover/member:opacity-100 transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
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
                        <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          About
                        </h4>
                        <p className="text-sm text-slate-800 dark:text-slate-200">
                          {profiles[
                            chat.members.find((m) => m !== currentUser.uid)!
                          ]?.bio || "Hey there! I am using this app."}
                        </p>
                      </div>
                      {profiles[
                        chat.members.find((m) => m !== currentUser.uid)!
                      ]?.phoneNumber && (
                        <div className="bg-slate-50 dark:bg-[#2c2c2e] p-4 rounded-xl">
                          <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Phone
                          </h4>
                          <p className="text-sm text-slate-800 dark:text-slate-200">
                            {
                              profiles[
                                chat.members.find((m) => m !== currentUser.uid)!
                              ]?.phoneNumber
                            }
                          </p>
                        </div>
                      )}
                      <div className="bg-slate-50 dark:bg-[#2c2c2e] p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 bg-blue-100 dark:bg-blue-500/20 text-blue-500 rounded-lg">
                            <Search className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-slate-800 dark:text-white">
                            Search in Chat
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {chat.type === "group" && (
                <div className="p-6 border-t border-slate-200 dark:border-white/10">
                  <button
                    onClick={() =>
                      removeMemberFromGroup(
                        chat.id,
                        chat.members,
                        currentUser.uid,
                      )
                    }
                    className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
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

      <AnimatePresence>
        {viewOncePhoto && viewOncePhoto.attachment?.url && (
          <ViewOnceViewer
            imageUrl={viewOncePhoto.attachment.url}
            onClose={handleCloseViewOnce}
            senderName={profiles[viewOncePhoto.senderId]?.displayName || "Unknown"}
          />
        )}
      </AnimatePresence>

      {/* Custom confirm modal for deleting chats safely within cross-origin iFrames */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title={chat?.type === "group" ? "Delete Group Chat?" : "Delete Chat?"}
        message={
          chat?.type === "group"
            ? "Are you sure you want to delete this group chat and all messages for all members? This action is permanent and cannot be undone."
            : "Are you sure you want to delete this chat and all messages from both sides? This action is permanent and cannot be undone."
        }
        confirmLabel="Confirm Delete"
        cancelLabel="Keep Chat"
        onConfirm={async () => {
          if (!chat) return;
          console.log(
            `[DELETE_PROCESS] User confirmed delete from ChatView header interface. Target Chat ID: "${chat.id}"`,
          );
          setShowDeleteConfirm(false);
          try {
            await deleteChat(chat.id);
            if (onBack) onBack();
          } catch (err: any) {
            console.error(
              "[DELETE_PROCESS] Error caught while trying to delete chat inside ChatView:",
              err,
            );
          }
        }}
        onCancel={() => {
          console.log(
            "[DELETE_PROCESS] User canceled delete action from ChatView header.",
          );
          setShowDeleteConfirm(false);
        }}
      />

      {/* AI Conversation Recap Drawer */}
      <AnimatePresence>
        {aiRecapLoading && (
          <div className="fixed inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-md z-[200] flex items-center justify-center">
            <div className="p-6 bg-white dark:bg-[#1a1a1c] border border-slate-200 dark:border-white/10 rounded-3xl flex flex-col items-center gap-3 shadow-2xl">
              <Sparkles className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                AI Master synthesizing discussion, decisions & chapters...
              </p>
            </div>
          </div>
        )}

        {aiRecapReport && (
          <div
            className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 font-sans"
            onClick={() => setAiRecapReport(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="w-full max-w-lg glass-protective-panel rounded-3xl overflow-hidden shadow-2xl border border-white/20 dark:border-white/10 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-200/50 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-500">
                  <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-[15px] font-bold text-slate-800 dark:text-white">
                    AI Timeline Chat Recap
                  </h3>
                </div>
                <button
                  onClick={() => setAiRecapReport(null)}
                  className="p-1 px-2.5 text-xs bg-slate-100 dark:bg-white/10 rounded-lg text-slate-500 hover:text-slate-700"
                >
                  Dismiss
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[460px] overflow-y-auto scrollbar-style">
                {/* Summary Section */}
                <div className="space-y-1.5">
                  <div className="text-[10.5px] font-bold uppercase tracking-widest text-[#2563eb]/70 dark:text-[#3b82f6]/70">
                    Executive Summary
                  </div>
                  <p className="text-sm text-slate-650 dark:text-slate-200 leading-relaxed font-normal bg-blue-500/5 dark:bg-blue-500/10 p-3.5 rounded-2xl border border-blue-400/10 select-text">
                    {typeof aiRecapReport.summary === "object" &&
                    aiRecapReport.summary !== null
                      ? (aiRecapReport.summary as any).text ||
                        (aiRecapReport.summary as any).content ||
                        (aiRecapReport.summary as any).paragraph ||
                        JSON.stringify(aiRecapReport.summary)
                      : aiRecapReport.summary}
                  </p>
                </div>

                {/* Decisions Section */}
                <div className="space-y-2">
                  <div className="text-[10.5px] font-bold uppercase tracking-widest text-emerald-600">
                    Dynamic Decisions Made
                  </div>
                  <div className="space-y-1.5">
                    {aiRecapReport.decisions?.map((dec: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex gap-2.5 p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200/30 dark:border-white/5 items-start"
                      >
                        <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-xs text-slate-700 dark:text-slate-300 font-medium select-text">
                          {typeof dec === "object" && dec !== null
                            ? `${dec.title || dec.decision || dec.text || ""}${dec.description || dec.desc ? ": " + (dec.description || dec.desc) : ""}`
                            : String(dec)}
                        </span>
                      </div>
                    ))}
                    {(!aiRecapReport.decisions ||
                      aiRecapReport.decisions.length === 0) && (
                      <p className="text-xs text-slate-400 italic">
                        No formal decisions logged in recent statements yet.
                      </p>
                    )}
                  </div>
                </div>

                {/* Chapter timelines map */}
                <div className="space-y-2">
                  <div className="text-[10.5px] font-bold uppercase tracking-widest text-indigo-500">
                    Timeline Chapters
                  </div>
                  <div className="space-y-2 relative pl-4 border-l-2 border-slate-200 dark:border-white/10 ml-2">
                    {aiRecapReport.chapters?.map((ch: any, idx: number) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-black" />
                        {typeof ch === "object" && ch !== null ? (
                          <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block select-text">
                              {ch.title || ch.chapter || ch.name || ""}
                            </span>
                            {(ch.description || ch.desc) && (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 block select-text">
                                {ch.description || ch.desc}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block select-text">
                            {String(ch)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPollModal && (
          <NewPollModal
            onClose={() => setShowPollModal(false)}
            onSubmit={handleCreatePoll}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
