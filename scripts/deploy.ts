import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
	console.log('Starting deployment...')

	// Get network configuration
	const network = await ethers.provider.getNetwork()
	console.log(`Deploying to network: ${network.name} (${network.chainId})`)

	// Get deployer account
	const [deployer] = await ethers.getSigners()
	console.log('Deploying contracts with account:', deployer.address)
	console.log('Account balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH')

	// Get configuration from environment variables
	const functionsRouter = process.env.CHAINLINK_FUNCTIONS_ROUTER
	const donId = process.env.CHAINLINK_FUNCTIONS_DON_ID

	if (!functionsRouter || !donId) {
		throw new Error('Missing required environment variables: CHAINLINK_FUNCTIONS_ROUTER or CHAINLINK_FUNCTIONS_DON_ID')
	}

	console.log('\nConfiguration:')
	console.log('  Functions Router:', functionsRouter)
	console.log('  DON ID:', donId)

	// Deploy ResultsConsumer
	console.log('\nDeploying ResultsConsumer...')
	const ResultsConsumer = await ethers.getContractFactory('ResultsConsumer')
	const resultsConsumer = await ResultsConsumer.deploy(functionsRouter, donId)
	await resultsConsumer.waitForDeployment()
	const resultsConsumerAddress = await resultsConsumer.getAddress()
	console.log('✅ ResultsConsumer deployed to:', resultsConsumerAddress)

	// Deploy PredictionContract
	console.log('\nDeploying PredictionContract...')
	const PredictionContract = await ethers.getContractFactory('PredictionContract')
	const predictionContract = await PredictionContract.deploy(resultsConsumerAddress)
	await predictionContract.waitForDeployment()
	const predictionContractAddress = await predictionContract.getAddress()
	console.log('✅ PredictionContract deployed to:', predictionContractAddress)

	// Authorize PredictionContract to call ResultsConsumer
	console.log('\nAuthorizing PredictionContract...')
	const authTx = await resultsConsumer.addAuthorizedCaller(predictionContractAddress)
	await authTx.wait()
	console.log('✅ PredictionContract authorized')

	// Configure subscription if provided
	const subscriptionId = process.env.CHAINLINK_SUBSCRIPTION_ID
	if (subscriptionId && subscriptionId !== '0') {
		console.log('\nConfiguring subscription...')
		const subTx = await resultsConsumer.setSubscriptionId(parseInt(subscriptionId))
		await subTx.wait()
		console.log('✅ Subscription ID set to:', subscriptionId)
	}

	console.log('\n✅ Deployment complete!')
	console.log('\nNext steps:')
	console.log('1. Authorize the consumer contract in Chainlink Functions App')
	console.log('2. Set subscription ID using setSubscriptionId()')
	console.log('3. Configure callback gas limit if needed')
	console.log('4. Test the integration with a match result request')
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})

