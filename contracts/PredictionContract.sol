// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ResultsConsumer.sol";

/**
 * @title PredictionContract
 * @notice Prediction/betting contract that consumes results from Chainlink Functions ResultsConsumer
 * @dev This contract manages bets and settles them based on results from Chainlink Functions oracle
 */
contract PredictionContract {
	ResultsConsumer public immutable resultsConsumer;
	address public owner;

	// Bet structure
	struct Bet {
		address bettor; // Address of the bettor
		uint256 gameweek; // Gameweek number
		uint256 matchId; // Match ID within the gameweek
		uint256 amount; // Bet amount
		Prediction prediction; // Prediction (HOME, DRAW, AWAY)
		bool isSettled; // Whether the bet has been settled
		bool isWinner; // Whether the bettor won
		uint256 timestamp; // Bet timestamp
	}

	// Prediction enum
	enum Prediction {
		HOME, // Home team wins
		DRAW, // Draw
		AWAY // Away team wins
	}

	// Match outcome enum (derived from scores)
	enum MatchOutcome {
		HOME_WIN,
		DRAW,
		AWAY_WIN
	}

	// Storage
	mapping(uint256 => Bet) public bets; // betId => Bet
	mapping(uint256 => mapping(uint256 => bool)) public settledMatches; // gameweek => matchId => settled
	uint256 public nextBetId; // Next bet ID

	// Events
	event BetPlaced(
		uint256 indexed betId,
		address indexed bettor,
		uint256 indexed gameweek,
		uint256 matchId,
		Prediction prediction,
		uint256 amount
	);
	event MatchSettled(
		uint256 indexed gameweek,
		uint256 indexed matchId,
		MatchOutcome outcome,
		uint256 totalWinners,
		uint256 totalAmount
	);
	event BetSettled(
		uint256 indexed betId,
		address indexed bettor,
		bool isWinner,
		uint256 payout
	);

	// Errors
	error InvalidBet();
	error MatchNotFulfilled(uint256 gameweek, uint256 matchId);
	error MatchAlreadySettled(uint256 gameweek, uint256 matchId);
	error InvalidAmount();
	error InvalidPrediction();
	error NotOwner();
	error InsufficientBalance(uint256 requested, uint256 available);
	error WithdrawalFailed();
	error NoUnmatchedBet(uint256 gameweek, uint256 matchId);
	error MultipleBetsForMatch(uint256 gameweek, uint256 matchId, uint256 count);

	/**
	 * @notice Constructor
	 * @param _resultsConsumer Address of the ResultsConsumer contract (Chainlink Functions)
	 */
	constructor(address _resultsConsumer) {
		resultsConsumer = ResultsConsumer(_resultsConsumer);
		owner = msg.sender;
	}

	/**
	 * @notice Modifier to restrict access to owner only
	 */
	modifier onlyOwner() {
		if (msg.sender != owner) {
			revert NotOwner();
		}
		_;
	}

	/**
	 * @notice Transfer ownership to a new address
	 * @param newOwner The new owner address
	 */
	function transferOwnership(address newOwner) external onlyOwner {
		if (newOwner == address(0)) {
			revert InvalidBet(); // Reuse error for invalid address
		}
		owner = newOwner;
	}

	/**
	 * @notice Place a bet on a match
	 * @param gameweek The gameweek number
	 * @param matchId The match ID within the gameweek
	 * @param prediction The prediction (HOME, DRAW, AWAY)
	 * @return betId The ID of the placed bet
	 */
	function placeBet(
		uint256 gameweek,
		uint256 matchId,
		Prediction prediction
	) external payable returns (uint256 betId) {
		if (msg.value == 0) {
			revert InvalidAmount();
		}
		if (gameweek == 0 || matchId == 0) {
			revert InvalidBet();
		}

		betId = nextBetId++;
		bets[betId] = Bet({
			bettor: msg.sender,
			gameweek: gameweek,
			matchId: matchId,
			amount: msg.value,
			prediction: prediction,
			isSettled: false,
			isWinner: false,
			timestamp: block.timestamp
		});

		emit BetPlaced(betId, msg.sender, gameweek, matchId, prediction, msg.value);
		return betId;
	}

	/**
	 * @notice Settle a match and resolve all bets
	 * @param gameweek The gameweek number
	 * @param matchId The match ID within the gameweek
	 */
	function settleMatch(
		uint256 gameweek,
		uint256 matchId
	) external {
		// Check if match result has been fulfilled by Chainlink Functions
		if (!resultsConsumer.hasOutcome(gameweek, matchId)) {
			revert MatchNotFulfilled(gameweek, matchId);
		}

		// Check if match has already been settled
		if (settledMatches[gameweek][matchId]) {
			revert MatchAlreadySettled(gameweek, matchId);
		}

		// Get the match outcome from ResultsConsumer (Chainlink Functions)
		ResultsConsumer.MatchOutcome memory outcome = resultsConsumer.getOutcome(
			gameweek,
			matchId
		);

		// Determine match outcome from scores
		MatchOutcome matchOutcome;
		if (outcome.homeScore > outcome.awayScore) {
			matchOutcome = MatchOutcome.HOME_WIN;
		} else if (outcome.awayScore > outcome.homeScore) {
			matchOutcome = MatchOutcome.AWAY_WIN;
		} else {
			matchOutcome = MatchOutcome.DRAW;
		}

		// Mark match as settled
		settledMatches[gameweek][matchId] = true;

		// Find all bets for this match and settle them
		uint256 totalWinners = 0;
		uint256 totalAmount = 0;
		uint256 winnerPool = 0;
		uint256 loserPool = 0;

		// First pass: collect bets and determine winners/losers
		uint256[] memory betIds = new uint256[](nextBetId);
		uint256 betCount = 0;

		for (uint256 i = 0; i < nextBetId; i++) {
			Bet storage bet = bets[i];
			if (
				bet.gameweek == gameweek &&
				bet.matchId == matchId &&
				!bet.isSettled
			) {
				betIds[betCount++] = i;
				totalAmount += bet.amount;

				// Check if bet is a winner
				bool isWinner = false;
				if (
					(matchOutcome == MatchOutcome.HOME_WIN &&
						bet.prediction == Prediction.HOME) ||
					(matchOutcome == MatchOutcome.DRAW &&
						bet.prediction == Prediction.DRAW) ||
					(matchOutcome == MatchOutcome.AWAY_WIN &&
						bet.prediction == Prediction.AWAY)
				) {
					isWinner = true;
					totalWinners++;
					winnerPool += bet.amount;
				} else {
					loserPool += bet.amount;
				}

				bet.isWinner = isWinner;
				bet.isSettled = true;
			}
		}

		// Second pass: distribute winnings
		if (totalWinners > 0 && winnerPool > 0) {
			// Winners share the loser pool plus their own bets
			uint256 totalPrizePool = winnerPool + loserPool;
			uint256 prizePerWinner = totalPrizePool / totalWinners;

			for (uint256 i = 0; i < betCount; i++) {
				Bet storage bet = bets[betIds[i]];
				if (bet.isWinner) {
					uint256 payout = prizePerWinner;
					(bool success, ) = bet.bettor.call{value: payout}("");
					if (success) {
						emit BetSettled(betIds[i], bet.bettor, true, payout);
					}
				} else {
					emit BetSettled(betIds[i], bet.bettor, false, 0);
				}
			}
		} else {
			// No winners, refund all bets
			for (uint256 i = 0; i < betCount; i++) {
				Bet storage bet = bets[betIds[i]];
				(bool success, ) = bet.bettor.call{value: bet.amount}("");
				if (success) {
					emit BetSettled(betIds[i], bet.bettor, false, bet.amount);
				}
			}
		}

		emit MatchSettled(gameweek, matchId, matchOutcome, totalWinners, totalAmount);
	}

	/**
	 * @notice Get bet details
	 * @param betId The bet ID
	 * @return bet The bet struct
	 */
	function getBet(uint256 betId) external view returns (Bet memory) {
		return bets[betId];
	}

	/**
	 * @notice Check if a match has been settled
	 * @param gameweek The gameweek number
	 * @param matchId The match ID within the gameweek
	 * @return settled Whether the match has been settled
	 */
	function isMatchSettled(
		uint256 gameweek,
		uint256 matchId
	) external view returns (bool) {
		return settledMatches[gameweek][matchId];
	}

	/**
	 * @notice Get contract balance
	 * @return balance The contract's ETH balance
	 */
	function getBalance() external view returns (uint256) {
		return address(this).balance;
	}

	/**
	 * @notice Withdraw platform fees (owner only)
	 * @param amount The amount to withdraw in wei. Use 0 to withdraw all available balance.
	 * @dev Allows owner to withdraw accumulated platform fees or any remaining balance
	 */
	function withdrawFees(uint256 amount) external onlyOwner {
		uint256 balance = address(this).balance;
		
		// If amount is 0, withdraw all
		uint256 withdrawAmount = amount == 0 ? balance : amount;
		
		if (withdrawAmount == 0) {
			revert InvalidAmount();
		}
		
		if (withdrawAmount > balance) {
			revert InsufficientBalance(withdrawAmount, balance);
		}

		(bool success, ) = payable(owner).call{value: withdrawAmount}("");
		if (!success) {
			revert WithdrawalFailed();
		}

		emit FeesWithdrawn(owner, withdrawAmount, balance - withdrawAmount);
	}

	// Events
	event FeesWithdrawn(
		address indexed recipient,
		uint256 amount,
		uint256 remainingBalance
	);

	event UnmatchedBetRefunded(
		uint256 indexed gameweek,
		uint256 indexed matchId,
		address indexed bettor,
		uint256 amount
	);

	/**
	 * @notice Refund an unmatched single bet (owner only). No platform fee retained.
	 * @dev Marks the bet settled and refunds the full stake. Intended for matches that never got a second bettor.
	 */
	function refundUnmatchedBet(
		uint256 gameweek,
		uint256 matchId
	) external onlyOwner {
		if (settledMatches[gameweek][matchId]) {
			revert MatchAlreadySettled(gameweek, matchId);
		}

		uint256 candidateBetId = 0;
		uint256 count = 0;

		for (uint256 i = 0; i < nextBetId; i++) {
			Bet storage bet = bets[i];
			if (
				!bet.isSettled &&
				bet.gameweek == gameweek &&
				bet.matchId == matchId
			) {
				candidateBetId = i;
				count++;
				if (count > 1) {
					revert MultipleBetsForMatch(gameweek, matchId, count);
				}
			}
		}

		if (count == 0) {
			revert NoUnmatchedBet(gameweek, matchId);
		}

		Bet storage target = bets[candidateBetId];
		target.isSettled = true;
		target.isWinner = false;
		settledMatches[gameweek][matchId] = true;

		(bool success, ) = payable(target.bettor).call{value: target.amount}("");
		if (!success) {
			revert WithdrawalFailed();
		}

		emit BetSettled(candidateBetId, target.bettor, false, target.amount);
		emit UnmatchedBetRefunded(gameweek, matchId, target.bettor, target.amount);
	}
}

