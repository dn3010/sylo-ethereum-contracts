import { ethers } from 'hardhat';
import { expect } from 'chai';

describe('Ticketing', () => {
  it('cannot initialize ticketing contract with invalid arguemnts', async () => {
    const ticketingFactory = await ethers.getContractFactory('Ticketing');
    const ticketingTemp = await ticketingFactory.deploy();

    await expect(
      ticketingTemp.initialize(ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(
      ticketingTemp,
      'CannotInitializeWithZeroRewardsManager',
    );
  });
});
