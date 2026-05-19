import React, { useState, useRef } from "react";
import { Search, Play, Pause, AlertCircle, Sparkles, Copy, Share2 } from "lucide-react";

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
  
  // Audio state
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const suggestedTopics = [
    { label: "Mercy & Compassion", query: "mercy and forgiveness of Allah" },
    { label: "Patience (Sabr)", query: "patience and steadfastness in times of trial" },
    { label: "Creation of Universe", query: "creation of the heavens and the earth" },
    { label: "Day of Judgment", query: "day of resurrection and judgment" },
    { label: "Light & Guidance", query: "light and path of righteousness guidance" },
  ];

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setError(null);
    setQuery(searchQuery);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) {
        throw new Error("Failed to perform search. Please check your backend.");
      }
      const data = await res.json();
      setResults(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during search.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = (result: SearchResult) => {
    if (!result.audio_url && !result.verse_key) return;

    // Use official Quran.com audio CDN if backend did not supply it
    const url = result.audio_url || (() => {
      const [sId, vId] = result.verse_key.split(":");
      const paddedSurah = String(sId).padStart(3, "0");
      const paddedVerse = String(vId).padStart(3, "0");
      return `https://everyayah.com/data/Alafasy_128kbps/${paddedSurah}${paddedVerse}.mp3`;
    })();

    if (playingId === result.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load(); // Force pre-buffering on mobile
        audioRef.current.play().then(() => {
          setPlayingId(result.id);
        }).catch((err) => {
          console.error("Audio playback error:", err);
        });
      }
    }
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
    <div className="flex flex-col gap-6 p-1 md:p-4">
      {/* Search Input Panel */}
      <div className="glass-panel p-6 flex flex-col gap-4 glowing-active">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
            <Sparkles className="text-[var(--color-gold)]" size={22} />
            <span>AI Semantic Search</span>
          </h2>
          <p className="text-xs md:text-sm text-[#8ab69d] mt-1">
            Search for verses by their inner meaning, concepts, or topics in plain English. Powered by nomic-embed-text & pgvector.
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2 bg-[#0a1f0f] border border-[var(--color-glass-border)] rounded-xl p-1.5 focus-within:border-[var(--color-gold)] transition-all">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
            placeholder="Type a concept e.g., 'What does the Quran say about patience in times of trial?'"
            className="flex-grow bg-transparent px-3 py-2 text-sm text-[#f0e8d0] placeholder-[#4a7c52] outline-none"
          />
          <button
            onClick={() => handleSearch(query)}
            disabled={isLoading || !query.trim()}
            className="bg-[#1a3d1f] hover:bg-[#2a5a30] text-[var(--color-gold)] font-bold rounded-lg p-2.5 flex items-center justify-center transition-all disabled:opacity-50"
          >
            <Search size={18} />
          </button>
        </div>

        {/* Suggested Topics */}
        <div className="flex flex-col gap-2 mt-2">
          <div className="text-[10px] font-bold tracking-widest text-[#4a7c52] uppercase">
            Popular Topics
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedTopics.map((topic, idx) => (
              <button
                key={idx}
                onClick={() => handleSearch(topic.query)}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[#1a3d1f] bg-[#0d2512] hover:bg-[#1a3d1f] text-[#8aab8e] hover:text-[var(--color-gold)] transition-all"
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
          <p className="text-sm font-semibold tracking-wide mt-2">Running vector cosine similarity search...</p>
        </div>
      )}

      {/* Search Results */}
      {!isLoading && results.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="text-xs text-[#8ab69d] px-2 flex justify-between items-center">
            <span>Found <strong className="text-[var(--color-gold)]">{results.length}</strong> semantic matches</span>
            <span className="text-[10px] uppercase tracking-wider text-[#4a7c52]">Ranked by Cosine Similarity</span>
          </div>

          <div className="flex flex-col gap-4">
            {results.map((result) => (
              <div
                key={result.id}
                className="bg-[var(--color-bg-dark)] border border-[var(--color-glass-border)] rounded-[14px] p-5 hover:border-[#2a5a30] transition-all"
              >
                {/* Result Top bar */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#4a7c52] bg-[#1a3d1f] rounded-md px-2.5 py-1 tracking-wide">
                      {result.surah_name} ({result.verse_key})
                    </span>
                    {result.similarity !== undefined && (
                      <span className="text-[10px] font-bold text-[#6abf71] bg-[#1a3d1f]/50 border border-[#2a5a30]/30 rounded-md px-2 py-0.5">
                        {Math.round(result.similarity * 100)}% Match
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handlePlayPause(result)}
                    className="text-[var(--color-gold)] hover:text-white bg-[#1a3d1f] hover:bg-[#2a5a30] p-1.5 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                  >
                    {playingId === result.id ? <Pause size={14} className="animate-pulse" /> : <Play size={14} />}
                  </button>
                </div>

                {/* Arabic Text */}
                <div className="font-arabic text-2xl md:text-3xl text-[#e8d5a3] text-right leading-[1.9] dir-rtl mb-4">
                  {result.text_uthmani}
                </div>

                {/* Divider */}
                <div className="h-[1px] bg-[#1a3d1f] my-3"></div>

                {/* Translation */}
                <div className="text-sm md:text-base text-[#8aab8e] leading-[1.7] italic mb-4">
                  {result.translation}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(`${result.text_uthmani}\n\n"${result.translation}" - Quran ${result.verse_key}`)}
                    className="bg-[#1a3d1f] border border-[#1a3d1f] rounded-md text-[#4a7c52] text-[11px] font-medium px-3 py-1.5 flex items-center gap-1.5 transition-all hover:border-[#2a5a30] hover:text-[#6b9e72]"
                  >
                    <Copy size={13} /> Copy Verse
                  </button>
                  <button
                    onClick={() => shareVerse(result)}
                    className="bg-[#1a3d1f] border border-[#1a3d1f] rounded-md text-[#4a7c52] text-[11px] font-medium px-3 py-1.5 flex items-center gap-1.5 transition-all hover:border-[#2a5a30] hover:text-[#6b9e72]"
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
        <div className="glass-panel p-12 text-center text-[#4a7c52]">
          <AlertCircle size={40} className="mx-auto mb-3 opacity-50 text-[var(--color-gold)]" />
          <p className="text-sm">No exact matches found for "{query}". Try searching other keywords or topics.</p>
        </div>
      )}

      <audio
        ref={audioRef}
        onEnded={() => setPlayingId(null)}
        className="hidden"
      />
    </div>
  );
};
