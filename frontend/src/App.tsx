import { useState, useEffect } from "react";
import { QuranReader } from "./components/QuranReader";
import { SemanticSearch } from "./components/SemanticSearch";
import { AboutAndDonate } from "./components/AboutAndDonate";
import { BookOpen, Search, Heart, Wallet, AlertCircle, ArrowRight } from "lucide-react";
import { ethers } from "ethers";
import { NETWORKS } from "./config";
import { AudioProvider, useAudio } from "./context/AudioContext";
import { GlobalAudioPlayer } from "./components/GlobalAudioPlayer";
import { BackgroundAnimation } from "./components/BackgroundAnimation";

function App() {
  const [activeTab, setActiveTab] = useState<"reader" | "search" | "about">("reader");
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const { playingType } = useAudio();
  const audioIsActive = playingType !== null;

  // Wallet state
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [account, setAccount] = useState<string>("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<string>("0.0");
  const [activeWalletName, setActiveWalletName] = useState<string>("");
  const [showWalletModal, setShowWalletModal] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Detect which wallets are installed
  const [availableWallets, setAvailableWallets] = useState({
    rabby: false,
    metaMask: false,
    coinbase: false,
    injected: false
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMobile(window.innerWidth < 768);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    checkAvailableWallets();
    setupProvider();

    // Listen for chain changes or account changes
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  const checkAvailableWallets = () => {
    if (typeof window === "undefined") return;

    const eth = window.ethereum;
    const rabby = !!window.rabby || (eth && eth.isRabby);
    const metaMask = eth && eth.isMetaMask && !eth.isRabby;
    const coinbase = !!window.coinbaseWalletExtension || (eth && eth.isCoinbaseWallet);
    const injected = !!eth;

    setAvailableWallets({
      rabby,
      metaMask,
      coinbase,
      injected
    });
  };

  const handleAccountsChanged = async (accounts: string[]) => {
    if (accounts.length === 0) {
      // Disconnected
      setAccount("");
      setSigner(null);
      setWalletBalance("0.0");
    } else {
      setAccount(accounts[0]);
      if (window.ethereum) {
        const tempProvider = new ethers.BrowserProvider(window.ethereum);
        setProvider(tempProvider);
        const tempSigner = await tempProvider.getSigner();
        setSigner(tempSigner);
        const balance = await tempProvider.getBalance(accounts[0]);
        setWalletBalance(parseFloat(ethers.formatEther(balance)).toFixed(4));
      }
    }
  };

  const handleChainChanged = (chainIdHex: string) => {
    const newChainId = parseInt(chainIdHex, 16);
    setChainId(newChainId);
    setupProvider();
  };

  const setupProvider = async () => {
    if (window.ethereum) {
      try {
        const tempProvider = new ethers.BrowserProvider(window.ethereum);
        setProvider(tempProvider);
        const network = await tempProvider.getNetwork();
        const currentChainId = Number(network.chainId);
        setChainId(currentChainId);

        const accounts = await tempProvider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0].address);
          const tempSigner = await tempProvider.getSigner();
          setSigner(tempSigner);
          const balance = await tempProvider.getBalance(accounts[0].address);
          setWalletBalance(parseFloat(ethers.formatEther(balance)).toFixed(4));
        }
      } catch (e) {
        console.warn("Ethereum provider initialization failed:", e);
      }
    }
  };

  const switchNetwork = async (targetChainId: number) => {
    if (!window.ethereum) return;
    const targetNetwork = targetChainId === 8453 ? NETWORKS.BASE_MAINNET : NETWORKS.BASE_SEPOLIA;
    
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetNetwork.chainIdHex }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: targetNetwork.chainIdHex,
                chainName: targetNetwork.name,
                rpcUrls: [targetNetwork.rpcUrl],
                nativeCurrency: {
                  name: "Ethereum",
                  symbol: "ETH",
                  decimals: 18,
                },
                blockExplorerUrls: [targetNetwork.blockExplorer],
              },
            ],
          });
        } catch (addError) {
          console.error("Failed to add network to wallet", addError);
        }
      }
    }
  };

  const connectWallet = async (walletType: "rabby" | "metamask" | "coinbase" | "browser") => {
    if (!window.ethereum) {
      setErrorMessage("No Web3 wallet detected. Please install Rabby or MetaMask.");
      return;
    }

    setIsConnecting(true);
    setErrorMessage("");

    try {
      let targetProvider = window.ethereum;

      if (window.ethereum.providers) {
        if (walletType === "rabby") {
          targetProvider = window.ethereum.providers.find((p: any) => p.isRabby) || window.ethereum;
        } else if (walletType === "metamask") {
          targetProvider = window.ethereum.providers.find((p: any) => p.isMetaMask && !p.isRabby) || window.ethereum;
        } else if (walletType === "coinbase") {
          targetProvider = window.ethereum.providers.find((p: any) => p.isCoinbaseWallet) || window.ethereum;
        }
      } else {
        if (walletType === "rabby" && window.rabby) {
          targetProvider = window.rabby;
        }
      }

      const tempProvider = new ethers.BrowserProvider(targetProvider);
      const accounts = await tempProvider.send("eth_requestAccounts", []);
      
      setProvider(tempProvider);
      
      const network = await tempProvider.getNetwork();
      const currentChain = Number(network.chainId);
      setChainId(currentChain);

      setAccount(accounts[0]);
      const tempSigner = await tempProvider.getSigner();
      setSigner(tempSigner);
      
      const balance = await tempProvider.getBalance(accounts[0]);
      setWalletBalance(parseFloat(ethers.formatEther(balance)).toFixed(4));
      
      let walletName = "Browser Wallet";
      if (walletType === "rabby") walletName = "Rabby Wallet";
      else if (walletType === "metamask") walletName = "MetaMask";
      else if (walletType === "coinbase") walletName = "Coinbase Wallet";
      setActiveWalletName(walletName);

      setShowWalletModal(false);

      if (currentChain !== 8453 && currentChain !== 84532) {
        await switchNetwork(8453);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to connect wallet.");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between pb-28 md:pb-4 relative" style={{ background: 'var(--color-bg-deep)' }}>
      <BackgroundAnimation />
      {/* Main Structural Wrapper Container */}
      <div className="max-w-7xl w-full mx-auto px-4 md:px-6 flex-grow flex flex-col gap-4 relative z-10">
        {/* Main Header / Navigation */}
        <header className="glass-panel mt-2 md:mt-4 px-3 md:px-6 py-2.5 md:py-3 flex justify-between items-center sticky top-2 z-40 backdrop-blur-xl bg-[var(--color-bg-dark)]/90">
          {/* Brand Logo */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="relative w-7 h-7 md:w-10 md:h-10 rounded-xl border-2 border-[var(--color-gold)] p-0.5 shadow-md flex items-center justify-center shrink-0">
              <div className="w-full h-full rounded-[8px] bg-[var(--color-bg-deep)] flex items-center justify-center font-arabic text-sm md:text-xl text-[var(--color-gold)] star-rotate">
                📖
              </div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm md:text-2xl font-bold tracking-tight text-white flex items-center gap-1">
                <span className="hidden sm:inline">Premium</span>
                <span className="text-[var(--color-gold)] font-semibold">Quran</span>
              </h1>
            </div>
          </div>

          {/* Desktop Tab Selection (Hidden on Mobile) */}
          {!isMobile && (
            <nav className="flex gap-1.5 p-1 bg-[#1c140c] rounded-xl border border-[var(--color-glass-border)] text-xs font-bold">
              <button
                onClick={() => setActiveTab("reader")}
                className={`nav-tab ${activeTab === "reader" ? "active" : ""}`}
              >
                <BookOpen size={14} />
                <span>Interactive Reader</span>
              </button>
              <button
                onClick={() => setActiveTab("search")}
                className={`nav-tab ${activeTab === "search" ? "active" : ""}`}
              >
                <Search size={14} />
                <span>Search Quran</span>
              </button>
              <button
                onClick={() => setActiveTab("about")}
                className={`nav-tab ${activeTab === "about" ? "active" : ""}`}
              >
                <Heart size={14} />
                <span>Sadaqah &amp; Zakat</span>
              </button>
            </nav>
          )}

          {/* Wallet connection status in Header */}
          <div className="flex items-center gap-2">
            {account ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-[var(--color-bg-deep)] border border-emerald-950 text-[10px] md:text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                <span className="font-mono font-bold text-[var(--color-gold-light)]">
                  {account.substring(0, 4)}...{account.substring(account.length - 4)}
                </span>
                <span className="hidden lg:inline text-[#8c6b4a]">({walletBalance} ETH)</span>
              </div>
            ) : (
              <button
                onClick={() => setShowWalletModal(true)}
                className="gold-button flex items-center gap-1 py-1 px-2.5 text-[10px] md:text-xs font-bold"
              >
                <Wallet size={12} />
                <span>Connect</span>
              </button>
            )}
          </div>
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
                className={`mobile-nav-btn ${activeTab === "reader" ? "active" : ""}`}
              >
                <BookOpen size={18} />
                <span className="text-xs font-bold">Reader</span>
              </button>
              <button
                onClick={() => setActiveTab("search")}
                className={`mobile-nav-btn ${activeTab === "search" ? "active" : ""}`}
              >
                <Search size={18} />
                <span className="text-xs font-bold">Search</span>
              </button>
              <button
                onClick={() => setActiveTab("about")}
                className={`mobile-nav-btn ${activeTab === "about" ? "active" : ""}`}
              >
                <Heart size={18} />
                <span className="text-xs font-bold">Charity</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content Render */}
        <main className="flex-grow py-2 md:py-4" style={{ paddingBottom: isMobile ? (audioIsActive ? "180px" : "80px") : undefined }}>
          {activeTab === "reader" ? (
            <QuranReader />
          ) : activeTab === "search" ? (
            <SemanticSearch />
          ) : (
            <AboutAndDonate
              provider={provider}
              signer={signer}
              account={account}
              chainId={chainId}
              walletBalance={walletBalance}
              activeWalletName={activeWalletName}
              switchNetwork={switchNetwork}
            />
          )}
        </main>

        {/* Elegant Footer - hidden on mobile to maximize scroll space */}
        {!isMobile && (
          <footer className="glass-panel mb-4 p-6 flex flex-col gap-3 text-xs text-[#8c6b4a]">
            <div className="flex flex-col md:flex-row justify-between items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Heart size={12} className="text-rose-500 fill-rose-500 animate-pulse shrink-0" />
                <span>Preserving Al-Quran On-chain on Base Network</span>
              </div>
              <span className="text-[10px] text-[#6b5436]">Noor Quran Platform · Built with reverence</span>
            </div>
            <div className="h-[1px] bg-[#33261a]"></div>
            <div className="text-[10px] text-[#6b5436] leading-relaxed text-center">
              All Quranic text is the word of Allah ﷻ and belongs to no one. Translations are by their respective scholars.
              Audio recitations are provided by their respective reciters. This platform is a digital reader tool only.
            </div>
          </footer>
        )}
      </div>

      <GlobalAudioPlayer />

      {/* GLOBAL WALLET SELECTION MODAL */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 bg-[#010905]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md font-bold text-white">Connect Web3 Wallet</h3>
              <button
                onClick={() => setShowWalletModal(false)}
                className="text-[#8c6b4a] hover:text-white font-bold p-1 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#8c6b4a] mb-5">
              Select your wallet of choice to authenticate on the Base Network. We highly recommend Rabby Wallet for the best experience.
            </p>

            <div className="space-y-2.5">
              {/* Rabby Wallet Option */}
              <button
                onClick={() => connectWallet("rabby")}
                disabled={isConnecting}
                className="w-full p-3 rounded-xl border border-[var(--color-glass-border)] bg-[#1f1810] hover:border-[var(--color-gold)] flex items-center justify-between text-left transition-all group disabled:opacity-50 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-900/30 text-indigo-300 font-extrabold flex items-center justify-center text-sm border border-indigo-500/20">
                    R
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-[var(--color-gold)] transition-colors">
                      Rabby Wallet
                    </div>
                    <div className="text-[10px] text-[#8c6b4a]">
                      {availableWallets.rabby ? "Installed & Detected" : "Web3 Extension"}
                    </div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-[#8c6b4a] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* MetaMask Option */}
              <button
                onClick={() => connectWallet("metamask")}
                disabled={isConnecting}
                className="w-full p-3 rounded-xl border border-[var(--color-glass-border)] bg-[#1f1810] hover:border-[var(--color-gold)] flex items-center justify-between text-left transition-all group disabled:opacity-50 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-950/30 text-orange-400 font-extrabold flex items-center justify-center text-xs border border-orange-500/20">
                    MM
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-[var(--color-gold)] transition-colors">
                      MetaMask
                    </div>
                    <div className="text-[10px] text-[#8c6b4a]">
                      {availableWallets.metaMask ? "Installed & Detected" : "Browser Wallet"}
                    </div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-[#8c6b4a] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Coinbase Wallet Option */}
              <button
                onClick={() => connectWallet("coinbase")}
                disabled={isConnecting}
                className="w-full p-3 rounded-xl border border-[var(--color-glass-border)] bg-[#1f1810] hover:border-[var(--color-gold)] flex items-center justify-between text-left transition-all group disabled:opacity-50 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-950/30 text-blue-400 font-extrabold flex items-center justify-center text-xs border border-blue-500/20">
                    CB
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-[var(--color-gold)] transition-colors">
                      Coinbase Wallet
                    </div>
                    <div className="text-[10px] text-[#8c6b4a]">
                      {availableWallets.coinbase ? "Installed & Detected" : "Smart Wallet Option"}
                    </div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-[#8c6b4a] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Standard Injected Wallet */}
              {!availableWallets.rabby && !availableWallets.metaMask && !availableWallets.coinbase && (
                <button
                  onClick={() => connectWallet("browser")}
                  disabled={isConnecting || !availableWallets.injected}
                  className="w-full p-3 rounded-xl border border-[var(--color-glass-border)] bg-[#1f1810] hover:border-[var(--color-gold)] flex items-center justify-between text-left transition-all group disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-950/30 text-emerald-400 font-extrabold flex items-center justify-center text-xs border border-emerald-500/20">
                      W3
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Default Browser Wallet</div>
                      <div className="text-[10px] text-[#8c6b4a]">
                        {availableWallets.injected ? "Web3 Provider Detected" : "No Wallet Extension Detected"}
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-[#8c6b4a]" />
                </button>
              )}
            </div>
            
            {errorMessage && (
              <div className="mt-4 p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-[10px] text-rose-300 flex items-center gap-1.5">
                <AlertCircle size={12} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        </div>
      )}
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
