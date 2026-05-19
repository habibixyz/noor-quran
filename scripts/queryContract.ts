import { ethers } from "hardhat";

async function main() {
  const mainnetAddress = "0x6361faeDBFaBcC3bD724046fAa42790535CDd99d";
  const sepoliaAddress = "0x264369B78a524D7dBa79f496B5541603Cc8d6DF0";

  const networkName = hre.network.name;
  const rawAddress = networkName === "base" ? mainnetAddress : sepoliaAddress;
  const address = rawAddress.toLowerCase();

  console.log(`Querying on network: ${networkName} at address: ${address}`);

  const contract = await ethers.getContractAt("SadaqahZakat", address);

  const totalSadaqah = await contract.totalSadaqah();
  const totalZakat = await contract.totalZakat();
  const totalAccumulated = await contract.totalAccumulated();
  const totalDonationsCount = await contract.totalDonationsCount();
  const totalDonorsCount = await contract.totalDonorsCount();

  console.log("----------------------------------------");
  console.log(`totalSadaqah: ${totalSadaqah.toString()} wei (${ethers.formatEther(totalSadaqah)} ETH)`);
  console.log(`totalZakat: ${totalZakat.toString()} wei (${ethers.formatEther(totalZakat)} ETH)`);
  console.log(`totalAccumulated: ${totalAccumulated.toString()} wei (${ethers.formatEther(totalAccumulated)} ETH)`);
  console.log(`totalDonationsCount: ${totalDonationsCount.toString()}`);
  console.log(`totalDonorsCount: ${totalDonorsCount.toString()}`);
  console.log("----------------------------------------");

  try {
    const recent = await contract.getRecentDonations(6);
    console.log("Recent Donations:");
    for (let i = 0; i < recent.length; i++) {
      console.log(`  Donation ${i + 1}:`);
      console.log(`    donor: ${recent[i].donor}`);
      console.log(`    amount: ${recent[i].amount.toString()} wei (${ethers.formatEther(recent[i].amount)} ETH)`);
      console.log(`    timestamp: ${new Date(Number(recent[i].timestamp) * 1000).toLocaleString()}`);
      console.log(`    isZakat: ${recent[i].isZakat}`);
    }
  } catch (e) {
    console.log("Failed to get recent donations:", e);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
