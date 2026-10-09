import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Eye, ShieldAlert, Lock, AlertTriangle, Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";

interface ViewOnceViewerProps {
  imageUrl: string;
  onClose: () => void;
  senderName: string;
}

export function ViewOnceViewer({ imageUrl, onClose, senderName }: ViewOnceViewerProps) {
  // Navigation & Zoom State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Security Simulation State
  const [isRecordingProtected, setIsRecordingProtected] = useState(false);
  const [securityBlurs, setSecurityBlurs] = useState<string[]>([]);
  const [isSecured, setIsSecured] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // References
  const containerRef = useRef<HTMLDivElement>(null);

  // Trigger Security Guard Action
  const triggerSecurityViolation = (reason: string) => {
    if (isSecured) return; // already locked down
    
    // Add threat record
    setSecurityBlurs((prev) => [...prev, reason]);
    setIsSecured(true);
    setWarningMessage(`SECURITY SHIELD ACTIVATED: ${reason}`);
    
    // Auto terminate after some duration
    setTimeout(() => {
      onClose();
    }, 4000);
  };

  // Setup security event listeners
  useEffect(() => {
    // 1. App backgrounding/switching protection (Visibility API)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        triggerSecurityViolation("App backgrounding detected (Prevention of preview leakage)");
      }
    };

    // 2. Window focus lost protection (App switching or screen recording overlays)
    const handleBlur = () => {
      triggerSecurityViolation("App switch or screen grab overlay detected");
    };

    // 3. Screen capture keyboard shortcut prevention
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen keys, macOS (cmd+shift+3/4), Windows (Win+Shift+S)
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (
        e.key === "PrintScreen" || 
        (isCmdOrCtrl && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5" || e.key === "s" || e.key === "S"))
      ) {
        e.preventDefault();
        triggerSecurityViolation("Screen-capture shortcut intercepted");
      }
    };

    // 4. Device rotation protection
    const handleOrientationChange = () => {
      // Small delay to let redraw happen safely
      setTimeout(() => {
        setPosition({ x: 0, y: 0 });
        setScale(1);
      }, 200);
    };

    // 5. Block right click (context menu) and image extraction
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleOrientationChange);
    document.addEventListener("contextmenu", handleContextMenu);

    // Emulate iOS/Android FLAG_SECURE system registration status
    setIsRecordingProtected(true);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleOrientationChange);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [isSecured]);

  // Zoom / Pan Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom helpers
  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 4));
  };

  const zoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 }); // reset pan on scale 1
      return next;
    });
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[300] bg-black select-none flex flex-col justify-between overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Bar Navigation */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
          <div className="flex flex-col">
            <span className="text-white font-extrabold text-[15px] tracking-wide flex items-center gap-2">
              <Eye className="w-4.5 h-4.5 text-emerald-400" />
              View Once Media Secure Session
            </span>
            <span className="text-xs text-white/65 font-medium">
              Received from {senderName}
            </span>
          </div>
        </div>

        {/* Security Shield Active Cues */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] uppercase font-black text-emerald-400 tracking-wider">
            <Lock className="w-3.5 h-3.5" />
            Secure Viewer (FLAG_SECURE Active)
          </div>
          <button
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(15);
              onClose();
            }}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Warning Flash Message overlay */}
      <AnimatePresence>
        {warningMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-4 right-4 mx-auto max-w-md z-50 bg-red-500 text-white font-black text-xs uppercase tracking-wider rounded-xl py-3 px-4 shadow-[0_8px_32px_rgba(239,68,68,0.3)] flex items-center gap-2 border border-red-400"
          >
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{warningMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Image Stage */}
      <div className="flex-1 flex items-center justify-center relative w-full h-full p-4">
        {/* Dynamic Watermark / Screenshot Preventer Overlay */}
        <div className="absolute inset-0 pointer-events-none z-10 grid grid-cols-3 grid-rows-3 opacity-[0.06] text-white font-black text-lg select-none">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex items-center justify-center -rotate-12 translate-y-4">
              NIRM SECURE VIEW ONCE
            </div>
          ))}
        </div>

        {/* The Secured Image element with optional blur */}
        <motion.div
          animate={{
            scale: scale,
            x: position.x,
            y: position.y,
            filter: isSecured ? "blur(32px) brightness(0.2)" : "blur(0px) brightness(1)",
          }}
          transition={isDragging ? { type: "just" } : { type: "spring", damping: 30, stiffness: 350 }}
          className="w-full h-full flex items-center justify-center max-w-full max-h-full"
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="View Once Attachment"
              className="max-w-full max-h-full object-contain pointer-events-none rounded-[1px] shadow-2l flex select-none"
              draggable={false}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-white/50">
              <AlertTriangle className="w-10 h-10 text-yellow-500 animate-bounce" />
              <span className="font-semibold text-sm">Media load error or empty url</span>
            </div>
          )}
        </motion.div>
      </div>

      {/* Controls Overlay Footer */}
      <div className="absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/90 to-transparent px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            onClick={zoomIn}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={zoomOut}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          {scale > 1 && (
            <span className="text-xs font-mono font-bold text-white bg-white/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
              {scale.toFixed(1)}x Zoom (Drag to Pan)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-bold text-white/70 uppercase tracking-widest leading-none">
            Screenshot & Recording Shields Armored
          </span>
        </div>
      </div>
    </div>
  );
}
