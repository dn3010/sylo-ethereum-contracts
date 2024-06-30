import { ethers } from 'hardhat';
import { SyloContracts } from '../../common/contracts';
import { deployContracts } from '../utils';
import { ContractTransactionResponse, Signer } from 'ethers';
import { expect, assert } from 'chai';
import { Deposits, Ticketing } from '../../typechain-types';

describe.only('Ticketing', () => {
  let accounts: Signer[];
  let contracts: SyloContracts;
  let deposits: Deposits;
  let ticketing: Ticketing;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    contracts = await deployContracts();
    deposits = contracts.deposits;
    ticketing = contracts.ticketing;

    await deposits.approveTicketing(ticketing.getAddress());
  });

  it('cannot initialize deposits with invalid arguments', async () => {
    const factory = await ethers.getContractFactory('Ticketing');
    const ticketing = await factory.deploy();

    await expect(
      ticketing.initialize(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        100n,
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
      await expect(await getter()).to.equal(value);

      // confirm setter can only called by owner
      // const nonOwnerCall = ticketing.connect(accounts[1]).
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

  it('cannot set invalid ticketing parameters', async () => {});

  it('cannot set ticketing parameters as non-owner', async () => {});
});
