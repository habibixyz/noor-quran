import { expect } from "chai";
import { ethers } from "hardhat";
import { OnchainQuran } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("OnchainQuran", function () {
  let onchainQuran: OnchainQuran;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const OnchainQuranFactory = await ethers.getContractFactory("OnchainQuran");
    onchainQuran = (await OnchainQuranFactory.deploy()) as OnchainQuran;
    await onchainQuran.waitForDeployment();

    // Initialize a few sample Surahs for testing
    // Surah 1: Al-Fatihah, Surah 112: Al-Ikhlas
    const indices = [1, 112];
    const names = ["الفاتحة", "الإخلاص"];
    const englishNames = ["Al-Fatihah", "Al-Ikhlas"];
    const verseCounts = [7, 4];
    const revelationTypes = ["Meccan", "Meccan"];
    const hashes = [
      ethers.keccak256(ethers.toUtf8Bytes("1-الفاتحة-Al-Fatihah-7-Meccan")),
      ethers.keccak256(ethers.toUtf8Bytes("112-الإخلاص-Al-Ikhlas-4-Meccan")),
    ];

    await onchainQuran.initializeSurahsBatch(
      indices,
      names,
      englishNames,
      verseCounts,
      revelationTypes,
      hashes
    );

    await onchainQuran.setInitialized();
  });

  describe("Deployment & Initialization", function () {
    it("Should set the right owner", async function () {
      expect(await onchainQuran.owner()).to.equal(owner.address);
    });

    it("Should correctly initialize Surah metadata", async function () {
      const surah1 = await onchainQuran.getSurah(1);
      expect(surah1.index).to.equal(1);
      expect(surah1.name).to.equal("الفاتحة");
      expect(surah1.englishName).to.equal("Al-Fatihah");
      expect(surah1.verseCount).to.equal(7);
      expect(surah1.revelationType).to.equal("Meccan");
      expect(surah1.guardian).to.equal(ethers.ZeroAddress);
    });

    it("Should prevent duplicate initialization if initialized flag is set", async function () {
      expect(await onchainQuran.isInitialized()).to.equal(true);
      await expect(
        onchainQuran.initializeSurahsBatch([], [], [], [], [], [])
      ).to.be.revertedWith("Metadata already fully initialized");
    });
  });

  describe("Sponsorship & Guardianship", function () {
    it("Should allow a user to sponsor a Surah with minimum ETH", async function () {
      const minAmount = await onchainQuran.minSponsorshipAmount();
      
      await expect(
        onchainQuran.connect(addr1).sponsorSurah(1, { value: minAmount })
      )
        .to.emit(onchainQuran, "SurahSponsored")
        .withArgs(addr1.address, 1, minAmount);

      const surah1 = await onchainQuran.getSurah(1);
      expect(surah1.guardian).to.equal(addr1.address);
      expect(surah1.sponsorshipAmount).to.equal(minAmount);
      expect(await onchainQuran.ownerOf(1)).to.equal(addr1.address);
    });

    it("Should prevent sponsoring with less than minimum amount", async function () {
      const minAmount = await onchainQuran.minSponsorshipAmount();
      const lowerAmount = minAmount - ethers.parseEther("0.0005");

      await expect(
        onchainQuran.connect(addr1).sponsorSurah(1, { value: lowerAmount })
      ).to.be.revertedWith("Contribution below minimum threshold");
    });

    it("Should transfer guardianship to a new top sponsor and transfer the NFT", async function () {
      const minAmount = await onchainQuran.minSponsorshipAmount();

      // addr1 sponsors Surah 1 first
      await onchainQuran.connect(addr1).sponsorSurah(1, { value: minAmount });
      expect(await onchainQuran.ownerOf(1)).to.equal(addr1.address);

      // addr2 sponsors Surah 1 with a higher contribution
      const higherAmount = minAmount + ethers.parseEther("0.002");
      await onchainQuran.connect(addr2).sponsorSurah(1, { value: higherAmount });

      // addr2 should now hold the NFT and be the guardian
      const surah1 = await onchainQuran.getSurah(1);
      expect(surah1.guardian).to.equal(addr2.address);
      expect(surah1.sponsorshipAmount).to.equal(minAmount + higherAmount);
      expect(await onchainQuran.ownerOf(1)).to.equal(addr2.address);
    });

    it("Should generate a valid on-chain SVG metadata URI", async function () {
      const minAmount = await onchainQuran.minSponsorshipAmount();
      await onchainQuran.connect(addr1).sponsorSurah(1, { value: minAmount });

      const tokenUri = await onchainQuran.tokenURI(1);
      expect(tokenUri).to.have.string("data:application/json;base64,");

      // Verify the SVG content can be generated
      const svg = await onchainQuran.generateSVG(1);
      expect(svg).to.contain("<svg");
      expect(svg).to.contain("Al-Fatihah");
      expect(svg).to.contain("الفاتحة");
    });
  });

  describe("Charity Withdrawal", function () {
    it("Should allow the owner to withdraw sponsorship donations", async function () {
      const minAmount = await onchainQuran.minSponsorshipAmount();
      await onchainQuran.connect(addr1).sponsorSurah(1, { value: minAmount });

      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
      
      const tx = await onchainQuran.connect(owner).withdrawSadaqah();
      const receipt = await tx.wait();
      
      const gasUsed = receipt ? receipt.gasUsed * receipt.gasPrice : 0n;
      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);

      expect(finalOwnerBalance + gasUsed - initialOwnerBalance).to.equal(minAmount);
    });

    it("Should prevent non-owners from withdrawing funds", async function () {
      await expect(
        onchainQuran.connect(addr1).withdrawSadaqah()
      ).to.be.reverted; // Reverted due to Ownable restriction
    });
  });
});
