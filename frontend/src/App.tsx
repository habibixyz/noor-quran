import { useState, useEffect } from "react";
import { QuranReader } from "./components/QuranReader";
import { SemanticSearch } from "./components/SemanticSearch";
import { UmrahCompanion } from "./components/UmrahCompanion";

import { BookOpen, Search, Heart, Compass, Share2 } from "lucide-react";
import { AudioProvider, useAudio } from "./context/AudioContext";
import { GlobalAudioPlayer } from "./components/GlobalAudioPlayer";
import { LegalModal } from "./components/LegalModal";

function App() {
  const [activeTab, setActiveTab] = useState<"reader" | "search" | "umrah">("reader");
  const { playingType } = useAudio();
  const audioIsActive = playingType !== null;

  // Visual Theme state & synchronization
  const [theme, setTheme] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("quran_theme") || "theme-amber-gold";
    }
    return "theme-amber-gold";
  });

  useEffect(() => {
    document.body.classList.remove(
      "theme-amber-gold",
      "theme-emerald-green",
      "theme-midnight-blue",
      "theme-warm-parchment"
    );
    document.body.classList.add(theme);
    localStorage.setItem("quran_theme", theme);
  }, [theme]);

  const [showShareMenu, setShowShareMenu] = useState<boolean>(false);
  const [legalModalType, setLegalModalType] = useState<"privacy" | "terms" | null>(null);

  // Dynamic SEO Update based on activeTab
  useEffect(() => {
    let title = "Noor Quran - Premium Reader & AI Semantic Search";
    let description = "Discover the Quran with Noor Quran Reader. Featuring an elegant distraction-free interactive reader, translation toggles, audio recitations, and AI-powered semantic search to explore verses by their inner concepts.";

    if (activeTab === "reader") {
      title = "Noor Quran - Premium Interactive Reader";
      description = "Read the Quran with our elegant distraction-free interactive reader. Features translation toggles and beautiful audio recitations.";
    } else if (activeTab === "search") {
      title = "Noor Quran - AI Semantic Search";
      description = "Explore the Quran using advanced AI-powered semantic search. Find verses by their underlying concepts, themes, and meanings.";
    } else if (activeTab === "umrah") {
      title = "Noor Quran - Premium Umrah & Hajj Companion";
      description = "Prepare for your sacred pilgrimage with our interactive Tawaf counters, Sunnah guides, check lists, and AI Umrah assistant.";
    }

    document.title = title;
    
    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", description);
    } else {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      metaDescription.setAttribute('content', description);
      document.head.appendChild(metaDescription);
    }
  }, [activeTab]);

  // Click outside to close share menu
  useEffect(() => {
    if (!showShareMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#share-app-btn-container")) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [showShareMenu]);

  const containerStyle = {
    background: 'var(--color-bg-deep)',
    width: '100vw',
    maxWidth: '100vw',
    height: '100dvh',
    maxHeight: '100dvh',
    overflow: 'hidden' as const,
  };

  return (
    <div className="h-dvh max-h-dvh flex flex-col justify-between relative overflow-hidden" style={containerStyle}>
      {/* Main Structural Wrapper Container - full width always */}
      <div className="w-full px-3 flex-grow flex flex-col gap-2 relative z-10 overflow-hidden h-full">
        {/* Main Header / Navigation */}
        <header className="glass-panel mt-2 md:mt-4 px-3 md:px-6 py-2.5 md:py-3 flex justify-between items-center sticky top-2 z-50 backdrop-blur-xl bg-[var(--color-bg-dark)]/90 relative">
          {/* Brand Logo */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-xl border-2 border-[var(--color-gold)] overflow-hidden shadow-md flex items-center justify-center shrink-0 bg-[var(--color-bg-deep)]">
              <img src="/logo.jpg" alt="Noor Quran Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xs sm:text-sm md:text-2xl font-bold tracking-tight text-white flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5">
                <span className="text-[var(--color-gold)] font-semibold leading-tight">Noor Quran</span>
              </h1>
            </div>
          </div>

          {/* Desktop Tab Selection — always hidden, bottom nav is used everywhere */}
          <nav className="hidden" aria-label="Main Navigation">
            <button
              id="nav-tab-reader"
              onClick={() => setActiveTab("reader")}
              className={`nav-tab ${activeTab === "reader" ? "active" : ""}`}
            >
              <BookOpen size={14} />
              <span>Interactive Reader</span>
            </button>
            <button
              id="nav-tab-search"
              onClick={() => setActiveTab("search")}
              className={`nav-tab ${activeTab === "search" ? "active" : ""}`}
            >
              <Search size={14} />
              <span>Search Quran</span>
            </button>
            <button
              id="nav-tab-umrah"
              onClick={() => setActiveTab("umrah")}
              className={`nav-tab ${activeTab === "umrah" ? "active" : ""}`}
            >
              <Compass size={14} />
              <span>Umrah Companion</span>
            </button>
          </nav>

          {/* Share App container with Dropdown */}
          <div className="flex items-center gap-2.5 ml-auto">
            <div id="share-app-btn-container" className="relative">
              <button
                id="share-app-btn"
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="flex items-center gap-1 px-2 py-1 md:px-2.5 md:py-1.5 rounded-xl bg-purple-600/20 border border-purple-500/50 text-purple-200 text-[10px] font-bold hover:bg-purple-600/40 transition-all cursor-pointer"
              >
                <Share2 size={11} />
                <span>Share</span>
              </button>
              {showShareMenu && (
                <div className="share-dropdown-menu">
                  <button
                    onClick={() => {
                      const twitterUrl = "https://twitter.com/intent/tweet?text=Read, listen and support the Holy Quran with Noor Quran! 📖🕌&url=https://quranonbase.vercel.app";
                      window.open(twitterUrl, "_blank", "noopener,noreferrer");
                      setShowShareMenu(false);
                    }}
                    className="share-dropdown-item"
                  >
                    <span>𝕏</span>
                    <span>Twitter / X</span>
                  </button>
                  <button
                    onClick={() => {
                      const whatsappUrl = "https://api.whatsapp.com/send?text=Read, listen and support the Holy Quran with Noor Quran! 📖🕌 - https://quranonbase.vercel.app";
                      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
                      setShowShareMenu(false);
                    }}
                    className="share-dropdown-item whatsapp"
                  >
                    <span>🟢</span>
                    <span>WhatsApp</span>
                  </button>
                  <button
                    onClick={() => {
                      const telegramUrl = "https://t.me/share/url?url=https://quranonbase.vercel.app&text=Read, listen and support the Holy Quran with Noor Quran! 📖🕌";
                      window.open(telegramUrl, "_blank", "noopener,noreferrer");
                      setShowShareMenu(false);
                    }}
                    className="share-dropdown-item telegram"
                  >
                    <span>✈️</span>
                    <span>Telegram</span>
                  </button>
                  {navigator.share && (
                    <button
                      onClick={async () => {
                        try {
                          await navigator.share({
                            title: "Noor Quran",
                            text: "Read, listen and support the Holy Quran with Noor Quran! 📖🕌",
                            url: "https://quranonbase.vercel.app",
                          });
                        } catch (err) {
                          console.error("Error sharing:", err);
                        }
                        setShowShareMenu(false);
                      }}
                      className="share-dropdown-item system-share"
                    >
                      <span>📤</span>
                      <span>System Share</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("https://quranonbase.vercel.app");
                      alert("Link copied to clipboard!");
                      setShowShareMenu(false);
                    }}
                    className="share-dropdown-item copy-link"
                  >
                    <span>📋</span>
                    <span>Copy Link</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Bottom Navigation Bar — always visible at all screen sizes */}
        <div 
          className="fixed bottom-0 left-0 right-0 z-50 glass-panel bg-[var(--color-bg-dark)]/95 backdrop-blur-xl"
          style={{ 
            position: 'fixed', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            zIndex: 50, 
            borderRadius: '16px 16px 0 0',
            paddingBottom: '4px'
          }}
        >
          <nav className="flex justify-around p-2" aria-label="Mobile Navigation">
            <button
              id="mobile-nav-reader"
              onClick={() => setActiveTab("reader")}
              className={`mobile-nav-btn ${activeTab === "reader" ? "active" : ""}`}
            >
              <BookOpen size={18} />
              <span className="text-xs font-bold">Reader</span>
            </button>
            <button
              id="mobile-nav-search"
              onClick={() => setActiveTab("search")}
              className={`mobile-nav-btn ${activeTab === "search" ? "active" : ""}`}
            >
              <Search size={18} />
              <span className="text-xs font-bold">Search</span>
            </button>
            <button
              id="mobile-nav-umrah"
              onClick={() => setActiveTab("umrah")}
              className={`mobile-nav-btn ${activeTab === "umrah" ? "active" : ""}`}
            >
              <Compass size={18} />
              <span className="text-xs font-bold">Umrah</span>
            </button>
          </nav>
        </div>

        {/* Main Content Render */}
        <main className="flex-grow overflow-y-auto custom-scrollbar px-1 py-2">
          <div style={{ paddingBottom: audioIsActive ? '220px' : '100px' }}>
            {activeTab === "reader" ? (
              <QuranReader theme={theme} setTheme={setTheme} />
            ) : activeTab === "search" ? (
              <SemanticSearch />
            ) : (
              <UmrahCompanion />
            )}

            <footer className="glass-panel p-4 mt-6 mb-4 flex flex-col gap-2 text-center">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-[#8c6b4a]">
                  <Heart size={11} className="text-rose-500 fill-rose-500 animate-pulse shrink-0" />
                  <span>Preserving Al-Quran · Premium Reader</span>
                </div>
                <span className="text-[10px] text-[#6b5436] font-semibold">Noor Quran Platform · Built with reverence</span>
              </div>
              <div className="h-[1px] bg-[#33261a]"></div>
              <p className="text-[10px] text-[#6b5436] leading-relaxed">
                All Quranic text is the sacred word of <strong className="text-[#8c6b4a]">Allah ﷻ</strong> and belongs to no one. This platform claims no ownership over the Holy Quran.
                Translations are displayed as authored by their respective scholars. Audio recitations are by their respective reciters, sourced from publicly available repositories.
                The Arabic text is the sole authoritative source.
              </p>
              <div className="flex items-center justify-center gap-4 mt-2">
                <button onClick={() => setLegalModalType("privacy")} className="text-[10px] text-[var(--color-gold)] hover:text-white transition-colors underline">Privacy Policy</button>
                <button onClick={() => setLegalModalType("terms")} className="text-[10px] text-[var(--color-gold)] hover:text-white transition-colors underline">Terms & Conditions</button>
              </div>
            </footer>
          </div>
        </main>
      </div>

      <GlobalAudioPlayer />
      <LegalModal 
        isOpen={legalModalType !== null} 
        onClose={() => setLegalModalType(null)} 
        type={legalModalType || "privacy"} 
      />
    </div>
  );
}

export default function AppWithProvider() {
  return (
    <AudioProvider>
      <App />
    </AudioProvider>
  );
}
