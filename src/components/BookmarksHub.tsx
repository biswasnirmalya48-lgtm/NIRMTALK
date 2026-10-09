import React, { useState, useEffect } from 'react';
import { Bookmark, Clock, Check, FolderPlus, Trash2, Search, ArrowRight, Share, Calendar, Sparkles, Tag, Layers, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BookmarksHubProps {
  onClose: () => void;
  onPostPresetText?: (text: string) => void;
}

export interface SavedItem {
  id: string;
  text: string;
  senderName: string;
  senderPhoto?: string;
  timestamp: string;
  category: 'work' | 'ideas' | 'personal' | 'read_later' | 'knowledge';
  reminderDate?: string;
}

export function BookmarksHub({ onClose, onPostPresetText }: BookmarksHubProps) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [filterCategory, setFilterCategory] = useState<'all' | 'work' | 'ideas' | 'personal' | 'read_later' | 'knowledge'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Custom Date selection for Reminder
  const [schedulingItem, setSchedulingItem] = useState<SavedItem | null>(null);
  const [reminderTimeStr, setReminderTimeStr] = useState('');

  // Loaded from LocalStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('nirmtalk_bookmarks');
    if (stored) {
      try {
        setItems(JSON.parse(stored));
      } catch (err) { }
    } else {
      // Seed nice initial bookmarks/reminders so the feature is alive!
      const initialSeed: SavedItem[] = [
        {
          id: 'seed-1',
          text: "Can we schedule the logo design discussion for Wednesday at 5 PM? We need high-res assets.",
          senderName: "System Notification",
          timestamp: new Date(Date.now() - 3600000).toLocaleString(),
          category: 'work',
        },
        {
          id: 'seed-2',
          text: "Idea: We could add a custom liquid background gradient to represent different moods of chat.",
          senderName: "Personal Scratchpad",
          timestamp: new Date().toLocaleString(),
          category: 'ideas',
        },
        {
          id: 'seed-3',
          text: "Read later list: 'The Art of Simplicity in visionOS' article on typography pairing.",
          senderName: "Read Later Space",
          timestamp: new Date().toLocaleString(),
          category: 'read_later',
        }
      ];
      setItems(initialSeed);
      localStorage.setItem('nirmtalk_bookmarks', JSON.stringify(initialSeed));
    }
  }, []);

  const saveItemsList = (updated: SavedItem[]) => {
    setItems(updated);
    localStorage.setItem('nirmtalk_bookmarks', JSON.stringify(updated));
  };

  const handleDelete = (id: string) => {
    const updated = items.filter(it => it.id !== id);
    saveItemsList(updated);
  };

  const handleAddCategory = (id: string, newCat: SavedItem['category']) => {
    const updated = items.map(it => it.id === id ? { ...it, category: newCat } : it);
    saveItemsList(updated);
  };

  // Schedule a dynamic reminder
  const handleScheduleReminder = (it: SavedItem, type: 'tonight' | 'tomorrow' | 'custom', customTime?: string) => {
    let dateStr = '';
    const now = new Date();
    if (type === 'tonight') {
      const tonight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
      dateStr = tonight.toLocaleString();
    } else if (type === 'tomorrow') {
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0);
      dateStr = tomorrow.toLocaleString();
    } else if (type === 'custom' && customTime) {
      dateStr = new Date(customTime).toLocaleString();
    }

    const updated = items.map(orig => orig.id === it.id ? { ...orig, reminderDate: dateStr } : orig);
    saveItemsList(updated);
    setSchedulingItem(null);
    setReminderTimeStr('');
  };

  const filtered = items.filter(it => {
    const matchesCategory = filterCategory === 'all' || it.category === filterCategory;
    const matchesSearch = it.text.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          it.senderName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]/40 dark:bg-[#0c0c0e]/40 backdrop-blur-3xl p-4 md:p-6 overflow-hidden relative">
      <div className="flex items-center justify-between mb-4 mt-1 md:mt-2">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-bold font-sans text-slate-900 dark:text-white tracking-tight">Bookmarks Hub</h2>
        </div>
        <button 
          onClick={onClose}
          className="p-1 px-3 text-xs font-semibold bg-slate-150 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 rounded-full text-slate-600 dark:text-slate-300 transition-colors"
        >
          Exit Hub
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-1 mb-4 border-b border-slate-200/40 dark:border-white/5 shrink-0">
        {(['all', 'work', 'ideas', 'personal', 'read_later', 'knowledge'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-all border shrink-0 ${
              filterCategory === cat
                ? 'bg-blue-500/10 border-blue-400/30 text-blue-600 dark:text-blue-400'
                : 'bg-white/30 dark:bg-white/5 border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/10'
            }`}
          >
            {cat === 'all' ? 'All Saved' : cat.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative mb-5 shrink-0">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search saved bookmarks..."
          className="w-full text-sm font-medium bg-white/40 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl py-2 px-10 focus:outline-none focus:ring-0 text-slate-800 dark:text-white placeholder-slate-400"
        />
      </div>

      {/* Bookmarks List */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 scrollbar-style">
        {filtered.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center text-slate-400">
            <Bookmark className="w-10 h-10 stroke-1 mb-2 opacity-50" />
            <p className="text-sm font-medium">No bookmarks or read items saved here</p>
            <p className="text-xs text-slate-400/70 mt-1 max-w-[200px]">Long press any chat message to save or add reminders</p>
          </div>
        ) : (
          filtered.map(it => (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              key={it.id}
              className="bg-white/65 dark:bg-white/5 border border-slate-250/20 dark:border-white/10 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-300">{it.senderName}</span>
                </div>
                <span className="text-[10px] text-slate-400">{it.timestamp}</span>
              </div>

              {/* Saved message text */}
              <p className="text-[14px] text-slate-700 dark:text-slate-200 font-normal leading-relaxed mb-3 whitespace-pre-wrap select-text">
                {it.text}
              </p>

              {/* Scheduled Reminder Status */}
              {it.reminderDate && (
                <div className="mb-3 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-500" />
                    Reminder: {it.reminderDate}
                  </span>
                  <button 
                    onClick={() => {
                      const updated = items.map(orig => orig.id === it.id ? { ...orig, reminderDate: undefined } : orig);
                      saveItemsList(updated);
                    }}
                    className="text-[10px] text-red-500 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Action Rows */}
              <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-white/5 pt-3">
                <div className="flex items-center gap-1.5">
                  {(['work', 'ideas', 'read_later'] as const).map(c => (
                    <button
                      key={c}
                      onClick={() => handleAddCategory(it.id, c)}
                      className={`px-2 py-0.5 border text-[10px] font-semibold rounded-full capitalize transition-all ${
                        it.category === c
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {c.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {onPostPresetText && (
                    <button
                      onClick={() => onPostPresetText(it.text)}
                      className="p-1 px-2.5 rounded-full text-[11px] font-bold bg-blue-500/10 border border-blue-400/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all flex items-center gap-1"
                      title="Use text in current debate"
                    >
                      Paste
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => setSchedulingItem(schedulingItem?.id === it.id ? null : it)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors relative"
                    title="Smart Alarm"
                  >
                    <Clock className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(it.id)}
                    className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-all"
                    title="Untrack Message"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Sub-modal: Quick Reminder Setter */}
              <AnimatePresence>
                {schedulingItem?.id === it.id && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mt-3 p-3 bg-slate-100/50 dark:bg-white/5 rounded-2xl border border-slate-200/50 dark:border-white/10"
                  >
                    <div className="text-[11.5px] font-bold text-slate-500 tracking-wider uppercase mb-2">Set Reminder Time</div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button 
                        onClick={() => handleScheduleReminder(it, 'tonight')}
                        className="p-2 py-1.5 text-xs font-semibold bg-white dark:bg-white/10 border rounded-xl hover:bg-slate-100 text-slate-700 dark:text-white"
                      >
                        Tonight (8:00 PM)
                      </button>
                      <button 
                        onClick={() => handleScheduleReminder(it, 'tomorrow')}
                        className="p-2 py-1.5 text-xs font-semibold bg-white dark:bg-white/10 border rounded-xl hover:bg-slate-100 text-slate-700 dark:text-white"
                      >
                        Tomorrow (9:00 AM)
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="datetime-local"
                        value={reminderTimeStr}
                        onChange={e => setReminderTimeStr(e.target.value)}
                        className="flex-1 text-xs bg-white dark:bg-white/15 dark:text-white p-2 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none"
                      />
                      <button 
                        onClick={() => handleScheduleReminder(it, 'custom', reminderTimeStr)}
                        disabled={!reminderTimeStr}
                        className="p-2 px-3 text-xs bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
