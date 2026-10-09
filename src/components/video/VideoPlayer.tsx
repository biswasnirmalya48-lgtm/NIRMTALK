import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  RotateCcw,
  Sparkles,
  Zap,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatVideoDuration } from "../../utils/videoUtils";

interface VideoPlayerProps {
  videoId: string;
  src: string;
  posterUrl?: string;
  isFullscreenMode?: boolean;
  onCloseFullscreen?: () => void;
  initialTime?: number;
  onTimeUpdateGlobal?: (time: number) => void;
  isInline?: boolean;
}

export default function VideoPlayer({
  videoId,
  src,
  posterUrl,
  isFullscreenMode = false,
  onCloseFullscreen,
  initialTime = 0,
  onTimeUpdateGlobal,
  isInline = false
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [showDoubleTapIndicator, setShowDoubleTapIndicator] = useState<{
    show: boolean;
    direction: "forward" | "backward";
  }>({ show: false, direction: "forward" });

  const speedOptions = [0.5, 1, 1.25, 1.5, 2];
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const doubleTapRef = useRef<{ lastTap: number; element: HTMLElement | null }>({ lastTap: 0, element: null });

  // Load saved playback position or props position (Feature 8)
  useEffect(() => {
    let savedTime = initialTime;
    if (!savedTime) {
      const saved = localStorage.getItem(`videoplayback_${videoId}`);
      if (saved) {
        savedTime = parseFloat(saved);
      }
    }

    if (videoRef.current && savedTime > 0) {
      videoRef.current.currentTime = savedTime;
      setCurrentTime(savedTime);
    }
  }, [videoId, initialTime]);

  // Handle controls visibility timer
  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying && !showSpeedMenu) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!isDragging) {
          setShowControls(false);
        }
      }, 2500);
    }
  };

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, showSpeedMenu, isDragging]);

  // Video event handlers
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch((err) => console.log("Play failed: ", err));
    }
    resetControlsTimer();
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);
    if (onTimeUpdateGlobal) {
      onTimeUpdateGlobal(time);
    }
    // Performant persistence (Feature 8)
    localStorage.setItem(`videoplayback_${videoId}`, time.toString());
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const value = parseFloat(e.target.value);
    videoRef.current.currentTime = value;
    setCurrentTime(value);
    resetControlsTimer();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const val = parseFloat(e.target.value);
    videoRef.current.volume = val;
    setVolume(val);
    setIsMuted(val === 0);
    videoRef.current.muted = val === 0;
    resetControlsTimer();
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && volume === 0) {
      videoRef.current.volume = 0.5;
      setVolume(0.5);
    }
    resetControlsTimer();
  };

  const handlePlaybackSpeed = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
    resetControlsTimer();
  };

  // Keyboard controls in Fullscreen/Detailed mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullscreenMode || !videoRef.current) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          handlePlayPause();
          break;
        case "ArrowRight":
          e.preventDefault();
          videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
          break;
        case "ArrowLeft":
          e.preventDefault();
          videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
          break;
        case "ArrowUp":
          e.preventDefault();
          const newVolUp = Math.min(volume + 0.1, 1);
          videoRef.current.volume = newVolUp;
          setVolume(newVolUp);
          break;
        case "ArrowDown":
          e.preventDefault();
          const newVolDown = Math.max(volume - 0.1, 0);
          videoRef.current.volume = newVolDown;
          setVolume(newVolDown);
          break;
        case "m":
        case "M":
          handleToggleMute();
          break;
        case "Escape":
          if (onCloseFullscreen) {
            onCloseFullscreen();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreenMode, isPlaying, volume, duration]);

  // Handle Double-Tap (seek 10s back/forth)
  const handleTapVideo = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    const timeSinceLastTap = now - doubleTapRef.current.lastTap;

    if (timeSinceLastTap < DOUBLE_TAP_DELAY && videoRef.current) {
      // It's a double tap!
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const direction = clickX > width / 2 ? "forward" : "backward";

      if (direction === "forward") {
        videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
      } else {
        videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
      }

      setShowDoubleTapIndicator({ show: true, direction });
      setTimeout(() => setShowDoubleTapIndicator({ show: false, direction: "forward" }), 600);
    } else {
      // Simple tap: Toggle controls
      if (showControls) {
        if (isPlaying) {
          setShowControls(false);
        }
      } else {
        resetControlsTimer();
      }
    }
    doubleTapRef.current.lastTap = now;
  };

  const handleResetPlayback = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play().catch((err) => console.log(err));
    setIsPlaying(true);
    resetControlsTimer();
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (isPlaying) setShowControls(false);
      }}
      className={`relative rounded-2xl overflow-hidden bg-black select-none group/player ${
        isFullscreenMode
          ? "w-full h-full max-h-screen"
          : "w-full aspect-video flex items-center justify-center shadow-lg"
      }`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={posterUrl}
        preload="metadata"
        playsInline
        onClick={handleTapVideo}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsWaiting(true)}
        onPlaying={() => setIsWaiting(false)}
        onEnded={() => setIsPlaying(false)}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Double Tap Seek Feedback */}
      <AnimatePresence>
        {showDoubleTapIndicator.show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.8, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`absolute top-1/2 -translate-y-1/2 pointer-events-none bg-black/50 text-white rounded-full p-4 flex flex-col items-center gap-1 z-30 ${
              showDoubleTapIndicator.direction === "forward" ? "right-[20%]" : "left-[20%]"
            }`}
          >
            <span className="text-white text-sm font-semibold">
              {showDoubleTapIndicator.direction === "forward" ? "+10s" : "-10s"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ambient Poster Gradients / Loading shimmer */}
      {isWaiting && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none z-20">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Large Central Play Overlay Button (only shown when paused & not buffering, or highly responsive design) */}
      <AnimatePresence>
        {!isPlaying && !isWaiting && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            onClick={handlePlayPause}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-16 h-16 rounded-full bg-blue-500/80 text-white flex items-center justify-center hover:bg-blue-600 hover:scale-105 active:scale-95 transition-all shadow-[0_8px_24px_rgba(59,130,246,0.35)]"
          >
            <Play className="w-8 h-8 fill-current ml-1" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Fullscreen Video Title and Close Controls */}
      {isFullscreenMode && (
        <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between z-30 select-none">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white truncate max-w-[200px] md:max-w-md">
              Cinematic Player Mode
            </span>
            <div className="flex items-center gap-1 bg-blue-500/30 text-blue-300 text-[10px] px-1.5 py-0.5 rounded-full border border-blue-400/20 font-mono">
              <Sparkles className="w-2.5 h-2.5" />
              <span>NATIVE UHD</span>
            </div>
          </div>
          {onCloseFullscreen && (
            <button
              onClick={onCloseFullscreen}
              className="p-2 text-white/80 hover:text-white rounded-full bg-black/25 hover:bg-black/50 transition-all border border-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Bottom Video Controls Controller */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.2 }}
            className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-4 flex flex-col gap-3 z-30 ${
              isFullscreenMode ? "pb-6" : ""
            }`}
          >
            {/* Timeline Scrubbing Bar */}
            <div className="flex items-center gap-3 w-full group/timeline">
              <span className="text-xs font-mono text-white/80 select-none">
                {formatVideoDuration(currentTime)}
              </span>
              <div className="flex-1 relative flex items-center h-4 cursor-pointer">
                {/* Visual Fill Background Track */}
                <div className="absolute inset-y-0.5 inset-x-0 rounded-full bg-white/20 pointer-events-none" />
                {/* Dynamic Blue Scrub Fill Track */}
                <div
                  className="absolute inset-y-0.5 left-0 rounded-l-full bg-blue-500 pointer-events-none"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
                {/* Input Native Slider */}
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  onMouseDown={() => setIsDragging(true)}
                  onMouseUp={() => setIsDragging(false)}
                  onTouchStart={() => setIsDragging(true)}
                  onTouchEnd={() => setIsDragging(false)}
                  className="w-full h-full opacity-0 cursor-pointer relative z-10"
                />
              </div>
              <span className="text-xs font-mono text-white/60 select-none">
                {formatVideoDuration(duration)}
              </span>
            </div>

            {/* Quick Action Navigation Buttons */}
            <div className="flex items-center justify-between w-full">
              {/* Left Side Buttons */}
              <div className="flex items-center gap-1">
                {/* Play/Pause Button */}
                <button
                  onClick={handlePlayPause}
                  className="p-1.5 text-white/90 hover:text-white rounded-lg hover:bg-white/10 transition-all active:scale-90"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                </button>

                {/* Restart Video Button */}
                <button
                  onClick={handleResetPlayback}
                  className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-all"
                  title="Replay from start"
                >
                  <RotateCcw className="w-4.5 h-4.5" />
                </button>

                {/* Speaker Mute & Volume Slider */}
                <div className="flex items-center gap-1 group/volume">
                  <button
                    onClick={handleToggleMute}
                    className="p-1.5 text-white/90 hover:text-white rounded-lg hover:bg-white/10 transition-all"
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <div className="w-0 overflow-hidden group-hover/volume:w-16 focus-within/volume:w-16 transition-all duration-300 flex items-center h-4 ml-0.5">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-full h-1 accent-blue-500 bg-white/30 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Right Side Buttons */}
              <div className="flex items-center gap-1 relative">
                {/* Playback Speed Setting Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-white/10 hover:bg-white/20 rounded-lg transition-all border border-white/5 font-mono"
                  >
                    <Zap className="w-3.5 h-3.5 text-yellow-400" />
                    <span>{playbackRate}x</span>
                    <ChevronDown className="w-3 h-3 text-white/60" />
                  </button>

                  <AnimatePresence>
                    {showSpeedMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full right-0 mb-2 w-28 bg-slate-950/95 border border-white/10 rounded-xl shadow-xl p-1 z-40 backdrop-blur-md"
                      >
                        <div className="text-[10px] font-bold text-white/50 px-2 py-1 uppercase select-none font-mono">
                          Speed Control
                        </div>
                        {speedOptions.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => handlePlaybackSpeed(opt)}
                            className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg flex items-center justify-between font-medium transition-all ${
                              playbackRate === opt
                                ? "bg-blue-500 text-white font-semibold"
                                : "text-white/80 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            <span>{opt === 1 ? "Normal" : `${opt}x`}</span>
                            {playbackRate === opt && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Theater/Fullscreen Controller Toggle */}
                {onCloseFullscreen && isFullscreenMode ? (
                  <button
                    onClick={onCloseFullscreen}
                    className="p-1.5 text-white/90 hover:text-white rounded-lg hover:bg-white/10 transition-all ml-1.5"
                    title="Exit Fullscreen"
                  >
                    <Minimize className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (!videoRef.current) return;
                      // Trigger custom modal fullscreen or native FS
                      if (containerRef.current?.requestFullscreen) {
                        try {
                          containerRef.current.requestFullscreen();
                        } catch (e) {
                          console.log(e);
                        }
                      }
                    }}
                    className="p-1.5 text-white/90 hover:text-white rounded-lg hover:bg-white/10 transition-all ml-1.5"
                    title="Native Fullscreen"
                  >
                    <Maximize className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
