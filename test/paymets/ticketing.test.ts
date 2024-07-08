import { ethers } from 'hardhat';
import { Wallet, BigNumberish, HDNodeWallet, Block } from 'ethers';
import { SyloContracts } from '../../common/contracts';
import { deployContracts, signatureTypes, getLatestBlock } from '../utils';
import { ContractTransactionResponse, Signer } from 'ethers';
import { expect } from 'chai';
import {
  Deposits,
  Ticketing,
  TestFuturepassRegistrar,
  AuthorizedAccounts,
  ITicketing,
  IAuthorizedAccounts,
} from '../../typechain-types';
import { mine } from '@nomicfoundation/hardhat-network-helpers';

describe('Ticketing', () => {
  let accounts: Signer[];
  let contracts: SyloContracts;
  let deposits: Deposits;
  let ticketing: Ticketing;
  let authorizedAccounts: AuthorizedAccounts;
  let futurepass: TestFuturepassRegistrar;
  let insufficientEscrow: bigint;
  let sufficientEscrow: bigint;
  let penalty: bigint;

  const redeemerRand = 1;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    contracts = await deployContracts();
    deposits = contracts.deposits;
    ticketing = contracts.ticketing;
    authorizedAccounts = contracts.authorizedAccounts;
    futurepass = contracts.futurepassRegistrar;

    await ticketing.setBaseLiveWinProb(2n ** 128n - 1n);
    sufficientEscrow = (await ticketing.faceValue()) + 100n;
    insufficientEscrow = (await ticketing.faceValue()) - 100n;
    penalty = 500n;
  });

  it('cannot initialize deposits with invalid arguments', async () => {
    const factory = await ethers.getContractFactory('Ticketing');
    const ticketingTemp = await factory.deploy();

    await expect(
      ticketingTemp.initialize(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        1n,
        1n,
        1n,
        1n,
        1n,
        1n,
      ),
    ).to.be.revertedWithCustomError(deposits, 'TokenAddressCannotBeNil');
  });

  it('can set ticketing parameters', async () => {
    const updateParam = async <P>(
      setter: (p: P) => Promise<ContractTransactionResponse>,
      getter: () => Promise<P>,
      value: P,
      event: string,
    ) => {
      await expect(setter(value)).to.emit(ticketing, event);
      expect(await getter()).to.equal(value);
    };

    await updateParam(
      ticketing.setFaceValue,
      ticketing.faceValue,
      111n,
      'FaceValueUpdated',
    );

    await updateParam(
      ticketing.setMultiReceiverFaceValue,
      ticketing.multiReceiverFaceValue,
      222n,
      'MultiReceiverFaceValueUpdated',
    );

    await updateParam(
      ticketing.setBaseLiveWinProb,
      ticketing.baseLiveWinProb,
      333n,
      'BaseLiveWinProbUpdated',
    );

    await updateParam(
      ticketing.setExpiredWinProb,
      ticketing.expiredWinProb,
      444n,
      'ExpiredWinProbUpdated',
    );

    await updateParam(
      ticketing.setDecayRate,
      ticketing.decayRate,
      555n,
      'DecayRateUpdated',
    );

    await updateParam(
      ticketing.setTicketDuration,
      ticketing.ticketDuration,
      666n,
      'TicketDurationUpdated',
    );
  });

  it('cannot set invalid ticketing parameters', async () => {
    const updateParam = async <P>(
      setter: (p: P) => Promise<ContractTransactionResponse>,
      value: P,
      error: string,
    ) => {
      await expect(setter(value)).to.revertedWithCustomError(ticketing, error);
    };

    await updateParam(ticketing.setFaceValue, 0n, 'FaceValueCannotBeZero');

    await updateParam(
      ticketing.setMultiReceiverFaceValue,
      0n,
      'MultiReceiverFaceValueCannotBeZero',
    );

    await updateParam(
      ticketing.setTicketDuration,
      0n,
      'TicketDurationCannotBeZero',
    );
  });

  it('cannot set ticketing parameters as non-owner', async () => {
    const updateParam = async <P>(
      setterNonOwner: (p: P) => Promise<ContractTransactionResponse>,
      value: P,
    ) => {
      await expect(setterNonOwner(value)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    };

    await updateParam(ticketing.connect(accounts[1]).setFaceValue, 0n);

    await updateParam(
      ticketing.connect(accounts[1]).setMultiReceiverFaceValue,
      0n,
    );
  });

  it('cannot redeem ticket with future block', async () => {
    const block = await getLatestBlock();
    const { alice } = await getUsers();

    const { ticket } = await createTicket(
      1,
      alice.address,
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      block.number + 10,
      '0x',
    );

    const senderSig = createUserSignature(
      signatureTypes.main,
      '0x00',
      ethers.ZeroAddress,
      {
        account: ethers.ZeroAddress,
        expiry: 0,
        proof: Buffer.from(''),
        prefix: 'prefix',
        suffix: 'suffix',
        infixOne: 'infixOne',
      },
    );

    await expect(
      ticketing.redeem(ticket, 0, senderSig, senderSig),
    ).to.be.revertedWithCustomError(ticketing, 'TicketCannotBeFromFutureBlock');
  });

  it('cannot redeem ticket with empty sender', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers();

    const { ticket, senderSig } = await createSignedTicket(
      alice,
      bob,
      redeemer,
      block,
    );
    ticket.sender = ethers.ZeroAddress;

    await expect(
      ticketing.redeem(ticket, 0, senderSig, senderSig),
    ).to.be.revertedWithCustomError(
      ticketing,
      'TicketSenderCannotBeZeroAddress',
    );
  });

  it('cannot redeem ticket with empty receiver', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers();

    const { ticket, senderSig } = await createSignedTicket(
      alice,
      bob,
      redeemer,
      block,
    );
    ticket.receiver = ethers.ZeroAddress;

    await expect(
      ticketing.redeem(ticket, 0, senderSig, senderSig),
    ).to.be.revertedWithCustomError(
      ticketing,
      'TicketReceiverCannotBeZeroAddress',
    );
  });

  it('cannot redeem ticket with empty redeemer', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers();

    const { ticket, senderSig } = await createSignedTicket(
      alice,
      bob,
      redeemer,
      block,
    );
    ticket.redeemer = ethers.ZeroAddress;

    await expect(
      ticketing.redeem(ticket, 0, senderSig, senderSig),
    ).to.be.revertedWithCustomError(
      ticketing,
      'TicketRedeemerCannotBeZeroAddress',
    );
  });

  it('cannot redeem ticket with invalid redeemer commit', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers();

    const { ticket, senderSig } = await createSignedTicket(
      alice,
      bob,
      redeemer,
      block,
    );

    await expect(
      ticketing.redeem(ticket, 0, senderSig, senderSig),
    ).to.be.revertedWithCustomError(ticketing, 'RedeemerCommitMismatch');
  });

  it('cannot redeem ticket with sender attached authorized account', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers();

    const { ticket } = await createTicket(
      1,
      alice.address,
      await bob.getAddress(),
      redeemer.address,
      block.number,
      createCommit(BigInt(block.number), redeemerRand),
    );

    const senderSig = createUserSignature(
      signatureTypes.attachedAccount,
      '0x00',
      ethers.ZeroAddress,
      createEmptyAttachedAuthorizedAccount(),
    );

    await expect(
      ticketing.redeem(ticket, redeemerRand, senderSig, senderSig),
    ).to.be.revertedWithCustomError(
      ticketing,
      'SenderCannotUseAttachedAuthorizedAccount',
    );
  });

  it('cannot redeem ticket with invalid signature length', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers();

    const { ticket, senderSig } = await createSignedTicket(
      alice,
      bob,
      redeemer,
      block,
    );
    senderSig.signature = '0x';

    await expect(
      ticketing.redeem(ticket, redeemerRand, senderSig, senderSig),
    ).to.be.revertedWith('ECDSA: invalid signature length');
  });

  it('cannot redeem ticket with invalid signature', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers();
    const random = Wallet.createRandom();

    const { ticket, ticketHash, senderSig } = await createSignedTicket(
      alice,
      bob,
      redeemer,
      block,
    );
    senderSig.signature = await random.signMessage(ethers.getBytes(ticketHash));

    await expect(
      ticketing.redeem(ticket, redeemerRand, senderSig, senderSig),
    ).to.be.revertedWithCustomError(ticketing, 'InvalidSignature');
  });

  it('cannot redeem ticket with invalid signing permission', async () => {
    const block = await getLatestBlock();
    const { alice, aliceDelegated, bob, redeemer } = await getUsers();

    const { ticket, senderSig } = await createSignedTicket(
      alice,
      bob,
      redeemer,
      block,
      aliceDelegated,
      undefined,
      1,
    );

    await expect(
      ticketing.redeem(ticket, redeemerRand, senderSig, senderSig),
    ).to.be.revertedWithCustomError(ticketing, 'InvalidSigningPermission');
  });

  it('cannot redeem ticket with invalid authorized account signature', async () => {
    const { alice, aliceDelegated, bob, redeemer } = await getUsers();
    const random = Wallet.createRandom();

    await authorizedAccounts
      .connect(alice)
      .authorizeAccount(aliceDelegated.address, [0]);

    const block = await getLatestBlock();

    const { ticket, ticketHash } = await createTicket(
      1,
      await alice.getAddress(),
      await bob.getAddress(),
      redeemer.address,
      block.number,
      createCommit(BigInt(block.number), redeemerRand),
    );

    const invalidAuthorizedSignature = await random.signMessage(
      ethers.getBytes(ticketHash),
    );

    const senderSig = createUserSignature(
      signatureTypes.authorizedAccount,
      invalidAuthorizedSignature,
      aliceDelegated.address,
      createEmptyAttachedAuthorizedAccount(),
    );

    await expect(
      ticketing.redeem(ticket, redeemerRand, senderSig, senderSig),
    ).to.be.revertedWithCustomError(ticketing, 'InvalidSignature');
  });

  it('cannot redeem ticket with invalid attached authorized account proof', async () => {
    const block = await getLatestBlock();
    const { alice, bob, bobDelegated, redeemer } = await getUsers();

    const proofMessage =
      await authorizedAccounts.createAttachedAuthorizedAccountProofMessage(
        bobDelegated.address,
        block.timestamp + 10000,
        'prefix',
        'suffix',
        'infixOne',
      );

    const proof = await bob.signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );

    const { ticket, senderSig, receiverSig } = await createSignedTicket(
      alice,
      bob,
      redeemer,
      block,
      undefined,
      bobDelegated,
      2,
      proof,
    );
    receiverSig.attachedAuthorizedAccount.prefix = 'nil';

    await expect(
      ticketing.redeem(ticket, redeemerRand, senderSig, receiverSig),
    ).to.be.revertedWithCustomError(
      authorizedAccounts,
      'AttachedAuthorizedAccountInvalidProof',
    );
  });

  it('cannot redeem ticket with invalid receiver attached authorized account signature', async () => {
    const block = await getLatestBlock();
    const { alice, bob, bobDelegated, redeemer } = await getUsers();
    const random = Wallet.createRandom();

    const proofMessage =
      await authorizedAccounts.createAttachedAuthorizedAccountProofMessage(
        bobDelegated.address,
        block.timestamp + 10,
        'prefix',
        'suffix',
        'infixOne',
      );
    const proof = await bob.signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );

    const { ticket, ticketHash, senderSig } = await createSignedTicket(
      alice,
      bob,
      redeemer,
      block,
      undefined,
      bobDelegated,
      2,
      proof,
    );

    const receiverAuthorizedSignature = await random.signMessage(
      ethers.getBytes(ticketHash),
    );

    const receiverSig = createUserSignature(
      signatureTypes.attachedAccount,
      receiverAuthorizedSignature,
      ethers.ZeroAddress,
      {
        account: bobDelegated.address,
        expiry: block.timestamp + 10,
        proof: proof,
        prefix: 'prefix',
        suffix: 'suffix',
        infixOne: 'infixOne',
      },
    );

    await expect(
      ticketing.redeem(ticket, redeemerRand, senderSig, receiverSig),
    ).to.be.revertedWithCustomError(ticketing, 'InvalidSignature');
  });

  it('reverts on non winning ticket', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers();

    const { ticket, senderSig, receiverSig } = await createSignedTicket(
      alice,
      bob,
      redeemer,
      block,
    );

    await ticketing.setBaseLiveWinProb(0);

    await expect(
      ticketing.redeem(ticket, redeemerRand, senderSig, receiverSig),
    ).to.be.revertedWithCustomError(ticketing, 'TicketNotWinning');
  });

  it('successfully redeems a ticket', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers(sufficientEscrow, penalty);

    const { ticket, senderSig, receiverSig } = await createSignedTicket(
      alice,
      bob,
      redeemer,
      block,
    );

    await checkDeposit(sufficientEscrow, penalty, alice.address);

    await expect(ticketing.redeem(ticket, redeemerRand, senderSig, receiverSig))
      .to.emit(ticketing, 'Redemption')
      .withArgs(
        1,
        redeemer.address,
        alice.address,
        await bob.getAddress(),
        block.number,
        await ticketing.faceValue(),
      );

    await checkDeposit(
      sufficientEscrow - (await ticketing.faceValue()),
      penalty,
      alice.address,
    );

    await expect(
      ticketing.redeem(ticket, redeemerRand, senderSig, receiverSig),
    ).to.be.revertedWithCustomError(ticketing, 'TicketAlreadyRedeemed');
  });

  it('successfully redeems a ticket with penalty', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers(
      insufficientEscrow,
      penalty,
    );

    const { ticket, senderSig, receiverSig } = await createSignedTicket(
      alice,
      bob,
      redeemer,
      block,
    );

    await checkDeposit(insufficientEscrow, penalty, alice.address);

    await expect(ticketing.redeem(ticket, redeemerRand, senderSig, receiverSig))
      .to.emit(ticketing, 'SenderPenaltyBurnt')
      .withArgs(alice.address)
      .to.emit(ticketing, 'Redemption')
      .withArgs(
        1,
        redeemer.address,
        alice.address,
        await bob.getAddress(),
        block.number,
        insufficientEscrow, // users deposit
      );

    await checkDeposit(0n, 0n, alice.address);
  });

  it('successfully redeems a ticket using sender authorized account', async () => {
    const { alice, aliceDelegated, bob, redeemer } = await getUsers(
      sufficientEscrow,
      penalty,
    );

    await authorizedAccounts
      .connect(alice)
      .authorizeAccount(aliceDelegated.address, [0]);

    const block = await getLatestBlock();

    const { ticket, senderSig, receiverSig } = await createSignedTicket(
      alice,
      bob,
      redeemer,
      block,
      aliceDelegated,
      undefined,
      1,
    );

    await checkDeposit(sufficientEscrow, penalty, alice.address);

    await expect(ticketing.redeem(ticket, redeemerRand, senderSig, receiverSig))
      .to.emit(ticketing, 'Redemption')
      .withArgs(
        1,
        redeemer.address,
        alice.address,
        await bob.getAddress(),
        block.number,
        await ticketing.faceValue(),
      );

    await checkDeposit(
      sufficientEscrow - (await ticketing.multiReceiverFaceValue()),
      penalty,
      alice.address,
    );
  });

  it('successfully redeems a ticket using receiver authorized account', async () => {
    const { alice, bob, bobDelegated, redeemer } = await getUsers(
      sufficientEscrow,
      penalty,
    );

    await authorizedAccounts
      .connect(bob)
      .authorizeAccount(bobDelegated.address, [0]);

    const block = await getLatestBlock();

    const { ticket, senderSig, receiverSig } = await createSignedTicket(
      alice,
      bob,
      redeemer,
      block,
      undefined,
      bobDelegated,
      1,
    );

    await checkDeposit(sufficientEscrow, penalty, alice.address);

    await expect(ticketing.redeem(ticket, redeemerRand, senderSig, receiverSig))
      .to.emit(ticketing, 'Redemption')
      .withArgs(
        1,
        redeemer.address,
        alice.address,
        await bob.getAddress(),
        block.number,
        await ticketing.faceValue(),
      );

    await checkDeposit(
      sufficientEscrow - (await ticketing.faceValue()),
      penalty,
      alice.address,
    );
  });

  it('successfully redeems a ticket using receiver attached authorized account', async () => {
    const block = await getLatestBlock();
    const { alice, bob, bobDelegated, redeemer } = await getUsers(
      sufficientEscrow,
      penalty,
    );

    const proofMessage =
      await authorizedAccounts.createAttachedAuthorizedAccountProofMessage(
        bobDelegated.address,
        block.timestamp + 10000,
        'prefix',
        'suffix',
        'infixOne',
      );
    const proof = await bob.signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );

    const { ticket, senderSig, receiverSig } = await createSignedTicket(
      alice,
      bob,
      redeemer,
      block,
      undefined,
      bobDelegated,
      2,
      proof,
    );

    await checkDeposit(sufficientEscrow, penalty, alice.address);

    await expect(ticketing.redeem(ticket, redeemerRand, senderSig, receiverSig))
      .to.emit(ticketing, 'Redemption')
      .withArgs(
        1,
        redeemer.address,
        alice.address,
        await bob.getAddress(),
        block.number,
        await ticketing.faceValue(),
      );

    await checkDeposit(
      sufficientEscrow - (await ticketing.faceValue()),
      penalty,
      alice.address,
    );
  });

  it('cannot redeem multireceiver ticket with future block', async () => {
    const block = await getLatestBlock();
    const { alice, bob } = await getUsers();

    const { multiReceiverTicket } = await createMultiReceiverTicket(
      1,
      alice.address,
      ethers.ZeroAddress,
      block.number + 10,
      '0x',
    );

    const senderSig = createUserSignature(0, '0x00', ethers.ZeroAddress, {
      account: ethers.ZeroAddress,
      expiry: 0,
      proof: Buffer.from(''),
      prefix: 'prefix',
      suffix: 'suffix',
      infixOne: 'infixOne',
    });

    await expect(
      ticketing.redeemMultiReceiver(
        multiReceiverTicket,
        redeemerRand,
        await bob.getAddress(),
        senderSig,
        senderSig,
      ),
    ).to.be.revertedWithCustomError(ticketing, 'TicketCannotBeFromFutureBlock');
  });

  it('cannot redeem multireceiver ticket with empty sender', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers();

    const { multiReceiverTicket, senderSig } =
      await createMultiReceiverSignedTicket(alice, bob, redeemer, block);
    multiReceiverTicket.sender = ethers.ZeroAddress;

    await expect(
      ticketing.redeemMultiReceiver(
        multiReceiverTicket,
        redeemerRand,
        ethers.ZeroAddress,
        senderSig,
        senderSig,
      ),
    ).to.be.revertedWithCustomError(
      ticketing,
      'TicketSenderCannotBeZeroAddress',
    );
  });

  it('cannot redeem multireceiver ticket with empty receiver', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers();

    const { multiReceiverTicket, senderSig } =
      await createMultiReceiverSignedTicket(alice, bob, redeemer, block);
    multiReceiverTicket.redeemer = ethers.ZeroAddress;

    await expect(
      ticketing.redeemMultiReceiver(
        multiReceiverTicket,
        redeemerRand,
        ethers.ZeroAddress,
        senderSig,
        senderSig,
      ),
    ).to.be.revertedWithCustomError(
      ticketing,
      'TicketReceiverCannotBeZeroAddress',
    );
  });

  it('cannot redeem multireceiver ticket with empty redeemer', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers();

    const { multiReceiverTicket, senderSig } =
      await createMultiReceiverSignedTicket(alice, bob, redeemer, block);
    multiReceiverTicket.redeemer = ethers.ZeroAddress;

    await expect(
      ticketing.redeemMultiReceiver(
        multiReceiverTicket,
        redeemerRand,
        await bob.getAddress(),
        senderSig,
        senderSig,
      ),
    ).to.be.revertedWithCustomError(
      ticketing,
      'TicketRedeemerCannotBeZeroAddress',
    );
  });

  it('cannot redeem multireceiver ticket without receiver futurepass', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers();
    const random = Wallet.createRandom();

    const { multiReceiverTicket, senderSig } =
      await createMultiReceiverSignedTicket(alice, bob, redeemer, block);

    await expect(
      ticketing.redeemMultiReceiver(
        multiReceiverTicket,
        redeemerRand,
        await random.getAddress(),
        senderSig,
        senderSig,
      ),
    )
      .to.be.revertedWithCustomError(ticketing, 'MissingFuturepassAccount')
      .withArgs(await random.getAddress());
  });

  it('cannot redeem multireceiver ticket with invalid redeemer commit', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers();

    const { multiReceiverTicket, senderSig } =
      await createMultiReceiverSignedTicket(alice, bob, redeemer, block);

    await expect(
      ticketing.redeemMultiReceiver(
        multiReceiverTicket,
        2n,
        await bob.getAddress(),
        senderSig,
        senderSig,
      ),
    ).to.be.revertedWithCustomError(ticketing, 'RedeemerCommitMismatch');
  });

  it('cannot redeem multireceiver ticket with sender attached authorized account', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers();

    const { multiReceiverTicket } = await createMultiReceiverTicket(
      1,
      alice.address,
      redeemer.address,
      block.number,
      createCommit(BigInt(block.number), redeemerRand),
    );

    const senderSig = createUserSignature(
      signatureTypes.attachedAccount,
      '0x00',
      ethers.ZeroAddress,
      createEmptyAttachedAuthorizedAccount(),
    );

    await expect(
      ticketing.redeemMultiReceiver(
        multiReceiverTicket,
        1,
        await bob.getAddress(),
        senderSig,
        senderSig,
      ),
    ).to.be.revertedWithCustomError(
      ticketing,
      'SenderCannotUseAttachedAuthorizedAccount',
    );
  });

  it('reverts on non winning multireceiver ticket', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers();

    const { multiReceiverTicket, senderSig, receiverSig } =
      await createMultiReceiverSignedTicket(alice, bob, redeemer, block);

    await ticketing.setBaseLiveWinProb(0);

    await expect(
      ticketing.redeemMultiReceiver(
        multiReceiverTicket,
        1,
        await bob.getAddress(),
        senderSig,
        receiverSig,
      ),
    ).to.be.revertedWithCustomError(ticketing, 'TicketNotWinning');
  });

  it('successfully redeems a multireceiver ticket', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers(sufficientEscrow, penalty);

    const { multiReceiverTicket, senderSig, receiverSig } =
      await createMultiReceiverSignedTicket(alice, bob, redeemer, block);

    await checkDeposit(sufficientEscrow, penalty, alice.address);

    await expect(
      ticketing.redeemMultiReceiver(
        multiReceiverTicket,
        1,
        await bob.getAddress(),
        senderSig,
        receiverSig,
      ),
    )
      .to.emit(ticketing, 'MultiReceiverRedemption')
      .withArgs(
        1,
        redeemer.address,
        alice.address,
        await bob.getAddress(),
        block.number,
        await ticketing.multiReceiverFaceValue(),
      );

    await checkDeposit(
      sufficientEscrow - (await ticketing.faceValue()),
      penalty,
      alice.address,
    );

    await expect(
      ticketing.redeemMultiReceiver(
        multiReceiverTicket,
        1,
        await bob.getAddress(),
        senderSig,
        receiverSig,
      ),
    ).to.be.revertedWithCustomError(
      ticketing,
      'MultiReceiverTicketAlreadyRedeemed',
    );
  });

  it('successfully redeems a multireceiver ticket with penalty', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers(
      insufficientEscrow,
      penalty,
    );

    const { multiReceiverTicket, senderSig, receiverSig } =
      await createMultiReceiverSignedTicket(alice, bob, redeemer, block);

    await checkDeposit(insufficientEscrow, penalty, alice.address);

    await expect(
      ticketing.redeemMultiReceiver(
        multiReceiverTicket,
        1,
        await bob.getAddress(),
        senderSig,
        receiverSig,
      ),
    )
      .to.emit(ticketing, 'SenderPenaltyBurnt')
      .withArgs(alice.address)
      .to.emit(ticketing, 'MultiReceiverRedemption')
      .withArgs(
        1,
        redeemer.address,
        alice.address,
        await bob.getAddress(),
        block.number,
        insufficientEscrow, // users deposit
      );

    await checkDeposit(0n, 0n, alice.address);
  });

  it('successfully redeems a multireceiver ticket using sender authorized account', async () => {
    const { alice, aliceDelegated, bob, redeemer } = await getUsers(
      sufficientEscrow,
      penalty,
    );

    await authorizedAccounts
      .connect(alice)
      .authorizeAccount(aliceDelegated.address, [0]);

    const block = await getLatestBlock();

    const { multiReceiverTicket, senderSig, receiverSig } =
      await createMultiReceiverSignedTicket(
        alice,
        bob,
        redeemer,
        block,
        aliceDelegated,
        undefined,
        1,
      );

    await checkDeposit(sufficientEscrow, penalty, alice.address);

    await expect(
      ticketing.redeemMultiReceiver(
        multiReceiverTicket,
        1,
        await bob.getAddress(),
        senderSig,
        receiverSig,
      ),
    )
      .to.emit(ticketing, 'MultiReceiverRedemption')
      .withArgs(
        1,
        redeemer.address,
        alice.address,
        await bob.getAddress(),
        block.number,
        await ticketing.multiReceiverFaceValue(),
      );

    await checkDeposit(
      sufficientEscrow - (await ticketing.multiReceiverFaceValue()),
      penalty,
      alice.address,
    );
  });

  it('successfully redeems a multireceiver ticket using receiver authorized account', async () => {
    const { alice, bob, bobDelegated, redeemer } = await getUsers(
      sufficientEscrow,
      penalty,
    );

    await authorizedAccounts
      .connect(bob)
      .authorizeAccount(bobDelegated.address, [0]);

    const block = await getLatestBlock();

    const { multiReceiverTicket, senderSig, receiverSig } =
      await createMultiReceiverSignedTicket(
        alice,
        bob,
        redeemer,
        block,
        undefined,
        bobDelegated,
        1,
      );

    await expect(
      ticketing.redeemMultiReceiver(
        multiReceiverTicket,
        1,
        await bob.getAddress(),
        senderSig,
        receiverSig,
      ),
    )
      .to.emit(ticketing, 'MultiReceiverRedemption')
      .withArgs(
        1,
        redeemer.address,
        alice.address,
        await bob.getAddress(),
        block.number,
        await ticketing.multiReceiverFaceValue(),
      );

    await checkDeposit(
      sufficientEscrow - (await ticketing.multiReceiverFaceValue()),
      penalty,
      alice.address,
    );
  });

  it('successfully redeems a multireceiver ticket using receiver attached authorized account', async () => {
    const block = await getLatestBlock();
    const { alice, bob, bobDelegated, redeemer } = await getUsers(
      sufficientEscrow,
      penalty,
    );

    const proofMessage =
      await authorizedAccounts.createAttachedAuthorizedAccountProofMessage(
        bobDelegated.address,
        block.timestamp + 10000,
        'prefix',
        'suffix',
        'infixOne',
      );
    const proof = await bob.signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );

    const { multiReceiverTicket, senderSig, receiverSig } =
      await createMultiReceiverSignedTicket(
        alice,
        bob,
        redeemer,
        block,

        undefined,
        bobDelegated,
        2,
        proof,
      );

    await checkDeposit(sufficientEscrow, penalty, alice.address);

    await expect(
      ticketing.redeemMultiReceiver(
        multiReceiverTicket,
        1,
        await bob.getAddress(),
        senderSig,
        receiverSig,
      ),
    )
      .to.emit(ticketing, 'MultiReceiverRedemption')
      .withArgs(
        1,
        redeemer.address,
        alice.address,
        await bob.getAddress(),
        block.number,
        await ticketing.multiReceiverFaceValue(),
      );

    await checkDeposit(
      sufficientEscrow - (await ticketing.multiReceiverFaceValue()),
      penalty,
      alice.address,
    );
  });

  it('reverts if ticket duration has elapsed', async () => {
    const block = await getLatestBlock();
    const { alice, bob, redeemer } = await getUsers(sufficientEscrow, penalty);

    const { multiReceiverTicket, multiReceiverTicketHash } =
      await createMultiReceiverTicket(
        1,
        alice.address,
        redeemer.address,
        block.number,
        createCommit(BigInt(block.number), redeemerRand),
      );

    const senderSignature = await alice.signMessage(
      ethers.getBytes(multiReceiverTicketHash),
    );

    const senderSig = createUserSignature(
      signatureTypes.main,
      senderSignature,
      ethers.ZeroAddress,
      createEmptyAttachedAuthorizedAccount(),
    );

    const receiverSignature = await bob.signMessage(
      ethers.getBytes(multiReceiverTicketHash),
    );

    const receiverSig = createUserSignature(
      signatureTypes.main,
      receiverSignature,
      ethers.ZeroAddress,
      createEmptyAttachedAuthorizedAccount(),
    );

    await mine((await ticketing.ticketDuration()) + 10n);

    await expect(
      ticketing.redeemMultiReceiver(
        multiReceiverTicket,
        1,
        await bob.getAddress(),
        senderSig,
        receiverSig,
      ),
    ).to.be.revertedWithCustomError(ticketing, 'TicketNotWinning');
  });

  async function createTicket(
    cycle: number,
    sender: string,
    receiver: string,
    redeemer: string,
    generationBlock: number,
    redeemerCommit: string,
  ): Promise<{
    ticket: ITicketing.TicketStruct;
    ticketHash: string;
  }> {
    const ticket: ITicketing.TicketStruct = {
      cycle: cycle,
      sender: sender,
      receiver: receiver,
      redeemer: redeemer,
      generationBlock: generationBlock,
      redeemerCommit: ethers.zeroPadBytes(redeemerCommit, 32),
    };

    const ticketHash = await ticketing.getTicketHash(ticket);

    return { ticket, ticketHash };
  }

  async function createMultiReceiverTicket(
    cycle: number,
    sender: string,
    redeemer: string,
    generationBlock: number,
    redeemerCommit: string,
  ): Promise<{
    multiReceiverTicket: ITicketing.MultiReceiverTicketStruct;
    multiReceiverTicketHash: string;
  }> {
    const multiReceiverTicket: ITicketing.MultiReceiverTicketStruct = {
      cycle: cycle,
      sender: sender,
      redeemer: redeemer,
      generationBlock: generationBlock,
      redeemerCommit: ethers.zeroPadBytes(redeemerCommit, 32),
    };

    const multiReceiverTicketHash = await ticketing.getMultiReceiverTicketHash(
      multiReceiverTicket,
    );

    return { multiReceiverTicket, multiReceiverTicketHash };
  }

  async function getUsers(
    escrowAmount?: bigint,
    penaltyAmount?: bigint,
  ): Promise<{
    alice: HDNodeWallet;
    bob: Signer;
    aliceDelegated: HDNodeWallet;
    bobDelegated: HDNodeWallet;
    redeemer: HDNodeWallet;
  }> {
    // Alice needs funds and to approve deposits while
    // Bob only needs funds
    const alice = await setupUser();
    const bob = accounts[1];

    const aliceDelegated = Wallet.createRandom();
    const bobDelegated = Wallet.createRandom();

    const redeemer = Wallet.createRandom();

    await futurepass.create(await bob.getAddress());

    escrowAmount &&
      (await deposits
        .connect(alice)
        .depositEscrow(escrowAmount, alice.address));
    penaltyAmount &&
      (await deposits
        .connect(alice)
        .depositPenalty(penaltyAmount, alice.address));

    return {
      alice,
      bob,
      aliceDelegated,
      bobDelegated,
      redeemer,
    };
  }

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

  const checkDeposit = async (
    escrow: bigint,
    penalty: bigint,
    user: string,
  ) => {
    const deposit = await deposits.getDeposit(user);

    expect(deposit.escrow).to.equal(escrow);
    expect(deposit.penalty).to.equal(penalty);
  };

  async function createSignedTicket(
    sender: HDNodeWallet,
    receiver: Signer,
    node: HDNodeWallet,
    block: Block,
    senderDelegated?: HDNodeWallet,
    receiverDelegated?: HDNodeWallet,
    sigType?: number,
    proof?: string,
  ): Promise<{
    ticket: ITicketing.TicketStruct;
    ticketHash: string;
    senderSig: ITicketing.UserSignatureStruct;
    receiverSig: ITicketing.UserSignatureStruct;
  }> {
    const { ticket, ticketHash } = await createTicket(
      1,
      sender.address,
      await receiver.getAddress(),
      node.address,
      block.number,
      createCommit(BigInt(block.number), 1),
    );

    let senderSig: ITicketing.UserSignatureStruct;
    let senderSignature: string;
    if (sigType == signatureTypes.authorizedAccount && senderDelegated) {
      senderSignature = await senderDelegated.signMessage(
        ethers.getBytes(ticketHash),
      );
      senderSig = createUserSignature(
        signatureTypes.authorizedAccount,
        senderSignature,
        senderDelegated.address,
        createEmptyAttachedAuthorizedAccount(),
      );
    } else {
      senderSignature = await sender.signMessage(ethers.getBytes(ticketHash));
      senderSig = createUserSignature(
        signatureTypes.main,
        senderSignature,
        ethers.ZeroAddress,
        createEmptyAttachedAuthorizedAccount(),
      );
    }

    let receiverSig: ITicketing.UserSignatureStruct;
    let receiverSignature: string;
    if (sigType == signatureTypes.authorizedAccount && receiverDelegated) {
      receiverSignature = await receiverDelegated.signMessage(
        ethers.getBytes(ticketHash),
      );
      receiverSig = createUserSignature(
        signatureTypes.authorizedAccount,
        receiverSignature,
        receiverDelegated.address,
        createEmptyAttachedAuthorizedAccount(),
      );
    } else if (
      sigType == signatureTypes.attachedAccount &&
      receiverDelegated &&
      proof
    ) {
      receiverSignature = await receiverDelegated.signMessage(
        ethers.getBytes(ticketHash),
      );
      receiverSig = createUserSignature(
        signatureTypes.attachedAccount,
        receiverSignature,
        ethers.ZeroAddress,
        {
          account: receiverDelegated.address,
          expiry: block.timestamp + 10000,
          proof: proof,
          prefix: 'prefix',
          suffix: 'suffix',
          infixOne: 'infixOne',
        },
      );
    } else {
      receiverSignature = await receiver.signMessage(
        ethers.getBytes(ticketHash),
      );
      receiverSig = createUserSignature(
        signatureTypes.main,
        receiverSignature,
        ethers.ZeroAddress,
        createEmptyAttachedAuthorizedAccount(),
      );
    }

    return {
      ticket,
      ticketHash,
      senderSig,
      receiverSig,
    };
  }

  async function createMultiReceiverSignedTicket(
    sender: HDNodeWallet,
    receiver: Signer,
    node: HDNodeWallet,
    block: Block,
    senderDelegated?: HDNodeWallet,
    receiverDelegated?: HDNodeWallet,
    sigType?: number,
    proof?: string,
  ): Promise<{
    multiReceiverTicket: ITicketing.MultiReceiverTicketStruct;
    multiReceiverTicketHash: string;
    senderSig: ITicketing.UserSignatureStruct;
    receiverSig: ITicketing.UserSignatureStruct;
  }> {
    const { multiReceiverTicket, multiReceiverTicketHash } =
      await createMultiReceiverTicket(
        1,
        sender.address,
        node.address,
        block.number,
        createCommit(BigInt(block.number), 1),
      );

    let senderSig: ITicketing.UserSignatureStruct;
    let senderSignature: string;
    if (sigType == signatureTypes.authorizedAccount && senderDelegated) {
      senderSignature = await senderDelegated.signMessage(
        ethers.getBytes(multiReceiverTicketHash),
      );
      senderSig = createUserSignature(
        signatureTypes.authorizedAccount,
        senderSignature,
        senderDelegated.address,
        createEmptyAttachedAuthorizedAccount(),
      );
    } else {
      senderSignature = await sender.signMessage(
        ethers.getBytes(multiReceiverTicketHash),
      );
      senderSig = createUserSignature(
        signatureTypes.main,
        senderSignature,
        ethers.ZeroAddress,
        createEmptyAttachedAuthorizedAccount(),
      );
    }

    let receiverSig: ITicketing.UserSignatureStruct;
    let receiverSignature: string;
    if (sigType == signatureTypes.authorizedAccount && receiverDelegated) {
      receiverSignature = await receiverDelegated.signMessage(
        ethers.getBytes(multiReceiverTicketHash),
      );
      receiverSig = createUserSignature(
        signatureTypes.authorizedAccount,
        receiverSignature,
        receiverDelegated.address,
        createEmptyAttachedAuthorizedAccount(),
      );
    } else if (
      sigType == signatureTypes.attachedAccount &&
      receiverDelegated &&
      proof
    ) {
      receiverSignature = await receiverDelegated.signMessage(
        ethers.getBytes(multiReceiverTicketHash),
      );
      receiverSig = createUserSignature(
        signatureTypes.attachedAccount,
        receiverSignature,
        ethers.ZeroAddress,
        {
          account: receiverDelegated.address,
          expiry: block.timestamp + 10000,
          proof: proof,
          prefix: 'prefix',
          suffix: 'suffix',
          infixOne: 'infixOne',
        },
      );
    } else {
      receiverSignature = await receiver.signMessage(
        ethers.getBytes(multiReceiverTicketHash),
      );
      receiverSig = createUserSignature(
        signatureTypes.main,
        receiverSignature,
        ethers.ZeroAddress,
        createEmptyAttachedAuthorizedAccount(),
      );
    }

    return {
      multiReceiverTicket,
      multiReceiverTicketHash,
      senderSig,
      receiverSig,
    };
  }
});

