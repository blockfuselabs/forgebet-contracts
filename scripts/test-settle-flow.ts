import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'

dotenv.config()

/**
 * Test script to simulate the full match settlement flow:
 * 1. Create a test match (place bets)
 * 2. Request result from Chainlink Functions
 * 3. Wait for fulfillment
 * 4. Settle the match
 * 5. Verify settlement
 */

interface TestConfig {
	gameweek: number
	matchId: number
	homeScore: number
	awayScore: number
	status: string
}

async function main() {
	console.log('🧪 Testing Full Match Settlement Flow\n')
	console.log('='.repeat(60))
	console.log('')

	// Configuration
	const resultsConsumerAddress = process.env.RESULTS_CONSUMER_ADDRESS || '0xaF404EA0C622c1bcd7ddca1DC866Ad2eAe248592'
	const predictionContractAddress = process.env.PREDICTION_CONTRACT_ADDRESS || '0xF6Ee0a3a8Ea1fE73D0DFfac8419bF676276D56cB'

	// Test match configuration
	const testMatch: TestConfig = {
		gameweek: 1,
		matchId: 999, // Use a high match ID that won't conflict with real matches
		homeScore: 2,
		awayScore: 1,
		status: 'FT',
	}

	console.log('📋 Test Configuration:')
	console.log(`  Gameweek: ${testMatch.gameweek}`)
	console.log(`  Match ID: ${testMatch.matchId}`)
	console.log(`  Expected Score: ${testMatch.homeScore} - ${testMatch.awayScore}`)
	console.log(`  Status: ${testMatch.status}`)
	console.log('')

	// Get signers
	const [signer, bettor2] = await ethers.getSigners()
	console.log('👤 Accounts:')
	console.log(`  Deployer/Owner: ${signer.address}`)
	console.log(`  Bettor 2: ${bettor2.address}`)
	console.log('')

	// Connect to contracts
	const ResultsConsumer = await ethers.getContractFactory('ResultsConsumer')
	const resultsConsumer = ResultsConsumer.attach(resultsConsumerAddress) as any

	const PredictionContract = await ethers.getContractFactory('PredictionContract')
	const predictionContract = PredictionContract.attach(predictionContractAddress) as any

	// ============================================
	// STEP 1: Check if result already exists
	// ============================================
	console.log('📋 STEP 1: Checking Current Status')
	console.log('-'.repeat(60))

	const hasOutcome = await resultsConsumer.hasOutcome(testMatch.gameweek, testMatch.matchId)
	const isSettled = await predictionContract.isMatchSettled(testMatch.gameweek, testMatch.matchId)

	console.log(`  Result exists: ${hasOutcome}`)
	console.log(`  Match settled: ${isSettled}`)
	console.log('')

	if (hasOutcome) {
		console.log('  ⚠️  Result already exists. Clearing it first...')
		// Note: We can't clear it, but we can use a different matchId or proceed
		console.log('  💡 Using matchId 999 for testing (should not exist)')
		console.log('')
	}

	// ============================================
	// STEP 2: Place Test Bets
	// ============================================
	console.log('📋 STEP 2: Placing Test Bets')
	console.log('-'.repeat(60))

	const betAmount = ethers.parseEther('0.001') // Small amount for testing

	try {
		// Bet 1: Home win (from signer)
		console.log(`  📤 Placing bet 1: Home win (${ethers.formatEther(betAmount)} ETH)...`)
		const tx1 = await predictionContract.placeBet(
			testMatch.gameweek,
			testMatch.matchId,
			0, // HOME
			{ value: betAmount }
		)
		const receipt1 = await tx1.wait()
		console.log(`     ✅ Bet 1 placed in block ${receipt1.blockNumber}`)

		// Bet 2: Away win (from bettor2)
		console.log(`  📤 Placing bet 2: Away win (${ethers.formatEther(betAmount)} ETH)...`)
		const tx2 = await predictionContract.connect(bettor2).placeBet(
			testMatch.gameweek,
			testMatch.matchId,
			2, // AWAY
			{ value: betAmount }
		)
		const receipt2 = await tx2.wait()
		console.log(`     ✅ Bet 2 placed in block ${receipt2.blockNumber}`)

		console.log('  ✅ Both bets placed successfully!')
		console.log('')
	} catch (error: any) {
		console.log(`  ❌ Error placing bets: ${error.message}`)
		console.log('     Continuing with result setting...')
		console.log('')
	}

	// ============================================
	// STEP 3: Set Result (Manual or Chainlink)
	// ============================================
	console.log('📋 STEP 3: Setting Match Result')
	console.log('-'.repeat(60))

	const useChainlink = process.env.USE_CHAINLINK === 'true'

	if (useChainlink) {
		console.log('  🔗 Using Chainlink Functions...')
		
		// Check authorization
		const isAuthorized = await resultsConsumer.authorizedCallers(signer.address)
		const owner = await resultsConsumer.owner()
		const isOwner = signer.address.toLowerCase() === owner.toLowerCase()

		if (!isAuthorized && !isOwner) {
			console.log('  ❌ Not authorized to request results')
			console.log('     Falling back to manual result setting...')
			console.log('')
			await setResultManually()
		} else {
			try {
				console.log('  📤 Requesting result from Chainlink Functions...')
				const tx = await resultsConsumer.requestResult(testMatch.gameweek, testMatch.matchId)
				const receipt = await tx.wait()
				console.log(`     ✅ Request sent: ${tx.hash}`)
				console.log('     ⏳ Waiting for Chainlink to fulfill...')

				// Wait for fulfillment (up to 5 minutes)
				let fulfilled = false
				let attempts = 0
				const maxAttempts = 60

				while (!fulfilled && attempts < maxAttempts) {
					await new Promise((resolve) => setTimeout(resolve, 5000))
					attempts++

					const hasOutcomeNow = await resultsConsumer.hasOutcome(testMatch.gameweek, testMatch.matchId)
					if (hasOutcomeNow) {
						fulfilled = true
						console.log(`     ✅ Result fulfilled after ${attempts * 5} seconds!`)
					} else {
						process.stdout.write(`\r     ⏳ Waiting... (${attempts * 5}s / ${maxAttempts * 5}s)`)
					}
				}

				if (!fulfilled) {
					console.log('\n     ⏰ Timeout: Chainlink did not fulfill in time')
					console.log('     Falling back to manual result setting...')
					console.log('')
					await setResultManually()
				}
			} catch (error: any) {
				console.log(`     ❌ Chainlink request failed: ${error.message}`)
				console.log('     Falling back to manual result setting...')
				console.log('')
				await setResultManually()
			}
		}
	} else {
		console.log('  ✋ Using Manual Result Setting (fallback)...')
		await setResultManually()
	}

	async function setResultManually() {
		try {
			console.log('  📝 Setting result manually...')
			const tx = await resultsConsumer.setResultManually(
				testMatch.gameweek,
				testMatch.matchId,
				testMatch.homeScore,
				testMatch.awayScore,
				testMatch.status
			)
			const receipt = await tx.wait()
			console.log(`     ✅ Result set in block ${receipt.blockNumber}`)
			console.log('')
		} catch (error: any) {
			console.log(`     ❌ Failed to set result manually: ${error.message}`)
			throw error
		}
	}

	// ============================================
	// STEP 4: Verify Result
	// ============================================
	console.log('📋 STEP 4: Verifying Result')
	console.log('-'.repeat(60))

	const hasOutcomeNow = await resultsConsumer.hasOutcome(testMatch.gameweek, testMatch.matchId)
	if (!hasOutcomeNow) {
		console.log('  ❌ Result was not set!')
		return
	}

	const outcome = await resultsConsumer.getOutcome(testMatch.gameweek, testMatch.matchId)
	console.log('  ✅ Result verified:')
	console.log(`     Home Score: ${outcome.homeScore}`)
	console.log(`     Away Score: ${outcome.awayScore}`)
	console.log(`     Status: ${outcome.status}`)
	console.log(`     Timestamp: ${outcome.timestamp}`)
	console.log('')

	// ============================================
	// STEP 5: Settle Match
	// ============================================
	console.log('📋 STEP 5: Settling Match')
	console.log('-'.repeat(60))

	const isSettledNow = await predictionContract.isMatchSettled(testMatch.gameweek, testMatch.matchId)
	if (isSettledNow) {
		console.log('  ⚠️  Match already settled')
	} else {
		try {
			console.log('  📤 Calling settleMatch...')
			const tx = await predictionContract.settleMatch(testMatch.gameweek, testMatch.matchId)
			const receipt = await tx.wait()
			console.log(`     ✅ Match settled in block ${receipt.blockNumber}`)
			console.log(`     Gas used: ${receipt.gasUsed.toString()}`)
			console.log('')

			// Check for events
			const matchSettledEvent = receipt.logs.find((log: any) => {
				try {
					const parsed = predictionContract.interface.parseLog(log)
					return parsed?.name === 'MatchSettled'
				} catch {
					return false
				}
			})

			if (matchSettledEvent) {
				const parsed = predictionContract.interface.parseLog(matchSettledEvent)
				console.log('  📊 Settlement Details:')
				console.log(`     Outcome: ${parsed?.args[2]}`) // MatchOutcome enum
				console.log(`     Total Winners: ${parsed?.args[3]?.toString()}`)
				console.log(`     Total Amount: ${ethers.formatEther(parsed?.args[4] || 0n)} ETH`)
				console.log('')
			}
		} catch (error: any) {
			console.log(`     ❌ Failed to settle match: ${error.message}`)
			if (error.message.includes('MatchNotFulfilled')) {
				console.log('     💡 This means the result was not properly set in ResultsConsumer')
			}
			throw error
		}
	}

	// ============================================
	// STEP 6: Verify Settlement
	// ============================================
	console.log('📋 STEP 6: Verifying Settlement')
	console.log('-'.repeat(60))

	const isSettledFinal = await predictionContract.isMatchSettled(testMatch.gameweek, testMatch.matchId)
	console.log(`  Match settled: ${isSettledFinal}`)

	// Check bet status
	const nextBetId = await predictionContract.nextBetId()
	console.log(`  Total bets: ${nextBetId.toString()}`)

	// Try to get a few bets to check their status
	for (let i = 0; i < Number(nextBetId) && i < 10; i++) {
		try {
			const bet = await predictionContract.getBet(BigInt(i))
			if (Number(bet.gameweek) === testMatch.gameweek && Number(bet.matchId) === testMatch.matchId) {
				console.log(`  Bet ${i}:`)
				console.log(`    Bettor: ${bet.bettor}`)
				console.log(`    Prediction: ${bet.prediction}`)
				console.log(`    Amount: ${ethers.formatEther(bet.amount)} ETH`)
				console.log(`    Settled: ${bet.isSettled}`)
				console.log(`    Winner: ${bet.isWinner}`)
			}
		} catch {
			// Skip invalid bets
		}
	}
	console.log('')

	// ============================================
	// SUMMARY
	// ============================================
	console.log('📋 SUMMARY')
	console.log('='.repeat(60))
	console.log('')

	if (hasOutcomeNow && isSettledFinal) {
		console.log('  ✅ SUCCESS: Full flow completed!')
		console.log('     - Result was set')
		console.log('     - Match was settled')
		console.log('     - Winners should have received payouts')
	} else {
		console.log('  ⚠️  PARTIAL SUCCESS:')
		if (hasOutcomeNow) {
			console.log('     ✅ Result was set')
		} else {
			console.log('     ❌ Result was not set')
		}
		if (isSettledFinal) {
			console.log('     ✅ Match was settled')
		} else {
			console.log('     ❌ Match was not settled')
		}
	}
	console.log('')

	console.log('  📊 Contract Addresses:')
	console.log(`     ResultsConsumer: ${resultsConsumerAddress}`)
	console.log(`     PredictionContract: ${predictionContractAddress}`)
	console.log('')
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('\n❌ Fatal Error:', error)
		process.exit(1)
	})

