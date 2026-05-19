import React, { useState, useEffect, useRef } from "react";
import { surahList, getSurahVerses } from "../data/quranData";
import { BookOpen, Play, Pause, Share2, Copy, Sparkles } from "lucide-react";

interface Verse {
  id: number;
  verse_number: number;
  text_uthmani: string;
  translation: string;
  audio_url?: string;
}

export const QuranReader: React.FC = () => {
  const [selectedSurah, setSelectedSurah] = useState<number>(1);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showGlobalTranslation, setShowGlobalTranslation] = useState<boolean>(true);
  const [individualToggles, setIndividualToggles] = useState<Record<number, boolean>>({});
  
  // Audio state (Surah level)
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Audio state (Verse level)
  const [playingVerseNum, setPlayingVerseNum] = useState<number | null>(null);
  const verseAudioRef = useRef<HTMLAudioElement | null>(null);

  // Mobile UX State
  const [isMobileListOpen, setIsMobileListOpen] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    
    // Clear individual verse toggles when switching Surah
    setIndividualToggles({});
    
    // Stop surah audio if playing
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    // Stop verse audio if playing
    if (playingVerseNum && verseAudioRef.current) {
      verseAudioRef.current.pause();
      setPlayingVerseNum(null);
    }
    
    // Set up audio URL for Alafasy recitations (Surah level)
    const paddedIndex = String(selectedSurah).padStart(3, "0");
    setAudioUrl(`https://download.quranicaudio.com/quran/alafasy/${paddedIndex}.mp3`);

    // Fetch dynamic Surah data from Python Backend API
    fetch(`/api/surah/${selectedSurah}`)
      .then((res) => {
        if (!res.ok) throw new Error("API Offline");
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          // Map backend snake_case to the component structure
          const mappedVerses = data.verses.map((v: any) => ({
            id: v.id,
            verse_number: v.verse_number,
            text_uthmani: v.text_uthmani,
            translation: v.translation,
            audio_url: v.audio_url
          }));
          setVerses(mappedVerses);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn("FastAPI offline, falling back to clean simulated/local client database:", err);
        if (isMounted) {
          // Fallback mechanism to ensure working client
          const localVerses = getSurahVerses(selectedSurah);
          const mappedLocal = localVerses.map((v, idx) => ({
            id: idx,
            verse_number: v.verseNumber,
            text_uthmani: v.arabic,
            translation: v.english
          }));
          setVerses(mappedLocal);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSurah]);

  const activeSurahDetails = surahList.find((s) => s.index === selectedSurah) || surahList[0];

  // Verse-specific translation toggle
  const toggleVerseTranslation = (verseNum: number) => {
    setIndividualToggles((prev) => ({
      ...prev,
      [verseNum]: !prev[verseNum]
    }));
  };

  // Surah Audio Playback
  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Pause any active verse audio first
      if (playingVerseNum && verseAudioRef.current) {
        verseAudioRef.current.pause();
        setPlayingVerseNum(null);
      }

      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.error("Surah audio playback error:", err);
      });
    }
  };

  // Verse Audio Playback
  const playVerseAudio = (verse: Verse) => {
    // If already playing this verse, pause it
    if (playingVerseNum === verse.verse_number) {
      if (verseAudioRef.current) {
        verseAudioRef.current.pause();
      }
      setPlayingVerseNum(null);
      return;
    }

    // Stop any surah-level playing audio
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    // Stop currently playing verse audio
    if (verseAudioRef.current) {
      verseAudioRef.current.pause();
    }

    // Resolve audio URL
    const url = verse.audio_url || (() => {
      const paddedSurah = String(selectedSurah).padStart(3, "0");
      const paddedVerse = String(verse.verse_number).padStart(3, "0");
      return `https://everyayah.com/data/Alafasy_128kbps/${paddedSurah}${paddedVerse}.mp3`;
    })();

    if (verseAudioRef.current) {
      verseAudioRef.current.src = url;
      verseAudioRef.current.load(); // Force pre-buffering on mobile
      verseAudioRef.current.play().then(() => {
        setPlayingVerseNum(verse.verse_number);
      }).catch((err) => {
        console.error("Verse audio playback error:", err);
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Verse copied to clipboard!");
  };

  const shareVerse = (verse: Verse) => {
    const textToShare = `"${verse.translation}" - Quran ${selectedSurah}:${verse.verse_number} (${activeSurahDetails.englishName})`;
    if (navigator.share) {
      navigator.share({
        title: `Quran ${selectedSurah}:${verse.verse_number}`,
        text: textToShare,
        url: window.location.href
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(textToShare);
      alert("Verse details copied for sharing!");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-1 md:p-4">
      {/* Side Menu / Sidebar */}
      <div className="lg:col-span-1 flex flex-col gap-4">
        {/* Current Surah Card */}
        <div className="glass-panel p-4 flex flex-col gap-2">
          <div className="text-[10px] font-bold tracking-widest text-[#4a7c52] uppercase flex items-center gap-2 mb-2">
            <BookOpen size={12} /> Current Surah
          </div>
          <div className="font-arabic text-xl text-[#e8d5a3] text-right">{activeSurahDetails.name}</div>
          <div className="text-lg font-bold text-[#c9a84c] mb-1">{activeSurahDetails.englishName}</div>
          <div className="flex gap-2 mb-3">
            <span className="text-[10px] font-bold tracking-wide px-2 py-1 rounded bg-[#1a3d1f] text-[#6abf71] border border-[#2a5a30] uppercase">
              {activeSurahDetails.type}
            </span>
            <span className="text-[10px] font-bold tracking-wide px-2 py-1 rounded bg-[#1a2a1a] text-[#4a7c52] border border-[#1a3d1f]">
              {activeSurahDetails.versesCount} Verses
            </span>
          </div>
          <button 
            onClick={() => setIsMobileListOpen(!isMobileListOpen)}
            className="w-full p-2 bg-[#1a3d1f] border border-[#2a5a30] rounded-lg text-[#c9a84c] text-[11px] font-bold tracking-wide flex items-center justify-center gap-2 transition-all hover:bg-[#2a5a30]"
          >
            <BookOpen size={14} /> Browse All Surahs {isMobileListOpen ? "▲" : "▼"}
          </button>
        </div>

        {/* The Surah List (Expandable) */}
        <div className={`glass-panel p-2 max-h-[40vh] lg:max-h-[60vh] overflow-y-auto custom-scrollbar ${isMobileListOpen ? 'block' : 'hidden lg:block'}`}>
          <div className="space-y-1">
            {surahList.map((surah) => (
              <button
                key={surah.index}
                onClick={() => {
                  setSelectedSurah(surah.index);
                  setIsMobileListOpen(false); // Close menu on mobile after selection
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all ${
                  selectedSurah === surah.index
                    ? "bg-[#1a3d1f] border border-[#c9a84c]/20 text-[#c9a84c]"
                    : "hover:bg-[#1a3d1f]/50 text-emerald-100/70 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs w-6 h-6 flex items-center justify-center rounded-full bg-[#0a1f0f] border border-[#1a3d1f] text-[#c9a84c] font-bold">
                    {surah.index}
                  </span>
                  <div>
                    <div className="font-semibold text-sm">{surah.englishName}</div>
                    <div className="text-[10px] text-[#4a7c52]">{surah.englishMeaning}</div>
                  </div>
                </div>
                <div className="text-right hidden xl:block">
                  <div className="font-arabic text-sm text-[#e8d5a3]">{surah.name}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Progress Card */}
        <div className="glass-panel p-4 hidden lg:block">
          <div className="text-[10px] font-bold tracking-widest text-[#4a7c52] uppercase flex items-center gap-2 mb-3">
            <Sparkles size={12} className="text-[var(--color-gold)]" /> Reading Progress
          </div>
          <div className="h-1.5 bg-[#1a3d1f] rounded overflow-hidden mb-2">
            <div className="h-full bg-[#c9a84c] rounded transition-all duration-500" style={{ width: `${(selectedSurah / 114) * 100}%` }}></div>
          </div>
          <div className="text-xs text-[#6b9e72] flex justify-between">
            <span><strong className="text-[#c9a84c]">{selectedSurah}</strong> of 114 Surahs</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="lg:col-span-3 flex flex-col gap-4 md:gap-6">
        {/* Header Ribbon / Audio Controller */}
        <div className="glass-panel p-4 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 glowing-active">
          <div>
            <div className="flex items-center gap-2 md:gap-3">
              <span className="px-2 py-0.5 md:px-3 md:py-1 rounded bg-amber-400/20 text-amber-300 text-[10px] md:text-xs font-bold uppercase tracking-wider">
                {activeSurahDetails.type}
              </span>
              <span className="text-xs md:text-sm text-[#8ab69d]">{activeSurahDetails.versesCount} Verses</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold mt-1 text-white flex items-center gap-2">
              {activeSurahDetails.englishName}
              <span className="font-arabic text-2xl text-amber-300 font-normal">
                ({activeSurahDetails.name})
              </span>
            </h2>
            <p className="text-sm text-[#8ab69d] italic">{activeSurahDetails.englishMeaning}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1 md:mt-0">
            {/* Audio Recitation Button */}
            <button
              onClick={handlePlayPause}
              className="bg-[#1a3d1f] text-[#c9a84c] border border-[#2a5a30] text-xs md:text-sm py-2 px-3 md:px-4 flex-1 md:flex-none justify-center rounded-lg font-bold flex items-center gap-2 transition-all hover:bg-[#2a5a30]"
              title="Listen to beautiful audio recitation"
            >
              {isPlaying ? (
                <>
                  <Pause size={16} className="text-[#c9a84c] animate-pulse" />
                  <span>Pause Surah Recitation</span>
                </>
              ) : (
                <>
                  <Play size={16} className="text-[#c9a84c]" />
                  <span>Audio Surah Recitation</span>
                </>
              )}
            </button>
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
            <audio
              ref={verseAudioRef}
              onEnded={() => setPlayingVerseNum(null)}
              className="hidden"
            />
          </div>
        </div>

        {/* Global Translation Switch */}
        <div className="flex justify-between items-center px-4 py-2 glass-panel">
          <div className="text-xs text-[#8ab69d]">
            💡 <span className="text-[#c9a84c] font-semibold">Tip:</span> Click directly on any Arabic verse to toggle its translation inline.
          </div>
          <button
            onClick={() => setShowGlobalTranslation(!showGlobalTranslation)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#1a3d1f] bg-[#0d2512] hover:bg-[#1a3d1f] transition-all text-[#c9a84c]"
          >
            {showGlobalTranslation ? "Hide All Translations" : "Show All Translations"}
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="glass-panel py-24 text-center text-[var(--color-gold)] animate-pulse flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-semibold tracking-wide mt-2">Fetching surah verses from FastAPI...</p>
          </div>
        )}

        {/* Quran Text Scroll */}
        {!isLoading && (
          <div className="flex flex-col gap-4 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
            {verses.map((verse) => {
              const hasIndividualToggle = individualToggles[verse.verse_number] !== undefined;
              const isTranslationVisible = hasIndividualToggle 
                ? individualToggles[verse.verse_number] 
                : showGlobalTranslation;

              return (
                <div
                  key={verse.verse_number}
                  className={`bg-[var(--color-bg-dark)] border border-[var(--color-glass-border)] rounded-[14px] p-4 md:p-5 cursor-pointer transition-all hover:border-[#2a5a30] ${
                    isTranslationVisible ? "border-[#c9a84c]/20 bg-[#0f2914]" : ""
                  }`}
                  onClick={() => toggleVerseTranslation(verse.verse_number)}
                >
                  {/* Verse Top */}
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[11px] font-bold text-[#4a7c52] bg-[#1a3d1f] rounded-md px-2.5 py-1 tracking-wide">
                      {selectedSurah} : {verse.verse_number}
                    </span>
                    <span className="text-[11px] text-[#2a5a30]">Click to toggle translation</span>
                  </div>

                  {/* Arabic Text */}
                  <div className="font-arabic text-2xl md:text-3xl text-[#e8d5a3] text-right leading-[1.9] dir-rtl">
                    {verse.text_uthmani}
                  </div>

                  {/* Divider */}
                  <div className="h-[1px] bg-[#1a3d1f] my-4"></div>

                  {/* Translation */}
                  {isTranslationVisible && (
                    <div className="text-sm md:text-base text-[#8aab8e] leading-[1.7] italic mb-3">
                      {verse.translation}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => playVerseAudio(verse)}
                      className="bg-[#1a3d1f] border border-[#1a3d1f] rounded-md text-[var(--color-gold)] text-[11px] font-medium px-3 py-1.5 flex items-center gap-1.5 transition-all hover:border-[#2a5a30] hover:text-[#6b9e72]"
                    >
                      {playingVerseNum === verse.verse_number ? (
                        <>
                          <Pause size={13} className="animate-pulse" /> Stop Audio
                        </>
                      ) : (
                        <>
                          <Play size={13} /> Play Verse
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => shareVerse(verse)}
                      className="bg-[#1a3d1f] border border-[#1a3d1f] rounded-md text-[#4a7c52] text-[11px] font-medium px-3 py-1.5 flex items-center gap-1.5 transition-all hover:border-[#2a5a30] hover:text-[#6b9e72]"
                    >
                      <Share2 size={13} /> Share
                    </button>
                    <button
                      onClick={() => copyToClipboard(`${verse.text_uthmani}\n\n"${verse.translation}" - Quran ${selectedSurah}:${verse.verse_number}`)}
                      className="bg-[#1a3d1f] border border-[#1a3d1f] rounded-md text-[#4a7c52] text-[11px] font-medium px-3 py-1.5 flex items-center gap-1.5 transition-all hover:border-[#2a5a30] hover:text-[#6b9e72]"
                    >
                      <Copy size={13} /> Copy
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
