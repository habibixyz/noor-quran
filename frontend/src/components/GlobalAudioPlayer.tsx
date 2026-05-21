import React, { useState, useEffect } from "react";
import { useAudio } from "../context/AudioContext";
import { surahList } from "../data/quranData";
import { Play, Pause, X, Volume2 } from "lucide-react";

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
  } = useAudio();

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  return (
    <div
      style={{
        position: "fixed",
        bottom: isMobile ? "72px" : "16px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 45,
        width: "100%",
        maxWidth: "540px",
        padding: "0 16px",
        boxSizing: "border-box",
      }}
    >
      <div
        className="glass-panel"
        style={{
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          background: "rgba(10, 7, 3, 0.95)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(201, 168, 76, 0.2)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.65)",
          borderRadius: "16px",
        }}
      >
        {/* Info & Main Controls */}
        <div className="flex items-center justify-between gap-3">
          {/* Audio Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-bg-light)] border border-[var(--color-gold)]/10 flex items-center justify-center text-[var(--color-gold)] shrink-0">
              <Volume2 size={16} className={isPlaying ? "animate-pulse" : ""} />
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
          <div className="flex items-center gap-1.5">
            <button
              onClick={isPlaying ? pauseAudio : resumeAudio}
              className="w-8 h-8 rounded-full bg-[var(--color-gold)] hover:bg-[var(--color-gold-light)] text-[#16110b] flex items-center justify-center transition-all shadow-md active:scale-95"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
            </button>
            <button
              onClick={stopAudio}
              className="w-8 h-8 rounded-full bg-[#33261a] hover:bg-[#4d3926] text-[#8c6b4a] hover:text-white flex items-center justify-center transition-all border border-[#4d3926] active:scale-95"
              title="Stop playback"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Progress seekbar bar */}
        <div className="flex items-center gap-2 text-[9px] font-mono text-[#8c6b4a] w-full">
          <span className="shrink-0">{formatTime(currentTime)}</span>
          <div className="relative flex-grow h-1 bg-[#120d08] rounded-full overflow-hidden cursor-pointer group">
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
