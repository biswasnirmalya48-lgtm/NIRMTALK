import React from 'react';
import { loginWithGoogle } from '../firebase';
import { MessageSquare, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 dark:bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm flex flex-col items-center bg-white dark:bg-[#111113] border border-slate-200 dark:border-white/10 p-8 sm:p-10 rounded-[32px] shadow-xl relative z-10"
      >
        {/* App Icon */}
        <motion.div 
           initial={{ scale: 0.8, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           transition={{ delay: 0.1, duration: 0.5 }}
           className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-[22px] flex items-center justify-center mb-6 shadow-lg shadow-blue-500/10"
        >
          <MessageSquare className="w-8 h-8 text-white" fill="currentColor" />
        </motion.div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight text-center">
          NirmTalk
        </h1>
        
        {/* Subtitle */}
        <p className="text-slate-500 dark:text-slate-400 mb-8 text-center text-[14px] leading-relaxed max-w-[280px]">
          Access high-definition calling, text messages, and secure spaces instantly.
        </p>

        {/* Google Login Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={loginWithGoogle}
          className="w-full bg-white hover:bg-slate-50 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-semibold py-3.5 px-5 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-3 cursor-pointer text-[14px]"
        >
          <div className="bg-white p-0.5 rounded-full shadow-sm flex-shrink-0 flex items-center justify-center">
            <img 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              className="w-4 h-4" 
              alt="Google" 
            />
          </div>
          <span>Continue with Google</span>
        </motion.button>

        {/* Footer info decoration */}
        <div className="flex items-center gap-1.5 justify-center mt-8 text-slate-400 dark:text-slate-500 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
          <span>Fully secured and verified by Google</span>
        </div>
      </motion.div>
    </div>
  );
}
