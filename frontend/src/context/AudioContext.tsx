import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { surahList } from "../data/quranData";



export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  translationId: number;
}

export interface ReciterOption {
  id: string;
  name: string;
  style: string;
  reciterId: number;
  /** If true, cdn.islamic.network has a working surah-level mp3 */
  hasSurahCdn: boolean;
  surahAudioPattern: (surahId: number) => string;
  verseAudioPattern: (surahId: number, verseNum: number) => string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", name: "English (Sahih)", nativeName: "English", translationId: 85 },
  { code: "roman", name: "Roman English (Urdu)", nativeName: "Roman English", translationId: 831 },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", translationId: 122 },
  { code: "mr", name: "Marathi", nativeName: "मराठी", translationId: 226 },
  { code: "ur", name: "Urdu", nativeName: "اردو", translationId: 158 },
  { code: "es", name: "Spanish", nativeName: "Español", translationId: 83 },
  { code: "fr", name: "French", nativeName: "Français", translationId: 136 },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", translationId: 77 },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", translationId: 33 },
  { code: "ru", name: "Russian", nativeName: "Русский", translationId: 45 },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", translationId: 161 },
  { code: "zh", name: "Chinese", nativeName: "中文", translationId: 109 },
  { code: "de", name: "German", nativeName: "Deutsch", translationId: 27 },
];

export const RECITER_OPTIONS: ReciterOption[] = [
  {
    id: "alafasy",
    name: "Mishary Alafasy",
    style: "Murattal",
    reciterId: 7,
    hasSurahCdn: false,
    surahAudioPattern: (s) => `https://everyayah.com/data/Alafasy_128kbps/${String(s).padStart(3, "0")}001.mp3`,
    verseAudioPattern: (s, v) =>
      `https://everyayah.com/data/Alafasy_128kbps/${String(s).padStart(3, "0")}${String(v).padStart(3, "0")}.mp3`,
  },
  {
    id: "basit",
    name: "Abdul Basit (Murattal)",
    style: "Murattal",
    reciterId: 1,
    hasSurahCdn: false,
    surahAudioPattern: (s) => `https://everyayah.com/data/Abdul_Basit_Murattal_192kbps/${String(s).padStart(3, "0")}001.mp3`,
    verseAudioPattern: (s, v) =>
      `https://everyayah.com/data/Abdul_Basit_Murattal_192kbps/${String(s).padStart(3, "0")}${String(v).padStart(3, "0")}.mp3`,
  },
  {
    id: "hudhaify",
    name: "Ali Al-Hudhaify",
    style: "Murattal",
    reciterId: 6,
    hasSurahCdn: false,
    surahAudioPattern: (s) => `https://everyayah.com/data/Hudhaify_128kbps/${String(s).padStart(3, "0")}001.mp3`,
    verseAudioPattern: (s, v) =>
      `https://everyayah.com/data/Hudhaify_128kbps/${String(s).padStart(3, "0")}${String(v).padStart(3, "0")}.mp3`,
  },
];

export interface AudioContextType {
  // Settings
  selectedLanguage: LanguageOption;
  setSelectedLanguage: (lang: LanguageOption) => void;
  selectedReciter: ReciterOption;
  setSelectedReciter: (reciter: ReciterOption) => void;

  // Playback state
  isPlaying: boolean;
  playingType: "surah" | "verse" | null;
  playingSurahId: number | null;
  playingVerseNumber: number | null;
  currentTime: number;
  duration: number;

