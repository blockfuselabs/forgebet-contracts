import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
	console.log('🔍 Checking Match Result Status\n')

	const resultsConsumerAddress = process.env.RESULTS_CONSUMER_ADDRESS
	if (!resultsConsumerAddress) {
		throw new Error('RESULTS_CONSUMER_ADDRESS not set in .env')
	}

	const gameweek = process.env.GAMEWEEK ? parseInt(process.env.GAMEWEEK) : 1
	const matchId = process.env.MATCH_ID ? parseInt(process.env.MATCH_ID) : 1

	console.log(`Checking result for Gameweek ${gameweek}, Match ${matchId}...\n`)

	// Connect to contract
	const ResultsConsumer = await ethers.getContractFactory('ResultsConsumer')
	const resultsConsumer = ResultsConsumer.attach(resultsConsumerAddress)

	// Check if result exists
	const hasOutcome = await resultsConsumer.hasOutcome(gameweek, matchId)

	if (hasOutcome) {
		console.log('✅ Result found!\n')
		
		const outcome = await resultsConsumer.getOutcome(gameweek, matchId)
		
		console.log('📊 Match Result:')
		console.log('  Home Score:', outcome.homeScore.toString())
		console.log('  Away Score:', outcome.awayScore.toString())
		console.log('  Status:', outcome.status)
		console.log('  Timestamp:', outcome.timestamp.toString())
		console.log('  Exists:', outcome.exists)
		console.log('')
		
		// Determine winner
		if (outcome.status === 'FT') {
			if (outcome.homeScore > outcome.awayScore) {
				console.log('🏆 Result: HOME WIN')
			} else if (outcome.awayScore > outcome.homeScore) {
				console.log('🏆 Result: AWAY WIN')
			} else {
				console.log('🏆 Result: DRAW')
			}
		} else {
			console.log('⏳ Match Status:', outcome.status)
		}
	} else {
		console.log('⏳ Result not yet available')
		console.log('   The request is still being processed by Chainlink Functions.')
		console.log('   This typically takes 1-2 minutes.')
		console.log('')
		console.log('💡 Check status on: https://functions.chain.link/')
		console.log('   Or run this script again in a few minutes.')
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('❌ Error:', error.message)
		process.exit(1)
	})

