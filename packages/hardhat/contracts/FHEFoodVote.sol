// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title FHEFoodVote - Encrypted Voting Contract
/// @author
/// @notice Allows users to cast encrypted votes for their favorite food by country.
///         Each user can vote once per country, and their votes are stored privately using FHE.
/// @dev Uses Fully Homomorphic Encryption via FHEVM.
contract FHEFoodVote is SepoliaConfig {
    // --- STORAGE ---

    /// @dev Mapping from country -> voter -> encrypted vote (foodId)
    mapping(string => mapping(address => euint32)) private _userVotes;

    /// @dev Tracks whether an address has voted for a given country
    mapping(address => mapping(string => bool)) public hasVoted;

    // --- EVENTS ---
    event FoodVoted(address indexed voter, string country, uint256 foodId);

    // --- FUNCTIONS ---

    /// @notice Cast an encrypted vote for a food in a given country.
    /// @param country The country name.
    /// @param foodId The food index (as defined by the frontend).
    /// @param encryptedVote The encrypted value (should represent the foodId or vote = 1).
    /// @param proof The encryption proof.
    function vote(
        string calldata country,
        uint256 foodId,
        externalEuint32 encryptedVote,
        bytes calldata proof
    ) external {
        require(!hasVoted[msg.sender][country], "Already voted for this country");

        // Convert external encrypted value into internal FHE type
        euint32 voteValue = FHE.fromExternal(encryptedVote, proof);

        // Store the encrypted vote associated with this user
        _userVotes[country][msg.sender] = voteValue;

        // Allow this contract and the voter to read/decrypt their vote
        FHE.allowThis(_userVotes[country][msg.sender]);
        FHE.allow(_userVotes[country][msg.sender], msg.sender);

        // Mark that user has voted for this country
        hasVoted[msg.sender][country] = true;

        emit FoodVoted(msg.sender, country, foodId);
    }

    /// @notice Get the encrypted vote for a specific user and country.
    /// @param user The wallet address of the voter.
    /// @param country The country name.
    /// @return The encrypted vote (euint32) of the user.
    function getEncryptedVotes(address user, string calldata country)
        external
        view
        returns (euint32)
    {
        require(hasVoted[user][country], "User has not voted for this country");
        return _userVotes[country][user];
    }
}
