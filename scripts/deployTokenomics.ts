import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 1. Deploy the Quran Token
  // Supply: 1,000,000,000 (1 Billion)
  const initialSupply = ethers.parseUnits("1000000000", 18);
  const QuranToken = await ethers.getContractFactory("QuranToken");
  const quranToken = await QuranToken.deploy(
    "Onchain Quran",
    "QURAN",
    initialSupply,
    deployer.address
  );
  await quranToken.waitForDeployment();
  const tokenAddress = await quranToken.getAddress();
  console.log("QuranToken deployed to:", tokenAddress);

  // 2. Calculate the lock parameters
  // 90% of supply = 900,000,000
  const lockedAmount = ethers.parseUnits("900000000", 18);
  
  // 2 years from now in seconds
  const twoYearsInSeconds = 2 * 365 * 24 * 60 * 60;
  const latestBlock = await ethers.provider.getBlock("latest");
  const currentTimestamp = latestBlock ? latestBlock.timestamp : Math.floor(Date.now() / 1000);
  const releaseTime = currentTimestamp + twoYearsInSeconds;

  console.log("Current Timestamp:", currentTimestamp);
  console.log("Release Time (2 years later):", releaseTime);

  // 3. Deploy the TokenLocker
  const TokenLocker = await ethers.getContractFactory("TokenLocker");
  const tokenLocker = await TokenLocker.deploy(
    tokenAddress,
    releaseTime,
    deployer.address
  );
  await tokenLocker.waitForDeployment();
  const lockerAddress = await tokenLocker.getAddress();
  console.log("TokenLocker deployed to:", lockerAddress);

  // 3.5 Exclude Locker from fees
  console.log("Excluding TokenLocker from transaction fees...");
  const excludeTx = await quranToken.setExcludeFromFee(lockerAddress, true);
  await excludeTx.wait();

  // 4. Transfer the 90% supply to the locker
  console.log("Transferring 900,000,000 QURAN to TokenLocker...");
  const tx = await quranToken.transfer(lockerAddress, lockedAmount);
  await tx.wait();
  console.log("Transfer successful! 90% of tokens are now locked for 2 years.");

  // 5. Final balances info
  const lockerBalance = await quranToken.balanceOf(lockerAddress);
  const deployerBalance = await quranToken.balanceOf(deployer.address);
  
  console.log("=========================================");
  console.log("TOKENOMICS DISTRIBUTION SUMMARY:");
  console.log("Locked (90%):", ethers.formatUnits(lockerBalance, 18), "QURAN");
  console.log("Circulating & Airdrop Wallet (10%):", ethers.formatUnits(deployerBalance, 18), "QURAN");
  console.log("=========================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
