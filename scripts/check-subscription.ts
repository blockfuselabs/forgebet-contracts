import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'

dotenv.config()

// FunctionsRouter ABI for checking subscription
const FUNCTIONS_ROUTER_ABI = [
	'function getSubscription(uint64 subscriptionId) external view returns (uint96 balance, uint96 reqCount, address owner, address[] memory consumers)',
]

async function main() {
	console.log('🔍 Checking Chainlink Functions Subscription Status\n')

	const resultsConsumerAddress = process.env.RESULTS_CONSUMER_ADDRESS
	const functionsRouterAddress = process.env.CHAINLINK_FUNCTIONS_ROUTER
	const subscriptionId = process.env.CHAINLINK_SUBSCRIPTION_ID

	if (!resultsConsumerAddress || !functionsRouterAddress || !subscriptionId) {
		throw new Error('Missing required environment variables')
	}

	console.log('📋 Configuration:')
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
		console.log('📊 Subscription Details:')
		const subscription = await router.getSubscription(subscriptionId)
		
		console.log('  Balance:', ethers.formatEther(subscription.balance), 'LINK')
		console.log('  Request Count:', subscription.reqCount.toString())
		console.log('  Owner:', subscription.owner)
		console.log('  Number of Consumers:', subscription.consumers.length)
		console.log('')

		if (subscription.consumers.length > 0) {
			console.log('  Consumer Addresses:')
			let found = false
			subscription.consumers.forEach((addr: string, i: number) => {
				const match = addr.toLowerCase() === resultsConsumerAddress.toLowerCase()
				if (match) found = true
				console.log(`    ${i + 1}. ${addr} ${match ? '✅ (This contract)' : ''}`)
			})
			console.log('')

			if (found) {
				console.log('✅ Contract IS authorized in subscription!')
			} else {
				console.log('❌ Contract is NOT in the consumers list!')
				console.log('   Make sure you added:', resultsConsumerAddress)
			}
		} else {
			console.log('❌ No consumers found in subscription!')
			console.log('   You need to add the contract as a consumer.')
		}

		console.log('')
		if (subscription.balance === 0n) {
			console.log('⚠️  WARNING: Subscription has 0 LINK balance!')
			console.log('   Fund the subscription with LINK to make requests.')
			console.log('   Get testnet LINK: https://faucets.chain.link/')
		} else {
			console.log('✅ Subscription has LINK balance')
		}

	} catch (error: any) {
		console.log('❌ Error checking subscription:', error.message)
		if (error.message.includes('InvalidSubscription')) {
			console.log('   Subscription does not exist!')
			console.log('   Make sure subscription ID', subscriptionId, 'exists on this network.')
		}
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('❌ Error:', error)
		process.exit(1)
	})

