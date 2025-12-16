import { ethers } from 'ethers'

const rpcEndpoints = [
	'https://ethereum-sepolia.rpc.subquery.network/public',
	'https://ethereum-sepolia.gateway.tatum.io',
	'https://sepolia.gateway.tenderly.co',
	'https://ethereum-sepolia-rpc.publicnode.com',
	'https://sepolia.drpc.org',
	'https://0xrpc.io/sep',
	'https://eth-sepolia.api.onfinality.io/public',
	'https://gateway.tenderly.co/public/sepolia',
	'https://ethereum-sepolia-public.nodies.app',
	'https://1rpc.io/sepolia',
]

async function testRPC(url: string): Promise<{ success: boolean; latency: number; error?: string }> {
	const startTime = Date.now()
	try {
		const provider = new ethers.JsonRpcProvider(url, {
			name: 'sepolia',
			chainId: 11155111,
		})

		// Test with a simple call
		const blockNumber = await Promise.race([
			provider.getBlockNumber(),
			new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
		])

		const latency = Date.now() - startTime
		return { success: true, latency, error: undefined }
	} catch (error: any) {
		const latency = Date.now() - startTime
		return { success: false, latency, error: error.message }
	}
}

async function main() {
	console.log('🧪 Testing Ethereum Sepolia RPC Endpoints...\n')

	const results: Array<{ url: string; success: boolean; latency: number; error?: string }> = []

	for (const url of rpcEndpoints) {
		process.stdout.write(`Testing ${url}... `)
		const result = await testRPC(url)
		results.push({ url, ...result })
		if (result.success) {
			console.log(`✅ ${result.latency}ms`)
		} else {
			console.log(`❌ ${result.error} (${result.latency}ms)`)
		}
	}

	console.log('\n' + '='.repeat(60))
	console.log('📊 Results Summary:')
	console.log('='.repeat(60))

	const working = results.filter((r) => r.success)
	const failing = results.filter((r) => !r.success)

	if (working.length > 0) {
		console.log('\n✅ Working RPC Endpoints:')
		working
			.sort((a, b) => a.latency - b.latency)
			.forEach((r, i) => {
				console.log(`  ${i + 1}. ${r.url} (${r.latency}ms)`)
			})

		const best = working.sort((a, b) => a.latency - b.latency)[0]
		console.log('\n🏆 Best RPC Endpoint:')
		console.log(`   ${best.url}`)
		console.log(`   Latency: ${best.latency}ms`)
		console.log('\n💡 Add this to your .env file:')
		console.log(`   ETHEREUM_SEPOLIA_RPC_URL=${best.url}`)
	} else {
		console.log('\n❌ No working RPC endpoints found!')
		console.log('   All endpoints failed. This might be a network connectivity issue.')
	}

	if (failing.length > 0) {
		console.log('\n❌ Failing RPC Endpoints:')
		failing.forEach((r) => {
			console.log(`   ${r.url} - ${r.error}`)
		})
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('Error:', error)
		process.exit(1)
	})

