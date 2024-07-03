import { ethers } from 'hardhat';
import { SyloContracts } from '../../common/contracts';
import { deployContracts, getLatestBlock } from '../utils';
import { Signer } from 'ethers';
import { expect, assert } from 'chai';
import {
  Deposits,
  RewardsManager,
  Ticketing,
  SyloToken,
} from '../../typechain-types';
import { mine } from '@nomicfoundation/hardhat-network-helpers';

describe('Deposits', () => {
  let accounts: Signer[];
  let contracts: SyloContracts;
  let deposits: Deposits;
  let rewardsManager: RewardsManager;
  let ticketing: Ticketing;
  let token: SyloToken;

  const onlyTicketingRole = ethers.keccak256(Buffer.from('ONLY_TICKETING'));

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    contracts = await deployContracts();
    deposits = contracts.deposits;
    rewardsManager = contracts.rewardsManager;
    ticketing = contracts.ticketing;
    token = contracts.syloToken;
  });

  it('cannot initialize deposits with invalid arguments', async () => {
    const factory = await ethers.getContractFactory('Deposits');
    const depositsTemp = await factory.deploy();

    await expect(
      depositsTemp.initialize(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        100n,
      ),
    ).to.be.revertedWithCustomError(deposits, 'TokenAddressCannotBeNil');

    await expect(
      depositsTemp.initialize(
        await token.getAddress(),
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        100n,
      ),
    ).to.be.revertedWithCustomError(
      deposits,
      'RewardsManagerAddressCannotBeNil',
    );

    await expect(
      depositsTemp.initialize(
        await token.getAddress(),
        await rewardsManager.getAddress(),
        ethers.ZeroAddress,
        100n,
      ),
    ).to.be.revertedWithCustomError(deposits, 'TicketingAddressCannotBeNil');

    await expect(
      depositsTemp.initialize(
        await token.getAddress(),
        await rewardsManager.getAddress(),
        await ticketing.getAddress(),
        0n,
      ),
    ).to.be.revertedWithCustomError(deposits, 'UnlockDurationCannotBeZero');
  });

  it('cannot set zero unlock duration', async () => {
    await expect(deposits.setUnlockDuration(0n)).to.be.revertedWithCustomError(
      deposits,
      'UnlockDurationCannotBeZero',
    );
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

  it('only allows ticketing to remove penalty', async () => {
    await expect(deposits.removePenalty(ethers.ZeroAddress)).to.be.revertedWith(
      'AccessControl: account ' +
        (await accounts[0].getAddress()).toLowerCase() +
        ' is missing role ' +
        onlyTicketingRole,
    );
  });

  it('only allows ticketing to spend escrow', async () => {
    await expect(
      deposits.spendEscrow(ethers.ZeroAddress, 0n),
    ).to.be.revertedWith(
      'AccessControl: account ' +
        (await accounts[0].getAddress()).toLowerCase() +
        ' is missing role ' +
        onlyTicketingRole,
    );
  });

  it('allows a user to deposit escrow', async () => {
    const user = await setupUser();

    await deposits.connect(user).depositEscrow(1111n, user.address);

    await checkDeposit(1111n, 0n, user.address);
  });

  it('cannot deposit zero escrow', async () => {
    const user = await setupUser();

    await expect(
      deposits.connect(user).depositEscrow(0n, user.address),
    ).to.be.revertedWithCustomError(deposits, 'EscrowAmountCannotBeZero');
  });

  it('cannot deposit escrow to zero address', async () => {
    await expect(
      deposits.depositEscrow(111n, ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(deposits, 'AccountCannotBeZeroAddress');
  });

  it('can deposit penalty', async () => {
    const user = await setupUser();

    await deposits.connect(user).depositPenalty(1111n, user.address);

    await checkDeposit(0n, 1111n, user.address);
  });

  it('cannot deposit zero penalty', async () => {
    const user = await setupUser();

    await expect(
      deposits.connect(user).depositPenalty(0n, user.address),
    ).to.be.revertedWithCustomError(deposits, 'PenaltyAmountCannotBeZero');
  });

  it('cannot deposit penalty to zero address', async () => {
    const user = await setupUser();

    await expect(
      deposits.connect(user).depositPenalty(111n, ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(deposits, 'AccountCannotBeZeroAddress');
  });

  it('can deposit both escrow and penalty', async () => {
    const user = await setupUser();

    await deposits.connect(user).depositEscrow(555n, user.address);
    await deposits.connect(user).depositPenalty(666n, user.address);

    await checkDeposit(555n, 666n, user.address);
  });

  it('can allow deposits from several users', async () => {
    const users = await Promise.all(
      Array(5)
        .fill(0)
        .map(_ => setupUser()),
    );

    for (const user of users) {
      await deposits.connect(user).depositEscrow(222n, user.address);
      await deposits.connect(user).depositPenalty(333n, user.address);
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

      await deposits.connect(user).depositEscrow(escrow, user.address);
      await deposits.connect(user).depositPenalty(penalty, user.address);

      totalEscrow += escrow;
      totalPenalty += penalty;
    }

    await checkDeposit(BigInt(totalEscrow), BigInt(totalPenalty), user.address);
  });

  it('can allow user to start unlocking deposits', async () => {
    const user = await setupUser();

    await deposits.connect(user).depositEscrow(222n, user.address);
    await deposits.connect(user).depositPenalty(333n, user.address);

    await deposits.connect(user).unlockDeposits();

    const blockNumber = await getLatestBlock();

    await checkUnlocking(
      blockNumber.number + (await deposits.unlockDuration().then(Number)),
      user.address,
    );
  });

  it('cannot unlock zero deposit', async () => {
    await expect(deposits.unlockDeposits()).to.be.revertedWithCustomError(
      deposits,
      'NoEscrowAndPenalty',
    );
  });

  it('cannot unlock while unlocking is in process', async () => {
    const user = await setupUser();

    await deposits.connect(user).depositEscrow(222n, user.address);
    await deposits.connect(user).depositPenalty(333n, user.address);

    await deposits.connect(user).unlockDeposits();

    await expect(
      deposits.connect(user).unlockDeposits(),
    ).to.be.revertedWithCustomError(deposits, 'UnlockingInProcess');
  });

  it('cannot deposit while unlocking is in process', async () => {
    const user = await setupUser();

    await deposits.connect(user).depositEscrow(222n, user.address);
    await deposits.connect(user).depositPenalty(333n, user.address);

    await deposits.connect(user).unlockDeposits();

    await expect(
      deposits.connect(user).depositEscrow(1n, user.address),
    ).to.be.revertedWithCustomError(deposits, 'UnlockingInProcess');

    await expect(
      deposits.connect(user).depositPenalty(1n, user.address),
    ).to.be.revertedWithCustomError(deposits, 'UnlockingInProcess');
  });

  it('can cancel unlocking', async () => {
    const user = await setupUser();

    await deposits.connect(user).depositEscrow(222n, user.address);
    await deposits.connect(user).depositPenalty(333n, user.address);

    await deposits.connect(user).unlockDeposits();
    await deposits.connect(user).lockDeposits();

    await checkUnlocking(0, user.address);

    // confirm user can deposit escrow/penalty again
    await deposits.connect(user).depositEscrow(1n, user.address);
    await deposits.connect(user).depositPenalty(1n, user.address);
  });

  it('cannot cancel unlocking if not in process', async () => {
    await expect(deposits.lockDeposits()).to.be.revertedWithCustomError(
      deposits,
      'UnlockingNotInProcess',
    );
  });

  it('cannot withdraw if unlocking not in progress', async () => {
    await expect(deposits.withdraw()).to.be.revertedWithCustomError(
      deposits,
      'UnlockingNotInProcess',
    );
  });

  it('cannot withdraw if unlocking is not complete', async () => {
    const user = await setupUser();

    await deposits.connect(user).depositEscrow(222n, user.address);
    await deposits.connect(user).depositPenalty(333n, user.address);

    await deposits.connect(user).unlockDeposits();

    await expect(
      deposits.connect(user).withdraw(),
    ).to.be.revertedWithCustomError(deposits, 'UnlockingNotCompleted');
  });

  it('can unlock and withdraw deposit', async () => {
    const user = await setupUser();

    await deposits.connect(user).depositEscrow(222n, user.address);
    await deposits.connect(user).depositPenalty(333n, user.address);

    await checkDeposit(222n, 333n, user.address);

    await deposits.connect(user).unlockDeposits();

    await mine((await deposits.unlockDuration()) + BigInt(1));

    await deposits.connect(user).withdraw();

    await checkDeposit(0n, 0n, user.address);
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
      .approve(await deposits.getAddress(), tokenBalance);

    return user;
  };

  const checkDeposit = async (
    escrow: bigint,
    penalty: bigint,
    user: string,
  ) => {
    const deposit = await deposits.getDeposit(user);

    expect(deposit.escrow).to.equal(escrow);
    expect(deposit.penalty).to.equal(penalty);
  };

  const checkUnlocking = async (unlockAt: number, user: string) => {
    const deposit = await deposits.getDeposit(user);

    expect(deposit.unlockAt).to.equal(unlockAt);
  };
});
