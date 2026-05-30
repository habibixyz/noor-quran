import { useState, useEffect } from "react";
import { QuranReader } from "./components/QuranReader";
import { SemanticSearch } from "./components/SemanticSearch";
import { AboutAndDonate } from "./components/AboutAndDonate";
import { UmrahCompanion } from "./components/UmrahCompanion";
import { BookOpen, Search, Heart, Wallet, AlertCircle, ArrowRight, Compass } from "lucide-react";
import { ethers } from "ethers";
import { NETWORKS } from "./config";
import { AudioProvider, useAudio } from "./context/AudioContext";
import { GlobalAudioPlayer } from "./components/GlobalAudioPlayer";
import { sdk } from "@farcaster/frame-sdk";

function App() {
  const [activeTab, setActiveTab] = useState<"reader" | "search" | "umrah" | "about">("reader");
  const { playingType } = useAudio();
  const audioIsActive = playingType !== null;

  // Farcaster State
  const [isMiniApp, setIsMiniApp] = useState<boolean>(false);
  const [safeAreaInsets, setSafeAreaInsets] = useState<any>(null);
  const [isAppAdded, setIsAppAdded] = useState<boolean>(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState<boolean>(false);

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
    } else if (activeTab === "about") {
      title = "Noor Quran - Sadaqah & Zakat";
      description = "Support the preservation of Al-Quran on-chain. Contribute via Sadaqah & Zakat on the Base Network.";
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

  // ─── EFFECT 1: Dismiss Farcaster splash immediately on mount ───────────────
  // This MUST be the first useEffect so it fires before any async operations.
  // The Farcaster SDK communicates via postMessage after the document loads;
  // calling ready() here (after first render) is the correct pattern.
  useEffect(() => {
    sdk.actions.ready().catch(() => {
      // Not in a Farcaster context — safe to ignore
    });
  }, []);



  // ─── EFFECT 3: Farcaster context + wallet init ───────────────────────────────
  useEffect(() => {
    checkAvailableWallets();

    const initFarcaster = async () => {
      try {
        const inMiniApp = await sdk.isInMiniApp();
        setIsMiniApp(inMiniApp);
        
        if (inMiniApp) {
          // ready() was already fired in Effect 1 above, but call again here
          // as a safety net in case the first call resolved before Warpcast
          // was listening (race condition on slow devices).
          sdk.actions.ready().catch(() => {});

          const context = await sdk.context;
          if (context) {
            // user pfp display removed — not storing user object
            if (context.client?.safeAreaInsets) {
              setSafeAreaInsets(context.client.safeAreaInsets);
            }
            // Track whether the user has already added this mini app
            const alreadyAdded = context.client?.added ?? false;
            setIsAppAdded(alreadyAdded);
            if (!alreadyAdded) {
              // Show welcome banner to prompt them to add the app
              setShowWelcomeBanner(true);
            }
          }
          
          // Automatically connect the Farcaster wallet provider
          if (sdk.wallet?.ethProvider) {
            try {
              const tempProvider = new ethers.BrowserProvider(sdk.wallet.ethProvider as any);
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
              setActiveWalletName("Farcaster Wallet");
            } catch (err) {
              console.warn("Farcaster wallet provider setup failed, falling back:", err);
              setupProvider();
            }
          } else {
            setupProvider();
          }
        } else {
          setupProvider();
        }
      } catch (err) {
        console.warn("Farcaster SDK initialization failed:", err);
        setupProvider();
      }
    };

    initFarcaster();

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

  const containerStyle = {
    background: 'var(--color-bg-deep)',
    // Force full viewport width — prevents partial-column layout in Farcaster frame
    width: '100vw',
    maxWidth: '100vw',
    height: '100dvh',
    maxHeight: '100dvh',
    overflow: 'hidden' as const,
    paddingTop: safeAreaInsets ? `${safeAreaInsets.top}px` : undefined,
    paddingBottom: safeAreaInsets ? `${safeAreaInsets.bottom}px` : undefined,
    paddingLeft: safeAreaInsets ? `${safeAreaInsets.left}px` : undefined,
    paddingRight: safeAreaInsets ? `${safeAreaInsets.right}px` : undefined,
  };

  return (
    <div className="h-dvh max-h-dvh flex flex-col justify-between relative overflow-hidden" style={containerStyle}>
      {/* Main Structural Wrapper Container - full width always */}
      <div className="w-full px-3 flex-grow flex flex-col gap-2 relative z-10 overflow-hidden h-full">
        {/* Main Header / Navigation */}
        <header className="glass-panel mt-2 md:mt-4 px-3 md:px-6 py-2.5 md:py-3 flex justify-between items-center sticky top-2 z-40 backdrop-blur-xl bg-[var(--color-bg-dark)]/90 relative">
          {/* Brand Logo */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="relative w-7 h-7 md:w-10 md:h-10 rounded-xl border-2 border-[var(--color-gold)] p-0.5 shadow-md flex items-center justify-center shrink-0">
              <div className="w-full h-full rounded-[8px] bg-[var(--color-bg-deep)] flex items-center justify-center font-arabic text-sm md:text-xl text-[var(--color-gold)] star-rotate">
                📖
              </div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm md:text-2xl font-bold tracking-tight text-white flex items-center gap-1.5">
                <span className="hidden sm:inline">Premium</span>
                <span className="text-[var(--color-gold)] font-semibold">Quran</span>
                {isMiniApp && (
                  <span className="text-[9px] font-sans font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                    Farcaster
                  </span>
                )}
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
            <button
              id="nav-tab-about"
              onClick={() => setActiveTab("about")}
              className={`nav-tab ${activeTab === "about" ? "active" : ""}`}
            >
              <Heart size={14} />
              <span>Sadaqah &amp; Zakat</span>
            </button>
          </nav>

          {/* Wallet and Farcaster User Info in Header */}
          <div className="flex items-center gap-2.5 ml-auto">
            {/* Farcaster user pfp intentionally removed */}

            {/* Add to Farcaster button — only when inside Warpcast and not yet added */}
            {isMiniApp && !isAppAdded && (
              <button
                id="add-to-farcaster-btn"
                onClick={async () => {
                  try {
                    await sdk.actions.addMiniApp();
                    setIsAppAdded(true);
                    setShowWelcomeBanner(false);
                  } catch {/* user dismissed */}
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-600/20 border border-purple-500/50 text-purple-200 text-[10px] font-bold hover:bg-purple-600/40 transition-all"
              >
                <span>⊕</span>
                <span className="hidden sm:inline">Add App</span>
              </button>
            )}

            {activeTab === "about" && (
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
                    id="header-connect-wallet-btn"
                    onClick={() => setShowWalletModal(true)}
                    className="gold-button flex items-center gap-1 py-1 px-2.5 text-[10px] md:text-xs font-bold"
                  >
                    <Wallet size={12} />
                    <span>Connect</span>
                  </button>
                )}
              </div>
            )}
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
            paddingBottom: safeAreaInsets ? `${safeAreaInsets.bottom}px` : '4px'
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
            <button
              id="mobile-nav-about"
              onClick={() => setActiveTab("about")}
              className={`mobile-nav-btn ${activeTab === "about" ? "active" : ""}`}
            >
              <Heart size={18} />
              <span className="text-xs font-bold">Charity</span>
            </button>
          </nav>
        </div>

        {/* Main Content Render */}
        <main className="flex-grow overflow-y-auto custom-scrollbar px-1 py-2">
          <div style={{ paddingBottom: audioIsActive ? '220px' : '100px' }}>

            {/* Farcaster Welcome Banner — shown on first load inside Warpcast */}
            {showWelcomeBanner && isMiniApp && (
              <div
                id="farcaster-welcome-banner"
                className="relative mb-4 rounded-2xl overflow-hidden border border-purple-500/30"
                style={{
                  background: 'linear-gradient(135deg, #1a0a2e 0%, #16110b 60%, #1a0a2e 100%)',
                }}
              >
                {/* Decorative glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-16 bg-purple-600/20 blur-2xl rounded-full" />
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 md:p-5">
                  <div className="text-4xl shrink-0">🕌</div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                      Welcome to Noor Quran
                      <span className="text-[10px] font-semibold bg-purple-500/25 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded-md tracking-wider">FARCASTER MINI APP</span>
                    </h2>
                    <p className="text-xs text-purple-200/80 mt-1 leading-relaxed">
                      Read, listen &amp; cast Quranic verses directly inside Warpcast. Add this app to keep it in your launcher.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      id="banner-add-app-btn"
                      onClick={async () => {
                        try {
                          await sdk.actions.addMiniApp();
                          setIsAppAdded(true);
                          setShowWelcomeBanner(false);
                        } catch {/* dismissed */}
                      }}
                      className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shrink-0"
                    >
                      <span>⊕</span> Add to Farcaster
                    </button>
                    <button
                      id="banner-dismiss-btn"
                      onClick={() => setShowWelcomeBanner(false)}
                      className="p-1.5 rounded-lg text-purple-300/60 hover:text-purple-200 transition-colors"
                      aria-label="Dismiss banner"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "reader" ? (
              <QuranReader />
            ) : activeTab === "search" ? (
              <SemanticSearch />
            ) : activeTab === "umrah" ? (
              <UmrahCompanion />
            ) : (
              <>
                <AboutAndDonate
                  provider={provider}
                  signer={signer}
                  account={account}
                  chainId={chainId}
                  walletBalance={walletBalance}
                  activeWalletName={activeWalletName}
                  switchNetwork={switchNetwork}
                />
                <footer className="glass-panel p-4 mt-6 mb-4 flex flex-col gap-2 text-center">
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#8c6b4a]">
                      <Heart size={11} className="text-rose-500 fill-rose-500 animate-pulse shrink-0" />
                      <span>Preserving Al-Quran On-chain · Base Network</span>
                    </div>
                    <span className="text-[10px] text-[#6b5436] font-semibold">Noor Quran Platform · Built with reverence</span>
                  </div>
                  <div className="h-[1px] bg-[#33261a]"></div>
                  <p className="text-[10px] text-[#6b5436] leading-relaxed">
                    All Quranic text is the sacred word of <strong className="text-[#8c6b4a]">Allah ﷻ</strong> and belongs to no one. This platform claims no ownership over the Holy Quran.
                    Translations are displayed as authored by their respective scholars. Audio recitations are by their respective reciters, sourced from publicly available repositories.
                    The Arabic text is the sole authoritative source.
                  </p>
                </footer>
              </>
            )}
          </div>
        </main>
      </div>

      <GlobalAudioPlayer />

      {/* GLOBAL WALLET SELECTION MODAL */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 bg-[#010905]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md font-bold text-white">Connect Web3 Wallet</h3>
              <button
                id="close-wallet-modal-btn"
                onClick={() => setShowWalletModal(false)}
                className="text-[#8c6b4a] hover:text-white font-bold p-1 text-sm cursor-pointer"
                aria-label="Close wallet modal"
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
                id="wallet-option-rabby"
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
                id="wallet-option-metamask"
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
                id="wallet-option-coinbase"
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
                  id="wallet-option-browser"
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
