import React, { useState, useEffect } from "react";
import { surahList, getSurahVerses } from "../data/quranData";
import { BookOpen, Play, Pause, Share2, Copy, Sparkles, Globe, Volume2, ChevronDown, Bookmark, Info, Search as SearchIcon, Trash } from "lucide-react";
import { useAudio, LANGUAGE_OPTIONS, RECITER_OPTIONS } from "../context/AudioContext";
import { juzList } from "../data/juzData";
import { getDailyVerse } from "../data/dailyVerses";
import type { DailyVerse } from "../data/dailyVerses";
import { getSurahIntro } from "../data/surahIntros";

interface Verse {
  id: number;
  verse_number: number;
  text_uthmani: string;
  translation: string;
  text_transliteration?: string;
  audio_url?: string;
}

const cleanTranslationText = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/<sup[^>]*>.*?<\/sup>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const highlightText = (text: string, highlight: string) => {
  if (!text) return "";
  if (!highlight.trim()) return <>{text}</>;
  const regex = new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <mark key={i} className="bg-amber-400/40 text-amber-100 rounded px-0.5">{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
};

export const QuranReader: React.FC<{ theme: string; setTheme: (theme: string) => void }> = ({ theme, setTheme }) => {
  const [selectedSurah, setSelectedSurah] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lastReadSurah");
      if (saved) return parseInt(saved, 10);
    }
    return 1;
  });
  const [bookmarkedPosition] = useState<{surah: number, verse: number} | null>(() => {
    if (typeof window !== "undefined") {
      const s = localStorage.getItem("bookmarkedSurah");
      const v = localStorage.getItem("bookmarkedVerse");
      if (s && v) return { surah: parseInt(s, 10), verse: parseInt(v, 10) };
    }
    return null;
  });
  const [verses, setVerses] = useState<Verse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showGlobalTranslation, setShowGlobalTranslation] = useState<boolean>(true);
  const [individualToggles, setIndividualToggles] = useState<Record<number, boolean>>({});

  // Font size settings
  const [arabicFontSize, setArabicFontSize] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("arabicFontSize");
      return saved ? parseFloat(saved) : 2.2;
    }
    return 2.2;
  });

  const [translationFontSize, setTranslationFontSize] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("translationFontSize");
      return saved ? parseFloat(saved) : 1.05;
    }
    return 1.05;
  });

  const handleSetArabicFontSize = (size: number) => {
    setArabicFontSize(size);
    if (typeof window !== "undefined") {
      localStorage.setItem("arabicFontSize", size.toString());
    }
  };

  const handleSetTranslationFontSize = (size: number) => {
    setTranslationFontSize(size);
    if (typeof window !== "undefined") {
      localStorage.setItem("translationFontSize", size.toString());
    }
  };

  const {
    selectedLanguage,
    setSelectedLanguage,
    selectedReciter,
    setSelectedReciter,
    isPlaying,
    playingType,
    playingSurahId,
    playingVerseNumber,
    playSurah,
    playVerse,
  } = useAudio();

  const [showSettingsDropdown, setShowSettingsDropdown] = useState<boolean>(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"language" | "audio" | "appearance">("language");

  // Mobile UX State
  const [isMobileListOpen, setIsMobileListOpen] = useState<boolean>(false);

  // Upgrade Features States
  const [keywordSearch, setKeywordSearch] = useState<string>("");
  const [browseMode, setBrowseMode] = useState<"surah" | "juz">("surah");
  
  const [bookmarks, setBookmarks] = useState<{ id: string; surah: number; verse: number; label: string; timestamp: number }[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("multiple_bookmarks");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [showBookmarksModal, setShowBookmarksModal] = useState<boolean>(false);

  const [dailyVerse, setDailyVerse] = useState<DailyVerse | null>(null);
  const [showDailyVerse, setShowDailyVerse] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hide_daily_verse_date");
      const today = new Date().toDateString();
      return saved !== today;
    }
    return true;
  });

  const [showSurahIntro, setShowSurahIntro] = useState<boolean>(false);
  const [showTransliteration, setShowTransliteration] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("show_transliteration") === "true";
    }
    return false;
  });

  useEffect(() => {
    setDailyVerse(getDailyVerse());
  }, []);

  const handleToggleTransliteration = () => {
    const nextVal = !showTransliteration;
    setShowTransliteration(nextVal);
    if (typeof window !== "undefined") {
      localStorage.setItem("show_transliteration", nextVal.toString());
    }
  };

  const handleAddBookmark = (surahNum: number, verseNum: number) => {
    const surahDetail = surahList.find(s => s.index === surahNum);
    const label = `${surahDetail?.englishName || "Surah"} ${surahNum}:${verseNum}`;
    const id = `${surahNum}-${verseNum}`;
    
    if (bookmarks.some(b => b.id === id)) {
      const updated = bookmarks.filter(b => b.id !== id);
      setBookmarks(updated);
      localStorage.setItem("multiple_bookmarks", JSON.stringify(updated));
    } else {
      const newB = { id, surah: surahNum, verse: verseNum, label, timestamp: Date.now() };
      const updated = [...bookmarks, newB];
      setBookmarks(updated);
      localStorage.setItem("multiple_bookmarks", JSON.stringify(updated));
    }
  };

  const handleRemoveBookmark = (id: string) => {
    const updated = bookmarks.filter(b => b.id !== id);
    setBookmarks(updated);
    localStorage.setItem("multiple_bookmarks", JSON.stringify(updated));
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("lastReadSurah", selectedSurah.toString());
    }
  }, [selectedSurah]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    
    // Clear individual verse toggles when switching Surah
    setIndividualToggles({});

    // Fetch dynamic Surah data directly from the public Quran.com API with selected translation
    fetch(`https://api.quran.com/api/v4/verses/by_chapter/${selectedSurah}?language=en&words=false&translations=${selectedLanguage.translationId}&fields=text_uthmani,text_transliteration&per_page=300`)
      .then((res) => {
        if (!res.ok) throw new Error("Public API Offline");
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          const mappedVerses = data.verses.map((v: any) => ({
            id: v.id,
            verse_number: v.verse_number,
            text_uthmani: v.text_uthmani,
            translation: v.translations && v.translations[0] ? cleanTranslationText(v.translations[0].text) : "",
            text_transliteration: v.text_transliteration || "",
            audio_url: v.audio?.url ? `https://verses.quran.com/${v.audio.url}` : undefined
          }));
          setVerses(mappedVerses);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Quran.com API offline, falling back to clean simulated/local client database:", err);
        if (isMounted) {
          // Fallback mechanism: use local DB (skip translations if chosen language is not English)
          const localVerses = getSurahVerses(selectedSurah);
          const mappedLocal = localVerses.map((v, idx) => ({
            id: idx,
            verse_number: v.verseNumber,
            text_uthmani: v.arabic,
            translation: (selectedLanguage.code === "en" || selectedLanguage.code === "roman") ? v.english : ""
          }));
          setVerses(mappedLocal);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSurah, selectedLanguage]);

  // Auto-scroll active verse into view smoothly
  useEffect(() => {
    if (isPlaying && playingSurahId === selectedSurah && playingVerseNumber) {
      const element = document.getElementById(`verse-${playingVerseNumber}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [playingVerseNumber, playingSurahId, selectedSurah, isPlaying]);

  const activeSurahDetails = surahList.find((s) => s.index === selectedSurah) || surahList[0];

  // Tafsir state and exegesis fetcher
  const [tafsirVerse, setTafsirVerse] = useState<number | null>(null);
  const [tafsirText, setTafsirText] = useState<string>("");
  const [tafsirLoading, setTafsirLoading] = useState<boolean>(false);

  const handleOpenTafsir = async (verseNum: number) => {
    setTafsirVerse(verseNum);
    setTafsirText("");
    setTafsirLoading(true);
    try {
      const res = await fetch(`https://api.quran.com/api/v4/tafsirs/169/by_ayah/${selectedSurah}:${verseNum}`);
      if (!res.ok) throw new Error("Failed to fetch Tafsir");
      const data = await res.json();
      const rawText = data.tafsir?.text || "No Tafsir translation found for this verse.";
      
      const cleanText = rawText
        .replace(/<sup[^>]*>.*?<\/sup>/g, "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
        
      setTafsirText(cleanText);
    } catch (err) {
      console.error(err);
      setTafsirText("Error loading Tafsir: The Quran.com exegesis database is currently offline. Please try again later.");
    } finally {
      setTafsirLoading(false);
    }
  };

  // Verse-specific translation toggle
  const toggleVerseTranslation = (verseNum: number) => {
    setIndividualToggles((prev) => ({
      ...prev,
      [verseNum]: !prev[verseNum]
    }));
  };

  // Surah Audio Playback
  const handlePlayPause = () => {
    playSurah(selectedSurah);
  };

  // Verse Audio Playback
  const playVerseAudio = (verse: Verse) => {
    playVerse(selectedSurah, verse.verse_number);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Verse copied to clipboard!");
  };



  const shareVerse = async (verse: Verse) => {
    const textToShare = `"${verse.translation}" - Quran ${selectedSurah}:${verse.verse_number} (${activeSurahDetails.englishName})`;
    const shareUrl = `https://quranonbase.vercel.app/`;
    if (navigator.share) {
      navigator.share({
        title: `Quran ${selectedSurah}:${verse.verse_number}`,
        text: textToShare,
        url: shareUrl
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(textToShare);
      alert("Verse details copied for sharing!");
    }
  };

  const renderDropdownContent = () => (
    <>
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#33261a]">
        <span className="text-xs font-bold text-[var(--color-gold)] flex items-center gap-1.5 uppercase tracking-wide">
          <Globe size={13} className="text-[var(--color-gold)]" /> Reader Customization
        </span>
        <button 
          onClick={() => setShowSettingsDropdown(false)} 
          className="text-[10px] uppercase font-bold tracking-wider text-[#8c6b4a] hover:text-white transition-all"
        >
          Close
        </button>
      </div>

      {/* Segmented Tab Controls */}
      <div className="flex bg-[#120d08] p-1 rounded-xl border border-[#33261a] mb-4 gap-1">
        <button
          onClick={() => setActiveSettingsTab("language")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] md:text-[11px] font-bold rounded-lg transition-all ${
            activeSettingsTab === "language"
              ? "bg-[#33261a] text-[var(--color-gold)] border border-[var(--color-gold)]/20 shadow-md"
              : "text-[#8c6b4a] hover:text-[#f0e8d0]"
          }`}
        >
          <Globe size={11} /> Language
        </button>
        <button
          onClick={() => setActiveSettingsTab("audio")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] md:text-[11px] font-bold rounded-lg transition-all ${
            activeSettingsTab === "audio"
              ? "bg-[#33261a] text-[var(--color-gold)] border border-[var(--color-gold)]/20 shadow-md"
              : "text-[#8c6b4a] hover:text-[#f0e8d0]"
          }`}
        >
          <Volume2 size={11} /> Voice
        </button>
        <button
          onClick={() => setActiveSettingsTab("appearance")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] md:text-[11px] font-bold rounded-lg transition-all ${
            activeSettingsTab === "appearance"
              ? "bg-[#33261a] text-[var(--color-gold)] border border-[var(--color-gold)]/20 shadow-md"
              : "text-[#8c6b4a] hover:text-[#f0e8d0]"
          }`}
        >
          🎨 Appearance
        </button>
      </div>

      <div className="space-y-4">
        {activeSettingsTab === "language" ? (
          /* Premium Languages Card List */
          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1 animate-in fade-in duration-200">
            {LANGUAGE_OPTIONS.map((lang) => {
              const isSelected = selectedLanguage.code === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "bg-[#241c12] border-[var(--color-gold)] shadow-[0_0_12px_rgba(201,168,76,0.15)]"
                      : "bg-[#16110b]/55 border-[#33261a] hover:border-[#4d3926] hover:bg-[#1f1810]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="h-8 px-2 min-w-8 flex items-center justify-center rounded-lg text-[10px] font-bold transition-all shrink-0"
                      style={{
                        backgroundColor: isSelected ? "var(--color-gold)" : "#33261a",
                        color: isSelected ? "#16110b" : "#8c6b4a"
                      }}
                    >
                      {lang.code.toUpperCase()}
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${isSelected ? "text-[var(--color-gold)]" : "text-[#f0e8d0]"}`}>
                        {lang.name}
                      </div>
                      <div className="text-[#8c6b4a] font-medium mt-0.5" style={{ fontSize: "10px" }}>Translation</div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <div className="font-arabic text-sm text-[#e8d5a3] font-bold">{lang.nativeName}</div>
                    {isSelected && (
                      <span className="text-[8px] bg-[var(--color-gold)]/10 text-[var(--color-gold)] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-[var(--color-gold)]/20">
                        Active
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : activeSettingsTab === "audio" ? (
          /* Premium Reciters Card List */
          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1 animate-in fade-in duration-200">
            {RECITER_OPTIONS.map((reciter) => {
              const isSelected = selectedReciter.id === reciter.id;
              return (
                <button
                  key={reciter.id}
                  onClick={() => setSelectedReciter(reciter)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "bg-[#241c12] border-[var(--color-gold)] shadow-[0_0_12px_rgba(201,168,76,0.15)]"
                      : "bg-[#16110b]/55 border-[#33261a] hover:border-[#4d3926] hover:bg-[#1f1810]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                      isSelected ? "bg-[var(--color-gold)] text-[#16110b]" : "bg-[#33261a] text-[#8c6b4a]"
                    }`}>
                      <Volume2 size={13} />
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${isSelected ? "text-[var(--color-gold)]" : "text-[#f0e8d0]"}`}>
                        {reciter.name}
                      </div>
                      <div className="text-[#8c6b4a] font-medium mt-0.5" style={{ fontSize: "10px" }}>Qari / Reciter</div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                      isSelected ? "bg-[#33261a] text-[var(--color-gold)] border-[var(--color-gold)]/20" : "bg-[#120d08] text-[#8c6b4a] border-[#33261a]"
                    }`}>
                      {reciter.style}
                    </span>
                    {isSelected && (
                      <span className="text-[8px] bg-[var(--color-gold)]/10 text-[var(--color-gold)] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-[var(--color-gold)]/20 mt-0.5">
                        Selected
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Appearance Options (Theme and Font Sizes) */
          <div className="space-y-4 pr-1 animate-in fade-in duration-200">
            {/* Font size adjustments */}
            <div className="space-y-3 p-3 rounded-xl bg-[#16110b]/55 border border-[#33261a]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-gold)] block">
                Font Size Adjustment
              </span>
              <div className="space-y-2.5">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-[#f0e8d0]">Arabic Text Size</span>
                    <span className="text-[var(--color-gold)] font-mono">{arabicFontSize.toFixed(1)}rem</span>
                  </div>
                  <input
                    type="range"
                    min="1.5"
                    max="3.5"
                    step="0.1"
                    value={arabicFontSize}
                    onChange={(e) => handleSetArabicFontSize(parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#33261a] rounded-lg appearance-none cursor-pointer accent-[var(--color-gold)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-[#f0e8d0]">Translation Text Size</span>
                    <span className="text-[var(--color-gold)] font-mono">{translationFontSize.toFixed(2)}rem</span>
                  </div>
                  <input
                    type="range"
                    min="0.85"
                    max="1.7"
                    step="0.05"
                    value={translationFontSize}
                    onChange={(e) => handleSetTranslationFontSize(parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#33261a] rounded-lg appearance-none cursor-pointer accent-[var(--color-gold)]"
                  />
                </div>
              </div>
            </div>

            {/* Theme switcher */}
            <div className="space-y-3 p-3 rounded-xl bg-[#16110b]/55 border border-[#33261a]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-gold)] block">
                Select Theme
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "theme-amber-gold", name: "Amber Gold", preview: "#1f1810" },
                  { id: "theme-emerald-green", name: "Emerald Green", preview: "#0a2016" },
                  { id: "theme-midnight-blue", name: "Midnight Blue", preview: "#0c1424" },
                  { id: "theme-warm-parchment", name: "Warm Parchment", preview: "#f0eae1" },
                ].map((t) => {
                  const isSelected = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "border-[var(--color-gold)] bg-[#241c12]"
                          : "border-[#33261a] hover:border-[#4d3926] bg-[#120d08]/40"
                      }`}
                    >
                      <div 
                        className="w-4 h-4 rounded-full border border-white/10 shrink-0" 
                        style={{ backgroundColor: t.preview }} 
                      />
                      <span className="text-[11px] font-bold text-[#f0e8d0] truncate">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action / Apply Button */}
      <button
        onClick={() => setShowSettingsDropdown(false)}
        className="w-full mt-4 py-2.5 bg-gradient-to-r from-[var(--color-gold-dark)] to-[var(--color-gold)] text-[#16110b] rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg hover:from-[var(--color-gold)] hover:to-[var(--color-gold-light)] active:translate-y-px transition-all"
        style={{ background: 'linear-gradient(135deg, var(--color-gold-dark) 0%, var(--color-gold) 100%)' }}
      >
        Apply Customization
      </button>
    </>
  );

  return (
    <article className="flex flex-col gap-4 p-0 relative" aria-label="Quran Reader">
      {/* Sidebar hidden at all sizes — surah browsing via Browse Chapters modal */}
      <div className="hidden">
        {/* Current Surah Card */}
        <div className="glass-panel p-4 flex flex-col gap-2">
          <div className="text-[10px] font-bold tracking-widest text-[#8c6b4a] uppercase flex items-center gap-2 mb-2">
            <BookOpen size={12} /> Current Surah
          </div>
          <div className="font-arabic text-xl text-[#e8d5a3] text-right">{activeSurahDetails.name}</div>
          <div className="text-lg font-bold text-[#c9a84c] mb-1">{activeSurahDetails.englishName}</div>
          <div className="flex gap-2 mb-3">
            <span className="text-[10px] font-bold tracking-wide px-2 py-1 rounded bg-[#33261a] text-[#d9a05b] border border-[#4d3926] uppercase">
              {activeSurahDetails.type}
            </span>
            <span className="text-[10px] font-bold tracking-wide px-2 py-1 rounded bg-[#1a2a1a] text-[#8c6b4a] border border-[#33261a]">
              {activeSurahDetails.versesCount} Verses
            </span>
          </div>
          <button 
            id="browse-surahs-sidebar-btn"
            onClick={() => setIsMobileListOpen(true)}
            className="w-full p-2 bg-[#33261a] border border-[#4d3926] rounded-lg text-[#c9a84c] text-[11px] font-bold tracking-wide flex items-center justify-center gap-2 transition-all hover:bg-[#4d3926]"
          >
            <BookOpen size={14} /> Browse All Surahs
          </button>
        </div>

        {/* Desktop Surah List (always visible on desktop, hidden on mobile) */}
        <div className="glass-panel p-2 max-h-[60vh] overflow-y-auto custom-scrollbar hidden lg:block">
          <div className="space-y-1">
            {surahList.map((surah) => (
              <button
                key={surah.index}
                id={`select-surah-${surah.index}`}
                onClick={() => setSelectedSurah(surah.index)}
                className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all ${
                  selectedSurah === surah.index
                    ? "bg-[#33261a] border border-[#c9a84c]/20 text-[#c9a84c]"
                    : "hover:bg-[#33261a]/50 text-emerald-100/70 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs w-6 h-6 flex items-center justify-center rounded-full bg-[#16110b] border border-[#33261a] text-[#c9a84c] font-bold">
                    {surah.index}
                  </span>
                  <div>
                    <div className="font-semibold text-sm">{surah.englishName}</div>
                    <div className="text-[10px] text-[#8c6b4a]">{surah.englishMeaning}{surah.altName ? ` · ${surah.altName}` : ""}</div>
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
          <div className="text-[10px] font-bold tracking-widest text-[#8c6b4a] uppercase flex items-center gap-2 mb-3">
            <Sparkles size={12} className="text-[var(--color-gold)]" /> Reading Progress
          </div>
          <div className="h-1.5 bg-[#33261a] rounded overflow-hidden mb-2">
            <div className="h-full bg-[#c9a84c] rounded transition-all duration-500" style={{ width: `${(selectedSurah / 114) * 100}%` }}></div>
          </div>
          <div className="text-xs text-[#6b9e72] flex justify-between">
            <span><strong className="text-[#c9a84c]">{selectedSurah}</strong> of 114 Surahs</span>
          </div>
        </div>
      </div>

      {/* Main Content Area — always full width */}
      <div className="flex flex-col gap-4">
        {/* Header Ribbon / Audio Controller */}
        <div className="glass-panel p-4 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 glowing-active relative z-40">
          <div>
            <div className="flex items-center gap-2 md:gap-3">
              <span className="px-2 py-0.5 md:px-3 md:py-1 rounded bg-amber-400/20 text-amber-300 text-[10px] md:text-xs font-bold uppercase tracking-wider">
                {activeSurahDetails.type}
              </span>
              <span className="text-xs md:text-sm text-[#b39a7d]">{activeSurahDetails.versesCount} Verses</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold mt-1 text-white flex items-center gap-2">
              {activeSurahDetails.englishName}
              <span className="font-arabic text-2xl text-amber-300 font-normal">
                ({activeSurahDetails.name})
              </span>
            </h2>
            <p className="text-sm text-[#b39a7d] italic">{activeSurahDetails.englishMeaning}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1 md:mt-0">
            {/* Browse Chapters Button */}
            <button
              id="browse-surahs-btn"
              onClick={() => setIsMobileListOpen(true)}
              className="bg-[#c9a84c] text-[#16110b] border border-[#c9a84c] text-xs py-2 px-3 flex-1 md:flex-none justify-center rounded-lg font-bold flex items-center gap-2 transition-all hover:bg-[#e8d5a3]"
            >
              <BookOpen size={15} />
              <span>Browse Chapters</span>
            </button>

            {/* Language & Audio Settings Button */}
            <div className="relative">
              <button
                id="reader-settings-btn"
                onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                className="bg-[#33261a] text-[#c9a84c] border border-[#4d3926] p-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all hover:bg-[#4d3926]"
                title="Choose translation language & audio reciter"
                aria-expanded={showSettingsDropdown}
                aria-haspopup="menu"
              >
                <Globe size={16} />
                <span className="text-xs">
                  <span className="hidden md:inline">Translation: {selectedLanguage.name} | Reciter: {selectedReciter.name.split(" ").slice(-1)[0]}</span>
                  <span className="md:hidden">Translate ({selectedLanguage.code.toUpperCase()})</span>
                </span>
                <ChevronDown size={13} className="opacity-80 shrink-0" />
              </button>

              {/* Settings Dropdown Menu (Desktop) */}
              {showSettingsDropdown && (
                <div className="settings-dropdown-container glass-panel p-4 shadow-xl border border-[var(--color-glass-border)] bg-[var(--color-bg-dark)]/95 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150 rounded-xl hidden md:block">
                  {renderDropdownContent()}
                </div>
              )}
            </div>

            {/* Audio Recitation Button */}
            <button
              id="play-surah-audio-btn"
              onClick={handlePlayPause}
              className="bg-[#33261a] text-[#c9a84c] border border-[#4d3926] text-xs md:text-sm py-2 px-3 md:px-4 flex-1 md:flex-none justify-center rounded-lg font-bold flex items-center gap-2 transition-all hover:bg-[#4d3926]"
              title="Listen to beautiful audio recitation"
            >
              {isPlaying && playingType === "surah" && playingSurahId === selectedSurah ? (
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
          </div>
        </div>

        {/* Daily Verse of the Day Card */}
        {showDailyVerse && dailyVerse && (
          <div className="glass-panel p-4 bg-gradient-to-br from-[#1c1610] to-[#2b1f14] border border-[#c9a84c]/20 relative overflow-hidden rounded-2xl animate-in fade-in duration-200">
            <div className="absolute top-2 right-2 z-10">
              <button 
                onClick={() => {
                  setShowDailyVerse(false);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("hide_daily_verse_date", new Date().toDateString());
                  }
                }}
                className="text-[#8c6b4a] hover:text-white p-1 text-sm font-bold cursor-pointer"
                title="Dismiss Daily Verse"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[var(--color-gold)] mb-2">
              <Sparkles size={11} className="animate-spin duration-1000" /> Verse of the Day
            </div>
            <div className="text-right font-arabic text-lg md:text-xl text-[#e8d5a3] leading-relaxed mb-2 dir-rtl">
              {dailyVerse.arabic}
            </div>
            <p className="text-xs md:text-sm text-[#b39a7d] italic leading-relaxed mb-3">
              "{dailyVerse.english}"
            </p>
            <div className="flex items-center justify-between mt-1 text-[10px] font-semibold text-[#8c6b4a]">
              <span>{dailyVerse.context}</span>
              <button
                onClick={() => {
                  setSelectedSurah(dailyVerse.surah);
                  setTimeout(() => {
                    document.getElementById(`verse-${dailyVerse.verse}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 600);
                }}
                className="text-[var(--color-gold)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Read Context →
              </button>
            </div>
          </div>
        )}

        {/* Collapsible Surah Introduction */}
        <div className="glass-panel rounded-2xl overflow-hidden border border-[#33261a]">
          <button
            onClick={() => setShowSurahIntro(!showSurahIntro)}
            className="w-full flex items-center justify-between p-3 bg-[#1a140e]/60 hover:bg-[#1a140e] transition-all text-left text-xs font-bold text-[#b39a7d] cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Info size={14} className="text-[var(--color-gold)]" />
              <span>About Surah {activeSurahDetails.englishName} ({activeSurahDetails.name})</span>
            </div>
            <span className="text-[10px] text-[var(--color-gold)]">
              {showSurahIntro ? "Hide Description ▲" : "About Surah ▼"}
            </span>
          </button>
          {showSurahIntro && (
            <div className="p-4 bg-[#120d08]/40 border-t border-[#33261a] space-y-3 animate-in fade-in duration-200">
              <div className="text-xs text-[#b39a7d] leading-relaxed">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-gold)] block mb-1">Revelation Period: {getSurahIntro(selectedSurah, activeSurahDetails.englishName, activeSurahDetails.englishMeaning, activeSurahDetails.type, activeSurahDetails.versesCount).period}</span>
                {getSurahIntro(selectedSurah, activeSurahDetails.englishName, activeSurahDetails.englishMeaning, activeSurahDetails.type, activeSurahDetails.versesCount).summary}
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[var(--color-gold)] uppercase tracking-wider block">Key Themes:</span>
                <ul className="list-disc pl-4 space-y-0.5">
                  {getSurahIntro(selectedSurah, activeSurahDetails.englishName, activeSurahDetails.englishMeaning, activeSurahDetails.type, activeSurahDetails.versesCount).keyThemes.map((t, i) => (
                    <li key={i} className="text-[11px] text-[#8c6b4a] leading-relaxed">{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Search, Transliteration, & Bookmarks Quick Utility Row */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between glass-panel p-3">
          <div className="quran-search-wrapper">
            <SearchIcon className="quran-search-icon" size={15} />
            <input
              type="text"
              placeholder="Search loaded verses (Arabic or translation)..."
              value={keywordSearch}
              onChange={(e) => setKeywordSearch(e.target.value)}
              className="quran-search-input"
            />
            {keywordSearch && (
              <button
                onClick={() => setKeywordSearch("")}
                className="quran-search-clear"
              >
                ✕
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Transliteration Toggle */}
            <button
              onClick={handleToggleTransliteration}
              className={`text-xs font-bold px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                showTransliteration 
                  ? "bg-[#241c12] border-[var(--color-gold)] text-[var(--color-gold)]" 
                  : "bg-[#1f1810] border-[#33261a] text-[#8c6b4a] hover:text-white"
              }`}
              title="Toggle phonetic English pronunciation"
            >
              Abc Phonetic
            </button>

            {/* Multiple Bookmarks Manager Trigger */}
            <button
              onClick={() => setShowBookmarksModal(true)}
              className="relative text-xs font-bold px-3 py-2 rounded-xl border bg-[#1f1810] border-[#33261a] text-[var(--color-gold)] hover:bg-[#33261a] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Bookmark size={13} className="fill-[var(--color-gold)] text-[var(--color-gold)]" />
              <span>Bookmarks</span>
              {bookmarks.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-600 text-white font-extrabold text-[9px] flex items-center justify-center shrink-0">
                  {bookmarks.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Global Translation Switch */}
        <div className="flex justify-between items-center px-4 py-2 glass-panel">
          <div className="text-xs text-[#b39a7d]">
            💡 <span className="text-[#c9a84c] font-semibold">Tip:</span> Click directly on any Arabic verse to toggle its translation inline.
          </div>
          <button
            id="toggle-global-translations-btn"
            onClick={() => setShowGlobalTranslation(!showGlobalTranslation)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#33261a] bg-[#1f1810] hover:bg-[#33261a] transition-all text-[#c9a84c]"
          >
            {showGlobalTranslation ? "Hide All Translations" : "Show All Translations"}
          </button>
        </div>

        {/* Bookmark Resume Banner */}
        {bookmarkedPosition && (bookmarkedPosition.surah !== selectedSurah) && (
          <div className="glass-panel px-4 py-3 flex items-center justify-between border-l-4 border-l-[var(--color-gold)] bg-[#241c13]">
            <div className="flex items-center gap-2 text-xs md:text-sm text-[#f0e8d0]">
              <Bookmark size={16} className="text-[var(--color-gold)] fill-[var(--color-gold)]" />
              <span>Resume reading from <strong>Surah {bookmarkedPosition.surah}, Verse {bookmarkedPosition.verse}</strong></span>
            </div>
            <button
              onClick={() => {
                setSelectedSurah(bookmarkedPosition.surah);
                setTimeout(() => {
                  document.getElementById(`verse-${bookmarkedPosition.verse}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 1000);
              }}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-[var(--color-gold-dark)] to-[var(--color-gold)] text-[#16110b] hover:from-[var(--color-gold)] hover:to-[var(--color-gold-light)] transition-all shadow-md"
            >
              Resume
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="glass-panel py-24 text-center text-[var(--color-gold)] animate-pulse flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-semibold tracking-wide mt-2">Loading Holy Quran verses...</p>
          </div>
        )}

        {/* Quran Text Scroll */}
        {!isLoading && (
          <div className="flex flex-col gap-4 pr-2">
            {(() => {
              const filteredVerses = verses.filter((verse) => {
                if (!keywordSearch.trim()) return true;
                const query = keywordSearch.toLowerCase();
                return (
                  verse.text_uthmani.includes(query) ||
                  verse.translation.toLowerCase().includes(query) ||
                  (verse.text_transliteration && verse.text_transliteration.toLowerCase().includes(query))
                );
              });

              if (filteredVerses.length === 0 && keywordSearch.trim() !== "") {
                return (
                  <div className="glass-panel py-16 text-center text-[#8c6b4a]">
                    <SearchIcon size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-semibold">No verses match your search query in this Surah.</p>
                  </div>
                );
              }

              return filteredVerses.map((verse) => {
                const hasIndividualToggle = individualToggles[verse.verse_number] !== undefined;
                const isTranslationVisible = hasIndividualToggle 
                  ? individualToggles[verse.verse_number] 
                  : showGlobalTranslation;

                const isVersePlaying = isPlaying && playingSurahId === selectedSurah && playingVerseNumber === verse.verse_number;
                const isBookmarked = bookmarks.some((b) => b.surah === selectedSurah && b.verse === verse.verse_number);

                return (
                  <div
                    key={verse.verse_number}
                    id={`verse-${verse.verse_number}`}
                    className={`bg-[var(--color-bg-dark)] border border-[var(--color-glass-border)] rounded-[14px] p-4 md:p-5 transition-all hover:border-[#4d3926] ${
                      isTranslationVisible ? "border-[#c9a84c]/20 bg-[#261c13]" : ""
                    } ${
                      isBookmarked 
                        ? "ring-1 ring-[var(--color-gold)]/50" 
                        : ""
                    } ${
                      isVersePlaying 
                        ? "ring-2 ring-[var(--color-gold)] bg-[#241c12] shadow-lg border-[var(--color-gold)]/40 scale-[1.005]" 
                        : ""
                    }`}
                  >
                    {/* Verse Top */}
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[11px] font-bold text-[#8c6b4a] bg-[#33261a] rounded-md px-2.5 py-1 tracking-wide">
                        {selectedSurah} : {verse.verse_number}
                      </span>
                      <span className="text-[11px] text-[#4d3926]">Click text to toggle translation</span>
                    </div>

                    {/* Clickable Text Area */}
                    <div 
                      onClick={() => toggleVerseTranslation(verse.verse_number)}
                      className="cursor-pointer"
                      title="Click to toggle translation inline"
                    >
                      {/* Arabic Text */}
                      <div 
                        className="font-arabic text-[#e8d5a3] text-right leading-[1.9] dir-rtl"
                        style={{ fontSize: `${arabicFontSize}rem` }}
                      >
                        {highlightText(verse.text_uthmani, keywordSearch)}
                      </div>

                      {/* Divider */}
                      <div className="h-[1px] bg-[#33261a] my-4"></div>

                      {/* Transliteration */}
                      {showTransliteration && verse.text_transliteration && (
                        <div 
                          className="text-xs md:text-sm text-amber-200/60 leading-relaxed font-sans mb-2"
                          style={{ fontSize: `${translationFontSize * 0.95}rem` }}
                        >
                          {highlightText(verse.text_transliteration, keywordSearch)}
                        </div>
                      )}

                      {/* Translation */}
                      {isTranslationVisible && (
                        <div 
                          className="text-[#b39a7d] leading-[1.7] italic mb-3"
                          style={{ fontSize: `${translationFontSize}rem` }}
                        >
                          {highlightText(verse.translation, keywordSearch)}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        id={`play-verse-btn-${verse.verse_number}`}
                        onClick={() => playVerseAudio(verse)}
                        className="bg-[#33261a] border border-[#33261a] rounded-md text-[var(--color-gold)] text-[11px] font-medium p-2 flex items-center justify-center gap-1.5 transition-all hover:border-[#4d3926] hover:text-[#6b9e72] cursor-pointer sm:px-3 sm:py-1.5"
                        aria-label="Play verse audio"
                      >
                        {isPlaying && playingType === "verse" && playingSurahId === selectedSurah && playingVerseNumber === verse.verse_number ? (
                          <>
                            <Pause size={13} className="animate-pulse" />
                            <span className="hidden sm:inline">Stop Audio</span>
                          </>
                        ) : (
                          <>
                            <Play size={13} />
                            <span className="hidden sm:inline">Play Verse</span>
                          </>
                        )}
                      </button>
                      <button
                        id={`tafsir-verse-btn-${verse.verse_number}`}
                        onClick={() => handleOpenTafsir(verse.verse_number)}
                        className="bg-[#33261a] border border-[#33261a] rounded-md text-[#8c6b4a] text-[11px] font-medium p-2 flex items-center justify-center gap-1.5 transition-all hover:border-[#4d3926] hover:text-[var(--color-gold)] cursor-pointer sm:px-3 sm:py-1.5"
                      >
                        <BookOpen size={13} />
                        <span className="hidden sm:inline">Tafsir</span>
                      </button>
                      <button
                        id={`share-verse-btn-${verse.verse_number}`}
                        onClick={() => shareVerse(verse)}
                        className="bg-[#33261a] border border-[#33261a] rounded-md text-[#8c6b4a] text-[11px] font-medium p-2 flex items-center justify-center gap-1.5 transition-all hover:border-[#4d3926] hover:text-[var(--color-gold)] cursor-pointer sm:px-3 sm:py-1.5"
                      >
                        <Share2 size={13} />
                        <span className="hidden sm:inline">Share</span>
                      </button>
                      <button
                        id={`bookmark-verse-btn-${verse.verse_number}`}
                        onClick={() => handleAddBookmark(selectedSurah, verse.verse_number)}
                        className={`bg-[#33261a] border border-[#33261a] rounded-md text-[11px] font-medium p-2 flex items-center justify-center gap-1.5 transition-all hover:border-[#4d3926] cursor-pointer sm:px-3 sm:py-1.5 ${
                          isBookmarked
                            ? "text-[var(--color-gold)] border-[var(--color-gold)]/30 font-bold"
                            : "text-[#8c6b4a] hover:text-[var(--color-gold)]"
                        }`}
                      >
                        <Bookmark size={13} className={isBookmarked ? "fill-current" : ""} /> 
                        <span className="hidden sm:inline">{isBookmarked ? "Saved" : "Bookmark"}</span>
                      </button>
                      <button
                        id={`copy-verse-btn-${verse.verse_number}`}
                        onClick={() => copyToClipboard(`${verse.text_uthmani}\n\n"${verse.translation}" - Quran ${selectedSurah}:${verse.verse_number}`)}
                        className="bg-[#33261a] border border-[#33261a] rounded-md text-[#8c6b4a] text-[11px] font-medium p-2 flex items-center justify-center gap-1.5 transition-all hover:border-[#4d3926] hover:text-[#6b9e72] cursor-pointer sm:px-3 sm:py-1.5"
                      >
                        <Copy size={13} />
                        <span className="hidden sm:inline">Copy</span>
                      </button>
                    </div>
                </div>
              );
              });
            })()}
          </div>
        )}
      </div>

      {/* Surah List Modal */}
      {isMobileListOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="glass-panel w-full max-w-md max-h-[85vh] flex flex-col p-4 overflow-hidden animate-in fade-in zoom-in-95" style={{ background: 'var(--color-bg-dark)' }}>
            <div className="flex justify-between items-center pb-3 border-b border-[#33261a] mb-3">
              <h3 className="font-bold text-[var(--color-gold)] text-sm tracking-wide uppercase flex items-center gap-2">
                <BookOpen size={16} /> Browse Chapters & Juz
              </h3>
              <button 
                onClick={() => setIsMobileListOpen(false)}
                className="text-[#8c6b4a] hover:text-[#f0e8d0] p-1 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Segmented controls for Surah vs Juz navigation */}
            <div className="flex bg-[#120d08] p-1 rounded-xl border border-[#33261a] mb-3 gap-1">
              <button
                onClick={() => setBrowseMode("surah")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                  browseMode === "surah"
                    ? "bg-[#33261a] text-[var(--color-gold)] border border-[var(--color-gold)]/20"
                    : "text-[#8c6b4a] hover:text-[#f0e8d0]"
                }`}
              >
                Surahs
              </button>
              <button
                onClick={() => setBrowseMode("juz")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                  browseMode === "juz"
                    ? "bg-[#33261a] text-[var(--color-gold)] border border-[var(--color-gold)]/20"
                    : "text-[#8c6b4a] hover:text-[#f0e8d0]"
                }`}
              >
                Juz (Para)
              </button>
            </div>
            
            <div className="flex-grow overflow-y-auto custom-scrollbar space-y-1 pr-1">
              {browseMode === "surah" ? (
                surahList.map((surah) => (
                  <button
                    key={surah.index}
                    onClick={() => {
                      setSelectedSurah(surah.index);
                      setIsMobileListOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all ${
                      selectedSurah === surah.index
                        ? "bg-[#33261a] border border-[#c9a84c]/20 text-[#c9a84c]"
                        : "hover:bg-[#33261a]/50 text-[#f0e8d0]/75 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs w-6 h-6 flex items-center justify-center rounded-full bg-[#16110b] border border-[#33261a] text-[#c9a84c] font-bold">
                        {surah.index}
                      </span>
                      <div>
                        <div className="font-semibold text-sm">{surah.englishName}</div>
                        <div className="text-[10px] text-[#8c6b4a]">{surah.englishMeaning}{surah.altName ? ` · ${surah.altName}` : ""}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-arabic text-sm text-[#e8d5a3]">{surah.name}</div>
                    </div>
                  </button>
                ))
              ) : (
                juzList.map((juz) => (
                  <button
                    key={juz.index}
                    onClick={() => {
                      setSelectedSurah(juz.startSurah);
                      setTimeout(() => {
                        const element = document.getElementById(`verse-${juz.startVerse}`);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }, 1000);
                      setIsMobileListOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-lg text-left transition-all hover:bg-[#33261a]/50 text-[#f0e8d0]/75 hover:text-white"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs w-6 h-6 flex items-center justify-center rounded-full bg-[#16110b] border border-[#33261a] text-[var(--color-gold)] font-bold">
                        {juz.index}
                      </span>
                      <div>
                        <div className="font-semibold text-sm">Juz {juz.index} - {juz.englishName}</div>
                        <div className="text-[10px] text-[#8c6b4a]">Starts at Surah {juz.startSurah}, Verse {juz.startVerse}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-arabic text-sm text-[#e8d5a3]">{juz.name}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Bottom Drawer (Mobile) */}
      {showSettingsDropdown && (
        <div className="md:hidden">
          <div 
            className="fixed inset-0 bg-black/60 z-[90]"
            onClick={() => setShowSettingsDropdown(false)}
          />
          <div className="settings-dropdown-container glass-panel p-4 shadow-xl border border-[var(--color-glass-border)] bg-[var(--color-bg-dark)]/95 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150 rounded-xl">
            {/* Native Sheet Pull Indicator */}
            <div className="w-12 h-1 bg-[#4d3926] rounded-full mx-auto mb-3 opacity-60" />
            {renderDropdownContent()}
          </div>
        </div>
      )}

      {/* TAFSIR MODAL DRAWER */}
      {tafsirVerse !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl max-h-[80vh] flex flex-col p-6 animate-in fade-in zoom-in-95" style={{ background: 'var(--color-bg-dark)' }}>
            <div className="flex justify-between items-center pb-3 border-b border-[#33261a] mb-4">
              <h3 className="font-bold text-[var(--color-gold)] text-sm md:text-base tracking-wide uppercase flex items-center gap-2">
                📖 Tafsir Ibn Kathir — Verse {selectedSurah}:{tafsirVerse}
              </h3>
              <button
                onClick={() => setTafsirVerse(null)}
                className="text-[#8c6b4a] hover:text-white font-bold p-1 text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar pr-1">
              {tafsirLoading ? (
                <div className="py-20 text-center text-[var(--color-gold)] animate-pulse flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs font-semibold mt-2">Loading Quranic exegesis...</p>
                </div>
              ) : (
                <div className="text-sm md:text-base text-[#f0e8d0] leading-[1.8] font-normal whitespace-pre-line">
                  {tafsirText}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#33261a] flex justify-end">
              <button
                onClick={() => setTafsirVerse(null)}
                className="gold-button py-2 px-5 text-xs font-bold"
              >
                Close Tafsir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MULTIPLE BOOKMARKS MODAL */}
      {showBookmarksModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md max-h-[75vh] flex flex-col p-5 animate-in fade-in zoom-in-95" style={{ background: 'var(--color-bg-dark)' }}>
            <div className="flex justify-between items-center pb-3 border-b border-[#33261a] mb-4">
              <h3 className="font-bold text-[var(--color-gold)] text-sm md:text-base tracking-wide uppercase flex items-center gap-2">
                <Bookmark size={15} className="fill-[var(--color-gold)]" /> My Bookmarks
              </h3>
              <button
                onClick={() => setShowBookmarksModal(false)}
                className="text-[#8c6b4a] hover:text-white font-bold p-1 text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar pr-1 space-y-2">
              {bookmarks.length === 0 ? (
                <div className="py-12 text-center text-[#8c6b4a] text-xs">
                  <Bookmark size={24} className="mx-auto mb-2 opacity-30" />
                  <p>You have no bookmarks saved yet.</p>
                  <p className="mt-1 text-[10px]">Click the Bookmark button on any verse to save it here.</p>
                </div>
              ) : (
                [...bookmarks].sort((a,b) => b.timestamp - a.timestamp).map((b) => (
                  <div 
                    key={b.id}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-[#33261a] bg-[#120d08]/40 hover:border-[#4d3926] transition-all"
                  >
                    <button
                      onClick={() => {
                        setSelectedSurah(b.surah);
                        setTimeout(() => {
                          const element = document.getElementById(`verse-${b.verse}`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }, 800);
                        setShowBookmarksModal(false);
                      }}
                      className="flex-grow text-left text-xs font-bold text-[#f0e8d0] hover:text-[var(--color-gold)] transition-colors pr-2 cursor-pointer"
                    >
                      <div>{b.label}</div>
                      <div className="text-[9px] text-[#8c6b4a] font-normal mt-0.5">
                        Saved: {new Date(b.timestamp).toLocaleDateString()}
                      </div>
                    </button>
                    <button
                      onClick={() => handleRemoveBookmark(b.id)}
                      className="p-2 rounded-lg text-rose-400 hover:bg-rose-950/20 transition-colors shrink-0 cursor-pointer"
                      title="Remove Bookmark"
                    >
                      <Trash size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#33261a] flex justify-end">
              <button
                onClick={() => setShowBookmarksModal(false)}
                className="gold-button py-2 px-5 text-xs font-bold"
              >
                Close Bookmarks
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
