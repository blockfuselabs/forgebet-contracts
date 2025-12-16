// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ResultsConsumer.sol";

/**
 * @title MockFunctionsRouter
 * @notice Mock contract for testing Chainlink Functions integration
 * @dev This contract simulates Chainlink Functions responses for testing
 */
contract MockFunctionsRouter {
	ResultsConsumer public resultsConsumer;

	constructor(address _resultsConsumer) {
		resultsConsumer = ResultsConsumer(_resultsConsumer);
	}

	/**
	 * @notice Simulate a successful Chainlink Functions response
	 * @param requestId The request ID
	 * @param homeScore Home team score
	 * @param awayScore Away team score
	 * @param status Match status
	 * @param timestamp Result timestamp
	 */
	function simulateFulfillRequest(
		bytes32 requestId,
		uint8 homeScore,
		uint8 awayScore,
		string memory status,
		uint256 timestamp
	) external {
		// Encode the response as ABI-encoded bytes
		bytes memory response = abi.encode(homeScore, awayScore, status, timestamp);

		// Call fulfillRequest on ResultsConsumer
		// Note: This requires ResultsConsumer to have a public fulfillRequest or we need to use a different approach
		// For testing, we'll use a test-specific version or interface
	}
}

