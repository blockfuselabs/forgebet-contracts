import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'

dotenv.config()

/**
 * Enhanced debugging script for Chainlink Functions requests
 * This script will:
 * 1. Check all configuration
 * 2. Request results for specified matches
 * 3. Monitor request status
 * 4. Check for errors and provide debugging info
 */

interface MatchInfo {
	gameweek: number
	matchId: number
	name: string
}

async function main() {
	console.log('🔍 Chainlink Functions Request Debugger\n')
	console.log('=' .repeat(60))
	console.log('')

	// Get contract addresses
	const resultsConsumerAddress = process.env.RESULTS_CONSUMER_ADDRESS || '0xaF404EA0C622c1bcd7ddca1DC866Ad2eAe248592'
	const predictionContractAddress = process.env.PREDICTION_CONTRACT_ADDRESS || '0xF6Ee0a3a8Ea1fE73D0DFfac8419bF676276D56cB'

	console.log('📋 Contract Addresses:')
	console.log('  ResultsConsumer:', resultsConsumerAddress)
	console.log('  PredictionContract:', predictionContractAddress)
	console.log('')

	// Get signers
	const [signer] = await ethers.getSigners()
	console.log('👤 Account:', signer.address)
	console.log('  Balance:', ethers.formatEther(await ethers.provider.getBalance(signer.address)), 'ETH')
	console.log('')

	// Connect to contracts
	const ResultsConsumer = await ethers.getContractFactory('ResultsConsumer')
	const resultsConsumer = ResultsConsumer.attach(resultsConsumerAddress) as any

	const PredictionContract = await ethers.getContractFactory('PredictionContract')
	const predictionContract = PredictionContract.attach(predictionContractAddress) as any

	// ============================================
	// STEP 1: Check Configuration
	// ============================================
	console.log('📋 STEP 1: Checking Configuration...')
	console.log('-'.repeat(60))

	try {
		const subscriptionId = await resultsConsumer.s_subscriptionId()
		const donId = await resultsConsumer.s_donId()
		const callbackGasLimit = await resultsConsumer.s_callbackGasLimit()
		const requestConfirmations = await resultsConsumer.s_requestConfirmations()
		const owner = await resultsConsumer.owner()
		const isAuthorized = await resultsConsumer.authorizedCallers(signer.address)
		
		// Try to get router address (FunctionsClient should have this)
		let router = 'N/A'
		try {
			router = await resultsConsumer.getRouter()
		} catch {
			// Fallback to known router address
			router = '0xf9B8fc078197181C841c296C876945aaa425B278'
		}

		console.log('  ✅ Subscription ID:', subscriptionId.toString())
		console.log('  ✅ DON ID:', ethers.hexlify(donId))
		console.log('  ✅ Callback Gas Limit:', callbackGasLimit.toString())
		console.log('  ✅ Request Confirmations:', requestConfirmations.toString())
		console.log('  ✅ Router Address:', router)
		console.log('  ✅ Owner:', owner)
		console.log('  ✅ Is Authorized:', isAuthorized)
		console.log('  ✅ Is Owner:', signer.address.toLowerCase() === owner.toLowerCase())
		console.log('')

		if (subscriptionId === 0n) {
			console.log('  ❌ ERROR: Subscription ID is not set!')
			console.log('     Run: npx hardhat run scripts/set-subscription.ts --network base-sepolia')
			console.log('')
			return
		}

		if (!isAuthorized && signer.address.toLowerCase() !== owner.toLowerCase()) {
			console.log('  ❌ ERROR: Caller is not authorized!')
			console.log('     Only owner or authorized callers can request results.')
			console.log('     Owner:', owner)
			console.log('     Your address:', signer.address)
			console.log('')
			return
		}

		console.log('  ✅ Configuration looks good!')
		console.log('')
	} catch (error: any) {
		console.log('  ❌ Error checking configuration:', error.message)
		console.log('')
		return
	}

	// ============================================
	// STEP 2: Define Matches to Check
	// ============================================
	console.log('📋 STEP 2: Matches to Request')
	console.log('-'.repeat(60))

	// Get matches from environment or use defaults (your problematic matches)
	const matches: MatchInfo[] = []

	// Check if specific matches provided via env
	if (process.env.MATCHES) {
		const matchStrings = process.env.MATCHES.split(',')
		for (const matchStr of matchStrings) {
			const [gw, mid] = matchStr.split('-').map(Number)
			if (gw && mid) {
				matches.push({ gameweek: gw, matchId: mid, name: `Match ${gw}-${mid}` })
			}
		}
	} else {
		// Default: your problematic matches
		matches.push(
			{ gameweek: 1, matchId: 124, name: 'Crystal Palace vs Man Utd' },
			{ gameweek: 1, matchId: 121, name: 'Aston Villa vs Wolves' },
			{ gameweek: 1, matchId: 127, name: "Nott'm Forest vs Brighton" },
			{ gameweek: 1, matchId: 130, name: 'West Ham vs Liverpool' },
		)
	}

	console.log(`  Found ${matches.length} matches to check:`)
	matches.forEach((m, i) => {
		console.log(`    ${i + 1}. Gameweek ${m.gameweek}, Match ${m.matchId} - ${m.name}`)
	})
	console.log('')

	// ============================================
	// STEP 3: Check Current Status
	// ============================================
	console.log('📋 STEP 3: Current Status Check')
	console.log('-'.repeat(60))

	for (const match of matches) {
		try {
			const hasOutcome = await resultsConsumer.hasOutcome(match.gameweek, match.matchId)
			const isSettled = await predictionContract.isMatchSettled(match.gameweek, match.matchId)

			if (hasOutcome) {
				const outcome = await resultsConsumer.getOutcome(match.gameweek, match.matchId)
				console.log(`  ✅ Match ${match.gameweek}-${match.matchId}:`)
				console.log(`     Outcome exists: ${outcome.homeScore} - ${outcome.awayScore}`)
				console.log(`     Status: ${outcome.status}`)
				console.log(`     Settled in contract: ${isSettled}`)
			} else {
				console.log(`  ⏳ Match ${match.gameweek}-${match.matchId}: No outcome yet`)
				console.log(`     Settled in contract: ${isSettled}`)
			}
		} catch (error: any) {
			console.log(`  ❌ Error checking match ${match.gameweek}-${match.matchId}:`, error.message)
		}
	}
	console.log('')

	// ============================================
	// STEP 4: Request Results
	// ============================================
	console.log('📋 STEP 4: Requesting Results from Chainlink Functions')
	console.log('-'.repeat(60))
	console.log('')

	const requestResults: Array<{ match: MatchInfo; requestId?: string; txHash?: string; error?: string }> = []

	for (const match of matches) {
		// Skip if outcome already exists
		const hasOutcome = await resultsConsumer.hasOutcome(match.gameweek, match.matchId)
		if (hasOutcome) {
			console.log(`  ⏭️  Skipping ${match.name} (${match.gameweek}-${match.matchId}) - outcome already exists`)
			requestResults.push({ match })
			continue
		}

		try {
			console.log(`  📤 Requesting result for ${match.name} (${match.gameweek}-${match.matchId})...`)

			// Estimate gas
			const gasEstimate = await resultsConsumer.requestResult.estimateGas(match.gameweek, match.matchId)
			console.log(`     Gas estimate: ${gasEstimate.toString()}`)

			// Send request
			const tx = await resultsConsumer.requestResult(match.gameweek, match.matchId, {
				gasLimit: gasEstimate * 2n,
			})

			console.log(`     ✅ Transaction sent: ${tx.hash}`)
			console.log(`     Waiting for confirmation...`)

			const receipt = await tx.wait()
			console.log(`     ✅ Confirmed in block ${receipt?.blockNumber}`)

			// Find ResultRequested event
			const eventLog = receipt?.logs.find((log: any) => {
				try {
					const parsed = resultsConsumer.interface.parseLog(log)
					return parsed?.name === 'ResultRequested'
				} catch {
					return false
				}
			})

			if (eventLog) {
				const parsed = resultsConsumer.interface.parseLog(eventLog)
				const requestId = parsed?.args[0]
				console.log(`     📋 Request ID: ${ethers.hexlify(requestId)}`)
				console.log('')

				requestResults.push({
					match,
					requestId: ethers.hexlify(requestId),
					txHash: tx.hash,
				})
			} else {
				console.log(`     ⚠️  ResultRequested event not found`)
				requestResults.push({
					match,
					txHash: tx.hash,
					error: 'Event not found',
				})
			}
		} catch (error: any) {
			console.log(`     ❌ Error: ${error.message}`)
			requestResults.push({
				match,
				error: error.message,
			})

			// Provide helpful error messages
			if (error.message.includes('insufficient funds') || error.message.includes('balance')) {
				console.log(`     💡 Subscription may not have enough LINK`)
			} else if (error.message.includes('not authorized') || error.message.includes('Unauthorized')) {
				console.log(`     💡 Authorization issue - check Chainlink Functions App`)
			} else if (error.message.includes('revert')) {
				console.log(`     💡 Transaction reverted - check contract on BaseScan`)
			}
			console.log('')
		}
	}

	// ============================================
	// STEP 5: Monitor Requests
	// ============================================
	console.log('📋 STEP 5: Monitoring Request Status')
	console.log('-'.repeat(60))
	console.log('')
	console.log('⏳ Waiting for Chainlink Functions to process requests...')
	console.log('   This typically takes 1-2 minutes.')
	console.log('   Monitor on: https://functions.chain.link/')
	console.log('')

	const requestsToMonitor = requestResults.filter((r) => r.requestId && !r.error)

	if (requestsToMonitor.length === 0) {
		console.log('  ⚠️  No requests to monitor (all either failed or already have outcomes)')
		console.log('')
	} else {
		console.log(`  Monitoring ${requestsToMonitor.length} request(s)...`)
		console.log('')

		let allFulfilled = false
		let attempts = 0
		const maxAttempts = 60 // 5 minutes

		while (!allFulfilled && attempts < maxAttempts) {
			await new Promise((resolve) => setTimeout(resolve, 5000))
			attempts++

			allFulfilled = true

			for (const result of requestsToMonitor) {
				if (!result.requestId) continue

				try {
					const hasOutcome = await resultsConsumer.hasOutcome(result.match.gameweek, result.match.matchId)

					if (hasOutcome) {
						if (!result.error) {
							// Only log once
							const outcome = await resultsConsumer.getOutcome(result.match.gameweek, result.match.matchId)
							console.log(`  ✅ ${result.match.name} (${result.match.gameweek}-${result.match.matchId}):`)
							console.log(`     Result: ${outcome.homeScore} - ${outcome.awayScore}`)
							console.log(`     Status: ${outcome.status}`)
							console.log(`     Fulfilled after ${attempts * 5} seconds`)
							console.log('')
							result.error = 'FULFILLED' // Mark as fulfilled
						}
					} else {
						allFulfilled = false
					}
				} catch (error: any) {
					console.log(`  ❌ Error checking ${result.match.name}: ${error.message}`)
					allFulfilled = false
				}
			}

			if (!allFulfilled) {
				const pending = requestsToMonitor.filter((r) => r.error !== 'FULFILLED').length
				process.stdout.write(`\r  ⏳ Waiting... (${attempts * 5}s / ${maxAttempts * 5}s) - ${pending} pending`)
			}
		}

		console.log('')

		if (allFulfilled) {
			console.log('  ✅ All requests fulfilled!')
		} else {
			console.log('  ⏰ Timeout: Some requests are still pending.')
			console.log('     Check status later or on Chainlink Functions dashboard.')
		}
		console.log('')
	}

	// ============================================
	// STEP 6: Summary
	// ============================================
	console.log('📋 STEP 6: Summary')
	console.log('-'.repeat(60))
	console.log('')

	for (const result of requestResults) {
		if (result.error === 'FULFILLED') {
			console.log(`  ✅ ${result.match.name}: Fulfilled`)
		} else if (result.error) {
			console.log(`  ❌ ${result.match.name}: ${result.error}`)
		} else if (result.requestId) {
			console.log(`  ⏳ ${result.match.name}: Request sent (ID: ${result.requestId})`)
		} else {
			console.log(`  ⏭️  ${result.match.name}: Skipped (outcome exists)`)
		}
	}
	console.log('')

	// ============================================
	// STEP 7: Next Steps
	// ============================================
	console.log('📋 STEP 7: Next Steps')
	console.log('-'.repeat(60))
	console.log('')

	const fulfilledMatches = requestResults.filter((r) => r.error === 'FULFILLED')
	const pendingMatches = requestResults.filter((r) => r.requestId && r.error !== 'FULFILLED' && !r.error)

	if (fulfilledMatches.length > 0) {
		console.log('  ✅ You can now settle these matches:')
		fulfilledMatches.forEach((r) => {
			console.log(`     - Gameweek ${r.match.gameweek}, Match ${r.match.matchId}`)
		})
		console.log('')
	}

	if (pendingMatches.length > 0) {
		console.log('  ⏳ These requests are still processing:')
		pendingMatches.forEach((r) => {
			console.log(`     - ${r.match.name} (Request ID: ${r.requestId})`)
		})
		console.log('     Check status on: https://functions.chain.link/')
		console.log('')
	}

	const failedMatches = requestResults.filter((r) => r.error && r.error !== 'FULFILLED')
	if (failedMatches.length > 0) {
		console.log('  ❌ These requests failed:')
		failedMatches.forEach((r) => {
			console.log(`     - ${r.match.name}: ${r.error}`)
		})
		console.log('')
		console.log('  💡 Troubleshooting:')
		console.log('     1. Check subscription balance on Chainlink Functions App')
		console.log('     2. Verify subscription ID is correct')
		console.log('     3. Check if your address is authorized')
		console.log('     4. Review transaction on BaseScan for detailed error')
		console.log('')
	}

	console.log('  📊 Check contract status:')
	console.log(`     ResultsConsumer: https://sepolia.basescan.org/address/${resultsConsumerAddress}`)
	console.log(`     PredictionContract: https://sepolia.basescan.org/address/${predictionContractAddress}`)
	console.log('')
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('\n❌ Fatal Error:', error)
		process.exit(1)
	})

