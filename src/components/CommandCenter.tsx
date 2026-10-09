import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, MessageSquare, Settings, Plus, Sparkles, Pin, Bookmark, Lightbulb, CheckSquare, EyeOff, Layout, FileText, Compass, ListCollapse } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  chats: any[];
  profiles: Record<string, any>;
  onSelectChat: (chatId: string) => void;
  onStartFocusMode: () => void;
  isFocusMode: boolean;
  onOpenSettings: () => void;
  onOpenNewChat: () => void;
  onTriggerSemanticSearch: (query: string) => void;
  onTriggerRecap: () => void;
  onOpenNewPoll: () => void;
}

export function CommandCenter({
  isOpen,
  onClose,
  chats,
  profiles,
  onSelectChat,
  onStartFocusMode,
  isFocusMode,
  onOpenSettings,
  onOpenNewChat,
  onTriggerSemanticSearch,
  onTriggerRecap,
  onOpenNewPoll
}: CommandCenterProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // Handled by parent but toggle safety
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Custom static commands
  const commands = [
    { id: 'focus', title: isFocusMode ? 'Disable Focus Mode' : 'Enable Focus Mode', desc: 'Hide distractions and sidebar', icon: EyeOff, action: onStartFocusMode },
    { id: 'poll', title: 'Create Advanced Poll', desc: 'Create a single/multiple choice interactive poll', icon: CheckSquare, action: onOpenNewPoll },
    { id: 'recap', title: 'AI Conversation Recap', desc: 'Summarize decisions & major timeline of active chat', icon: Sparkles, action: onTriggerRecap },
    { id: 'new_chat', title: 'Start New Conversation', desc: 'Chat with friends', icon: Plus, action: onOpenNewChat },
    { id: 'settings', title: 'Open Settings', desc: 'Manage your profile and appearance', icon: Settings, action: onOpenSettings },
  ];

  // Filter chats & commands
  const filteredChats = chats.filter(chat => {
    const chatName = chat.name || (chat.type === 'direct' && chat.members.find((m: string) => m !== 'current')?.displayName) || 'Direct Chat';
    return chatName.toLowerCase().includes(query.toLowerCase());
  }).slice(0, 4);

  const filteredCommands = commands.filter(cmd => 
    cmd.title.toLowerCase().includes(query.toLowerCase()) || 
    cmd.desc.toLowerCase().includes(query.toLowerCase())
  );

  const totalItems = filteredCommands.length + filteredChats.length + (query.trim().length > 3 ? 1 : 0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeSelection();
    }
  };

  const executeSelection = () => {
    if (query.trim().length > 3 && selectedIndex === 0) {
      // Trigger Semantic Search first if the query is a long search
      onTriggerSemanticSearch(query);
      onClose();
      return;
    }

    const offset = query.trim().length > 3 ? 1 : 0;
    const commandIndex = selectedIndex - offset;

    if (commandIndex >= 0 && commandIndex < filteredCommands.length) {
      filteredCommands[commandIndex].action();
      onClose();
    } else {
      const chatIndex = commandIndex - filteredCommands.length;
      if (chatIndex >= 0 && chatIndex < filteredChats.length) {
        onSelectChat(filteredChats[chatIndex].id);
        onClose();
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md z-[200] flex items-start justify-center pt-[12vh] p-4"
          onClick={onClose}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-xl glass-protective-panel overflow-hidden rounded-3xl shadow-2xl border border-white/20 dark:border-white/10"
            onClick={e => e.stopPropagation()}
          >
          {/* Spotlight Search Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200/50 dark:border-white/10">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input 
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Search or ask anything... (e.g. /poll, focus)"
              className="w-full bg-transparent border-none text-[15px] focus:outline-none focus:ring-0 text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 bg-slate-100 dark:bg-white/10 text-[11px] font-medium text-slate-400 rounded-md border border-slate-200/30 dark:border-white/5">
              <span>ESC</span>
            </kbd>
          </div>

          {/* Results List */}
          <div className="max-h-[380px] overflow-y-auto p-2 scrollbar-style">
            {totalItems === 0 && (
              <div className="py-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                <Command className="w-8 h-8 opacity-60 animate-pulse" />
                <p>No commands or conversations matched "{query}"</p>
              </div>
            )}

            {/* Semantic AI Search Shortcut */}
            {query.trim().length > 3 && (
              <div 
                onClick={() => { onTriggerSemanticSearch(query); onClose(); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer text-left transition-all ${
                  selectedIndex === 0 
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/10' 
                    : 'hover:bg-slate-100/50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-350'
                }`}
              >
                <div className="p-2 bg-blue-500/20 rounded-full text-blue-500">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Ask AI Semantic Search</div>
                  <div className={`text-xs ${selectedIndex === 0 ? 'text-white/80' : 'text-slate-400'}`}>
                    Find messages resembling: "{query}" by meaning
                  </div>
                </div>
              </div>
            )}

            {/* Commands Section */}
            {filteredCommands.length > 0 && (
              <div className="mt-1">
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                  Quick Actions
                </div>
                {filteredCommands.map((cmd, i) => {
                  const itemIndex = (query.trim().length > 3 ? 1 : 0) + i;
                  const isSelected = selectedIndex === itemIndex;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => { cmd.action(); onClose(); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-left transition-all ${
                        isSelected 
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/10' 
                          : 'hover:bg-slate-150/70 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <cmd.icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[13.5px]">{cmd.title}</div>
                        <div className={`text-[11.5px] truncate ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                          {cmd.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Conversations Section */}
            {filteredChats.length > 0 && (
              <div className="mt-3">
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                  Recent Discussions
                </div>
                {filteredChats.map((chat, i) => {
                  const itemIndex = (query.trim().length > 3 ? 1 : 0) + filteredCommands.length + i;
                  const isSelected = selectedIndex === itemIndex;

                  // Resolve chat display details safely
                  const otherMemberId = chat.type === 'direct' && chat.members.find((m: string) => m !== 'current_dummy');
                  const otherMember = otherMemberId ? profiles[otherMemberId] : null;
                  const chatName = chat.type === 'group' ? chat.name : (otherMember?.displayName || 'Direct Chat');

                  return (
                    <button
                      key={chat.id}
                      onClick={() => { onSelectChat(chat.id); onClose(); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-left transition-all ${
                        isSelected 
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/10' 
                          : 'hover:bg-slate-150/70 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <MessageSquare className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[13.5px] truncate">{chatName}</div>
                        <div className={`text-[11.5px] truncate ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                          {chat.lastMessage || 'Open discussion'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
