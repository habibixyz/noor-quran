import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Heart, Coins, Award, ExternalLink, AlertCircle, CheckCircle2, ArrowRight, Info, Users, ShieldCheck, Sparkles } from "lucide-react";
import { PAYPAL_CLIENT_ID, NETWORKS, CONTRACT_ADDRESSES, DEFAULT_CHAIN_ID, SADAQAH_ZAKAT_ABI } from "../config";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import confetti from "canvas-confetti";

declare global {
  interface Window {
    ethereum?: any;
    rabby?: any;
    coinbaseWalletExtension?: any;
  }
}

interface DonationRecord {
  donor: string;
  amount: string; // Formatted ETH
  timestamp: string;
  isZakat: boolean;
  txHash?: string;
}

interface AboutAndDonateProps {
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  account: string;
  chainId: number | null;
  walletBalance: string;
  activeWalletName: string;
  switchNetwork: (targetChainId: number) => Promise<void>;
  disconnectWallet: () => void;
}

export const AboutAndDonate: React.FC<AboutAndDonateProps> = ({
  provider,
  signer,
  account,
  chainId,
  walletBalance,
  activeWalletName,
  switchNetwork,
  disconnectWallet,
}) => {
  // Contract state
  const [contractAddress, setContractAddress] = useState<string>("");
  const [stats, setStats] = useState({
    totalAccumulated: "0.0",
    totalSadaqah: "0.0",
    totalZakat: "0.0",
    donorsCount: 0,
    donationsCount: 0,
    poorFamiliesAided: 0
  });

  // Recent Donations Feed
  const [recentDonations, setRecentDonations] = useState<DonationRecord[] | null>([]);

  // Donation Form
  const [paymentMethod, setPaymentMethod] = useState<"crypto" | "paypal">("crypto");
  const [donationType, setDonationType] = useState<"sadaqah" | "zakat">("sadaqah");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [paypalAmount, setPaypalAmount] = useState<string>("10.00");
  const [ethPrice, setEthPrice] = useState<number>(3000); // Default placeholder
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [transactionHash, setTransactionHash] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  useEffect(() => {
    fetchEthPrice();
  }, []);

  // Fetch ETH price from CoinGecko
  const fetchEthPrice = async () => {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      );
      const data = await response.json();
      if (data && data.ethereum && data.ethereum.usd) {
        setEthPrice(data.ethereum.usd);
      }
    } catch (e) {
      console.warn("CoinGecko API unavailable. Using fallback ETH price of $3000", e);
    }
  };


  // Load contract stats and recent donations, with polling
  useEffect(() => {
    loadContractData();
    
    // Poll every 15 seconds to fetch updated contract state / donation list
    const interval = setInterval(() => {
      loadContractData();
    }, 15000);
    
    return () => clearInterval(interval);
  }, [provider, chainId, ethPrice]);

  const fetchAndSetStats = async (contract: ethers.Contract) => {
    const totalAccWei = await contract.totalAccumulated();
    const totalSadWei = await contract.totalSadaqah();
    const totalZakWei = await contract.totalZakat();
    const uniqueDonors = await contract.totalDonorsCount();
    const totalDons = await contract.totalDonationsCount();

    const ethAccumulated = ethers.formatEther(totalAccWei);
    
    // Estimate poor families aided ($100 per family estimate)
    const totalUsdVal = parseFloat(ethAccumulated) * ethPrice;
    const familiesAided = Math.floor(totalUsdVal / 100);

    setStats({
      totalAccumulated: parseFloat(ethAccumulated).toFixed(4),
      totalSadaqah: parseFloat(ethers.formatEther(totalSadWei)).toFixed(4),
      totalZakat: parseFloat(ethers.formatEther(totalZakWei)).toFixed(4),
      donorsCount: Number(uniqueDonors),
      donationsCount: Number(totalDons),
      poorFamiliesAided: familiesAided
    });

    // Load recent donations
    try {
      const recent = await contract.getRecentDonations(6);
      console.log("[Noor] Recent donations raw:", recent);
      const formatted = recent.map((item: any) => ({
        donor: item.donor ?? item[0],
        amount: parseFloat(ethers.formatEther(item.amount ?? item[1])).toFixed(4),
        timestamp: new Date(Number(item.timestamp ?? item[2]) * 1000).toLocaleDateString(),
        isZakat: item.isZakat ?? item[3]
      }));
      setRecentDonations(formatted);
    } catch (e) {
      console.error("[Noor] getRecentDonations failed:", e);
      setRecentDonations([]);
    }
  };

  const loadContractData = async () => {
    const activeChain = chainId && (chainId === 8453 || chainId === 84532) ? chainId : DEFAULT_CHAIN_ID;
    const address = CONTRACT_ADDRESSES[activeChain as keyof typeof CONTRACT_ADDRESSES]?.sadaqahZakat;
    setContractAddress(address);

    if (!address) {
      loadMockStats();
      return;
    }

    // Try list of RPCs for public fallback to avoid rate limiting
    const publicRpcs = activeChain === 8453 
      ? ["https://1rpc.io/base", "https://base.meowrpc.com", "https://gateway.tenderly.co/public/base", "https://mainnet.base.org"]
      : ["https://sepolia.base.org", "https://base-sepolia.blockpi.network/v1/rpc/public"];

    let success = false;
    
    // If provider is already connected and on the active chain, use that provider directly
    if (provider && (chainId === 8453 || chainId === 84532) && chainId === activeChain) {
      try {
        const contract = new ethers.Contract(address, SADAQAH_ZAKAT_ABI, provider);
        await fetchAndSetStats(contract);
        success = true;
      } catch (err) {
        console.warn("[Noor] Connected provider call failed, falling back to public RPCs:", err);
      }
    }

    // Otherwise, loop through public RPCs until one succeeds
    if (!success) {
      for (const rpcUrl of publicRpcs) {
        try {
          const activeProvider = new ethers.JsonRpcProvider(rpcUrl);
          const contract = new ethers.Contract(address, SADAQAH_ZAKAT_ABI, activeProvider);
          await fetchAndSetStats(contract);
          success = true;
          break; // Exit RPC loop on success
        } catch (err) {
          console.warn(`[Noor] Public RPC ${rpcUrl} failed or rate-limited:`, err);
        }
      }
    }

    if (!success) {
      console.error("[Noor] All RPC endpoints failed. Falling back to mock stats.");
      loadMockStats();
    }
  };

  const loadMockStats = () => {
    setStats({
      totalAccumulated: "0.0000",
      totalSadaqah: "0.0000",
      totalZakat: "0.0000",
      donorsCount: 0,
      donationsCount: 0,
      poorFamiliesAided: 0
    });

    setRecentDonations([]);
  };

  // Convert USD value to ETH
  const getEthFromUsd = (usdAmount: number) => {
    return (usdAmount / ethPrice).toFixed(6);
  };

  // Quick donate handlers
  const handleQuickDonate = async (usdAmount: number) => {
    if (paymentMethod === "crypto") {
      const calculatedEth = getEthFromUsd(usdAmount);
      setCustomAmount(calculatedEth);
      await executeDonation(calculatedEth);
    } else {
      setPaypalAmount(usdAmount.toFixed(2));
    }
  };

  const handleCustomDonateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAmount || parseFloat(customAmount) <= 0) {
      setErrorMessage("Please enter a valid amount");
      return;
    }
    await executeDonation(customAmount);
  };

  const executeDonation = async (amountInEth: string) => {
    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    setTransactionHash("");

    // Check if wallet is connected and on proper network
    if (!signer || !account) {
      setErrorMessage("Please connect your wallet to make a donation.");
      setIsLoading(false);
      return;
    }

    // Real on-chain transaction
    if (chainId !== 8453 && chainId !== 84532) {
      setErrorMessage("Please switch your wallet to Base Network first.");
      setIsLoading(false);
      return;
    }

    try {
      const activeChain = chainId === 8453 ? 8453 : 84532;
      const address = CONTRACT_ADDRESSES[activeChain as keyof typeof CONTRACT_ADDRESSES]?.sadaqahZakat;
      
      if (!address) {
        throw new Error("Contract address not configured for this network");
      }

      const contract = new ethers.Contract(address, SADAQAH_ZAKAT_ABI, signer);
      const valueInWei = ethers.parseEther(amountInEth);

      let tx;
      if (donationType === "sadaqah") {
        tx = await contract.donateSadaqah({ value: valueInWei });
      } else {
        tx = await contract.donateZakat({ value: valueInWei });
      }

      setTransactionHash(tx.hash);
      await tx.wait();

      setSuccessMessage(`Thank you! Your donation of ${amountInEth} ETH was processed on Base.`);
      setCustomAmount("");
      triggerConfetti();
      loadContractData();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.reason || err.message || "Transaction failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#c9a84c", "#e8d5a3", "#8c6b4a", "#ffffff"]
    });
  };

  const formatAddress = (addr: string) => {
    if (!addr) return "";
    if (addr.includes("...")) return addr;
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const getExplorerLink = (txHash?: string) => {
    const activeChain = chainId && (chainId === 8453 || chainId === 84532) ? chainId : DEFAULT_CHAIN_ID;
    const explorer = activeChain === 8453 ? NETWORKS.BASE_MAINNET.blockExplorer : NETWORKS.BASE_SEPOLIA.blockExplorer;
    
    if (txHash) {
      return `${explorer}/tx/${txHash}`;
    }
    return `${explorer}/address/${contractAddress}`;
  };

  return (
    <section className="flex flex-col gap-8 p-0 md:p-4" aria-label="About and Donate">
      {/* 1. Header Block with status indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#33261a]">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Heart className="text-rose-500 fill-rose-500 animate-pulse" size={24} />
            <span>Sadaqah &amp; Zakat Charity</span>
          </h2>
          <p className="text-xs text-[#8c6b4a] mt-1">
            Empowering on-chain transparent donations to families in need via Base Network.
          </p>
        </div>

        {/* Wallet Connection Display */}
        {account && (
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto">
              <div className="px-2.5 py-1.5 rounded-xl bg-[var(--color-bg-deep)] border border-emerald-950 flex flex-wrap items-center gap-1.5 text-[11px] md:text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-[#8c6b4a]">{activeWalletName || "Base"} Connected:</span>
                <span className="font-mono font-bold text-[var(--color-gold-light)]">{formatAddress(account)}</span>
                <span className="text-[#8c6b4a]">({walletBalance} ETH)</span>
              </div>
              
              <button
                onClick={disconnectWallet}
                className="px-3 py-1.5 rounded-xl bg-red-950/20 border border-red-900/60 hover:bg-red-950 hover:text-red-200 text-red-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all justify-center cursor-pointer"
              >
                Disconnect
              </button>

              {chainId !== 8453 && chainId !== 84532 && (
                <button
                  id="switch-to-base-btn"
                  onClick={() => switchNetwork(8453)}
                  className="px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-800 text-amber-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-amber-900 transition-all justify-center"
                >
                  <AlertCircle size={12} />
                  <span>Switch to Base</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Interactive Stats Grid & About Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Columns (3/4): Main About and Donation Interface */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* About Sadaqah & Zakat section */}
          <div className="premium-card space-y-4">
            <h3 className="text-lg font-bold text-[var(--color-gold-light)] flex items-center gap-2">
              <Sparkles size={18} />
              <span>Our Charity Mission</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm text-[#f0e8d0] leading-relaxed">
              <div className="space-y-3">
                <div className="premium-card premium-card-accent-gold p-4 bg-[#1a140d]/40">
                  <h4 className="font-bold text-[var(--color-gold)] flex items-center gap-1.5 mb-1.5 text-xs">
                    <Coins size={14} />
                    <span>Zakat (Obligatory Alms)</span>
                  </h4>
                  <p className="text-[11px] text-[#8c6b4a] leading-relaxed">
                    Zakat is a religious obligation for Muslims, representing 2.5% of accumulated wealth above the Nisab threshold. Every wei donated under Zakat is restricted to the specific categories of recipients defined in Islamic jurisprudence (specifically poor and needy families).
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="premium-card premium-card-accent-rose p-4 bg-[#1a140d]/40">
                  <h4 className="font-bold text-rose-300 flex items-center gap-1.5 mb-1.5 text-xs">
                    <Heart size={14} />
                    <span>Sadaqah (Voluntary Charity)</span>
                  </h4>
                  <p className="text-[11px] text-[#8c6b4a] leading-relaxed">
                    Sadaqah is given voluntarily out of kindness, generosity, and love. Unlike Zakat, Sadaqah has no minimum thresholds or restricted recipient rules. It is distributed for general welfare, supporting orphanages, food supplies, and local assistance programs.
                  </p>
                </div>
              </div>
            </div>

            <div className="premium-info-block flex items-start gap-2.5">
              <Info size={16} className="text-[var(--color-gold)] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">100% On-chain Transparency:</span> All funds reside securely in the smart contract deployed on the Base Layer-2 network (by Coinbase). Distribution records are written directly to the ledger, guaranteeing that every single cent goes directly to verified food, healthcare, and shelter allocations with near-zero gas transaction fees.
              </div>
            </div>
          </div>

          {/* Donation Form panel */}
          <div className="premium-card space-y-6">
            <h3 className="text-lg font-bold text-[var(--color-gold-light)] flex items-center gap-2">
              <Coins size={18} className="text-[var(--color-gold)]" />
              <span>Make a Contribution</span>
            </h3>

            {/* Payment Method Selector */}
            <div className="charity-toggle-wrap">
              <button
                type="button"
                onClick={() => setPaymentMethod("crypto")}
                className={`charity-toggle-btn ${paymentMethod === "crypto" ? "active" : ""}`}
              >
                <span>🦊 Web3 (Base)</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("paypal")}
                className={`charity-toggle-btn ${paymentMethod === "paypal" ? "active" : ""}`}
              >
                <span>🅿️ PayPal (Fiat)</span>
              </button>
            </div>

            {/* Donation Type Toggles */}
            <div className="charity-toggle-wrap">
              <button
                id="donation-type-sadaqah"
                type="button"
                onClick={() => setDonationType("sadaqah")}
                className={`charity-toggle-btn ${donationType === "sadaqah" ? "active" : ""}`}
              >
                <Heart size={12} />
                <span>Sadaqah</span>
              </button>
              <button
                id="donation-type-zakat"
                type="button"
                onClick={() => setDonationType("zakat")}
                className={`charity-toggle-btn ${donationType === "zakat" ? "active" : ""}`}
              >
                <Coins size={12} />
                <span>Zakat</span>
              </button>
            </div>

            {/* Quick Donation Actions */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-[#8c6b4a]">
                Quick Options (in USD equivalent)
              </label>
              <div className="quick-options-grid">
                {[1, 5, 10, 20].map((amount) => {
                  const calculatedEth = getEthFromUsd(amount);
                  return (
                    <button
                      key={amount}
                      id={`quick-donate-${amount}`}
                      type="button"
                      onClick={() => handleQuickDonate(amount)}
                      disabled={isLoading && paymentMethod === "crypto"}
                      className={`quick-option-chip ${paymentMethod === "paypal" && parseFloat(paypalAmount) === amount ? "border-[var(--color-gold)] bg-[#33261a]" : ""}`}
                    >
                      <span className="amount-val">${amount}</span>
                      {paymentMethod === "crypto" && <span className="eth-val">{calculatedEth} ETH</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {paymentMethod === "crypto" ? (
              <form onSubmit={handleCustomDonateSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="custom-donation-amount" className="block text-xs font-semibold text-[#8c6b4a]">
                    Or Enter Custom Amount (ETH)
                  </label>
                <div className="custom-input-wrap">
                  <input
                    id="custom-donation-amount"
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    placeholder="e.g. 0.005"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    disabled={isLoading}
                    className="custom-input-field"
                  />
                  <div className="custom-input-badge">
                    <span>ETH</span>
                    {customAmount && parseFloat(customAmount) > 0 && (
                      <span className="text-[9px] bg-[#33261a] px-1.5 py-0.5 rounded text-[var(--color-gold-light)] font-normal border border-[rgba(201,168,76,0.1)]">
                        ≈ ${(parseFloat(customAmount) * ethPrice).toFixed(2)} USD
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status / Transaction alerts */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/60 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {transactionHash && (
                <div className="p-3 rounded-xl bg-[#33261a]/40 border border-[var(--color-glass-border)] text-xs text-[#8c6b4a] flex items-center justify-between gap-2">
                  <span className="truncate">Tx: <span className="font-mono text-[var(--color-gold-light)]">{transactionHash}</span></span>
                  <a
                    href={getExplorerLink(transactionHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--color-gold)] hover:text-white shrink-0 flex items-center gap-0.5 underline font-bold"
                  >
                    <span>View on BaseScan</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              )}

              <button
                id="submit-donation-btn"
                type="submit"
                disabled={isLoading || !customAmount}
                className="gold-button w-full justify-center text-sm relative py-4 mt-2"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-[var(--color-bg-deep)] border-t-transparent rounded-full animate-spin"></span>
                    <span>Broadcasting Donation...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span>Donate {donationType === "sadaqah" ? "Sadaqah" : "Zakat"} Now</span>
                    <ArrowRight size={14} />
                  </span>
                )}
              </button>
            </form>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="custom-paypal-amount" className="block text-xs font-semibold text-[#8c6b4a]">
                    Or Enter Custom Amount (USD)
                  </label>
                  <div className="custom-input-wrap">
                    <input
                      id="custom-paypal-amount"
                      type="number"
                      step="1"
                      min="1"
                      placeholder="e.g. 50"
                      value={paypalAmount}
                      onChange={(e) => setPaypalAmount(e.target.value)}
                      className="custom-input-field"
                    />
                    <div className="custom-input-badge">
                      <span>USD</span>
                    </div>
                  </div>
                </div>

                {successMessage && (
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/60 text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-[var(--color-glass-border)]">
                  <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "USD" }}>
                    <PayPalButtons 
                      style={{ layout: "vertical", color: "gold", shape: "rect", label: "donate" }}
                      createOrder={(_, actions) => {
                        return actions.order.create({
                          intent: "CAPTURE",
                          purchase_units: [
                            {
                              amount: {
                                currency_code: "USD",
                                value: paypalAmount && parseFloat(paypalAmount) > 0 ? parseFloat(paypalAmount).toFixed(2) : "10.00",
                              },
                              description: `Noor Quran - ${donationType === "sadaqah" ? "Sadaqah" : "Zakat"} Donation`,
                            },
                          ],
                        });
                      }}
                      onApprove={async (_, actions) => {
                        if (actions.order) {
                          try {
                            const details = await actions.order.capture();
                            const val = details.purchase_units?.[0]?.amount?.value || paypalAmount;
                            setSuccessMessage(`JazakAllahu Khairan! Thank you for your ${donationType} of $${val} via PayPal!`);
                            setErrorMessage("");
                            triggerConfetti();
                          } catch (error) {
                            setErrorMessage("There was an error processing the payment capture.");
                          }
                        }
                      }}
                      onError={() => {
                        setErrorMessage("PayPal payment failed or was cancelled. Please try again.");
                      }}
                    />
                  </PayPalScriptProvider>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1/4): Smart Contract Statistics & Distribution Cards */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* SMART CONTRACT DYNAMIC ACCUMULATION CARD */}
          <div className="premium-card relative overflow-hidden bg-[#241c13] border-2 border-[var(--color-gold)]/40">
            {/* Ambient Background Glow */}
            <div className="absolute -top-12 -right-12 w-28 h-28 bg-[var(--color-gold)]/10 rounded-full blur-xl"></div>
            
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-[var(--color-gold)] mb-3">
              On-chain Ledger Stats
            </h3>
            
            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-[#8c6b4a] block font-semibold uppercase">Total Accumulated</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-3xl font-extrabold text-white tracking-tight">{stats.totalAccumulated}</span>
                  <span className="text-sm font-bold text-[var(--color-gold)]">ETH</span>
                </div>
                <span className="text-[11px] text-[var(--color-gold-light)] block mt-0.5 font-bold">
                  ≈ ${(parseFloat(stats.totalAccumulated) * ethPrice).toLocaleString(undefined, {maximumFractionDigits:2})} USD
                </span>
              </div>

              {/* Circular/Linear Goal Tracker */}
              <div className="border-t border-[#33261a] pt-3">
                <div className="flex justify-between items-center text-[10px] mb-1.5">
                  <span className="text-[#8c6b4a] font-semibold">COMMUNITY GOAL (10 ETH)</span>
                  <span className="text-[var(--color-gold-light)] font-bold">
                    {Math.min(100, (parseFloat(stats.totalAccumulated) / 10) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="premium-progress-track">
                  <div 
                    className="premium-progress-fill" 
                    style={{ width: `${Math.min(100, (parseFloat(stats.totalAccumulated) / 10) * 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="border-t border-[#33261a] pt-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8c6b4a] flex items-center gap-1">
                    <Heart size={10} className="text-rose-400" />
                    <span>Sadaqah Fund:</span>
                  </span>
                  <span className="font-mono font-bold text-[#f0e8d0]">{stats.totalSadaqah} ETH</span>
                </div>
                
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8c6b4a] flex items-center gap-1">
                    <Coins size={10} className="text-amber-400" />
                    <span>Zakat Fund:</span>
                  </span>
                  <span className="font-mono font-bold text-[#f0e8d0]">{stats.totalZakat} ETH</span>
                </div>

                <div className="flex justify-between items-center text-[11px] border-t border-[#33261a]/60 pt-2">
                  <span className="text-[#8c6b4a] flex items-center gap-1">
                    <Users size={10} className="text-emerald-400" />
                    <span>Total Donors:</span>
                  </span>
                  <span className="font-bold text-white">{stats.donorsCount} wallets</span>
                </div>
                
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8c6b4a] flex items-center gap-1">
                    <Award size={10} className="text-indigo-400" />
                    <span>Donations Count:</span>
                  </span>
                  <span className="font-bold text-white">{stats.donationsCount} receipts</span>
                </div>
              </div>

              {/* Explorer Address details */}
              {contractAddress && (
                <div className="pt-2">
                  <a
                    href={getExplorerLink()}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2 bg-[#16110b] hover:bg-[#1f1810] text-[#8c6b4a] hover:text-white rounded-lg border border-[var(--color-glass-border)] text-[9px] font-mono tracking-wider transition-all flex items-center justify-center gap-1 uppercase font-bold"
                  >
                    <span>Contract Address</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Distribution card */}
          <div className="premium-card space-y-4">
            <h4 className="text-xs uppercase font-extrabold text-[var(--color-gold-light)] flex items-center gap-1">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Verified Distributions</span>
            </h4>
            
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="px-2 py-0.5 rounded bg-[#33261a] text-[var(--color-gold)] font-bold text-xs border border-[var(--color-gold)]/20 shrink-0">
                    100%
                  </div>
                  <h5 className="text-xs font-bold text-white">Direct-to-Recipient</h5>
                </div>
                <p className="text-[10px] text-[#8c6b4a] leading-relaxed">
                  Zero cuts. Our distribution program operates fully volunteer-based, guaranteeing all funds assist families.
                </p>
              </div>

              <div className="flex flex-col gap-1.5 pt-3 border-t border-[#33261a]/60">
                <div className="flex items-center gap-2">
                  <div className="px-2 py-0.5 rounded bg-[#33261a] text-rose-300 font-bold text-xs border border-rose-300/20 shrink-0">
                    {stats.poorFamiliesAided}
                  </div>
                  <h5 className="text-xs font-bold text-white">Poor Families Helped</h5>
                </div>
                <p className="text-[10px] text-[#8c6b4a] leading-relaxed">
                  Estimated households aided with local groceries, clothing, and water supplies bought from withdrew funds.
                </p>
              </div>
            </div>
          </div>

          {/* Recent Donations Live Feed */}
          <div className="premium-card space-y-4">
            <h4 className="text-xs uppercase font-extrabold text-[var(--color-gold-light)] flex items-center gap-1">
              <Sparkles size={12} className="text-amber-400 animate-spin star-rotate" />
              <span>Noble Donors Feed</span>
            </h4>

            <div className="space-y-2">
              {recentDonations === null ? (
                <div className="text-[10px] text-rose-400/70 text-center py-4">?? Could not load feed.</div>
              ) : recentDonations.length === 0 ? (
                <div className="text-[10px] text-[#8c6b4a] text-center py-4">No donations recorded yet</div>
              ) : (
                recentDonations.map((item, index) => (
                  <div key={index} className="feed-item">
                    <div className="flex justify-between items-center text-[#8c6b4a]">
                      <span className="font-mono font-bold text-[#f0e8d0]">{formatAddress(item.donor)}</span>
                      <span>{item.timestamp}</span>
                    </div>
                    <div className="flex justify-between items-center font-bold">
                      <span className={item.isZakat ? "text-amber-300 font-medium" : "text-rose-300 font-medium"}>
                        {item.isZakat ? "Zakat" : "Sadaqah"}
                      </span>
                      <span className="text-[var(--color-gold-light)] font-mono">{item.amount} ETH</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
