import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
	console.log('⚙️  Setting Subscription ID in ResultsConsumer\n')

	const resultsConsumerAddress = process.env.RESULTS_CONSUMER_ADDRESS
	const subscriptionId = process.env.CHAINLINK_SUBSCRIPTION_ID

	if (!resultsConsumerAddress) {
		throw new Error('RESULTS_CONSUMER_ADDRESS not set in .env')
	}

	if (!subscriptionId) {
		throw new Error('CHAINLINK_SUBSCRIPTION_ID not set in .env')
	}

	const [signer] = await ethers.getSigners()
	console.log('Account:', signer.address)
	console.log('ResultsConsumer:', resultsConsumerAddress)
	console.log('Subscription ID:', subscriptionId)
	console.log('')

	// Connect to contract
	const ResultsConsumer = await ethers.getContractFactory('ResultsConsumer')
	const resultsConsumer = ResultsConsumer.attach(resultsConsumerAddress)

	// Check current subscription ID
	const currentSubId = await resultsConsumer.s_subscriptionId()
	console.log('Current Subscription ID:', currentSubId.toString())
	console.log('')

	if (currentSubId.toString() === subscriptionId) {
		console.log('✅ Subscription ID already set correctly!')
		return
	}

	// Set subscription ID
	console.log('📝 Setting subscription ID...')
	const tx = await resultsConsumer.setSubscriptionId(parseInt(subscriptionId))
	console.log('Transaction sent:', tx.hash)
	
	const receipt = await tx.wait()
	console.log('✅ Transaction confirmed in block:', receipt?.blockNumber)
	
	// Verify
	const newSubId = await resultsConsumer.s_subscriptionId()
	console.log('New Subscription ID:', newSubId.toString())
	console.log('✅ Subscription ID set successfully!')
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('❌ Error:', error.message)
		process.exit(1)
	})

