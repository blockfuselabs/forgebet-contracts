// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

/**
 * @title ResultsConsumer
 * @notice Consumer contract for Chainlink Functions to fetch FPL match results
 * @dev This contract requests match result data from FPL API via Chainlink Functions
 *      and stores game outcomes for prediction contracts to consume
 */
contract ResultsConsumer is FunctionsClient, ConfirmedOwner {
	using FunctionsRequest for FunctionsRequest.Request;

	// Chainlink Functions configuration
	bytes32 public s_donId; // DON ID for Base Sepolia Testnet
	uint64 public s_subscriptionId; // Subscription ID for funding requests
	uint32 public s_callbackGasLimit; // Gas limit for callback execution
	uint16 public s_requestConfirmations; // Number of confirmations required

	// Access control - authorized contracts that can request results
	mapping(address => bool) public authorizedCallers;

	// Request tracking
	mapping(bytes32 => MatchRequest) public s_requests; // Maps request ID to match request data

	// Game outcomes storage: gameweek => matchId => outcome
	mapping(uint256 => mapping(uint256 => MatchOutcome)) public gameOutcomes;

	// Match request data structure
	struct MatchRequest {
		uint256 gameweek; // Gameweek number
		uint256 matchId; // Match ID within the gameweek
		address requester; // Address that initiated the request
		uint256 timestamp; // Request timestamp
		bool isFulfilled; // Whether request has been fulfilled
	}

	// Match outcome data structure
	struct MatchOutcome {
		uint8 homeScore; // Home team score
		uint8 awayScore; // Away team score
		string status; // Match status (FT, HT, NS, etc.)
		uint256 timestamp; // Result timestamp
		bool exists; // Whether the outcome has been set
	}

	// Events
	event ResultRequested(
		bytes32 indexed requestId,
		uint256 indexed gameweek,
		uint256 indexed matchId
	);
	event ResultFulfilled(
		bytes32 indexed requestId,
		uint256 indexed gameweek,
		uint256 indexed matchId,
		uint8 homeScore,
		uint8 awayScore,
		string status
	);
	event RequestFailed(
		bytes32 indexed requestId,
		uint256 indexed gameweek,
		uint256 indexed matchId,
		bytes error
	);
	event AuthorizedCallerAdded(address indexed caller);
	event AuthorizedCallerRemoved(address indexed caller);
	event ConfigurationUpdated(
		bytes32 donId,
		uint64 subscriptionId,
		uint32 callbackGasLimit
	);
	event ResultManuallySet(
		uint256 indexed gameweek,
		uint256 indexed matchId,
		uint8 homeScore,
		uint8 awayScore,
		string status,
		address setBy
	);

	// Errors
	error InvalidRequestId(bytes32 requestId);
	error RequestAlreadyFulfilled(bytes32 requestId);
	error InvalidConfiguration();
	error InvalidResultData();
	error UnauthorizedCaller(address caller);
	error InvalidGameweek();
	error InvalidMatchId();
	error ResultAlreadySet(uint256 gameweek, uint256 matchId);
	error InvalidScore();
	error InvalidStatus();

	/**
	 * @notice Constructor
	 * @param router Chainlink Functions Router address for Base Sepolia Testnet
	 * @param donIdString DON ID string for the Functions DON on Base Sepolia (e.g., "fun-base-sepolia-1")
	 * @dev Converts the string DON ID to bytes32 internally for Chainlink compatibility
	 */
	constructor(
		address router,
		string memory donIdString
	) FunctionsClient(router) ConfirmedOwner(msg.sender) {
		// Convert string to bytes32 (pad with zeros)
		bytes memory donIdBytes = bytes(donIdString);
		bytes32 donId;
		
		// Copy bytes to bytes32, padding with zeros if needed
		// Solidity automatically pads with zeros when converting bytes to bytes32
		assembly {
			// Load the first 32 bytes of the string (skip length prefix)
			donId := mload(add(donIdBytes, 32))
		}
		
		s_donId = donId;
		s_callbackGasLimit = 300000; // Default gas limit
		s_requestConfirmations = 3; // Default confirmations
	}

	/**
	 * @notice Request match result data from FPL API via Chainlink Functions
	 * @param gameweek The gameweek number
	 * @param matchId The match ID within the gameweek
	 * @return requestId The Chainlink Functions request ID
	 */
	function requestResult(
		uint256 gameweek,
		uint256 matchId
	) external returns (bytes32 requestId) {
		// Access control: only authorized callers can request results
		if (!authorizedCallers[msg.sender] && msg.sender != owner()) {
			revert UnauthorizedCaller(msg.sender);
		}

		// Validate inputs
		if (gameweek == 0) {
			revert InvalidGameweek();
		}
		if (matchId == 0) {
			revert InvalidMatchId();
		}

		// Build the JavaScript source code for Chainlink Functions
		// Arguments are passed via the source code itself
		string memory source = _buildSourceCode(gameweek, matchId);

		// Build the request
		FunctionsRequest.Request memory req;
		req.initializeRequestForInlineJavaScript(source);

		// Send the request
		requestId = _sendRequest(
			req.encodeCBOR(),
			s_subscriptionId,
			s_callbackGasLimit,
			s_donId
		);

		// Store request data
		s_requests[requestId] = MatchRequest({
			gameweek: gameweek,
			matchId: matchId,
			requester: msg.sender,
			timestamp: block.timestamp,
			isFulfilled: false
		});

		emit ResultRequested(requestId, gameweek, matchId);

		return requestId;
	}

	/**
	 * @notice Callback function called by Chainlink Functions when request is fulfilled
	 * @param requestId The request ID
	 * @param response The response data from Chainlink Functions
	 * @param err Any errors that occurred
	 */
	function fulfillRequest(
		bytes32 requestId,
		bytes memory response,
		bytes memory err
	) internal override {
		MatchRequest storage request = s_requests[requestId];

		if (request.gameweek == 0) {
			revert InvalidRequestId(requestId);
		}

		if (request.isFulfilled) {
			revert RequestAlreadyFulfilled(requestId);
		}

		// Mark request as fulfilled
		request.isFulfilled = true;

		// Handle errors
		if (err.length > 0) {
			emit RequestFailed(requestId, request.gameweek, request.matchId, err);
			return;
		}

		// Parse the response
		MatchOutcome memory outcome = _parseResponse(response);

		// Validate parsed result
		if (!outcome.exists || bytes(outcome.status).length == 0) {
			emit RequestFailed(
				requestId,
				request.gameweek,
				request.matchId,
				"Invalid result data"
			);
			return;
		}

		// Store the outcome
		gameOutcomes[request.gameweek][request.matchId] = outcome;

		emit ResultFulfilled(
			requestId,
			request.gameweek,
			request.matchId,
			outcome.homeScore,
			outcome.awayScore,
			outcome.status
		);
	}

	/**
	 * @notice Parse response from Chainlink Functions
	 * @dev The JavaScript code returns comma-separated string: "homeScore,awayScore,status,timestamp"
	 * @param response Raw bytes response from Chainlink Functions (comma-separated string)
	 * @return outcome Parsed MatchOutcome struct
	 */
	function _parseResponse(
		bytes memory response
	) internal pure returns (MatchOutcome memory outcome) {
		if (response.length == 0) {
			return MatchOutcome({
				homeScore: 0,
				awayScore: 0,
				status: "",
				timestamp: 0,
				exists: false
			});
		}

		// Parse comma-separated format: "homeScore,awayScore,status,timestamp"
		uint8 homeScore = 0;
		uint8 awayScore = 0;
		string memory status = "";
		uint256 timestamp = 0;

		uint256 currentIndex = 0;
		uint256 fieldIndex = 0; // 0=homeScore, 1=awayScore, 2=status, 3=timestamp
		uint256 fieldStart = 0;

		for (uint256 i = 0; i < response.length; i++) {
			if (response[i] == 0x2C || i == response.length - 1) { // Comma or end
				uint256 fieldEnd = (response[i] == 0x2C) ? i : response.length;
				
				if (fieldIndex == 0) {
					// Parse homeScore
					homeScore = _parseUint8FromBytes(response, fieldStart, fieldEnd);
				} else if (fieldIndex == 1) {
					// Parse awayScore
					awayScore = _parseUint8FromBytes(response, fieldStart, fieldEnd);
				} else if (fieldIndex == 2) {
					// Parse status (string)
					bytes memory statusBytes = new bytes(fieldEnd - fieldStart);
					for (uint256 j = 0; j < fieldEnd - fieldStart; j++) {
						statusBytes[j] = response[fieldStart + j];
					}
					status = string(statusBytes);
				} else if (fieldIndex == 3) {
					// Parse timestamp
					timestamp = _parseUint256FromBytes(response, fieldStart, fieldEnd);
				}

				fieldIndex++;
				fieldStart = i + 1;
			}
		}

		// Validate
		bytes memory statusBytes = bytes(status);
		bool exists = timestamp > 0 && statusBytes.length > 0 && statusBytes.length <= 10;

		return MatchOutcome({
			homeScore: homeScore,
			awayScore: awayScore,
			status: status,
			timestamp: timestamp,
			exists: exists
		});
	}

	/**
	 * @notice Parse uint8 from bytes slice
	 */
	function _parseUint8FromBytes(
		bytes memory data,
		uint256 start,
		uint256 end
	) internal pure returns (uint8) {
		uint256 value = 0;
		for (uint256 i = start; i < end && i < data.length; i++) {
			bytes1 char = data[i];
			if (char >= 0x30 && char <= 0x39) {
				value = value * 10 + (uint8(char) - 48);
			}
		}
		return uint8(value);
	}

	/**
	 * @notice Parse uint256 from bytes slice
	 */
	function _parseUint256FromBytes(
		bytes memory data,
		uint256 start,
		uint256 end
	) internal pure returns (uint256) {
		uint256 value = 0;
		for (uint256 i = start; i < end && i < data.length; i++) {
			bytes1 char = data[i];
			if (char >= 0x30 && char <= 0x39) {
				value = value * 10 + (uint256(uint8(char)) - 48);
			}
		}
		return value;
	}

	/**
	 * @notice Build JavaScript source code for Chainlink Functions request
	 * @param gameweek The gameweek number
	 * @param matchId The match ID within the gameweek
	 * @return source JavaScript source code string
	 */
	function _buildSourceCode(
		uint256 gameweek,
		uint256 matchId
	) internal pure returns (string memory) {
		// Build JavaScript code that fetches data from FPL API
		// Convert gameweek and matchId to strings for JavaScript
		string memory gameweekStr = _uintToString(gameweek);
		string memory matchIdStr = _uintToString(matchId);

		return
			string(
				abi.encodePacked(
					"const gameweek = ",
					gameweekStr,
					";",
					"const matchId = ",
					matchIdStr,
					";",
					"",
					"// FPL API endpoint - fetch all fixtures for the gameweek",
					"const url = 'https://fantasy.premierleague.com/api/fixtures/?event=' + gameweek;",
					"",
					"// Make HTTP request",
					"const response = await Functions.makeHttpRequest({",
					"  url: url,",
					"  method: 'GET',",
					"  headers: {",
					"    'Content-Type': 'application/json'",
					"  }",
					"});",
					"",
					"// Handle errors",
					"if (response.error) {",
					"  throw new Error(`API Error: ${response.error}`);",
					"}",
					"",
					"// Validate response structure",
					"if (!response.data || !Array.isArray(response.data)) {",
					"  throw new Error('Invalid API response structure');",
					"}",
					"",
					"// Find the specific match by ID",
					"const fixtures = response.data;",
					"const match = fixtures.find(f => f.id === parseInt(matchId));",
					"",
					"if (!match) {",
					"  throw new Error(`Match ${matchId} not found in gameweek ${gameweek}`);",
					"}",
					"",
					"// Extract scores and status",
					"const homeScore = match.team_h_score !== null ? match.team_h_score : 0;",
					"const awayScore = match.team_a_score !== null ? match.team_a_score : 0;",
					"const status = match.finished ? 'FT' : (match.started ? 'LIVE' : 'NS');",
					"",
					"// Get timestamp",
					"const timestamp = match.kickoff_time ? Math.floor(new Date(match.kickoff_time).getTime() / 1000) : Math.floor(Date.now() / 1000);",
					"",
					"// Return as comma-separated string (easier to parse in Solidity)",
					"// Format: homeScore,awayScore,status,timestamp",
					"// Example: 2,1,FT,1701234567",
					"const resultString = homeScore + ',' + awayScore + ',' + status + ',' + timestamp;",
					"return Functions.encodeString(resultString);"
				)
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
	 * @notice Check if a match result has been fulfilled
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
	 * @notice Add an authorized caller
	 * @param caller The address to authorize
	 */
	function addAuthorizedCaller(address caller) external onlyOwner {
		authorizedCallers[caller] = true;
		emit AuthorizedCallerAdded(caller);
	}

	/**
	 * @notice Remove an authorized caller
	 * @param caller The address to revoke authorization
	 */
	function removeAuthorizedCaller(address caller) external onlyOwner {
		authorizedCallers[caller] = false;
		emit AuthorizedCallerRemoved(caller);
	}

	/**
	 * @notice Update subscription ID
	 * @param subscriptionId New subscription ID
	 */
	function setSubscriptionId(
		uint64 subscriptionId
	) external onlyOwner {
		s_subscriptionId = subscriptionId;
		emit ConfigurationUpdated(
			s_donId,
			s_subscriptionId,
			s_callbackGasLimit
		);
	}

	/**
	 * @notice Update callback gas limit
	 * @param callbackGasLimit New gas limit
	 */
	function setCallbackGasLimit(
		uint32 callbackGasLimit
	) external onlyOwner {
		if (callbackGasLimit == 0) {
			revert InvalidConfiguration();
		}
		s_callbackGasLimit = callbackGasLimit;
		emit ConfigurationUpdated(
			s_donId,
			s_subscriptionId,
			s_callbackGasLimit
		);
	}

	/**
	 * @notice Update DON ID
	 * @param donId New DON ID
	 */
	function setDonId(bytes32 donId) external onlyOwner {
		s_donId = donId;
		emit ConfigurationUpdated(
			s_donId,
			s_subscriptionId,
			s_callbackGasLimit
		);
	}

	/**
	 * @notice Manually set match result (owner only - fallback when Chainlink Functions fails)
	 * @param gameweek The gameweek number
	 * @param matchId The match ID within the gameweek
	 * @param homeScore Home team score
	 * @param awayScore Away team score
	 * @param status Match status (e.g., "FT", "LIVE", "NS")
	 * @dev This allows the owner to manually set results if Chainlink Functions fails
	 *      Only owner can call this function for security
	 */
	function setResultManually(
		uint256 gameweek,
		uint256 matchId,
		uint8 homeScore,
		uint8 awayScore,
		string memory status
	) external onlyOwner {
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

		// Validate status string length
		bytes memory statusBytes = bytes(status);
		if (statusBytes.length == 0 || statusBytes.length > 10) {
			revert InvalidStatus();
		}

		// Set the outcome
		gameOutcomes[gameweek][matchId] = MatchOutcome({
			homeScore: homeScore,
			awayScore: awayScore,
			status: status,
			timestamp: block.timestamp,
			exists: true
		});

		emit ResultManuallySet(gameweek, matchId, homeScore, awayScore, status, msg.sender);
	}

	/**
	 * @notice Get request details
	 * @param requestId The request ID
	 * @return request MatchRequest struct
	 */
	function getRequest(
		bytes32 requestId
	) external view returns (MatchRequest memory) {
		return s_requests[requestId];
	}

	/**
	 * @notice Convert uint256 to string
	 * @param value The uint256 value to convert
	 * @return result The string representation
	 */
	function _uintToString(uint256 value) internal pure returns (string memory) {
		if (value == 0) {
			return "0";
		}
		uint256 temp = value;
		uint256 digits;
		while (temp != 0) {
			digits++;
			temp /= 10;
		}
		bytes memory buffer = new bytes(digits);
		while (value != 0) {
			digits -= 1;
			buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
			value /= 10;
		}
		return string(buffer);
	}
}