function createEmptyAttachedAuthorizedAccount(): IAuthorizedAccounts.AttachedAuthorizedAccountStruct {
  return {
    account: ethers.ZeroAddress,
    expiry: 0,
    proof: new Uint8Array(),
    prefix: '',
    suffix: '',
    infixOne: '',
  };
}

function createUserSignature(
  sigType: number,
  signature: string,
  authorizedAccount: string,
  attachedAuthorizedAccount: IAuthorizedAccounts.AttachedAuthorizedAccountStruct,
): ITicketing.UserSignatureStruct {
  const newSig: ITicketing.UserSignatureStruct = {
    sigType: sigType,
    signature: signature,
    authorizedAccount: authorizedAccount,
    attachedAuthorizedAccount: attachedAuthorizedAccount,
  };

  return newSig;
}

function createCommit(generationBlock: bigint, rand: BigNumberish): string {
  return ethers.solidityPackedKeccak256(
    ['bytes32'],
    [
      ethers.solidityPackedKeccak256(
        ['uint256', 'uint256'],
        [generationBlock, rand],
      ),
    ],
  );
}

export async function redeemTicket(
  ticketingContract: Ticketing,
  depositsContract: Deposits,
  ticket: {
    sender: HDNodeWallet;
    receiver: Signer;
    redeemer: Signer;
    redeemerRand: number;
    cycle: number;
  },
  escrowAmount?: bigint,
  penaltyAmount?: bigint,
): Promise<void> {
  escrowAmount &&
    (await depositsContract
      .connect(ticket.sender)
      .depositEscrow(escrowAmount, ticket.sender.address));
  penaltyAmount &&
    (await depositsContract
      .connect(ticket.sender)
      .depositPenalty(penaltyAmount, ticket.sender.address));

  const block = await getLatestBlock();
  const newTicket: ITicketing.TicketStruct = {
    cycle: ticket.cycle,
    sender: ticket.sender,
    receiver: ticket.receiver,
    redeemer: ticket.redeemer,
    generationBlock: block.number,
    redeemerCommit: ethers.zeroPadBytes(
      createCommit(BigInt(block.number), ticket.redeemerRand),
      32,
    ),
  };

  const ticketHash = await ticketingContract.getTicketHash(newTicket);

  const senderSignature = await ticket.sender.signMessage(
    ethers.getBytes(ticketHash),
  );

  const receiverSignature = await ticket.receiver.signMessage(
    ethers.getBytes(ticketHash),
  );

  const senderSig = createUserSignature(
    signatureTypes.main,
    senderSignature,
    ethers.ZeroAddress,
    createEmptyAttachedAuthorizedAccount(),
  );

  const receiverSig = createUserSignature(
    signatureTypes.main,
    receiverSignature,
    ethers.ZeroAddress,
    createEmptyAttachedAuthorizedAccount(),
  );

  await ticketingContract.redeem(
    newTicket,
    ticket.redeemerRand,
    senderSig,
    receiverSig,
  );
}
