const BN = require("bn.js");
const Token = artifacts.require("SyloToken");
const crypto = require("crypto");
const sodium = require('libsodium-wrappers-sumo');
const TicketingParameters = artifacts.require('TicketingParameters');
const Ticketing = artifacts.require("SyloTicketing");
const RewardsManager = artifacts.require("RewardsManager");
const EpochsManager = artifacts.require("EpochsManager");
const Directory = artifacts.require("Directory");
const eth = require('eth-lib');
const { soliditySha3 } = require("web3-utils");
const utils = require('../utils');

contract('Ticketing', accounts => {
  const faceValue = 15;
  const epochDuration = 1;

  let token;
  let epochsManager;
  let rewardsManager;
  let ticketingParameters;
  let ticketing;
  let directory;
  let listings;
  let stakingManager;

  before(async () => {
    token = await Token.new({ from: accounts[1] });
  });

  beforeEach(async () => {
    const contracts = await utils.initializeContracts(accounts[1], token.address, { faceValue, epochDuration });
    epochsManager = contracts.epochsManager;
    rewardsManager = contracts.rewardsManager;
    ticketingParameters = contracts.ticketingParameters;
    ticketing = contracts.ticketing;
    directory = contracts.directory;
    listings = contracts.listings;
    stakingManager = contracts.stakingManager;

    await rewardsManager.addManager(ticketing.address, { from: accounts[1] });
    await directory.transferOwnership(epochsManager.address, { from: accounts[1] });

    await token.approve(stakingManager.address, 10000, { from: accounts[1] });
    await token.approve(ticketing.address, 10000, { from: accounts[1] });
  });

  it('should be able to deposit escrow', async () => {
    const alice = web3.eth.accounts.create();
    await ticketing.depositEscrow(50, alice.address, { from: accounts[1] });

    const deposit = await ticketing.deposits(alice.address);
    assert.equal(deposit.escrow.toString(), '50', 'Expected 50 in escrow');
  });

  it('should be able to deposit penalty', async () => {
    const alice = web3.eth.accounts.create();
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });

    const deposit = await ticketing.deposits(alice.address);
    assert.equal(deposit.penalty.toString(), '50', 'Expected 50 in escrow');
  });

  it('should be able to deposit escrow multiple times', async () => {
    const alice = web3.eth.accounts.create();
    await ticketing.depositEscrow(50, alice.address, { from: accounts[1] });
    await ticketing.depositEscrow(50, alice.address, { from: accounts[1] });

    const deposit = await ticketing.deposits(alice.address);
    assert.equal(deposit.escrow.toString(), '100', 'Expected 100 in escrow');
  });

  it('should be able to depost to penalty multiple times', async () => {
    const alice = web3.eth.accounts.create();
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });

    const deposit = await ticketing.deposits(alice.address);
    assert.equal(deposit.penalty.toString(), '100', 'Expected 100 in penalty');
  });

  it('should fail to withdraw without unlocking', async () => {
    await ticketing.depositEscrow(50, accounts[0], { from: accounts[1] });

    await ticketing.withdraw({ from: accounts[0] })
      .then(() => {
        assert.fail('Withdrawing should fail');
      })
      .catch(e => {
        assert.include(e.message, 'Deposits not unlocked', 'Withdraw should fail due to not being unlocked');
      });
  });

  it('should fail to unlock without deposit', async () => {
    await ticketing.unlockDeposits({ from: accounts[2] })
      .then(() => {
        assert.fail('Withdrawing should fail');
      })
      .catch(e => {
        assert.include(e.message, 'Nothing to withdraw', 'Unlock should fail due to no deposit');
      });
  });

  it('should be able to unlock', async () => {
    await ticketing.depositEscrow(50, accounts[0], { from: accounts[1] });
    await ticketing.unlockDeposits({ from: accounts[0] });

    const deposit = await ticketing.deposits(accounts[0]);
    assert.isAbove(deposit.unlockAt.toNumber(), 0, 'Expected deposit to go into unlocking phase');
  });

  it('should fail to unlock if already unlocking', async () => {
    await ticketing.depositEscrow(50, accounts[0], { from: accounts[1] });
    await ticketing.unlockDeposits({ from: accounts[0] });

    await ticketing.unlockDeposits({ from: accounts[0] })
      .then(() => {
        assert.fail('Withdrawing should fail');
      })
      .catch(e => {
        assert.include(e.message, 'Unlock already in progress', 'Unlock should fail due to already unlocking');
      });
  });

  it('should fail to lock if already locked', async () => {
    await ticketing.depositEscrow(50, accounts[3], { from: accounts[1] });
    await ticketing.lockDeposits({ from: accounts[3] })
      .then(() => {
        assert.fail('Locking should fail');
      })
      .catch(e => {
        assert.include(e.message, 'Not unlocking, cannot lock', 'Expect lock to fail as it deposit is already locked');
      });
  });

  it('should be able to lock deposit while it is unlocked', async () => {
    await ticketing.depositEscrow(50, accounts[0], { from: accounts[1] });
    await ticketing.unlockDeposits({ from: accounts[0] });

    await ticketing.lockDeposits({ from: accounts[0] });

    const deposit = await ticketing.deposits(accounts[0]);
    assert.equal(deposit.unlockAt.toString(), '0', 'Expected deposit to move out of unlocking phase');
  });

  it('should be able to initialize next reward pool', async () => {
    await stakingManager.addStake(30, accounts[1], { from: accounts[1] });
    await listings.setListing("0.0.0.0/0", 1, { from: accounts[1] });

    const currentBlock = await web3.eth.getBlockNumber();
    await rewardsManager.initializeNextRewardPool({ from: accounts[1] });

    const rewardPool = await rewardsManager.getRewardPool(
      await epochsManager.getNextEpochId(),
      accounts[1]
    );

    assert.isAbove(
      parseInt(rewardPool.initializedAt),
      currentBlock,
      "Expected reward pool to track the block number it was created"
    );

    assert.equal(
      rewardPool.totalActiveStake.toString(),
      "30",
      "Expected reward pool to correctly track the stake at the time it was created"
    );
  });

  it('can not redeem ticket with invalid signature', async () => {
    await epochsManager.initializeEpoch({ from: accounts[1] });

    const alice = web3.eth.accounts.create();
    const { ticket, senderRand, redeemerRand } =
      await createWinningTicket(alice, 1);

    const signature = '0x00';

    await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] })
      .then(() => {
        assert.fail('Should fail to redeem ticket with invalid signature');
      })
      .catch(e => {
        assert.include(e.message, 'ECDSA: invalid signature length', 'Expected redeeming to fail due to invalid signature');
      });
  });

  it('can not redeem ticket with invalid sender rand', async () => {
    await epochsManager.initializeEpoch({ from: accounts[1] });

    const alice = web3.eth.accounts.create();
    const { ticket, redeemerRand, signature } =
      await createWinningTicket(alice, 1);

    const senderRand = 999;

    await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] })
      .then(() => {
        assert.fail('Should fail to redeem ticket with invalid redeemer rand');
      })
      .catch(e => {
        assert.include(e.message, 'Hash of senderRand doesn\'t match senderRandHash', 'Expected redeeming to fail due to invalid signature');
      });
  });

  it('can not redeem ticket with invalid redeemer rand', async () => {
    await epochsManager.initializeEpoch({ from: accounts[1] });

    const alice = web3.eth.accounts.create();
    const { ticket, senderRand, signature } =
      await createWinningTicket(alice, 1);

    const redeemerRand = 999;

    await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] })
      .then(() => {
        assert.fail('Should fail to redeem ticket with invalid redeemer rand');
      })
      .catch(e => {
        assert.include(e.message, 'Hash of redeemerRand doesn\'t match redeemerRandHash', 'Expected redeeming to fail due to invalid signature');
      });
  });

  it('can not redeem ticket if associated epoch does not exist', async () => {
    const alice = web3.eth.accounts.create();
    const { ticket, senderRand, redeemerRand, signature } =
      await createWinningTicket(alice, 1);

    ticket.epochId = 1;

    await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] })
      .then(() => {
        assert.fail('Should fail to redeem ticket with invalid epoch id');
      })
      .catch(e => {
        assert.include(e.message, 'Ticket\'s associated epoch does not exist', 'Expected redeeming to fail due to invalid epoch id');
      });
  });

  it('can not redeem ticket if not generated during associated epoch', async () => {
    await epochsManager.initializeEpoch({ from: accounts[1] });

    const alice = web3.eth.accounts.create();
    const { ticket, senderRand, redeemerRand, signature } =
      await createWinningTicket(alice, 1);

    ticket.generationBlock = 1;

    await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] })
      .then(() => {
        assert.fail('Should fail to redeem ticket with invalid generation block');
      })
      .catch(e => {
        assert.include(e.message, 'This ticket was not generated during it\'s associated epoch', 'Expected redeeming to fail due to invalid epoch');
      });
  });

  it('can redeem winning ticket', async () => {
    await stakingManager.addStake(1, accounts[1], { from: accounts[1] });
    await listings.setListing("0.0.0.0/0", 1, { from: accounts[1] });

    await particpateNextEpoch(accounts[1]);

    await epochsManager.initializeEpoch({ from: accounts[1] });

    const alice = web3.eth.accounts.create();
    await ticketing.depositEscrow(50, alice.address, { from: accounts[1] });
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });

    const { ticket, senderRand, redeemerRand, signature } =
      await createWinningTicket(alice, 1);

    await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] });

    const deposit = await ticketing.deposits.call(alice.address);
    assert.equal(deposit.escrow.toString(), '35', 'Expected ticket payout to be substracted from escrow');
    assert.equal(deposit.penalty.toString(), '50', 'Expected penalty to not be changed');

    const unclaimedNodeReward = await rewardsManager.getUnclaimedNodeReward(accounts[1]);
    const unclaimedStakeReward = await rewardsManager.getUnclaimedStakeReward(accounts[1]);

    assert.equal(
      unclaimedNodeReward.add(unclaimedStakeReward).toString(),
      '15',
      "Expected balance of unclaimed rewards to have added the ticket face value"
    );
  });

  it('burns penalty on insufficient escrow', async () => {
    await stakingManager.addStake(1, accounts[1], { from: accounts[1] });
    await listings.setListing("0.0.0.0/0", 1, { from: accounts[1] });

    await particpateNextEpoch(accounts[1]);

    await epochsManager.initializeEpoch({ from: accounts[1] });

    const alice = web3.eth.accounts.create();
    await ticketing.depositEscrow(5, alice.address, { from: accounts[1] });
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });

    const { ticket, senderRand, redeemerRand, signature } =
      await createWinningTicket(alice, 1);

    const initialTicketingBalance = await token.balanceOf(ticketing.address);

    await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] });

    const deposit = await ticketing.deposits.call(alice.address);
    assert.equal(deposit.escrow.toString(), '0', 'Expected entire escrow to be used');
    assert.equal(deposit.penalty.toString(), '0', 'Expected entire penalty to b burned');

    const unclaimedNodeReward = await rewardsManager.getUnclaimedNodeReward(accounts[1]);
    const unclaimedStakeReward = await rewardsManager.getUnclaimedStakeReward(accounts[1]);

    assert.equal(
      unclaimedNodeReward.add(unclaimedStakeReward).toString(),
      '5',
      "Expected unclaimed balance to have added the remaining available escrow"
    );

    const ticketingBalance = await token.balanceOf(ticketing.address);
    assert.equal(
      ticketingBalance.toString(),
      initialTicketingBalance.sub(new BN(55)).toString(),
      'Expected tokens from ticket contract to be removed'
    );

    const deadBalance = await token.balanceOf('0x000000000000000000000000000000000000dEaD');
    assert.equal(
      deadBalance.toString(),
      '50',
      'Expected dead address to receive burned tokens'
    );
  });

  it('should restake unclaimed staker rewards', async () => {
    await stakingManager.addStake(5, accounts[1], { from: accounts[1] });
    await listings.setListing("0.0.0.0/0", 1, { from: accounts[1] });

    await particpateNextEpoch(accounts[1]);

    await epochsManager.initializeEpoch({ from: accounts[1] });

    const alice = web3.eth.accounts.create();
    await ticketing.depositEscrow(50, alice.address, { from: accounts[1] });
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });

    for (let i = 0; i < 10; i++) {
      const { ticket, senderRand, redeemerRand, signature } =
        await createWinningTicket(alice, 1);
      await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] });
    }

    await particpateNextEpoch(accounts[1]);


    const rewardPool = await rewardsManager.getRewardPool(
      await epochsManager.getNextEpochId(),
      accounts[1]
    );

    const unclaimedStakeReward = await rewardsManager.getUnclaimedStakeReward(accounts[1]);

    // check the total active stake for the next epoch includes the unclaimed rewards plus
    // the managed stake
    assert.equal(
      rewardPool.totalActiveStake.toString(),
      unclaimedStakeReward.add(new BN(5)),
      "Expected total active stake for next reward pool to include unclaimed rewards"
    );
  });

  it('fails to to claim non existent rewards', async () => {
    rewardsManager.claimStakingRewards(accounts[0], { from: accounts[0] })
      .then(() => {
        assert.fail("Claiming should fail with no reward balance");
      })
      .catch(e => {
        assert.include(e.message, "Nothing to claim")
      });

    rewardsManager.claimNodeRewards({ from: accounts[0] })
      .then(() => {
        assert.fail("Claiming should fail with no reward balance");
      })
      .catch(e => {
        assert.include(e.message, "Nothing to claim")
      });
  });

  it('can claim ticketing rewards', async () => {
    await stakingManager.addStake(1, accounts[1], { from: accounts[1] });
    await listings.setListing("0.0.0.0/0", 1, { from: accounts[1] });

    await particpateNextEpoch(accounts[1]);

    await epochsManager.initializeEpoch({ from: accounts[1] });

    const alice = web3.eth.accounts.create();
    await ticketing.depositEscrow(5000, alice.address, { from: accounts[1] });
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });

    for (let i = 0; i < 10; i++) {
      const { ticket, senderRand, redeemerRand, signature } =
        await createWinningTicket(alice, 1);

      await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] });
    }

    const initialBalance = await token.balanceOf(accounts[1]);

    await rewardsManager.claimNodeRewards({ from: accounts[1] });
    await rewardsManager.claimStakingRewards(accounts[1], { from: accounts[1] });

    const postBalance = await token.balanceOf(accounts[1]);

    assert.equal(
      postBalance.toString(),
      initialBalance.add(new BN(150)).toString(),
      "Expected node to have entire reward balance added to their own balance"
    );

    const unclaimedNodeReward = await rewardsManager.getUnclaimedNodeReward(accounts[1]);
    const unclaimedStakeReward = await rewardsManager.getUnclaimedStakeReward(accounts[1]);

    assert.equal(
      unclaimedNodeReward.add(unclaimedStakeReward).toString(),
      '0',
      "Expected unclaimed balance be 0"
    );
  });

  it('delegated stakers should be able to claim rewards', async () => {
    for (let i = 2; i < 4; i++) {
      await token.transfer(accounts[i], 1000, { from: accounts[1]} );
      await token.approve(stakingManager.address, 1000, { from: accounts[i] });
    }

    // have account 2 and 3 as delegated stakers
    await stakingManager.addStake(2, accounts[1], { from: accounts[2] });
    await stakingManager.addStake(1, accounts[1], { from: accounts[3] });

    await listings.setListing("0.0.0.0/0", 1, { from: accounts[1] });

    await particpateNextEpoch(accounts[1]);
    await epochsManager.initializeEpoch({ from: accounts[1] });

    const alice = web3.eth.accounts.create();
    await ticketing.depositEscrow(5000, alice.address, { from: accounts[1] });
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });

    for (let i = 0; i < 10; i++) {
      const { ticket, senderRand, redeemerRand, signature } =
        await createWinningTicket(alice, 1);

      await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] });
    }

    const initialDelegatorTwoBalance = await token.balanceOf(accounts[2]);
    const initialDelegatorThreeBalance = await token.balanceOf(accounts[3]);

    await rewardsManager.claimStakingRewards(accounts[1], { from: accounts[2] });
    await rewardsManager.claimStakingRewards(accounts[1], { from: accounts[3] });

    const postDelegatorTwoBalance = await token.balanceOf(accounts[2]);
    const postDelegatorThreeBalance = await token.balanceOf(accounts[3]);

    // The stakers reward total is 70. Account 2 owns 66% of the stake, and account 1 owns
    // 33% of the stake, the splits should be 2/3 * 70 (46) and 1/3 * 70 (23)
    assert.equal(
      postDelegatorTwoBalance.toString(),
      initialDelegatorTwoBalance.add(new BN(46)).toString(),
      "Expected delegator to stakee reward balance added to their own balance"
    );

    assert.equal(
      postDelegatorThreeBalance.toString(),
      initialDelegatorThreeBalance.add(new BN(23)).toString(),
      "Expected delegator to stakee reward balance added to their own balance"
    );
  });

  it('should have rewards be automatically claimed when stake is updated', async () => {
    await token.transfer(accounts[2], 1000, { from: accounts[1]} );
    await token.approve(stakingManager.address, 1000, { from: accounts[2] });

    // have account 2 as a delegated staker
    await stakingManager.addStake(1, accounts[1], { from: accounts[2] });

    await listings.setListing("0.0.0.0/0", 1, { from: accounts[1] });

    await particpateNextEpoch(accounts[1]);
    await epochsManager.initializeEpoch({ from: accounts[1] });

    const alice = web3.eth.accounts.create();
    await ticketing.depositEscrow(5000, alice.address, { from: accounts[1] });
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });

    for (let i = 0; i < 10; i++) {
      const { ticket, senderRand, redeemerRand, signature } =
        await createWinningTicket(alice, 1);

      await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] });
    }

    // add more stake
    await stakingManager.addStake(1, accounts[1], { from: accounts[2] });

    const claimAfterAddingStake = await rewardsManager.calculateStakerClaim(accounts[1], accounts[2]);

    assert.equal(
      claimAfterAddingStake.toString(),
      '0',
      "Expected reward to be automatically claimed after adding stake"
    );

    for (let i = 0; i < 10; i++) {
      const { ticket, senderRand, redeemerRand, signature } =
        await createWinningTicket(alice, 1);

      await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] });
    }

    // remove some stake
    await stakingManager.unlockStake(1, accounts[1], { from: accounts[2] });

    const claimAfterRemovingStake = await rewardsManager.calculateStakerClaim(accounts[1], accounts[2]);

    assert.equal(
      claimAfterRemovingStake.toString(),
      '0',
      "Expected reward to be automatically claimed after adding stake"
    );
  });

  it('can not claim reward more than once', async () => {
    await stakingManager.addStake(1, accounts[1], { from: accounts[1] });
    await listings.setListing("0.0.0.0/0", 1, { from: accounts[1] });

    await particpateNextEpoch(accounts[1]);
    await epochsManager.initializeEpoch({ from: accounts[1] });

    const alice = web3.eth.accounts.create();
    await ticketing.depositEscrow(5000, alice.address, { from: accounts[1] });
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });

    const { ticket, senderRand, redeemerRand, signature } =
      await createWinningTicket(alice, 1);

    await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] });

    await rewardsManager.claimStakingRewards(accounts[1], { from: accounts[1] });

    const lastClaim = await rewardsManager.getLastClaim(accounts[1], accounts[1]);
    assert.isAbove(
      parseInt(lastClaim),
      0,
      "Expected last claim to be updated"
    );

    rewardsManager.claimStakingRewards(accounts[1], { from: accounts[1] })
      .then(() => {
        assert.fail("Claiming should fail as already claimed");
      })
      .catch(e => {
        assert.include(e.message, "Nothing to claim")
      });
  });

  it('should be able to correctly calculate staking rewards for multiple epochs when managed stake is the same', async () => {
    for (let i = 2; i < 5; i++) {
      await token.transfer(accounts[i], 1000, { from: accounts[1]} );
      await token.approve(stakingManager.address, 1000, { from: accounts[i] });
    }

    await listings.setListing("0.0.0.0/0", 1, { from: accounts[1] });

    // have account 2, 3 and 4 as delegated stakers with varying levels of stake
    await stakingManager.addStake(250, accounts[1], { from: accounts[2] });
    await stakingManager.addStake(400, accounts[1], { from: accounts[3] });
    await stakingManager.addStake(350, accounts[1], { from: accounts[4] });

    const alice = web3.eth.accounts.create();
    await ticketing.depositEscrow(5000, alice.address, { from: accounts[1] });
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });

    for (let j = 0; j < 3; j++) {
      await particpateNextEpoch(accounts[1]);
      await epochsManager.initializeEpoch({ from: accounts[1] });

      // 7 is added to the stakers reward total on each redemption (50% of 15)
      for (let i = 0 ; i < 6; i++) {
        const { ticket, senderRand, redeemerRand, signature } =
          await createWinningTicket(alice, 1);

        await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] });
      }
    }

    const unclaimedStakeReward = await rewardsManager.getUnclaimedStakeReward(accounts[1]);

    // the total unclaimed stake reward should 3 * 6 * 7 = 126
    assert.equal(
      unclaimedStakeReward,
      '126',
      "Expected unclaimed stake reward to correctly accumulate over multiple epochs"
    );

    // verify each staker will receive the correct amount of reward if they were to claim now
    const stakerClaimTwo = await rewardsManager.calculateStakerClaim(accounts[1], accounts[2]);
    assert.equal(
      stakerClaimTwo.toString(),
      '31', // account 2 owns 25% of the stake, so should get 25% of the unclaimed reward
      "Expected staker claim for account 2 to be correctly calculated"
    );

    const stakerClaimThree = await rewardsManager.calculateStakerClaim(accounts[1], accounts[3]);
    assert.equal(
      stakerClaimThree.toString(),
      '50', // account 3 owns 40% of the stake, so should get 40% of the unclaimed reward
      "Expected staker claim for account 3 to be correctly calculated"
    );

    const stakerClaimFour = await rewardsManager.calculateStakerClaim(accounts[1], accounts[4]);
    assert.equal(
      stakerClaimFour.toString(),
      '44', // account 4 owns 35% of the stake, so should get 35% of the unclaimed reward
      "Expected staker claim for account 4 to be correctly calculated"
    );

    // ensure each staker is actually able to claim
    for (let i = 2; i < 5; i++) {
      await rewardsManager.claimStakingRewards(accounts[1], { from: accounts[i] });
    }
  });

  it('should be able to correctly calculate staking rewards for multiple epochs when managed stake increases', async () => {
    for (let i = 2; i < 5; i++) {
      await token.transfer(accounts[i], 1000, { from: accounts[1]} );
      await token.approve(stakingManager.address, 1000, { from: accounts[i] });
    }

    await listings.setListing("0.0.0.0/0", 1, { from: accounts[1] });

    // have account 2, 3 and 4 as delegated stakers with varying levels of stake
    await stakingManager.addStake(250, accounts[1], { from: accounts[2] });
    await stakingManager.addStake(400, accounts[1], { from: accounts[3] });
    await stakingManager.addStake(350, accounts[1], { from: accounts[4] });

    const alice = web3.eth.accounts.create();
    await ticketing.depositEscrow(5000, alice.address, { from: accounts[1] });
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });

    // have account 5 add stake midway through
    for (let j = 0; j < 3; j++) {
      if (j == 1) {
        await token.transfer(accounts[5], 1000, { from: accounts[1]} );
        await token.approve(stakingManager.address, 1000, { from: accounts[5] });
        // their stake will be active in the next round
        await stakingManager.addStake(500, accounts[1], { from: accounts[5] });
      }
      await particpateNextEpoch(accounts[1]);
      await epochsManager.initializeEpoch({ from: accounts[1] });

      // 7 is added to the stakers reward total on each redemption (50% of 15)
      for (let i = 0 ; i < 6; i++) {
        const { ticket, senderRand, redeemerRand, signature } =
          await createWinningTicket(alice, 1);

        await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] });
      }
    }

    const epochTwoActiveStake = await rewardsManager.getRewardPoolActiveStake(2, accounts[1]).then(x => parseInt(x.toString()));

    // account 4's reward should be the sum of the rewards gained in both epoch 2 and 3
    // multiplied by the proportion of the stake held when their stake became active
    const expectedRewardFive = parseInt(500 * (2 * 6 * 7) / epochTwoActiveStake);
    const stakeClaimFive = await rewardsManager.calculateStakerClaim(accounts[1], accounts[5]);
    assert.equal(
      expectedRewardFive,
      parseInt(stakeClaimFive),
      "Expected account 5 to have their claim properly calculated"
    );

    // for accounts 2, 3, and 4, the total managed stake that becomes active
    // changes from epoch 2, thus to calculate the expected reward, we need
    // to caluclate the expected reward for epoch 1 using different stake proportions
    // than for epochs 2 and 3
    for (let i = 2; i < 5; i++) {
      const initialStake = await stakingManager.getCurrentStakerAmount(accounts[1], accounts[i]).then(x => parseInt(x.toString()));
      const epochOneActiveStake = await rewardsManager.getRewardPoolActiveStake(1, accounts[1]).then(x => parseInt(x.toString()));
      const epochOneReward = parseInt(initialStake * (6 * 7) / epochOneActiveStake);

      const stakeAtEpochTwo = initialStake + epochOneReward;
      const remainingReward = parseInt(stakeAtEpochTwo * (2 * 6 * 7) / epochTwoActiveStake);

      const totalExpectedReward = epochOneReward + remainingReward;
      const stakerClaim = await rewardsManager.calculateStakerClaim(accounts[1], accounts[i]);

      // due to rounding the staker claim may be 1 or 2 tokens different than the expected amount
      // but ensure it is close
      expect(parseInt(stakerClaim.toString())).to.be.within(totalExpectedReward - 2, totalExpectedReward + 2);
    }

    // ensure each staker is actually able to claim
    for (let i = 2; i < 6; i++) {
      await rewardsManager.claimStakingRewards(accounts[1], { from: accounts[i] });
    }
  });

  it('should be able to correctly calculate staking rewards for multiple epochs when managed stake decreases', async () => {
    for (let i = 2; i < 5; i++) {
      await token.transfer(accounts[i], 1000, { from: accounts[1]} );
      await token.approve(stakingManager.address, 1000, { from: accounts[i] });
    }

    await listings.setListing("0.0.0.0/0", 1, { from: accounts[1] });

    // have account 2, 3 and 4 as delegated stakers with varying levels of stake
    await stakingManager.addStake(250, accounts[1], { from: accounts[2] });
    await stakingManager.addStake(400, accounts[1], { from: accounts[3] });
    await stakingManager.addStake(350, accounts[1], { from: accounts[4] });

    const alice = web3.eth.accounts.create();
    await ticketing.depositEscrow(5000, alice.address, { from: accounts[1] });
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });

    // have account 2 unlock stake midway through
    for (let j = 0; j < 3; j++) {
      if (j == 1) {
        await stakingManager.unlockStake(250, accounts[1], { from: accounts[2] });
      }
      await particpateNextEpoch(accounts[1]);
      await epochsManager.initializeEpoch({ from: accounts[1] });

      // 7 is added to the stakers reward total on each redemption (50% of 15)
      for (let i = 0 ; i < 6; i++) {
        const { ticket, senderRand, redeemerRand, signature } =
          await createWinningTicket(alice, 1);

        await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] });
      }
    }

    const epochTwoActiveStake = await rewardsManager.getRewardPoolActiveStake(2, accounts[1]).then(x => parseInt(x.toString()));

    // for accounts 3, and 4, the total managed stake that becomes active
    // changes from epoch 2, thus to calculate the expected reward, we need
    // to caluclate the expected reward for epoch 1 using different stake proportions
    // than for epochs 2 and 3
    for (let i = 3; i < 5; i++) {
      const initialStake = await stakingManager.getCurrentStakerAmount(accounts[1], accounts[i]).then(x => parseInt(x.toString()));
      const epochOneActiveStake = await rewardsManager.getRewardPoolActiveStake(1, accounts[1]).then(x => parseInt(x.toString()));
      const epochOneReward = parseInt(initialStake * (6 * 7) / epochOneActiveStake);

      const stakeAtEpochTwo = initialStake + epochOneReward;
      const remainingReward = parseInt(stakeAtEpochTwo * (2 * 6 * 7) / epochTwoActiveStake);

      const totalExpectedReward = epochOneReward + remainingReward;
      const stakerClaim = await rewardsManager.calculateStakerClaim(accounts[1], accounts[i]);

      // due to rounding the staker claim may be 1 or 2 tokens different than the expected amount
      // but ensure it is close
      expect(parseInt(stakerClaim.toString())).to.be.within(totalExpectedReward - 2, totalExpectedReward + 2);
    }

    // ensure each staker is actually able to claim
    for (let i = 3; i < 5; i++) {
      await rewardsManager.claimStakingRewards(accounts[1], { from: accounts[i] });
    }
  });

  it('should decay winning probability as ticket approaches expiry', async () => {
    // deploy another ticketing contract with simpler parameters
    const contracts = await utils.initializeContracts(
      accounts[1],
      token.address,
      { faceValue,
        baseLiveWinProb: 100000,
        expiredWinProb: 1000,
        decayRate: 8000,
        ticketDuration: 100
      });
    epochsManager = contracts.epochsManager;
    rewardsManager = contracts.rewardsManager;
    ticketingParameters = contracts.ticketingParameters;
    ticketing = contracts.ticketing;
    directory = contracts.directory;
    listings = contracts.listings;
    stakingManager = contracts.stakingManager;

    await directory.transferOwnership(epochsManager.address, { from: accounts[1] });
    await rewardsManager.addManager(ticketing.address, { from: accounts[1] });

    await token.approve(ticketing.address, 10000, { from: accounts[1] });
    await token.approve(stakingManager.address, 10000, { from: accounts[1] });

    await stakingManager.addStake(1, accounts[1], { from: accounts[1] });
    await listings.setListing("0.0.0.0/0", 1, { from: accounts[1] });

    await particpateNextEpoch(accounts[1]);

    await epochsManager.initializeEpoch({ from: accounts[1] });

    const alice = web3.eth.accounts.create();
    await ticketing.depositEscrow(50, alice.address, { from: accounts[1] });
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });

    const { ticket } =
      await createWinningTicket(alice, 1);

    // advance the block halfway to ticket expiry
    for (let i = 0; i < 51; i++) {
      await utils.advanceBlock();
    }

    // check if the probability has decayed 50% of the maximum decayed value (80%)
    const expectedProbability = new BN(100000 - (0.5 * 0.8 * 100000));

    const decayedProbability = await ticketing.calculateWinningProbability(
      ticket,
      await epochsManager.getEpoch(ticket.epochId)
    );

    assert.equal(
      decayedProbability.toString(),
      expectedProbability.toString(),
      "Expected probablity of ticket winning to decay"
    );
  });

  it('returns 0 winning probability if ticket has expired', async () => {
    await stakingManager.addStake(1, accounts[1], { from: accounts[1] });
    await listings.setListing("0.0.0.0/0", 1, { from: accounts[1] });

    const alice = web3.eth.accounts.create();

    const { ticket } =
      await createWinningTicket(alice, 1);

    // advance the block all the way to ticket expiry
    for (let i = 0; i < 21; i++) {
      await utils.advanceBlock();
    }

    const p = await ticketing.calculateWinningProbability(
      ticket,
      await epochsManager.getEpoch(ticket.epochId)
    );

    assert.equal(
      '0',
      p.toString(),
      'Expected probabilit to be 0'
    );
  });

  it('simulates scenario between sender, node, and oracle', async () => {
    const sender = web3.eth.accounts.create();
    const node = accounts[1];

    // set up the node's stake and listing
    await stakingManager.addStake(1, node, { from: accounts[1] });
    await listings.setListing("0.0.0.0/0", 1, { from: accounts[1] });

    await particpateNextEpoch(accounts[1]);

    await epochsManager.initializeEpoch({ from: accounts[1] });

    // set up the sender's escrow
    await ticketing.depositEscrow(50, sender.address, { from: accounts[1] });
    await ticketing.depositPenalty(50, sender.address, { from: accounts[1] });

    // have the node and sender generate random numbers
    const nodeRand = crypto.randomBytes(32);
    const senderRand = crypto.randomBytes(32);

    // create commits from those random numbers
    const nodeCommit = soliditySha3(nodeRand);
    const senderCommit = soliditySha3(senderRand);

    const epochId = await epochsManager.getCurrentActiveEpoch().then(e => e.iteration);

    // create the ticket to be given to the node
    const ticket = {
      epochId,
      sender: sender.address,
      redeemer: node,
      generationBlock: new BN((await web3.eth.getBlockNumber()) + 1).toString(),
      senderCommit,
      redeemerCommit: nodeCommit
    };

    // have sender sign the hash of the ticket
    const ticketHash = await ticketing.getTicketHash(ticket);
    const signature = eth.Account.sign(ticketHash, sender.privateKey);

    // establish the oracle
    const oracle = sodium.crypto_sign_keypair('uint8array');

    // encrypt senderRandom to create the key
    const key = sodium.crypto_box_seal(
      senderRand,
      sodium.crypto_sign_ed25519_pk_to_curve25519(oracle.publicKey),
      'uint8array'
    );

    // have oracle decrypt the key and reveal the random number to the node
    const revealedSenderRand = sodium.crypto_box_seal_open(
      key,
      sodium.crypto_sign_ed25519_pk_to_curve25519(oracle.publicKey),
      sodium.crypto_sign_ed25519_sk_to_curve25519(oracle.privateKey),
      'uint8array'
    );

    // once secret has been revealed, the node can now redeem the ticket
    await ticketing.redeem(
      ticket,
      revealedSenderRand,
      nodeRand,
      signature,
      { from: node }
    );
  });

  async function particpateNextEpoch(account) {
    await directory.joinNextDirectory({ from: account });
    await rewardsManager.initializeNextRewardPool({ from: account });
  }

  async function createWinningTicket(sender, redeemer) {
    const senderRand = 1;
    const senderCommit = soliditySha3(senderRand);

    const redeemerRand = 1;
    const redeemerCommit = soliditySha3(redeemerRand);

    const generationBlock = await web3.eth.getBlockNumber();

    const epochId = await epochsManager.currentIteration();
    const ticket = {
      epochId: epochId.toNumber(),
      sender: sender.address,
      redeemer: accounts[redeemer],
      generationBlock: new BN(generationBlock + 1).toString(),
      senderCommit,
      redeemerCommit
    };

    const ticketHash = await ticketing.getTicketHash(ticket);

    const signature = eth.Account.sign(ticketHash, sender.privateKey);

    return { ticket, senderRand, redeemerRand, signature, ticketHash }
  }

});
