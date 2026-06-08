import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("====================================================");
  console.log("Starting QuranToken & MerkleAirdrop Deployment on Base");
  console.log("====================================================");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);
  
  const balanceBefore = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balanceBefore), "ETH");

  // Load Merkle Root from generated distribution file
  const distributionPath = path.join(__dirname, "../airdrop_distribution.json");
  if (!fs.existsSync(distributionPath)) {
    throw new Error("Airdrop distribution JSON not found! Please run generateAirdrop first.");
  }
  const distribution = JSON.parse(fs.readFileSync(distributionPath, "utf-8"));
  const merkleRoot = distribution.merkleRoot;
  const airdropSupply = distribution.totalClaimable;

  console.log(`Merkle Root loaded: ${merkleRoot}`);
  console.log(`Airdrop supply to fund: ${ethers.formatEther(airdropSupply)} QURAN`);

  // 1. Deploy QuranToken
  const QuranTokenFactory = await ethers.getContractFactory("QuranToken");
  console.log("\nDeploying QuranToken...");
  const initialSupply = ethers.parseEther("1000000000"); // 1 billion tokens
  const quranToken = await QuranTokenFactory.deploy(
    "Onchain Quran Token",
    "QURAN",
    initialSupply,
    deployer.address
  );
  await quranToken.waitForDeployment();
  const tokenAddress = await quranToken.getAddress();
  console.log(`✔ QuranToken deployed successfully! Address: ${tokenAddress}`);

  // 2. Deploy MerkleAirdrop
  const MerkleAirdropFactory = await ethers.getContractFactory("MerkleAirdrop");
  console.log("\nDeploying MerkleAirdrop...");
  const merkleAirdrop = await MerkleAirdropFactory.deploy(tokenAddress, merkleRoot);
  await merkleAirdrop.waitForDeployment();
  const airdropAddress = await merkleAirdrop.getAddress();
  console.log(`✔ MerkleAirdrop deployed successfully! Address: ${airdropAddress}`);

  // 3. Fund MerkleAirdrop contract with 10% supply
  console.log(`\nFunding MerkleAirdrop contract with airdrop supply...`);
  const transferTx = await quranToken.transfer(airdropAddress, airdropSupply);
  await transferTx.wait();
  console.log(`✔ Transferred ${ethers.formatEther(airdropSupply)} QURAN tokens to MerkleAirdrop contract!`);

  // Verify balances
  const airdropBalance = await quranToken.balanceOf(airdropAddress);
  const deployerBalance = await quranToken.balanceOf(deployer.address);
  console.log("\nBalances verification:");
  console.log(`- MerkleAirdrop Balance: ${ethers.formatEther(airdropBalance)} QURAN`);
  console.log(`- Deployer Balance: ${ethers.formatEther(deployerBalance)} QURAN`);

  const balanceAfter = await deployer.provider.getBalance(deployer.address);
  const gasSpent = balanceBefore - balanceAfter;
  console.log("\nDeployment stats:");
  console.log("- Total gas spent:", ethers.formatEther(gasSpent), "ETH");
  console.log("====================================================");

  // Print helpful command line updates to verify/deploy
  console.log("\nTo verify on Block Explorer, use:");
  console.log(`npx hardhat verify --network <network-name> ${tokenAddress} "Onchain Quran Token" "QURAN" "${initialSupply}" "${deployer.address}"`);
  console.log(`npx hardhat verify --network <network-name> ${airdropAddress} "${tokenAddress}" "${merkleRoot}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
