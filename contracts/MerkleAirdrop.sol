// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MerkleAirdrop
 * @dev A contract that allows users to claim tokens if they are part of a Merkle Tree.
 */
contract MerkleAirdrop is Ownable {
    IERC20 public immutable token;
    bytes32 public merkleRoot;

    // Track claimed addresses
    mapping(address => bool) public hasClaimed;

    event Claimed(address indexed account, uint256 amount);
    event MerkleRootUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot);
    event UnclaimedTokensWithdrawn(address indexed owner, uint256 amount);

    constructor(address _token, bytes32 _merkleRoot) Ownable(msg.sender) {
        require(_token != address(0), "Token address cannot be zero");
        token = IERC20(_token);
        merkleRoot = _merkleRoot;
    }

    /**
     * @dev Allows a user to claim their airdrop using a Merkle proof.
     */
    function claim(
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external {
        require(!hasClaimed[account], "Airdrop already claimed");

        // Verify the Merkle proof
        // Note: The leaf node is keccak256(abi.encodePacked(account, amount))
        bytes32 node = keccak256(abi.encodePacked(account, amount));
        require(MerkleProof.verify(merkleProof, merkleRoot, node), "Invalid Merkle proof");

        // Mark it as claimed
        hasClaimed[account] = true;

        // Transfer the tokens
        require(token.transfer(account, amount), "Token transfer failed");

        emit Claimed(account, amount);
    }

    /**
     * @dev Updates the Merkle root. Only owner can call this.
     */
    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        bytes32 oldRoot = merkleRoot;
        merkleRoot = _merkleRoot;
        emit MerkleRootUpdated(oldRoot, _merkleRoot);
    }

    /**
     * @dev Allows the owner to withdraw remaining tokens (e.g. after the airdrop ends).
     */
    function withdrawUnclaimed(uint256 amount) external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        require(amount <= balance, "Insufficient balance");
        require(token.transfer(owner(), amount), "Withdraw transfer failed");
        emit UnclaimedTokensWithdrawn(owner(), amount);
    }
}
