import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config()

async function main() {
	console.log('🚀 Migrating Contracts to Celo Alfajores Testnet\n')
	console.log('='.repeat(60))

	// Get network configuration
	const network = await ethers.provider.getNetwork()
	console.log(`Target Network: Celo Alfajores (Chain ID: 44787)`)
	console.log(`Current Network: ${network.name} (${network.chainId})\n`)

	if (network.chainId !== 44787n) {
		console.log('⚠️  Warning: Make sure you\'re connected to Celo Alfajores Testnet')
		console.log('   Chain ID should be: 44787\n')
	}

	// Get deployer account
	const [deployer] = await ethers.getSigners()
	console.log('Deployer:', deployer.address)
	const balance = await ethers.provider.getBalance(deployer.address)
	console.log('Balance:', ethers.formatEther(balance), 'CELO\n')

	if (balance < ethers.parseEther('0.01')) {
		console.log('⚠️  Warning: Low balance. You may need more CELO for deployment.')
		console.log('💡 Get testnet BASE from: 	https://base-faucet.com/\n')
	}

	// Get configuration from environment variables
	const functionsRouter = process.env.CHAINLINK_FUNCTIONS_ROUTER_ALFAJORES || process.env.CHAINLINK_FUNCTIONS_ROUTER
	const donIdString = process.env.CHAINLINK_FUNCTIONS_DON_ID_ALFAJORES || process.env.CHAINLINK_FUNCTIONS_DON_ID

	if (!functionsRouter || !donIdString) {
		throw new Error(
			'Missing required environment variables:\n' +
			'  - CHAINLINK_FUNCTIONS_ROUTER_ALFAJORES (or CHAINLINK_FUNCTIONS_ROUTER)\n' +
			'  - CHAINLINK_FUNCTIONS_DON_ID_ALFAJORES (or CHAINLINK_FUNCTIONS_DON_ID)\n\n' +
			'💡 Get these from: https://docs.chain.link/chainlink-functions/supported-networks\n' +
			'   Look for "Base Sepolia" section'
		)
	}

	// Convert DON ID string to bytes32
	let donId: string
	if (donIdString.startsWith('0x')) {
		donId = donIdString
	} else {
		const donIdBytes = ethers.toUtf8Bytes(donIdString)
		const padded = new Uint8Array(32)
		padded.set(donIdBytes)
		donId = ethers.hexlify(padded)
	}

	console.log('Configuration:')
	console.log('  Functions Router:', functionsRouter)
	console.log('  DON ID (string):', donIdString)
	console.log('  DON ID (bytes32):', donId)
	console.log('')

	// Deploy ResultsConsumer
	console.log('📦 Deploying ResultsConsumer to Celo Alfajores...')
	const ResultsConsumer = await ethers.getContractFactory('ResultsConsumer')
	const resultsConsumer = await ResultsConsumer.deploy(functionsRouter, donId)
	await resultsConsumer.waitForDeployment()
	const resultsConsumerAddress = await resultsConsumer.getAddress()
	console.log('✅ ResultsConsumer deployed to:', resultsConsumerAddress)

	// Deploy PredictionContract
	console.log('\n📦 Deploying PredictionContract to Celo Alfajores...')
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
	const subscriptionId = process.env.CHAINLINK_SUBSCRIPTION_ID_ALFAJORES || process.env.CHAINLINK_SUBSCRIPTION_ID
	if (subscriptionId && subscriptionId !== '0') {
		console.log('\n⚙️  Configuring subscription...')
		const subTx = await resultsConsumer.setSubscriptionId(parseInt(subscriptionId))
		await subTx.wait()
		console.log('✅ Subscription ID set to:', subscriptionId)
	} else {
		console.warn('\n⚠️  Warning: Subscription ID not set.')
		console.warn('   Create a subscription on Celo Alfajores and set CHAINLINK_SUBSCRIPTION_ID_ALFAJORES')
	}

	// Save addresses to .env file
	console.log('\n💾 Saving addresses to .env file...')
	const envPath = path.join(__dirname, '..', '.env')
	let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : ''

	// Update or add contract addresses for Alfajores
	const lines = envContent.split('\n')
	const newLines: string[] = []
	let resultsConsumerAlfajoresFound = false
	let predictionContractAlfajoresFound = false

	for (const line of lines) {
		if (line.startsWith('RESULTS_CONSUMER_ADDRESS_ALFAJORES=')) {
			newLines.push(`RESULTS_CONSUMER_ADDRESS_ALFAJORES=${resultsConsumerAddress}`)
			resultsConsumerAlfajoresFound = true
		} else if (line.startsWith('PREDICTION_CONTRACT_ADDRESS_ALFAJORES=')) {
			newLines.push(`PREDICTION_CONTRACT_ADDRESS_ALFAJORES=${predictionContractAddress}`)
			predictionContractAlfajoresFound = true
		} else {
			newLines.push(line)
		}
	}

	if (!resultsConsumerAlfajoresFound) {
		newLines.push(`RESULTS_CONSUMER_ADDRESS_ALFAJORES=${resultsConsumerAddress}`)
	}
	if (!predictionContractAlfajoresFound) {
		newLines.push(`PREDICTION_CONTRACT_ADDRESS_ALFAJORES=${predictionContractAddress}`)
	}

	fs.writeFileSync(envPath, newLines.join('\n'))
	console.log('✅ Addresses saved to .env')

	// Print summary
	console.log('\n' + '='.repeat(60))
	console.log('✅ MIGRATION TO CELO ALFAJORES COMPLETE!')
	console.log('='.repeat(60))
	console.log('\n📋 Contract Addresses:')
	console.log('  ResultsConsumer:', resultsConsumerAddress)
	console.log('  PredictionContract:', predictionContractAddress)
	console.log('\n🔗 View on CeloScan:')
	console.log(`   ResultsConsumer: https://alfajores.celoscan.io/address/${resultsConsumerAddress}`)
	console.log(`   PredictionContract: https://alfajores.celoscan.io/address/${predictionContractAddress}`)
	console.log('\n📝 Next Steps:')
	console.log('1. Create a Chainlink Functions subscription on Celo Alfajores')
	console.log('   💡 Go to: https://functions.chain.link/')
	console.log('   💡 Switch to Celo Alfajores network (Chain ID: 44787)')
	console.log('2. Fund the subscription with testnet LINK')
	console.log('   💡 Get from: https://faucets.chain.link/')
	console.log('3. Authorize ResultsConsumer in Chainlink Functions App:')
	console.log(`   Consumer Address: ${resultsConsumerAddress}`)
	console.log('4. Set subscription ID:')
	console.log('   npm run set:subscription:alfajores')
	console.log('5. Test the deployment:')
	console.log('   npm run request:result:alfajores')
	console.log('')
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('\n❌ Migration failed:', error.message)
		process.exit(1)
	})

