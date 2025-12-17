# ForgeBet

A decentralized head-to-head football prediction platform built on Base.

ForgeBet is a Web3 prediction platform where users compete head-to-head on Premier League match outcomes. Stake ETH on your predictions, get matched with opponents, and win rewards when results are settled on-chain.

## How It Works
1. Browse Matches - View upcoming Premier League fixtures
2. Create Prediction - Stake ETH (minimum 0.005) and predict the outcome
3. Get Matched - Another user joins with opposing prediction and matching stake
4. Auto-Settlement - Results fetched from FPL API and settled on Base Sepolia
5. Claim Rewards - Winners receive their share of the prize pool

## Architecture
### Smart Contracts (Base Sepolia)
- **`ResultsConsumer.sol`** - Chainlink Functions consumer contract
  - Can request match results from FPL API via Chainlink Functions (UI flow disabled; backend handles results)
  - Stores match outcomes on-chain (gameweek, matchId, homeScore, awayScore, status)
- **`PredictionContract.sol`** - Main betting contract
  - Users place bets with ETH
  - Groups bets by gameweek + matchId
  - Settles matches from on-chain outcome
  - Owner can refund unmatched single-sided bets in full (no platform fee)

### Oracle / Backend Flow
- Primary (current): backend fetches results (FPL) → sets result → calls `settleMatch`.
- Chainlink Functions remains compatible but is not invoked from the UI.

## 🚀 Quick Start
### Prerequisites
- Node.js 18+ and npm
- Wallet with ETH on Base Sepolia testnet
- Git

### Installation
```bash
git clone <repository-url>
cd forgebet-contracts

# Contracts
cd contracts && npm install

# Backend
cd ../backend && npm install

# Client
cd ../client && npm install
```

### Configuration
#### Contracts
```bash
cd contracts
cp .env.example .env
```
Fill `PRIVATE_KEY`, `BASE_SEPOLIA_RPC_URL`.

#### Backend
```bash
cd backend
cp .env.example .env
```
Set `PRIVATE_KEY`, `OWNER_ADDRESS`, `PREDICTION_CONTRACT_ADDRESS`, `RESULTS_CONSUMER_ADDRESS`, `RPC_URL`.

#### Client
```bash
cd client
cp .env.example .env
```
Set contract addresses and WalletConnect project ID.

### Deployment
```bash
cd contracts
npm run deploy:base-sepolia
```
Updates `.env` files with deployed addresses.

### Backend Server
```bash
cd backend
npm start
```
Serves fixtures/results at `http://localhost:3002` in development.

## Project Structure
```
forgebet/
├── contracts/   # Solidity, Hardhat, scripts, tests
├── backend/     # Express server, settlement/cron scripts
└── client/      # React frontend (Vite)
```

## 🔗 Deployed Contracts (Base Sepolia)
- **ResultsConsumer**: `0xA7C6A76A73Fe9CB5Bb508e0277e064678C2d6D8D`
- **PredictionContract**: `0xd3A3f2c96b8a5390D29893184cc236b2b5767e43`
- **Network**: Base Sepolia (Chain ID: 84532)
- **Explorer**: https://sepolia.basescan.org

## 🛠️ Tech Stack
- Solidity 0.8.20, Hardhat, OpenZeppelin, ethers.js
- Backend: Node/Express
- Frontend: React, Vite, Wagmi, RainbowKit
- Oracle-compatible: Chainlink Functions (UI disabled; backend handles results)

## 📝 Key Features
### Current
- Head-to-head match betting with ETH stakes
- Backend result fetch (FPL fallback) → settlement
- Refund unmatched bets (no platform fee)
- Leaderboard tracking


## Backend Settlement & Refund Script (Owner)
```bash
cd backend
OWNER_ADDRESS=0x575109e921c6d6a1cb7ca60be0191b10950afa6c \
PRIVATE_KEY=<owner_key> \
RPC_URL=<rpc> \
PREDICTION_CONTRACT_ADDRESS=0xd3A3f2c96b8a5390D29893184cc236b2b5767e43 \
RESULTS_CONSUMER_ADDRESS=0xA7C6A76A73Fe9CB5Bb508e0277e064678C2d6D8D \
node scripts/settle-and-refund.js
```

## License
Unlicense
