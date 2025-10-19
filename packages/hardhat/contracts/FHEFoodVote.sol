// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title FoodVote - Encrypted Voting Contract
/// @author
/// @notice Stores encrypted votes for each (country, foodId).
///         The frontend defines the list of foods; contract only stores encrypted counts.
/// @dev Uses Fully Homomorphic Encryption via FHEVM.
contract FHEFoodVote is SepoliaConfig {
    // --- STORAGE ---

    /// @dev Mapping from country -> foodId -> encrypted votes
    mapping(string => mapping(uint256 => euint32)) private _votes;

    /// @dev Tracks whether an address has voted for a given country
    mapping(address => mapping(string => bool)) public hasVoted;

    // --- EVENTS ---
    event FoodVoted(address indexed voter, string country, uint256 foodId);

    // --- FUNCTIONS ---

    /// @notice Cast an encrypted vote for a food in a given country.
    /// @param country The country name
    /// @param foodId The index of the food (as defined on the frontend)
    /// @param encryptedVote The encrypted value (should represent 1)
    /// @param proof The encryption proof
    function vote(
        string calldata country,
        uint256 foodId,
        externalEuint32 encryptedVote,
        bytes calldata proof
    ) external {
        require(!hasVoted[msg.sender][country], "Already voted for this country");

        // Convert external encrypted value into internal FHE type
        euint32 voteValue = FHE.fromExternal(encryptedVote, proof);

        // Add the encrypted vote to the total
        _votes[country][foodId] = FHE.add(_votes[country][foodId], voteValue);

        // Allow read/decrypt for this contract and the voter
        FHE.allowThis(_votes[country][foodId]);
        FHE.allow(_votes[country][foodId], msg.sender);

        // Mark voter as having voted for that country
        hasVoted[msg.sender][country] = true;

        emit FoodVoted(msg.sender, country, foodId);
    }

    /// @notice Get the encrypted vote count for a given country and food ID
    /// @param country The country name
    /// @param foodId The food index (as defined by frontend)
    /// @return The encrypted vote count (euint32)
    function getEncryptedVotes(string calldata country, uint256 foodId) external view returns (euint32) {
        return _votes[country][foodId];
    }
}
