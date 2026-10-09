import React, { useState } from 'react';
import { Network, Sparkles, Pin, Milestone, X, ExternalLink, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MemoryMapProps {
  onClose: () => void;
}

interface TopicNode {
  id: string;
  label: string;
  importance: number; // 1 to 5
  description: string;
  x: number; // % offset
  y: number; // % offset
  connections: string[]; // ids of connected nodes
}

export function MemoryMap({ onClose }: MemoryMapProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>('node-1');

  // Custom static / interactive topic connections
  const topics: TopicNode[] = [
    {
      id: 'node-1',
      label: 'Logo & Accent Scheme',
      importance: 5,
      description: 'Discussed implementing a premium light theme paired with custom glassmorphism and thin, sleek round sliders. Standard blue gradient anchors the active status.',
      x: 35,
      y: 40,
      connections: ['node-2', 'node-3']
    },
    {
      id: 'node-2',
      label: 'Apple-level Restraint',
      importance: 4,
      description: 'Goal to eliminate redundant buttons, visual noise, or telemetry data. Clean, quiet spacing dominates with thin borders.',
      x: 65,
      y: 25,
      connections: ['node-1', 'node-4']
    },
    {
      id: 'node-3',
      label: 'Durable Cloud Sync',
      importance: 4,
      description: 'Connecting chat and Direct Workspace links natively on Firestore with offline fallback capabilities in local storage.',
      x: 20,
      y: 75,
      connections: ['node-1', 'node-5']
    },
    {
      id: 'node-4',
      label: 'Interactive Poll Engine',
      importance: 3,
      description: 'Interactive choice cards generated dynamic voting ratios in real time with single/multiple vote validations.',
      x: 80,
      y: 55,
      connections: ['node-2']
    },
    {
      id: 'node-5',
      label: 'Universal Spotlight Shift',
      importance: 3,
      description: 'Implementing the global trigger Cmd+K as an overlay providing immediate search filters and quick presets.',
      x: 50,
      y: 80,
      connections: ['node-3']
    }
  ];

  const activeTopic = topics.find(t => t.id === selectedTopicId);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]/35 dark:bg-[#0c0c0d]/35 backdrop-blur-3xl p-5 md:p-7 overflow-hidden select-none relative">
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <Network className="w-5 h-5 text-blue-500 animate-pulse" />
          <h2 className="text-xl font-bold font-sans text-slate-900 dark:text-white tracking-tight">AI Conversation Memory Map</h2>
        </div>
        <button 
          onClick={onClose}
          className="p-1 px-3 text-xs font-semibold bg-slate-150 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 rounded-full text-slate-600 dark:text-slate-300 transition-colors"
        >
          Exit Map
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden min-h-0">
        {/* Interactive Graph Canvas */}
        <div className="md:col-span-2 bg-slate-100/40 dark:bg-black/20 rounded-3xl border border-slate-200/30 dark:border-white/10 relative overflow-hidden flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[radial-gradient(rgba(59,130,246,0.06)_1px,transparent_1px)] [background-size:20px_20px] opacity-80" />
          
          {/* Connecting SVG Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-blue-500/25 dark:stroke-blue-400/20" strokeWidth="1.5">
            {topics.map(node => (
              node.connections.map(targetId => {
                const targetNode = topics.find(t => t.id === targetId);
                if (!targetNode) return null;
                // Avoid drawing double lines by ordering IDs
                if (node.id > targetId) return null;
                return (
                  <line 
                    key={`${node.id}-${targetId}`}
                    x1={`${node.x}%`}
                    y1={`${node.y}%`}
                    x2={`${targetNode.x}%`}
                    y2={`${targetNode.y}%`}
                  />
                );
              })
            ))}
          </svg>

          {/* Interactive Nodes */}
          {topics.map(node => {
            const isSelected = selectedTopicId === node.id;
            const size = 10 + node.importance * 5;
            return (
              <motion.button
                key={node.id}
                onClick={() => setSelectedTopicId(node.id)}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group focus:outline-none z-10`}
                whileHover={{ scale: 1.15 }}
                transition={{ type: 'spring', damping: 12 }}
              >
                {/* Node Ring wrapper */}
                <div 
                  className={`rounded-full flex items-center justify-center transition-all ${
                    isSelected 
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/35 ring-4 ring-blue-500/10'
                      : 'bg-white dark:bg-[#18181a] border-2 border-slate-350 dark:border-white/15 text-slate-600 dark:text-slate-300 group-hover:border-blue-400'
                  }`}
                  style={{ width: `${size}px`, height: `${size}px` }}
                >
                  <Network className="w-3.5 h-3.5 opacity-80" />
                </div>
                <span className={`text-[10px] sm:text-xs font-semibold mt-2 px-2.5 py-0.5 rounded-full backdrop-blur-md transition-all ${
                  isSelected 
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-400/20 shadow-sm' 
                    : 'bg-white/60 dark:bg-[#0c0c0d]/65 border border-slate-200/50 dark:border-white/5 text-slate-500 dark:text-slate-400 group-hover:text-blue-500'
                }`}>
                  {node.label}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Content Inspector Sidebar */}
        <div className="flex flex-col bg-white/70 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-3xl p-5 overflow-y-auto scrollbar-style">
          {activeTopic ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTopic.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Milestone className="w-4 h-4 text-blue-500" />
                    <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Focus Topic</span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-tight">
                    {activeTopic.label}
                  </h3>

                  <div className="flex items-center gap-1 mb-4">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <div 
                        key={idx} 
                        className={`w-3 h-1.5 rounded-full ${
                          idx < activeTopic.importance ? 'bg-blue-500' : 'bg-slate-200 dark:bg-white/10'
                        }`} 
                      />
                    ))}
                    <span className="text-[10px] text-slate-400 font-bold ml-1">Importance Level</span>
                  </div>

                  <p className="text-[13px] text-slate-600 dark:text-slate-200 leading-relaxed bg-slate-50/50 dark:bg-black/15 p-4 rounded-2xl border border-slate-200/40 dark:border-white/5 whitespace-pre-wrap select-text font-normal">
                    {activeTopic.description}
                  </p>
                </div>

                <div className="mt-8 border-t border-slate-200/50 dark:border-white/5 pt-4">
                  <div className="flex items-center gap-1.5 p-3 rounded-2xl bg-blue-500/5 border border-blue-400/10">
                    <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 leading-normal font-medium">
                      Knowledge nodes compile automatically from active discussion logs. Keep discussing to extend.
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-10">
              <HelpCircle className="w-8 h-8 opacity-40 mb-2 stroke-1" />
              <p className="text-sm">Select a concept on the canvas to inspect</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
