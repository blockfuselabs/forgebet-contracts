import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
	console.log('🚀 Testing Full Flow: Request → Fulfill → Settle\n')

	// Get network configuration
	const network = await ethers.provider.getNetwork()
	console.log(`Network: ${network.name} (${network.chainId})\n`)

	// Get contract addresses from environment
	const resultsConsumerAddress = process.env.RESULTS_CONSUMER_ADDRESS
	const predictionContractAddress = process.env.PREDICTION_CONTRACT_ADDRESS

	if (!resultsConsumerAddress || !predictionContractAddress) {
		throw new Error('Missing contract addresses in .env file.')
	}

	console.log('Contract Addresses:')
	console.log('  ResultsConsumer:', resultsConsumerAddress)
	console.log('  PredictionContract:', predictionContractAddress)
	console.log('')

	// Get signers
	const signers = await ethers.getSigners()
	const owner = signers[0]
	console.log('Using account:', owner.address)
	console.log('')

	// Connect to contracts
	const ResultsConsumer = await ethers.getContractFactory('ResultsConsumer')
	const resultsConsumer = ResultsConsumer.attach(resultsConsumerAddress)

	const PredictionContract = await ethers.getContractFactory('PredictionContract')
	const predictionContract = PredictionContract.attach(predictionContractAddress)

	// Test parameters
	const gameweek = 1
	const matchId = 1

	console.log('='.repeat(60))
	console.log('STEP 1: Request Match Result')
	console.log('='.repeat(60))
	console.log(`Requesting result for Gameweek ${gameweek}, Match ${matchId}...\n`)

	try {
		// Request the result
		const tx = await resultsConsumer.requestResult(gameweek, matchId)
		console.log('✅ Request sent! Transaction:', tx.hash)
		
		const receipt = await tx.wait()
		console.log('✅ Transaction confirmed in block:', receipt?.blockNumber)
		
		// Find the ResultRequested event
		const event = receipt?.logs.find((log: any) => {
			try {
				const parsed = resultsConsumer.interface.parseLog(log)
				return parsed?.name === 'ResultRequested'
			} catch {
				return false
			}
		})

		if (event) {
			const parsed = resultsConsumer.interface.parseLog(event)
			const requestId = parsed?.args[0]
			console.log('📋 Request ID:', requestId)
			console.log('')
			
			console.log('⏳ Waiting for Chainlink Functions to fulfill the request...')
			console.log('   This typically takes 1-2 minutes.')
			console.log('   You can check the status on Chainlink Functions App:')
			console.log('   https://functions.chain.link/\n')
			
			// Wait and poll for result
			let fulfilled = false
			let attempts = 0
			const maxAttempts = 60 // 5 minutes (5 second intervals)
			
			while (!fulfilled && attempts < maxAttempts) {
				await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
				attempts++
				
				const hasOutcome = await resultsConsumer.hasOutcome(gameweek, matchId)
				if (hasOutcome) {
					fulfilled = true
					console.log(`✅ Result fulfilled after ${attempts * 5} seconds!\n`)
					
					// Get the outcome
					const outcome = await resultsConsumer.getOutcome(gameweek, matchId)
					console.log('📊 Match Result:')
					console.log('  Home Score:', outcome.homeScore.toString())
					console.log('  Away Score:', outcome.awayScore.toString())
					console.log('  Status:', outcome.status)
					console.log('  Timestamp:', outcome.timestamp.toString())
					console.log('')
					
					// Now settle the match
					console.log('='.repeat(60))
					console.log('STEP 2: Settle Match')
					console.log('='.repeat(60))
					console.log('Settling match and distributing rewards...\n')
					
					try {
						const settleTx = await predictionContract.settleMatch(gameweek, matchId)
						console.log('✅ Settlement transaction sent:', settleTx.hash)
						
						const settleReceipt = await settleTx.wait()
						console.log('✅ Settlement confirmed in block:', settleReceipt?.blockNumber)
						
						// Check final contract balance
						const finalBalance = await predictionContract.getBalance()
						console.log('  Final contract balance:', ethers.formatEther(finalBalance), 'CELO')
						
						// Check bet statuses
						const bet0 = await predictionContract.getBet(0)
						const bet1 = await predictionContract.getBet(1)
						
						console.log('\n📊 Bet Results:')
						console.log('  Bet 0 (Bettor 1):')
						console.log('    Winner:', bet0.isWinner ? '✅ YES' : '❌ NO')
						console.log('    Settled:', bet0.isSettled ? '✅' : '❌')
						
						console.log('  Bet 1 (Bettor 2):')
						console.log('    Winner:', bet1.isWinner ? '✅ YES' : '❌ NO')
						console.log('    Settled:', bet1.isSettled ? '✅' : '❌')
						
						console.log('\n✅ Full flow completed successfully!')
						console.log('')
						console.log('🎉 Match settled! Winners have received their rewards.')
						
					} catch (settleError: any) {
						console.log('❌ Settlement failed:', settleError.message)
						console.log('   This might be because:')
						console.log('   - Match was already settled')
						console.log('   - No bets exist for this match')
						console.log('   - Other contract error')
					}
					
				} else {
					process.stdout.write(`\r⏳ Still waiting... (${attempts * 5}s)`)
				}
			}
			
			if (!fulfilled) {
				console.log('\n⏰ Timeout: Result not fulfilled within 5 minutes.')
				console.log('   The request may still be processing.')
				console.log('   Check Chainlink Functions App for status.')
				console.log('   You can manually check later with:')
				console.log(`   resultsConsumer.hasOutcome(${gameweek}, ${matchId})`)
			}
			
		} else {
			console.log('⚠️  Could not find ResultRequested event')
			console.log('   Request may have been sent, but event not found')
		}
		
	} catch (error: any) {
		console.log('❌ Error requesting result:', error.message)
		if (error.message.includes('insufficient funds')) {
			console.log('   💡 Make sure your Chainlink Functions subscription has LINK')
		} else if (error.message.includes('not authorized')) {
			console.log('   💡 Make sure ResultsConsumer is authorized in Chainlink Functions App')
		}
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('❌ Error:', error)
		process.exit(1)
	})

