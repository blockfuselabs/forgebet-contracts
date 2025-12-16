import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
	console.log('🔍 Verifying ResultsConsumer contract...\n')

	const contractAddress = '0xf722A401935d1ACa82583544aF72582e92376841'
	const functionsRouter = '0xf9B8fc078197181C841c296C876945aaa425B278'
	const donIdString = 'fun-base-sepolia-1'

	// Convert DON ID string to bytes32 (same as deployment)
	const donIdBytes = ethers.toUtf8Bytes(donIdString)
	const padded = new Uint8Array(32)
	padded.set(donIdBytes)
	const donId = ethers.hexlify(padded)

	console.log('Contract Address:', contractAddress)
	console.log('Functions Router:', functionsRouter)
	console.log('DON ID (string):', donIdString)
	console.log('DON ID (bytes32):', donId)
	console.log('')

	// Try to verify using hardhat verify
	console.log('📝 Verification command:')
	console.log(
		`npx hardhat verify --network base-sepolia ${contractAddress} ${functionsRouter} ${donId}`
	)
	console.log('')
	console.log('⚠️  Note: If automatic verification fails, you can verify manually on BaseScan:')
	console.log(`   https://sepolia.basescan.org/address/${contractAddress}#code`)
	console.log('')
	console.log('Constructor arguments:')
	console.log(`   Router: ${functionsRouter}`)
	console.log(`   DON ID: ${donId}`)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})

