// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IMatchManager
 * @notice Interface for MatchManager contract to enable integration with ResultsConsumer
 */
interface IMatchManager {
	enum MatchStatus {
		OPEN,
		ACTIVE,
		COMPLETED,
		CANCELLED
	}

	enum MatchResult {
		CREATOR_WIN,
		DRAW,
		JOINER_WIN,
		CANCELLED
	}

	struct Match {
		uint256 id;
		address creator;
		address joiner;
		uint256 stakeAmount;
		string fixtureId;
		MatchStatus status;
		MatchResult result;
		uint256 createdAt;
		uint256 completedAt;
		bool isSettled;
	}

	/**
	 * @notice Settle a match with the result from oracle
	 * @param matchId The match ID to settle
	 * @param homeScore Home team score
	 * @param awayScore Away team score
	 * @param status Match status (FT, HT, etc.)
	 */
	function settleMatchWithResult(
		uint256 matchId,
		uint8 homeScore,
		uint8 awayScore,
		string calldata status
	) external;

	/**
	 * @notice Get match details
	 * @param matchId The match ID
	 * @return match Match struct
	 */
	function getMatch(
		uint256 matchId
	) external view returns (Match memory);
}

