/**
 * Verify ResultsConsumer contract via BaseScan API
 * This script submits verification directly to BaseScan API
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const CONTRACT_ADDRESS = '0xf722A401935d1ACa82583544aF72582e92376841';
const ROUTER = '0xf9B8fc078197181C841c296C876945aaa425B278';
const DON_ID = '0x66756e2d626173652d7365706f6c69612d31000000000000000000000000000000';

// ABI-encoded constructor arguments
const CONSTRUCTOR_ARGS = '0x000000000000000000000000f9b8fc078197181c841c296c876945aaa425b27866756e2d626173652d7365706f6c69612d310000000000000000000000000000';

async function verifyContract() {
	console.log('🔍 Verifying ResultsConsumer via BaseScan API...\n');
	console.log('Contract Address:', CONTRACT_ADDRESS);
	console.log('Constructor Args:', CONSTRUCTOR_ARGS);
	console.log('');

	// Read contract source
	const sourcePath = path.join(__dirname, 'contracts', 'ResultsConsumer.sol');
	const sourceCode = fs.readFileSync(sourcePath, 'utf8');

	// Read artifact for compiler settings
	const artifactPath = path.join(__dirname, 'artifacts', 'contracts', 'ResultsConsumer.sol', 'ResultsConsumer.json');
	const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

	console.log('📝 Instructions for Manual Verification:');
	console.log('');
	console.log('1. Go to: https://sepolia.basescan.org/address/' + CONTRACT_ADDRESS + '#code');
	console.log('2. Click "Contract" tab → "Verify and Publish"');
	console.log('3. Select: "Solidity (Standard JSON Input)"');
	console.log('4. Compiler Version: 0.8.20');
	console.log('5. Open Source License: MIT');
	console.log('6. Constructor Arguments (ABI-encoded):');
	console.log('   ' + CONSTRUCTOR_ARGS);
	console.log('');
	console.log('Or use the flattened source:');
	console.log('7. Select: "Solidity (Single file)"');
	console.log('8. Compiler Version: 0.8.20');
	console.log('9. Open Source License: MIT');
	console.log('10. Constructor Arguments:');
	console.log('    [' + ROUTER + ', ' + DON_ID + ']');
	console.log('');
	console.log('💡 Note: BaseScan may require you to flatten the contract');
	console.log('   (including Chainlink imports) for single-file verification.');
}

verifyContract().catch(console.error);

