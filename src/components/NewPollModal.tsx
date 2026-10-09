import React, { useState } from 'react';
import { CheckSquare, Plus, Trash2, X, ToggleLeft, ToggleRight, HelpCircle, BarChart2, ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OptionItem {
  text: string;
  imageUrl?: string;
}

interface NewPollModalProps {
  onClose: () => void;
  onSubmit: (question: string, options: OptionItem[], isMultiple: boolean, isAnonymous: boolean) => void;
}

const STOCK_IMAGES = [
  { name: 'Tech', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=150&q=80' },
  { name: 'Design', url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=150&q=80' },
  { name: 'Team', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=150&q=80' },
  { name: 'Food', url: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=150&q=80' },
  { name: 'Office', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=150&q=80' }
];

export function NewPollModal({ onClose, onSubmit }: NewPollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<OptionItem[]>([
    { text: '' },
    { text: '' }
  ]);
  const [isMultiple, setIsMultiple] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [activeImagePickerIndex, setActiveImagePickerIndex] = useState<number | null>(null);

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, { text: '' }]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, idx) => idx !== index));
    }
  };

  const handleOptionTextChange = (index: number, text: string) => {
    const updated = [...options];
    updated[index].text = text;
    setOptions(updated);
  };

  const handleSelectOptionImage = (index: number, url: string) => {
    const updated = [...options];
    updated[index].imageUrl = url;
    setOptions(updated);
    setActiveImagePickerIndex(null);
  };

  const handleClearOptionImage = (index: number) => {
    const updated = [...options];
    delete updated[index].imageUrl;
    setOptions(updated);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validQuestion = question.trim();
    const validOptions = options
      .map(o => ({ text: o.text.trim(), imageUrl: o.imageUrl }))
      .filter(o => o.text.length > 0);

    if (validQuestion && validOptions.length >= 2) {
      onSubmit(validQuestion, validOptions, isMultiple, isAnonymous);
      onClose();
    }
  };

  const isValid = question.trim().length > 3 && options.filter(o => o.text.trim().length > 0).length >= 2;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        transition={{ type: "spring", damping: 24, stiffness: 280 }}
        className="w-full max-w-md bg-white/90 dark:bg-[#1a1a1c]/90 backdrop-blur-2xl rounded-3xl overflow-hidden shadow-2xl border border-white/25 dark:border-white/10"
      >
        <div className="px-5 py-4 border-b border-slate-200/50 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-blue-500">
            <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-[16px] font-bold text-slate-800 dark:text-white">Create Advanced Poll</h3>
          </div>
          <button onClick={onClose} className="p-1 px-2.5 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 rounded-lg text-slate-500 transition-colors">
            Close
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
          {/* Question input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Question</label>
            <input
              type="text"
              required
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="e.g. What should be our theme name?"
              className="w-full text-sm font-semibold bg-white/40 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-3 focus:outline-none focus:ring-1 focus:ring-blue-500/40 text-slate-800 dark:text-white placeholder-slate-400"
            />
          </div>

          {/* Options input */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Options</label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    {opt.imageUrl ? (
                      <div className="relative group shrink-0 w-8 h-8 rounded-lg overflow-hidden border border-slate-250 dark:border-white/10 shadow-sm">
                        <img src={opt.imageUrl} alt="poll" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleClearOptionImage(idx)}
                          className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveImagePickerIndex(activeImagePickerIndex === idx ? null : idx)}
                        className="p-2 text-slate-400 hover:text-blue-500 bg-slate-100/70 hover:bg-blue-500/10 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl transition-all"
                        title="Add image illustration"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <input
                      type="text"
                      required
                      value={opt.text}
                      onChange={e => handleOptionTextChange(idx, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 text-xs font-semibold bg-white/40 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500/20 text-slate-800 dark:text-white"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/15 rounded-xl transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Tiny Image selection grid */}
                  <AnimatePresence>
                    {activeImagePickerIndex === idx && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden bg-slate-50 dark:bg-black/30 p-2 rounded-xl border border-slate-150 dark:border-white/5 grid grid-cols-5 gap-2"
                      >
                        {STOCK_IMAGES.map((img) => (
                          <button
                            key={img.name}
                            type="button"
                            onClick={() => handleSelectOptionImage(idx, img.url)}
                            className="relative group shrink-0 w-full aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <img src={img.url} alt={img.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                            <div className="absolute inset-x-0 bottom-0 bg-black/40 text-[9px] text-white py-0.5 text-center leading-none">
                              {img.name}
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {options.length < 6 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="w-full py-2 border border-dashed border-slate-350 dark:border-white/10 rounded-xl text-xs font-bold text-slate-500 hover:text-blue-500 flex items-center justify-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Option
              </button>
            )}
          </div>

          {/* Options: Single/Multiple and Anonymous settings */}
          <div className="pt-2.5 border-t border-slate-200/50 dark:border-white/5 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Multiple Answers</span>
                <span className="text-[10.5px] text-slate-400">Allow users to log multiple options</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMultiple(!isMultiple)}
                className="text-slate-400 hover:text-blue-500 transition-colors"
                title="Toggle Multiple Options"
              >
                {isMultiple ? (
                  <ToggleRight className="w-8 h-8 text-blue-500" />
                ) : (
                  <ToggleLeft className="w-8 h-8" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Anonymous Mode</span>
                <span className="text-[10.5px] text-slate-400">Voters remain anonymous</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAnonymous(!isAnonymous)}
                className="text-slate-400 hover:text-blue-500 transition-colors"
                title="Toggle Anonymous Mode"
              >
                {isAnonymous ? (
                  <ToggleRight className="w-8 h-8 text-blue-500" />
                ) : (
                  <ToggleLeft className="w-8 h-8" />
                )}
              </button>
            </div>
          </div>

          {/* Submit button */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-xs bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 rounded-2xl font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="flex-1 py-3 text-xs bg-blue-500 text-white hover:bg-blue-600 rounded-2xl font-bold disabled:opacity-50 shadow-md shadow-blue-500/15 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <BarChart2 className="w-4 h-4" />
              Launch Poll
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
