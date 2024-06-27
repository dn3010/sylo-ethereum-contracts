import { ethers } from 'hardhat';
import { SyloContracts } from '../../common/contracts';
import { deployContracts, getBlockNumber, MAX, MAX_SYLO } from '../utils';
import { Signer } from 'ethers';
import { expect, assert } from 'chai';
import { Deposits } from '../../typechain-types';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';

describe.only('Deposits', () => {
  let accounts: Signer[];
  let contracts: SyloContracts;
  let deposits: Deposits;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    contracts = await deployContracts();
    deposits = contracts.deposits;
  });

  it('cannot initialize deposits with invalid arguments', async () => {
    const factory = await ethers.getContractFactory('Deposits');
    const deposits = await factory.deploy();

    await expect(
      deposits.initialize(ethers.ZeroAddress, 100n),
    ).to.be.revertedWithCustomError(deposits, 'TokenAddressCannotBeNil');

    await expect(
      deposits.initialize(contracts.syloToken.getAddress(), 0n),
    ).to.be.revertedWithCustomError(deposits, 'UnlockDurationCannotBeZero');
  });

  it('can approve ticketing contract as owner', async () => {
    await deposits.approveTicketing(contracts.ticketing.getAddress());

    const allowance = await contracts.syloToken.allowance(
      deposits.getAddress(),
      contracts.ticketing.getAddress(),
    );

    assert.equal(allowance, MAX_SYLO);
  });

  it('only allows owner to approve ticketing', async () => {
    await expect(
      deposits
        .connect(accounts[1])
        .approveTicketing(contracts.ticketing.getAddress()),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('can set unlock duration', async () => {
    await deposits.setUnlockDuration(552);

    const unlockDuration = await deposits.unlockDuration();

    assert.equal(unlockDuration, 552n);
  });

  it('only allows owner to set unlock duration', async () => {
    await expect(
      deposits.connect(accounts[1]).setUnlockDuration(552n),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('allows a user to deposit escrow', async () => {
    const user = await setupUser();

    await contracts.deposits.connect(user).depositEscrow(1111n, user.address);

    await checkDeposit(1111n, 0n, user.address);
  });

  it('cannot deposit zero escrow', async () => {
    const user = await setupUser();

    await expect(
      contracts.deposits.connect(user).depositEscrow(0n, user.address),
    ).to.be.revertedWithCustomError(
      contracts.deposits,
      'EscrowAmountCannotBeZero',
    );
  });

  it('cannot deposit escrow to zero address', async () => {
    await expect(
      contracts.deposits.depositEscrow(111n, ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(
      contracts.deposits,
      'AccountCannotBeZeroAddress',
    );
  });

  it('can deposit penalty', async () => {
    const user = await setupUser();

    await contracts.deposits.connect(user).depositPenalty(1111n, user.address);

    await checkDeposit(0n, 1111n, user.address);
  });

  it('cannot deposit zero penalty', async () => {
    const user = await setupUser();

    await expect(
      contracts.deposits.connect(user).depositPenalty(0n, user.address),
    ).to.be.revertedWithCustomError(
      contracts.deposits,
      'PenaltyAmountCannotBeZero',
    );
  });

  it('cannot deposit penalty to zero address', async () => {
    const user = await setupUser();

    await expect(
      contracts.deposits.connect(user).depositEscrow(111n, ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(
      contracts.deposits,
      'AccountCannotBeZeroAddress',
    );
  });

  it('can deposit both escrow and penalty', async () => {
    const user = await setupUser();

    await contracts.deposits.connect(user).depositEscrow(555n, user.address);
    await contracts.deposits.connect(user).depositPenalty(666n, user.address);

    await checkDeposit(555n, 666n, user.address);
  });

  it('can allow deposits from several users', async () => {
    const users = await Promise.all(
      Array(5)
        .fill(0)
        .map(_ => setupUser()),
    );

    for (const user of users) {
      await contracts.deposits.connect(user).depositEscrow(222n, user.address);
      await contracts.deposits.connect(user).depositPenalty(333n, user.address);
    }

    for (const user of users) {
      await checkDeposit(222n, 333n, user.address);
    }
  });

  it('can allow a user to deposit multiple times', async () => {
    const user = await setupUser();

    let totalEscrow = 0;
    let totalPenalty = 0;

    for (let i = 1; i < 6; i++) {
      const escrow = i;
      const penalty = i * 2;

      await contracts.deposits
        .connect(user)
        .depositEscrow(escrow, user.address);
      await contracts.deposits
        .connect(user)
        .depositPenalty(penalty, user.address);

      totalEscrow += escrow;
      totalPenalty += penalty;
    }

    await checkDeposit(BigInt(totalEscrow), BigInt(totalPenalty), user.address);
  });

  it('can allow user to start unlocking deposits', async () => {
    const user = await setupUser();

    await contracts.deposits.connect(user).depositEscrow(222n, user.address);
    await contracts.deposits.connect(user).depositPenalty(333n, user.address);

    await contracts.deposits.connect(user).unlockDeposits();

    const blockNumber = await getBlockNumber();

    await checkUnlocking(
      blockNumber + (await contracts.deposits.unlockDuration().then(Number)),
      user.address,
    );
  });

  it('cannot unlock zero deposit', async () => {
    await expect(
      contracts.deposits.unlockDeposits(),
    ).to.be.revertedWithCustomError(contracts.deposits, 'NoEscrowAndPenalty');
  });

  it('cannot unlock while unlocking is in process', async () => {
    const user = await setupUser();

    await contracts.deposits.connect(user).depositEscrow(222n, user.address);
    await contracts.deposits.connect(user).depositPenalty(333n, user.address);

    await contracts.deposits.connect(user).unlockDeposits();

    await expect(
      contracts.deposits.connect(user).unlockDeposits(),
    ).to.be.revertedWithCustomError(contracts.deposits, 'UnlockingInProcess');
  });

  it('cannot deposit while unlocking is in process', async () => {
    const user = await setupUser();

    await contracts.deposits.connect(user).depositEscrow(222n, user.address);
    await contracts.deposits.connect(user).depositPenalty(333n, user.address);

    await contracts.deposits.connect(user).unlockDeposits();

    await expect(
      contracts.deposits.connect(user).depositEscrow(1n, user.address),
    ).to.be.revertedWithCustomError(contracts.deposits, 'UnlockingInProcess');

    await expect(
      contracts.deposits.connect(user).depositPenalty(1n, user.address),
    ).to.be.revertedWithCustomError(contracts.deposits, 'UnlockingInProcess');
  });

  it('can cancel unlocking', async () => {
    const user = await setupUser();

    await contracts.deposits.connect(user).depositEscrow(222n, user.address);
    await contracts.deposits.connect(user).depositPenalty(333n, user.address);

    await contracts.deposits.connect(user).unlockDeposits();
    await contracts.deposits.connect(user).lockDeposits();

    await checkUnlocking(0, user.address);

    // confirm user can deposit escrow/penalty again
    await contracts.deposits.connect(user).depositEscrow(1n, user.address);
    await contracts.deposits.connect(user).depositPenalty(1n, user.address);
  });

  it('cannot cancel unlocking if not in process', async () => {
    await expect(
      contracts.deposits.lockDeposits(),
    ).to.be.revertedWithCustomError(
      contracts.deposits,
      'UnlockingNotInProcess',
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
      .approve(contracts.deposits.getAddress(), tokenBalance);

    return user;
  };

  const checkDeposit = async (
    escrow: bigint,
    penalty: bigint,
    user: string,
  ) => {
    const deposit = await contracts.deposits.getDeposit(user);

    expect(deposit.escrow).to.equal(escrow);
    expect(deposit.penalty).to.equal(penalty);
  };

  const checkUnlocking = async (unlockAt: number, user: string) => {
    const deposit = await contracts.deposits.getDeposit(user);

    expect(deposit.unlockAt).to.equal(unlockAt);
  };
});
