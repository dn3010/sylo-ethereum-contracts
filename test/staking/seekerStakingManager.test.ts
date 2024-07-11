import { ethers } from 'hardhat';
import {
  SeekerStakingManager,
  TestSeekers,
  SeekerStatsOracle,
} from '../../typechain-types';
import { SyloContracts } from '../../common/contracts';
import { Signer } from 'ethers';
import { expect, assert } from 'chai';
import { deployContracts, getTimeManagerUtil } from '../utils';
import { getInterfaceId } from '../utils';
import { createRandomSeeker } from '../seekerStats/stakingStats.test';

class StakedSeeker {
  constructor(
    public seekerId: number,
    public node: string,
    public user: string,
  ) {}
}

describe('Seeker Staking Manager', () => {
  let accounts: Signer[];
  let contracts: SyloContracts;
  let seekerStakingManager: SeekerStakingManager;
  let testSeekers: TestSeekers;
  let seekerStatsOracle: SeekerStatsOracle;
  let seekerOwner: Signer;
  let nonSeekerOwner: Signer;
  let nodeOne: Signer;
  let nodeTwo: Signer;
  let oracleAccount: Signer;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    contracts = await deployContracts();
    seekerStakingManager = contracts.seekerStakingManager;
    testSeekers = contracts.seekers;
    seekerStatsOracle = contracts.seekerStatsOracle;
    nodeOne = accounts[10];
    nodeTwo = accounts[11];
    seekerOwner = accounts[0];
    nonSeekerOwner = accounts[1];

    oracleAccount = accounts[19];
    await seekerStatsOracle.setOracle(await accounts[19].getAddress());

    const { startProtocol } = getTimeManagerUtil(contracts.protocolTimeManager);
    await startProtocol();
  });

  it('cannot initialize seeker staking manager with invalid arguemnts', async () => {
    const factory = await ethers.getContractFactory('SeekerStakingManager');
    const seekerStakingManagerTemp = await factory.deploy();

    await expect(
      seekerStakingManagerTemp.initialize(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
      ),
    ).to.be.revertedWithCustomError(
      seekerStakingManagerTemp,
      'RootSeekersCannotBeZeroAddress',
    );

    await expect(
      seekerStakingManagerTemp.initialize(
        await testSeekers.getAddress(),
        ethers.ZeroAddress,
        ethers.ZeroAddress,
      ),
    ).to.be.revertedWithCustomError(
      seekerStakingManagerTemp,
      'SeekerStatsOracleCannotBeNil',
    );
  });

  it('cannot initialize seeker staking manager more than once', async () => {
    await expect(
      seekerStakingManager.initialize(
        await testSeekers.getAddress(),
        await seekerStatsOracle.getAddress(),
        ethers.ZeroAddress,
      ),
    ).to.be.revertedWith('Initializable: contract is already initialized');
  });

  it('cannot stake seeker without node address', async () => {
    const seeker = createRandomSeeker();

    await expect(
      seekerStakingManager.stakeSeeker(
        ethers.ZeroAddress,
        seeker,
        Buffer.from(''),
      ),
    ).to.be.revertedWithCustomError(
      seekerStakingManager,
      'NodeAddressCannotBeNil',
    );
  });

  it('tx sender must own seeker id to stake', async () => {
    const seeker = createRandomSeeker();

    await testSeekers.mint(seekerOwner, seeker.seekerId);

    await expect(
      seekerStakingManager
        .connect(nonSeekerOwner)
        .stakeSeeker(nodeOne, seeker, Buffer.from('')),
    ).to.be.revertedWithCustomError(
      seekerStakingManager,
      'SenderMustOwnSeekerId',
    );
  });

  it('cannot stake unregistered seeker with empty proof', async () => {
    const seeker = createRandomSeeker();

    await testSeekers.mint(seekerOwner, seeker.seekerId);

    await expect(
      seekerStakingManager.stakeSeeker(nodeOne, seeker, Buffer.from('')),
    ).to.be.revertedWithCustomError(
      seekerStakingManager,
      'SeekerProofCannotBeEmpty',
    );
  });

  it('stake seeker emits event', async () => {
    const seeker = createRandomSeeker();

    await testSeekers.mint(seekerOwner, seeker.seekerId);

    const proofMessage = await seekerStatsOracle.createProofMessage(seeker);
    const signature = await oracleAccount.signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );

    await expect(seekerStakingManager.stakeSeeker(nodeOne, seeker, signature))
      .to.emit(seekerStatsOracle, 'SeekerStatsUpdated')
      .withArgs(
        seeker.seekerId,
        seeker.attrReactor,
        seeker.attrCores,
        seeker.attrDurability,
        seeker.attrSensors,
        seeker.attrStorage,
        seeker.attrChip,
      );
  });

  it('can stake unregistered seeker', async () => {
    const seeker = createRandomSeeker();

    await testSeekers.mint(seekerOwner, seeker.seekerId);

    const expectedStakedSeeker = new StakedSeeker(
      seeker.seekerId,
      await nodeOne.getAddress(),
      await seekerOwner.getAddress(),
    );

    const proofMessage = await seekerStatsOracle.createProofMessage(seeker);
    const signature = await oracleAccount.signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );

    const stakedSeekerByIdBefore = await seekerStakingManager.stakedSeekersById(
      seeker.seekerId,
    );
    const stakedSeekerByNodeBefore =
      await seekerStakingManager.getStakedSeekersByNode(nodeOne);
    const stakedSeekerByUserBefore =
      await seekerStakingManager.getStakedSeekersByUser(seekerOwner);

    compareStakedSeekers(
      new StakedSeeker(0, ethers.ZeroAddress, ethers.ZeroAddress),
      new StakedSeeker(
        Number(stakedSeekerByIdBefore[0]),
        stakedSeekerByIdBefore[1],
        stakedSeekerByIdBefore[2],
      ),
    );
    assert.equal(stakedSeekerByNodeBefore.length, 0);
    assert.equal(stakedSeekerByUserBefore.length, 0);

    await seekerStakingManager.stakeSeeker(nodeOne, seeker, signature);

    const stakedSeekerByIdAfter = await seekerStakingManager.stakedSeekersById(
      seeker.seekerId,
    );
    const stakedSeekerByNodeAfter =
      await seekerStakingManager.getStakedSeekersByNode(nodeOne);
    const stakedSeekerByUserAfter =
      await seekerStakingManager.getStakedSeekersByUser(seekerOwner);

    compareStakedSeekers(
      expectedStakedSeeker,
      new StakedSeeker(
        Number(stakedSeekerByIdAfter[0]),
        stakedSeekerByIdAfter[1],
        stakedSeekerByIdAfter[2],
      ),
    );
    assert.equal(stakedSeekerByNodeAfter.length, 1);
    assert.equal(Number(stakedSeekerByNodeAfter[0]), seeker.seekerId);
    assert.equal(stakedSeekerByUserAfter.length, 1);
    assert.equal(Number(stakedSeekerByUserAfter[0]), seeker.seekerId);
  });

  it('can stake registered seeker', async () => {
    const seeker = createRandomSeeker();

    await testSeekers.mint(seekerOwner, seeker.seekerId);

    const expectedStakedSeeker = new StakedSeeker(
      seeker.seekerId,
      await nodeOne.getAddress(),
      await seekerOwner.getAddress(),
    );

    const proofMessage = await seekerStatsOracle.createProofMessage(seeker);
    const signature = await oracleAccount.signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );
    await seekerStatsOracle.registerSeeker(seeker, signature);

    const stakedSeekerByIdBefore = await seekerStakingManager.stakedSeekersById(
      seeker.seekerId,
    );
    const stakedSeekerByNodeBefore =
      await seekerStakingManager.getStakedSeekersByNode(nodeOne);
    const stakedSeekerByUserBefore =
      await seekerStakingManager.getStakedSeekersByUser(seekerOwner);

    compareStakedSeekers(
      new StakedSeeker(0, ethers.ZeroAddress, ethers.ZeroAddress),
      new StakedSeeker(
        Number(stakedSeekerByIdBefore[0]),
        stakedSeekerByIdBefore[1],
        stakedSeekerByIdBefore[2],
      ),
    );
    assert.equal(stakedSeekerByNodeBefore.length, 0);
    assert.equal(stakedSeekerByUserBefore.length, 0);

    await seekerStakingManager.stakeSeeker(nodeOne, seeker, Buffer.from(''));

    const stakedSeekerByIdAfter = await seekerStakingManager.stakedSeekersById(
      seeker.seekerId,
    );
    const stakedSeekerByNodeAfter =
      await seekerStakingManager.getStakedSeekersByNode(nodeOne);
    const stakedSeekerByUserAfter =
      await seekerStakingManager.getStakedSeekersByUser(seekerOwner);

    compareStakedSeekers(
      expectedStakedSeeker,
      new StakedSeeker(
        Number(stakedSeekerByIdAfter[0]),
        stakedSeekerByIdAfter[1],
        stakedSeekerByIdAfter[2],
      ),
    );
    assert.equal(stakedSeekerByNodeAfter.length, 1);
    assert.equal(Number(stakedSeekerByNodeAfter[0]), seeker.seekerId);
    assert.equal(stakedSeekerByUserAfter.length, 1);
    assert.equal(Number(stakedSeekerByUserAfter[0]), seeker.seekerId);
  });

  it('multiple calls to stakeSeeker does not duplicate seeker stake', async () => {
    const seeker = createRandomSeeker();

    await testSeekers.mint(seekerOwner, seeker.seekerId);

    const expectedStakedSeeker = new StakedSeeker(
      seeker.seekerId,
      await nodeOne.getAddress(),
      await seekerOwner.getAddress(),
    );

    const proofMessage = await seekerStatsOracle.createProofMessage(seeker);
    const signature = await oracleAccount.signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );

    const stakedSeekerByIdBefore = await seekerStakingManager.stakedSeekersById(
      seeker.seekerId,
    );
    const stakedSeekerByNodeBefore =
      await seekerStakingManager.getStakedSeekersByNode(nodeOne);
    const stakedSeekerByUserBefore =
      await seekerStakingManager.getStakedSeekersByUser(seekerOwner);

    compareStakedSeekers(
      new StakedSeeker(0, ethers.ZeroAddress, ethers.ZeroAddress),
      new StakedSeeker(
        Number(stakedSeekerByIdBefore[0]),
        stakedSeekerByIdBefore[1],
        stakedSeekerByIdBefore[2],
      ),
    );
    assert.equal(stakedSeekerByNodeBefore.length, 0);
    assert.equal(stakedSeekerByUserBefore.length, 0);

    await seekerStakingManager.stakeSeeker(nodeOne, seeker, signature);

    const stakedSeekerByIdAfter = await seekerStakingManager.stakedSeekersById(
      seeker.seekerId,
    );
    const stakedSeekerByNodeAfter =
      await seekerStakingManager.getStakedSeekersByNode(nodeOne);
    const stakedSeekerByUserAfter =
      await seekerStakingManager.getStakedSeekersByUser(seekerOwner);

    compareStakedSeekers(
      expectedStakedSeeker,
      new StakedSeeker(
        Number(stakedSeekerByIdAfter[0]),
        stakedSeekerByIdAfter[1],
        stakedSeekerByIdAfter[2],
      ),
    );
    assert.equal(stakedSeekerByNodeAfter.length, 1);
    assert.equal(Number(stakedSeekerByNodeAfter[0]), seeker.seekerId);
    assert.equal(stakedSeekerByUserAfter.length, 1);
    assert.equal(Number(stakedSeekerByUserAfter[0]), seeker.seekerId);

    await seekerStakingManager.stakeSeeker(nodeOne, seeker, signature);

    const stakedSeekerByIdAfterTwo =
      await seekerStakingManager.stakedSeekersById(seeker.seekerId);
    const stakedSeekerByNodeAfterTwo =
      await seekerStakingManager.getStakedSeekersByNode(nodeOne);
    const stakedSeekerByUserAfterTwo =
      await seekerStakingManager.getStakedSeekersByUser(seekerOwner);

    compareStakedSeekers(
      expectedStakedSeeker,
      new StakedSeeker(
        Number(stakedSeekerByIdAfterTwo[0]),
        stakedSeekerByIdAfterTwo[1],
        stakedSeekerByIdAfterTwo[2],
      ),
    );
    assert.equal(stakedSeekerByNodeAfterTwo.length, 1);
    assert.equal(Number(stakedSeekerByNodeAfterTwo[0]), seeker.seekerId);
    assert.equal(stakedSeekerByUserAfterTwo.length, 1);
    assert.equal(Number(stakedSeekerByUserAfterTwo[0]), seeker.seekerId);
  });

  it('can stake multiple registered seeker', async () => {
    const seeker = createRandomSeeker();
    const seekerTwo = createRandomSeeker();
    const seekerThree = createRandomSeeker();

    await testSeekers.mint(seekerOwner, seeker.seekerId);
    await testSeekers.mint(seekerOwner, seekerTwo.seekerId);
    await testSeekers.mint(seekerOwner, seekerThree.seekerId);

    const expectedStakedSeeker = new StakedSeeker(
      seeker.seekerId,
      await nodeOne.getAddress(),
      await seekerOwner.getAddress(),
    );
    const expectedStakedSeekerTwo = new StakedSeeker(
      seekerTwo.seekerId,
      await nodeTwo.getAddress(),
      await seekerOwner.getAddress(),
    );
    const expectedStakedSeekerThree = new StakedSeeker(
      seekerThree.seekerId,
      await nodeOne.getAddress(),
      await seekerOwner.getAddress(),
    );

    const proofMessage = await seekerStatsOracle.createProofMessage(seeker);
    const proofMessageTwo = await seekerStatsOracle.createProofMessage(
      seekerTwo,
    );
    const proofMessageThree = await seekerStatsOracle.createProofMessage(
      seekerThree,
    );

    const signature = await oracleAccount.signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );
    const signatureTwo = await oracleAccount.signMessage(
      Buffer.from(proofMessageTwo.slice(2), 'hex'),
    );
    const signatureThree = await oracleAccount.signMessage(
      Buffer.from(proofMessageThree.slice(2), 'hex'),
    );

    const stakedSeekerByIdBefore = await seekerStakingManager.stakedSeekersById(
      seeker.seekerId,
    );
    const stakedSeekerByIdBeforeTwo =
      await seekerStakingManager.stakedSeekersById(seekerTwo.seekerId);
    const stakedSeekerByIdBeforeThree =
      await seekerStakingManager.stakedSeekersById(seekerThree.seekerId);
    const stakedSeekerByNodeBefore =
      await seekerStakingManager.getStakedSeekersByNode(nodeOne);
    const stakedSeekerByNodeTwoBefore =
      await seekerStakingManager.getStakedSeekersByNode(nodeTwo);
    const stakedSeekerByUserBefore =
      await seekerStakingManager.getStakedSeekersByUser(seekerOwner);

    compareStakedSeekers(
      new StakedSeeker(0, ethers.ZeroAddress, ethers.ZeroAddress),
      new StakedSeeker(
        Number(stakedSeekerByIdBefore[0]),
        stakedSeekerByIdBefore[1],
        stakedSeekerByIdBefore[2],
      ),
    );
    compareStakedSeekers(
      new StakedSeeker(0, ethers.ZeroAddress, ethers.ZeroAddress),
      new StakedSeeker(
        Number(stakedSeekerByIdBeforeTwo[0]),
        stakedSeekerByIdBeforeTwo[1],
        stakedSeekerByIdBeforeTwo[2],
      ),
    );
    compareStakedSeekers(
      new StakedSeeker(0, ethers.ZeroAddress, ethers.ZeroAddress),
      new StakedSeeker(
        Number(stakedSeekerByIdBeforeThree[0]),
        stakedSeekerByIdBeforeThree[1],
        stakedSeekerByIdBeforeThree[2],
      ),
    );

    assert.equal(stakedSeekerByNodeBefore.length, 0);
    assert.equal(stakedSeekerByNodeTwoBefore.length, 0);
    assert.equal(stakedSeekerByUserBefore.length, 0);

    await seekerStakingManager.stakeSeekers(
      nodeOne,
      [seeker, seekerThree],
      [signature, signatureThree],
    );

    await seekerStakingManager.stakeSeeker(nodeTwo, seekerTwo, signatureTwo);

    const stakedSeekerByIdAfter = await seekerStakingManager.stakedSeekersById(
      seeker.seekerId,
    );
    const stakedSeekerByIdAfterTwo =
      await seekerStakingManager.stakedSeekersById(seekerTwo.seekerId);
    const stakedSeekerByIdAfterThree =
      await seekerStakingManager.stakedSeekersById(seekerThree.seekerId);
    const stakedSeekerByNodeAfter =
      await seekerStakingManager.getStakedSeekersByNode(nodeOne);
    const stakedSeekerByNodeTwoAfter =
      await seekerStakingManager.getStakedSeekersByNode(nodeTwo);
    const stakedSeekerByUserAfter =
      await seekerStakingManager.getStakedSeekersByUser(seekerOwner);

    compareStakedSeekers(
      expectedStakedSeeker,
      new StakedSeeker(
        Number(stakedSeekerByIdAfter[0]),
        stakedSeekerByIdAfter[1],
        stakedSeekerByIdAfter[2],
      ),
    );
    compareStakedSeekers(
      expectedStakedSeekerTwo,
      new StakedSeeker(
        Number(stakedSeekerByIdAfterTwo[0]),
        stakedSeekerByIdAfterTwo[1],
        stakedSeekerByIdAfterTwo[2],
      ),
    );
    compareStakedSeekers(
      expectedStakedSeekerThree,
      new StakedSeeker(
        Number(stakedSeekerByIdAfterThree[0]),
        stakedSeekerByIdAfterThree[1],
        stakedSeekerByIdAfterThree[2],
      ),
    );

    assert.equal(stakedSeekerByNodeAfter.length, 2);
    assert.equal(Number(stakedSeekerByNodeAfter[0]), seeker.seekerId);
    assert.equal(Number(stakedSeekerByNodeAfter[1]), seekerThree.seekerId);

    assert.equal(stakedSeekerByNodeTwoAfter.length, 1);
    assert.equal(Number(stakedSeekerByNodeTwoAfter[0]), seekerTwo.seekerId);

    assert.equal(stakedSeekerByUserAfter.length, 3);
    assert.equal(Number(stakedSeekerByUserAfter[0]), seeker.seekerId);
    assert.equal(Number(stakedSeekerByUserAfter[2]), seekerTwo.seekerId);
    assert.equal(Number(stakedSeekerByUserAfter[1]), seekerThree.seekerId);
  });

  it('cannot unstake seeker from zero node address', async () => {
    await expect(
      seekerStakingManager.unstakeSeeker(ethers.ZeroAddress, 0),
    ).to.be.revertedWithCustomError(
      seekerStakingManager,
      'FromNodeAddressCannotBeNil',
    );
  });

  it('tx sender must own seeker to transfer', async () => {
    await testSeekers.mint(seekerOwner, 10);
    await expect(
      seekerStakingManager.connect(nonSeekerOwner).unstakeSeeker(nodeOne, 10),
    ).to.be.revertedWithCustomError(
      seekerStakingManager,
      'SenderMustOwnSeekerId',
    );
  });

  it('seeker must be staked to unstake', async () => {
    await testSeekers.mint(seekerOwner, 10);
    await expect(
      seekerStakingManager.unstakeSeeker(nodeOne, 10),
    ).to.be.revertedWithCustomError(seekerStakingManager, 'SeekerNotYetStaked');
  });

  it('unstake tx sender must be seeker staker', async () => {
    const seeker = createRandomSeeker();

    await testSeekers.mint(seekerOwner, seeker.seekerId);

    const proofMessage = await seekerStatsOracle.createProofMessage(seeker);
    const signature = await oracleAccount.signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );
    await seekerStakingManager.stakeSeeker(nodeOne, seeker, signature);

    await testSeekers.transferFrom(
      seekerOwner,
      nonSeekerOwner,
      seeker.seekerId,
    );

    await expect(
      seekerStakingManager
        .connect(nonSeekerOwner)
        .unstakeSeeker(nodeOne, seeker.seekerId),
    ).to.be.revertedWithCustomError(
      seekerStakingManager,
      'SeekerNotStakedBySender',
    );
  });

  it('seeker must be unstaked from staked node', async () => {
    const seeker = createRandomSeeker();

    await testSeekers.mint(seekerOwner, seeker.seekerId);

    const proofMessage = await seekerStatsOracle.createProofMessage(seeker);
    const signature = await oracleAccount.signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );
    await seekerStakingManager.stakeSeeker(nodeOne, seeker, signature);

    await expect(
      seekerStakingManager.unstakeSeeker(nodeTwo, seeker.seekerId),
    ).to.be.revertedWithCustomError(
      seekerStakingManager,
      'SeekerNotStakedToNode',
    );
  });

  it('can unstake seeker', async () => {
    const seeker = createRandomSeeker();

    await testSeekers.mint(seekerOwner, seeker.seekerId);

    const stakedSeekerBefore = new StakedSeeker(
      seeker.seekerId,
      await nodeOne.getAddress(),
      await seekerOwner.getAddress(),
    );

    const proofMessage = await seekerStatsOracle.createProofMessage(seeker);
    const signature = await oracleAccount.signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );
    await seekerStakingManager.stakeSeeker(nodeOne, seeker, signature);

    const stakedSeekerByNodeBefore =
      await seekerStakingManager.getStakedSeekersByNode(nodeOne);
    const stakedSeekerByUserBefore =
      await seekerStakingManager.getStakedSeekersByUser(seekerOwner);
    const stakedSeekerByIdBefore = await seekerStakingManager.stakedSeekersById(
      seeker.seekerId,
    );

    assert.equal(stakedSeekerByNodeBefore.length, 1);
    assert.equal(Number(stakedSeekerByNodeBefore[0]), seeker.seekerId);
    assert.equal(stakedSeekerByUserBefore.length, 1);
    assert.equal(Number(stakedSeekerByUserBefore[0]), seeker.seekerId);

    compareStakedSeekers(
      stakedSeekerBefore,
      new StakedSeeker(
        Number(stakedSeekerByIdBefore[0]),
        stakedSeekerByIdBefore[1],
        stakedSeekerByIdBefore[2],
      ),
    );

    await seekerStakingManager.unstakeSeeker(nodeOne, seeker.seekerId);

    const stakedSeekerByNodeAfter =
      await seekerStakingManager.getStakedSeekersByNode(nodeOne);
    const stakedSeekerByUserAfter =
      await seekerStakingManager.getStakedSeekersByUser(seekerOwner);
    const stakedSeekerByIdAfter = await seekerStakingManager.stakedSeekersById(
      seeker.seekerId,
    );

    assert.equal(stakedSeekerByNodeAfter.length, 0);
    assert.equal(stakedSeekerByUserAfter.length, 0);

    compareStakedSeekers(
      new StakedSeeker(0, ethers.ZeroAddress, ethers.ZeroAddress),
      new StakedSeeker(
        Number(stakedSeekerByIdAfter[0]),
        stakedSeekerByIdAfter[1],
        stakedSeekerByIdAfter[2],
      ),
    );
  });

  it('supports only seeker staking manager interface', async () => {
    const abi = [
      'function stakeSeeker(address node, (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256) calldata seeker, bytes calldata seekerStatsProof) external',
      'function stakeSeekers(address node, (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)[] calldata seekers, bytes[] calldata seekerStatsProofs) external',
      'function unstakeSeeker(address node, uint256 seekerId) external',
      'function getStakedSeekersByNode(address node) external view returns (uint256[] memory)',
      'function getStakedSeekersByUser(address node) external view returns (uint256[] memory)',
    ];

    const interfaceId = getInterfaceId(abi);

    const supports = await seekerStakingManager.supportsInterface(interfaceId);

    assert.equal(
      supports,
      true,
      'Expected seeker staking manager to support correct interface',
    );

    const invalidAbi = ['function foo(uint256 duration) external'];

    const invalidAbiInterfaceId = getInterfaceId(invalidAbi);

    const invalid = await seekerStakingManager.supportsInterface(
      invalidAbiInterfaceId,
    );

    assert.equal(
      invalid,
      false,
      'Expected seeker staking manager to not support incorrect interface',
    );
  });

  function compareStakedSeekers(
    seeker1: StakedSeeker,
    seeker2: StakedSeeker,
  ): void {
    assert.equal(
      seeker1.seekerId === seeker2.seekerId &&
        seeker1.node === seeker2.node &&
        seeker1.user === seeker2.user,
      true,
    );
  }
});
