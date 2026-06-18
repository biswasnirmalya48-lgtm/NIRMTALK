import { useState, useRef, useEffect } from 'react';
import { Bot, LogOut, Search, Users, Plus, X, MessageSquare, Settings, UserCircle, Save, Upload, Sparkles, Phone, Megaphone, Layers, FileText, Bookmark, Sun, Moon, Lock } from 'lucide-react';
import { useChats, useProfiles, createDirectChat, createGroupChat, updateUserProfile, getTimestampMillis } from '../hooks/useFirestore';
import { auth, logout } from '../firebase';
import { ChatView } from './ChatView';
import { SettingsView } from './SettingsView';
import { CallOverlay } from './CallOverlay';
import { motion, AnimatePresence } from 'motion/react';
import { DynamicScenery } from './DynamicScenery';
import { canMessage, getProfilePhoto } from '../utils/privacy';

export function MainLayout() {
  const profiles = useProfiles();
  const chats = useChats();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const currentUser = auth.currentUser;
  
  // States for tabs/overlays
  const [showUsers, setShowUsers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [search, setSearch] = useState('');
  
  const [isSearchingChats, setIsSearchingChats] = useState(false);
  const [chatTab, setChatTab] = useState('all');
  const [searchChats, setSearchChats] = useState('');
  
  const myProfile = currentUser ? profiles[currentUser.uid] : null;

  useEffect(() => {
    if (myProfile?.settings) {
      const { theme, fontSize } = myProfile.settings;
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const updateTheme = () => {
        const isDark = theme === 'dark' || (theme === 'auto' && mediaQuery.matches);
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      };

      updateTheme();
      
      if (theme === 'auto') {
        mediaQuery.addEventListener('change', updateTheme);
      }
      
      let sizeVar = '16px';
      if (fontSize === 'small') sizeVar = '14px';
      if (fontSize === 'large') sizeVar = '18px';
      document.documentElement.style.fontSize = sizeVar;
      
      return () => {
        mediaQuery.removeEventListener('change', updateTheme);
      };
    }
  }, [myProfile?.settings]);

  // Group creation state
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  const toggleTheme = async (e?: any) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!myProfile) return;
    const currentTheme = myProfile?.settings?.theme || 'auto';
    let newTheme: 'light' | 'dark' = 'dark';
    if (currentTheme === 'dark') {
      newTheme = 'light';
    } else if (currentTheme === 'light') {
      newTheme = 'dark';
    } else {
      newTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';
    }
    
    await updateUserProfile({
      settings: {
        ...(myProfile.settings || {}),
        theme: newTheme
      }
    });
  };

  const handleUserClick = async (userId: string) => {
    if (isCreatingGroup) {
       setSelectedUsers(prev => prev.includes(userId) ? prev.filter(u => u !== userId) : [...prev, userId]);
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
      setGroupName('');
    }
  };

  const profileList = Object.values(profiles) as any[];
  const filteredUsers = profileList.filter(p => 
    p.userId !== currentUser?.uid && 
    p.displayName.toLowerCase().includes(search.toLowerCase()) && 
    (currentUser ? canMessage(currentUser.uid, p, chats) : false)
  );

  const getChatName = (chat: any) => {
    if (chat.type === 'group') return chat.name || 'Group Chat';
    const otherId = chat.members.find((m: string) => m !== currentUser?.uid);
    return otherId && profiles[otherId] ? profiles[otherId].displayName : 'Unknown';
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

  const unreadChatsCount = chats.filter(isChatUnread).length;

  const displayChats = chats.filter(chat => {
    if (currentUser && chat.deletedBy?.[currentUser.uid]) return false;
    if (chatTab === 'unread') return isChatUnread(chat);
    if (chatTab === 'groups') return chat.type === 'group';
    return true;
  }).filter(chat => {
    if (!searchChats) return true;
    const name = getChatName(chat).toLowerCase();
    return name.includes(searchChats.toLowerCase());
  });
  const getChatPhoto = (chat: any) => {
    if (chat.type === 'group') return chat.photoURL || null;
    const otherId = chat.members.find((m: string) => m !== currentUser?.uid);
    return otherId && profiles[otherId] && currentUser ? getProfilePhoto(currentUser.uid, profiles[otherId], chats) : null;
  };

  return (
    <div className="flex h-screen bg-transparent text-slate-900 dark:text-slate-100 font-sans overflow-hidden relative">
      <DynamicScenery />
      
      {/* Left Navigation Sidebar */}
      <div className="hidden lg:flex flex-col w-[260px] bg-white/30 dark:bg-[#1a1a1c]/40 backdrop-blur-[40px] border-r border-white/30 dark:border-white/10 shadow-[1px_0_30px_rgba(0,0,0,0.03)] shrink-0 z-30 pt-6 pb-6 px-4">
         <div className="flex items-center justify-between px-2 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0">
                 <MessageSquare className="w-5 h-5"/>
              </div>
              <div>
                <h1 className="font-bold text-xl tracking-tight text-slate-900 dark:text-white leading-none">NirmTalk</h1>
                <p className="text-[11px] text-slate-500 font-medium mt-1 leading-tight">Instant Messenger</p>
              </div>
            </div>
         </div>

         <div className="flex-1 space-y-2">
            <button 
              onClick={() => { setActiveChatId(null); setShowSettings(false); }} 
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors ${!showSettings ? 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold' : 'hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 font-medium'}`}
            >
               <div className="flex items-center gap-3">
                 <MessageSquare className="w-5 h-5" />
                 <span>Chats</span>
               </div>
               <div className="bg-blue-500 text-white text-[11px] px-2 py-0.5 rounded-full font-bold">
                 {chats.filter(c => c.type === 'direct').length}
               </div>
            </button>
            <button onClick={() => { setShowSettings(true); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors mt-6 ${showSettings ? 'bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white font-semibold' : 'hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 font-medium'}`}>
               <Settings className="w-5 h-5" />
               <span>Settings</span>
            </button>
         </div>

         <div className="mt-auto pt-6 border-t border-slate-200/60 dark:border-white/10">
            <div className="mt-2 flex items-center justify-between p-2 hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-xl cursor-pointer transition-colors" onClick={() => setShowSettings(true)}>
               <div className="flex items-center gap-3">
                 {myProfile?.photoURL ? (
                   <img src={myProfile.photoURL} alt="Me" className="w-10 h-10 rounded-full object-cover shrink-0" />
                 ) : (
                   <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-lg shrink-0">
                     {myProfile?.displayName?.charAt(0).toUpperCase()}
                   </div>
                 )}
                 <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-[14px] text-slate-900 dark:text-white truncate">{myProfile?.displayName || 'User'}</span>
                    <span className="text-[12px] text-blue-500 font-medium truncate">Premium User</span>
                 </div>
               </div>
               <div className="flex items-center gap-2">
                 <button onClick={toggleTheme} className="p-1 hover:bg-slate-300 dark:hover:bg-white/10 rounded-full transition-colors text-slate-500">
                   {myProfile?.settings?.theme === 'dark' || (myProfile?.settings?.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
                 </button>
                 <Settings className="w-4 h-4 text-slate-400" />
               </div>
            </div>
         </div>
      </div>

      {/* Main Chats Sidebar */}
      <div className={`w-full md:w-[360px] bg-white/40 dark:bg-[#1a1a1c]/50 backdrop-blur-[40px] md:border-r border-white/30 dark:border-white/10 shadow-[1px_0_30px_rgba(0,0,0,0.03)] shrink-0 z-20 transition-transform duration-300 ease-out ${activeChatId || showSettings ? 'hidden md:flex flex-col' : 'flex flex-col'}`}>
        
        {/* Header */}
        <div className="pt-8 pb-4 px-6">
          {isSearchingChats ? (
            <div className="flex items-center gap-2 mb-6">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input 
                  type="text"
                  autoFocus
                  className="w-full bg-white/50 dark:bg-[#1a1a1c]/50 backdrop-blur-md shadow-sm border border-white/40 dark:border-white/10 text-[15px] text-slate-900 dark:text-white rounded-[16px] pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-400/30 transition-all placeholder-slate-500"
                  placeholder="Search chats..."
                  value={searchChats}
                  onChange={e => setSearchChats(e.target.value)}
                />
              </div>
              <button onClick={() => { setIsSearchingChats(false); setSearchChats(''); }} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5"/>
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
                    <img src={myProfile.photoURL} className="w-full h-full object-cover" />
                  ) : (
                    myProfile?.displayName?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <span className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white select-none">NirmTalk</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={toggleTheme} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
                  {myProfile?.settings?.theme === 'dark' || (myProfile?.settings?.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
                </button>
                <button onClick={() => setIsSearchingChats(true)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
                   <Search className="w-5 h-5"/>
                </button>
                <button 
                  onClick={() => { setShowUsers(!showUsers); setIsCreatingGroup(false); }}
                  className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
                >
                  {showUsers ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

          {!showUsers && !isSearchingChats && (
            <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide text-sm font-medium">
              <button onClick={() => setChatTab('all')} className={`relative px-1 pb-2 whitespace-nowrap transition-colors ${chatTab === 'all' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
                All
                {chatTab === 'all' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />}
              </button>
              <button onClick={() => setChatTab('unread')} className={`relative px-1 pb-2 whitespace-nowrap transition-colors flex items-center gap-1 ${chatTab === 'unread' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
                Unread {unreadChatsCount > 0 && <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{unreadChatsCount}</span>}
                {chatTab === 'unread' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />}
              </button>
              <button onClick={() => setChatTab('groups')} className={`relative px-1 pb-2 whitespace-nowrap transition-colors ${chatTab === 'groups' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
                Groups
                {chatTab === 'groups' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />}
              </button>
            </div>
          )}
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-hide mt-2">
          {showUsers ? (
            <div className="space-y-4 pt-1">
               <div className="px-2 space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input 
                      type="text"
                      className="w-full bg-white/50 dark:bg-[#1a1a1c]/50 backdrop-blur-md shadow-sm border border-white/40 dark:border-white/10 text-[15px] text-slate-900 dark:text-white rounded-[16px] pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-400/30 transition-all placeholder-slate-500"
                      placeholder="Search to start chat..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
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
                         <button onClick={() => { setIsCreatingGroup(false); setSelectedUsers([]); }} className="text-slate-400 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-white/5 p-1 rounded-full text-xs">
                           Cancel
                         </button>
                       </div>
                       <input 
                          type="text"
                          value={groupName}
                          onChange={e => setGroupName(e.target.value)}
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
                     <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }} key={user.userId}>
                       <button 
                          onClick={() => handleUserClick(user.userId)}
                          className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all text-left
                            ${isSelected ? 'bg-blue-500/10 dark:bg-blue-500/20' : 'hover:bg-slate-200/50 dark:hover:bg-white/5'}
                          `}
                       >
                          {currentUser && getProfilePhoto(currentUser.uid, user, chats) ? (
                            <img src={getProfilePhoto(currentUser.uid, user, chats)} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 bg-slate-200 dark:bg-[#2c2c2e] text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center font-semibold text-lg">
                              {user.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[15px] text-slate-900 dark:text-slate-100 truncate">{user.displayName}</div>
                            {user.username && <div className="text-[13px] text-slate-500 truncate mt-0.5">@{user.username}</div>}
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
                 const clearedTimeVal = chat.clearedHistory?.[currentUser?.uid || ''];
                  const clearedTime = clearedTimeVal ? getTimestampMillis(clearedTimeVal) : 0;
                 const showLastMessage = chatUpdateTime > clearedTime;
                 
                 return (
                   <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }} key={chat.id}>
                     <button 
                        onClick={() => setActiveChatId(chat.id)}
                        className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all text-left relative group
                          ${isActive ? 'bg-blue-500 text-white' : 'hover:bg-slate-200/50 dark:hover:bg-white/5'}
                        `}
                     >
                        {photo ? (
                          <img src={photo} className="w-12 h-12 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-semibold text-lg transition-colors
                             ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-[#2c2c2e] text-slate-600 dark:text-slate-300'}
                          `}>
                            {chat.type === 'group' ? <Users className="w-6 h-6" /> : name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                             <div className={`font-semibold text-[15px] truncate ${isActive ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                                {name}
                             </div>
                          </div>
                          <div className={`text-[14px] truncate mt-0.5 ${isActive ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                             {showLastMessage ? (chat.lastMessage || '...') : '...'}
                          </div>
                        </div>
                        {!isActive && isChatUnread(chat) && (
                           <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shrink-0 mr-1" />
                        )}
                     </button>
                   </motion.div>
                 );
               })}
            </div>
          )}
        </div>
      </div>
      
      {/* Main Area */}
      <div className={`flex-1 relative z-10 min-w-0 bg-transparent ${activeChatId || showSettings ? 'flex flex-col' : 'hidden md:flex flex-col'}`}>
        
        {showSettings && myProfile ? (
          <SettingsView profile={myProfile} initialPhoto={myProfile.photoURL || ''} onClose={() => setShowSettings(false)} />
        ) : activeChatId ? (
          <ChatView 
            chat={chats.find(c => c.id === activeChatId)} 
            profiles={profiles}
            onBack={() => setActiveChatId(null)}
          />
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="flex-1 h-full flex flex-col items-center justify-center text-slate-500 bg-transparent relative">
             <div className="flex-1 flex flex-col items-center justify-center">
               <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }} className="w-24 h-24 mb-6 rounded-[36px] bg-white/40 dark:bg-[#1a1a1c]/50 backdrop-blur-3xl shadow-2xl shadow-black/5 flex items-center justify-center border border-white/40 dark:border-white/10">
                 <MessageSquare className="w-10 h-10 text-slate-800 dark:text-slate-200" />
               </motion.div>
               <div className="text-center space-y-1">
                 <h2 className="text-xl font-medium text-slate-900 dark:text-white tracking-tight">Messages</h2>
                 <p className="text-[15px] text-slate-500">Pick a chat to start messaging</p>
               </div>
             </div>
             <div className="absolute bottom-8 text-center text-slate-400 dark:text-slate-500 text-[13px] flex flex-col items-center gap-1">
               <div className="flex items-center gap-1.5 justify-center font-medium">
                 <Lock className="w-3.5 h-3.5" />
                 <span>End-to-end encrypted</span>
               </div>
               <span className="text-[12px] opacity-70 mt-1">Made with love by Nirmalya</span>
             </div>
          </motion.div>
        )}
      </div>
      <CallOverlay profiles={profiles} />
    </div>
  );
}
