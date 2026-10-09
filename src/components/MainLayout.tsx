import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  LogOut,
  Search,
  Users,
  Plus,
  X,
  MessageSquare,
  Settings,
  UserCircle,
  Save,
  Upload,
  Sparkles,
  Phone,
  Megaphone,
  Layers,
  FileText,
  Bookmark,
  Sun,
  Moon,
  Lock,
  Trash2,
} from "lucide-react";
import {
  useChats,
  useProfiles,
  createDirectChat,
  createGroupChat,
  updateUserProfile,
  getTimestampMillis,
  deleteChat,
} from "../hooks/useFirestore";
import { ConfirmModal } from "./ConfirmModal";
import { auth, logout } from "../firebase";
import { ChatView } from "./ChatView";
import { SettingsView } from "./SettingsView";
import { CallOverlay } from "./CallOverlay";
import { CommandCenter } from "./CommandCenter";
import { motion, AnimatePresence } from "motion/react";
import { DynamicScenery } from "./DynamicScenery";
import { canMessage, getProfilePhoto } from "../utils/privacy";

const bentoContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.04,
    },
  },
};

const bentoItemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 280, damping: 25, mass: 0.9 },
  },
};

export function MainLayout() {
  const profiles = useProfiles();
  const chats = useChats();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const currentUser = auth.currentUser;

  // States for tabs/overlays
  const [showUsers, setShowUsers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [search, setSearch] = useState("");

  const [isSearchingChats, setIsSearchingChats] = useState(false);
  const [chatTab, setChatTab] = useState("all");
  const [searchChats, setSearchChats] = useState("");
  const [presetText, setPresetText] = useState("");

  // Custom states matching NIRMTALK VISION 2026 specifications
  const [isCommandCenterOpen, setIsCommandCenterOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [externalSearchQuery, setExternalSearchQuery] = useState("");

  const myProfile = currentUser ? profiles[currentUser.uid] : null;

  // Scroll to Refresh states and event/touch mechanics
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const startYRef = useRef(0);
  const chatListRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const container = chatListRef.current;
    if (container && container.scrollTop === 0 && !showUsers) {
      setIsPulling(true);
      startYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isPulling || isRefreshing) return;
    const container = chatListRef.current;
    if (!container) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0 && container.scrollTop === 0) {
      const dragHeight = Math.min(diff * 0.45, 95);
      setPullDistance(dragHeight);

      if (e.cancelable) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
  };

  const handleTouchEnd = () => {
    if (isPulling) {
      if (pullDistance > 60 && !isRefreshing) {
        triggerRefresh();
      } else {
        setPullDistance(0);
      }
      setIsPulling(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = chatListRef.current;
    if (container && container.scrollTop === 0 && !showUsers) {
      setIsPulling(true);
      startYRef.current = e.clientY;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPulling || isRefreshing) return;
    const container = chatListRef.current;
    if (!container) return;

    const currentY = e.clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0) {
      const dragHeight = Math.min(diff * 0.45, 95);
      setPullDistance(dragHeight);
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
  };

  const handleMouseUpOrLeave = () => {
    if (isPulling) {
      if (pullDistance > 60 && !isRefreshing) {
        triggerRefresh();
      } else {
        setPullDistance(0);
      }
      setIsPulling(false);
    }
  };

  const triggerRefresh = async () => {
    setIsRefreshing(true);
    setPullDistance(60);

    try {
      // Simulate real-world fetch/refresh, plus let snapshot keep up if there are changes
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
      setIsPulling(false);
    }
  };

  useEffect(() => {
    if (myProfile?.settings) {
      const { theme, fontSize } = myProfile.settings;
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

      const updateTheme = () => {
        const isDark =
          theme === "dark" || (theme === "auto" && mediaQuery.matches);
        if (isDark) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      };

      updateTheme();

      if (theme === "auto") {
        mediaQuery.addEventListener("change", updateTheme);
      }

      let sizeVar = "16px";
      if (fontSize === "small") sizeVar = "14px";
      if (fontSize === "large") sizeVar = "18px";
      document.documentElement.style.fontSize = sizeVar;

      return () => {
        mediaQuery.removeEventListener("change", updateTheme);
      };
    }
  }, [myProfile?.settings]);

  // Group creation state
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Custom delete confirmation state
  const [deleteTargetChat, setDeleteTargetChat] = useState<any | null>(null);

  // Monitor chats array size for real-time spec logging requirements
  useEffect(() => {
    console.log(
      `[DELETE_PROCESS] UI refresh status: COMPLETED. Live system updated total chat count: ${chats.length}`,
    );
  }, [chats.length]);

  // Set up global hotkeys for universal command palette (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandCenterOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleTheme = async (e?: any) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!myProfile) return;
    const currentTheme = myProfile?.settings?.theme || "auto";
    let newTheme: "light" | "dark" = "dark";
    if (currentTheme === "dark") {
      newTheme = "light";
    } else if (currentTheme === "light") {
      newTheme = "dark";
    } else {
      newTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "light"
        : "dark";
    }

    await updateUserProfile({
      settings: {
        ...(myProfile.settings || {}),
        theme: newTheme,
      },
    });
  };

  const startAIChat = async (promptText?: string) => {
    setIsRefreshing(true);
    try {
      const chatId = await createDirectChat("nirm-ai");
      if (chatId) {
        if (promptText) {
          setPresetText(promptText);
        } else {
          setPresetText("");
        }
        setActiveChatId(chatId);
        setShowUsers(false);
        setShowSettings(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUserClick = async (userId: string) => {
    if (isCreatingGroup) {
      setSelectedUsers((prev) =>
        prev.includes(userId)
          ? prev.filter((u) => u !== userId)
          : [...prev, userId],
      );
      return;
    }

    if (userId === currentUser?.uid) return;
    const chatId = await createDirectChat(userId);
    if (chatId) {
      setActiveChatId(chatId);
      setShowUsers(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    const chatId = await createGroupChat(groupName, selectedUsers);
    if (chatId) {
      setActiveChatId(chatId);
      setShowUsers(false);
      setIsCreatingGroup(false);
      setSelectedUsers([]);
      setGroupName("");
    }
  };

  const profileList = Object.values(profiles) as any[];
  const filteredUsers = profileList.filter(
    (p) =>
      p.userId !== currentUser?.uid &&
      p.userId !== "nirm-ai" &&
      p.displayName.toLowerCase().includes(search.toLowerCase()) &&
      (currentUser ? canMessage(currentUser.uid, p, chats) : false),
  );

  const getChatName = (chat: any) => {
    if (chat.type === "group") return chat.name || "Group Chat";
    const otherId = chat.members.find((m: string) => m !== currentUser?.uid);
    return otherId && profiles[otherId]
      ? profiles[otherId].displayName
      : "Unknown";
  };

  const isChatUnread = (chat: any) => {
    if (!currentUser) return false;
    if (!chat.updatedAt) return false;
    if (chat.lastMessageSenderId === currentUser.uid) return false;

    const updateTime = getTimestampMillis(chat.updatedAt);
    const clearedTimeVal = chat.clearedHistory?.[currentUser.uid];
    const clearedTime = clearedTimeVal ? getTimestampMillis(clearedTimeVal) : 0;
    if (clearedTime > updateTime) return false;

    const readStr = chat.readReceipts?.[currentUser.uid];
    if (!readStr) return true;
    return updateTime > new Date(readStr).getTime();
  };

  const isNirmAiChat = (chat: any) => chat.members?.includes("nirm-ai");

  const unreadChatsCount = chats
    .filter((chat) => !isNirmAiChat(chat))
    .filter(isChatUnread).length;

  const displayChats = chats
    .filter((chat) => {
      if (currentUser && chat.deletedBy?.[currentUser.uid]) return false;
      if (isNirmAiChat(chat)) return false;
      if (chatTab === "unread") return isChatUnread(chat);
      if (chatTab === "groups") return chat.type === "group";
      return true;
    })
    .filter((chat) => {
      if (!searchChats) return true;
      const name = getChatName(chat).toLowerCase();
      return name.includes(searchChats.toLowerCase());
    });
  const getChatPhoto = (chat: any) => {
    if (chat.type === "group") return chat.photoURL || null;
    const otherId = chat.members.find((m: string) => m !== currentUser?.uid);
    return otherId && profiles[otherId] && currentUser
      ? getProfilePhoto(currentUser.uid, profiles[otherId], chats)
      : null;
  };

  return (
    <div className="flex h-screen bg-transparent text-slate-900 dark:text-slate-100 font-sans overflow-hidden relative p-2.5 md:p-3.5 lg:p-4 gap-3.5 md:gap-4 lg:gap-4">
      <DynamicScenery />

      {/* Left Navigation Sidebar */}
      <div
        className={`flex-col w-[250px] liquid-glass-panel border border-white/45 dark:border-white/10 rounded-[28px] shadow-xl shadow-black/2 dark:shadow-black/15 shrink-0 z-30 pt-8 pb-6 px-4 ${isFocusMode ? "hidden" : "hidden lg:flex"}`}
      >
        <div className="flex items-center justify-between px-2 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/15">
              <MessageSquare className="w-4.5 h-4.5 animate-pulse-slow" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-xl tracking-tight text-slate-900 dark:text-white leading-none select-none">
                <span
                  style={
                    isRefreshing
                      ? undefined
                      : {
                          transform: `rotate(${pullDistance * 6}deg)`,
                          transition: isPulling
                            ? "none"
                            : "transform 0.3s ease-out",
                          display: "inline-block",
                        }
                  }
                  className={`inline-block origin-center ${isRefreshing ? "animate-spin" : ""}`}
                >
                  N
                </span>
                irmTalk
              </h1>
              <p className="text-[11px] text-slate-500 font-bold mt-1 tracking-wider uppercase opacity-80 leading-tight">
                Instant Messenger
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <button
            onClick={() => {
              setActiveChatId(null);
              setShowSettings(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl border transition-all duration-300 ${!showSettings && !activeChatId ? "bg-blue-500/20 dark:bg-blue-500/25 text-blue-600 dark:text-blue-400 font-bold border-blue-400/40 shadow-md shadow-blue-500/5" : "hover:bg-white/20 dark:hover:bg-white/10 text-slate-650 dark:text-slate-350 font-semibold border-transparent"}`}
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4.5 h-4.5" />
              <span className="text-[14px]">Chats</span>
            </div>
            <div className="bg-blue-500/10 border border-blue-400/30 text-blue-600 dark:text-blue-400 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
              {chats.filter((c) => c.type === "direct").length}
            </div>
          </button>
          <button
            onClick={() => {
              setShowSettings(true);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl border transition-all duration-300 mt-2 ${showSettings ? "bg-blue-500/20 dark:bg-blue-500/25 text-blue-600 dark:text-blue-400 font-bold border-blue-400/40 shadow-md shadow-blue-500/5" : "hover:bg-white/20 dark:hover:bg-white/10 text-slate-650 dark:text-slate-350 font-semibold border-transparent"}`}
          >
            <Settings className="w-4.5 h-4.5" />
            <span className="text-[14px]">Settings</span>
          </button>
        </div>

        <div className="mt-auto pt-6 border-t border-slate-200/60 dark:border-white/10">
          <div
            className="mt-2 flex items-center justify-between p-2 hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-xl cursor-pointer transition-colors"
            onClick={() => setShowSettings(true)}
          >
            <div className="flex items-center gap-3">
              {myProfile?.photoURL ? (
                <img
                  src={myProfile.photoURL}
                  alt="Me"
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-lg shrink-0">
                  {myProfile?.displayName?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-[14px] text-slate-900 dark:text-white truncate">
                  {myProfile?.displayName || "User"}
                </span>
                <span className="text-[12px] text-blue-500 font-medium truncate">
                  Premium User
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-1 hover:bg-slate-300 dark:hover:bg-white/10 rounded-full transition-colors text-slate-500"
              >
                {myProfile?.settings?.theme === "dark" ||
                (myProfile?.settings?.theme === "auto" &&
                  window.matchMedia("(prefers-color-scheme: dark)").matches) ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>
              <Settings className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Chats Sidebar */}
      <div
        className={`w-full md:w-[350px] liquid-glass-panel border border-white/45 dark:border-white/10 rounded-[28px] shadow-xl shadow-black/2 dark:shadow-black/15 shrink-0 z-20 transition-transform duration-300 ease-out ${isFocusMode ? "hidden" : activeChatId || showSettings ? "hidden md:flex flex-col" : "flex flex-col"}`}
      >
        {/* Header */}
        <div className="pt-8 pb-4 px-6">
          {isSearchingChats ? (
            <div className="flex items-center gap-2 mb-6">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  className="w-full bg-white/40 dark:bg-white/5 border border-white/45 dark:border-white/10 text-[15px] text-slate-900 dark:text-white rounded-full pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white/60 dark:focus:bg-white/10 transition-all placeholder-slate-500 dark:placeholder-slate-400 font-medium shadow-md"
                  placeholder="Search chats..."
                  value={searchChats}
                  onChange={(e) => setSearchChats(e.target.value)}
                />
              </div>
              <button
                onClick={() => {
                  setIsSearchingChats(false);
                  setSearchChats("");
                }}
                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="lg:hidden w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm cursor-pointer overflow-hidden border border-slate-200 dark:border-white/10"
                  onClick={() => setShowSettings(!showSettings)}
                >
                  {myProfile?.photoURL ? (
                    <img
                      src={myProfile.photoURL}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    myProfile?.displayName?.charAt(0).toUpperCase() || "U"
                  )}
                </div>
                <span className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white select-none">
                  <span
                    style={
                      isRefreshing
                        ? undefined
                        : {
                            transform: `rotate(${pullDistance * 6}deg)`,
                            transition: isPulling
                              ? "none"
                              : "transform 0.3s ease-out",
                            display: "inline-block",
                          }
                    }
                    className={`inline-block origin-center ${isRefreshing ? "animate-spin" : ""}`}
                  >
                    N
                  </span>
                  irmTalk
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleTheme}
                  className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
                >
                  {myProfile?.settings?.theme === "dark" ||
                  (myProfile?.settings?.theme === "auto" &&
                    window.matchMedia("(prefers-color-scheme: dark)")
                      .matches) ? (
                    <Sun className="w-5 h-5" />
                  ) : (
                    <Moon className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => setIsSearchingChats(true)}
                  className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
                >
                  <Search className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setShowUsers(!showUsers);
                    setIsCreatingGroup(false);
                  }}
                  className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
                >
                  {showUsers ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          )}

          {!showUsers && !isSearchingChats && (
            <div className="relative p-[4px] bg-[#fdfefe]/45 dark:bg-black/35 backdrop-blur-[32px] rounded-full border border-white/50 dark:border-white/5 flex items-center w-full text-[11px] font-semibold select-none mt-2 shadow-[0_12px_24px_rgba(0,0,0,0.03),inset_0_0.5px_1px_rgba(255,255,255,0.45)]">
              <button
                onClick={() => {
                  setChatTab("all");
                  try {
                    if (navigator.vibrate) navigator.vibrate(8);
                  } catch (e) {}
                }}
                className={`relative flex-1 text-center py-1.5 z-10 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300 origin-center select-none ${
                  chatTab === "all"
                    ? "text-blue-600 dark:text-blue-400 font-extrabold scale-[1.01]"
                    : "text-slate-550 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white opacity-80"
                }`}
              >
                {chatTab === "all" && (
                  <>
                    {/* 1. Underlying Water Body (Heavy density liquid base) */}
                    <motion.div
                      layoutId="liquidTopBase"
                      transition={{
                        type: "spring",
                        stiffness: 155,
                        damping: 14,
                        mass: 0.95
                      }}
                      className="absolute inset-0 z-0 rounded-full bg-gradient-to-br from-blue-500/12 via-blue-400/8 to-indigo-500/10 dark:from-blue-500/22 dark:via-blue-400/12 dark:to-indigo-500/15 border border-blue-400/35 dark:border-blue-400/20 shadow-[0_4px_12px_rgba(59,130,246,0.12),inset_0_1px_3px_rgba(255,255,255,0.8)] dark:shadow-[0_4px_12px_rgba(59,130,246,0.2),inset_0_1px_2px_rgba(255,255,255,0.15)] pointer-events-none"
                    />
                    {/* 2. Optical Gloss Reflection (Light density highlight, overshoots & lags) */}
                    <motion.div
                      layoutId="liquidTopRefraction"
                      transition={{
                        type: "spring",
                        stiffness: 225,
                        damping: 11,
                        mass: 0.55
                      }}
                      className="absolute inset-0 z-0 rounded-full pointer-events-none overflow-hidden"
                    >
                      <div className="absolute top-[2.5px] inset-x-[12%] h-[2.5px] bg-gradient-to-b from-white/85 to-transparent rounded-full opacity-90 filter blur-[0.2px]" />
                      <div className="absolute top-[4px] left-[15%] w-1.2 h-1.2 bg-white/95 rounded-full" />
                      <div className="absolute bottom-[2px] right-[20%] w-3 h-[1px] bg-white/35 rounded-full" />
                    </motion.div>
                  </>
                )}
                <span className="relative z-10 transition-colors duration-300">All</span>
              </button>

              <button
                onClick={() => {
                  setChatTab("unread");
                  try {
                    if (navigator.vibrate) navigator.vibrate(8);
                  } catch (e) {}
                }}
                className={`relative flex-1 text-center py-1.5 z-10 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300 origin-center select-none ${
                  chatTab === "unread"
                    ? "text-blue-600 dark:text-blue-400 font-extrabold scale-[1.01]"
                    : "text-slate-550 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white opacity-80"
                }`}
              >
                {chatTab === "unread" && (
                  <>
                    {/* 1. Underlying Water Body (Heavy density liquid base) */}
                    <motion.div
                      layoutId="liquidTopBase"
                      transition={{
                        type: "spring",
                        stiffness: 155,
                        damping: 14,
                        mass: 0.95
                      }}
                      className="absolute inset-0 z-0 rounded-full bg-gradient-to-br from-blue-500/12 via-blue-400/8 to-indigo-500/10 dark:from-blue-500/22 dark:via-blue-400/12 dark:to-indigo-500/15 border border-blue-400/35 dark:border-blue-400/20 shadow-[0_4px_12px_rgba(59,130,246,0.12),inset_0_1px_3px_rgba(255,255,255,0.8)] dark:shadow-[0_4px_12px_rgba(59,130,246,0.2),inset_0_1px_2px_rgba(255,255,255,0.15)] pointer-events-none"
                    />
                    {/* 2. Optical Gloss Reflection (Light density highlight, overshoots & lags) */}
                    <motion.div
                      layoutId="liquidTopRefraction"
                      transition={{
                        type: "spring",
                        stiffness: 225,
                        damping: 11,
                        mass: 0.55
                      }}
                      className="absolute inset-0 z-0 rounded-full pointer-events-none overflow-hidden"
                    >
                      <div className="absolute top-[2.5px] inset-x-[12%] h-[2.5px] bg-gradient-to-b from-white/85 to-transparent rounded-full opacity-90 filter blur-[0.2px]" />
                      <div className="absolute top-[4px] left-[15%] w-1.2 h-1.2 bg-white/95 rounded-full" />
                      <div className="absolute bottom-[2px] right-[20%] w-3 h-[1px] bg-white/35 rounded-full" />
                    </motion.div>
                  </>
                )}
                <div className="relative z-10 flex items-center gap-1.5 transition-colors duration-300">
                  <span>Unread</span>
                  {unreadChatsCount > 0 && (
                    <span className="bg-blue-100/80 dark:bg-blue-500/30 text-blue-600 dark:text-blue-400 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                      {unreadChatsCount}
                    </span>
                  )}
                </div>
              </button>

              <button
                onClick={() => {
                  setChatTab("groups");
                  try {
                    if (navigator.vibrate) navigator.vibrate(8);
                  } catch (e) {}
                }}
                className={`relative flex-1 text-center py-1.5 z-10 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300 origin-center select-none ${
                  chatTab === "groups"
                    ? "text-blue-600 dark:text-blue-400 font-extrabold scale-[1.01]"
                    : "text-slate-550 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white opacity-80"
                }`}
              >
                {chatTab === "groups" && (
                  <>
                    {/* 1. Underlying Water Body (Heavy density liquid base) */}
                    <motion.div
                      layoutId="liquidTopBase"
                      transition={{
                        type: "spring",
                        stiffness: 155,
                        damping: 14,
                        mass: 0.95
                      }}
                      className="absolute inset-0 z-0 rounded-full bg-gradient-to-br from-blue-500/12 via-blue-400/8 to-indigo-500/10 dark:from-blue-500/22 dark:via-blue-400/12 dark:to-indigo-500/15 border border-blue-400/35 dark:border-blue-400/20 shadow-[0_4px_12px_rgba(59,130,246,0.12),inset_0_1px_3px_rgba(255,255,255,0.8)] dark:shadow-[0_4px_12px_rgba(59,130,246,0.2),inset_0_1px_2px_rgba(255,255,255,0.15)] pointer-events-none"
                    />
                    {/* 2. Optical Gloss Reflection (Light density highlight, overshoots & lags) */}
                    <motion.div
                      layoutId="liquidTopRefraction"
                      transition={{
                        type: "spring",
                        stiffness: 225,
                        damping: 11,
                        mass: 0.55
                      }}
                      className="absolute inset-0 z-0 rounded-full pointer-events-none overflow-hidden"
                    >
                      <div className="absolute top-[2.5px] inset-x-[12%] h-[2.5px] bg-gradient-to-b from-white/85 to-transparent rounded-full opacity-90 filter blur-[0.2px]" />
                      <div className="absolute top-[4px] left-[15%] w-1.2 h-1.2 bg-white/95 rounded-full" />
                      <div className="absolute bottom-[2px] right-[20%] w-3 h-[1px] bg-white/35 rounded-full" />
                    </motion.div>
                  </>
                )}
                <span className="relative z-10 transition-colors duration-300">Groups</span>
              </button>
            </div>
          )}
        </div>

        {/* Content List */}
        <div
          ref={chatListRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ overscrollBehaviorY: "contain" }}
          className={`flex-1 overflow-y-auto px-2 pb-4 scrollbar-hide mt-2 relative ${isPulling ? "select-none cursor-grabbing" : ""}`}
        >
          {/* Pull to Refresh Indicator */}
          {(pullDistance > 0 || isRefreshing) && (
            <div
              style={{
                height: `${pullDistance}px`,
                opacity: Math.min(pullDistance / 50, 1),
              }}
              className="flex items-center justify-center overflow-hidden transition-all duration-150 ease-out shrink-0 w-full mb-2 bg-transparent"
            >
              <div className="flex items-center gap-2 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200/50 dark:border-white/5 shadow-sm text-xs text-slate-600 dark:text-slate-300">
                <div className="relative w-4 h-4 flex items-center justify-center select-none">
                  <span
                    style={
                      isRefreshing
                        ? undefined
                        : {
                            transform: `rotate(${pullDistance * 6}deg)`,
                            transition: isPulling
                              ? "none"
                              : "transform 0.3s ease-out",
                            display: "inline-block",
                          }
                    }
                    className={`font-black text-blue-500 dark:text-blue-400 text-xs text-center leading-none ${isRefreshing ? "animate-spin" : ""}`}
                  >
                    N
                  </span>
                </div>
                <span className="font-semibold text-[11px] uppercase tracking-wider select-none">
                  {isRefreshing ? "Refreshing" : "Pull to Refresh"}
                </span>
              </div>
            </div>
          )}
          {showUsers ? (
            <div className="space-y-4 pt-1">
              <div className="px-2 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    className="w-full bg-white/40 dark:bg-white/5 border border-white/45 dark:border-white/10 text-[15px] text-slate-900 dark:text-white rounded-full pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white/60 dark:focus:bg-white/10 transition-all placeholder-slate-500 dark:placeholder-slate-400 font-medium shadow-md"
                    placeholder="Search to start chat..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {!isCreatingGroup ? (
                  <button
                    onClick={() => setIsCreatingGroup(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-medium hover:bg-blue-500/20 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> New Group
                  </button>
                ) : (
                  <div className="bg-white dark:bg-[#2c2c2e] p-3 rounded-2xl border border-slate-200 dark:border-white/5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">New Group</span>
                      <button
                        onClick={() => {
                          setIsCreatingGroup(false);
                          setSelectedUsers([]);
                        }}
                        className="text-slate-400 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-white/5 p-1 rounded-full text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Group name"
                      className="w-full bg-slate-50 dark:bg-[#1c1c1e] text-[15px] px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleCreateGroup}
                      disabled={!groupName.trim() || selectedUsers.length === 0}
                      className="w-full py-2 bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all"
                    >
                      Create ({selectedUsers.length})
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-0.5 px-1">
                {filteredUsers.map((user, i) => {
                  const isSelected = selectedUsers.includes(user.userId);
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                      key={user.userId}
                    >
                      <button
                        onClick={() => handleUserClick(user.userId)}
                        className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all text-left
                            ${isSelected ? "bg-blue-500/10 dark:bg-blue-500/20" : "hover:bg-slate-200/50 dark:hover:bg-white/5"}
                          `}
                      >
                        {currentUser &&
                        getProfilePhoto(currentUser.uid, user, chats) ? (
                          <img
                            src={getProfilePhoto(currentUser.uid, user, chats)}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-slate-200 dark:bg-[#2c2c2e] text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center font-semibold text-lg">
                            {user.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[15px] text-slate-900 dark:text-slate-100 truncate">
                            {user.displayName}
                          </div>
                          {user.username && (
                            <div className="text-[13px] text-slate-500 truncate mt-0.5">
                              @{user.username}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-0.5 px-1">
              {displayChats.length === 0 && (
                <div className="text-center text-[14px] text-slate-500 py-10 px-4">
                  No messages found.
                </div>
              )}
              {displayChats.map((chat, i) => {
                const name = getChatName(chat);
                const photo = getChatPhoto(chat);
                const isActive = activeChatId === chat.id;

                const chatUpdateTime = getTimestampMillis(chat.updatedAt);
                const clearedTimeVal =
                  chat.clearedHistory?.[currentUser?.uid || ""];
                const clearedTime = clearedTimeVal
                  ? getTimestampMillis(clearedTimeVal)
                  : 0;
                const showLastMessage = chatUpdateTime > clearedTime;

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 25,
                      delay: i * 0.03,
                    }}
                    key={chat.id}
                  >
                    <motion.div
                      onClick={() => setActiveChatId(chat.id)}
                      whileHover={{
                        scale: isActive ? 1.025 : 1.015,
                        y: -1.5,
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.05)",
                        transition: { type: "spring", stiffness: 350, damping: 22 }
                      }}
                      whileTap={{
                        scale: 0.985,
                        transition: { type: "spring", stiffness: 500, damping: 15 }
                      }}
                      animate={{
                        scale: isActive ? 1.02 : 1,
                        backgroundColor: isActive ? "rgba(59, 130, 246, 0.22)" : "rgba(255, 255, 255, 0)",
                        borderColor: isActive ? "rgba(96, 165, 250, 0.45)" : "rgba(255, 255, 255, 0)",
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-2xl text-left relative group cursor-pointer border mt-1.5
                          ${
                            isActive
                              ? "text-blue-600 dark:text-blue-400 font-semibold shadow-lg shadow-blue-500/5 backdrop-blur-md"
                              : "text-slate-800 dark:text-slate-200 hover:bg-white/20 dark:hover:bg-white/10 border-transparent hover:border-white/15 dark:hover:border-white/5"
                          }
                        `}
                    >
                      {photo ? (
                        <img
                          src={photo}
                          className="w-12 h-12 rounded-full object-cover shrink-0 border border-white/20"
                        />
                      ) : (
                        <div
                          className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-bold text-lg transition-all
                             ${isActive ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-400/30" : "bg-white/30 dark:bg-white/10 text-slate-650 dark:text-slate-300 border border-white/25 dark:border-white/5"}
                          `}
                        >
                          {chat.type === "group" ? (
                            <Users className="w-5 h-5" />
                          ) : (
                            name.charAt(0).toUpperCase()
                          )}
                        </div>
                      )}

                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className={`font-semibold text-[15px] truncate ${isActive ? "text-blue-600 dark:text-blue-400 font-extrabold" : "text-slate-900 dark:text-slate-100"}`}
                          >
                            {name}
                          </div>
                        </div>
                        <div
                          className={`text-[13px] truncate mt-0.5 ${isActive ? "text-blue-500/70 dark:text-blue-400/70 font-medium" : "text-slate-500 dark:text-slate-400"}`}
                        >
                          {showLastMessage ? chat.lastMessage || "..." : "..."}
                        </div>
                      </div>

                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          setDeleteTargetChat(chat);
                        }}
                        className={`p-1.5 rounded-full absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10
                            ${isActive ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20" : "bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/40"}
                          `}
                        title="Delete Chat"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {!isActive && isChatUnread(chat) && (
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shrink-0 mr-1 group-hover:opacity-0 transition-opacity" />
                      )}
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Floating Action Button (FAB) for mobile view to start new chat */}
        {!showUsers && !showSettings && !activeChatId && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              setShowUsers(true);
              if (navigator.vibrate) navigator.vibrate([15, 10, 15]);
            }}
            className="md:hidden fixed bottom-22 right-6 z-40 w-14 h-14 bg-gradient-to-tr from-blue-500 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(59,130,246,0.35)] stroke-[2.5] border border-white/20 hover:shadow-blue-500/20 active:scale-95 cursor-pointer"
            title="New Message"
          >
            <Plus className="w-7 h-7" />
          </motion.button>
        )}

        {/* Mobile Bottom Navigation Bar styled explicitly like a high-end Liquid Glass floating dock */}
        <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[84%] max-w-[320px] z-40 shrink-0 select-none">
          <div className="relative flex items-center justify-around p-[4px] bg-[#fdfefe]/40 dark:bg-black/40 backdrop-blur-[32px] border border-white/50 dark:border-white/10 rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.06),0_2px_10px_rgba(0,0,0,0.02),inset_0_1px_3px_rgba(255,255,255,0.45)]">
            {/* Tab 1: Chats */}
            <button
              onClick={() => {
                setShowUsers(false);
                setShowSettings(false);
                try {
                  if (navigator.vibrate) navigator.vibrate(10);
                } catch (e) {}
              }}
              className={`relative flex-1 flex flex-col items-center gap-[2px] py-1.5 z-10 rounded-full cursor-pointer select-none origin-center transition-all duration-300 active:scale-95 hover:scale-[1.02] ${
                !showUsers && !showSettings
                  ? "text-blue-600 dark:text-blue-400 font-extrabold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white opacity-85"
              }`}
            >
              {!showUsers && !showSettings && (
                <>
                  {/* Base Water Droplet Layer */}
                  <motion.div
                    layoutId="liquidBottomBase"
                    transition={{
                      type: "spring",
                      stiffness: 155,
                      damping: 14,
                      mass: 0.95
                    }}
                    className="absolute inset-0 z-0 rounded-full bg-gradient-to-br from-blue-500/12 via-blue-400/8 to-indigo-500/10 dark:from-blue-500/22 dark:via-blue-400/12 dark:to-indigo-500/15 border border-blue-400/35 dark:border-blue-400/20 shadow-[0_4px_12px_rgba(59,130,246,0.12),inset_0_1px_3px_rgba(255,255,255,0.8)] dark:shadow-[0_4px_12px_rgba(59,130,246,0.2),inset_0_1px_2px_rgba(255,255,255,0.15)] pointer-events-none"
                  />
                  {/* Floating Highlight / Light-lens reflection (delayed & bouncy) */}
                  <motion.div
                    layoutId="liquidBottomRefraction"
                    transition={{
                      type: "spring",
                      stiffness: 225,
                      damping: 11,
                      mass: 0.55
                    }}
                    className="absolute inset-0 z-0 rounded-full pointer-events-none overflow-hidden"
                  >
                    <div className="absolute top-[2.5px] inset-x-[12%] h-[2.5px] bg-gradient-to-b from-white/85 to-transparent rounded-full opacity-95 filter blur-[0.2px]" />
                    <div className="absolute top-[4px] left-[15%] w-1.2 h-1.2 bg-white/100 rounded-full shadow-[0_0.5px_1px_rgba(255,255,255,0.5)]" />
                    <div className="absolute bottom-[2px] right-[20%] w-3.5 h-[1.2px] bg-white/35 rounded-full" />
                  </motion.div>
                </>
              )}
              <div className="relative z-10 flex items-center justify-center transition-transform duration-150">
                <MessageSquare className="w-4 h-4" />
                {unreadChatsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-extrabold border border-white dark:border-[#121214] shadow-[0_2px_6px_rgba(239,68,68,0.4)]">
                    {unreadChatsCount}
                  </span>
                )}
              </div>
              <span className="relative z-10 text-[9px] uppercase tracking-wider font-extrabold leading-none mt-0.5">
                Chats
              </span>
            </button>

            {/* Tab 2: Contacts */}
            <button
              onClick={() => {
                setShowUsers(true);
                setShowSettings(false);
                try {
                  if (navigator.vibrate) navigator.vibrate(10);
                } catch (e) {}
              }}
              className={`relative flex-1 flex flex-col items-center gap-[2px] py-1.5 z-10 rounded-full cursor-pointer select-none origin-center transition-all duration-300 active:scale-95 hover:scale-[1.02] ${
                showUsers && !showSettings
                  ? "text-blue-600 dark:text-blue-400 font-extrabold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white opacity-85"
              }`}
            >
              {showUsers && !showSettings && (
                <>
                  {/* Base Water Droplet Layer */}
                  <motion.div
                    layoutId="liquidBottomBase"
                    transition={{
                      type: "spring",
                      stiffness: 155,
                      damping: 14,
                      mass: 0.95
                    }}
                    className="absolute inset-0 z-0 rounded-full bg-gradient-to-br from-blue-500/12 via-blue-400/8 to-indigo-500/10 dark:from-blue-500/22 dark:via-blue-400/12 dark:to-indigo-500/15 border border-blue-400/35 dark:border-blue-400/20 shadow-[0_4px_12px_rgba(59,130,246,0.12),inset_0_1px_3px_rgba(255,255,255,0.8)] dark:shadow-[0_4px_12px_rgba(59,130,246,0.2),inset_0_1px_2px_rgba(255,255,255,0.15)] pointer-events-none"
                  />
                  {/* Floating Highlight / Light-lens reflection (delayed & bouncy) */}
                  <motion.div
                    layoutId="liquidBottomRefraction"
                    transition={{
                      type: "spring",
                      stiffness: 225,
                      damping: 11,
                      mass: 0.55
                    }}
                    className="absolute inset-0 z-0 rounded-full pointer-events-none overflow-hidden"
                  >
                    <div className="absolute top-[2.5px] inset-x-[12%] h-[2.5px] bg-gradient-to-b from-white/85 to-transparent rounded-full opacity-95 filter blur-[0.2px]" />
                    <div className="absolute top-[4px] left-[15%] w-1.2 h-1.2 bg-white/100 rounded-full shadow-[0_0.5px_1px_rgba(255,255,255,0.5)]" />
                    <div className="absolute bottom-[2px] right-[20%] w-3.5 h-[1.2px] bg-white/35 rounded-full" />
                  </motion.div>
                </>
              )}
              <div className="relative z-10 flex items-center justify-center transition-transform duration-150">
                <Users className="w-4 h-4" />
              </div>
              <span className="relative z-10 text-[9px] uppercase tracking-wider font-extrabold leading-none mt-0.5">
                Contacts
              </span>
            </button>

            {/* Tab 3: Settings */}
            <button
              onClick={() => {
                setShowSettings(true);
                setShowUsers(false);
                try {
                  if (navigator.vibrate) navigator.vibrate(10);
                } catch (e) {}
              }}
              className={`relative flex-1 flex flex-col items-center gap-[2px] py-1.5 z-10 rounded-full cursor-pointer select-none origin-center transition-all duration-300 active:scale-95 hover:scale-[1.02] ${
                showSettings
                  ? "text-blue-600 dark:text-blue-400 font-extrabold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white opacity-85"
              }`}
            >
              {showSettings && (
                <>
                  {/* Base Water Droplet Layer */}
                  <motion.div
                    layoutId="liquidBottomBase"
                    transition={{
                      type: "spring",
                      stiffness: 155,
                      damping: 14,
                      mass: 0.95
                    }}
                    className="absolute inset-0 z-0 rounded-full bg-gradient-to-br from-blue-500/12 via-blue-400/8 to-indigo-500/10 dark:from-blue-500/22 dark:via-blue-400/12 dark:to-indigo-500/15 border border-blue-400/35 dark:border-blue-400/20 shadow-[0_4px_12px_rgba(59,130,246,0.12),inset_0_1px_3px_rgba(255,255,255,0.8)] dark:shadow-[0_4px_12px_rgba(59,130,246,0.2),inset_0_1px_2px_rgba(255,255,255,0.15)] pointer-events-none"
                  />
                  {/* Floating Highlight / Light-lens reflection (delayed & bouncy) */}
                  <motion.div
                    layoutId="liquidBottomRefraction"
                    transition={{
                      type: "spring",
                      stiffness: 225,
                      damping: 11,
                      mass: 0.55
                    }}
                    className="absolute inset-0 z-0 rounded-full pointer-events-none overflow-hidden"
                  >
                    <div className="absolute top-[2.5px] inset-x-[12%] h-[2.5px] bg-gradient-to-b from-white/85 to-transparent rounded-full opacity-95 filter blur-[0.2px]" />
                    <div className="absolute top-[4px] left-[15%] w-1.2 h-1.2 bg-white/100 rounded-full shadow-[0_0.5px_1px_rgba(255,255,255,0.5)]" />
                    <div className="absolute bottom-[2px] right-[20%] w-3.5 h-[1.2px] bg-white/35 rounded-full" />
                  </motion.div>
                </>
              )}
              <div className="relative z-10 flex items-center justify-center transition-transform duration-150">
                <Settings className="w-4 h-4" />
              </div>
              <span className="relative z-10 text-[9px] uppercase tracking-wider font-extrabold leading-none mt-0.5">
                Settings
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div
        className={`flex-1 relative z-10 min-w-0 liquid-glass-panel border border-white/45 dark:border-white/10 rounded-[28px] shadow-xl shadow-black/2 dark:shadow-black/15 overflow-hidden ${activeChatId || showSettings ? "flex flex-col" : "hidden md:flex flex-col"}`}
      >
        <AnimatePresence mode="wait">
          {showSettings && myProfile ? (
            <motion.div
              key="settings-view"
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="flex-1 flex flex-col min-w-0 h-full overflow-hidden"
            >
              <SettingsView
                profile={myProfile}
                initialPhoto={myProfile.photoURL || ""}
                onClose={() => setShowSettings(false)}
              />
            </motion.div>
          ) : activeChatId ? (
            <motion.div
              key={`chat-view-${activeChatId}`}
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="flex-1 flex flex-col min-w-0 h-full overflow-hidden"
            >
              <ChatView
                chat={chats.find((c) => c.id === activeChatId)}
                profiles={profiles}
                onBack={() => setActiveChatId(null)}
                presetText={presetText}
                onClearPreset={() => setPresetText("")}
                externalSearchQuery={externalSearchQuery}
                onClearSearchQuery={() => setExternalSearchQuery("")}
                isFocusMode={isFocusMode}
                onToggleFocusMode={() => setIsFocusMode((prev) => !prev)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="bento-home"
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.97 }}
              variants={bentoContainerVariants}
              className="flex-1 h-full flex flex-col justify-between p-6 md:p-12 overflow-y-auto bg-transparent relative scrollbar-hide z-10"
            >
            <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full py-8 space-y-10 md:space-y-12">
              {/* Hero Greeting Panel */}
              <motion.div
                variants={bentoItemVariants}
                className="text-center space-y-3.5 select-none"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 dark:bg-blue-400/10 border border-blue-400/20 rounded-full text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider shadow-sm">
                  <Layers className="w-3.5 h-3.5 text-blue-550 animate-pulse" />
                  NirmTalk V4 Active
                </div>

                <h1 className="font-display font-extrabold text-4xl md:text-6xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-blue-650 to-indigo-650 dark:from-white dark:via-blue-400 dark:to-indigo-300 drop-shadow-[0_2px_10px_rgba(255,255,255,0.05)]">
                  {new Date().getHours() < 12
                    ? "Good Morning"
                    : new Date().getHours() < 17
                      ? "Good Afternoon"
                      : "Good Evening"}
                </h1>

                <p className="text-[15px] md:text-[17px] text-slate-500 dark:text-slate-350 font-medium max-w-lg mx-auto leading-relaxed">
                  Welcome to{" "}
                  <span className="font-bold text-slate-800 dark:text-white">
                    NirmTalk
                  </span>
                  . A new dimension of communication suspended in highly
                  responsive smart liquid glass.
                </p>
              </motion.div>

              {/* Quick Search Entry Point */}
              <motion.div
                variants={bentoItemVariants}
                onClick={() => {
                  setIsSearchingChats(true);
                  try {
                    if (navigator.vibrate) navigator.vibrate(10);
                  } catch (e) {}
                }}
                className="w-full max-w-lg cursor-pointer bg-white/25 dark:bg-white/5 border border-white/35 dark:border-white/10 hover:border-blue-500/40 dark:hover:border-blue-400/40 hover:bg-white/40 dark:hover:bg-white/10 p-1.5 rounded-full backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 pl-4">
                  <Search className="w-4.5 h-4.5 text-slate-400" />
                  <span className="text-[14px] text-slate-500 dark:text-slate-400 font-medium">
                    Search chats or start Typing...
                  </span>
                </div>
                <div className="px-3.5 py-1.5 bg-blue-500 dark:bg-blue-500/25 text-white dark:text-blue-350 rounded-full text-xs font-bold shadow-md shadow-blue-500/10">
                  Find chat
                </div>
              </motion.div>

              {/* Bento Suggestions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
                {/* Card 1: Contact Selection */}
                <motion.div
                  variants={bentoItemVariants}
                  whileHover={{ scale: 1.03, y: -4, transition: { type: "spring", stiffness: 350, damping: 20 } }}
                  whileTap={{ scale: 0.97, transition: { type: "spring", stiffness: 500, damping: 15 } }}
                  onClick={() => {
                    setShowUsers(true);
                    setIsCreatingGroup(false);
                  }}
                  className="p-5 flex flex-col justify-between text-left rounded-3xl cursor-pointer bg-white/20 dark:bg-white/5 backdrop-blur-xl border border-white/35 dark:border-white/10 hover:border-blue-500/45 dark:hover:border-blue-400/40 hover:bg-white/40 dark:hover:bg-white/10 shadow-lg group transition-all duration-300"
                  style={{ willChange: "transform, opacity" }}
                >
                  <div>
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-500 flex items-center justify-center text-white mb-4 shadow-md">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-[16px] text-slate-850 dark:text-white">
                      Start Direct Chat
                    </h3>
                    <p className="text-[13.5px] text-slate-500 dark:text-slate-350 mt-1.5 font-medium leading-relaxed">
                      Connect securely with friends inside high-contrast floating
                      glass bubbles with layered transparency.
                    </p>
                  </div>
                  <div className="mt-4 text-xs font-semibold text-blue-600 dark:text-blue-450 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    View Contacts <span>&rarr;</span>
                  </div>
                </motion.div>

                {/* Card 2: Groups */}
                <motion.div
                  variants={bentoItemVariants}
                  whileHover={{ scale: 1.03, y: -4, transition: { type: "spring", stiffness: 350, damping: 20 } }}
                  whileTap={{ scale: 0.97, transition: { type: "spring", stiffness: 500, damping: 15 } }}
                  onClick={() => {
                    setShowUsers(true);
                    setIsCreatingGroup(true);
                  }}
                  className="p-5 flex flex-col justify-between text-left rounded-3xl cursor-pointer bg-white/20 dark:bg-white/5 backdrop-blur-xl border border-white/35 dark:border-white/10 hover:border-blue-500/45 dark:hover:border-blue-400/40 hover:bg-white/40 dark:hover:bg-white/10 shadow-lg group transition-all duration-300"
                  style={{ willChange: "transform, opacity" }}
                >
                  <div>
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white mb-4 shadow-md">
                      <Users className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-[16px] text-slate-850 dark:text-white">
                      Create Group Space
                    </h3>
                    <p className="text-[13.5px] text-slate-500 dark:text-slate-350 mt-1.5 font-medium leading-relaxed">
                      Organize channels and collaborative capsules with fine-tuned
                      audio sharing and live reactions.
                    </p>
                  </div>
                  <div className="mt-4 text-xs font-semibold text-blue-600 dark:text-blue-450 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Launch Channel <span>&rarr;</span>
                  </div>
                </motion.div>

                {/* Card 3: Settings */}
                <motion.div
                  variants={bentoItemVariants}
                  whileHover={{ scale: 1.03, y: -4, transition: { type: "spring", stiffness: 350, damping: 20 } }}
                  whileTap={{ scale: 0.97, transition: { type: "spring", stiffness: 500, damping: 15 } }}
                  onClick={() => setShowSettings(true)}
                  className="p-5 flex flex-col justify-between text-left rounded-3xl cursor-pointer bg-white/20 dark:bg-white/5 backdrop-blur-xl border border-white/35 dark:border-white/10 hover:border-slate-500/45 dark:hover:border-white/25 hover:bg-white/40 dark:hover:bg-white/10 shadow-lg group transition-all duration-300"
                  style={{ willChange: "transform, opacity" }}
                >
                  <div>
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-900 dark:from-slate-650 dark:to-slate-800 flex items-center justify-center text-white mb-4 shadow-md">
                      <Settings className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-[16px] text-slate-850 dark:text-white">
                      Experience Settings
                    </h3>
                    <p className="text-[13.5px] text-slate-500 dark:text-slate-350 mt-1.5 font-medium leading-relaxed">
                      Adjust active themes, background sky scenery, custom wall
                      files, bio cards, and profile setups.
                    </p>
                  </div>
                  <div className="mt-4 text-xs font-semibold text-blue-600 dark:text-blue-450 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Personalize App <span>&rarr;</span>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Footer end-to-end indicator */}
            <div className="text-center text-slate-400 dark:text-slate-500 text-[12px] flex flex-col items-center gap-1 mt-6 shrink-0">
              <div className="flex items-center gap-1.5 justify-center font-bold">
                <Lock className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                <span className="uppercase tracking-widest text-[10px]">
                  Apple-grade Encrypted
                </span>
              </div>
              <span className="text-[11px] opacity-70">
                NirmTalk v4 &bull; Crafted with absolute love &bull; Nirmalya
              </span>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
      <CallOverlay profiles={profiles} />

      <CommandCenter
        isOpen={isCommandCenterOpen}
        onClose={() => setIsCommandCenterOpen(false)}
        chats={chats}
        profiles={profiles}
        onSelectChat={(chatId) => {
          setActiveChatId(chatId);
          setIsCommandCenterOpen(false);
        }}
        onStartFocusMode={() => {
          setIsFocusMode((prev) => !prev);
          try {
            if (navigator.vibrate) navigator.vibrate(15);
          } catch (e) {}
        }}
        isFocusMode={isFocusMode}
        onOpenSettings={() => {
          setShowSettings(true);
          setActiveChatId(null);
          setIsCommandCenterOpen(false);
        }}
        onOpenNewChat={() => {
          setShowUsers(true);
          setIsCreatingGroup(false);
          setIsCommandCenterOpen(false);
        }}
        onTriggerSemanticSearch={(query) => {
          if (!activeChatId) {
            alert(
              "Please select a conversation first to perform semantic AI search.",
            );
            return;
          }
          setExternalSearchQuery(query);
          setIsCommandCenterOpen(false);
        }}
        onTriggerRecap={() => {
          if (!activeChatId) {
            alert(
              "Please select a conversation first to perform a recap summary.",
            );
            return;
          }
          window.dispatchEvent(new CustomEvent("trigger-recap"));
          setIsCommandCenterOpen(false);
        }}
        onOpenNewPoll={() => {
          if (!activeChatId) {
            alert("Please select a conversation first to build a poll.");
            return;
          }
          window.dispatchEvent(new CustomEvent("trigger-poll"));
          setIsCommandCenterOpen(false);
        }}
      />

      {/* Custom confirm modal for deleting chats safely within cross-origin iFrames */}
      <ConfirmModal
        isOpen={deleteTargetChat !== null}
        title={
          deleteTargetChat?.type === "group"
            ? "Delete Group Chat?"
            : "Delete Chat?"
        }
        message={
          deleteTargetChat?.type === "group"
            ? `Are you sure you want to delete the group chat "${deleteTargetChat?.name || "Group Chat"}" and all messages for all members? This action is permanent.`
            : `Are you sure you want to delete your chat and all messages from both sides? This action is permanent.`
        }
        confirmLabel="Confirm Delete"
        cancelLabel="Keep Chat"
        onConfirm={async () => {
          if (!deleteTargetChat) return;
          const cid = deleteTargetChat.id;
          console.log(
            `[DELETE_PROCESS] User confirmed delete. Target Chat ID is: "${cid}"`,
          );
          setDeleteTargetChat(null);
          try {
            await deleteChat(cid);
            if (activeChatId === cid) {
              setActiveChatId(null);
            }
          } catch (err: any) {
            console.error(
              "[DELETE_PROCESS] Error caught while running database delete:",
              err,
            );
          }
        }}
        onCancel={() => {
          console.log("[DELETE_PROCESS] User canceled delete operation.");
          setDeleteTargetChat(null);
        }}
      />
    </div>
  );
}
