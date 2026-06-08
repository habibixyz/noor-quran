import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Leaf hashing function (must match Solidity keccak256(abi.encodePacked(address, amount)))
export function hashLeaf(address: string, amount: string): string {
  return ethers.solidityPackedKeccak256(
    ["address", "uint256"],
    [address, amount]
  );
}

// Parent hashing function (must sort children to prevent order dependence)
export function hashPair(left: string, right: string): string {
  return left < right
    ? ethers.solidityPackedKeccak256(["bytes32", "bytes32"], [left, right])
    : ethers.solidityPackedKeccak256(["bytes32", "bytes32"], [right, left]);
}

// Build the tree and return the levels
export function buildMerkleTree(leaves: string[]): string[][] {
  let levels: string[][] = [leaves];
  while (levels[levels.length - 1].length > 1) {
    const currentLevel = levels[levels.length - 1];
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        nextLevel.push(hashPair(currentLevel[i], currentLevel[i + 1]));
      } else {
        nextLevel.push(currentLevel[i]);
      }
    }
    levels.push(nextLevel);
  }
  return levels;
}

// Get the proof for a leaf index
export function getProof(levels: string[][], index: number): string[] {
  const proof: string[] = [];
  let currentIndex = index;
  for (let i = 0; i < levels.length - 1; i++) {
    const level = levels[i];
    const isRightNode = currentIndex % 2 === 1;
    const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
    if (siblingIndex < level.length) {
      proof.push(level[siblingIndex]);
    }
    currentIndex = Math.floor(currentIndex / 2);
  }
  return proof;
}

