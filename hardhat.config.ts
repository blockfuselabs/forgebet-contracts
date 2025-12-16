import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import '@nomicfoundation/hardhat-verify'
import 'dotenv/config'
import 'hardhat-gas-reporter'
import 'solidity-coverage'

const config: HardhatUserConfig = {
	solidity: {
		version: '0.8.20',
		settings: {
			optimizer: {
				enabled: true,
				runs: 200,
			},
			viaIR: true,
		},
	},
	networks: {
		hardhat: {
			chainId: 1337,
		},
		localhost: {
			url: 'http://127.0.0.1:8545',
			chainId: 1337,
		},
		'base-sepolia': {
			url: process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com',
			chainId: 84532, // Base Sepolia testnet
			accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
			timeout: 120000, // 2 minutes timeout
		},
		'sepolia': {
			url: process.env.ETHEREUM_SEPOLIA_RPC_URL || 'https://sepolia.drpc.org',
			chainId: 11155111, // Ethereum Sepolia testnet (Chainlink Functions fully supported)
			accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
			timeout: 120000,
		},
	},
	gasReporter: {
		enabled: process.env.REPORT_GAS !== undefined,
		currency: 'USD',
	},
	etherscan: {
		// Etherscan API V2 - use single API key format
		// For Base Sepolia, BaseScan uses its own API
		apiKey: process.env.BASESCAN_API_KEY || process.env.ETHERSCAN_API_KEY || '',
		customChains: [
			{
				network: 'base-sepolia',
				chainId: 84532,
				urls: {
					// BaseScan API endpoint (V2 compatible)
					apiURL: 'https://api-sepolia.basescan.org/api',
					browserURL: 'https://sepolia.basescan.org',
				},
			},
		],
	},
	paths: {
		sources: './contracts',
		tests: './test',
		cache: './cache',
		artifacts: './artifacts',
	},
	typechain: {
		outDir: 'typechain-types',
		target: 'ethers-v6',
	},
}

export default config

