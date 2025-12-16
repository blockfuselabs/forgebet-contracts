import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
	console.log('🧪 Testing Live Contracts on Base Sepolia...\n')

	// Get network configuration
	const network = await ethers.provider.getNetwork()
	console.log(`Network: ${network.name} (${network.chainId})\n`)

	// Get contract addresses from environment
	const resultsConsumerAddress = process.env.RESULTS_CONSUMER_ADDRESS
	const predictionContractAddress = process.env.PREDICTION_CONTRACT_ADDRESS

	if (!resultsConsumerAddress || !predictionContractAddress) {
		throw new Error('Missing contract addresses in .env file. Please deploy contracts first.')
	}

	console.log('Contract Addresses:')
	console.log('  ResultsConsumer:', resultsConsumerAddress)
	console.log('  PredictionContract:', predictionContractAddress)
	console.log('')

	// Get signers
	const signers = await ethers.getSigners()
	const owner = signers[0]
	const bettor1 = signers[1] || owner

	// Allow overriding bettor2 via env (private key)
	const provider = ethers.provider
	const bettor2EnvKey = process.env.BETTOR2_PRIVATE_KEY
	const bettor2DesiredAddress = process.env.BETTOR2_ADDRESS
	const bettor2Wallet = bettor2EnvKey ? new ethers.Wallet(bettor2EnvKey, provider) : null
	const bettor2 = bettor2Wallet || signers[2] || owner

	if (bettor2DesiredAddress && bettor2.address.toLowerCase() !== bettor2DesiredAddress.toLowerCase()) {
		console.warn(`⚠️ Bettor2 address mismatch. Using ${bettor2.address}, desired ${bettor2DesiredAddress}. Provide BETTOR2_PRIVATE_KEY matching desired address.`)
	}
	console.log('Test Accounts:')
	console.log('  Owner:', owner.address)
	console.log('  Bettor 1:', bettor1.address)
	console.log('  Bettor 2:', bettor2.address)
	console.log('')

	// Connect to contracts
	const ResultsConsumer = await ethers.getContractFactory('ResultsConsumer')
	const resultsConsumer = ResultsConsumer.attach(resultsConsumerAddress)

	const PredictionContract = await ethers.getContractFactory('PredictionContract')
	const predictionContract = PredictionContract.attach(predictionContractAddress)

	// Test 1: Check contract configuration
	console.log('📋 Test 1: Checking Contract Configuration')
	console.log('─'.repeat(50))
	const donId = await resultsConsumer.s_donId()
	const subscriptionId = await resultsConsumer.s_subscriptionId()
	const callbackGasLimit = await resultsConsumer.s_callbackGasLimit()
	const contractOwner = await resultsConsumer.owner()
	const isAuthorized = await resultsConsumer.authorizedCallers(predictionContractAddress)
	
	console.log('  DON ID:', donId)
	console.log('  Subscription ID:', subscriptionId.toString())
	console.log('  Callback Gas Limit:', callbackGasLimit.toString())
	console.log('  Owner:', contractOwner)
	console.log('  Is PredictionContract authorized?', isAuthorized)
	console.log('✅ Configuration check complete\n')

	// Test 2: Check balances
	console.log('💰 Test 2: Checking Account Balances')
	console.log('─'.repeat(50))
	const ownerBalance = await ethers.provider.getBalance(owner.address)
	const bettor1Balance = await ethers.provider.getBalance(bettor1.address)
	const bettor2Balance = await ethers.provider.getBalance(bettor2.address)
	console.log('  Owner balance:', ethers.formatEther(ownerBalance), 'ETH')
	console.log('  Bettor 1 balance:', ethers.formatEther(bettor1Balance), 'ETH')
	console.log('  Bettor 2 balance:', ethers.formatEther(bettor2Balance), 'ETH')
	console.log('✅ Balance check complete\n')

	// Test 3: Place bets (if we have enough balance)
	console.log('🎲 Test 3: Placing Test Bets')
	console.log('─'.repeat(50))
	const betAmount = ethers.parseEther('0.0001') // Smaller amount for testing on Base Sepolia

	if (bettor1Balance < betAmount || bettor2Balance < betAmount) {
		console.log('  ⚠️  Insufficient balance for betting. Skipping bet placement.')
		console.log('  💡 Get testnet ETH for Base Sepolia from a faucet.\n')
	} else {
		try {
			const gameweek = 1
			const matchId = 1

			// Bettor 1 places bet on HOME
			console.log('  Bettor 1 placing bet on HOME...')
			const tx1 = await predictionContract.connect(bettor1).placeBet(gameweek, matchId, 0, { value: betAmount })
			const receipt1 = await tx1.wait()
			console.log('  ✅ Bet placed! Tx:', receipt1?.hash)
			const bet1 = await predictionContract.getBet(0)
			console.log('  Bet ID: 0, Amount:', ethers.formatEther(bet1.amount), 'ETH')

			// Bettor 2 places bet on AWAY
			console.log('  Bettor 2 placing bet on AWAY...')
			const tx2 = await predictionContract.connect(bettor2).placeBet(gameweek, matchId, 2, { value: betAmount })
			const receipt2 = await tx2.wait()
			console.log('  ✅ Bet placed! Tx:', receipt2?.hash)
			const bet2 = await predictionContract.getBet(1)
			console.log('  Bet ID: 1, Amount:', ethers.formatEther(bet2.amount), 'ETH')

			const contractBalance = await predictionContract.getBalance()
			console.log('  Contract balance:', ethers.formatEther(contractBalance), 'ETH')
			console.log('✅ Bet placement complete\n')
		} catch (error: any) {
			console.log('  ❌ Error placing bets:', error.message)
			console.log('')
		}
	}

	// Test 4: Check if outcome exists
	console.log('🔍 Test 4: Checking Match Outcomes')
	console.log('─'.repeat(50))
	const testGameweek = 1
	const testMatchId = 1
	const hasOutcome = await resultsConsumer.hasOutcome(testGameweek, testMatchId)
	console.log(`  Has outcome for gameweek ${testGameweek}, match ${testMatchId}?`, hasOutcome)

	if (hasOutcome) {
		const outcome = await resultsConsumer.getOutcome(testGameweek, testMatchId)
		console.log('  Home Score:', outcome.homeScore.toString())
		console.log('  Away Score:', outcome.awayScore.toString())
		console.log('  Status:', outcome.status)
		console.log('  Timestamp:', outcome.timestamp.toString())
	} else {
		console.log('  No outcome available yet. Request result first.')
	}
	console.log('✅ Outcome check complete\n')

	// Test 5: Test request result (if subscription is set)
	console.log('📡 Test 5: Testing Result Request')
	console.log('─'.repeat(50))
	const subId = await resultsConsumer.s_subscriptionId()
	if (subId === 0n) {
		console.log('  ⚠️  Subscription ID not set. Cannot test request.')
		console.log('  💡 Set CHAINLINK_SUBSCRIPTION_ID in .env and call setSubscriptionId()\n')
	} else {
		console.log('  Subscription ID is set:', subId.toString())
		console.log('  💡 To request a result, call: requestResult(gameweek, matchId)')
		console.log('  ⚠️  This will cost LINK from your subscription\n')
	}

	// Summary
	console.log('📊 Test Summary')
	console.log('─'.repeat(50))
	console.log('✅ All basic tests completed!')
	console.log('')
	console.log('Next Steps:')
	console.log('1. Fund your Chainlink Functions subscription with LINK')
	console.log('2. Request a match result: requestResult(gameweek, matchId)')
	console.log('3. Wait for Chainlink Functions to fulfill the request')
	console.log('4. Settle the match: settleMatch(gameweek, matchId)')
	console.log('')
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('❌ Error:', error)
		process.exit(1)
	})