async function main() {
  console.log("Generating Airdrop Distribution...");

  const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
  let deployerAddress = "";
  if (deployerPrivateKey) {
    try {
      const wallet = new ethers.Wallet(deployerPrivateKey);
      deployerAddress = wallet.address;
      console.log(`Loaded deployer address from .env: ${deployerAddress}`);
    } catch (e) {
      console.log("Failed to load deployer address from .env, using default.");
    }
  }

  // Define eligible addresses (Farcaster & Base app users)
  // We will generate 1000 addresses in total.
  // Each user gets 100,000 QURAN tokens.
  const airdropAmount = ethers.parseEther("100000").toString(); // 100k tokens in wei
  
  const distribution: { address: string; amount: string; type: string }[] = [];

  // Add deployer address if available
  if (deployerAddress) {
    distribution.push({
      address: ethers.getAddress(deployerAddress.toLowerCase()),
      amount: airdropAmount,
      type: "Deployer Wallet (Testing)"
    });
  }

  // Add some known test addresses (e.g. Hardhat Signers)
  const hardhatTestAddresses = [
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Hardhat #0
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Hardhat #1
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Hardhat #2
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906", // Hardhat #3
    "0x15d34AAf54a67C64304717ffb9240263f02543e4", // Hardhat #4
  ];

  for (const addr of hardhatTestAddresses) {
    if (addr.toLowerCase() !== deployerAddress.toLowerCase()) {
      distribution.push({
        address: ethers.getAddress(addr.toLowerCase()),
        amount: airdropAmount,
        type: "Test Wallet"
      });
    }
  }

  // Neynar API & Base RPC verification for real active users
  const neynarApiKey = process.env.NEYNAR_API_KEY;
  const totalUsers = 1000;

  if (neynarApiKey) {
    console.log("Neynar API Key detected. Fetching real active Farcaster users...");
    
    // Connect to Base RPC provider to verify activity on Base
    let baseProvider: ethers.JsonRpcProvider | null = null;
    try {
      baseProvider = new ethers.JsonRpcProvider("https://mainnet.base.org");
      console.log("Connected to Base RPC for activity filtering.");
    } catch (e) {
      console.warn("Failed to connect to Base RPC. Will skip Base activity check.");
    }

    let cursor = "";
    let fetchIteration = 0;
    const processedFids = new Set<number>();

    // Query trending Farcaster creators who are active
    while (distribution.length < totalUsers && fetchIteration < 15) {
      try {
        const url = `https://api.neynar.com/v2/farcaster/feed?feed_type=filter&filter_type=global-trending&limit=100${cursor ? `&cursor=${cursor}` : ""}`;
        const response = await fetch(url, {
          headers: {
            "accept": "application/json",
            "x-api-key": neynarApiKey,
            "api_key": neynarApiKey
          }
        });

        if (!response.ok) {
          console.error(`Neynar API request failed with status: ${response.status}`);
          break;
        }

        const data: any = await response.json();
        const casts = data.casts || [];
        cursor = data.next?.cursor || "";

        if (casts.length === 0) break;

        for (const cast of casts) {
          if (distribution.length >= totalUsers) break;

          const author = cast.author;
          if (!author || processedFids.has(author.fid)) continue;
          processedFids.add(author.fid);

          const ethAddresses: string[] = author.verified_addresses?.eth_addresses || author.verifications || [];
          if (ethAddresses.length > 0) {
            const targetAddress = ethAddresses[0];
            try {
              let hasBaseActivity = true;
              let isContract = false;
              
              if (baseProvider) {
                // EOA Check: If the address has code deployed, it's a smart contract/multisig
                const code = await baseProvider.getCode(targetAddress);
                isContract = code !== "0x" && code !== "0x00";

                const txCount = await baseProvider.getTransactionCount(targetAddress);
                const balance = await baseProvider.getBalance(targetAddress);
                hasBaseActivity = txCount > 0 || balance > 0n;
              }

              if (hasBaseActivity && !isContract) {
                // Filter out obvious company, token, support, bot, or community accounts based on username keywords
                const usernameLower = author.username.toLowerCase();
                const isCompanyOrBot = /bot|xyz|capital|foundry|wallet|token|app|protocol|support|admin|team|pool|dao|official|foundation/.test(usernameLower);

                if (!isCompanyOrBot) {
                  distribution.push({
                    address: ethers.getAddress(targetAddress.toLowerCase()),
                    amount: airdropAmount,
                    type: `Farcaster (FID ${author.fid}) - Base Active EOA`
                  });
                  console.log(`✔ Added real Farcaster EOA user: @${author.username} (FID: ${author.fid}) -> ${targetAddress}`);
                } else {
                  console.log(`✕ Filtered out company/bot account: @${author.username} (FID: ${author.fid})`);
                }
              } else if (isContract) {
                console.log(`✕ Filtered out smart contract/multisig: ${targetAddress} (FID: ${author.fid})`);
              }
            } catch (err) {
              // Fall back to adding the address if RPC check fails, but apply basic username check
              const usernameLower = author.username.toLowerCase();
              const isCompanyOrBot = /bot|xyz|capital|foundry|wallet|token|app|protocol|support|admin|team|pool|dao|official|foundation/.test(usernameLower);
              
              if (!isCompanyOrBot) {
                distribution.push({
                  address: ethers.getAddress(targetAddress.toLowerCase()),
                  amount: airdropAmount,
                  type: `Farcaster (FID ${author.fid})`
                });
              }
            }
          }
        }

        fetchIteration++;
        if (!cursor) break;
      } catch (err) {
        console.error("Error fetching from Neynar API:", err);
        break;
      }
    }
  }

  // Generate mock Farcaster and Base active users to make up 1000 users if needed
  const remainingCount = totalUsers - distribution.length;
  if (remainingCount > 0) {
    console.log(`Generating ${remainingCount} fallback mock active Farcaster/Base addresses...`);

    for (let i = 0; i < remainingCount; i++) {
      // Generate deterministic addresses for repeatability based on a seed hash
      const seed = ethers.keccak256(ethers.toUtf8Bytes(`farcaster-user-seed-${i}`));
      const wallet = new ethers.Wallet(seed);
      
      distribution.push({
        address: ethers.getAddress(wallet.address.toLowerCase()),
        amount: airdropAmount,
        type: i % 2 === 0 ? "Farcaster User" : "Base App User"
      });
    }
  }

  // Sort distribution alphabetically by address to ensure deterministic leaf indexes
  distribution.sort((a, b) => a.address.toLowerCase().localeCompare(b.address.toLowerCase()));

  // Generate leaves
  const leaves = distribution.map(d => hashLeaf(d.address, d.amount));

  // Build tree
  const levels = buildMerkleTree(leaves);
  const root = levels[levels.length - 1][0];

  console.log(`\nMerkle Root: ${root}`);
  console.log(`Total Airdrop Supply Required: ${ethers.formatEther(BigInt(airdropAmount) * BigInt(totalUsers))} QURAN`);

  // Build claims object
  const claims: { [address: string]: { amount: string; index: number; proof: string[]; type: string } } = {};
  for (let i = 0; i < distribution.length; i++) {
    const item = distribution[i];
    const proof = getProof(levels, i);
    claims[item.address.toLowerCase()] = {
      amount: item.amount,
      index: i,
      proof: proof,
      type: item.type
    };
  }

  const outputData = {
    merkleRoot: root,
    tokenName: "Onchain Quran Token",
    tokenSymbol: "QURAN",
    totalClaimable: (BigInt(airdropAmount) * BigInt(totalUsers)).toString(),
    claims: claims
  };

  // Write JSON to frontend data folder
  const frontendDataDir = path.join(__dirname, "../frontend/src/data");
  if (!fs.existsSync(frontendDataDir)) {
    fs.mkdirSync(frontendDataDir, { recursive: true });
  }
  const frontendPath = path.join(frontendDataDir, "airdrop.json");
  fs.writeFileSync(frontendPath, JSON.stringify(outputData, null, 2));
  console.log(`✔ Saved airdrop proofs to frontend: ${frontendPath}`);

  // Write JSON to backend folder
  const backendDir = path.join(__dirname, "../backend");
  if (fs.existsSync(backendDir)) {
    const backendPath = path.join(backendDir, "airdrop.json");
    fs.writeFileSync(backendPath, JSON.stringify(outputData, null, 2));
    console.log(`✔ Saved airdrop proofs to backend: ${backendPath}`);
  }

  // Also write to root directory for easy access
  const rootPath = path.join(__dirname, "../airdrop_distribution.json");
  fs.writeFileSync(rootPath, JSON.stringify(outputData, null, 2));
  console.log(`✔ Saved airdrop proofs to root: ${rootPath}`);

  console.log("Airdrop generation complete!");
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
