// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SadaqahZakat
 * @dev Smart contract for collecting Sadaqah and Zakat on Base network to support poor people.
 */
contract SadaqahZakat is Ownable {
    // Stats
    uint256 public totalSadaqah;
    uint256 public totalZakat;
    uint256 public totalDonationsCount;
    uint256 public totalDonorsCount;

    // Track unique donors
    mapping(address => bool) private hasDonated;
    
    // Struct for Donation record
    struct Donation {
        address donor;
        uint256 amount;
        uint256 timestamp;
        bool isZakat; // true = Zakat, false = Sadaqah
    }

    // List of recent donations
    Donation[] public donations;

    // Events
    event Donated(address indexed donor, uint256 amount, bool indexed isZakat, uint256 timestamp);
    event FundsWithdrawn(address indexed owner, uint256 amount, uint256 timestamp);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Donate Sadaqah (voluntary charity)
     */
    function donateSadaqah() external payable {
        require(msg.value > 0, "Donation amount must be greater than zero");
        
        totalSadaqah += msg.value;
        _recordDonation(msg.sender, msg.value, false);
    }

    /**
     * @dev Donate Zakat (obligatory alms)
     */
    function donateZakat() external payable {
        require(msg.value > 0, "Donation amount must be greater than zero");
        
        totalZakat += msg.value;
        _recordDonation(msg.sender, msg.value, true);
    }

    /**
     * @dev Internal helper to record stats and events
     */
    function _recordDonation(address donor, uint256 amount, bool isZakat) internal {
        totalDonationsCount++;
        
        if (!hasDonated[donor]) {
            hasDonated[donor] = true;
            totalDonorsCount++;
        }

        donations.push(Donation({
            donor: donor,
            amount: amount,
            timestamp: block.timestamp,
            isZakat: isZakat
        }));

        emit Donated(donor, amount, isZakat, block.timestamp);
    }

    /**
     * @dev Returns total donations accumulated (Sadaqah + Zakat)
     */
    function totalAccumulated() external view returns (uint256) {
        return totalSadaqah + totalZakat;
    }

    /**
     * @dev Returns the last N donations
     */
    function getRecentDonations(uint256 count) external view returns (Donation[] memory) {
        uint256 length = donations.length;
        if (length == 0) {
            return new Donation[](0);
        }
        
        uint256 resultSize = count > length ? length : count;
        Donation[] memory result = new Donation[](resultSize);
        
        for (uint256 i = 0; i < resultSize; i++) {
            result[i] = donations[length - 1 - i];
        }
        
        return result;
    }

    /**
     * @dev Allows the owner to withdraw the funds to distribute to poor people
     */
    function withdrawFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds available for withdrawal");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal transfer failed");
        
        emit FundsWithdrawn(owner(), balance, block.timestamp);
    }
}
