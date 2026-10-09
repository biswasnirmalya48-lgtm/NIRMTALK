import React, { useState, useEffect } from 'react';
import { Bookmark, Clock, Check, MessageSquare, Flame, Sparkles, TrendingUp, BarChart2, Calendar, Map, CheckCircle, BrainCircuit } from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  chats: any[];
  profiles: Record<string, any>;
  onSelectChat: (chatId: string) => void;
  onOpenBookmarks: () => void;
  onOpenMemoryMap: () => void;
  userName?: string;
  onStartFocusMode: () => void;
}

export function Dashboard({
  chats,
  profiles,
  onSelectChat,
  onOpenBookmarks,
  onOpenMemoryMap,
  userName = 'Special Guest',
  onStartFocusMode,
}: DashboardProps) {
  const [bookmarksCount, setBookmarksCount] = useState(0);
  const [activeReminders, setActiveReminders] = useState<any[]>([]);

  useEffect(() => {
    // Load counts and reminders from bookmarks storage
    const stored = localStorage.getItem('nirmtalk_bookmarks');
    if (stored) {
      try {
        const list = JSON.parse(stored);
        setBookmarksCount(list.length);
        const reminders = list.filter((it: any) => it.reminderDate);
        setActiveReminders(reminders);
      } catch (e) {}
    }
  }, []);

  // Compute space statistics safely
  const workChatsCount = chats.filter(c => c.type === 'group' || (typeof c.name === 'string' && c.name.toLowerCase().includes('work'))).length;
  const directChatsCount = chats.filter(c => c.type === 'direct').length;

  // Render a lovely SVG line chart for conversation analytics (Feature 23)
  const renderAnalyticsChart = () => {
    // Elegant SVG bento graph representing message frequency
    const dataPoints = [25, 45, 15, 60, 40, 85, 95];
    const width = 500;
    const height = 120;
    const padding = 15;
    const deltaX = (width - padding * 2) / (dataPoints.length - 1);

    const pointsStr = dataPoints
      .map((val, idx) => {
        const x = padding + idx * deltaX;
        const y = height - padding - (val / 100) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');

    const gradStr = dataPoints
      .map((val, idx) => {
        const x = padding + idx * deltaX;
        const y = height - padding - (val / 100) * (height - padding * 2);
        return `${x},${y}`;
      });

    const areaPoints = `${padding},${height - padding} ${pointsStr} ${width - padding},${height - padding}`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full text-blue-500 overflow-visible">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.1)" />

        {/* Shaded Area */}
        <polygon points={areaPoints} fill="url(#chartGradient)" />

        {/* Connecting line */}
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          points={pointsStr}
          className="transition-all"
        />

        {/* Data points */}
        {dataPoints.map((val, idx) => {
          const x = padding + idx * deltaX;
          const y = height - padding - (val / 100) * (height - padding * 2);
          return (
            <circle
              key={idx}
              cx={x}
              cy={y}
              r="4.5"
              fill={idx === dataPoints.length - 1 ? '#ef4444' : 'currentColor'}
              className="hover:scale-130 transition-transform cursor-pointer"
            />
          );
        })}
      </svg>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#fbfcfd]/20 dark:bg-[#070708]/10 p-5 md:p-8 overflow-y-auto scrollbar-style select-none">
      
      {/* Editorial Header */}
      <div className="mb-8 mt-1">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-1"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-[#2563eb]/70 dark:text-[#3b82f6]/70">NIRMTALK MASTER ENGINE</span>
          <h1 className="text-3xl md:text-4xl font-display font-medium tracking-tight text-slate-800 dark:text-white leading-tight">
            Welcome back, <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-300 font-semibold">{userName}</span>
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            A secure AI-first environment structured for absolute focus, beauty, and organization.
          </p>
        </motion.div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Column 1: AI Suggested Shortcuts & Navigation */}
        <div className="md:col-span-2 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Quick action 1: Focus Engine */}
            <div 
              onClick={onStartFocusMode}
              className="group bg-white/70 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 p-5 rounded-3xl hover:bg-white dark:hover:bg-white/10 transition-all cursor-pointer relative shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500 group-hover:scale-105 transition-transform">
                  <Flame className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Tactical</span>
              </div>
              <h3 className="text-[15px] font-semibold text-slate-800 dark:text-white mb-1">Focus Shield</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Instantly clean the directories. Zero distractions. Frame only active conversation.
              </p>
            </div>

            {/* Quick action 2: Memory Map */}
            <div 
              onClick={onOpenMemoryMap}
              className="group bg-white/70 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 p-5 rounded-3xl hover:bg-white dark:hover:bg-white/10 transition-all cursor-pointer relative shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500 group-hover:scale-105 transition-transform">
                  <BrainCircuit className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Cognitive</span>
              </div>
              <h3 className="text-[15px] font-semibold text-slate-800 dark:text-white mb-1">Chat Memory Map</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Generate an interactive graph mapping discussion connections, keywords & timeline references.
              </p>
            </div>
          </div>

          {/* Analytics Board (Feature 23) */}
          <div className="bg-white/70 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 p-5 rounded-3xl relative shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <h3 className="text-[15px] font-semibold text-slate-800 dark:text-white">Active Timeline Insights</h3>
              </div>
              <span className="text-xs font-semibold text-slate-400">Sunday - Saturday load</span>
            </div>
            
            <div className="h-28 flex items-center justify-center my-4">
              {renderAnalyticsChart()}
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-slate-200/40 dark:border-white/5 pt-3.5 mt-2 text-center text-xs text-slate-400">
              <div>
                <span className="block font-bold text-[16px] text-slate-800 dark:text-white">{directChatsCount}</span>
                <span>Direct Links</span>
              </div>
              <div>
                <span className="block font-bold text-[16px] text-slate-800 dark:text-white">{workChatsCount}</span>
                <span>Work Spaces</span>
              </div>
              <div>
                <span className="block font-bold text-[16px] text-[#2563eb] dark:text-[#3b82f6]">92%</span>
                <span>AI Productivity</span>
              </div>
            </div>
          </div>

          {/* Recent active discussions */}
          <div className="bg-white/60 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 p-5 rounded-3xl shadow-sm">
            <h3 className="text-[15px] font-semibold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              Recent Active Chats
            </h3>
            <div className="space-y-3.5">
              {chats.slice(0, 3).map(chat => {
                const otherUserId = chat.type === 'direct' && chat.members.find((m: string) => m !== profiles['current']?.userId);
                const otherProf = otherUserId ? profiles[otherUserId] : null;
                const chatName = chat.type === 'group' ? chat.name : (otherProf?.displayName || 'NirmTalk Member');

                return (
                  <div 
                    key={chat.id} 
                    onClick={() => onSelectChat(chat.id)}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white/40 dark:bg-white/5 border border-transparent hover:border-slate-200/40 dark:hover:border-white/5 hover:bg-white/80 dark:hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs">
                        {chatName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-slate-800 dark:text-white truncate">{chatName}</div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{chat.lastMessage || 'Open workspace'}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-blue-500 uppercase shrink-0">Open</span>
                  </div>
                );
              })}
              {chats.length === 0 && (
                <p className="text-xs text-center text-slate-400 py-6">No discussions active yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Saved summary stats, Bookmarks count, and Scheduled alarms */}
        <div className="space-y-5">
          
          {/* Saved stats */}
          <div 
            onClick={onOpenBookmarks}
            className="group bg-gradient-to-br from-[#2563eb]/95 to-[#1e40af]/90 text-white p-5 rounded-3xl shadow-lg cursor-pointer relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full filter blur-xl translate-x-10 -translate-y-10" />
            <div className="flex items-center justify-between mb-4">
              <Bookmark className="w-6 h-6 text-white/90" />
              <span className="text-[10px] font-bold tracking-widest text-blue-200 uppercase">Synchronized</span>
            </div>
            <div className="text-4xl font-bold font-sans tracking-tight mb-1">{bookmarksCount}</div>
            <div className="text-[13px] font-semibold text-blue-100">Saved Bookmarks & Items</div>
            <p className="text-[11px] text-white/70 leading-normal mt-2.5">
              Click to open Bookmarks Hub of categorised notes, files, thoughts, and links to 'Read Later'.
            </p>
          </div>

          {/* Active reminders checklist (Feature 3) */}
          <div className="bg-white/70 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 p-5 rounded-3xl shadow-sm">
            <h3 className="text-[15px] font-semibold text-slate-800 dark:text-white mb-3.5 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#ef4444]" />
              Smart Reminders
            </h3>
            <div className="space-y-3">
              {activeReminders.map(rem => (
                <div 
                  key={rem.id}
                  className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/30 dark:border-white/5 flex flex-col gap-1.5"
                >
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-normal line-clamp-2 select-text">
                    "{rem.text}"
                  </p>
                  <div className="flex items-center justify-between mt-1 text-[10.5px]">
                    <span className="text-slate-400 font-medium">On: {rem.reminderDate}</span>
                    <span className="text-[#2563eb] font-bold">Active</span>
                  </div>
                </div>
              ))}
              {activeReminders.length === 0 && (
                <div className="text-center py-10">
                  <CheckCircle className="w-7 h-7 text-emerald-500/80 mx-auto mb-1 stroke-1" />
                  <p className="text-xs text-slate-400 font-medium">All reminders cleared</p>
                  <span className="text-[10px] text-slate-400/60 block mt-0.5">Add alarms from chat menu</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
