import { ethers } from "hardhat";
import { quranMetadataList } from "./quranMetadata";

async function main() {
  console.log("====================================================");
  console.log("Starting Onchain Quran Contract Deployment on Base");
  console.log("====================================================");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);
  
  const balanceBefore = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balanceBefore), "ETH");

  // 1. Deploy the contract
  const OnchainQuranFactory = await ethers.getContractFactory("OnchainQuran");
  console.log("Deploying OnchainQuran contract...");
  const onchainQuran = await OnchainQuranFactory.deploy();
  await onchainQuran.waitForDeployment();
  const contractAddress = await onchainQuran.getAddress();
  
  console.log("✔ OnchainQuran contract deployed successfully!");
  console.log("Contract Address:", contractAddress);

  // 2. Initialize Surah Metadata in Batches to avoid block gas limit issues
  console.log("\nInitializing 114 Surahs' metadata on-chain...");
  const batchSize = 15;
  const totalSurahs = quranMetadataList.length;

  for (let i = 0; i < totalSurahs; i += batchSize) {
    const batch = quranMetadataList.slice(i, i + batchSize);
    
    const indices: number[] = [];
    const names: string[] = [];
    const englishNames: string[] = [];
    const verseCounts: number[] = [];
    const revelationTypes: string[] = [];
    const hashes: string[] = [];

    for (const s of batch) {
      indices.push(s.index);
      names.push(s.name);
      englishNames.push(s.englishName);
      verseCounts.push(s.verses);
      revelationTypes.push(s.type);
      hashes.push(s.hash);
    }

    console.log(`Sending batch ${Math.floor(i / batchSize) + 1}... Surahs ${indices[0]} to ${indices[indices.length - 1]}`);
    
    const tx = await onchainQuran.initializeSurahsBatch(
      indices,
      names,
      englishNames,
      verseCounts,
      revelationTypes,
      hashes
    );
    await tx.wait();
    console.log(`✔ Batch ${Math.floor(i / batchSize) + 1} confirmed!`);
  }

  // 3. Mark initialization as complete
  console.log("\nFinalizing initialization...");
  const finalizeTx = await onchainQuran.setInitialized();
  await finalizeTx.wait();
  console.log("✔ Contract marked as fully initialized!");

  const balanceAfter = await deployer.provider.getBalance(deployer.address);
  const gasSpent = balanceBefore - balanceAfter;
  console.log("\nDeployment stats:");
  console.log("- Total Sepolia ETH spent:", ethers.formatEther(gasSpent), "ETH");
  console.log("====================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
