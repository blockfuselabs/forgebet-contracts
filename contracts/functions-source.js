/**
 * @title Chainlink Functions Source Code for FPL Match Results
 * @notice JavaScript code executed by Chainlink Functions to fetch match results from FPL API
 * @dev This code runs in a secure Chainlink Functions runtime environment
 */

// Get input parameters from args
const fixtureId = args[0]; // FPL API fixture ID
const apiKey = args[1]; // FPL API key (encrypted/secrets)

// Validate inputs
if (!fixtureId || !apiKey) {
	throw new Error('Missing required parameters: fixtureId and apiKey');
}

// FPL API endpoint
const url = `https://api.football-data.org/v4/matches/${fixtureId}`;

// Make HTTP request to FPL API
const response = await Functions.makeHttpRequest({
	url: url,
	method: 'GET',
	headers: {
		'X-Auth-Token': apiKey,
		'Content-Type': 'application/json',
	},
	timeout: 10000, // 10 second timeout
});

// Handle API errors
if (response.error) {
	const errorMessage = `API Error: ${response.error}`;
	console.error(errorMessage);
	throw new Error(errorMessage);
}

// Validate response structure
if (!response.data || !response.data.match) {
	throw new Error('Invalid API response structure: missing match data');
}

const match = response.data.match;

// Validate match score data
if (!match.score) {
	throw new Error('Invalid API response: missing score data');
}

// Extract scores with fallback logic
// Prefer full-time score, fallback to half-time, then 0
const homeScore =
	match.score.fullTime?.home ??
	match.score.halfTime?.home ??
	match.score.extraTime?.home ??
	0;

const awayScore =
	match.score.fullTime?.away ??
	match.score.halfTime?.away ??
	match.score.extraTime?.away ??
	0;

// Extract match status
// Common statuses: FT (Full Time), HT (Half Time), NS (Not Started), 
// LIVE, CANCELED, POSTPONED, SUSPENDED, AWARDED
const status = match.status || 'UNKNOWN';

// Validate status
const validStatuses = [
	'FT',
	'HT',
	'NS',
	'LIVE',
	'CANCELED',
	'POSTPONED',
	'SUSPENDED',
	'AWARDED',
	'FINISHED',
];

if (!validStatuses.includes(status)) {
	console.warn(`Unexpected match status: ${status}`);
}

// Get timestamp (match date/time)
const timestamp = match.utcDate
	? Math.floor(new Date(match.utcDate).getTime() / 1000)
	: Math.floor(Date.now() / 1000);

// Validate that match has completed (status is FT or FINISHED)
// Only return valid results for completed matches
if (status !== 'FT' && status !== 'FINISHED' && status !== 'AWARDED') {
	// For non-finished matches, return current state but mark as incomplete
	// The contract will handle this appropriately
	console.log(
		`Match not finished yet. Status: ${status}, Home: ${homeScore}, Away: ${awayScore}`
	);
}

// Prepare result object
const result = {
	homeScore: Number(homeScore),
	awayScore: Number(awayScore),
	status: status,
	timestamp: timestamp,
};

// Return as ABI-encoded bytes
// Format: (uint8, uint8, string, uint256)
// Note: Chainlink Functions will handle the encoding
// We return a JSON string that will be parsed in Solidity
// For better gas efficiency, consider using ABI encoding directly

return Functions.encodeString(JSON.stringify(result));

// Alternative approach: Return ABI-encoded data directly
// This requires using a library that supports ABI encoding in the Functions runtime
// For now, JSON encoding is more reliable and easier to debug

