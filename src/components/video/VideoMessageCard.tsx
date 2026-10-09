import React, { useState, useEffect } from "react";
import {
  Play,
  Pause,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Eye,
  Settings,
  Tv
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatVideoDuration, formatBytes } from "../../utils/videoUtils";
import VideoPlayer from "./VideoPlayer";

interface VideoMessageCardProps {
  message: {
    id: string;
    senderId: string;
    attachment?: {
      type: string;
      url?: string; // final Firebase Storage URL
      localBlobUrl?: string; // local preview reference
      name?: string;
      size?: number;
      duration?: number;
      thumbnailUrl?: string; // base64 or stored URL thumbnail
      uploadProgress?: number;
      uploadStatus?: "uploading" | "completed" | "failed";
    };
  };
  isMe: boolean;
  onCancelUpload?: (msgId: string) => void;
  onRetryUpload?: (msgId: string) => void;
}

export default function VideoMessageCard({
  message,
  isMe,
  onCancelUpload,
  onRetryUpload
}: VideoMessageCardProps) {
  const { attachment, id: msgId } = message;
  if (!attachment) return null;

  const [isPlaying, setIsPlaying] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [savedTime, setSavedTime] = useState<number | null>(null);

  const videoUrl = attachment.url || attachment.localBlobUrl || "";
  const progress = attachment.uploadProgress ?? 0;
  const status = attachment.uploadStatus ?? "completed";

  // Check for saved position (Feature 8)
  useEffect(() => {
    const saved = localStorage.getItem(`videoplayback_${msgId}`);
    if (saved) {
      const parsed = parseFloat(saved);
      if (parsed > 1.5 && attachment.duration && parsed < attachment.duration - 2) {
        setSavedTime(parsed);
      } else {
        setSavedTime(null);
      }
    }
  }, [msgId, isPlaying, attachment.duration]);

  const handleOpenPlayer = () => {
    if (status === "uploading") return;
    setIsPlaying(true);
  };

  const handleOpenFullscreen = (e: React.MouseEvent) => {
    if (status === "uploading") return;
    e.stopPropagation();
    setShowFullscreen(true);
  };

  const handleCancelResume = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.removeItem(`videoplayback_${msgId}`);
    setSavedTime(null);
  };

  return (
    <div className="relative group/vidcard max-w-[280px] md:max-w-[420px] rounded-2xl overflow-hidden shadow-md select-none border border-slate-200/50 dark:border-white/10 bg-slate-100 dark:bg-slate-900">
      
      {/* Inline Video Player Mode vs Thumbnail Preview Mode */}
      {isPlaying && videoUrl ? (
        <div className="w-full relative aspect-video flex flex-col">
          <VideoPlayer
            videoId={msgId}
            src={videoUrl}
            posterUrl={attachment.thumbnailUrl}
            initialTime={savedTime || 0}
            onTimeUpdateGlobal={(t) => setPlaybackTime(t)}
            isInline={true}
          />
          <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-950/80 border-t border-slate-200/55 dark:border-white/5">
            <button
              onClick={() => setIsPlaying(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 transition-all"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Minimize</span>
            </button>
            <button
              onClick={handleOpenFullscreen}
              className="text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1 transition-all"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Theater Overlay</span>
            </button>
          </div>
        </div>
      ) : (
        /* Video Preview Area */
        <div
          onClick={handleOpenPlayer}
          className={`relative aspect-video w-full overflow-hidden cursor-pointer ${
            status === "uploading" ? "cursor-not-allowed filter brightness-90" : "hover:brightness-95"
          } transition-all`}
        >
          {/* Skeleton Shimmer Background (Feature 11) */}
          <div className="absolute inset-0 bg-slate-300 dark:bg-slate-800 animate-pulse" />

          {/* Thumbnail Image display */}
          {attachment.thumbnailUrl ? (
            <img
              src={attachment.thumbnailUrl}
              alt={attachment.name || "Video Thumbnail"}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-tr from-slate-950/90 to-slate-900 text-white/50">
              <Tv className="w-10 h-10 animate-pulse text-blue-500" />
              <span className="text-[10px] font-mono mt-2 tracking-wide">NirmTalk Media</span>
            </div>
          )}

          {/* Transparent Glass Play Icon Overlay (Feature 2) */}
          {status === "completed" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/35 transition-all group-hover/vidcard:scale-102">
              <div className="w-14 h-14 rounded-full bg-white/15 dark:bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/40 dark:border-white/10 shadow-lg text-white transform transition-all hover:scale-110 active:scale-95">
                <Play className="w-7 h-7 fill-current ml-0.5" />
              </div>
            </div>
          )}

          {/* Duration Indicator Pills */}
          {attachment.duration && status === "completed" && (
            <div className="absolute bottom-2.5 right-2.5 bg-black/60 md:bg-black/75 backdrop-blur-md text-white font-mono text-[11px] font-bold px-2 py-0.5 rounded-full select-none shadow border border-white/10">
              {formatVideoDuration(attachment.duration)}
            </div>
          )}

          {/* File Size details on bottom left */}
          {attachment.size && (
            <div className="absolute bottom-2.5 left-2.5 bg-slate-950/60 backdrop-blur-md text-white font-mono text-[9px] px-2 py-0.5 rounded-md border border-white/5">
              {formatBytes(attachment.size)}
            </div>
          )}

          {/* Upload Progress Shimmer overlay (Feature 1 & 11) */}
          {status === "uploading" && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4">
              
              {/* Dynamic progress circle */}
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="28"
                    cy="28"
                    r="23"
                    className="stroke-white/20 fill-none"
                    strokeWidth="3.5"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="23"
                    className="stroke-blue-500 fill-none transition-all duration-300"
                    strokeWidth="3.5"
                    strokeDasharray={2 * Math.PI * 23}
                    strokeDashoffset={2 * Math.PI * 23 * (1 - progress / 100)}
                  />
                </svg>
                <div className="absolute text-[10px] font-bold font-mono text-white">
                  {Math.round(progress)}%
                </div>
              </div>

              <span className="text-[11px] font-semibold text-white/90 tracking-wide mt-2">
                Uploading High-Speed...
              </span>

              {/* Cancel Button */}
              {onCancelUpload && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelUpload(msgId);
                  }}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1 bg-white/15 hover:bg-white/25 active:scale-95 text-xs text-white rounded-full font-medium transition-all shadow-sm border border-white/10"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancel Upload</span>
                </button>
              )}
            </div>
          )}

          {/* Upload Fail State Recovery Module (Feature 12) */}
          {status === "failed" && (
            <div className="absolute inset-0 bg-red-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-3 text-center">
              <AlertCircle className="w-9 h-9 text-red-400 mb-1" />
              <p className="text-red-200 text-[10px] font-bold uppercase tracking-wider">
                Upload Interrupted
              </p>
              <p className="text-white/70 text-[11px] mt-0.5 px-2 font-medium line-clamp-1">
                {attachment.name || "Video File"}
              </p>

              <div className="flex items-center gap-2 mt-3.5">
                {onRetryUpload && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetryUpload(msgId);
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-500 active:scale-95 text-xs text-white font-semibold rounded-full shadow transition-all"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                )}
                {onCancelUpload && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelUpload(msgId);
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-white/15 hover:bg-white/25 text-xs text-white rounded-full transition-all"
                  >
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* File Meta Information Card Footer */}
      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[170px] md:max-w-[280px]">
          {attachment.name || "NirmTalk_Video.mp4"}
        </span>
        {status === "completed" && (
          <button
            onClick={handleOpenFullscreen}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all rounded-md"
            title="Theater Fullscreen"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Playback memory resume indicator overlay alert (Feature 8) */}
      <AnimatePresence>
        {savedTime && !isPlaying && status === "completed" && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="absolute top-2 inset-x-2 bg-gradient-to-r from-blue-600/95 to-indigo-600/95 shadow-xl text-white rounded-xl p-2.5 flex items-center justify-between pointer-events-auto z-10 border border-blue-400/30 backdrop-blur-md"
          >
            <div className="flex flex-col">
              <div className="text-[10px] font-black uppercase tracking-wider text-blue-100 flex items-center gap-1">
                <Clock className="w-3 h-3 text-yellow-300" />
                <span>Resume Playback?</span>
              </div>
              <p className="text-xs text-white font-semibold mt-0.5">
                Saved at {formatVideoDuration(savedTime)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleOpenPlayer}
                className="bg-white text-blue-700 hover:bg-blue-50 text-[10px] font-black px-3 py-1 rounded-lg shadow-sm transition-all text-center uppercase"
              >
                Resume
              </button>
              <button
                onClick={handleCancelResume}
                className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-full transition-all"
                title="Dismiss"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dedicated Fullscreen Cinematic Player Modal Overlay (Feature 5) */}
      <AnimatePresence>
        {showFullscreen && videoUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black backdrop-blur-xl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="w-full h-full max-w-7xl mx-auto md:p-6 flex items-center justify-center relative"
            >
              <VideoPlayer
                videoId={msgId}
                src={videoUrl}
                posterUrl={attachment.thumbnailUrl}
                isFullscreenMode={true}
                initialTime={savedTime || 0}
                onCloseFullscreen={() => setShowFullscreen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
