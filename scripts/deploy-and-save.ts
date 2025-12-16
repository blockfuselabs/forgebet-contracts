import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config()

async function main() {
const networkName = process.env.HARDHAT_NETWORK || 'base-sepolia'
const networkDisplay = networkName === 'base-sepolia' ? 'Base Sepolia' : networkName
	
	console.log(`🚀 Starting deployment to ${networkDisplay}...\n`)

	// Get network configuration
	const network = await ethers.provider.getNetwork()
	console.log(`Network: ${network.name} (${network.chainId})\n`)

	// Get deployer account
	const [deployer] = await ethers.getSigners()
	console.log('Deployer:', deployer.address)
	const balance = await ethers.provider.getBalance(deployer.address)
	const currency = 'ETH'
	console.log('Balance:', ethers.formatEther(balance), currency + '\n')

	if (balance < ethers.parseEther('0.01')) {
		console.log(`⚠️  Warning: Low balance. You may need more ${currency} for deployment.`)
		console.log('💡 Get testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet\n')
	}

	// Get configuration from environment variables
	const functionsRouter = process.env.CHAINLINK_FUNCTIONS_ROUTER
	const donIdString = process.env.CHAINLINK_FUNCTIONS_DON_ID

	if (!functionsRouter || !donIdString) {
		throw new Error(
			'Missing required environment variables:\n' +
			'  - CHAINLINK_FUNCTIONS_ROUTER\n' +
			'  - CHAINLINK_FUNCTIONS_DON_ID\n\n' +
			'💡 Get these from: https://docs.chain.link/chainlink-functions/supported-networks'
		)
	}

	console.log('Configuration:')
	console.log('  Functions Router:', functionsRouter)
	console.log('  DON ID (string):', donIdString)
	console.log('')

	// Deploy ResultsConsumer (now accepts string directly)
	console.log('📦 Deploying ResultsConsumer...')
	const ResultsConsumer = await ethers.getContractFactory('ResultsConsumer')
	const resultsConsumer = await ResultsConsumer.deploy(functionsRouter, donIdString)
	await resultsConsumer.waitForDeployment()
	const resultsConsumerAddress = await resultsConsumer.getAddress()
	console.log('✅ ResultsConsumer deployed to:', resultsConsumerAddress)

	// Deploy PredictionContract
	console.log('\n📦 Deploying PredictionContract...')
	const PredictionContract = await ethers.getContractFactory('PredictionContract')
	const predictionContract = await PredictionContract.deploy(resultsConsumerAddress)
	await predictionContract.waitForDeployment()
	const predictionContractAddress = await predictionContract.getAddress()
	console.log('✅ PredictionContract deployed to:', predictionContractAddress)

	// Authorize PredictionContract to call ResultsConsumer
	console.log('\n🔐 Authorizing PredictionContract...')
	const authTx = await resultsConsumer.addAuthorizedCaller(predictionContractAddress)
	await authTx.wait()
	console.log('✅ PredictionContract authorized')

	// Configure subscription if provided
	const subscriptionId = process.env.CHAINLINK_SUBSCRIPTION_ID
	if (subscriptionId && subscriptionId !== '0') {
		console.log('\n⚙️  Configuring subscription...')
		const subTx = await resultsConsumer.setSubscriptionId(parseInt(subscriptionId))
		await subTx.wait()
		console.log('✅ Subscription ID set to:', subscriptionId)
	}

	// Save addresses to .env file
	console.log('\n💾 Saving addresses to .env file...')
	const envPath = path.join(__dirname, '..', '.env')
	const envExamplePath = path.join(__dirname, '..', '.env.example')
	let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : ''

	// Update or add contract addresses
	const lines = envContent.split('\n')
	const newLines: string[] = []
	let resultsConsumerFound = false
	let predictionContractFound = false

	for (const line of lines) {
		if (line.startsWith('RESULTS_CONSUMER_ADDRESS=')) {
			newLines.push(`RESULTS_CONSUMER_ADDRESS=${resultsConsumerAddress}`)
			resultsConsumerFound = true
		} else if (line.startsWith('PREDICTION_CONTRACT_ADDRESS=')) {
			newLines.push(`PREDICTION_CONTRACT_ADDRESS=${predictionContractAddress}`)
			predictionContractFound = true
		} else {
			newLines.push(line)
		}
	}

	if (!resultsConsumerFound) {
		newLines.push(`RESULTS_CONSUMER_ADDRESS=${resultsConsumerAddress}`)
	}
	if (!predictionContractFound) {
		newLines.push(`PREDICTION_CONTRACT_ADDRESS=${predictionContractAddress}`)
	}

	fs.writeFileSync(envPath, newLines.join('\n'))
	fs.writeFileSync(envExamplePath, newLines.join('\n'))
	console.log('✅ Addresses saved to .env and .env.example')

	// Print summary
	console.log('\n' + '='.repeat(60))
	console.log('✅ DEPLOYMENT COMPLETE!')
	console.log('='.repeat(60))
	console.log('\n📋 Contract Addresses:')
	console.log('  ResultsConsumer:', resultsConsumerAddress)
	console.log('  PredictionContract:', predictionContractAddress)
	console.log('\n📝 Next Steps:')
	console.log('1. Fund your Chainlink Functions subscription with LINK')
	console.log('   💡 Get testnet LINK: https://faucets.chain.link/')
	console.log('2. Authorize ResultsConsumer in Chainlink Functions App:')
	console.log('   https://functions.chain.link/')
	console.log('3. Test the contracts:')
	console.log('   npm run test:live')
	console.log('\n🔗 View on Explorer:')
	console.log(`   ResultsConsumer: https://sepolia.basescan.org/address/${resultsConsumerAddress}`)
	console.log(`   PredictionContract: https://sepolia.basescan.org/address/${predictionContractAddress}`)
	console.log('')
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('\n❌ Deployment failed:', error.message)
		process.exit(1)
	})

