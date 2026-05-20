import React, { createContext, useContext, useState, useEffect, useRef } from "react";

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
  surahAudioPattern: (surahId: number) => string;
  verseAudioPattern: (surahId: number, verseNum: number) => string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", name: "English (Sahih)", nativeName: "English", translationId: 85 },
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
    surahAudioPattern: (s) => `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${s}.mp3`,
    verseAudioPattern: (s, v) => `https://verses.quran.com/Alafasy/mp3/${String(s).padStart(3, "0")}${String(v).padStart(3, "0")}.mp3`
  },
  { 
    id: "sudais", 
    name: "Abdul Rahman Al-Sudais", 
    style: "Murattal", 
    reciterId: 3,
    surahAudioPattern: (s) => `https://cdn.islamic.network/quran/audio-surah/128/ar.sudais/${s}.mp3`,
    verseAudioPattern: (s, v) => `https://verses.quran.com/Sudais/mp3/${String(s).padStart(3, "0")}${String(v).padStart(3, "0")}.mp3`
  },
  { 
    id: "muaiqly", 
    name: "Maher Al-Muaiqly", 
    style: "Murattal", 
    reciterId: 12,
    surahAudioPattern: (s) => `https://cdn.islamic.network/quran/audio-surah/128/ar.mahermuaiqly/${s}.mp3`,
    verseAudioPattern: (s, v) => `https://verses.quran.com/MaherAlMuaiqly/mp3/${String(s).padStart(3, "0")}${String(v).padStart(3, "0")}.mp3`
  },
  { 
    id: "ghamadi", 
    name: "Saad Al-Ghamdi", 
    style: "Murattal", 
    reciterId: 5,
    surahAudioPattern: (s) => `https://cdn.islamic.network/quran/audio-surah/128/ar.ghaamidi/${s}.mp3`,
    verseAudioPattern: (s, v) => `https://verses.quran.com/Ghamadi/mp3/${String(s).padStart(3, "0")}${String(v).padStart(3, "0")}.mp3`
  },
  { 
    id: "english", 
    name: "English translation (Ibrahim Walk)", 
    style: "Translation Audio", 
    reciterId: 12,
    surahAudioPattern: (s) => `https://cdn.islamic.network/quran/audio-surah/128/en.walk/${s}.mp3`,
    verseAudioPattern: (s, v) => `https://verses.quran.com/IbrahimWalk/mp3/${String(s).padStart(3, "0")}${String(v).padStart(3, "0")}.mp3`
  }
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
        const matched = LANGUAGE_OPTIONS.find(l => l.translationId === parsed.translationId);
        if (matched) return matched;
      } catch (e) {}
    }
    return LANGUAGE_OPTIONS[0]; // English (Sahih)
  });

  const [selectedReciter, setSelectedReciter] = useState<ReciterOption>(() => {
    const saved = localStorage.getItem("quran_reciter");
    if (saved) {
      const matched = RECITER_OPTIONS.find(r => r.id === saved);
      if (matched) return matched;
    }
    return RECITER_OPTIONS[0]; // Mishary Alafasy
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playingType, setPlayingType] = useState<"surah" | "verse" | null>(null);
  const [playingSurahId, setPlayingSurahId] = useState<number | null>(null);
  const [playingVerseNumber, setPlayingVerseNumber] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Instantiate audio object on mount
    const audio = new Audio();
    audioRef.current = audio;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
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
  }, []);

  const playSurah = (surahId: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const url = selectedReciter.surahAudioPattern(surahId);

    if (playingType === "surah" && playingSurahId === surahId) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch(console.error);
      }
      return;
    }

    audio.pause();
    audio.src = url;
    audio.load();
    setPlayingType("surah");
    setPlayingSurahId(surahId);
    setPlayingVerseNumber(null);
    audio.play().then(() => {
      setIsPlaying(true);
    }).catch(console.error);
  };

  const playVerse = (surahId: number, verseNumber: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const url = selectedReciter.verseAudioPattern(surahId, verseNumber);

    if (playingType === "verse" && playingSurahId === surahId && playingVerseNumber === verseNumber) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch(console.error);
      }
      return;
    }

    audio.pause();
    audio.src = url;
    audio.load();
    setPlayingType("verse");
    setPlayingSurahId(surahId);
    setPlayingVerseNumber(verseNumber);
    audio.play().then(() => {
      setIsPlaying(true);
    }).catch(console.error);
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
