import { ethers } from "hardhat";

async function main() {
  console.log("====================================================");
  console.log("Starting Sadaqah & Zakat Contract Deployment on Base");
  console.log("====================================================");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);
  
  const balanceBefore = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balanceBefore), "ETH");

  // Deploy the contract
  const SadaqahZakatFactory = await ethers.getContractFactory("SadaqahZakat");
  console.log("Deploying SadaqahZakat contract...");
  const sadaqahZakat = await SadaqahZakatFactory.deploy();
  await sadaqahZakat.waitForDeployment();
  const contractAddress = await sadaqahZakat.getAddress();
  
  console.log("✔ SadaqahZakat contract deployed successfully!");
  console.log("Contract Address:", contractAddress);

  const balanceAfter = await deployer.provider.getBalance(deployer.address);
  const gasSpent = balanceBefore - balanceAfter;
  console.log("\nDeployment stats:");
  console.log("- Total ETH spent:", ethers.formatEther(gasSpent), "ETH");
  console.log("====================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
