// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CustomResultsOracle
 * @notice Custom oracle for setting match results on Base Sepolia
 * @dev This contract allows authorized oracles to submit match results
 *      Since Chainlink Functions doesn't support Base Sepolia, we use a custom oracle solution
 */
contract CustomResultsOracle is Ownable {
	// Access control - authorized oracles that can submit results
	mapping(address => bool) public authorizedOracles;

	// Game outcomes storage: gameweek => matchId => outcome
	mapping(uint256 => mapping(uint256 => MatchOutcome)) public gameOutcomes;

	// Match outcome data structure
	struct MatchOutcome {
		uint8 homeScore; // Home team score
		uint8 awayScore; // Away team score
		string status; // Match status (FT, HT, NS, etc.)
		uint256 timestamp; // Result timestamp
		bool exists; // Whether the outcome has been set
	}

	// Events
	event ResultSubmitted(
		uint256 indexed gameweek,
		uint256 indexed matchId,
		uint8 homeScore,
		uint8 awayScore,
		string status,
		address indexed oracle
	);
	event AuthorizedOracleAdded(address indexed oracle);
	event AuthorizedOracleRemoved(address indexed oracle);

	// Errors
	error UnauthorizedOracle(address oracle);
	error InvalidGameweek();
	error InvalidMatchId();
	error InvalidScore();
	error ResultAlreadySet(uint256 gameweek, uint256 matchId);
	error InvalidStatus();

	/**
	 * @notice Constructor
	 * @param initialOwner The initial owner of the contract
	 */
	constructor(address initialOwner) Ownable(initialOwner) {}

	/**
	 * @notice Submit match result (only authorized oracles)
	 * @param gameweek The gameweek number
	 * @param matchId The match ID within the gameweek
	 * @param homeScore Home team score
	 * @param awayScore Away team score
	 * @param status Match status (FT, HT, NS, etc.)
	 */
	function submitResult(
		uint256 gameweek,
		uint256 matchId,
		uint8 homeScore,
		uint8 awayScore,
		string calldata status
	) external {
		// Access control: only authorized oracles or owner can submit
		if (!authorizedOracles[msg.sender] && msg.sender != owner()) {
			revert UnauthorizedOracle(msg.sender);
		}

		// Validate inputs
		if (gameweek == 0) {
			revert InvalidGameweek();
		}
		if (matchId == 0) {
			revert InvalidMatchId();
		}

		// Check if result already exists
		if (gameOutcomes[gameweek][matchId].exists) {
			revert ResultAlreadySet(gameweek, matchId);
		}

		// Validate status (basic validation)
		bytes memory statusBytes = bytes(status);
		if (statusBytes.length == 0 || statusBytes.length > 10) {
			revert InvalidStatus();
		}

		// Store the outcome
		gameOutcomes[gameweek][matchId] = MatchOutcome({
			homeScore: homeScore,
			awayScore: awayScore,
			status: status,
			timestamp: block.timestamp,
			exists: true
		});

		emit ResultSubmitted(
			gameweek,
			matchId,
			homeScore,
			awayScore,
			status,
			msg.sender
		);
	}

	/**
	 * @notice Update match result (only owner, for corrections)
	 * @param gameweek The gameweek number
	 * @param matchId The match ID within the gameweek
	 * @param homeScore Home team score
	 * @param awayScore Away team score
	 * @param status Match status
	 */
	function updateResult(
		uint256 gameweek,
		uint256 matchId,
		uint8 homeScore,
		uint8 awayScore,
		string calldata status
	) external onlyOwner {
		// Validate inputs
		if (gameweek == 0) {
			revert InvalidGameweek();
		}
		if (matchId == 0) {
			revert InvalidMatchId();
		}

		// Validate status
		bytes memory statusBytes = bytes(status);
		if (statusBytes.length == 0 || statusBytes.length > 10) {
			revert InvalidStatus();
		}

		// Update the outcome
		gameOutcomes[gameweek][matchId] = MatchOutcome({
			homeScore: homeScore,
			awayScore: awayScore,
			status: status,
			timestamp: block.timestamp,
			exists: true
		});

		emit ResultSubmitted(
			gameweek,
			matchId,
			homeScore,
			awayScore,
			status,
			msg.sender
		);
	}

	/**
	 * @notice Get match outcome for a specific gameweek and match ID
	 * @param gameweek The gameweek number
	 * @param matchId The match ID within the gameweek
	 * @return outcome The match outcome
	 */
	function getOutcome(
		uint256 gameweek,
		uint256 matchId
	) external view returns (MatchOutcome memory) {
		return gameOutcomes[gameweek][matchId];
	}

	/**
	 * @notice Check if a match result has been set
	 * @param gameweek The gameweek number
	 * @param matchId The match ID within the gameweek
	 * @return exists Whether the outcome exists
	 */
	function hasOutcome(
		uint256 gameweek,
		uint256 matchId
	) external view returns (bool) {
		return gameOutcomes[gameweek][matchId].exists;
	}

	/**
	 * @notice Add an authorized oracle
	 * @param oracle The address to authorize
	 */
	function addAuthorizedOracle(address oracle) external onlyOwner {
		authorizedOracles[oracle] = true;
		emit AuthorizedOracleAdded(oracle);
	}

	/**
	 * @notice Remove an authorized oracle
	 * @param oracle The address to revoke authorization
	 */
	function removeAuthorizedOracle(address oracle) external onlyOwner {
		authorizedOracles[oracle] = false;
		emit AuthorizedOracleRemoved(oracle);
	}
}

