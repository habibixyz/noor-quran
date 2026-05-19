// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title NoorQuran
 * @dev An ERC721 contract representing the Guardianship/Sponsorship of Quran Surahs on the Base Network.
 * It stores the cryptographic integrity hashes of the Arabic text of all 114 Surahs and generates 
 * custom certificate artwork fully on-chain via SVGs.
 */
contract NoorQuran is ERC721, Ownable {
    using Strings for uint256;

    struct SurahMetadata {
        uint16 index;
        string name;          // Arabic name
        string englishName;   // English transliteration
        uint16 verseCount;
        string revelationType; // "Meccan" or "Medinan"
        bytes32 textHash;     // Keccak256 hash of the authentic Arabic text
    }

    // Mapping from Surah Index (1 to 114) to SurahMetadata
    mapping(uint256 => SurahMetadata) public surahs;
    
    // Mapping from Surah Index to the current Guardian/Sponsor wallet address
    mapping(uint256 => address) public surahGuardians;

    // Mapping from Surah Index to the total donation contribution in Wei
    mapping(uint256 => uint256) public surahSponsorships;

    // Total Sadaqah raised in Wei
    uint256 public totalSadaqahRaised;

    // Minimum contribution to sponsor a Surah (e.g., 0.001 ether)
    uint256 public minSponsorshipAmount = 0.001 ether;

    // Flag indicating if the Surah metadata has been fully initialized
    bool public isInitialized;

    event SurahSponsored(address indexed guardian, uint256 indexed surahId, uint256 amount);
    event MetadataInitialized();

    constructor() ERC721("Noor Quran", "NOOR") Ownable(msg.sender) {}

    /**
     * @dev Batch initializes the canonical Surah metadata. Can only be called by the contract owner.
     * Splitting into multiple calls to manage gas during initial setup.
     */
    function initializeSurahsBatch(
        uint16[] calldata indices,
        string[] calldata names,
        string[] calldata englishNames,
        uint16[] calldata verseCounts,
        string[] calldata revelationTypes,
        bytes32[] calldata hashes
    ) external onlyOwner {
        require(!isInitialized, "Metadata already fully initialized");
        require(
            indices.length == names.length &&
            names.length == englishNames.length &&
            englishNames.length == verseCounts.length &&
            verseCounts.length == revelationTypes.length &&
            revelationTypes.length == hashes.length,
            "Array lengths mismatch"
        );

        for (uint256 i = 0; i < indices.length; i++) {
            uint256 index = indices[i];
            require(index >= 1 && index <= 114, "Surah index must be 1 to 114");
            
            surahs[index] = SurahMetadata({
                index: indices[i],
                name: names[i],
                englishName: englishNames[i],
                verseCount: verseCounts[i],
                revelationType: revelationTypes[i],
                textHash: hashes[i]
            });
        }
    }

    /**
     * @dev Marks initialization complete.
     */
    function setInitialized() external onlyOwner {
        isInitialized = true;
        emit MetadataInitialized();
    }

    /**
     * @dev Sets the minimum contribution required to sponsor/guardian a Surah.
     */
    function setMinSponsorshipAmount(uint256 _amount) external onlyOwner {
        minSponsorshipAmount = _amount;
    }

    /**
     * @dev Sponsor / Guard a Surah by contributing Sepolia ETH or mainnet ETH.
     * Mints the ERC721 NFT to the sponsor if they are the first, or updates/adds contribution.
     * @param surahId The index of the Surah (1 to 114).
     */
    function sponsorSurah(uint256 surahId) external payable {
        require(surahId >= 1 && surahId <= 114, "Invalid Surah index");
        require(msg.value >= minSponsorshipAmount, "Contribution below minimum threshold");
        require(surahs[surahId].index != 0, "Surah metadata not initialized yet");

        address previousGuardian = surahGuardians[surahId];
        
        // Update sponsorship amounts
        surahSponsorships[surahId] += msg.value;
        totalSadaqahRaised += msg.value;
        surahGuardians[surahId] = msg.sender;

        if (previousGuardian == address(0)) {
            // First time sponsorship, mint the NFT to the guardian
            _safeMint(msg.sender, surahId);
        } else {
            // Re-sponsorship / Upgrade: Transfer the NFT to the new top guardian
            // (or if it's the same guardian, it just updates their contribution)
            if (previousGuardian != msg.sender) {
                _transfer(previousGuardian, msg.sender, surahId);
            }
        }

        emit SurahSponsored(msg.sender, surahId, msg.value);
    }

    /**
     * @dev Returns details of a specific Surah.
     */
    function getSurah(uint256 surahId) external view returns (
        uint16 index,
        string memory name,
        string memory englishName,
        uint16 verseCount,
        string memory revelationType,
        bytes32 textHash,
        address guardian,
        uint256 sponsorshipAmount
    ) {
        require(surahId >= 1 && surahId <= 114, "Invalid Surah index");
        SurahMetadata memory meta = surahs[surahId];
        return (
            meta.index,
            meta.name,
            meta.englishName,
            meta.verseCount,
            meta.revelationType,
            meta.textHash,
            surahGuardians[surahId],
            surahSponsorships[surahId]
        );
    }

    /**
     * @dev Generates the 100% on-chain SVG artwork for the Guardianship Certificate NFT.
     */
    function generateSVG(uint256 tokenId) public view returns (string memory) {
        SurahMetadata memory meta = surahs[tokenId];
        address guardian = surahGuardians[tokenId];
        uint256 donation = surahSponsorships[tokenId];

        string memory donationEth = string(abi.encodePacked(
            (donation / 10**15).toString(), " mETH"
        ));

        // Format address string
        string memory addrStr = "0x0000...0000";
        if (guardian != address(0)) {
            bytes32 value = bytes32(uint256(uint160(guardian)));
            bytes memory alphabet = "0123456789abcdef";
            bytes memory str = new bytes(42);
            str[0] = "0";
            str[1] = "x";
            for (uint256 i = 0; i < 20; i++) {
                str[2 + i * 2] = alphabet[uint8(value[i + 12] >> 4)];
                str[3 + i * 2] = alphabet[uint8(value[i + 12] & 0x0f)];
            }
            // Truncate for visual elegance inside the NFT
            addrStr = string(abi.encodePacked(
                substring(string(str), 0, 8),
                "...",
                substring(string(str), 34, 42)
            ));
        }

        // Format Hash string
        string memory hashStr = "0x0000...0000";
        if (meta.textHash != bytes32(0)) {
            bytes memory alphabet = "0123456789abcdef";
            bytes memory str = new bytes(64);
            for (uint256 i = 0; i < 32; i++) {
                str[i * 2] = alphabet[uint8(meta.textHash[i] >> 4)];
                str[i * 2 + 1] = alphabet[uint8(meta.textHash[i] & 0x0f)];
            }
            hashStr = string(abi.encodePacked(
                "0x",
                substring(string(str), 0, 10),
                "...",
                substring(string(str), 54, 64)
            ));
        }

        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="100%" height="100%">',
            '<defs>',
            '<linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" style="stop-color:#01140a;stop-opacity:1" />',
            '<stop offset="100%" style="stop-color:#052e17;stop-opacity:1" />',
            '</linearGradient>',
            '<linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" style="stop-color:#ffe066;stop-opacity:1" />',
            '<stop offset="50%" style="stop-color:#d4af37;stop-opacity:1" />',
            '<stop offset="100%" style="stop-color:#8a6d1c;stop-opacity:1" />',
            '</linearGradient>',
            '</defs>',
            '<rect width="400" height="600" rx="20" fill="url(#bgGrad)" stroke="url(#goldGrad)" stroke-width="6"/>',
            '<rect x="15" y="15" width="370" height="570" rx="15" fill="none" stroke="url(#goldGrad)" stroke-width="2" stroke-dasharray="8 4"/>',
            '<rect x="25" y="25" width="350" height="550" rx="12" fill="none" stroke="url(#goldGrad)" stroke-width="1"/>',
            // Stars in Corners
            '<path d="M 20 20 L 25 22 L 20 24 L 22 20 Z" fill="url(#goldGrad)"/>',
            '<path d="M 380 20 L 375 22 L 380 24 L 378 20 Z" fill="url(#goldGrad)"/>',
            '<path d="M 20 580 L 25 578 L 20 576 L 22 580 Z" fill="url(#goldGrad)"/>',
            '<path d="M 380 580 L 375 578 L 380 576 L 378 580 Z" fill="url(#goldGrad)"/>',
            // Title
            '<text x="200" y="80" text-anchor="middle" fill="url(#goldGrad)" font-family="Georgia, serif" font-size="20" font-weight="bold" letter-spacing="1">NOOR QURAN GUARDIAN</text>',
            '<line x1="120" y1="100" x2="280" y2="100" stroke="url(#goldGrad)" stroke-width="2"/>',
            '<circle cx="200" cy="100" r="4" fill="url(#goldGrad)"/>',
            // Surah Hexagon-badge
            '<g transform="translate(200, 160)">',
            '<polygon points="0,-25 18,-18 25,0 18,18 0,25 -18,18 -25,0 -18,-18" fill="none" stroke="url(#goldGrad)" stroke-width="2"/>',
            '<text x="0" y="4" text-anchor="middle" fill="url(#goldGrad)" font-family="sans-serif" font-size="12" font-weight="bold">SURAH</text>',
            '<text x="0" y="18" text-anchor="middle" fill="url(#goldGrad)" font-family="sans-serif" font-size="10" font-weight="bold">', tokenId.toString(), '</text>',
            '</g>',
            // Arabic Name
            '<text x="200" y="270" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="36" font-weight="bold">', meta.name, '</text>',
            // English Transliteration
            '<text x="200" y="315" text-anchor="middle" fill="url(#goldGrad)" font-family="sans-serif" font-size="18" font-style="italic" font-weight="bold">', meta.englishName, '</text>',
            // Details Grid
            '<g transform="translate(80, 370)">',
            '<text x="0" y="0" fill="#88c3a5" font-family="sans-serif" font-size="11">Verses</text>',
            '<text x="0" y="20" fill="#ffffff" font-family="sans-serif" font-size="15" font-weight="bold">', uint256(meta.verseCount).toString(), '</text>',
            '<text x="140" y="0" fill="#88c3a5" font-family="sans-serif" font-size="11">Type</text>',
            '<text x="140" y="20" fill="#ffffff" font-family="sans-serif" font-size="15" font-weight="bold">', meta.revelationType, '</text>',
            '</g>',
            // Integrity Hash
            '<text x="200" y="440" text-anchor="middle" fill="#88c3a5" font-family="monospace" font-size="9">INTEGRITY HASH (KECCAK256)</text>',
            '<text x="200" y="458" text-anchor="middle" fill="#ffffff" font-family="monospace" font-size="9">', hashStr, '</text>',
            // Sponsor
            '<rect x="40" y="490" width="320" height="60" rx="10" fill="#042011" stroke="url(#goldGrad)" stroke-width="1"/>',
            '<text x="200" y="508" text-anchor="middle" fill="#88c3a5" font-family="sans-serif" font-size="10">HONORARY GUARDIAN &amp; SPONSOR</text>',
            '<text x="200" y="525" text-anchor="middle" fill="#ffffff" font-family="monospace" font-size="12" font-weight="bold">', addrStr, '</text>',
            '<text x="200" y="540" text-anchor="middle" fill="url(#goldGrad)" font-family="sans-serif" font-size="9">Contribution: ', donationEth, '</text>',
            '</svg>'
        ));
    }

    /**
     * @dev Returns the ERC721 metadata for a given token ID, compiling JSON/SVG fully on-chain.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        SurahMetadata memory meta = surahs[tokenId];
        
        string memory svgContent = generateSVG(tokenId);
        
        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name": "Guardian of ', meta.englishName, ' (Surah ', tokenId.toString(), ')", ',
            '"description": "This token certifies that the holder is a registered Guardian and Sponsor of Surah ', meta.englishName, ' on the Base Network, supporting the on-chain preservation of Al-Quran.", ',
            '"attributes": [',
            '{"trait_type": "Surah", "value": "', meta.englishName, '"},',
            '{"trait_type": "Arabic Name", "value": "', meta.name, '"},',
            '{"trait_type": "Verses", "value": ', uint256(meta.verseCount).toString(), '},',
            '{"trait_type": "Revelation Type", "value": "', meta.revelationType, '"},',
            '{"trait_type": "Contribution (Wei)", "value": "', surahSponsorships[tokenId].toString(), '"}',
            '], ',
            '"image": "data:image/svg+xml;base64,', Base64.encode(bytes(svgContent)), '"}'
        ))));

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    /**
     * @dev Allows the contract owner to safely withdraw sponsorships (Sadaqah) for charitable distribution.
     */
    function withdrawSadaqah() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Transfer failed");
    }

    // Helper substring function
    function substring(string memory str, uint256 startIndex, uint256 endIndex) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(endIndex - startIndex);
        for(uint256 i = startIndex; i < endIndex; i++) {
            result[i - startIndex] = strBytes[i];
        }
        return string(result);
    }
}
