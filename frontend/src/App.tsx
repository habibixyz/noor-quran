import { useState, useEffect } from "react";
import { QuranReader } from "./components/QuranReader";
import { SemanticSearch } from "./components/SemanticSearch";
import { BookOpen, Search, Heart } from "lucide-react";

function App() {
  const [activeTab, setActiveTab] = useState<"reader" | "search">("reader");
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);

  useState(() => {
    if (typeof window !== "undefined") {
      setIsMobile(window.innerWidth < 768);
    }
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="min-h-screen flex flex-col justify-between pb-20 md:pb-0" style={{ background: 'var(--color-bg-deep)' }}>


      {/* Main Structural Wrapper Container */}
      <div className="max-w-7xl w-full mx-auto px-2 md:px-4 flex-grow flex flex-col gap-4">
        {/* Main Header / Navigation */}
        <header className="glass-panel mt-2 md:mt-4 px-4 md:px-6 py-3 flex justify-between items-center sticky top-2 z-40 backdrop-blur-xl bg-[var(--color-bg-dark)]/90">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-xl border-2 border-[var(--color-gold)] p-0.5 shadow-md flex items-center justify-center shrink-0">
              <div className="w-full h-full rounded-[8px] bg-[var(--color-bg-deep)] flex items-center justify-center font-arabic text-lg md:text-xl text-[var(--color-gold)] star-rotate">
                📖
              </div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg md:text-2xl font-bold tracking-tight text-white flex items-center gap-1.5">
                <span>Premium</span>
                <span className="text-[var(--color-gold)] font-semibold">Quran</span>
              </h1>
            </div>
          </div>

          {/* Desktop Tab Selection (Hidden on Mobile) */}
          {!isMobile && (
            <nav className="flex gap-1.5 p-1 bg-[#1a3d1f]/50 rounded-xl border border-[var(--color-glass-border)] text-xs font-bold">
              <button
                onClick={() => setActiveTab("reader")}
                className={`px-5 py-2.5 rounded-lg transition-all flex items-center gap-2 ${
                  activeTab === "reader"
                    ? "bg-[var(--color-bg-dark)] text-[var(--color-gold)] shadow-md border border-[var(--color-gold)]/30"
                    : "text-[#4a7c52] hover:text-[#f0e8d0]"
                }`}
              >
                <BookOpen size={16} />
                <span>Interactive Reader</span>
              </button>
              <button
                onClick={() => setActiveTab("search")}
                className={`px-5 py-2.5 rounded-lg transition-all flex items-center gap-2 ${
                  activeTab === "search"
                    ? "bg-[var(--color-bg-dark)] text-[var(--color-gold)] shadow-md border border-[var(--color-gold)]/30"
                    : "text-[#4a7c52] hover:text-[#f0e8d0]"
                }`}
              >
                <Search size={16} />
                <span>Semantic Search</span>
              </button>
            </nav>
          )}
        </header>

        {/* Mobile Bottom Navigation Bar */}
        {isMobile && (
          <div 
            className="fixed bottom-0 left-0 right-0 z-50 glass-panel bg-[var(--color-bg-dark)]/95 backdrop-blur-xl pb-safe"
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, borderRadius: '16px 16px 0 0' }}
          >
            <div className="flex justify-around p-2">
              <button
                onClick={() => setActiveTab("reader")}
                className={`flex flex-col items-center gap-1 p-2 flex-1 rounded-xl transition-all ${
                  activeTab === "reader" ? "text-[var(--color-gold)] bg-[#1a3d1f]" : "text-[#4a7c52]"
                }`}
              >
                <BookOpen size={20} />
                <span className="text-[10px] font-bold">Reader</span>
              </button>
              <button
                onClick={() => setActiveTab("search")}
                className={`flex flex-col items-center gap-1 p-2 flex-1 rounded-xl transition-all ${
                  activeTab === "search" ? "text-[var(--color-gold)] bg-[#1a3d1f]" : "text-[#4a7c52]"
                }`}
              >
                <Search size={20} />
                <span className="text-[10px] font-bold">Search</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content Render */}
        <main className="flex-grow py-4">
          {activeTab === "reader" ? (
            <QuranReader />
          ) : (
            <SemanticSearch />
          )}
        </main>

        {/* Elegant Footer */}
        <footer className="glass-panel mb-4 p-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[#4a7c52]">
          <div className="flex items-center gap-1.5">
            <span>© 2026 Noor Quran Reader</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Heart size={12} className="text-rose-500 fill-rose-500" />
              <span>Built with Python & Next.js</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
