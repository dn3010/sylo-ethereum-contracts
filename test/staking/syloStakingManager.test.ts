import { ethers } from 'hardhat';
import { SyloContracts } from '../../common/contracts';
import { deployContracts, getInterfaceId } from '../utils';
import { ContractTransactionResponse, Signer } from 'ethers';
import { assert, expect } from 'chai';
import { SyloStakingManager } from '../../typechain-types';
import * as hardhatHelper from '@nomicfoundation/hardhat-network-helpers';

describe('Sylo Staking', () => {
  let accounts: Signer[];
  let contracts: SyloContracts;
  let syloStakingManager: SyloStakingManager;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    contracts = await deployContracts();
    syloStakingManager = contracts.syloStakingManager;
  });

  it('cannot initialize sylo staking manager with invalid arguemnts', async () => {
    const factory = await ethers.getContractFactory('SyloStakingManager');
    const syloStakingManagerTemp = await factory.deploy();

    await expect(
      syloStakingManagerTemp.initialize(ethers.ZeroAddress, 100n),
    ).to.be.revertedWithCustomError(
      syloStakingManagerTemp,
      'SyloAddressCannotBeNil',
    );
  });

  it('cannot initialize sylo staking manager more than once', async () => {
    await expect(
      syloStakingManager.initialize(
        await contracts.syloToken.getAddress(),
        100n,
      ),
    ).to.be.revertedWith('Initializable: contract is already initialized');
  });

  it('can set unlock duration as owner', async () => {
    await expect(syloStakingManager.setUnlockDuration(333n))
      .to.emit(syloStakingManager, 'UnlockDurationUpdated')
      .withArgs(333n);

    const unlockDuration = await syloStakingManager.unlockDuration();

    assert.equal(
      unlockDuration,
      333n,
      'Expected unlock duration to be updated',
    );
  });

  it('reverts when attempting to set unlock duration as non-owner', async () => {
    await expect(
      syloStakingManager.connect(accounts[1]).setUnlockDuration(333n),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('reverts when setting unlock duration with 0 value', async () => {
    await expect(
      syloStakingManager.setUnlockDuration(0n),
    ).to.be.revertedWithCustomError(
      syloStakingManager,
      'UnlockDurationCannotBeZero',
    );
  });

  it('allows adding stake to a node from a user', async () => {
    const node = await accounts[1].getAddress();
    const user = accounts[2];

    await setupStaker(user);

    await addStake(node, user, 1000n);
  });

  it('allows a user to add stake to multiple nodes', async () => {
    const nodes = await Promise.all(
      accounts.slice(1, 5).map(a => a.getAddress()),
    );
    const user = accounts[7];

    await setupStaker(user);

    for (const node of nodes) {
      await addStake(node, user, 500n);
    }
  });

  it('allows a node to be staked by multiple users', async () => {
    const node = await accounts[1].getAddress();
    const users = accounts.slice(2, 7);

    for (const user of users) {
      await setupStaker(user);
      await addStake(node, user, 500n);
    }

    const totalNodeStake = await syloStakingManager.getTotalManagedStakeByNode(
      node,
    );

    assert.equal(
      totalNodeStake,
      500n * BigInt(users.length),
      "Expected each add stake to increases Node's total managed stake",
    );
  });

  it('allows a user to stake multiple times to the same node', async () => {
    const node = await accounts[1].getAddress();
    const user = accounts[2];

    await setupStaker(user);

    for (let i = 0; i < 5; i++) {
      await addStake(node, user, 1000n);
    }

    const nodeTotalStake = await syloStakingManager.getTotalManagedStakeByNode(
      node,
    );

    assert.equal(
      nodeTotalStake,
      5000n,
      'Expected nodes total stake to increase with each addition',
    );
  });

  it('reverts when adding stake to nil node address', async () => {
    const user = accounts[2];

    await setupStaker(user);

    await expect(
      syloStakingManager.connect(user).addStake(ethers.ZeroAddress, 1000n),
    ).to.be.revertedWithCustomError(
      syloStakingManager,
      'NodeAddressCannotBeNil',
    );
  });

  it('reverts when adding 0 stake', async () => {
    const node = await accounts[1].getAddress();
    const user = accounts[2];

    await setupStaker(user);

    await expect(
      syloStakingManager.connect(user).addStake(node, 0),
    ).to.be.revertedWithCustomError(
      syloStakingManager,
      'CannotStakeZeroAmount',
    );
  });

  it('allows a user to unlock stake', async () => {
    const { node, user } = await setupInitialStake(1000n);

    await unlockStake(node, user, 500n);
  });

  it('allows a user to unlock stake multiple times', async () => {
    const { node, user } = await setupInitialStake(1000n);

    for (let i = 0; i < 5; i++) {
      await unlockStake(node, user, 100n);
    }

    const unlocking = await syloStakingManager.getUnlocking(node, user);

    assert.equal(
      unlocking.amount,
      500n,
      'Expected each unlocking to add to total unlocking amount',
    );
  });

  it('sets unlock at based on unlock duration', async () => {
    const { node, user } = await setupInitialStake(1000n);

    const block = await ethers.provider.getBlock('latest');
    if (!block) {
      assert.fail('unable to retrieve current block');
    }

    const unlockDuration = await syloStakingManager.unlockDuration();

    const unlocking = await unlockStake(node, user, 500n);

    expect(unlocking.unlockAt).to.be.greaterThanOrEqual(
      block.timestamp + Number(unlockDuration),
    );
  });

  it('allows a user to unlock against multiple nodes', async () => {
    const nodes = await Promise.all(
      accounts.slice(1, 5).map(a => a.getAddress()),
    );

    const user = accounts[7];

    await setupStaker(user);

    for (const node of nodes) {
      await addStake(node, user, 1000n);
    }

    for (const node of nodes) {
      await unlockStake(node, user, 333n);
    }
  });

  it('allows a node to have multiple users unlocking stake', async () => {
    const node = await accounts[1].getAddress();
    const users = accounts.slice(2, 7);

    for (const user of users) {
      await setupStaker(user);
      await addStake(node, user, 500n);
    }

    const nodeTotalStake = await syloStakingManager.getTotalManagedStakeByNode(
      node,
    );

    for (const user of users) {
      await unlockStake(node, user, 100n);
    }

    const updatedNodeTotalStake =
      await syloStakingManager.getTotalManagedStakeByNode(node);

    assert.equal(
      updatedNodeTotalStake,
      nodeTotalStake - 100n * BigInt(users.length),
      'Expected each unlocking to subtract Nodes total managed stake',
    );
  });

  it('does not update existing unlockAt if unlock duration has been shortened', async () => {
    const { node, user } = await setupInitialStake(1000n);

    const unlocking = await unlockStake(node, user, 500n);

    await syloStakingManager.setUnlockDuration(1);

    const updatedUnlocking = await unlockStake(node, user, 100n);

    assert.equal(
      updatedUnlocking.unlockAt,
      unlocking.unlockAt,
      'Expected unlock at to remain the same value',
    );
  });

  it('reverts when unlocking against nil node address', async () => {
    const user = accounts[2];

    await setupStaker(user);

    await expect(
      syloStakingManager.connect(user).unlockStake(ethers.ZeroAddress, 100n),
    ).to.be.revertedWithCustomError(
      syloStakingManager,
      'NodeAddressCannotBeNil',
    );
  });

  it('reverts when unlocking 0 stake', async () => {
    const node = await accounts[1].getAddress();
    const user = accounts[2];

    await setupStaker(user);

    await expect(
      syloStakingManager.connect(user).unlockStake(node, 0n),
    ).to.be.revertedWithCustomError(
      syloStakingManager,
      'CannotUnlockZeroAmount',
    );
  });

  it('reverts when unlocking more than staked', async () => {
    const { node, user } = await setupInitialStake(1000n);

    await expect(
      syloStakingManager.connect(user).unlockStake(node, 1001n),
    ).to.be.revertedWithCustomError(
      syloStakingManager,
      'CannotUnlockMoreThanStaked',
    );
  });

  it('tracks total managed take in sylo staking manager', async () => {
    const nodes = await Promise.all(
      accounts.slice(1, 5).map(a => a.getAddress()),
    );
    const users = accounts.slice(5, 10);

    for (const user of users) {
      await setupStaker(user);
    }

    let expectedTotal = 0n;

    for (const node of nodes) {
      for (const user of users) {
        await addStake(node, user, 555n);
        expectedTotal += 555n;
      }
    }

    for (const node of nodes) {
      for (const user of users) {
        await unlockStake(node, user, 111n);
        expectedTotal -= 111n;
      }
    }

    const totalManagedStake = await syloStakingManager.getTotalManagedStake();

    assert.equal(
      totalManagedStake,
      expectedTotal,
      'Expected sylo staking manager to track all managed stake',
    );
  });

  it('allows a user to cancel an unlocking', async () => {
    const { node, user } = await setupInitialStake(1000n);

    await unlockStake(node, user, 500n);

    await cancelUnlocking(node, user, 500n);

    const unlocking = await syloStakingManager.getUnlocking(node, user);

    assert.equal(unlocking.amount, 0n, 'Expected unlocking amount to be 0');
    assert.equal(unlocking.unlockAt, 0n, 'Expected unlock at to be 0');
  });

  it('allows a user to cancel an unlocking partially', async () => {
    const { node, user } = await setupInitialStake(1000n);

    await unlockStake(node, user, 500n);

    const unlocking = await syloStakingManager.getUnlocking(node, user);

    await cancelUnlocking(node, user, 200n);

    const updatedUnlocking = await syloStakingManager.getUnlocking(node, user);

    assert.equal(
      updatedUnlocking.amount,
      300n,
      'Expected unlocking amount to be reduced partially',
    );

    assert.equal(
      updatedUnlocking.unlockAt,
      unlocking.unlockAt,
      'Expected unlock at to remain the same',
    );
  });

  it('reverts when cancelling an unlocking against a nil address', async () => {
    const { node, user } = await setupInitialStake(1000n);

    await unlockStake(node, user, 500n);

    await expect(
      syloStakingManager
        .connect(user)
        .cancelUnlocking(ethers.ZeroAddress, 100n),
    ).to.be.revertedWithCustomError(
      syloStakingManager,
      'NodeAddressCannotBeNil',
    );
  });

  it('reverts when cancelling 0 stake', async () => {
    const { node, user } = await setupInitialStake(1000n);

    await unlockStake(node, user, 500n);

    await expect(
      syloStakingManager.connect(user).cancelUnlocking(node, 0n),
    ).to.be.revertedWithCustomError(
      syloStakingManager,
      'CannotCancelUnlockingZeroAmount',
    );
  });

  it('can withdraw stake after unlocking duration has elapsed', async () => {
    const { node, user } = await setupInitialStake(1000n);

    const unlocking = await unlockStake(node, user, 500n);

    await hardhatHelper.time.increaseTo(unlocking.unlockAt);

    await testStakingAction(
      node,
      await user.getAddress(),
      () => syloStakingManager.connect(user).withdrawStake(node),
      0n,
      500n, // user balance increase by 500n as well
    );

    const updatedUnlocking = await syloStakingManager.getUnlocking(
      node,
      await user.getAddress(),
    );

    assert.equal(
      updatedUnlocking.amount,
      0n,
      'Expected unlocking amount to be 0',
    );
    assert.equal(updatedUnlocking.unlockAt, 0n, 'Expected unlock at to be 0');
  });

  it('reverts when withdrawing stake against nil node address', async () => {
    const { user } = await setupInitialStake(1000n);

    await expect(
      syloStakingManager.connect(user).withdrawStake(ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(
      syloStakingManager,
      'NodeAddressCannotBeNil',
    );
  });

  it('reverts when withdrawing stake that has not finished unlocking', async () => {
    const { node, user } = await setupInitialStake(1000n);

    await unlockStake(node, user, 500n);

    await expect(
      syloStakingManager.connect(user).withdrawStake(node),
    ).to.be.revertedWithCustomError(syloStakingManager, 'StakeNotYetUnlocked');
  });

  it('can transfer stake to another node', async () => {
    const { node, user } = await setupInitialStake(1000n);

    const node2 = accounts[3];

    await testStakingAction(
      await node2.getAddress(),
      await user.getAddress(),
      () => syloStakingManager.connect(user).transferStake(node, node2, 666n),
      666n,
      0n,
    );

    const nodeStake = await syloStakingManager.getManagedStake(
      node,
      user.getAddress(),
    );

    assert.equal(nodeStake.amount, 334n, "Expected node's stake to decrease");
  });

  it('can reverts when transferring stake to nil address', async () => {
    const { node, user } = await setupInitialStake(1000n);

    await expect(
      syloStakingManager
        .connect(user)
        .transferStake(ethers.ZeroAddress, node, 1n),
    ).to.be.revertedWithCustomError(
      syloStakingManager,
      'NodeAddressCannotBeNil',
    );

    await expect(
      syloStakingManager
        .connect(user)
        .transferStake(node, ethers.ZeroAddress, 1n),
    ).to.be.revertedWithCustomError(
      syloStakingManager,
      'NodeAddressCannotBeNil',
    );
  });

  it('reverts when transferring more stake than exists', async () => {
    const { node, user } = await setupInitialStake(1000n);

    const node2 = accounts[3];

    await expect(
      syloStakingManager.connect(user).transferStake(node, node2, 1001n),
    ).to.be.revertedWithCustomError(
      syloStakingManager,
      'CannotTransferMoreThanStaked',
    );
  });

  it('sylo staking manager supports correct interfaces', async () => {
    const abi = [
      'function setUnlockDuration(uint256 _unlockDuration) external',
      'function addStake(address node, uint256 amount) external',
      'function unlockStake(address node, uint256 amount) external returns (uint256)',
      'function withdrawStake(address node) external',
      'function cancelUnlocking(address node, uint256 amount) external',
      'function transferStake(address from, address to, uint256 amount) external',
      'function getTotalManagedStake() external view returns (uint256)',
      'function getManagedStake(address node, address user) external view returns ((uint256,uint256))',
      'function getTotalManagedStakeByNode(address node) external view returns (uint256)',
    ];

    const interfaceId = getInterfaceId(abi);

    const supports = await syloStakingManager.supportsInterface(interfaceId);

    assert.equal(
      supports,
      true,
      'Expected sylo staking manager to support correct interface',
    );

    const invalidAbi = ['function foo(uint256 duration) external'];

    const invalidAbiInterfaceId = getInterfaceId(invalidAbi);

    const invalid = await syloStakingManager.supportsInterface(
      invalidAbiInterfaceId,
    );

    assert.equal(
      invalid,
      false,
      'Expected sylo staking manager to not support incorrect interface',
    );
  });

  const setupStaker = async (staker: Signer) => {
    await contracts.syloToken
      .connect(staker)
      .approve(
        await syloStakingManager.getAddress(),
        ethers.parseEther('1000000000'),
      );

    await contracts.syloToken.transfer(await staker.getAddress(), 10000000);
  };

  const setupInitialStake = async (initialStake?: bigint) => {
    const node = await accounts[1].getAddress();
    const user = accounts[2];

    await setupStaker(user);

    await addStake(node, user, initialStake ?? 1000n);

    return { node, user };
  };

  const addStake = async (node: string, staker: Signer, amount: bigint) => {
    await testStakingAction(
      node,
      await staker.getAddress(),
      () => syloStakingManager.connect(staker).addStake(node, amount),
      amount,
      -amount,
    );
  };

  const unlockStake = async (node: string, staker: Signer, amount: bigint) => {
    const originalUnlocking = await syloStakingManager.getUnlocking(
      node,
      await staker.getAddress(),
    );

    await testStakingAction(
      node,
      await staker.getAddress(),
      () => syloStakingManager.connect(staker).unlockStake(node, amount),
      -amount,
      0n,
    );

    const updatedUnlocking = await syloStakingManager.getUnlocking(
      node,
      await staker.getAddress(),
    );

    assert.equal(
      updatedUnlocking.amount,
      originalUnlocking.amount + amount,
      'Expected unlocking amount to be updated',
    );

    return updatedUnlocking;
  };

  const cancelUnlocking = async (
    node: string,
    staker: Signer,
    amount: bigint,
  ) => {
    await testStakingAction(
      node,
      await staker.getAddress(),
      () => syloStakingManager.connect(staker).cancelUnlocking(node, amount),
      amount,
      0n,
    );
  };

  /**
   * testStakingAction is a utility function that asserts a user and node's
   * stake entry is correctly updated after performing a staking related
   * transaction. The user's balance is also validated that it has been updated
   * correctly as well.
   * @param node
   * @param staker
   * @param action
   * @param stakeChange
   * @param balanceChange
   */
  const testStakingAction = async (
    node: string,
    staker: string,
    action: () => Promise<ContractTransactionResponse>,
    stakeChange: bigint,
    balanceChange: bigint,
  ) => {
    const existingStake = await syloStakingManager.getManagedStake(
      node,
      staker,
    );
    const existingBalance = await contracts.syloToken.balanceOf(staker);

    await action();

    const updatedStake = await syloStakingManager.getManagedStake(node, staker);
    const updatedBalance = await contracts.syloToken.balanceOf(staker);

    const expectedStake = existingStake.amount + stakeChange;
    const expectedBalance = existingBalance + balanceChange;

    assert.equal.bind(assert)(
      updatedStake.amount,
      expectedStake,
      `Expected stake to be updated`,
    );
    assert.equal.bind(assert)(
      updatedBalance,
      expectedBalance,
      `Expected balance to be updated`,
    );
  };
});
