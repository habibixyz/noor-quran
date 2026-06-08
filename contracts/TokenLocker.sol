// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TokenLocker
 * @dev A simple smart contract that locks an ERC-20 token until a specific timestamp.
 * Used for locking the 90% QURAN token supply for 2 years.
 */
contract TokenLocker is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    uint256 public immutable releaseTime;

    event TokensReleased(uint256 amount);

    /**
     * @dev Constructor
     * @param _token Address of the ERC20 token to lock
     * @param _releaseTime Timestamp when tokens can be unlocked
     * @param initialOwner Owner who can withdraw after release time
     */
    constructor(
        address _token,
        uint256 _releaseTime,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_releaseTime > block.timestamp, "TokenLocker: release time is before current time");
        token = IERC20(_token);
        releaseTime = _releaseTime;
    }

    /**
     * @dev Release locked tokens. Can only be called by the owner after releaseTime.
     */
    function release() external onlyOwner {
        require(block.timestamp >= releaseTime, "TokenLocker: current time is before release time");

        uint256 amount = token.balanceOf(address(this));
        require(amount > 0, "TokenLocker: no tokens to release");

        token.safeTransfer(owner(), amount);

        emit TokensReleased(amount);
    }
}
