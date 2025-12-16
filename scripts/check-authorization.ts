import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
	console.log('🔍 Checking Chainlink Functions Authorization\n')

	const resultsConsumerAddress = process.env.RESULTS_CONSUMER_ADDRESS
	if (!resultsConsumerAddress) {
		throw new Error('RESULTS_CONSUMER_ADDRESS not set in .env')
	}

	console.log('ResultsConsumer Address:', resultsConsumerAddress)
	console.log('')

	// Connect to Chainlink Functions Router to check subscription
	const functionsRouterAddress = process.env.CHAINLINK_FUNCTIONS_ROUTER
	const subscriptionId = process.env.CHAINLINK_SUBSCRIPTION_ID

	if (!functionsRouterAddress || !subscriptionId) {
		throw new Error('Missing CHAINLINK_FUNCTIONS_ROUTER or CHAINLINK_SUBSCRIPTION_ID in .env')
	}

	console.log('📋 Configuration:')
	console.log('  Functions Router:', functionsRouterAddress)
	console.log('  Subscription ID:', subscriptionId)
	console.log('')

	// Try to check if consumer is authorized
	// Note: We need the FunctionsRouter ABI to check this
	console.log('⚠️  IMPORTANT: Authorization Check')
	console.log('='.repeat(60))
	console.log('')
	console.log('To authorize your ResultsConsumer contract:')
	console.log('')
	console.log('1. Go to: https://functions.chain.link/')
	console.log('2. Connect your wallet (Celo Sepolia network)')
	console.log('3. Navigate to "Subscriptions"')
	console.log('4. Open subscription ID:', subscriptionId)
	console.log('5. Click "Add Consumer"')
	console.log('6. Enter this address:', resultsConsumerAddress)
	console.log('7. Click "Authorize"')
	console.log('')
	console.log('After authorization, wait a few seconds and try again.')
	console.log('')
	console.log('💡 You can verify authorization by checking:')
	console.log('   - Chainlink Functions App subscription page')
	console.log('   - Or call: resultsConsumer.authorizedCallers(address)')
	console.log('')
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('❌ Error:', error.message)
		process.exit(1)
	})

