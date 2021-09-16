const BN = require("bn.js");
const Token = artifacts.require("SyloToken");
const crypto = require("crypto");
const sodium = require('libsodium-wrappers-sumo');
const TicketingParameters = artifacts.require('TicketingParameters');
const Ticketing = artifacts.require("SyloTicketing");
const RewardsManager = artifacts.require("RewardsManager");
const EpochsManager = artifacts.require("EpochsManager");
const Directory = artifacts.require("Directory");
const Listings = artifacts.require("Listings");
const StakingManager = artifacts.require("StakingManager");
const eth = require('eth-lib');
const { soliditySha3 } = require("web3-utils");
const utils = require('../utils');

contract('Ticketing', accounts => {
  const payoutPercentage = 5000;

  const faceValue = 15;

  const baseLiveWinProb = (new BN(2)).pow(new BN(128)).sub(new BN(1)).toString();
  const expiredWinProb = 1000;
  const decayRate = 8000;
  const ticketDuration = 20;

  const epochDuration = 30;

  let token;

  let epochsManager;
  let rewardsManager;
  let ticketingParameters;
  let ticketing;

  let directory;

  let listings;
  let stakingManager;
  // private keys generated from default truffle mnemonic
  // use these to sign tickets
  const privateKeys =
    [ '0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3',
      '0xae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f',
      '0x0dbbe8e4ae425a6d2687f1a7e3ba17bc98c673636790f1b8ad91193c05875ef1',
      '0xc88b703fb08cbea894b6aeff5a544fb92e78a18e19814cd85da83b71f772aa6c',
      '0x388c684f0ba1ef5017716adb5d21a053ea8e90277d0868337519f97bede61418',
      '0x659cbb0e2411a44db63778987b1e22153c086a95eb6b18bdf89de078917abc63',
      '0x82d052c865f5763aad42add438569276c00d3d88a2d062d36b2bae914d58b8c8',
      '0xaa3680d5d48a8283413f7a108367c7299ca73f553735860a87b08f39395618b7',
      '0x0f62d96d6675f32685bbdb8ac13cda7c23436f63efbb9d07700d8669ff12b7c4',
      '0x8d5366123cb560bb606379f90a0bfd4769eecc0557f1b362dcae9012b548b1e5]'
    ]

  before(async () => {
    token = await Token.new({ from: accounts[1] });
  });

  beforeEach(async () => {
    listings = await Listings.new({ from: accounts[1] });
    await listings.initialize(payoutPercentage), { from: accounts[1] };

    stakingManager = await StakingManager.new({ from: accounts[1] });
    await stakingManager.initialize(token.address, 0, { from: accounts[1] });
    await token.approve(stakingManager.address, 10000, { from: accounts[1] });

    ticketingParameters = await TicketingParameters.new({ from: accounts[1] });
    await ticketingParameters.initialize(
      faceValue,
      baseLiveWinProb,
      expiredWinProb,
      decayRate,
      ticketDuration,
      { from: accounts[1] }
    );

    directory = await Directory.new({ from: accounts[1] });
    await directory.initialize(
        stakingManager.address,
      { from: accounts[1] }
    );

    epochsManager = await EpochsManager.new({ from: accounts[1] });
    await epochsManager.initialize(
      directory.address,
      listings.address,
      ticketingParameters.address,
      epochDuration,
      { from: accounts[1] }
    );

    await directory.transferOwnership(epochsManager.address, { from: accounts[1] });

    rewardsManager = await RewardsManager.new({ from: accounts[1] });
    await rewardsManager.initialize(
      token.address,
      stakingManager.address,
      epochsManager.address,
      { from: accounts[1] }
    );

    ticketing = await Ticketing.new({ from: accounts[1] })
    await ticketing.initialize(
      token.address,
      listings.address,
      stakingManager.address,
      directory.address,
      epochsManager.address,
      rewardsManager.address,
      0,
      { from: accounts[1] }
    );

    await rewardsManager.addManager(ticketing.address, { from: accounts[1] });

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

    ticket.epochId = '0x0000000000000000000000000000000000000000000000000000000000000000';

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
    // simulate having account[1] as a node with a listing and a
    // stakingManager entry
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

    const rewardPoolBalance = await rewardsManager.getRewardPoolBalance(ticket.epochId, ticket.redeemer);
    assert.equal(
      rewardPoolBalance.toString(),
      '15',
      "Expected balance of reward pool to have added the ticket face value"
    );
  });

  it('burns penalty on insufficient escrow', async () => {
    // simulate having account[1] as a node with a listing and a
    // stakingManager entry
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

    const rewardPoolBalance = await rewardsManager.getRewardPoolBalance(ticket.epochId, ticket.redeemer);
    assert.equal(
      rewardPoolBalance.toString(),
      '5',
      "Expected balance of reward pool to have added the remaining available escrow"
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

  it('fails to calim reward for non existent epoch', async () => {
    rewardsManager.claimReward(
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      accounts[0],
      { from: accounts[0] }
    ).then(() => {
      assert.fail("Claimimg should fail due to invalid epoch")
    }).catch(e => {
      assert.include(e.message, "Epoch does not exist");
    });
  });

  it('fails to claim reward for epoch that hasn\'t ended', async () => {
    await epochsManager.initializeEpoch({ from: accounts[1] });
    const epoch = await epochsManager.getCurrentActiveEpoch();
    const epochId = await epochsManager.getEpochId(epoch.iteration);

    rewardsManager.claimRewards([epochId], accounts[0], { from: accounts[0] })
      .then(() => {
        assert.fail("Claimimg should fail as epoch has not ended");
      })
      .catch(e => {
        assert.include(e.message, "Epoch has not yet ended")
      });
  });

  it('fails to claim reward if all tickets not expired', async () => {
    await epochsManager.initializeEpoch({ from: accounts[1] });
    const epoch = await epochsManager.getCurrentActiveEpoch();
    const epochId = await epochsManager.getEpochId(epoch.iteration);

    // advance block till epoch has ended
    for (let i = 0; i < 31; i++) {
      await utils.advanceBlock();
    }

    await epochsManager.initializeEpoch({ from: accounts[1] });

    rewardsManager.claimRewards([epochId], accounts[0], { from: accounts[0] })
      .then(() => {
        assert.fail("Claimimg should fail as not all tickets expired");
      })
      .catch(e => {
        assert.include(e.message, "Can only claim rewards once all possible tickets have been redeemed")
      });
  });

  it('fails to to claim non existent reward', async () => {
    await epochsManager.initializeEpoch({ from: accounts[1] });
    const epoch = await epochsManager.getCurrentActiveEpoch();
    const epochId = await epochsManager.getEpochId(epoch.iteration);

    // advance block till epoch has ended
    for (let i = 0; i < 31; i++) {
      await utils.advanceBlock();
    }

    await epochsManager.initializeEpoch({ from: accounts[1] });

    // advance block till tickets expire
    for (let i = 0; i < 21; i++) {
      await utils.advanceBlock();
    }

    rewardsManager.claimRewards([epochId], accounts[0], { from: accounts[0] })
      .then(() => {
        assert.fail("Disitribution should fail with no reward balance");
      })
      .catch(e => {
        assert.include(e.message, "Can not claim reward if balance is zero")
      });
  });

  it('can claim ticketing rewards', async () => {
    await stakingManager.addStake(1, accounts[1], { from: accounts[1] });
    await listings.setListing("0.0.0.0/0", 1, { from: accounts[1] });

    await particpateNextEpoch(accounts[1]);

    await epochsManager.initializeEpoch({ from: accounts[1] });
    const epoch = await epochsManager.getCurrentActiveEpoch();
    const epochId = await epochsManager.getEpochId(epoch.iteration);

    const alice = web3.eth.accounts.create();
    await ticketing.depositEscrow(5000, alice.address, { from: accounts[1] });
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });

    for (let i = 0; i < 10; i++) {
      const { ticket, senderRand, redeemerRand, signature } =
        await createWinningTicket(alice, 1);

      await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] });
    }

    const rewardPoolBalance = await rewardsManager.getRewardPoolBalance(epochId, accounts[1]);
    assert.equal(
      rewardPoolBalance.toString(),
      '150',
      "Expected balance of reward pool to have added the ticket face value each time"
    );

    // advance block till epoch has ended
    for (let i = 0; i < 31; i++) {
      await utils.advanceBlock();
    }

    await epochsManager.initializeEpoch({ from: accounts[1] });

    // advance block till tickets expire
    for (let i = 0; i < 21; i++) {
      await utils.advanceBlock();
    }

    const initialRedeemerBalance = await token.balanceOf(accounts[1]);

    await rewardsManager.claimRewards([epochId], accounts[1], { from: accounts[1] });

    const postRedeemerBalance = await token.balanceOf(accounts[1]);

    assert.equal(
      postRedeemerBalance.toString(),
      initialRedeemerBalance.add(new BN(150)).toString(),
      "Expected node to have entire reward balance added to their own balance"
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
    const epoch = await epochsManager.getCurrentActiveEpoch();
    const epochId = await epochsManager.getEpochId(epoch.iteration);

    const alice = web3.eth.accounts.create();
    await ticketing.depositEscrow(5000, alice.address, { from: accounts[1] });
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });

    for (let i = 0; i < 10; i++) {
      const { ticket, senderRand, redeemerRand, signature } =
        await createWinningTicket(alice, 1);

      await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] });
    }

    // advance block till epoch has ended
    for (let i = 0; i < 31; i++) {
      await utils.advanceBlock();
    }

    await epochsManager.initializeEpoch({ from: accounts[1] });

    // advance block till tickets expire
    for (let i = 0; i < 21; i++) {
      await utils.advanceBlock();
    }

    const initialDelegatorTwoBalance = await token.balanceOf(accounts[2]);
    const initialDelegatorThreeBalance = await token.balanceOf(accounts[3]);

    await rewardsManager.claimRewards([epochId], accounts[1], { from: accounts[2] });
    await rewardsManager.claimRewards([epochId], accounts[1], { from: accounts[3] });

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

  it('can not claim reward more than once', async () => {
    await stakingManager.addStake(1, accounts[1], { from: accounts[1] });
    await listings.setListing("0.0.0.0/0", 1, { from: accounts[1] });

    await particpateNextEpoch(accounts[1]);

    await epochsManager.initializeEpoch({ from: accounts[1] });
    const epoch = await epochsManager.getCurrentActiveEpoch();
    const epochId = await epochsManager.getEpochId(epoch.iteration);

    const alice = web3.eth.accounts.create();
    await ticketing.depositEscrow(5000, alice.address, { from: accounts[1] });
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });

    for (let i = 0 ; i < 10; i++) {
      const { ticket, senderRand, redeemerRand, signature } =
        await createWinningTicket(alice, 1);

      await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] });
    }

    // advance block till epoch has ended
    for (let i = 0; i < 31; i++) {
      await utils.advanceBlock();
    }

    await epochsManager.initializeEpoch({ from: accounts[1] });

    // advance block till tickets expire
    for (let i = 0; i < 21; i++) {
      await utils.advanceBlock();
    }

    await rewardsManager.claimRewards([epochId], accounts[1], { from: accounts[1] });
    rewardsManager.claimRewards([epochId], accounts[1], { from: accounts[1] })
      .then(() => {
        assert.fail("Claiming should fail as already claimed");
      })
      .catch(e => {
        assert.include(e.message, "Can not claim balance more than once")
      });
  });

  it('should be able to claim rewards for multiple epochs', async () => {
    await stakingManager.addStake(1, accounts[1], { from: accounts[1] });
    await listings.setListing("0.0.0.0/0", 1, { from: accounts[1] });

    const alice = web3.eth.accounts.create();
    await ticketing.depositEscrow(5000, alice.address, { from: accounts[1] });
    await ticketing.depositPenalty(50, alice.address, { from: accounts[1] });

    const epochIds = [];

    for (let j = 0; j < 3; j++) {
      await particpateNextEpoch(accounts[1]);
      await epochsManager.initializeEpoch({ from: accounts[1] });

      const epoch = await epochsManager.getCurrentActiveEpoch();
      const epochId = await epochsManager.getEpochId(epoch.iteration);
      epochIds.push(epochId);

      for (let i = 0 ; i < 5; i++) {
        const { ticket, senderRand, redeemerRand, signature } =
          await createWinningTicket(alice, 1);

        await ticketing.redeem(ticket, senderRand, redeemerRand, signature, { from: accounts[1] });
      }

      // advance block till epoch has ended
      for (let i = 0; i < 31; i++) {
        await utils.advanceBlock();
      }
    }

    await epochsManager.initializeEpoch({ from: accounts[1] });

    // advance block till tickets expire
    for (let i = 0; i < 21; i++) {
      await utils.advanceBlock();
    }

    const initialRedeemerBalance = await token.balanceOf(accounts[1]);

    await rewardsManager.claimRewards(epochIds, accounts[1], { from: accounts[1] });

    const postRedeemerBalance = await token.balanceOf(accounts[1]);

    assert.equal(
      postRedeemerBalance.toString(),
      initialRedeemerBalance.add(new BN(225)).toString(),
      "Expected node to have entire reward balance added to their own balance"
    );
  });

  it('should decay winning probability as ticket approaches expiry', async () => {
    // deploy another ticketing contract with simpler parameters
    ticketingParameters = await TicketingParameters.new({ from: accounts[1] });
    await ticketingParameters.initialize(
      faceValue,
      100000,
      1000,
      8000,
      100,
      { from: accounts[1] }
    );

    directory = await Directory.new({ from: accounts[1] });
    await directory.initialize(
        stakingManager.address,
      { from: accounts[1] }
    );

    epochsManager = await EpochsManager.new({ from: accounts[1] });
    await epochsManager.initialize(
      directory.address,
      listings.address,
      ticketingParameters.address,
      epochDuration,
      { from: accounts[1] }
    );

    await directory.transferOwnership(epochsManager.address, { from: accounts[1] });

    rewardsManager = await RewardsManager.new({ from: accounts[1] });
    await rewardsManager.initialize(
      token.address,
      stakingManager.address,
      epochsManager.address,
      { from: accounts[1] }
    );

    ticketing = await Ticketing.new({ from: accounts[1] });
    await ticketing.initialize(
      token.address,
      listings.address,
      stakingManager.address,
      directory.address,
      epochsManager.address,
      rewardsManager.address,
      0,
      { from: accounts[1] }
    );
    await token.approve(ticketing.address, 10000, { from: accounts[1] });
    await rewardsManager.addManager(ticketing.address, { from: accounts[1] });

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

    await particpateNextEpoch({ from: accounts[1] });

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

    const epochId = await epochsManager.getCurrentActiveEpoch().then(e =>
      epochsManager.getEpochId(e.iteration)
    );

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
    const epochId = await epochsManager.getNextEpochId();
    await directory.joinDirectory(epochId, { from: accounts[1] });
    await rewardsManager.initializeRewardPool(epochId, { from: accounts[1] });
  }

  async function createWinningTicket(sender, redeemer) {
    const senderRand = 1;
    const senderCommit = soliditySha3(senderRand);

    const redeemerRand = 1;
    const redeemerCommit = soliditySha3(redeemerRand);

    const generationBlock = await web3.eth.getBlockNumber();

    const epochId = await epochsManager.getCurrentActiveEpoch().then(e =>
      epochsManager.getEpochId(e.iteration)
    );

    const ticket = {
      epochId,
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
