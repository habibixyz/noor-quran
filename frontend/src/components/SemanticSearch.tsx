import React, { useState, useEffect } from "react";
import { Search, Play, Pause, AlertCircle, Copy, Share2 } from "lucide-react";
import { useAudio } from "../context/AudioContext";
import { surahList, quranTexts, getSurahVerses } from "../data/quranData";

const cleanTranslationText = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/<sup[^>]*>.*?<\/sup>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

interface SearchResult {
  id: number;
  surah_id: number;
  verse_number: number;
  verse_key: string;
  text_uthmani: string;
  translation: string;
  surah_name: string;
  similarity?: number;
  audio_url?: string;
}

export const SemanticSearch: React.FC = () => {
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const { isPlaying, playingType, playingSurahId, playingVerseNumber, playVerse, selectedLanguage } = useAudio();

  const suggestedTopics = [
    { label: "Mercy & Compassion", query: "mercy and forgiveness of Allah" },
    { label: "Patience (Sabr)", query: "patience and steadfastness in times of trial" },
    { label: "Creation of Universe", query: "creation of the heavens and the earth" },
    { label: "Day of Judgment", query: "day of resurrection and judgment" },
    { label: "Light & Guidance", query: "light and path of righteousness guidance" },
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        handleSearch(query);
      } else {
        setResults([]);
        setError(null);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [query, selectedLanguage]);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setError(null);
    setQuery(searchQuery);

    const translationId = selectedLanguage.translationId;
    const langCode = selectedLanguage.code;


    try {
      const queryLower = searchQuery.toLowerCase();
      
      // 1. Search for Surah names in local surahList
      const surahNameMatches: SearchResult[] = [];
      surahList.forEach(surah => {
        const nameMatches = surah.name.includes(queryLower) || 
                            surah.englishName.toLowerCase().includes(queryLower) || 
                            (surah.altName && surah.altName.toLowerCase().includes(queryLower)) ||
                            surah.englishMeaning.toLowerCase().includes(queryLower);
        if (nameMatches) {
          // If it matches a Surah name, get its first verses
          const verses = getSurahVerses(surah.index);
          const versesToInclude = verses.slice(0, 3);
          
          versesToInclude.forEach(v => {
            surahNameMatches.push({
              id: surah.index * 1000 + v.verseNumber,
              surah_id: surah.index,
              verse_number: v.verseNumber,
              verse_key: `${surah.index}:${v.verseNumber}`,
              text_uthmani: v.arabic,
              translation: langCode === "en" ? v.english : "",
              surah_name: surah.englishName
            });
          });
        }
      });

      // 2. Fetch from standard API
      let apiResults: SearchResult[] = [];
      try {
        const res = await fetch(`https://api.quran.com/api/v4/search?q=${encodeURIComponent(searchQuery)}&size=20`);
        if (res.ok) {
          const data = await res.json();
          apiResults = (data.search?.results || []).map((v: any, idx: number) => {
            const verseKey = v.verse_key;
            const [sId, vId] = verseKey.split(":");
            const surahId = parseInt(sId);
            const verseNum = parseInt(vId);
            
            const surah = surahList.find(s => s.index === surahId);
            const surahName = surah ? surah.englishName : `Surah ${surahId}`;
            
            let translationText = "";
            if (v.translations && v.translations.length > 0) {
              const preferred = v.translations.find((t: any) => t.resource_id === translationId);
              translationText = preferred ? preferred.text : v.translations[0].text;
            }
            
            return {
              id: v.verse_id || idx,
              surah_id: surahId,
              verse_number: verseNum,
              verse_key: verseKey,
              text_uthmani: v.text,
              translation: cleanTranslationText(translationText),
              surah_name: surahName
            };
          });
        }
      } catch (e) {
        console.warn("Public Search API failed:", e);
      }
      
      // 3. If API returned nothing (or failed), fallback to local text search
      let localTextResults: SearchResult[] = [];
      if (apiResults.length === 0) {
        Object.entries(quranTexts).forEach(([surahIdx, verses]) => {
          const surahId = parseInt(surahIdx);
          const surah = surahList.find(s => s.index === surahId);
          const surahName = surah ? surah.englishName : `Surah ${surahId}`;
          
          verses.forEach((v) => {
            const matchesEnglish = langCode === "en" && v.english.toLowerCase().includes(queryLower);
            const matchesArabic = v.arabic.includes(queryLower);
            
            if (matchesEnglish || matchesArabic) {
              if (!surahNameMatches.find(m => m.surah_id === surahId && m.verse_number === v.verseNumber)) {
                localTextResults.push({
                  id: surahId * 1000 + v.verseNumber,
                  surah_id: surahId,
                  verse_number: v.verseNumber,
                  verse_key: `${surahId}:${v.verseNumber}`,
                  text_uthmani: v.arabic,
                  translation: langCode === "en" ? v.english : "",
                  surah_name: surahName
                });
              }
            }
          });
        });
      }
      
      // 4. Combine results
      const finalResults = [...surahNameMatches, ...apiResults, ...localTextResults];
      
      // Filter out duplicates by verse_key
      const uniqueResults = finalResults.filter((result, index, self) => 
        index === self.findIndex(r => r.verse_key === result.verse_key)
      );
      
      setResults(uniqueResults);
    } catch (err: any) {
      console.error("Search failed completely:", err);
      setError("An unexpected error occurred during search.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = (result: SearchResult) => {
    playVerse(result.surah_id, result.verse_number);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Verse copied to clipboard!");
  };

  const shareVerse = (result: SearchResult) => {
    if (navigator.share) {
      navigator.share({
        title: `Quran ${result.verse_key}`,
        text: `"${result.translation}" - Quran ${result.verse_key} (${result.surah_name})`,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(`"${result.translation}" - Quran ${result.verse_key}`);
      alert("Verse details copied for sharing!");
    }
  };

  return (
    <section className="flex flex-col gap-6 p-0 md:p-4" aria-label="Semantic Search">
      {/* Search Input Panel */}
      <div className="glass-panel p-6 flex flex-col gap-4 glowing-active">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
            <Search className="text-[var(--color-gold)]" size={22} />
            <span>Search the Holy Quran</span>
          </h2>
          <p className="text-xs md:text-sm text-[#b39a7d] mt-1">
            Search for verses by keywords, phrases, or topics. Powered by standard index-matching with offline fallback.
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2 bg-[#16110b] border border-[var(--color-glass-border)] rounded-xl p-1.5 focus-within:border-[var(--color-gold)] transition-all">
          <label htmlFor="semantic-search-input" className="sr-only">Search</label>
          <input
            id="semantic-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch(query);
              }
            }}
            placeholder="Type a word or phrase e.g., 'patience', 'charity', 'forgiveness'..."
            className="flex-grow min-w-0 bg-transparent px-3 py-2 text-sm text-[#f0e8d0] placeholder-[#8c6b4a] outline-none"
          />
          <button
            id="semantic-search-submit"
            onClick={() => handleSearch(query)}
            disabled={isLoading || !query.trim()}
            className="bg-[#33261a] hover:bg-[#4d3926] text-[var(--color-gold)] font-bold rounded-lg p-2.5 flex items-center justify-center transition-all disabled:opacity-50"
            aria-label="Submit Search"
          >
            <Search size={18} />
          </button>
        </div>

        {/* Suggested Topics */}
        <div className="flex flex-col gap-2 mt-2">
          <div className="text-[10px] font-bold tracking-widest text-[#8c6b4a] uppercase">
            Popular Topics
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedTopics.map((topic, idx) => (
              <button
                key={idx}
                id={`topic-btn-${idx}`}
                onClick={() => setQuery(topic.query)}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[#33261a] bg-[#1f1810] hover:bg-[#33261a] text-[#b39a7d] hover:text-[var(--color-gold)] transition-all"
              >
                {topic.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="glass-panel p-4 border-rose-500/20 bg-rose-950/20 text-rose-300 flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0 text-rose-400" />
          <div className="text-xs md:text-sm">{error}</div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="glass-panel p-12 text-center text-[var(--color-gold)] animate-pulse flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold tracking-wide mt-2">Searching verses...</p>
        </div>
      )}

      {/* Search Results */}
      {!isLoading && results.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="text-xs text-[#b39a7d] px-2 flex justify-between items-center">
            <span>Found <strong className="text-[var(--color-gold)]">{results.length}</strong> matches</span>
            <span className="text-[10px] uppercase tracking-wider text-[#8c6b4a]">Standard Search Index</span>
          </div>

          <div className="flex flex-col gap-4">
            {results.map((result) => (
              <div
                key={result.id}
                className="bg-[var(--color-bg-dark)] border border-[var(--color-glass-border)] rounded-[14px] p-5 hover:border-[#4d3926] transition-all"
              >
                {/* Result Top bar */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#8c6b4a] bg-[#33261a] rounded-md px-2.5 py-1 tracking-wide">
                      {result.surah_name} ({result.verse_key})
                    </span>
                  </div>
                  <button
                    id={`play-pause-btn-${result.id}`}
                    onClick={() => handlePlayPause(result)}
                    className="text-[var(--color-gold)] hover:text-white bg-[#33261a] hover:bg-[#4d3926] p-1.5 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                    aria-label="Play/Pause verse audio"
                  >
                    {isPlaying && playingType === "verse" && playingSurahId === result.surah_id && playingVerseNumber === result.verse_number ? (
                      <Pause size={14} className="animate-pulse" />
                    ) : (
                      <Play size={14} />
                    )}
                  </button>
                </div>

                {/* Arabic Text */}
                <div className="font-arabic text-2xl md:text-3xl text-[#e8d5a3] text-right leading-[1.9] dir-rtl mb-4">
                  {result.text_uthmani}
                </div>

                {/* Divider */}
                <div className="h-[1px] bg-[#33261a] my-3"></div>

                {/* Translation */}
                <div className="text-sm md:text-base text-[#b39a7d] leading-[1.7] italic mb-4">
                  {result.translation}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    id={`copy-btn-${result.id}`}
                    onClick={() => copyToClipboard(`${result.text_uthmani}\n\n"${result.translation}" - Quran ${result.verse_key}`)}
                    className="bg-[#33261a] border border-[#33261a] rounded-md text-[#8c6b4a] text-[11px] font-medium px-3 py-1.5 flex items-center gap-1.5 transition-all hover:border-[#4d3926] hover:text-[#6b9e72]"
                  >
                    <Copy size={13} /> Copy Verse
                  </button>
                  <button
                    id={`share-btn-${result.id}`}
                    onClick={() => shareVerse(result)}
                    className="bg-[#33261a] border border-[#33261a] rounded-md text-[#8c6b4a] text-[11px] font-medium px-3 py-1.5 flex items-center gap-1.5 transition-all hover:border-[#4d3926] hover:text-[#6b9e72]"
                  >
                    <Share2 size={13} /> Share
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && results.length === 0 && query && (
        <div className="glass-panel p-12 text-center text-[#8c6b4a]">
          <AlertCircle size={40} className="mx-auto mb-3 opacity-50 text-[var(--color-gold)]" />
          <p className="text-sm">No exact matches found for "{query}". Try searching other keywords or topics.</p>
        </div>
      )}


    </section>
  );
};
