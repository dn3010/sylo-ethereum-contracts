import { ethers } from "hardhat";
import { BigNumber, BigNumberish } from "ethers";
import { toWei } from 'web3-utils';
import { Directory, EpochsManager, Listings, RewardsManager, StakingManager, SyloTicketing, TicketingParameters } from '../typechain';

type Options = {
  faceValue?: BigNumberish;
  payoutPercentage?: number;
  baseLiveWinProb?: BigNumberish;
  expiredWinProb?: BigNumberish;
  decayRate?: number;
  ticketDuration?: number;
  epochDuration?: number;
  minimumOwnedStake?: number;
  unlockDuration?: number;
}

const initializeContracts = async function(deployer: string, tokenAddress: string, opts: Options = {}) {
  const payoutPercentage =
    opts.payoutPercentage ?
      opts.payoutPercentage :
      5000;

  const faceValue = opts.faceValue ? opts.faceValue : toWei('15');
  const baseLiveWinProb =
    opts.baseLiveWinProb ?
      opts.baseLiveWinProb :
      BigNumber.from(2).pow(128).sub(1);
  const expiredWinProb = opts.expiredWinProb ? opts.expiredWinProb : 1000;
  const decayRate = opts.decayRate ? opts.decayRate : 8000;
  const ticketDuration = opts.ticketDuration ? opts.ticketDuration : 20;

  const epochDuration = opts.epochDuration ? opts.epochDuration : 30;

  const unlockDuration = opts.unlockDuration ?? 0;

  const minimumOwnedStake = opts.minimumOwnedStake ?? 2000;

  const Listings = await ethers.getContractFactory("Listings");
  const listings = await Listings.deploy() as Listings;
  await listings.initialize(payoutPercentage, { from: deployer });

  const TicketingParameters = await ethers.getContractFactory("TicketingParameters");
  const ticketingParameters = await TicketingParameters.deploy() as TicketingParameters;
  await ticketingParameters.initialize(
    faceValue,
    baseLiveWinProb,
    expiredWinProb,
    decayRate,
    ticketDuration,
    { from: deployer }
  );

  const EpochsManager = await ethers.getContractFactory("EpochsManager");
  const epochsManager = await EpochsManager.deploy() as EpochsManager;

  const StakingManager = await ethers.getContractFactory("StakingManager");
  const stakingManager = await StakingManager.deploy() as StakingManager;

  const RewardsManager = await ethers.getContractFactory("RewardsManager");
  const rewardsManager = await RewardsManager.deploy() as RewardsManager;

  const Directory = await ethers.getContractFactory("Directory");
  const directory = await Directory.deploy() as Directory;

  await stakingManager.initialize(
    tokenAddress,
    rewardsManager.address,
    epochsManager.address,
    unlockDuration,
    minimumOwnedStake,
    { from: deployer }
  );
  await rewardsManager.initialize(
    tokenAddress,
    stakingManager.address,
    epochsManager.address,
    { from: deployer }
  );
  await directory.initialize(
      stakingManager.address,
      rewardsManager.address,
      { from: deployer }
  );
  await epochsManager.initialize(
    directory.address,
    listings.address,
    ticketingParameters.address,
    epochDuration,
    { from: deployer }
  );

  const Ticketing = await ethers.getContractFactory("SyloTicketing");
  const ticketing = await Ticketing.deploy() as SyloTicketing;
  await ticketing.initialize(
    tokenAddress,
    listings.address,
    stakingManager.address,
    directory.address,
    epochsManager.address,
    rewardsManager.address,
    unlockDuration,
    { from: deployer }
  );

  await rewardsManager.addManager(ticketing.address, { from: deployer });
  await rewardsManager.addManager(stakingManager.address, { from: deployer });

  return {
    listings,
    ticketing,
    ticketingParameters,
    directory,
    rewardsManager,
    epochsManager,
    stakingManager
  }
}

const advanceBlock = async function(i: number) {
  i = i ? i : 1;
  for (let j = 0; j < i; j++) {
    await ethers.provider.send('evm_mine', []);
  }
}

export default {
  initializeContracts,
  advanceBlock
}