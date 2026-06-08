// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title QuranToken
 * @dev ERC20 Token representing Onchain Quran utility & governance token (QURAN).
 * It features a 1% transfer fee that is sent to a treasury wallet.
 */
contract QuranToken is ERC20, ERC20Burnable, Ownable {
    address public treasuryWallet;
    uint256 public constant FEE_PERCENTAGE = 1; // 1% fee

    mapping(address => bool) public isExcludedFromFee;

    event TreasuryWalletUpdated(address indexed newTreasury);
    event ExcludedFromFee(address indexed account, bool isExcluded);

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address ownerAddress
    ) ERC20(name, symbol) Ownable(ownerAddress) {
        treasuryWallet = ownerAddress;
        
        // Exclude owner and contract itself from fees
        isExcludedFromFee[ownerAddress] = true;
        isExcludedFromFee[address(this)] = true;

        _mint(ownerAddress, initialSupply);
    }

    /**
     * @dev Exclude or include an account from the transfer fee.
     */
    function setExcludeFromFee(address account, bool excluded) external onlyOwner {
        isExcludedFromFee[account] = excluded;
        emit ExcludedFromFee(account, excluded);
    }

    /**
     * @dev Update the treasury wallet where fees are sent.
     */
    function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
        require(_treasuryWallet != address(0), "Treasury cannot be the zero address");
        treasuryWallet = _treasuryWallet;
        emit TreasuryWalletUpdated(_treasuryWallet);
    }

    /**
     * @dev Overridden _update function to apply the 1% fee.
     * OpenZeppelin v5 uses _update instead of _transfer, _mint, and _burn.
     */
    function _update(address from, address to, uint256 value) internal virtual override {
        // If minting or burning, or if either sender or recipient is excluded from fees, do standard transfer
        if (from == address(0) || to == address(0) || isExcludedFromFee[from] || isExcludedFromFee[to]) {
            super._update(from, to, value);
            return;
        }

        // Calculate 1% fee
        uint256 feeAmount = (value * FEE_PERCENTAGE) / 100;
        uint256 amountAfterFee = value - feeAmount;

        // Transfer fee to treasury
        if (feeAmount > 0) {
            super._update(from, treasuryWallet, feeAmount);
        }

        // Transfer the remaining amount to the recipient
        super._update(from, to, amountAfterFee);
    }
}
