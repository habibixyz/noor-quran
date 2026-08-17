import React, { useState, useEffect } from "react";
import { useAudio } from "../context/AudioContext";
import { surahList } from "../data/quranData";
import { Play, Pause, X, Volume2, Repeat } from "lucide-react";

export const GlobalAudioPlayer: React.FC = () => {
  const {
    isPlaying,
    playingType,
    playingSurahId,
    playingVerseNumber,
    currentTime,
    duration,
    pauseAudio,
    resumeAudio,
    stopAudio,
    seekAudio,
    selectedReciter,
    playbackSpeed,
    setPlaybackSpeed,
    repeatMode,
    setRepeatMode,
  } = useAudio();

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || !isSwiping) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStartRef.current.x;
    setSwipeOffset(diffX);
  };

  const handleTouchEnd = () => {
    if (!isMobile || !isSwiping) return;
    setIsSwiping(false);
    
    if (Math.abs(swipeOffset) > 120) {
      const exitDirection = swipeOffset > 0 ? 1 : -1;
      setSwipeOffset(exitDirection * window.innerWidth);
      
      setTimeout(() => {
        stopAudio();
        setSwipeOffset(0);
      }, 200);
    } else {
      setSwipeOffset(0);
    }
  };

  if (!playingType || !playingSurahId) return null;

  const surah = surahList.find((s) => s.index === playingSurahId);
  const surahName = surah ? surah.englishName : `Surah ${playingSurahId}`;

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Mobile: dock flush above bottom nav (64px tall), full-width, no side padding
  // Desktop: centred floating card
  const mobilePlayerStyle: React.CSSProperties = {
    position: "fixed",
    bottom: "64px",          // sits right on top of the 64px bottom nav
    left: 0,
    right: 0,
    zIndex: 49,
    padding: "0",
    boxSizing: "border-box" as const,
    transform: `translateX(${swipeOffset}px)`,
    transition: isSwiping ? "none" : "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
    touchAction: "pan-y"
  };

  const cycleSpeed = () => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIndex]);
  };

  const cycleRepeat = () => {
    if (repeatMode === "none") setRepeatMode("verse");
    else if (repeatMode === "verse") setRepeatMode("surah");
    else setRepeatMode("none");
  };

  const desktopPlayerStyle: React.CSSProperties = {
    position: "fixed",
    bottom: "76px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 49,
    width: "100%",
    maxWidth: "540px",
    padding: "0 16px",
    boxSizing: "border-box" as const,
  };

  return (
    <div 
      style={isMobile ? mobilePlayerStyle : desktopPlayerStyle}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          background: "rgba(10, 7, 3, 0.97)",
          backdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(201, 168, 76, 0.25)",
          borderLeft: isMobile ? "none" : "1px solid rgba(201, 168, 76, 0.2)",
          borderRight: isMobile ? "none" : "1px solid rgba(201, 168, 76, 0.2)",
          borderBottom: isMobile ? "none" : "1px solid rgba(201, 168, 76, 0.2)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.5)",
          borderRadius: isMobile ? "0" : "16px",
        }}
      >
        {/* Info & Main Controls */}
        <div className="flex items-center justify-between gap-3">
          {/* Audio Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-bg-light)] border border-[var(--color-gold)]/10 flex items-center justify-center text-[var(--color-gold)] shrink-0">
              <Volume2 size={14} className={isPlaying ? "animate-pulse" : ""} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">
                {playingType === "surah"
                  ? playingVerseNumber
                    ? `Surah ${surahName} — Verse ${playingVerseNumber}`
                    : `Surah ${surahName} (Full)`
                  : `${surahName} — Verse ${playingVerseNumber}`}
              </div>
              <div className="text-[9px] text-[#8c6b4a] font-semibold truncate mt-0.5">
                Reciter: {selectedReciter.name}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Speed Selector Button (Desktop Only) */}
            {!isMobile && (
              <button
                onClick={cycleSpeed}
                className="px-2 py-1 rounded bg-[#33261a] hover:bg-[#4d3926] text-[var(--color-gold)] border border-[#4d3926] text-[10px] font-bold transition-all active:scale-95 cursor-pointer shrink-0"
                title={`Change playback speed (current: ${playbackSpeed}x)`}
              >
                {playbackSpeed}x
              </button>
            )}

            {/* Repeat Mode Button (Desktop Only) */}
            {!isMobile && (
              <button
                onClick={cycleRepeat}
                className={`w-7 h-7 rounded-full flex flex-col items-center justify-center transition-all border active:scale-95 relative cursor-pointer shrink-0 ${
                  repeatMode !== "none"
                    ? "bg-[#241c12] border-[var(--color-gold)] text-[var(--color-gold)]"
                    : "bg-[#33261a] border-[#4d3926] text-[#8c6b4a] hover:text-white"
                }`}
                title={`Repeat mode: ${repeatMode === "none" ? "Off" : repeatMode === "verse" ? "Repeat Verse" : "Repeat Surah"}`}
              >
                <Repeat size={13} />
                {repeatMode !== "none" && (
                  <span 
                    className="absolute -bottom-1 -right-1 bg-[var(--color-gold)] text-[#16110b] font-extrabold rounded-full flex items-center justify-center"
                    style={{ fontSize: '7px', width: '10px', height: '10px' }}
                  >
                    {repeatMode === "verse" ? "1" : "S"}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={isPlaying ? pauseAudio : resumeAudio}
              className="w-8 h-8 rounded-full bg-[var(--color-gold)] hover:bg-[var(--color-gold-light)] text-[#16110b] flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
            </button>
            <button
              onClick={stopAudio}
              className="w-8 h-8 rounded-full bg-[#33261a] hover:bg-red-950/40 text-red-400 hover:text-red-300 flex items-center justify-center transition-all border border-[#4d3926] active:scale-95 cursor-pointer shrink-0"
              title="Stop playback"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Progress seekbar */}
        <div className="flex items-center gap-2 text-[9px] font-mono text-[#8c6b4a] w-full">
          <span className="shrink-0">{formatTime(currentTime)}</span>
          <div className="relative flex-grow h-1 bg-[#120d08] rounded-full overflow-hidden cursor-pointer">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={(e) => seekAudio(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[var(--color-gold-dark)] to-[var(--color-gold)] rounded-full"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <span className="shrink-0">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};
