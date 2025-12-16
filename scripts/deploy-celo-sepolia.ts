import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config()

async function main() {
	console.log('Starting deployment to Celo Sepolia...')

	// Get network configuration
	const network = await ethers.provider.getNetwork()
	console.log(`Deploying to network: ${network.name} (${network.chainId})`)

	// Get deployer account
	const [deployer] = await ethers.getSigners()
	console.log('Deploying contracts with account:', deployer.address)
	
	const balance = await ethers.provider.getBalance(deployer.address)
	console.log('Account balance:', ethers.formatEther(balance), 'CELO')

	if (balance === 0n) {
		throw new Error('Deployer account has no balance. Please fund your account with CELO.')
	}

	// Deploy CustomResultsOracle
	console.log('\nDeploying CustomResultsOracle...')
	const CustomResultsOracle = await ethers.getContractFactory('CustomResultsOracle')
	const resultsOracle = await CustomResultsOracle.deploy(deployer.address)
	await resultsOracle.waitForDeployment()
	const resultsOracleAddress = await resultsOracle.getAddress()
	console.log('✅ CustomResultsOracle deployed to:', resultsOracleAddress)

	// Deploy PredictionContract
	console.log('\nDeploying PredictionContract...')
	const PredictionContract = await ethers.getContractFactory('PredictionContract')
	const predictionContract = await PredictionContract.deploy(resultsOracleAddress)
	await predictionContract.waitForDeployment()
	const predictionContractAddress = await predictionContract.getAddress()
	console.log('✅ PredictionContract deployed to:', predictionContractAddress)

	// Authorize PredictionContract to call CustomResultsOracle (if needed for future features)
	// For now, only owner can submit results, but we can authorize the contract if needed
	console.log('\n✅ Deployment complete!')
	
	// Save contract addresses
	const addresses = {
		network: network.name,
		chainId: network.chainId.toString(),
		CustomResultsOracle: resultsOracleAddress,
		PredictionContract: predictionContractAddress,
		deployer: deployer.address,
		timestamp: new Date().toISOString()
	}

	const addressesPath = path.join(__dirname, '..', 'contract-addresses.json')
	fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2))
	console.log('\n📝 Contract addresses saved to:', addressesPath)

	console.log('\n📋 Deployment Summary:')
	console.log('  CustomResultsOracle:', resultsOracleAddress)
	console.log('  PredictionContract:', predictionContractAddress)
	console.log('\n💡 Next steps:')
	console.log('1. Update .env file with the deployed addresses')
	console.log('2. Authorize oracles to submit results using addAuthorizedOracle()')
	console.log('3. Test the integration by submitting a match result')
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})

