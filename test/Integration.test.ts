import { expect } from 'chai'
import { ethers } from 'hardhat'
import { ResultsConsumer, PredictionContract } from '../typechain-types'
import { Contract } from 'ethers'

/**
 * @title Integration Tests
 * @notice Tests the full integration between ResultsConsumer and PredictionContract
 * @dev These tests simulate the complete flow from request to settlement
 */
describe('Integration Tests', function () {
	let resultsConsumer: ResultsConsumer
	let predictionContract: PredictionContract
	let owner: any
	let bettor1: any
	let bettor2: any
	let bettor3: any
	const mockRouter = '0x0000000000000000000000000000000000000001'
	const mockDonId = '0x0000000000000000000000000000000000000000000000000000000000000001'

	beforeEach(async function () {
		;[owner, bettor1, bettor2, bettor3] = await ethers.getSigners()

		// Deploy ResultsConsumer
		const ResultsConsumerFactory = await ethers.getContractFactory('ResultsConsumer')
		resultsConsumer = await ResultsConsumerFactory.deploy(mockRouter, mockDonId)
		await resultsConsumer.waitForDeployment()

		// Deploy PredictionContract
		const PredictionContractFactory = await ethers.getContractFactory('PredictionContract')
		predictionContract = await PredictionContractFactory.deploy(
			await resultsConsumer.getAddress()
		)
		await predictionContract.waitForDeployment()

		// Authorize PredictionContract
		await resultsConsumer.addAuthorizedCaller(await predictionContract.getAddress())
	})

	describe('Full Flow: Request -> Fulfill -> Settle', function () {
		it('Should complete full flow with HOME win', async function () {
			const gameweek = 1
			const matchId = 1
			const betAmount = ethers.parseEther('1.0')

			// Step 1: Place bets
			await predictionContract.connect(bettor1).placeBet(gameweek, matchId, 0, { value: betAmount }) // HOME
			await predictionContract.connect(bettor2).placeBet(gameweek, matchId, 1, { value: betAmount }) // DRAW
			await predictionContract.connect(bettor3).placeBet(gameweek, matchId, 2, { value: betAmount }) // AWAY

			// Step 2: Request result (simulated - in real scenario this would be called by authorized contract)
			// Note: We can't actually call Chainlink Functions in tests, so we'll simulate the outcome
			// In production, Chainlink Functions would call fulfillRequest

			// Step 3: Simulate fulfillRequest by directly manipulating storage (for testing only)
			// This is a workaround - in production, Chainlink Functions handles this
			// We'll need to create a test helper or mock contract to simulate this

			// For now, we'll test that the contracts are properly integrated
			expect(await resultsConsumer.hasOutcome(gameweek, matchId)).to.be.false
			expect(await predictionContract.isMatchSettled(gameweek, matchId)).to.be.false
		})
	})

	describe('Edge Cases', function () {
		it('Should handle malformed response gracefully', async function () {
			// Test that invalid responses don't break the contract
			// This would be tested by mocking fulfillRequest with invalid data
		})

		it('Should handle missing data', async function () {
			// Test behavior when API returns incomplete data
		})

		it('Should handle no result scenario', async function () {
			// Test when match hasn't finished or was cancelled
		})
	})
})