  // Actions
  playSurah: (surahId: number) => void;
  playVerse: (surahId: number, verseNumber: number) => void;
  pauseAudio: () => void;
  resumeAudio: () => void;
  stopAudio: () => void;
  seekAudio: (time: number) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(() => {
    const saved = localStorage.getItem("quran_language");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const matched = LANGUAGE_OPTIONS.find((l) => l.translationId === parsed.translationId);
        if (matched) return matched;
      } catch (e) {}
    }
    return LANGUAGE_OPTIONS[0];
  });

  const [selectedReciter, setSelectedReciter] = useState<ReciterOption>(() => {
    const saved = localStorage.getItem("quran_reciter");
    if (saved) {
      const matched = RECITER_OPTIONS.find((r) => r.id === saved);
      if (matched) return matched;
    }
    return RECITER_OPTIONS[0];
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playingType, setPlayingType] = useState<"surah" | "verse" | null>(null);
  const [playingSurahId, setPlayingSurahId] = useState<number | null>(null);
  const [playingVerseNumber, setPlayingVerseNumber] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sequential surah playback state (for reciters without surah-level CDN)
  const surahPlaybackRef = useRef<{
    surahId: number;
    currentVerse: number;
    totalVerses: number;
    reciterId: string;
  } | null>(null);

  const selectedReciterRef = useRef(selectedReciter);
  useEffect(() => {
    selectedReciterRef.current = selectedReciter;
  }, [selectedReciter]);

  const playNextVerse = useCallback(() => {
    const state = surahPlaybackRef.current;
    const audio = audioRef.current;
    if (!state || !audio) return;

    const nextVerse = state.currentVerse + 1;
    if (nextVerse > state.totalVerses) {
      // Surah complete
      surahPlaybackRef.current = null;
      setIsPlaying(false);
      setPlayingType(null);
      setPlayingSurahId(null);
      setPlayingVerseNumber(null);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    state.currentVerse = nextVerse;
    setPlayingVerseNumber(nextVerse);

    const url = selectedReciterRef.current.verseAudioPattern(state.surahId, nextVerse);
    audio.src = url;
    audio.load();
    audio.play().catch(console.error);
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
      // Check if we are in sequential surah mode
      if (surahPlaybackRef.current) {
        playNextVerse();
        return;
      }
      setIsPlaying(false);
      setPlayingType(null);
      setPlayingSurahId(null);
      setPlayingVerseNumber(null);
      setCurrentTime(0);
      setDuration(0);
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audioRef.current = null;
    };
  }, [playNextVerse]);

  const playSurah = (surahId: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Toggle pause/resume if already playing this surah
    if (playingType === "surah" && playingSurahId === surahId) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch(console.error);
      }
      return;
    }

    audio.pause();
    surahPlaybackRef.current = null;
    setPlayingType("surah");
    setPlayingSurahId(surahId);
    setPlayingVerseNumber(null);
    setCurrentTime(0);
    setDuration(0);

    if (selectedReciter.hasSurahCdn) {
      // Use surah-level CDN audio (single file for entire surah)
      const url = selectedReciter.surahAudioPattern(surahId);
      const fallbackUrl = selectedReciter.verseAudioPattern(surahId, 1);
      audio.src = url;
      audio.load();

      const handleError = () => {
        if (audio.src !== fallbackUrl) {
          console.warn(`Surah CDN failed, trying fallback: ${fallbackUrl}`);
          // Fall back to sequential verse playback
          startSequentialVersePlayback(surahId);
        }
      };
      audio.addEventListener("error", handleError, { once: true });

      audio.play().catch(() => {
        console.warn("Surah CDN play failed, switching to sequential verse playback");
        audio.removeEventListener("error", handleError);
        startSequentialVersePlayback(surahId);
      });
    } else {
      // Reciter doesn't have surah-level CDN; use sequential verse-by-verse playback
      startSequentialVersePlayback(surahId);
    }
  };

  const startSequentialVersePlayback = (surahId: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const surahData = surahList.find((s) => s.index === surahId);
    const totalVerses = surahData?.versesCount ?? 1;

    surahPlaybackRef.current = {
      surahId,
      currentVerse: 1,
      totalVerses,
      reciterId: selectedReciterRef.current.id,
    };
    setPlayingVerseNumber(1);

    const url = selectedReciterRef.current.verseAudioPattern(surahId, 1);
    audio.src = url;
    audio.load();
    audio.play().then(() => setIsPlaying(true)).catch(console.error);
  };

  const playVerse = (surahId: number, verseNumber: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Stop any sequential surah playback
    surahPlaybackRef.current = null;

    if (
      playingType === "verse" &&
      playingSurahId === surahId &&
      playingVerseNumber === verseNumber
    ) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch(console.error);
      }
      return;
    }

    audio.pause();
    const url = selectedReciter.verseAudioPattern(surahId, verseNumber);
    audio.src = url;
    audio.load();
    setPlayingType("verse");
    setPlayingSurahId(surahId);
    setPlayingVerseNumber(verseNumber);
    audio.play().then(() => setIsPlaying(true)).catch(console.error);
  };

  const pauseAudio = () => {
    audioRef.current?.pause();
  };

  const resumeAudio = () => {
    audioRef.current?.play().catch(console.error);
  };

  const stopAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    surahPlaybackRef.current = null;
    audio.pause();
    audio.src = "";
    audio.load();
    setIsPlaying(false);
    setPlayingType(null);
    setPlayingSurahId(null);
    setPlayingVerseNumber(null);
    setCurrentTime(0);
    setDuration(0);
  };

  const seekAudio = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSetLanguage = (lang: LanguageOption) => {
    setSelectedLanguage(lang);
    localStorage.setItem("quran_language", JSON.stringify(lang));
  };

  const handleSetReciter = (reciter: ReciterOption) => {
    setSelectedReciter(reciter);
    localStorage.setItem("quran_reciter", reciter.id);
    stopAudio();
  };

  return (
    <AudioContext.Provider
      value={{
        selectedLanguage,
        setSelectedLanguage: handleSetLanguage,
        selectedReciter,
        setSelectedReciter: handleSetReciter,
        isPlaying,
        playingType,
        playingSurahId,
        playingVerseNumber,
        currentTime,
        duration,
        playSurah,
        playVerse,
        pauseAudio,
        resumeAudio,
        stopAudio,
        seekAudio,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
};
