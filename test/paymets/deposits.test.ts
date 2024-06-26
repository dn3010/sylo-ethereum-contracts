import { ethers } from 'hardhat';
import { SyloContracts } from '../../common/contracts';
import { deployContracts } from '../utils';
import { Signer } from 'ethers';
import { expect, assert } from 'chai';
import { Deposits } from '../../typechain-types';

describe('Deposits', () => {
  let accounts: Signer[];
  let contracts: SyloContracts;
  let deposits: Deposits;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    contracts = await deployContracts();
    deposits = contracts.deposits;
  });
});
