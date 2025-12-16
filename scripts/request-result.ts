import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
	console.log('📡 Requesting Match Result from Chainlink Functions\n')

	// Get contract addresses
	const resultsConsumerAddress = process.env.RESULTS_CONSUMER_ADDRESS
	if (!resultsConsumerAddress) {
		throw new Error('RESULTS_CONSUMER_ADDRESS not set in .env')
	}

	// Get signers
	const [signer] = await ethers.getSigners()
	console.log('Account:', signer.address)
	console.log('')

	// Connect to contract
	const ResultsConsumer = await ethers.getContractFactory('ResultsConsumer')
	const resultsConsumer = ResultsConsumer.attach(resultsConsumerAddress)

	// Check configuration
	console.log('📋 Checking Configuration...')
	const subscriptionId = await resultsConsumer.s_subscriptionId()
	const isAuthorized = await resultsConsumer.authorizedCallers(signer.address)
	const owner = await resultsConsumer.owner()
	
	console.log('  Subscription ID:', subscriptionId.toString())
	console.log('  Is caller authorized?', isAuthorized)
	console.log('  Is caller owner?', signer.address.toLowerCase() === owner.toLowerCase())
	console.log('')

	if (subscriptionId === 0n) {
		throw new Error('Subscription ID not set! Set it first with setSubscriptionId()')
	}

	if (!isAuthorized && signer.address.toLowerCase() !== owner.toLowerCase()) {
		throw new Error('Caller is not authorized! Only owner or authorized callers can request results.')
	}

	// Get gameweek and matchId from environment or use defaults
	const gameweek = process.env.GAMEWEEK ? parseInt(process.env.GAMEWEEK) : 1
	const matchId = process.env.MATCH_ID ? parseInt(process.env.MATCH_ID) : 1

	console.log('🚀 Requesting Result...')
	console.log(`  Gameweek: ${gameweek}`)
	console.log(`  Match ID: ${matchId}`)
	console.log('')

	try {
		// Estimate gas first
		console.log('⛽ Estimating gas...')
		const gasEstimate = await resultsConsumer.requestResult.estimateGas(gameweek, matchId)
		console.log('  Estimated gas:', gasEstimate.toString())
		console.log('')

		// Send the request
		console.log('📤 Sending request transaction...')
		const tx = await resultsConsumer.requestResult(gameweek, matchId, {
			gasLimit: gasEstimate * 2n, // Add buffer
		})
		
		console.log('✅ Transaction sent!')
		console.log('  Hash:', tx.hash)
		console.log('  Waiting for confirmation...')
		console.log('')

		const receipt = await tx.wait()
		console.log('✅ Transaction confirmed!')
		console.log('  Block:', receipt?.blockNumber)
		console.log('  Gas used:', receipt?.gasUsed.toString())
		console.log('')

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
			const eventGameweek = parsed?.args[1]
			const eventMatchId = parsed?.args[2]

			console.log('📋 Request Details:')
			console.log('  Request ID:', requestId)
			console.log('  Gameweek:', eventGameweek.toString())
			console.log('  Match ID:', eventMatchId.toString())
			console.log('')

			console.log('⏳ Waiting for Chainlink Functions to process...')
			console.log('   This typically takes 1-2 minutes.')
			console.log('   Monitor on: https://functions.chain.link/')
			console.log('')

			// Poll for result
			let fulfilled = false
			let attempts = 0
			const maxAttempts = 60

			while (!fulfilled && attempts < maxAttempts) {
				await new Promise(resolve => setTimeout(resolve, 5000))
				attempts++

				const hasOutcome = await resultsConsumer.hasOutcome(gameweek, matchId)
				if (hasOutcome) {
					fulfilled = true
					console.log(`\n✅ Result fulfilled after ${attempts * 5} seconds!`)

					const outcome = await resultsConsumer.getOutcome(gameweek, matchId)
					console.log('\n📊 Match Result:')
					console.log('  Home Score:', outcome.homeScore.toString())
					console.log('  Away Score:', outcome.awayScore.toString())
					console.log('  Status:', outcome.status)
					console.log('  Timestamp:', outcome.timestamp.toString())
				} else {
					process.stdout.write(`\r⏳ Waiting... (${attempts * 5}s / ${maxAttempts * 5}s)`)
				}
			}

			if (!fulfilled) {
				console.log('\n⏰ Timeout: Result not fulfilled yet.')
				console.log('   The request is still processing.')
				console.log('   Check status later with: npm run test:live')
			}
		} else {
			console.log('⚠️  ResultRequested event not found in transaction')
			console.log('   Transaction may have failed or event was not emitted')
		}

	} catch (error: any) {
		console.log('\n❌ Error:', error.message)
		
		if (error.message.includes('insufficient funds') || error.message.includes('balance')) {
			console.log('\n💡 Possible issues:')
			console.log('   1. Subscription doesn\'t have enough LINK')
			console.log('   2. Check subscription balance on Chainlink Functions App')
		} else if (error.message.includes('not authorized') || error.message.includes('Unauthorized')) {
			console.log('\n💡 Authorization issue:')
			console.log('   1. Make sure ResultsConsumer is authorized in Chainlink Functions App')
			console.log('   2. Or call as the contract owner')
		} else if (error.message.includes('revert')) {
			console.log('\n💡 Transaction reverted. Possible reasons:')
			console.log('   1. Subscription not authorized in Chainlink Functions App')
			console.log('   2. Subscription doesn\'t have LINK')
			console.log('   3. Invalid gameweek or matchId')
			console.log('   4. Check contract on CeloScan for more details')
		}
		
		throw error
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})

