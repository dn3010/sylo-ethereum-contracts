import { ethers } from 'hardhat';
import { SyloContracts } from '../../common/contracts';
import { deployContracts, getInterfaceId } from '../utils';
import { Signer } from 'ethers';
import { expect, assert } from 'chai';
import {
  Registries,
  RewardsManager,
  Ticketing,
  Deposits,
} from '../../typechain-types';
import { redeemTicket } from './ticketing.test';

describe('Rewards Manager', () => {
  let accounts: Signer[];
  let contracts: SyloContracts;
  let rewardsManager: RewardsManager;
  let registries: Registries;
  let ticketing: Ticketing;
  let deposits: Deposits;

  let deployer: Signer;
  let node1: Signer;
  let node2: Signer;

  const onlyTicketingRole = ethers.keccak256(Buffer.from('ONLY_TICKETING'));

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    contracts = await deployContracts();
    rewardsManager = contracts.rewardsManager;
    registries = contracts.registries;
    ticketing = contracts.ticketing;
    deposits = contracts.deposits;

    deployer = accounts[0];
    node1 = accounts[10];
    node2 = accounts[11];

    await ticketing.setBaseLiveWinProb(2n ** 128n - 1n);
  });

  it('TEMP TEST on claim for coverage', async () => {
    await expect(
      rewardsManager.claim(ethers.ZeroAddress, 0),
    ).to.be.revertedWith('not implemented');
  });

  it('cannot initialize rewards manager with zero registries address', async () => {
    const rewardsManagerFactory = await ethers.getContractFactory(
      'RewardsManager',
    );
    const rewardsManagerTemp = await rewardsManagerFactory.deploy();

    await expect(
      rewardsManagerTemp.initialize(ethers.ZeroAddress, ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(
      rewardsManagerTemp,
      'CannotInitializeEmptyRegistriesAddress',
    );
  });

  it('cannot initialize rewards manager with zero ticketing address', async () => {
    const rewardsManagerFactory = await ethers.getContractFactory(
      'RewardsManager',
    );
    const rewardsManagerTemp = await rewardsManagerFactory.deploy();

    await expect(
      rewardsManagerTemp.initialize(
        await registries.getAddress(),
        ethers.ZeroAddress,
      ),
    ).to.be.revertedWithCustomError(
      rewardsManagerTemp,
      'CannotInitializeEmptyTicketingAddress',
    );
  });

  it('cannot initialize rewards manager with invalid ticketing address', async () => {
    const rewardsManagerFactory = await ethers.getContractFactory(
      'RewardsManager',
    );
    const rewardsManagerTemp = await rewardsManagerFactory.deploy();

    await expect(
      rewardsManagerTemp.initialize(
        await registries.getAddress(),
        await registries.getAddress(),
      ),
    ).to.be.revertedWithCustomError(
      rewardsManagerTemp,
      'CannotInitializeWithNonTicketing',
    );
  });

  it('cannot increment reward pool without only ticketing role', async () => {
    await expect(
      rewardsManager.incrementRewardPool(ethers.ZeroAddress, 0, 0),
    ).to.be.revertedWith(
      'AccessControl: account ' +
        (await deployer.getAddress()).toLowerCase() +
        ' is missing role ' +
        onlyTicketingRole,
    );
  });

  it('cannot increment reward pool with invalid amount', async () => {
    // No deposit is added so no amount can be added to reward pool
    await expect(
      incrementRewardPool(node1, 1, 0n, 0n),
    ).to.be.revertedWithCustomError(
      rewardsManager,
      'CannotIncrementRewardPoolWithZeroAmount',
    );
  });

  it('can increment reward pool with zero node commission', async () => {
    await registries.setDefaultPayoutPercentage(0);

    await checkInitialRewardPoolState(rewardsManager);

    await incrementRewardPool(node1, 1, 100n, 100n);

    const rewardPool = await rewardsManager.getRewardPool(
      await node1.getAddress(),
      1,
    );
    const unclaimedCommission = await rewardsManager.getUnclaimedNodeCommission(
      await node1.getAddress(),
    );

    assert.equal(Number(rewardPool), 0);
    assert.equal(Number(unclaimedCommission), 100);
  });

  it('can increment reward pool', async () => {
    await checkInitialRewardPoolState(rewardsManager);

    await incrementRewardPool(node1, 1, 100n, 100n);

    const rewardPool = await rewardsManager.getRewardPool(
      await node1.getAddress(),
      1,
    );

    assert.equal(Number(rewardPool), 5);
  });

  it('can increment reward pool multiple nodes', async () => {
    await checkInitialRewardPoolState(rewardsManager);

    await incrementRewardPool(node1, 1, 100n, 100n);
    await incrementRewardPool(node2, 1, 200n, 100n);

    const rewardPool = await rewardsManager.getRewardPool(
      await node1.getAddress(),
      1,
    );
    const rewardPool2 = await rewardsManager.getRewardPool(
      await node2.getAddress(),
      1,
    );

    assert.equal(Number(rewardPool), 5);
    assert.equal(Number(rewardPool2), 10);
  });

  it('can increment reward pool over multiple cycles', async () => {
    await checkInitialRewardPoolState(rewardsManager);

    await incrementRewardPool(node1, 1, 100n, 100n);
    await incrementRewardPool(node1, 2, 200n, 100n);
    await incrementRewardPool(node2, 1, 300n, 100n);
    await incrementRewardPool(node2, 2, 500n, 100n);

    const rewardPoolNode1 = await rewardsManager.getRewardPools(
      await node1.getAddress(),
      [1, 2],
    );

    const rewardPoolNode2 = await rewardsManager.getRewardPools(
      await node2.getAddress(),
      [1, 2],
    );

    assert.equal(Number(rewardPoolNode1[0]), 5);
    assert.equal(Number(rewardPoolNode1[1]), 10);

    assert.equal(Number(rewardPoolNode2[0]), 15);
    assert.equal(Number(rewardPoolNode2[1]), 25);
  });

  it('can increment reward pool with different node commissions', async () => {
    await registries.setDefaultPayoutPercentage(0);

    await checkInitialRewardPoolState(rewardsManager);

    await incrementRewardPool(node1, 1, 100n, 100n);
    await incrementRewardPool(node2, 1, 300n, 100n);

    await registries.setDefaultPayoutPercentage(10000);

    await incrementRewardPool(node1, 2, 200n, 100n);
    await incrementRewardPool(node2, 2, 500n, 100n);

    const rewardPoolNode1 = await rewardsManager.getRewardPools(
      await node1.getAddress(),
      [1, 2],
    );

    const rewardPoolNode2 = await rewardsManager.getRewardPools(
      await node2.getAddress(),
      [1, 2],
    );

    const unclaimedNode1Commission =
      await rewardsManager.getUnclaimedNodeCommission(await node1.getAddress());
    const unclaimedNode2Commission =
      await rewardsManager.getUnclaimedNodeCommission(await node2.getAddress());

    assert.equal(Number(rewardPoolNode1[0]), 0);
    assert.equal(Number(rewardPoolNode1[1]), 20);

    assert.equal(Number(rewardPoolNode2[0]), 0);
    assert.equal(Number(rewardPoolNode2[1]), 50);

    assert.equal(Number(unclaimedNode1Commission), 280);
    assert.equal(Number(unclaimedNode2Commission), 750);
  });

  it('rewards manager supports correct interfaces', async () => {
    const abi = [
      'function incrementRewardPool(address node, uint256 cycle, uint256 amount) external',
      'function getRewardPool(address node, uint256 cycle) external view returns (uint256)',
      'function getRewardPools(address node, uint256[] cycles) external view returns (uint256[])',
      'function getUnclaimedNodeCommission(address node) external view returns (uint256)',
      'function claim(address node, uint256 cycle) external',
    ];

    const interfaceId = getInterfaceId(abi);

    const supports = await rewardsManager.supportsInterface(interfaceId);

    assert.equal(
      supports,
      true,
      'Expected rewards manager to support correct interface',
    );

    const invalidAbi = ['function foo(uint256 duration) external'];

    const invalidAbiInterfaceId = getInterfaceId(invalidAbi);

    const invalid = await rewardsManager.supportsInterface(
      invalidAbiInterfaceId,
    );

    assert.equal(
      invalid,
      false,
      'Expected rewards manager to not support incorrect interface',
    );
  });

  const setupUser = async (tokenBalance = 1_000_000n) => {
    const user = ethers.Wallet.createRandom(ethers.provider);

    await accounts[0].sendTransaction({
      to: user.address,
      value: ethers.parseEther('10'),
    });

    await contracts.syloToken.transfer(user.address, tokenBalance);
    await contracts.syloToken
      .connect(user)
      .approve(await contracts.deposits.getAddress(), tokenBalance);

    return user;
  };

  async function incrementRewardPool(
    redeemer: Signer,
    cycle: number,
    escrowAmount?: bigint,
    penaltyAmount?: bigint,
  ) {
    await redeemTicket(
      ticketing,
      deposits,
      {
        sender: await setupUser(),
        receiver: accounts[1],
        redeemer: redeemer,
        redeemerRand: 1,
        cycle: cycle,
      },
      escrowAmount,
      penaltyAmount,
    );
  }

  async function checkInitialRewardPoolState(_rewardsManager: RewardsManager) {
    const rewardPool = await _rewardsManager.getRewardPool(
      await node1.getAddress(),
      0,
    );

    assert.equal(
      Number(rewardPool),
      0,
      'expected initial reward pool amount to be zero',
    );
  }
});
