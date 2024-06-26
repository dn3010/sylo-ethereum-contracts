import { ethers } from 'hardhat';
import { SyloContracts } from '../../common/contracts';
import { deployContracts } from '../utils';
import { Signer } from 'ethers';
import { expect, assert } from 'chai';
import { Deposits, Ticketing } from '../../typechain-types';

describe('Ticketing', () => {
  let accounts: Signer[];
  let contracts: SyloContracts;
  let deposits: Deposits;
  let ticketing: Ticketing;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    contracts = await deployContracts();
    deposits = contracts.deposits;
    ticketing = contracts.ticketing;
  });
});
