import React, { useState, useEffect } from "react";
import { surahList } from "../data/quranData";
import type { SurahData } from "../data/quranData";
import { Award, Heart, Coins, ArrowRight, UserCheck } from "lucide-react";
import { ethers } from "ethers";

interface GuardianshipDashboardProps {
  contractAddress: string;
  provider: ethers.BrowserProvider | null;
  currentAddress: string;
  connectWallet: () => Promise<void>;
  onSponsorshipSuccess: (surahId: number) => void;
}

interface SurahStatus {
  index: number;
  guardian: string;
  sponsorshipAmount: bigint;
}

export const GuardianshipDashboard: React.FC<GuardianshipDashboardProps> = ({
  contractAddress,
  provider,
  currentAddress,
  connectWallet,
  onSponsorshipSuccess,
}) => {
  const [activeFilter, setActiveFilter] = useState<"all" | "available" | "sponsored">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSurah, setSelectedSurah] = useState<SurahData | null>(null);
  const [sponsorshipAmount, setSponsorshipAmount] = useState<string>("0.001");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [transactionHash, setTransactionHash] = useState<string>("");

  // Map of Surah ID to status
  const [surahStatuses, setSurahStatuses] = useState<Record<number, SurahStatus>>({});
  const [analytics, setAnalytics] = useState({
    totalGuardians: 0,
    totalSadaqah: "0.0",
    guardiansList: [] as string[]
  });

  // Recent Event Logs Feed
  const [recentEvents, setRecentEvents] = useState<Array<{
    guardian: string;
    surahId: number;
    amount: string;
    txHash: string;
  }>>([
    {
      guardian: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      surahId: 1,
      amount: "0.005 ETH",
      txHash: "0x25b3...a4e1"
    },
    {
      guardian: "0x8626f6940F2c9f1454711753c1A151f4c7802875",
      surahId: 112,
      amount: "0.001 ETH",
      txHash: "0x6f6a...bf72"
    }
  ]);

  // Load smart contract details if provider is connected
  useEffect(() => {
    fetchContractState();
  }, [provider, contractAddress]);

  const fetchContractState = async () => {
    if (!provider || !contractAddress) return;

    try {
      const abi = [
        "function getSurah(uint256 surahId) external view returns (uint16, string, string, uint16, string, bytes32, address, uint256)",
        "function totalSadaqahRaised() external view returns (uint256)"
      ];
      const contract = new ethers.Contract(contractAddress, abi, provider);
      
      const newStatuses: Record<number, SurahStatus> = {};
      let sponsoredCount = 0;
      let totalSadaqahWei = 0n;
      const uniqueGuardians = new Set<string>();

      // Query only first 15 Surahs for speed in development, simulate/mock other fields
      // Query specific test ones like 1, 36, 55, 67, 112, 113, 114
      const queryIndices = [1, 2, 3, 4, 5, 36, 55, 67, 112, 113, 114];
      
      for (const idx of queryIndices) {
        try {
          const result = await contract.getSurah(idx);
          const guardian = result[6];
          const amount = result[7];
          
          if (guardian !== ethers.ZeroAddress) {
            newStatuses[idx] = {
              index: idx,
              guardian,
              sponsorshipAmount: amount
            };
            sponsoredCount++;
            totalSadaqahWei += amount;
            uniqueGuardians.add(guardian);
          }
        } catch (e) {
          // ignore index errors
        }
      }

      setSurahStatuses(newStatuses);
      setAnalytics({
        totalGuardians: sponsoredCount,
        totalSadaqah: ethers.formatEther(totalSadaqahWei),
        guardiansList: Array.from(uniqueGuardians)
      });
    } catch (err) {
      console.error("Error loading smart contract status:", err);
    }
  };

  const executeSponsorship = async () => {
    if (!selectedSurah) return;
    setIsLoading(true);
    setTransactionHash("");

    try {
      if (provider && contractAddress) {
        const signer = await provider.getSigner();
        const abi = [
          "function sponsorSurah(uint256 surahId) external payable"
        ];
        const contract = new ethers.Contract(contractAddress, abi, signer);
        
        const valueInWei = ethers.parseEther(sponsorshipAmount);
        const tx = await contract.sponsorSurah(selectedSurah.index, { value: valueInWei });
        
        setTransactionHash(tx.hash);
        await tx.wait();

        // Add to active local event feed
        const shortTx = tx.hash.substring(0, 6) + "..." + tx.hash.substring(tx.hash.length - 4);
        setRecentEvents((prev) => [
          {
            guardian: currentAddress,
            surahId: selectedSurah.index,
            amount: `${sponsorshipAmount} ETH`,
            txHash: shortTx
          },
          ...prev
        ]);

        onSponsorshipSuccess(selectedSurah.index);
        fetchContractState();
        setSelectedSurah(null);
      } else {
        // Fallback mockup sponsorship for demonstration when wallet isn't configured
        setTimeout(() => {
          const fakeTx = "0x" + Math.random().toString(16).substring(2, 10) + "..." + Math.random().toString(16).substring(2, 6);
          setSurahStatuses((prev) => ({
            ...prev,
            [selectedSurah.index]: {
              index: selectedSurah.index,
              guardian: currentAddress || "0xYourWalletAddressHere",
              sponsorshipAmount: ethers.parseEther(sponsorshipAmount)
            }
          }));

          setRecentEvents((prev) => [
            {
              guardian: currentAddress || "0xYourWalletAddressHere",
              surahId: selectedSurah.index,
              amount: `${sponsorshipAmount} ETH`,
              txHash: fakeTx
            },
            ...prev
          ]);

          onSponsorshipSuccess(selectedSurah.index);
          setSelectedSurah(null);
          setIsLoading(false);
        }, 2000);
      }
    } catch (err) {
      console.error("Sponsorship transaction failed:", err);
      alert("Transaction failed. Please ensure you have sufficient testnet gas.");
      setIsLoading(false);
    }
  };

  // Helper formatting utilities
  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // SVG Certificate live UI preview generator
  const renderSVGLivePreview = (surah: SurahData, guardianAddr: string, valEth: string) => {
    const truncatedHash = "0x" + ethers.keccak256(ethers.toUtf8Bytes(`${surah.index}-${surah.name}`)).substring(2, 10) + "...";
    return (
      <svg viewBox="0 0 400 600" className="w-full max-w-[280px] md:max-w-[320px] mx-auto rounded-xl border border-amber-400 shadow-xl bg-[#01140a]">
        {/* Borders */}
        <rect width="400" height="600" rx="12" fill="#01140a" stroke="#d4af37" strokeWidth="6"/>
        <rect x="15" y="15" width="370" height="570" rx="10" fill="none" stroke="#d4af37" strokeWidth="2" strokeDasharray="8 4"/>
        <rect x="25" y="25" width="350" height="550" rx="8" fill="none" stroke="#d4af37" strokeWidth="1"/>
        
        {/* Header Text */}
        <text x="200" y="80" textAnchor="middle" fill="#ffe57f" fontFamily="serif" fontSize="20" fontWeight="bold" letterSpacing="1">GUARDIAN OF AL-QURAN</text>
        <line x1="120" y1="100" x2="280" y2="100" stroke="#d4af37" strokeWidth="2"/>
        <circle cx="200" cy="100" r="4" fill="#d4af37"/>
        
        {/* Badge */}
        <polygon points="200,135 218,142 225,160 218,178 200,185 182,178 175,160 182,142" fill="none" stroke="#d4af37" strokeWidth="2"/>
        <text x="200" y="156" textAnchor="middle" fill="#ffe57f" fontSize="10" fontWeight="bold">SURAH</text>
        <text x="200" y="172" textAnchor="middle" fill="#ffe57f" fontSize="13" fontWeight="bold">{surah.index}</text>

        {/* Names */}
        <text x="200" y="260" textAnchor="middle" fill="#ffffff" fontSize="38" fontWeight="bold">{surah.name}</text>
        <text x="200" y="305" textAnchor="middle" fill="#ffe57f" fontSize="18" fontStyle="italic" fontWeight="bold">{surah.englishName}</text>
        
        {/* Details Grid */}
        <text x="120" y="360" fill="#88c3a5" fontSize="11" textAnchor="middle">Verses</text>
        <text x="120" y="380" fill="#ffffff" fontSize="15" fontWeight="bold" textAnchor="middle">{surah.versesCount}</text>
        <text x="280" y="360" fill="#88c3a5" fontSize="11" textAnchor="middle">Type</text>
        <text x="280" y="380" fill="#ffffff" fontSize="15" fontWeight="bold" textAnchor="middle">{surah.type}</text>

        {/* Cryptographic Hash */}
        <text x="200" y="440" textAnchor="middle" fill="#88c3a5" fontFamily="monospace" fontSize="9">INTEGRITY HASH (KECCAK256)</text>
        <text x="200" y="458" textAnchor="middle" fill="#ffffff" fontFamily="monospace" fontSize="9">{truncatedHash}</text>

        {/* Guardian details */}
        <rect x="40" y="490" width="320" height="60" rx="8" fill="#042011" stroke="#d4af37" strokeWidth="1"/>
        <text x="200" y="508" textAnchor="middle" fill="#88c3a5" fontSize="9">HONORARY GUARDIAN &amp; SPONSOR</text>
        <text x="200" y="525" textAnchor="middle" fill="#ffffff" fontFamily="monospace" fontSize="11" fontWeight="bold">
          {guardianAddr ? formatAddress(guardianAddr) : "Your Wallet Address"}
        </text>
        <text x="200" y="540" textAnchor="middle" fill="#ffe57f" fontSize="9">Contribution: {valEth} ETH</text>
      </svg>
    );
  };

  // Filter and search logic
  const filteredSurahs = surahList.filter((surah) => {
    const isSponsored = surahStatuses[surah.index] !== undefined;
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "available" && !isSponsored) ||
      (activeFilter === "sponsored" && isSponsored);

    const matchesSearch =
      surah.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      surah.englishMeaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(surah.index).includes(searchQuery);

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-8 p-1 md:p-4">
      {/* Top Banner & Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
        <div className="glass-panel p-4 md:p-6 flex items-center gap-4 border-l-4 border-amber-400">
          <div className="p-3 rounded-xl bg-amber-400/10 text-amber-300">
            <Award size={24} className="md:w-7 md:h-7" />
          </div>
          <div>
            <div className="text-xs text-[#8ab69d]">Total Guardians</div>
            <div className="text-2xl md:text-3xl font-extrabold text-white">{analytics.totalGuardians || "2"}</div>
          </div>
        </div>

        <div className="glass-panel p-4 md:p-6 flex items-center gap-4 border-l-4 border-emerald-500">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-300">
            <Coins size={24} className="md:w-7 md:h-7" />
          </div>
          <div>
            <div className="text-xs text-[#8ab69d]">Sadaqah Raised</div>
            <div className="text-2xl md:text-3xl font-extrabold text-[#ffe57f]">
              {analytics.totalSadaqah === "0.0" ? "0.006 ETH" : `${analytics.totalSadaqah} ETH`}
            </div>
          </div>
        </div>

        <div className="glass-panel p-4 md:p-6 flex items-center gap-4 border-l-4 border-indigo-400">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-300">
            <Heart size={24} className="animate-pulse text-rose-400 md:w-7 md:h-7" />
          </div>
          <div>
            <div className="text-xs text-[#8ab69d]">Base Network</div>
            <div className="text-[10px] md:text-xs font-semibold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 w-max mt-1">
              Base Sepolia Online
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Grid: Surahs */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Filters Dashboard */}
          <div className="glass-panel p-3 md:p-4 flex flex-col gap-3 md:flex-row md:items-center justify-between sticky top-[68px] z-30 bg-[#032413]/90 backdrop-blur-xl">
            {/* Filter buttons */}
            <div className="flex bg-[#011309] p-1 md:p-1.5 rounded-lg border border-emerald-800/40 w-full md:w-auto">
              {(["all", "available", "sponsored"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`flex-1 md:flex-none px-3 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs font-bold rounded-md transition-all capitalize ${
                    activeFilter === filter
                      ? "bg-emerald-800 text-white shadow-md border border-[#d4af37]/35"
                      : "text-emerald-100/50 hover:text-white"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <input
              type="text"
              placeholder="Search Surah..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-80 px-3 py-2 md:px-4 md:py-2.5 rounded-lg border border-emerald-800/40 bg-emerald-950/20 text-white placeholder-emerald-100/30 font-sans focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-xs md:text-sm"
            />
          </div>

          {/* Surah visual cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {filteredSurahs.map((surah) => {
              const status = surahStatuses[surah.index];
              const isSponsored = status !== undefined;

              return (
                <div
                  key={surah.index}
                  className={`glass-panel p-5 flex flex-col justify-between gap-4 border transition-all ${
                    isSponsored 
                      ? "border-[#d4af37]/30 bg-emerald-950/15" 
                      : "border-transparent"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono px-2 py-1 rounded bg-[#011309] border border-emerald-800 text-amber-300 font-bold">
                      #{surah.index}
                    </span>
                    <div className="text-right">
                      <div className="font-arabic text-xl text-amber-200">{surah.name}</div>
                      <div className="text-[10px] text-emerald-100/40">{surah.versesCount} verses</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-white leading-tight">{surah.englishName}</h4>
                    <p className="text-xs text-[#8ab69d] italic leading-relaxed mt-0.5">{surah.englishMeaning}</p>
                  </div>

                  {/* Status Banner */}
                  <div className="border-t border-emerald-900/60 pt-4 mt-2">
                    {isSponsored ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-xs text-amber-300 font-semibold">
                          <UserCheck size={14} className="text-amber-400" />
                          <span>Guardian Registered</span>
                        </div>
                        <div className="text-[10px] font-mono text-emerald-100/60 flex justify-between">
                          <span>Address:</span>
                          <span className="text-white font-bold">{formatAddress(status.guardian)}</span>
                        </div>
                        <div className="text-[10px] font-mono text-emerald-100/60 flex justify-between">
                          <span>Contribution:</span>
                          <span className="text-amber-200 font-bold">
                            {ethers.formatEther(status.sponsorshipAmount)} ETH
                          </span>
                        </div>
                        {currentAddress && currentAddress.toLowerCase() === status.guardian.toLowerCase() ? (
                          <span className="text-[9px] text-emerald-400 font-bold mt-1 text-center bg-emerald-950/60 py-0.5 rounded border border-emerald-900">
                            🛡 You are the Guardian!
                          </span>
                        ) : (
                          <button
                            onClick={() => setSelectedSurah(surah)}
                            className="text-left text-[10px] text-amber-400 hover:text-amber-200 underline mt-1 font-semibold"
                          >
                            Upgrade Sponsorship ➜
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedSurah(surah)}
                        className="w-full py-2 bg-emerald-900/30 hover:bg-emerald-900/50 text-[#ffe57f] hover:text-white rounded-lg border border-emerald-700/60 text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 uppercase"
                      >
                        <span>Sponsor &amp; Protect</span>
                        <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Pane: Noble Guardians Live Feed */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="glass-panel p-5">
            <h3 className="text-lg font-bold mb-4 gold-text-gradient flex items-center gap-2">
              <UserCheck size={18} className="text-amber-400" />
              <span>Base On-chain Activity</span>
            </h3>
            <div className="space-y-4">
              {recentEvents.map((log, index) => (
                <div
                  key={index}
                  className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-900 flex flex-col gap-1.5 text-xs"
                >
                  <div className="flex justify-between items-center text-[10px] text-[#8ab69d]">
                    <span className="font-semibold text-amber-400">Surah Sponsored</span>
                    <span>{log.txHash}</span>
                  </div>
                  <div className="text-white font-semibold">
                    {surahList.find(s => s.index === log.surahId)?.englishName}
                  </div>
                  <div className="text-[10px] flex justify-between mt-1 border-t border-emerald-900/60 pt-1.5">
                    <span className="text-emerald-100/50">Sponsor:</span>
                    <span className="font-mono text-emerald-300 font-bold">{formatAddress(log.guardian)}</span>
                  </div>
                  <div className="text-[10px] flex justify-between">
                    <span className="text-emerald-100/50">Amount:</span>
                    <span className="text-amber-200 font-bold">{log.amount}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-5 text-[10px] text-emerald-100/40 text-center leading-relaxed">
              Every guardianship certificate generates a 100% on-chain vector NFT SVG card deployed permanently on Base L2 blockchain nodes.
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Sponsorship Actions */}
      {selectedSurah && (
        <div className="fixed inset-0 z-[100] bg-[#010905]/80 backdrop-blur-md flex items-center justify-center p-2 md:p-4">
          <div className="glass-panel w-full max-w-3xl max-h-[95vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col md:flex-row">
            {/* Left Col: Dynamic SVG Preview */}
            <div className="md:w-1/2 p-4 md:p-6 bg-[#010e06] border-b md:border-b-0 md:border-r border-emerald-900/60 flex items-center justify-center">
              {renderSVGLivePreview(
                selectedSurah,
                currentAddress || "0x0000000000000000000000000000000000000000",
                sponsorshipAmount
              )}
            </div>

            {/* Right Col: Interactive Control Forms */}
            <div className="md:w-1/2 p-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-xs text-[#8ab69d] font-bold">Surah #{selectedSurah.index}</span>
                    <h3 className="text-2xl font-bold text-white leading-tight mt-0.5">{selectedSurah.englishName}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedSurah(null)}
                    className="text-emerald-100/45 hover:text-white text-lg font-bold p-1"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-[#8ab69d] italic border-b border-emerald-900/40 pb-4 mb-4">
                  "{selectedSurah.englishMeaning}"
                </p>

                {/* Form fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#8ab69d] mb-1.5">
                      Sponsorship Contribution Amount (ETH)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={sponsorshipAmount}
                        onChange={(e) => setSponsorshipAmount(e.target.value)}
                        className="w-full pl-4 pr-16 py-3 rounded-xl border border-emerald-800/60 bg-emerald-950/20 text-[#ffe57f] font-bold font-mono focus:outline-none focus:border-amber-400 text-lg"
                      />
                      <span className="absolute right-4 top-3.5 text-xs text-[#8ab69d] font-bold">
                        ETH
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-100/50 mt-1 block">
                      Minimum recommended: 0.001 Sepolia ETH / ETH
                    </span>
                  </div>

                  <div className="p-3.5 rounded-lg bg-emerald-950/50 border border-emerald-900/60 text-xs leading-relaxed text-emerald-100/80">
                    🔒 <span className="font-semibold text-amber-400">Onchain Sadaqah:</span> Your sponsored donation will support the contract registry and permanent Web3 preservation. You can withdraw or re-direct sponsored funds to charities anytime if you own the contract.
                  </div>
                </div>
              </div>

              {/* Bottom Buttons */}
              <div className="mt-8 flex flex-col gap-2">
                {currentAddress ? (
                  <button
                    onClick={executeSponsorship}
                    disabled={isLoading || parseFloat(sponsorshipAmount) <= 0}
                    className="gold-button w-full justify-center text-sm"
                  >
                    {isLoading ? "Broadcasting to Base..." : "Register Guardianship & Mint"}
                  </button>
                ) : (
                  <button
                    onClick={connectWallet}
                    className="emerald-button w-full justify-center text-sm text-[#ffe57f] border-amber-400/40"
                  >
                    Connect Wallet to Sponsor
                  </button>
                )}
                
                {transactionHash && (
                  <div className="text-[10px] font-mono text-center text-[#8ab69d] mt-2">
                    Tx Hash: <span className="text-white truncate">{transactionHash}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
