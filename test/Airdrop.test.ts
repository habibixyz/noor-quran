import { expect } from "chai";
import { ethers } from "hardhat";
import { QuranToken, MerkleAirdrop } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { hashLeaf, hashPair, buildMerkleTree, getProof } from "../scripts/generateAirdrop";

describe("QuranToken and MerkleAirdrop", function () {
  let quranToken: QuranToken;
  let merkleAirdrop: MerkleAirdrop;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  const INITIAL_SUPPLY = ethers.parseEther("1000000000"); // 1 billion tokens
  const CLAIM_AMOUNT = ethers.parseEther("100000"); // 100k tokens

  let distribution: { address: string; amount: string }[] = [];
  let leaves: string[] = [];
  let levels: string[][] = [];
  let merkleRoot: string;

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    // 1. Deploy QuranToken
    const QuranTokenFactory = await ethers.getContractFactory("QuranToken");
    quranToken = (await QuranTokenFactory.deploy(
      "Onchain Quran Token",
      "QURAN",
      INITIAL_SUPPLY,
      owner.address
    )) as QuranToken;
    await quranToken.waitForDeployment();

    // 2. Setup Airdrop data for our test users
    distribution = [
      { address: user1.address, amount: CLAIM_AMOUNT.toString() },
      { address: user2.address, amount: CLAIM_AMOUNT.toString() }
    ];

    // Sort by address to remain consistent
    distribution.sort((a, b) => a.address.toLowerCase().localeCompare(b.address.toLowerCase()));

    // Generate leaves, tree, and root
    leaves = distribution.map(d => hashLeaf(d.address, d.amount));
    levels = buildMerkleTree(leaves);
    merkleRoot = levels[levels.length - 1][0];

    // 3. Deploy MerkleAirdrop
    const MerkleAirdropFactory = await ethers.getContractFactory("MerkleAirdrop");
    merkleAirdrop = (await MerkleAirdropFactory.deploy(
      await quranToken.getAddress(),
      merkleRoot
    )) as MerkleAirdrop;
    await merkleAirdrop.waitForDeployment();

    // 4. Fund the MerkleAirdrop contract with some QURAN tokens
    const fundingAmount = CLAIM_AMOUNT * 2n; // 200k tokens
    await quranToken.transfer(await merkleAirdrop.getAddress(), fundingAmount);
  });

  describe("Token Deployment", function () {
    it("Should deploy with correct details", async function () {
      expect(await quranToken.name()).to.equal("Onchain Quran Token");
      expect(await quranToken.symbol()).to.equal("QURAN");
      expect(await quranToken.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await quranToken.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY - CLAIM_AMOUNT * 2n);
    });
  });

  describe("Airdrop Claiming", function () {
    it("Should allow valid user to claim successfully", async function () {
      // Find user1 in the distribution
      const index = distribution.findIndex(d => d.address === user1.address);
      const proof = getProof(levels, index);

      const balanceBefore = await quranToken.balanceOf(user1.address);
      expect(balanceBefore).to.equal(0n);

      await expect(
        merkleAirdrop.claim(user1.address, CLAIM_AMOUNT, proof)
      )
        .to.emit(merkleAirdrop, "Claimed")
        .withArgs(user1.address, CLAIM_AMOUNT);

      const balanceAfter = await quranToken.balanceOf(user1.address);
      expect(balanceAfter).to.equal(CLAIM_AMOUNT);
      expect(await merkleAirdrop.hasClaimed(user1.address)).to.equal(true);
    });

    it("Should prevent duplicate claims", async function () {
      const index = distribution.findIndex(d => d.address === user1.address);
      const proof = getProof(levels, index);

      // Claim first time
      await merkleAirdrop.claim(user1.address, CLAIM_AMOUNT, proof);

      // Try to claim again
      await expect(
        merkleAirdrop.claim(user1.address, CLAIM_AMOUNT, proof)
      ).to.be.revertedWith("Airdrop already claimed");
    });

    it("Should prevent claiming with invalid proof", async function () {
      const index = distribution.findIndex(d => d.address === user1.address);
      const proof = getProof(levels, index);

      // Try to claim for user2 using user1's proof
      await expect(
        merkleAirdrop.claim(user2.address, CLAIM_AMOUNT, proof)
      ).to.be.revertedWith("Invalid Merkle proof");
    });

    it("Should prevent claiming with invalid amount", async function () {
      const index = distribution.findIndex(d => d.address === user1.address);
      const proof = getProof(levels, index);

      // Try to claim a different amount using the original proof
      await expect(
        merkleAirdrop.claim(user1.address, CLAIM_AMOUNT + 1000n, proof)
      ).to.be.revertedWith("Invalid Merkle proof");
    });

    it("Should prevent claiming for non-eligible user", async function () {
      const index = distribution.findIndex(d => d.address === user1.address);
      const proof = getProof(levels, index);

      // User3 is not in the tree, should fail
      await expect(
        merkleAirdrop.claim(user3.address, CLAIM_AMOUNT, proof)
      ).to.be.revertedWith("Invalid Merkle proof");
    });
  });

  describe("Owner Operations", function () {
    it("Should allow owner to withdraw unclaimed tokens", async function () {
      const contractAddress = await merkleAirdrop.getAddress();
      const balanceBefore = await quranToken.balanceOf(owner.address);
      const contractBalance = await quranToken.balanceOf(contractAddress);

      expect(contractBalance).to.equal(CLAIM_AMOUNT * 2n);

      await expect(merkleAirdrop.connect(owner).withdrawUnclaimed(CLAIM_AMOUNT))
        .to.emit(merkleAirdrop, "UnclaimedTokensWithdrawn")
        .withArgs(owner.address, CLAIM_AMOUNT);

      expect(await quranToken.balanceOf(contractAddress)).to.equal(CLAIM_AMOUNT);
      expect(await quranToken.balanceOf(owner.address)).to.equal(balanceBefore + CLAIM_AMOUNT);
    });

    it("Should prevent non-owners from withdrawing unclaimed tokens", async function () {
      await expect(
        merkleAirdrop.connect(user1).withdrawUnclaimed(CLAIM_AMOUNT)
      ).to.be.reverted; // Reverted due to Ownable restriction
    });

    it("Should allow owner to update Merkle Root", async function () {
      const newRoot = ethers.zeroPadValue("0x1234", 32);
      await expect(merkleAirdrop.connect(owner).setMerkleRoot(newRoot))
        .to.emit(merkleAirdrop, "MerkleRootUpdated")
        .withArgs(merkleRoot, newRoot);

      expect(await merkleAirdrop.merkleRoot()).to.equal(newRoot);
    });
  });
});
