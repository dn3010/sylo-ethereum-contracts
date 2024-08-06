import { ethers } from 'hardhat';
import { SyloContracts } from '../../common/contracts';
import {
  MAX_SYLO,
  ProtocolTimeManagerUtilities,
  deployContracts,
  getInterfaceId,
  getTimeManagerUtil,
} from '../utils';
import { AddressLike, BigNumberish, Signer } from 'ethers';
import { expect, assert } from 'chai';
import {
  Registries,
  RewardsManager,
  Ticketing,
  Deposits,
} from '../../typechain-types';
import { redeemTicket } from './ticketing.test';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';

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

  let timeManagerUtilities: ProtocolTimeManagerUtilities;
  let startProtocol: typeof timeManagerUtilities.startProtocol;
  let setTimeSinceStart: (time: number) => Promise<void>;

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

    timeManagerUtilities = getTimeManagerUtil(contracts.protocolTimeManager);
    startProtocol = timeManagerUtilities.startProtocol;

    await startProtocol().then(f => (setTimeSinceStart = f.setTimeSinceStart));
  });

  it('cannot initialize rewards manager with nil addresses', async () => {
    const rewardsManagerFactory = await ethers.getContractFactory(
      'RewardsManager',
    );
    const rewardsManagerTemp = await rewardsManagerFactory.deploy();

    const addr = await rewardsManager.getAddress();

    await expect(
      rewardsManagerTemp.initialize(ethers.ZeroAddress, addr, addr, addr, addr),
    ).to.be.revertedWithCustomError(
      rewardsManagerTemp,
      'TokenAddressCannotBeNil',
    );

    await expect(
      rewardsManagerTemp.initialize(addr, ethers.ZeroAddress, addr, addr, addr),
    ).to.be.revertedWithCustomError(
      rewardsManagerTemp,
      'RegistriesAddressCannotBeNil',
    );

    await expect(
      rewardsManagerTemp.initialize(addr, addr, ethers.ZeroAddress, addr, addr),
    ).to.be.revertedWithCustomError(
      rewardsManagerTemp,
      'ProtocolTimeManagerAddressCannotBeNil',
    );

    await expect(
      rewardsManagerTemp.initialize(addr, addr, addr, ethers.ZeroAddress, addr),
    ).to.be.revertedWithCustomError(
      rewardsManagerTemp,
      'TicketingAddressCannotBeNil',
    );

    await expect(
      rewardsManagerTemp.initialize(addr, addr, addr, addr, ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(
      rewardsManagerTemp,
      'StakingOrchestratorAddressCannotBeNil',
    );
  });

  it('cannot increment reward pool without only ticketing role', async () => {
    await expect(
      rewardsManager.incrementRewardPool(ethers.ZeroAddress, 0),
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

    await incrementRewardPool(node1, 1, 100n);

    await increase(1000);
    await incrementRewardPool(node1, 2, 200n);

    await increase(1000);
    await incrementRewardPool(node1, 3, 300n);

    await increase(1000);
    await incrementRewardPool(node1, 4, 500n);

    const rewardPoolNode1 = await rewardsManager.getRewardPools(
      await node1.getAddress(),
      [1, 2, 3, 4],
    );

    assert.equal(Number(rewardPoolNode1[0]), 5);
    assert.equal(Number(rewardPoolNode1[1]), 10);
    assert.equal(Number(rewardPoolNode1[2]), 15);
    assert.equal(Number(rewardPoolNode1[3]), 25);
  });

  it('can increment reward pool with different node commissions', async () => {
    await registries.setDefaultPayoutPercentage(0);

    await checkInitialRewardPoolState(rewardsManager);

    await incrementRewardPool(node1, 1, 100n, 100n);
    await incrementRewardPool(node2, 1, 300n, 100n);

    await registries.setDefaultPayoutPercentage(10000);

    await increase(1000);

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
      'function getRewardPool(address node, uint256 cycle) external view returns (uint256)',
      'function getRewardPools(address node, uint256[] cycles) external view returns (uint256[])',
      'function getUnclaimedNodeCommission(address node) external view returns (uint256)',
      'function incrementRewardPool(address node, uint256 amount) external',
      'function claim(address node, uint256 cycle) external',
      'function getClaim(address node, address user, uint256 cycle) external view returns (uint256)',
      'function getUnclaimedReward(address node, address user, uint256 cycle) external view returns (uint256)',
      'function getUnclaimedRewards(address node, address user, uint256[] cycles) external view returns (uint256[])',
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

  describe('Claiming', () => {
    beforeEach(async () => {
      // set 100% of rewards to stakees for simplicity
      await contracts.registries.setDefaultPayoutPercentage(100000);

      await contracts.stakingOrchestrator.setCapacityPenaltyFactor(1);
    });

    it('can claim reward', async () => {
      const user = await setupUser();

      const rewardAmount = 100n;

      await setupStake(node1.getAddress(), user, 100);

      await incrementRewardPool(node1, 1, rewardAmount);

      await setTimeSinceStart(1000);

      await testClaim(node1.getAddress(), user, 1, rewardAmount);

      const unclaimedReward = await rewardsManager.getUnclaimedReward(
        node1.getAddress(),
        user.address,
        1,
      );

      expect(unclaimedReward).to.equal(0);
    });

    it('can claim reward over multiple cycles', async () => {
      const user = await setupUser();

      const rewardAmount = 111n;

      await setupStake(node1.getAddress(), user, 100);

      const cycles = [1, 2, 3, 4];

      for (const cycle of cycles) {
        await incrementRewardPool(node1, cycle, BigInt(cycle) * rewardAmount);

        await setTimeSinceStart(cycle * 1000);
      }

      const unclaimedRewards = await rewardsManager.getUnclaimedRewards(
        node1.getAddress(),
        user.getAddress(),
        cycles,
      );

      for (const [i, r] of unclaimedRewards.entries()) {
        expect(r).to.be.eq(BigInt(i + 1) * rewardAmount);
      }

      for (const cycle of cycles) {
        await testClaim(
          node1.getAddress(),
          user,
          cycle,
          BigInt(cycle) * rewardAmount,
        );
      }
    });

    it('distributes rewards amongst stakers proportionally', async () => {
      const stakes = [
        100, // 10%
        250, // 25%
        300, // 30%
        350, // 35%
      ];

      const users = await Promise.all(
        stakes.map(async stake => {
          const user = await setupUser();

          await setupStake(node1.getAddress(), user, stake);

          return { stake, user };
        }),
      );

      await setTimeSinceStart(1000);

      const rewardAmount = 1000;

      await incrementRewardPool(node1, 2, rewardAmount);

      await setTimeSinceStart(2000);

      for (const user of users) {
        await testClaim(node1.getAddress(), user.user, 2, BigInt(user.stake));
      }
    });

    it('can claim commission as node', async () => {
      // 50% to stakers, and the rest to node
      await contracts.registries.setDefaultPayoutPercentage(50000);

      const user = await setupUser();

      const rewardAmount = 100n;

      await setupStake(node1.getAddress(), user, 100);

      await incrementRewardPool(node1, 1, rewardAmount);

      await setTimeSinceStart(1000);

      const balance = await contracts.syloToken.balanceOf(node1.getAddress());

      await rewardsManager.connect(node1).claim(node1.getAddress(), 1);

      const balanceAfter = await contracts.syloToken.balanceOf(
        node1.getAddress(),
      );

      expect(balanceAfter).to.equal(balance + rewardAmount / 2n);
    });

    it('can claim as node and stakee', async () => {
      // 50% to stakers, and the rest to node
      await contracts.registries.setDefaultPayoutPercentage(50000);

      await contracts.syloToken.transfer(node1.getAddress(), 1000);

      // node stakes against itself
      await setupStake(node1.getAddress(), node1, 1000);

      const rewardAmount = 100n;

      await incrementRewardPool(node1, 1, rewardAmount);

      await setTimeSinceStart(1000);

      const balance = await contracts.syloToken.balanceOf(node1.getAddress());

      await rewardsManager.connect(node1).claim(node1.getAddress(), 1);

      const balanceAfter = await contracts.syloToken.balanceOf(
        node1.getAddress(),
      );

      expect(balanceAfter).to.equal(balance + rewardAmount);
    });

    it('claim is distributed between nodes and stakers', async () => {
      // 50% to stakers, and the rest to node
      await contracts.registries.setDefaultPayoutPercentage(50000);

      const user = await setupUser();

      // user stakes against node
      await setupStake(node1.getAddress(), user, 1000);

      const rewardAmount = 100n;

      await incrementRewardPool(node1, 1, rewardAmount);

      await setTimeSinceStart(1000);

      await testClaim(node1.getAddress(), user, 1, rewardAmount / 2n);
    });

    it('cannot claim zero amount', async () => {
      await setTimeSinceStart(1000);

      await expect(
        rewardsManager.claim(node1.getAddress(), 1),
      ).to.be.revertedWithCustomError(rewardsManager, 'CannotClaimZeroAmount');
    });

    it('cannot claim for same cycle more than once', async () => {
      const user = await setupUser();

      const rewardAmount = 100n;

      await setupStake(node1.getAddress(), user, 100);

      await incrementRewardPool(node1, 1, rewardAmount);

      await setTimeSinceStart(1000);

      await testClaim(node1.getAddress(), user, 1, rewardAmount);

      await expect(
        rewardsManager.connect(user).claim(node1.getAddress(), 1),
      ).to.be.revertedWithCustomError(
        rewardsManager,
        'RewardForCycleAlreadyClaimed',
      );
    });

    it('cannot claim for unfinished cycle', async () => {
      await expect(
        rewardsManager.claim(node1.getAddress(), 1),
      ).to.be.revertedWithCustomError(
        rewardsManager,
        'CannotGetClaimForUnfinishedCycle',
      );
    });
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

  const setupStake = async (
    node: string | AddressLike,
    user: Signer,
    amount: BigNumberish,
  ) => {
    await contracts.syloToken
      .connect(user)
      .approve(contracts.syloStakingManager, MAX_SYLO);

    await contracts.syloStakingManager.connect(user).addStake(node, amount);

    return user;
  };

  async function incrementRewardPool(
    redeemer: Signer,
    cycle: number,
    escrowAmount?: BigNumberish,
    penaltyAmount?: BigNumberish,
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

  async function testClaim(
    node: AddressLike,
    user: Signer,
    cycle: BigNumberish,
    expectedIncrease: bigint,
  ) {
    const balance = await contracts.syloToken.balanceOf(user);

    const claim = await rewardsManager.getClaim(node, user.getAddress(), cycle);
    expect(claim).to.equal(expectedIncrease);

    const unclaimed = await rewardsManager.getUnclaimedReward(
      node,
      user.getAddress(),
      cycle,
    );
    expect(unclaimed).to.equal(expectedIncrease);

    await rewardsManager.connect(user).claim(node, cycle);

    const balanceAfter = await contracts.syloToken.balanceOf(user);

    expect(balanceAfter - balance).to.equal(expectedIncrease);
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
