import React, { useState, useEffect } from "react";
import { surahList, getSurahVerses } from "../data/quranData";
import { BookOpen, Play, Pause, Share2, Copy, Sparkles, Globe, Volume2, ChevronDown } from "lucide-react";
import { useAudio, LANGUAGE_OPTIONS, RECITER_OPTIONS } from "../context/AudioContext";

interface Verse {
  id: number;
  verse_number: number;
  text_uthmani: string;
  translation: string;
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

export const QuranReader: React.FC = () => {
  const [selectedSurah, setSelectedSurah] = useState<number>(1);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showGlobalTranslation, setShowGlobalTranslation] = useState<boolean>(true);
  const [individualToggles, setIndividualToggles] = useState<Record<number, boolean>>({});

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
  const [activeSettingsTab, setActiveSettingsTab] = useState<"language" | "audio">("language");

  // Mobile UX State
  const [isMobileListOpen, setIsMobileListOpen] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    
    // Clear individual verse toggles when switching Surah
    setIndividualToggles({});

    // Fetch dynamic Surah data directly from the public Quran.com API with selected translation
    fetch(`https://api.quran.com/api/v4/verses/by_chapter/${selectedSurah}?language=en&words=false&translations=${selectedLanguage.translationId}&fields=text_uthmani&per_page=300`)
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
      <div className="flex bg-[#120d08] p-1 rounded-xl border border-[#33261a] mb-4">
        <button
          onClick={() => setActiveSettingsTab("language")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-[11px] font-bold rounded-lg transition-all ${
            activeSettingsTab === "language"
              ? "bg-[#33261a] text-[var(--color-gold)] border border-[var(--color-gold)]/20 shadow-md"
              : "text-[#8c6b4a] hover:text-[#f0e8d0]"
          }`}
        >
          <Globe size={12} /> Language
        </button>
        <button
          onClick={() => setActiveSettingsTab("audio")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-[11px] font-bold rounded-lg transition-all ${
            activeSettingsTab === "audio"
              ? "bg-[#33261a] text-[var(--color-gold)] border border-[var(--color-gold)]/20 shadow-md"
              : "text-[#8c6b4a] hover:text-[#f0e8d0]"
          }`}
        >
          <Volume2 size={12} /> Reciter voice
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
        ) : (
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
    <article className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-0 md:p-4 relative" aria-label="Quran Reader">
      {/* Side Menu / Sidebar - Hidden on mobile, shown on desktop */}
      <div className="lg:col-span-1 hidden lg:flex flex-col gap-4">
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

      {/* Main Content Area */}
      <div className="lg:col-span-3 flex flex-col gap-4 md:gap-6">
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
            {/* Mobile-only Browse Chapters Button */}
            <button
              id="browse-surahs-mobile-btn"
              onClick={() => setIsMobileListOpen(true)}
              className="lg:hidden bg-[#c9a84c] text-[#16110b] border border-[#c9a84c] text-xs py-2 px-3 flex-1 justify-center rounded-lg font-bold flex items-center gap-2 transition-all hover:bg-[#e8d5a3]"
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

        {/* Loading State */}
        {isLoading && (
          <div className="glass-panel py-24 text-center text-[var(--color-gold)] animate-pulse flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-semibold tracking-wide mt-2">Loading Holy Quran verses...</p>
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
                  className={`bg-[var(--color-bg-dark)] border border-[var(--color-glass-border)] rounded-[14px] p-4 md:p-5 transition-all hover:border-[#4d3926] ${
                    isTranslationVisible ? "border-[#c9a84c]/20 bg-[#261c13]" : ""
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
                    <div className="font-arabic text-2xl md:text-3xl text-[#e8d5a3] text-right leading-[1.9] dir-rtl">
                      {verse.text_uthmani}
                    </div>

                    {/* Divider */}
                    <div className="h-[1px] bg-[#33261a] my-4"></div>

                    {/* Translation */}
                    {isTranslationVisible && (
                      <div className="text-sm md:text-base text-[#b39a7d] leading-[1.7] italic mb-3">
                        {verse.translation}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      id={`play-verse-btn-${verse.verse_number}`}
                      onClick={() => playVerseAudio(verse)}
                      className="bg-[#33261a] border border-[#33261a] rounded-md text-[var(--color-gold)] text-[11px] font-medium px-3 py-1.5 flex items-center gap-1.5 transition-all hover:border-[#4d3926] hover:text-[#6b9e72]"
                      aria-label="Play verse audio"
                    >
                      {isPlaying && playingType === "verse" && playingSurahId === selectedSurah && playingVerseNumber === verse.verse_number ? (
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
                      id={`share-verse-btn-${verse.verse_number}`}
                      onClick={() => shareVerse(verse)}
                      className="bg-[#33261a] border border-[#33261a] rounded-md text-[#8c6b4a] text-[11px] font-medium px-3 py-1.5 flex items-center gap-1.5 transition-all hover:border-[#4d3926] hover:text-[#6b9e72]"
                    >
                      <Share2 size={13} /> Share
                    </button>
                    <button
                      id={`copy-verse-btn-${verse.verse_number}`}
                      onClick={() => copyToClipboard(`${verse.text_uthmani}\n\n"${verse.translation}" - Quran ${selectedSurah}:${verse.verse_number}`)}
                      className="bg-[#33261a] border border-[#33261a] rounded-md text-[#8c6b4a] text-[11px] font-medium px-3 py-1.5 flex items-center gap-1.5 transition-all hover:border-[#4d3926] hover:text-[#6b9e72]"
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

      {/* Mobile Surah List Modal */}
      {isMobileListOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md lg:hidden">
          <div className="glass-panel w-full max-w-md max-h-[85vh] flex flex-col p-4 overflow-hidden animate-in fade-in zoom-in-95" style={{ background: 'var(--color-bg-dark)' }}>
            <div className="flex justify-between items-center pb-3 border-b border-[#33261a] mb-3">
              <h3 className="font-bold text-[var(--color-gold)] text-sm tracking-wide uppercase flex items-center gap-2">
                <BookOpen size={16} /> Browse All Surahs
              </h3>
              <button 
                onClick={() => setIsMobileListOpen(false)}
                className="text-[#8c6b4a] hover:text-[#f0e8d0] p-1 text-base font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-grow overflow-y-auto custom-scrollbar space-y-1 pr-1">
              {surahList.map((surah) => (
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
              ))}
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
    </article>
  );
};
