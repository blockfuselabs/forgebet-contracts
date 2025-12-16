import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'

dotenv.config()

// FunctionsRouter ABI - minimal interface to check consumer authorization
const FUNCTIONS_ROUTER_ABI = [
	'function getSubscription(uint64 subscriptionId) external view returns (uint96 balance, uint96 reqCount, address owner, address[] memory consumers)',
	'function isAuthorizedConsumer(address consumer, uint64 subscriptionId) external view returns (bool)',
]

async function main() {
	console.log('🔍 Verifying Chainlink Functions Authorization\n')

	const resultsConsumerAddress = process.env.RESULTS_CONSUMER_ADDRESS
	const functionsRouterAddress = process.env.CHAINLINK_FUNCTIONS_ROUTER
	const subscriptionId = process.env.CHAINLINK_SUBSCRIPTION_ID

	if (!resultsConsumerAddress || !functionsRouterAddress || !subscriptionId) {
		throw new Error('Missing required environment variables')
	}

	console.log('📋 Configuration:')
	console.log('  Network: Celo Sepolia (Chain ID: 11142220)')
	console.log('  ResultsConsumer:', resultsConsumerAddress)
	console.log('  Functions Router:', functionsRouterAddress)
	console.log('  Subscription ID:', subscriptionId)
	console.log('')

	// Connect to Functions Router
	const router = new ethers.Contract(
		functionsRouterAddress,
		FUNCTIONS_ROUTER_ABI,
		ethers.provider
	)

	try {
		// Check if consumer is authorized
		console.log('🔐 Checking Authorization...')
		const isAuthorized = await router.isAuthorizedConsumer(
			resultsConsumerAddress,
			subscriptionId
		)

		if (isAuthorized) {
			console.log('✅ Contract IS authorized in subscription!')
			console.log('')
			console.log('💡 If requests are still failing, check:')
			console.log('   1. Subscription has LINK balance')
			console.log('   2. Subscription ID matches (5918)')
			console.log('   3. Network is Celo Sepolia (not Ethereum Sepolia)')
		} else {
			console.log('❌ Contract is NOT authorized in subscription!')
			console.log('')
			console.log('⚠️  CRITICAL: You must authorize on CELO SEPOLIA, not Ethereum Sepolia!')
			console.log('')
			console.log('📝 Steps to authorize:')
			console.log('   1. Go to: https://functions.chain.link/')
			console.log('   2. Connect wallet')
			console.log('   3. Switch network to CELO SEPOLIA (Chain ID: 11142220)')
			console.log('   4. Open subscription:', subscriptionId)
			console.log('   5. Add consumer:', resultsConsumerAddress)
			console.log('   6. Authorize')
			console.log('')
			console.log('🔗 CeloScan (correct network):')
			console.log('   https://alfajores.celoscan.io/address/' + resultsConsumerAddress)
		}

		// Get subscription details
		console.log('')
		console.log('📊 Subscription Details:')
		try {
			const subscription = await router.getSubscription(subscriptionId)
			console.log('  Balance:', ethers.formatEther(subscription.balance), 'LINK')
			console.log('  Request Count:', subscription.reqCount.toString())
			console.log('  Owner:', subscription.owner)
			console.log('  Consumers:', subscription.consumers.length)
			
			if (subscription.consumers.length > 0) {
				console.log('  Consumer addresses:')
				subscription.consumers.forEach((addr: string, i: number) => {
					const match = addr.toLowerCase() === resultsConsumerAddress.toLowerCase()
					console.log(`    ${i + 1}. ${addr} ${match ? '✅ (This contract)' : ''}`)
				})
			}
		} catch (err: any) {
			console.log('  ⚠️  Could not fetch subscription details:', err.message)
		}

	} catch (error: any) {
		console.log('❌ Error checking authorization:', error.message)
		console.log('')
		console.log('💡 Possible issues:')
		console.log('   1. Wrong network - make sure you\'re on Celo Sepolia')
		console.log('   2. Wrong Functions Router address')
		console.log('   3. Subscription doesn\'t exist on this network')
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('❌ Error:', error)
		process.exit(1)
	})

