import { ethers } from 'hardhat';
import { SyloContracts } from '../../common/contracts';
import {
  MAX_SYLO,
  ProtocolTimeManagerUtilities,
  deployContracts,
  getInterfaceId,
  getTimeManagerUtil,
} from '../utils';
import { BigNumberish, Signer } from 'ethers';
import { expect } from 'chai';
import { StakingOrchestrator, SyloStakingManager } from '../../typechain-types';
import * as hardhatHelper from '@nomicfoundation/hardhat-network-helpers';
import {
  createAndRegisterSeeker,
  createRandomSeeker,
} from '../seekerStats/stakingStats.test';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';

describe.only('Staking Orchestrator', () => {
  let accounts: Signer[];
  let contracts: SyloContracts;
  let stakingOrchestrator: StakingOrchestrator;
  let timeManagerUtilities: ProtocolTimeManagerUtilities;
  let startProtocol: typeof timeManagerUtilities.startProtocol;
  let node: string;
  let user: string;
  let users: string[];

  let coverageMultiplier: bigint;
  let penaltyFactor: bigint;

  let startP;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    contracts = await deployContracts();
    stakingOrchestrator = contracts.stakingOrchestrator;

    // set deployer as
    await stakingOrchestrator.grantRole(
      await stakingOrchestrator.onlyStakingManager(),
      accounts[0].getAddress(),
    );

    timeManagerUtilities = await getTimeManagerUtil(
      contracts.protocolTimeManager,
    );
    startProtocol = timeManagerUtilities.startProtocol;

    node = await accounts[9].getAddress();
    user = await accounts[1].getAddress();
    users = await Promise.all(accounts.slice(1, 6).map(a => a.getAddress()));

    coverageMultiplier = await stakingOrchestrator.capacityCoverageMultiplier();
    penaltyFactor = await stakingOrchestrator.capacityPenaltyFactor();
  });

  it("can increase a user's sylo stake at the start of the cycle", async () => {
    await startProtocol();

    const stakeAmount = 100n;

    await stakingOrchestrator.syloStakeAdded(node, user, stakeAmount);

    // with no staking capacity, the user's stake should divided by the penalty
    // factor
    const userStake = await stakingOrchestrator.getUserStake(node, user);
    expect(userStake).to.equal(stakeAmount / penaltyFactor);

    // the node's stake should be equal to the sum of the user stake, but with
    // no staking capacity, the node's stake should penalized as well.
    const nodeStake = await stakingOrchestrator.getNodeStake(node);
    expect(nodeStake).to.equal(userStake / penaltyFactor);

    // the user's stake was added at the beginning of the cycle, so reward
    // cycle stakes should be equal to the current user stake

    expect(
      await stakingOrchestrator.getRewardCycleStakeByUser(1, node, user),
    ).to.equal(userStake);

    // the reward cycle node stake should equal the sum of reward cycle
    // user stakes
    expect(
      await stakingOrchestrator.getRewardCycleStakeByNode(1, node),
    ).to.equal(userStake);
  });

  it("can decrease a user's stake at the start of the cycle", async () => {
    const { startProtocol } = timeManagerUtilities;

    await startProtocol();

    const stakeAmount = 100n;

    await stakingOrchestrator.syloStakeAdded(node, user, stakeAmount);

    const userStakeBeforeDecrease = await stakingOrchestrator.getUserStake(
      node,
      user,
    );

    await stakingOrchestrator.syloStakeRemoved(node, user, 50n);

    // the user's stake should proportionally decrease
    const decreaseFactor = stakeAmount / (stakeAmount - 50n);
    expect(await stakingOrchestrator.getUserStake(node, user)).to.equal(
      userStakeBeforeDecrease / decreaseFactor,
    );
  });

  describe('Staking with sufficient capacity', () => {
    beforeEach(async () => {
      await setMaximumStakingCapacity(node, user);
    });

    it("can increase a user's stake at the start of the cycle", async () => {
      await startProtocol();

      const stakeAmount = 100n;

      await stakingOrchestrator.syloStakeAdded(node, user, stakeAmount);

      await checkUserStake(node, user, stakeAmount);
      await checkRewardCycleUserStake(1, node, user, stakeAmount);
    });

    it("can decrease a user's stake at the start of the cycle", async () => {
      await startProtocol();

      const stakeAmount = 100n;

      await stakingOrchestrator.syloStakeAdded(node, user, stakeAmount);

      await stakingOrchestrator.syloStakeRemoved(node, user, 50n);

      await checkUserStake(node, user, stakeAmount - 50n);
      await checkRewardCycleUserStake(1, node, user, stakeAmount - 50n);
    });

    it("can increase a user's stake midway through the cycle", async () => {
      const { setTimeSinceStart } = await startProtocol();

      await stakingOrchestrator.syloStakeAdded(node, user, 100n);

      // forward to midway through cycle
      await setTimeSinceStart(500);

      await stakingOrchestrator.syloStakeAdded(node, user, 100n);

      // user stake should be equal to the total stake added
      await checkUserStake(node, user, 200n);

      // Reward cycle stake is adjusted based on when the stake was added.
      // So as the stake was added half way through the cycle, only half of the
      // added stake (100 * 50%) is considered
      await checkRewardCycleUserStake(1, node, user, 150n);
    });

    it("can increase a user's stake multiple times throughout the cycle", async () => {
      const { setTimeSinceStart } = await startProtocol();

      let expectedUserStake = 0n;
      let expectedRewardCycleStake = 0n;

      const cycleDuration =
        await contracts.protocolTimeManager.getCycleDuration();

      // after each iteration we increment 10% of the cycle duration, so each
      // stake addition is 10% less effective for the reward cycle stake
      for (let i = 0; i < 8; i++) {
        const stakeAmount = 100n;

        await stakingOrchestrator.syloStakeAdded(node, user, 100n);

        expectedUserStake += stakeAmount;

        const increaseDuration = 100;

        // the stake added for reward cycles is decreased depending on how
        // far into the cycle it is added
        expectedRewardCycleStake +=
          (stakeAmount *
            (cycleDuration - BigInt(i) * BigInt(increaseDuration))) /
          cycleDuration;

        await setTimeSinceStart(increaseDuration * (i + 1));
      }

      await checkUserStake(node, user, expectedUserStake);
      await checkRewardCycleUserStake(1, node, user, expectedRewardCycleStake);
    });

    it('calculates reward cycle stake correctly when stake is decreased multiple times throughout cycle', async () => {
      const { setTimeSinceStart } = await startProtocol();

      const stakeAmount = 100n;

      await stakingOrchestrator.syloStakeAdded(node, user, stakeAmount);

      // we decrease the stake multiple times throughout the cycle, and confirm
      // each time that it subtracts from the original amount regardless
      // of when the decrease occurred

      // progress 25% through the cycle
      await setTimeSinceStart(250);

      await stakingOrchestrator.syloStakeRemoved(node, user, 33n);

      let expectedRewardCycleStake = stakeAmount - 33n;
      await checkUserStake(node, user, expectedRewardCycleStake);
      await checkRewardCycleUserStake(1, node, user, expectedRewardCycleStake);

      // progress 50% through the cycle
      await setTimeSinceStart(500);

      await stakingOrchestrator.syloStakeRemoved(node, user, 24n);

      expectedRewardCycleStake = expectedRewardCycleStake - 24n;
      await checkUserStake(node, user, expectedRewardCycleStake);
      await checkRewardCycleUserStake(1, node, user, expectedRewardCycleStake);

      // progress 80% through the cycle
      await setTimeSinceStart(800);

      await stakingOrchestrator.syloStakeRemoved(node, user, 11n);

      expectedRewardCycleStake = expectedRewardCycleStake - 11n;
      await checkUserStake(node, user, expectedRewardCycleStake);
      await checkRewardCycleUserStake(1, node, user, expectedRewardCycleStake);
    });

    it('can increase and decrease user stake multiple times and follow FIFO principles', async () => {
      const { setTimeSinceStart } = await startProtocol();

      await stakingOrchestrator.syloStakeAdded(node, user, 100n);

      // progress 20% throughout the cycle
      await setTimeSinceStart(200);

      await stakingOrchestrator.syloStakeAdded(node, user, 100n);

      await checkUserStake(node, user, 200n);
      await checkRewardCycleUserStake(1, node, user, 180n);

      // decrease stake (should decrease from second addition)
      await stakingOrchestrator.syloStakeRemoved(node, user, 80n);

      await checkUserStake(node, user, 120n);

      // The decrease is applied to the second addition of 100 stake, so the
      // reward stake calculation treats the stake as if only `100 - 80 = 20` stake was
      // added the second time. The 20 stake is then adjusted due to the addition
      // occurring 20% into the cycle.
      // The staking additions is as follows:
      //   * 100 stake added at 100%: 100 * 100% = 100
      //   * 20 stake added at 80%: 20 * 80% = 16
      //   total = 100 + 16 = 116
      await checkRewardCycleUserStake(1, node, user, 116n);

      // decrease more stake such that is subtracts from the first addition
      await stakingOrchestrator.syloStakeRemoved(node, user, 25n);

      await checkUserStake(node, user, 95n);

      // The previous stake removal is first applied to the second addition,
      // though as only 20 remains in the second addition, and 25 was removed,
      // the second stake addition is completely removed, and the remainder (5)
      // is applied to the first addition.
      //   * 95 stake added at 100%: 95 * 100% = 95
      //   total = 95
      await checkRewardCycleUserStake(1, node, user, 95n);

      // progress 50% throughout the cycle
      await setTimeSinceStart(500);

      await stakingOrchestrator.syloStakeAdded(node, user, 100n);

      await checkUserStake(node, user, 195n);

      // we add 50 to the previous reward cycle stake (50% of 100)
      await checkRewardCycleUserStake(1, node, user, 145n);

      // progress 75% throughout the cycle
      await setTimeSinceStart(750);

      await stakingOrchestrator.syloStakeAdded(node, user, 100n);

      await checkUserStake(node, user, 295n);

      // we add 25 to the previous reward cycle stake (25% of 100)
      await checkRewardCycleUserStake(1, node, user, 170n);

      // we decrease the stake by 150, which should wipe out the
      // previous addition, and subtract another 50 from the second addition
      await stakingOrchestrator.syloStakeRemoved(node, user, 150n);

      await checkUserStake(node, user, 145n);
      await checkRewardCycleUserStake(1, node, user, 120n);

      // we decrease the stake by 75, which should wipe out the remainder of
      // the second addition, and subtract 25 from the first addition
      await stakingOrchestrator.syloStakeRemoved(node, user, 75n);

      await checkUserStake(node, user, 70n);
      await checkRewardCycleUserStake(1, node, user, 70n);
    });

    it("uses user's current user stake for next reward cycle stake", async () => {
      const { setTimeSinceStart } = await startProtocol();

      // after each iteration we increment 10% of the cycle duration, so each
      // stake addition is 10% less effective for the reward cycle stake
      for (let i = 0; i < 8; i++) {
        await stakingOrchestrator.syloStakeAdded(node, user, 100n);

        const increaseDuration = 100;

        await setTimeSinceStart(increaseDuration * (i + 1));
      }

      const userStake = await stakingOrchestrator.getUserStake(node, user);
      const rewardCycleStakeOne =
        await stakingOrchestrator.getRewardCycleStakeByUser(1, node, user);

      // the reward cycle stake for the current cycle stake will be less
      // than the user stake, as the additions occurred after the cycle had already
      // started
      expect(rewardCycleStakeOne).to.be.lessThan(userStake);

      // progress to cycle 6
      for (let i = 0; i < 5; i++) {
        await setTimeSinceStart((i + 1) * 1000);
      }

      // confirm for cycles 2 to 6, it is equal to the current user stake
      for (let i = 2; i <= 6; i++) {
        const rewardCycleStake =
          await stakingOrchestrator.getRewardCycleStakeByUser(i, node, user);

        expect(rewardCycleStake).to.equal(userStake);
      }

      // change the user's stake
      await stakingOrchestrator.syloStakeRemoved(node, user, 50n);

      const updatedUserStake = await stakingOrchestrator.getUserStake(
        node,
        user,
      );

      // advance the protocol a few more cycles
      await setTimeSinceStart(9000); // cycle 10

      // confirm the previous reward cycle stakes remain the same
      for (let i = 2; i <= 5; i++) {
        const rewardCycleStake =
          await stakingOrchestrator.getRewardCycleStakeByUser(i, node, user);

        expect(rewardCycleStake).to.equal(userStake);
      }

      // confirm the rest of the reward cycle stakes are equal to the current
      // user stake
      for (let i = 7; i <= 10; i++) {
        const rewardCycleStake =
          await stakingOrchestrator.getRewardCycleStakeByUser(i, node, user);

        expect(rewardCycleStake).to.equal(updatedUserStake);
      }
    });

    it('can update user stake before the protocol starts', async () => {
      await timeManagerUtilities.setProtocolStartIn(1000);

      // all additions should be at the full effect as they occur
      // before the cycle starts

      await stakingOrchestrator.syloStakeAdded(node, user, 100);

      await checkUserStake(node, user, 100);
      await checkRewardCycleUserStake(1, node, user, 100);

      await stakingOrchestrator.syloStakeAdded(node, user, 33);

      await checkUserStake(node, user, 133);
      await checkRewardCycleUserStake(1, node, user, 133);

      await stakingOrchestrator.syloStakeRemoved(node, user, 66);

      await checkUserStake(node, user, 67);
      await checkRewardCycleUserStake(1, node, user, 67);

      // start the protocol and confirm values
      await increase(1100);

      await checkUserStake(node, user, 67);
      await checkRewardCycleUserStake(1, node, user, 67);
    });

    it('can update user stake after first cycle', async () => {
      const { setTimeSinceStart } = await startProtocol();

      for (let i = 0; i < 10; i++) {
        await checkUserStake(node, user, 0);
        await checkRewardCycleUserStake(i + 1, node, user, 0);
        await setTimeSinceStart((i + 1) * 1000);
      }

      const [currentCycle] =
        await contracts.protocolTimeManager.getCurrentCycle();

      await stakingOrchestrator.syloStakeAdded(node, user, 100);

      await checkUserStake(node, user, 100);
      await checkRewardCycleUserStake(currentCycle, node, user, 100);
    });

    it('calculates node stake as sum of all user stakes', async () => {
      for (const user of users) {
        await setMaximumStakingCapacity(node, user);
      }

      const { setTimeSinceStart } = await startProtocol();

      // for each user, perform a mix of staking additions and removals
      const performStakingUpdates = async () => {
        for (let i = 0; i < 5; i++) {
          for (let j = 0; j < users.length; j++) {
            if (i % 2 == 0) {
              // stake different amount for each user
              const amount = 100 + j * 25;
              await stakingOrchestrator.syloStakeAdded(node, users[j], amount);
            } else {
              await stakingOrchestrator.syloStakeRemoved(node, users[j], 3n);
            }
          }

          await increase(125);
        }
      };

      // perform over multiple cycles
      for (let i = 1; i < 6; i++) {
        await performStakingUpdates();

        await checkNodeStake(node, users);

        await setTimeSinceStart(i * 1000);
      }

      await setTimeSinceStart(10000);

      const [latestCycle] =
        await contracts.protocolTimeManager.getCurrentCycle();

      for (let i = 1; i <= Number(latestCycle); i++) {
        await checkNodeRewardCycleStake(i, node, users);
      }
    });

    it('calculates node stake correctly when stake has not been updated over multiple cycles', async () => {
      for (const user of users) {
        await setMaximumStakingCapacity(node, user);
      }

      const { setTimeSinceStart } = await startProtocol();

      // for each user, perform a mix of staking additions and removals
      const performStakingUpdates = async () => {
        for (let i = 0; i < 5; i++) {
          for (let j = 0; j < users.length; j++) {
            if (i % 2 == 0) {
              // stake different amount for each user
              const amount = 100 + j * 25;
              await stakingOrchestrator.syloStakeAdded(node, users[j], amount);
            } else {
              await stakingOrchestrator.syloStakeRemoved(node, users[j], 3n);
            }
          }

          await increase(125);
        }
      };

      // update stake at cycle 1
      await performStakingUpdates();

      await checkNodeRewardCycleStake(1, node, users);

      // progress to cycle 5
      await setTimeSinceStart(4000);

      await checkNodeRewardCycleStake(5, node, users);

      // update stakes again
      await performStakingUpdates();

      await checkNodeRewardCycleStake(5, node, users);

      // progress to cycle 10
      await setTimeSinceStart(9000);

      for (let i = 1; i < 11; i++) {
        await checkNodeRewardCycleStake(i, node, users);
      }
    });

    it('can query stakes before protocol has started', async () => {
      expect(await stakingOrchestrator.getNodeStake(node)).to.equal(0);
      expect(await stakingOrchestrator.getUserStake(node, user)).to.equal(0);
      expect(
        await stakingOrchestrator.getRewardCycleStakeByNode(0, node),
      ).to.equal(0);
      expect(
        await stakingOrchestrator.getRewardCycleStakeByUser(0, node, user),
      ).to.equal(0);
    });
  });

  async function checkUserStake(
    node: string,
    user: string,
    expectedAmount: BigNumberish,
  ) {
    await expect(await stakingOrchestrator.getUserStake(node, user)).to.equal(
      expectedAmount,
    );
  }

  async function checkRewardCycleUserStake(
    cycle: BigNumberish,
    node: string,
    user: string,
    expectedAmount: BigNumberish,
  ) {
    await expect(
      await stakingOrchestrator.getRewardCycleStakeByUser(cycle, node, user),
    ).to.equal(expectedAmount);
  }

  async function checkNodeStake(node: string, users: string[]) {
    let expectedNodeStake = 0n;

    // sum all user stakes
    for (const user of users) {
      const userStake = await stakingOrchestrator.getUserStake(node, user);
      expectedNodeStake += userStake;
    }

    expect(await stakingOrchestrator.getNodeStake(node)).to.equal(
      expectedNodeStake,
    );
  }

  async function checkNodeRewardCycleStake(
    cycle: BigNumberish,
    node: string,
    users: string[],
  ) {
    let expectedNodeCycleStake = 0n;

    // sum all user reward cycle stakes
    for (const user of users) {
      const rewardCycleUserStake =
        await stakingOrchestrator.getRewardCycleStakeByUser(cycle, node, user);
      expectedNodeCycleStake += rewardCycleUserStake;
    }

    expect(
      await stakingOrchestrator.getRewardCycleStakeByNode(cycle, node),
    ).to.equal(expectedNodeCycleStake);
  }

  const setMaximumStakingCapacity = async (node: string, user: string) => {
    await stakingOrchestrator.setCapacityCoverageMultiplier(MAX_SYLO);
    coverageMultiplier = MAX_SYLO;

    const seeker = await createAndRegisterSeeker(
      contracts.seekerStatsOracle,
      accounts[0],
    );

    await stakingOrchestrator.seekerStakeAdded(node, user, seeker.seekerId);
  };
});
