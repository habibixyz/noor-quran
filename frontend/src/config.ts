// Configuration for smart contracts and networks

// Base Network Chain Details
export const NETWORKS = {
  BASE_MAINNET: {
    chainId: 8453,
    chainIdHex: "0x2105",
    name: "Base Mainnet",
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
    symbol: "ETH",
  },
  BASE_SEPOLIA: {
    chainId: 84532,
    chainIdHex: "0x14a34",
    name: "Base Sepolia Testnet",
    rpcUrl: "https://sepolia.base.org",
    blockExplorer: "https://sepolia.basescan.org",
    symbol: "ETH",
  }
};

// Configured contract addresses (Change these after deploying)
export const CONTRACT_ADDRESSES = {
  // Base Mainnet
  [NETWORKS.BASE_MAINNET.chainId]: {
    sadaqahZakat: "0x6361faeDBFaBcC3bD724046fAa42790535CDd99d", // Newly deployed mainnet address
    noorQuran: "0x40f78dA66783aa52495Ec922053D0a0fAAf4b28F"  // Newly deployed mainnet address
  },
  // Base Sepolia Testnet
  [NETWORKS.BASE_SEPOLIA.chainId]: {
    sadaqahZakat: "0x264369B78a524D7dBa79f496B5541603Cc8d6DF0", // Replace with your Sepolia deployed address
    noorQuran: "0xF2e391F09943B20e6fC3A7A40723A1aC9C0Dbf8a"  // Replace with your Sepolia deployed address
  }
};

// Default fallback chain in case wallet is disconnected
export const DEFAULT_CHAIN_ID = NETWORKS.BASE_MAINNET.chainId;

export const PAYPAL_CLIENT_ID = "Ac6_JxwBDHJKbgR6KYZGxMjWisowyEYf8yNitdBpCQzoRH-oZS5eKAWuPwTnjcC60ptJOD4qkg8_5aLh";

// ABI definitions
export const SADAQAH_ZAKAT_ABI = [
  "function donateSadaqah() external payable",
  "function donateZakat() external payable",
  "function totalSadaqah() external view returns (uint256)",
  "function totalZakat() external view returns (uint256)",
  "function totalDonationsCount() external view returns (uint256)",
  "function totalDonorsCount() external view returns (uint256)",
  "function totalAccumulated() external view returns (uint256)",
  "function getRecentDonations(uint256 count) external view returns (tuple(address donor, uint256 amount, uint256 timestamp, bool isZakat)[])",
  "event Donated(address indexed donor, uint256 amount, bool indexed isZakat, uint256 timestamp)"
];

export const NOOR_QURAN_ABI = [
  "function getSurah(uint256 surahId) external view returns (uint16, string, string, uint16, string, bytes32, address, uint256)",
  "function totalSadaqahRaised() external view returns (uint256)"
];
