import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESSES, QURAN_TOKEN_ABI, MERKLE_AIRDROP_ABI, NETWORKS } from "../config";
import airdropData from "../data/airdrop.json";
import { Gift, Wallet, CheckCircle, XCircle, Loader2, Sparkles, Search, HelpCircle, ArrowRight } from "lucide-react";

interface AirdropClaimProps {
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  account: string;
  chainId: number | null;
  walletBalance: string;
  activeWalletName: string;
  switchNetwork: (targetChainId: number) => Promise<void>;
  disconnectWallet: () => void;
}

export function AirdropClaim({
  provider,
  signer,
  account,
  chainId,
  switchNetwork,
}: AirdropClaimProps) {
  // UI State
  const [eligibility, setEligibility] = useState<{
    isEligible: boolean;
    amount: string;
    proof: string[];
    type: string;
    hasClaimed: boolean;
  } | null>(null);

  const [searchAddress, setSearchAddress] = useState("");
  const [searchResult, setSearchResult] = useState<{
    checked: boolean;
    address: string;
    isEligible: boolean;
    amount: string;
    type: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimTxHash, setClaimTxHash] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [tokenBalance, setTokenBalance] = useState("0");

  const activeChainId = chainId || 8453; // fallback to base mainnet
  const addresses = CONTRACT_ADDRESSES[activeChainId] || CONTRACT_ADDRESSES[8453];
  
  const isCorrectChain = chainId === 8453 || chainId === 84532;

  // Load user eligibility & token balance
  useEffect(() => {
    if (account && isCorrectChain && provider) {
      checkUserEligibility();
      fetchTokenBalance();
    } else {
      setEligibility(null);
      setTokenBalance("0");
    }
    setErrorMsg("");
    setClaimSuccess(false);
  }, [account, chainId, provider]);

  const checkUserEligibility = async () => {
    if (!account) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const userAddrLower = account.toLowerCase();
      const claimDetails = (airdropData.claims as any)[userAddrLower];

      if (claimDetails) {
        // Query on-chain if they have already claimed
        let claimed = false;
        if (provider && addresses.merkleAirdrop && addresses.merkleAirdrop !== ethers.ZeroAddress) {
          try {
            const airdropContract = new ethers.Contract(
              addresses.merkleAirdrop,
              MERKLE_AIRDROP_ABI,
              provider
            );
            claimed = await airdropContract.hasClaimed(account);
          } catch (err) {
            console.error("Error checking claim status on-chain:", err);
          }
        }

        setEligibility({
          isEligible: true,
          amount: claimDetails.amount,
          proof: claimDetails.proof,
          type: claimDetails.type,
          hasClaimed: claimed,
        });
      } else {
        setEligibility({
          isEligible: false,
          amount: "0",
          proof: [],
          type: "",
          hasClaimed: false,
        });
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to check eligibility status.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTokenBalance = async () => {
    if (!account || !provider || !addresses.quranToken || addresses.quranToken === ethers.ZeroAddress) return;
    try {
      const tokenContract = new ethers.Contract(
        addresses.quranToken,
        QURAN_TOKEN_ABI,
        provider
      );
      const balance = await tokenContract.balanceOf(account);
      setTokenBalance(parseFloat(ethers.formatEther(balance)).toLocaleString(undefined, { maximumFractionDigits: 2 }));
    } catch (err) {
      console.error("Error fetching QURAN token balance:", err);
    }
  };

  const handleClaim = async () => {
    if (!signer || !eligibility || !eligibility.isEligible || eligibility.hasClaimed) return;
    setClaiming(true);
    setErrorMsg("");
    setClaimSuccess(false);

    try {
      if (!addresses.merkleAirdrop || addresses.merkleAirdrop === ethers.ZeroAddress) {
        throw new Error("Merkle Airdrop contract is not deployed on this network.");
      }

      const airdropContract = new ethers.Contract(
        addresses.merkleAirdrop,
        MERKLE_AIRDROP_ABI,
        signer
      );

      console.log(`Submitting claim for ${account}...`);
      const tx = await airdropContract.claim(
        account,
        eligibility.amount,
        eligibility.proof
      );

      console.log("Transaction submitted:", tx.hash);
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);

      setClaimSuccess(true);
      setClaimTxHash(tx.hash);
      
      // Update local state
      setEligibility({
        ...eligibility,
        hasClaimed: true,
      });

      // Refresh balance
      await fetchTokenBalance();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.reason || err.message || "Claim transaction failed. Please try again.");
    } finally {
      setClaiming(false);
    }
  };

  const handleSearchCheck = () => {
    setErrorMsg("");
    if (!searchAddress || !ethers.isAddress(searchAddress)) {
      setSearchResult({
        checked: true,
        address: searchAddress,
        isEligible: false,
        amount: "0",
        type: "Invalid address format"
      });
      return;
    }

    const searchAddrLower = searchAddress.toLowerCase();
    const claimDetails = (airdropData.claims as any)[searchAddrLower];

    if (claimDetails) {
      setSearchResult({
        checked: true,
        address: searchAddress,
        isEligible: true,
        amount: claimDetails.amount,
        type: claimDetails.type
      });
    } else {
      setSearchResult({
        checked: true,
        address: searchAddress,
        isEligible: false,
        amount: "0",
        type: "Not eligible"
      });
    }
  };

  const formatWeiToTokens = (weiVal: string) => {
    try {
      return parseFloat(ethers.formatEther(weiVal)).toLocaleString();
    } catch {
      return "0";
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-2 py-4 flex flex-col gap-6">
      {/* Top Banner */}
      <div className="relative rounded-3xl p-6 md:p-8 overflow-hidden border border-emerald-950/60 shadow-xl"
        style={{
          background: 'linear-gradient(135deg, #01140a 0%, #032b16 50%, #01140a 100%)',
        }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-500/5 blur-3xl rounded-full" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold mb-3">
              <Sparkles size={12} /> Onchain Rewards
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Quran Token <span className="text-[var(--color-gold)]">$QURAN</span> Airdrop
            </h2>
            <p className="text-xs md:text-sm text-emerald-200/70 mt-2 max-w-xl leading-relaxed">
              We are distributing 10% of the QURAN token supply to active Farcaster community members and Base applications' on-chain contributors who supported the preservation of Al-Quran.
            </p>
          </div>
          <div className="flex shrink-0 p-4 bg-[#010c06] border border-[var(--color-gold)]/30 rounded-2xl flex-col items-center min-w-[180px]">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Airdrop Allocation</span>
            <span className="text-2xl font-black text-white mt-1">100,000,000</span>
            <span className="text-[10px] text-[#8c6b4a] font-bold mt-0.5">QURAN (10% of Supply)</span>
          </div>
        </div>
      </div>

      {/* Airdrop Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-panel p-4 flex flex-col justify-between">
          <span className="text-[10px] text-[#8c6b4a] font-bold">REWARD PER WALLET</span>
          <span className="text-lg font-black text-white mt-1">100,000 QURAN</span>
        </div>
        <div className="glass-panel p-4 flex flex-col justify-between">
          <span className="text-[10px] text-[#8c6b4a] font-bold">TOTAL RECIPIENTS</span>
          <span className="text-lg font-black text-white mt-1">1,000 Wallets</span>
        </div>
        <div className="glass-panel p-4 flex flex-col justify-between">
          <span className="text-[10px] text-[#8c6b4a] font-bold">YOUR QURAN BALANCE</span>
          <span className="text-lg font-black text-[var(--color-gold)] mt-1">{tokenBalance} QURAN</span>
        </div>
        <div className="glass-panel p-4 flex flex-col justify-between">
          <span className="text-[10px] text-[#8c6b4a] font-bold">NETWORK</span>
          <span className="text-sm font-black text-white mt-1">
            {activeChainId === 84532 ? "Base Sepolia" : "Base Mainnet"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Claim Box */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="glass-panel p-6 flex flex-col gap-6 relative">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <Gift className="text-[var(--color-gold)]" size={18} />
              <span>Airdrop Claim Portal</span>
            </h3>

            {/* Wallet Not Connected */}
            {!account && (
              <div className="flex flex-col items-center text-center p-8 bg-[#010905]/40 border border-[#1b3022]/40 rounded-2xl gap-4">
                <Wallet size={36} className="text-[#8c6b4a]" />
                <div>
                  <h4 className="text-sm font-bold text-white">Wallet Disconnected</h4>
                  <p className="text-xs text-[#8c6b4a] mt-1 max-w-sm">
                    Connect your wallet to check if you are eligible for the QURAN token airdrop and claim your rewards.
                  </p>
                </div>
                <p className="text-[10px] text-yellow-500/80 bg-yellow-950/20 border border-yellow-900/30 px-3 py-1.5 rounded-lg">
                  💡 You can also check eligibility for any address using the search tool on the right.
                </p>
              </div>
            )}

            {/* Connected, Wrong Chain */}
            {account && !isCorrectChain && (
              <div className="flex flex-col items-center text-center p-8 bg-[#2d1111]/20 border border-red-950/40 rounded-2xl gap-4">
                <XCircle size={36} className="text-red-500" />
                <div>
                  <h4 className="text-sm font-bold text-white">Wrong Network</h4>
                  <p className="text-xs text-[#8c6b4a] mt-1 max-w-sm">
                    You are connected to an unsupported network. Please switch to Base Network to claim your rewards.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => switchNetwork(8453)}
                    className="gold-button px-4 py-2 text-xs font-bold"
                  >
                    Switch to Base Mainnet
                  </button>
                  <button
                    onClick={() => switchNetwork(84532)}
                    className="px-4 py-2 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-emerald-300 text-xs font-bold hover:bg-emerald-950/40 transition-all cursor-pointer"
                  >
                    Switch to Base Sepolia
                  </button>
                </div>
              </div>
            )}

            {/* Connected, Correct Chain */}
            {account && isCorrectChain && (
              <>
                {loading ? (
                  <div className="flex flex-col items-center justify-center p-12 gap-3">
                    <Loader2 className="animate-spin text-[var(--color-gold)]" size={32} />
                    <span className="text-xs text-[#8c6b4a]">Checking Merkle Tree eligibility...</span>
                  </div>
                ) : (
                  <>
                    {eligibility && (
                      <div className="flex flex-col gap-4">
                        {eligibility.isEligible ? (
                          <>
                            {/* Eligible, Not Claimed */}
                            {!eligibility.hasClaimed ? (
                              <div className="flex flex-col gap-5 p-5 bg-emerald-950/15 border border-emerald-800/20 rounded-2xl">
                                <div className="flex items-start gap-4">
                                  <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400 shrink-0">
                                    <Sparkles size={24} />
                                  </div>
                                  <div className="flex-grow">
                                    <h4 className="text-sm font-bold text-emerald-300">Congratulations! You are eligible!</h4>
                                    <p className="text-[11px] text-emerald-200/60 mt-0.5">
                                      Your wallet was identified as an active contributor: <strong className="text-white">{eligibility.type}</strong>
                                    </p>
                                    <div className="mt-3 flex items-baseline gap-2">
                                      <span className="text-3xl font-black text-white">{formatWeiToTokens(eligibility.amount)}</span>
                                      <span className="text-xs font-bold text-[var(--color-gold)]">QURAN</span>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  onClick={handleClaim}
                                  disabled={claiming}
                                  className="w-full gold-button py-3 text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                                >
                                  {claiming ? (
                                    <>
                                      <Loader2 className="animate-spin" size={16} />
                                      <span>Submitting Claim...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Gift size={16} />
                                      <span>Claim Rewards Now</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            ) : (
                              /* Eligible, Already Claimed */
                              <div className="flex flex-col items-center text-center p-8 bg-emerald-950/10 border border-emerald-900/20 rounded-2xl gap-3">
                                <CheckCircle size={48} className="text-emerald-400" />
                                <div>
                                  <h4 className="text-sm font-bold text-white">Rewards Claimed!</h4>
                                  <p className="text-xs text-[#8c6b4a] mt-1 max-w-sm">
                                    You have already claimed your 100,000 QURAN tokens for this wallet address.
                                  </p>
                                </div>
                                <div className="p-3 bg-[#010905]/40 rounded-xl border border-emerald-950/50 mt-2">
                                  <span className="text-[10px] text-emerald-300 font-bold">Your Balance: {tokenBalance} QURAN</span>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          /* Not Eligible */
                          <div className="flex flex-col items-center text-center p-8 bg-[#22170a]/10 border border-yellow-950/20 rounded-2xl gap-4">
                            <XCircle size={36} className="text-yellow-600" />
                            <div>
                              <h4 className="text-sm font-bold text-white">Not Eligible</h4>
                              <p className="text-xs text-[#8c6b4a] mt-1 max-w-sm">
                                Address <code className="text-[10px] text-white bg-[#010905]/30 px-1 py-0.5 rounded">{account}</code> is not in the active reward list.
                              </p>
                            </div>
                            <p className="text-[10px] text-[#6b5436] leading-relaxed max-w-xs">
                              Criteria for this drop included top 1,000 active Farcaster casters, Base builders, and historical Noor Quran contract interactions.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Feedback / Error messaging */}
            {errorMsg && (
              <div className="p-3.5 bg-red-950/20 border border-red-900/30 rounded-xl text-red-200 text-xs leading-relaxed flex gap-2">
                <span className="font-extrabold text-red-400">Error:</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {claimSuccess && (
              <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-xl flex flex-col gap-2">
                <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                  <CheckCircle size={14} /> Claim Submitted Successfully!
                </div>
                <p className="text-[10px] text-emerald-200/60 leading-relaxed">
                  Your claim transaction has been confirmed on the Base network. Add the token address to your wallet to view your balance.
                </p>
                {claimTxHash && (
                  <a
                    href={`${activeChainId === 84532 ? NETWORKS.BASE_SEPOLIA.blockExplorer : NETWORKS.BASE_MAINNET.blockExplorer}/tx/${claimTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-[var(--color-gold)] font-bold hover:underline w-max flex items-center gap-0.5"
                  >
                    View on Block Explorer <ArrowRight size={10} />
                  </a>
                )}
              </div>
            )}

            {/* Footer addresses info */}
            {addresses.quranToken && addresses.quranToken !== ethers.ZeroAddress && (
              <div className="border-t border-[#1b251d] pt-4 mt-2 flex flex-col gap-2">
                <div className="flex justify-between items-center text-[10px] text-[#8c6b4a]">
                  <span>Token Contract:</span>
                  <a
                    href={`${activeChainId === 84532 ? NETWORKS.BASE_SEPOLIA.blockExplorer : NETWORKS.BASE_MAINNET.blockExplorer}/token/${addresses.quranToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono hover:text-white hover:underline"
                  >
                    {addresses.quranToken}
                  </a>
                </div>
                {addresses.merkleAirdrop && addresses.merkleAirdrop !== ethers.ZeroAddress && (
                  <div className="flex justify-between items-center text-[10px] text-[#8c6b4a]">
                    <span>Airdrop Contract:</span>
                    <a
                      href={`${activeChainId === 84532 ? NETWORKS.BASE_SEPOLIA.blockExplorer : NETWORKS.BASE_MAINNET.blockExplorer}/address/${addresses.merkleAirdrop}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono hover:text-white hover:underline"
                    >
                      {addresses.merkleAirdrop}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Side panel: Check address & Eligibility Rules */}
        <div className="flex flex-col gap-4">
          {/* Eligibility Check Box */}
          <div className="glass-panel p-5 flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8c6b4a] flex items-center gap-1.5">
              <Search size={12} /> Check Any Address
            </h3>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                placeholder="0x..."
                className="flex-grow bg-[#010905]/60 border border-[#1b3022]/40 rounded-xl px-3 py-2 text-xs text-white placeholder-emerald-800/40 focus:outline-none focus:border-[var(--color-gold)]"
              />
              <button
                onClick={handleSearchCheck}
                className="gold-button px-3.5 text-xs font-bold"
              >
                Check
              </button>
            </div>

            {searchResult && searchResult.checked && (
              <div className="mt-2 p-3 bg-[#010c06] border border-emerald-950/40 rounded-xl">
                <div className="text-[10px] text-[#8c6b4a] truncate">Checking: {searchResult.address}</div>
                {searchResult.isEligible ? (
                  <div className="mt-2 flex flex-col gap-1">
                    <div className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle size={12} /> Eligible for Airdrop!
                    </div>
                    <div className="text-xs font-bold text-white mt-1">
                      Amount: {formatWeiToTokens(searchResult.amount)} QURAN
                    </div>
                    <div className="text-[9px] text-[#8c6b4a]">
                      Group: {searchResult.type}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-yellow-600 font-bold flex items-center gap-1">
                    <XCircle size={12} /> Not eligible or invalid address
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rules and FAQ */}
          <div className="glass-panel p-5 flex flex-col gap-4 text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8c6b4a] flex items-center gap-1.5">
              <HelpCircle size={12} /> Claim Instructions
            </h3>

            <ul className="space-y-3 text-[#8c6b4a]">
              <li className="flex gap-2">
                <span className="text-[var(--color-gold)] font-bold">1.</span>
                <span>Connect your wallet and switch to Base Network (Mainnet or Sepolia).</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--color-gold)] font-bold">2.</span>
                <span>Verify that your address shows "Eligible" under the Airdrop Claim Portal.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--color-gold)] font-bold">3.</span>
                <span>Click "Claim Rewards" and submit the claim transaction (will require negligible gas in ETH on Base).</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--color-gold)] font-bold">4.</span>
                <span>Once the transaction is confirmed, the tokens will be directly in your wallet.</span>
              </li>
            </ul>

            <div className="h-[1px] bg-[#1b251d]"></div>

            <div className="text-[9px] text-[#6b5436] leading-relaxed">
              * Note: The tokens can only be claimed once per address. Unclaimed tokens can be withdrawn by the owner after the conclusion of the reward distribution phase.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
