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
  Seeker,
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

  /**
   * These tests focus on adding and removing stake, and confirming the
   * reward cycle staking values are accurate. For simplicity, we set the
   * node's and user's seeker staking capacity to maximum values, so that
   * the seeker stake does not impact the sylo stake.
   */
  describe('Tests staking with sufficient capacity', () => {
    beforeEach(async () => {
      await setMaximumStakingCapacity(node, user);
    });

    it("can increase a user's stake at the start of the cycle", async () => {
      await startProtocol();

      const stakeAmount = 100n;

      await stakingOrchestrator.syloStakeAdded(node, user, stakeAmount);

      await checkUserStake(node, user, stakeAmount);
      await checkUserRewardCycleStake(1, node, user, stakeAmount);
    });

    it("can decrease a user's stake at the start of the cycle", async () => {
      await startProtocol();

      const stakeAmount = 100n;

      await stakingOrchestrator.syloStakeAdded(node, user, stakeAmount);

      await stakingOrchestrator.syloStakeRemoved(node, user, 50n);

      await checkUserStake(node, user, stakeAmount - 50n);
      await checkUserRewardCycleStake(1, node, user, stakeAmount - 50n);
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
      await checkUserRewardCycleStake(1, node, user, 150n);
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
      await checkUserRewardCycleStake(1, node, user, expectedRewardCycleStake);
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
      await checkUserRewardCycleStake(1, node, user, expectedRewardCycleStake);

      // progress 50% through the cycle
      await setTimeSinceStart(500);

      await stakingOrchestrator.syloStakeRemoved(node, user, 24n);

      expectedRewardCycleStake = expectedRewardCycleStake - 24n;
      await checkUserStake(node, user, expectedRewardCycleStake);
      await checkUserRewardCycleStake(1, node, user, expectedRewardCycleStake);

      // progress 80% through the cycle
      await setTimeSinceStart(800);

      await stakingOrchestrator.syloStakeRemoved(node, user, 11n);

      expectedRewardCycleStake = expectedRewardCycleStake - 11n;
      await checkUserStake(node, user, expectedRewardCycleStake);
      await checkUserRewardCycleStake(1, node, user, expectedRewardCycleStake);
    });

    it('can increase and decrease user stake multiple times and follow FIFO principles', async () => {
      const { setTimeSinceStart } = await startProtocol();

      await stakingOrchestrator.syloStakeAdded(node, user, 100n);

      // progress 20% throughout the cycle
      await setTimeSinceStart(200);

      await stakingOrchestrator.syloStakeAdded(node, user, 100n);

      await checkUserStake(node, user, 200n);
      await checkUserRewardCycleStake(1, node, user, 180n);

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
      await checkUserRewardCycleStake(1, node, user, 116n);

      // decrease more stake such that is subtracts from the first addition
      await stakingOrchestrator.syloStakeRemoved(node, user, 25n);

      await checkUserStake(node, user, 95n);

      // The previous stake removal is first applied to the second addition,
      // though as only 20 remains in the second addition, and 25 was removed,
      // the second stake addition is completely removed, and the remainder (5)
      // is applied to the first addition.
      //   * 95 stake added at 100%: 95 * 100% = 95
      //   total = 95
      await checkUserRewardCycleStake(1, node, user, 95n);

      // progress 50% throughout the cycle
      await setTimeSinceStart(500);

      await stakingOrchestrator.syloStakeAdded(node, user, 100n);

      await checkUserStake(node, user, 195n);

      // we add 50 to the previous reward cycle stake (50% of 100)
      await checkUserRewardCycleStake(1, node, user, 145n);

      // progress 75% throughout the cycle
      await setTimeSinceStart(750);

      await stakingOrchestrator.syloStakeAdded(node, user, 100n);

      await checkUserStake(node, user, 295n);

      // we add 25 to the previous reward cycle stake (25% of 100)
      await checkUserRewardCycleStake(1, node, user, 170n);

      // we decrease the stake by 150, which should wipe out the
      // previous addition, and subtract another 50 from the second addition
      await stakingOrchestrator.syloStakeRemoved(node, user, 150n);

      await checkUserStake(node, user, 145n);
      await checkUserRewardCycleStake(1, node, user, 120n);

      // we decrease the stake by 75, which should wipe out the remainder of
      // the second addition, and subtract 25 from the first addition
      await stakingOrchestrator.syloStakeRemoved(node, user, 75n);

      await checkUserStake(node, user, 70n);
      await checkUserRewardCycleStake(1, node, user, 70n);
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
      await checkUserRewardCycleStake(1, node, user, 100);

      await stakingOrchestrator.syloStakeAdded(node, user, 33);

      await checkUserStake(node, user, 133);
      await checkUserRewardCycleStake(1, node, user, 133);

      await stakingOrchestrator.syloStakeRemoved(node, user, 66);

      await checkUserStake(node, user, 67);
      await checkUserRewardCycleStake(1, node, user, 67);

      // start the protocol and confirm values
      await increase(1100);

      await checkUserStake(node, user, 67);
      await checkUserRewardCycleStake(1, node, user, 67);
    });

    it('can update user stake after first cycle', async () => {
      const { setTimeSinceStart } = await startProtocol();

      for (let i = 0; i < 10; i++) {
        await checkUserStake(node, user, 0);
        await checkUserRewardCycleStake(i + 1, node, user, 0);
        await setTimeSinceStart((i + 1) * 1000);
      }

      const [currentCycle] =
        await contracts.protocolTimeManager.getCurrentCycle();

      await stakingOrchestrator.syloStakeAdded(node, user, 100);

      await checkUserStake(node, user, 100);
      await checkUserRewardCycleStake(currentCycle, node, user, 100);
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

        let summedUserStake = 0n;

        // sum all user stakes
        for (const user of users) {
          const userStake = await stakingOrchestrator.getUserStake(node, user);
          summedUserStake += userStake;
        }

        expect(await stakingOrchestrator.getNodeStake(node)).to.equal(
          summedUserStake,
        );

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

  describe('Tests seeker staking', async () => {
    it('can add seeker stakes to increase capacity', async () => {
      const seekers = await Promise.all(
        Array(5)
          .fill(0)
          .map(_ =>
            createAndRegisterSeeker(contracts.seekerStatsOracle, accounts[0]),
          ),
      );

      for (let i = 0; i < seekers.length; i++) {
        await stakingOrchestrator.seekerStakeAdded(
          node,
          user,
          seekers[i].seekerId,
        );

        // check node capacity based on current staked seekers
        const nodeCapacity = await checkNodeStakingCapacity(
          node,
          seekers.slice(0, i + 1),
        );

        // a single contributes all seekers, so would have the same capacity
        // as the node
        expect(
          await stakingOrchestrator.getStakingCapacityByUser(node, user),
        ).to.equal(nodeCapacity);
      }
    });

    it('can remove seeker stakes and decrease capacity', async () => {
      const seekers = await Promise.all(
        Array(5)
          .fill(0)
          .map(_ =>
            createAndRegisterSeeker(contracts.seekerStatsOracle, accounts[0]),
          ),
      );

      for (let i = 0; i < seekers.length; i++) {
        await stakingOrchestrator.seekerStakeAdded(
          node,
          user,
          seekers[i].seekerId,
        );
      }

      for (let i = 0; i < seekers.length; i++) {
        await stakingOrchestrator.seekerStakeRemoved(
          node,
          user,
          seekers[i].seekerId,
        );

        // check node capacity based on remaining staked seekers
        const nodeCapacity = await checkNodeStakingCapacity(
          node,
          seekers.slice(i + 1, seekers.length),
        );

        // a single contributes all seekers, so would have the same capacity
        // as the node
        expect(
          await stakingOrchestrator.getStakingCapacityByUser(node, user),
        ).to.equal(nodeCapacity);
      }
    });

    it('can update node capacity from multiple users staking seekers', async () => {
      const registeredSeekers = [];
      for (const user of users) {
        const seekers = await Promise.all(
          Array(5)
            .fill(0)
            .map(_ =>
              createAndRegisterSeeker(contracts.seekerStatsOracle, accounts[0]),
            ),
        );

        for (const seeker of seekers) {
          registeredSeekers.push({
            user,
            seeker,
          });
        }
      }

      // shuffles the seekers
      registeredSeekers.sort(() => Math.random() - 0.5);

      const stakedSeekers = [];

      const userRanks: { [user: string]: number } = {};

      // stake all registered seekers and validate capacities after
      // each seeker stake
      for (const registeredSeeker of registeredSeekers) {
        await stakingOrchestrator.seekerStakeAdded(
          node,
          user,
          registeredSeeker.seeker.seekerId,
        );

        stakedSeekers.push(registeredSeeker.seeker);

        const nodeCapacity = await checkNodeStakingCapacity(
          node,
          stakedSeekers,
        );

        const nodeStats = sumSeekerStats(stakedSeekers);

        if (userRanks[user]) {
          userRanks[user] += registeredSeeker.seeker.rank;
        } else {
          userRanks[user] = registeredSeeker.seeker.rank;
        }

        // the user capacity is based on the user's rank contribution
        const expectedUserCapacity =
          (nodeCapacity * BigInt(userRanks[user])) / BigInt(nodeStats.rank);

        expect(
          await stakingOrchestrator.getStakingCapacityByUser(node, user),
        ).to.equal(expectedUserCapacity);
      }

      // unstake all registered seekers and validate capacities after
      // each seeker stake removal
      for (const registeredSeeker of registeredSeekers) {
        await stakingOrchestrator.seekerStakeRemoved(
          node,
          user,
          registeredSeeker.seeker.seekerId,
        );

        const idx = stakedSeekers.findIndex(
          seeker => seeker.seekerId === registeredSeeker.seeker.seekerId,
        );
        stakedSeekers.splice(idx, 1);

        const nodeCapacity = await checkNodeStakingCapacity(
          node,
          stakedSeekers,
        );

        const nodeStats = sumSeekerStats(stakedSeekers);

        userRanks[user] -= registeredSeeker.seeker.rank;

        const expectedUserCapacity =
          nodeStats.rank == 0
            ? 0
            : (nodeCapacity * BigInt(userRanks[user])) / BigInt(nodeStats.rank);

        expect(
          await stakingOrchestrator.getStakingCapacityByUser(node, user),
        ).to.equal(expectedUserCapacity);
      }
    });

    it('user staking capacity is not affected by other users changing seeker stake', async () => {
      const seekerOne = await createAndRegisterSeeker(
        contracts.seekerStatsOracle,
        accounts[0],
      );

      await stakingOrchestrator.seekerStakeAdded(
        node,
        users[0],
        seekerOne.seekerId,
      );

      const userOneCapacity =
        await stakingOrchestrator.getStakingCapacityByUser(node, users[0]);

      const stakedSeekers = [];

      // for the remaining users, have them also stake seekers
      for (const user of users.slice(1)) {
        const seeker = await createAndRegisterSeeker(
          contracts.seekerStatsOracle,
          accounts[0],
        );

        await stakingOrchestrator.seekerStakeAdded(node, user, seeker.seekerId);

        stakedSeekers.push({ user, seeker });
      }

      // validate the first user's staking capacity has not changed
      expect(
        await stakingOrchestrator.getStakingCapacityByUser(node, user),
      ).to.equal(userOneCapacity);

      // unstake the seekers
      for (const stakedSeeker of stakedSeekers) {
        await stakingOrchestrator.seekerStakeRemoved(
          node,
          stakedSeeker.user,
          stakedSeeker.seeker.seekerId,
        );
      }

      // validate the first user's staking capacity has not changed
      expect(
        await stakingOrchestrator.getStakingCapacityByUser(node, user),
      ).to.equal(userOneCapacity);
    });

    it('penalizes sylo stake if there is no capacity', async () => {
      await startProtocol();

      const stakeAmount = 100n;

      await stakingOrchestrator.syloStakeAdded(node, user, stakeAmount);

      // as there is no staking capacity, all of the user's stake is
      // penalized
      const expectedUserStake = stakeAmount / penaltyFactor;

      await checkUserStake(node, user, stakeAmount / penaltyFactor);
      await checkUserRewardCycleStake(1, node, user, expectedUserStake);
      await checkNodeRewardCycleStake(1, node, [user], expectedUserStake);

      // the node's stake is the sum of all user stakes, but then is also
      // penalized by the node's staking capacity
      await checkNodeStake(node, expectedUserStake / penaltyFactor);
    });

    it('does not penalize sylo stake within capacity', async () => {
      await timeManagerUtilities.setProtocolStartIn(1000);

      await createAndStakeSeeker(node, user);

      await stakingOrchestrator.syloStakeAdded(node, user, 100n);

      await checkUserStake(node, user, 100);
      await checkUserRewardCycleStake(1, node, user, 100);
    });

    it('penalizes sylo stake that is not within staking capacity', async () => {
      await timeManagerUtilities.setProtocolStartIn(1000);

      const { stakingCapacity } = await createAndStakeSeeker(node, user);

      // stake 100 more than staking capacity
      await stakingOrchestrator.syloStakeAdded(
        node,
        user,
        stakingCapacity + 100n,
      );

      const expectedStakeAmount = stakingCapacity + 100n / penaltyFactor;

      await checkUserStake(node, user, expectedStakeAmount);
      await checkUserRewardCycleStake(1, node, user, expectedStakeAmount);
    });

    it('treats increasing staking capacity as adding stake if over staked', async () => {
      await timeManagerUtilities.setProtocolStartIn(1000);

      const { stakingCapacity } = await createAndStakeSeeker(node, user);

      // stake 100 more than staking capacity
      await stakingOrchestrator.syloStakeAdded(
        node,
        user,
        stakingCapacity + 100n,
      );

      const totalStake = stakingCapacity + 100n;

      // stake another seeker which will be sufficient to cover entire stake
      await createAndStakeSeeker(node, user);

      await checkUserStake(node, user, totalStake);
      await checkUserRewardCycleStake(1, node, user, totalStake);
    });

    it('treats decreasing staking capacity as removing stake if it results in being over staked', async () => {
      await timeManagerUtilities.setProtocolStartIn(1000);

      const { seeker } = await createAndStakeSeeker(node, user);

      await stakingOrchestrator.syloStakeAdded(node, user, 100n);

      await stakingOrchestrator.seekerStakeRemoved(node, user, seeker.seekerId);

      // all stake should be penalized now
      await checkUserStake(node, user, 100n / penaltyFactor);
      await checkUserRewardCycleStake(1, node, user, 100n / penaltyFactor);
    });

    it('does not decrease stake when unstaking seeker if not overstaked', async () => {
      await timeManagerUtilities.setProtocolStartIn(1000);

      const { stakingCapacity } = await createAndStakeSeeker(node, user);

      // we stake 2 seekers which provides more staking capacity
      const { seeker } = await createAndStakeSeeker(node, user);

      // we stake only up to the capacity provied by the first seeker
      await stakingOrchestrator.syloStakeAdded(node, user, stakingCapacity);

      await checkUserStake(node, user, stakingCapacity);
      await checkUserRewardCycleStake(1, node, user, stakingCapacity);

      // unstake the second seeker
      await stakingOrchestrator.seekerStakeRemoved(node, user, seeker.seekerId);

      // stake should remain the same
      await checkUserStake(node, user, stakingCapacity);
      await checkUserRewardCycleStake(1, node, user, stakingCapacity);
    });

    it('changing stake through staking capacity follows cycle adjustment rules', async () => {
      await timeManagerUtilities.setProtocolStartIn(1000);

      const { stakingCapacity } = await createAndStakeSeeker(node, user);

      // stake 100 more than staking capacity
      await stakingOrchestrator.syloStakeAdded(
        node,
        user,
        stakingCapacity + 100n,
      );

      const totalStake = stakingCapacity + 100n;

      const { setTimeSinceStart } = await startProtocol();

      const startingRewardStake =
        await stakingOrchestrator.getRewardCycleStakeByUser(1, node, user);

      const seeker = await createAndRegisterSeeker(
        contracts.seekerStatsOracle,
        accounts[0],
      );

      await setTimeSinceStart(510);

      // this will increase the staking capacity, so the remaining overstaked
      // part is added (+75)
      await stakingOrchestrator.seekerStakeAdded(node, user, seeker.seekerId);

      await checkUserStake(node, user, totalStake);

      // as the stake was increased halfway, it should be only half as effected
      await checkUserRewardCycleStake(
        1,
        node,
        user,
        startingRewardStake + 75n / 2n,
      );

      // remove the staked seeker
      await stakingOrchestrator.seekerStakeRemoved(node, user, seeker.seekerId);

      await checkUserRewardCycleStake(1, node, user, startingRewardStake);
    });

    it('does not update users stake when other users change node staking capacity', async () => {
      await timeManagerUtilities.setProtocolStartIn(10000);

      const stakedSeekers = [];

      for (const user of users) {
        const seeker = await createAndStakeSeeker(node, user);
        stakedSeekers.push({ user, seeker });
      }

      const stakingCapacity =
        await stakingOrchestrator.getStakingCapacityByUser(node, users[0]);

      const totalStake = stakingCapacity + 100n;

      await stakingOrchestrator.syloStakeAdded(node, user, totalStake);

      // these values should not change as the other users stake/unstake seekers
      const userStake = await stakingOrchestrator.getUserStake(node, users[0]);
      const rewardCycleStake =
        await stakingOrchestrator.getRewardCycleStakeByUser(1, node, users[0]);

      for (const user of users.slice(1)) {
        const seeker = await createAndStakeSeeker(node, user);

        await checkUserStake(node, users[0], userStake);
        await checkUserRewardCycleStake(1, node, users[0], rewardCycleStake);

        await stakingOrchestrator.seekerStakeRemoved(
          node,
          user,
          seeker.seeker.seekerId,
        );

        await checkUserStake(node, users[0], userStake);
        await checkUserRewardCycleStake(1, node, users[0], rewardCycleStake);
      }
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

  async function checkUserRewardCycleStake(
    cycle: BigNumberish,
    node: string,
    user: string,
    expectedAmount: BigNumberish,
  ) {
    await expect(
      await stakingOrchestrator.getRewardCycleStakeByUser(cycle, node, user),
    ).to.equal(expectedAmount);
  }

  async function checkNodeStake(node: string, expectedAmount: BigNumberish) {
    expect(await stakingOrchestrator.getNodeStake(node)).to.equal(
      expectedAmount,
    );
  }

  async function checkNodeRewardCycleStake(
    cycle: BigNumberish,
    node: string,
    users: string[],
    expectedAmount?: BigNumberish,
  ) {
    let summedRewardCycleStake = 0n;

    // sum all user reward cycle stakes
    for (const user of users) {
      const rewardCycleUserStake =
        await stakingOrchestrator.getRewardCycleStakeByUser(cycle, node, user);
      summedRewardCycleStake += rewardCycleUserStake;
    }

    expect(
      await stakingOrchestrator.getRewardCycleStakeByNode(cycle, node),
    ).to.equal(summedRewardCycleStake);

    if (expectedAmount) {
      expect(summedRewardCycleStake).to.equal(expectedAmount);
    }
  }

  async function checkNodeStakingCapacity(node: string, seekers: Seeker[]) {
    const totalStats = sumSeekerStats(seekers);

    // validate the staking capacities after each addition
    const coverage =
      await contracts.seekerStatsOracle.calculateAttributeCoverage(
        totalStats.attrReactor,
        totalStats.attrCores,
        totalStats.attrDurability,
        totalStats.attrSensors,
        totalStats.attrStorage,
        totalStats.attrChip,
      );

    const nodeCapacity = coverage * coverageMultiplier;

    expect(await stakingOrchestrator.getStakingCapacityByNode(node)).to.equal(
      nodeCapacity,
    );

    return nodeCapacity;
  }

  const sumSeekerStats = (seekers: Seeker[]) => {
    let rank = 0;
    let attrReactor = 0;
    let attrCores = 0;
    let attrDurability = 0;
    let attrSensors = 0;
    let attrStorage = 0;
    let attrChip = 0;

    for (const seeker of seekers) {
      rank += seeker.rank;
      attrReactor += seeker.attrReactor;
      attrCores += seeker.attrCores;
      attrDurability += seeker.attrDurability;
      attrSensors += seeker.attrSensors;
      attrStorage += seeker.attrStorage;
      attrChip += seeker.attrChip;
    }

    return {
      rank,
      attrReactor,
      attrCores,
      attrDurability,
      attrSensors,
      attrStorage,
      attrChip,
    };
  };

  const createAndStakeSeeker = async (node: string, user: string) => {
    const seeker = await createAndRegisterSeeker(
      contracts.seekerStatsOracle,
      accounts[0],
    );

    await stakingOrchestrator.seekerStakeAdded(node, user, seeker.seekerId);

    const stakingCapacity = await stakingOrchestrator.getStakingCapacityByUser(
      node,
      user,
    );

    return { seeker, stakingCapacity };
  };

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
