import { expect } from "chai";
import { ethers } from "hardhat";
import { NoorQuran } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("NoorQuran", function () {
  let noorQuran: NoorQuran;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const NoorQuranFactory = await ethers.getContractFactory("NoorQuran");
    noorQuran = (await NoorQuranFactory.deploy()) as NoorQuran;
    await noorQuran.waitForDeployment();

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

    await noorQuran.initializeSurahsBatch(
      indices,
      names,
      englishNames,
      verseCounts,
      revelationTypes,
      hashes
    );

    await noorQuran.setInitialized();
  });

  describe("Deployment & Initialization", function () {
    it("Should set the right owner", async function () {
      expect(await noorQuran.owner()).to.equal(owner.address);
    });

    it("Should correctly initialize Surah metadata", async function () {
      const surah1 = await noorQuran.getSurah(1);
      expect(surah1.index).to.equal(1);
      expect(surah1.name).to.equal("الفاتحة");
      expect(surah1.englishName).to.equal("Al-Fatihah");
      expect(surah1.verseCount).to.equal(7);
      expect(surah1.revelationType).to.equal("Meccan");
      expect(surah1.guardian).to.equal(ethers.ZeroAddress);
    });

    it("Should prevent duplicate initialization if initialized flag is set", async function () {
      expect(await noorQuran.isInitialized()).to.equal(true);
      await expect(
        noorQuran.initializeSurahsBatch([], [], [], [], [], [])
      ).to.be.revertedWith("Metadata already fully initialized");
    });
  });

  describe("Sponsorship & Guardianship", function () {
    it("Should allow a user to sponsor a Surah with minimum ETH", async function () {
      const minAmount = await noorQuran.minSponsorshipAmount();
      
      await expect(
        noorQuran.connect(addr1).sponsorSurah(1, { value: minAmount })
      )
        .to.emit(noorQuran, "SurahSponsored")
        .withArgs(addr1.address, 1, minAmount);

      const surah1 = await noorQuran.getSurah(1);
      expect(surah1.guardian).to.equal(addr1.address);
      expect(surah1.sponsorshipAmount).to.equal(minAmount);
      expect(await noorQuran.ownerOf(1)).to.equal(addr1.address);
    });

    it("Should prevent sponsoring with less than minimum amount", async function () {
      const minAmount = await noorQuran.minSponsorshipAmount();
      const lowerAmount = minAmount - ethers.parseEther("0.0005");

      await expect(
        noorQuran.connect(addr1).sponsorSurah(1, { value: lowerAmount })
      ).to.be.revertedWith("Contribution below minimum threshold");
    });

    it("Should transfer guardianship to a new top sponsor and transfer the NFT", async function () {
      const minAmount = await noorQuran.minSponsorshipAmount();

      // addr1 sponsors Surah 1 first
      await noorQuran.connect(addr1).sponsorSurah(1, { value: minAmount });
      expect(await noorQuran.ownerOf(1)).to.equal(addr1.address);

      // addr2 sponsors Surah 1 with a higher contribution
      const higherAmount = minAmount + ethers.parseEther("0.002");
      await noorQuran.connect(addr2).sponsorSurah(1, { value: higherAmount });

      // addr2 should now hold the NFT and be the guardian
      const surah1 = await noorQuran.getSurah(1);
      expect(surah1.guardian).to.equal(addr2.address);
      expect(surah1.sponsorshipAmount).to.equal(minAmount + higherAmount);
      expect(await noorQuran.ownerOf(1)).to.equal(addr2.address);
    });

    it("Should generate a valid on-chain SVG metadata URI", async function () {
      const minAmount = await noorQuran.minSponsorshipAmount();
      await noorQuran.connect(addr1).sponsorSurah(1, { value: minAmount });

      const tokenUri = await noorQuran.tokenURI(1);
      expect(tokenUri).to.have.string("data:application/json;base64,");

      // Verify the SVG content can be generated
      const svg = await noorQuran.generateSVG(1);
      expect(svg).to.contain("<svg");
      expect(svg).to.contain("Al-Fatihah");
      expect(svg).to.contain("الفاتحة");
    });
  });

  describe("Charity Withdrawal", function () {
    it("Should allow the owner to withdraw sponsorship donations", async function () {
      const minAmount = await noorQuran.minSponsorshipAmount();
      await noorQuran.connect(addr1).sponsorSurah(1, { value: minAmount });

      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
      
      const tx = await noorQuran.connect(owner).withdrawSadaqah();
      const receipt = await tx.wait();
      
      const gasUsed = receipt ? receipt.gasUsed * receipt.gasPrice : 0n;
      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);

      expect(finalOwnerBalance + gasUsed - initialOwnerBalance).to.equal(minAmount);
    });

    it("Should prevent non-owners from withdrawing funds", async function () {
      await expect(
        noorQuran.connect(addr1).withdrawSadaqah()
      ).to.be.reverted; // Reverted due to Ownable restriction
    });
  });
});
