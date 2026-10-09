import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Trash2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isDestructive = true,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-[#0f172a]/60 backdrop-blur-[8px] cursor-pointer"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-[88%] sm:w-[380px] min-w-[270px] max-w-sm overflow-hidden bg-white dark:bg-[#1a1a1c] border border-slate-200/50 dark:border-white/10 rounded-[28px] shadow-[0_24px_64px_rgba(0,0,0,0.2)] p-6 z-10 flex flex-col items-center text-center"
          >
            {/* Header Icon */}
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
              isDestructive 
                ? 'bg-red-50 dark:bg-red-950/30 text-red-500' 
                : 'bg-blue-50 dark:bg-blue-950/30 text-blue-500'
            }`}>
              {isDestructive ? <Trash2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-2">
              {title}
            </h3>

            {/* Message */}
            <p className="text-[14px] text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              {message}
            </p>

            {/* Actions */}
            <div className="flex w-full gap-3">
              <motion.button
                whileHover={{ scale: 1.02, y: -1, filter: 'brightness(1.03)' }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                onClick={onCancel}
                className="flex-1 py-3 px-4 rounded-[16px] bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-sm font-semibold transition-all"
              >
                {cancelLabel}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02, y: -1, filter: 'brightness(1.03)' }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                onClick={onConfirm}
                className={`flex-1 py-3 px-4 rounded-[16px] text-white text-sm font-semibold transition-all shadow-[0_4px_12px_rgba(239,68,68,0.2)] ${
                  isDestructive
                    ? 'bg-gradient-to-tr from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700'
                    : 'bg-gradient-to-tr from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                }`}
              >
                {confirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
