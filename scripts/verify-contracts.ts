import { ethers } from 'ethers'
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Verify contracts on BaseScan
 * 
 * Usage:
 *   npm run verify:contracts -- --network base-sepolia
 * 
 * Or manually:
 *   npx hardhat verify --network base-sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
 */
async function main() {
	const networkName = process.env.HARDHAT_NETWORK || 'base-sepolia'
	console.log(`🔍 Verifying contracts on ${networkName}...\n`)

	// Load contract addresses
	const addressesPath = path.join(__dirname, '..', 'contract-addresses.json')
	if (!fs.existsSync(addressesPath)) {
		throw new Error(`Contract addresses file not found: ${addressesPath}`)
	}

	const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf-8'))
	console.log('📋 Contract Addresses:')
	console.log(`  ResultsConsumer: ${addresses.ResultsConsumer}`)
	console.log(`  PredictionContract: ${addresses.PredictionContract}\n`)

	// Get network configuration
	const network = await ethers.provider.getNetwork()
	console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})\n`)

	// Check if BASESCAN_API_KEY is set
	if (!process.env.BASESCAN_API_KEY && !process.env.ETHERSCAN_API_KEY) {
		console.warn('⚠️  Warning: BASESCAN_API_KEY or ETHERSCAN_API_KEY not set')
		console.warn('   Contract verification requires an API key')
		console.warn('   Get one at: https://basescan.org/myapikey\n')
	}

	console.log('📝 Verification Commands:\n')
	console.log('1. Verify ResultsConsumer:')
	console.log(
		`   npx hardhat verify --network ${networkName} \\\n` +
		`     ${addresses.ResultsConsumer} \\\n` +
		`     ${addresses.chainlink.router} \\\n` +
		`     ${addresses.chainlink.donId}\n`
	)

	console.log('2. Verify PredictionContract:')
	console.log(
		`   npx hardhat verify --network ${networkName} \\\n` +
		`     ${addresses.PredictionContract} \\\n` +
		`     ${addresses.ResultsConsumer}\n`
	)

	console.log('\n💡 Tip: You can also verify contracts via BaseScan UI:')
	console.log(`   https://sepolia.basescan.org/address/${addresses.ResultsConsumer}#code`)
	console.log(`   https://sepolia.basescan.org/address/${addresses.PredictionContract}#code\n`)

	// Check if contracts are already verified
	console.log('🔍 Checking verification status...\n')
	
	try {
		const resultsConsumerUrl = `https://api-sepolia.basescan.org/api?module=contract&action=getsourcecode&address=${addresses.ResultsConsumer}&apikey=${process.env.BASESCAN_API_KEY || ''}`
		const predictionContractUrl = `https://api-sepolia.basescan.org/api?module=contract&action=getsourcecode&address=${addresses.PredictionContract}&apikey=${process.env.BASESCAN_API_KEY || ''}`

		const [resultsConsumerRes, predictionContractRes] = await Promise.all([
			fetch(resultsConsumerUrl),
			fetch(predictionContractUrl),
		])

		const [resultsConsumerData, predictionContractData] = await Promise.all([
			resultsConsumerRes.json(),
			predictionContractRes.json(),
		])

		if (resultsConsumerData.result?.[0]?.SourceCode) {
			console.log('✅ ResultsConsumer is already verified')
		} else {
			console.log('❌ ResultsConsumer is NOT verified')
		}

		if (predictionContractData.result?.[0]?.SourceCode) {
			console.log('✅ PredictionContract is already verified')
		} else {
			console.log('❌ PredictionContract is NOT verified')
		}
	} catch (error) {
		console.warn('⚠️  Could not check verification status:', error.message)
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})

