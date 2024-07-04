import { ethers } from 'hardhat';
import { SyloContracts } from '../common/contracts';
import { deployContracts } from './utils';
import { Signer } from 'ethers';
import { expect, assert } from 'chai';
import { Registries, RewardsManager } from '../typechain-types';
import { getInterfaceId } from './utils';

describe('Rewards Manager', () => {
  let accounts: Signer[];
  let contracts: SyloContracts;
  let rewardsManager: RewardsManager;
  let registries: Registries;
  let deployer: Signer;
  let node1: Signer;
  let node2: Signer;

  const onlyTicketingRole = ethers.keccak256(Buffer.from('ONLY_TICKETING'));

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    contracts = await deployContracts();
    rewardsManager = contracts.rewardsManager;
    registries = contracts.registries;
    deployer = accounts[0];
    node1 = accounts[10];
    node2 = accounts[11];

    await rewardsManager.grantRole(
      onlyTicketingRole,
      await deployer.getAddress(),
    );
  });

  it('TEMP TEST for coverage', async () => {
    await expect(
      rewardsManager.claim(ethers.ZeroAddress, 0),
    ).to.be.revertedWith('not implemented');
  });

  it('cannot initialize rewards manager with zero registries address', async () => {
    const rewardsManagerFactory = await ethers.getContractFactory(
      'RewardsManager',
    );
    const rewardsManagerTemp = await rewardsManagerFactory.deploy();

    await expect(
      rewardsManagerTemp.initialize(ethers.ZeroAddress, ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(
      rewardsManagerTemp,
      'RegistriesAddressCannotBeNil',
    );
  });

  it('cannot initialize rewards manager with zero ticketing address', async () => {
    const rewardsManagerFactory = await ethers.getContractFactory(
      'RewardsManager',
    );
    const rewardsManagerTemp = await rewardsManagerFactory.deploy();

    await expect(
      rewardsManagerTemp.initialize(
        await registries.getAddress(),
        ethers.ZeroAddress,
      ),
    ).to.be.revertedWithCustomError(
      rewardsManagerTemp,
      'TicketingAddressCannotBeNil',
    );
  });

  it('cannot initialize rewards manager with invalid ticketing address', async () => {
    const rewardsManagerFactory = await ethers.getContractFactory(
      'RewardsManager',
    );
    const rewardsManagerTemp = await rewardsManagerFactory.deploy();

    await expect(
      rewardsManagerTemp.initialize(
        await registries.getAddress(),
        await registries.getAddress(),
      ),
    ).to.be.revertedWithCustomError(
      rewardsManagerTemp,
      'CannotInitializeWithNonTicketing',
    );
  });

  it('cannot increment reward pool without only ticketing role', async () => {
    await expect(
      rewardsManager
        .connect(accounts[1])
        .incrementRewardPool(ethers.ZeroAddress, 0, 0),
    ).to.be.revertedWith(
      'AccessControl: account ' +
        (await accounts[1].getAddress()).toLowerCase() +
        ' is missing role ' +
        onlyTicketingRole,
    );
  });

  it('cannot increment reward pool with invalid node address', async () => {
    await expect(
      rewardsManager.incrementRewardPool(ethers.ZeroAddress, 0, 0),
    ).to.be.revertedWithCustomError(
      rewardsManager,
      'CannotIncrementRewardPoolWithZeroNodeAddress',
    );
  });

  it('cannot increment reward pool with invalid amount', async () => {
    await expect(
      rewardsManager.incrementRewardPool(await deployer.getAddress(), 0, 0),
    ).to.be.revertedWithCustomError(
      rewardsManager,
      'CannotIncrementRewardPoolWithZeroAmount',
    );
  });

  it('can increment reward pool with zero node commission', async () => {
    await registries.setDefaultPayoutPercentage(0);

    await rewardsManager.incrementRewardPool(await node1.getAddress(), 0, 100);

    const rewardPool = await rewardsManager.getRewardPool(
      await node1.getAddress(),
      0,
    );
    const unclaimedCommission = await rewardsManager.getUnclaimedNodeCommission(
      await node1.getAddress(),
    );

    assert.equal(Number(rewardPool), 0);
    assert.equal(Number(unclaimedCommission), 100);
  });

  it('can increment reward pool', async () => {
    await rewardsManager.incrementRewardPool(await node1.getAddress(), 0, 100);

    const rewardPool = await rewardsManager.getRewardPool(
      await node1.getAddress(),
      0,
    );

    assert.equal(Number(rewardPool), 5);
  });

  it('can increment reward pool multiple nodes', async () => {
    await rewardsManager.incrementRewardPool(await node1.getAddress(), 0, 100);
    await rewardsManager.incrementRewardPool(await node2.getAddress(), 0, 200);

    const rewardPool = await rewardsManager.getRewardPool(
      await node1.getAddress(),
      0,
    );
    const rewardPool2 = await rewardsManager.getRewardPool(
      await node2.getAddress(),
      0,
    );

    assert.equal(Number(rewardPool), 5);
    assert.equal(Number(rewardPool2), 10);
  });

  it('can increment reward pool over multiple cycles', async () => {
    await rewardsManager.incrementRewardPool(await node1.getAddress(), 0, 100);
    await rewardsManager.incrementRewardPool(await node1.getAddress(), 1, 200);
    await rewardsManager.incrementRewardPool(await node2.getAddress(), 0, 300);
    await rewardsManager.incrementRewardPool(await node2.getAddress(), 1, 500);

    const rewardPoolNode1 = await rewardsManager.getRewardPools(
      await node1.getAddress(),
      [0, 1],
    );

    const rewardPoolNode2 = await rewardsManager.getRewardPools(
      await node2.getAddress(),
      [0, 1],
    );

    assert.equal(Number(rewardPoolNode1[0]), 5);
    assert.equal(Number(rewardPoolNode1[1]), 10);

    assert.equal(Number(rewardPoolNode2[0]), 15);
    assert.equal(Number(rewardPoolNode2[1]), 25);
  });

  it('can increment reward pool with different node commissions', async () => {
    await registries.setDefaultPayoutPercentage(0);

    await rewardsManager.incrementRewardPool(await node1.getAddress(), 0, 100);
    await rewardsManager.incrementRewardPool(await node2.getAddress(), 0, 300);

    await registries.setDefaultPayoutPercentage(10000);

    await rewardsManager.incrementRewardPool(await node1.getAddress(), 1, 200);
    await rewardsManager.incrementRewardPool(await node2.getAddress(), 1, 500);

    const rewardPoolNode1 = await rewardsManager.getRewardPools(
      await node1.getAddress(),
      [0, 1],
    );

    const rewardPoolNode2 = await rewardsManager.getRewardPools(
      await node2.getAddress(),
      [0, 1],
    );

    const unclaimedNode1Commission =
      await rewardsManager.getUnclaimedNodeCommission(await node1.getAddress());
    const unclaimedNode2Commission =
      await rewardsManager.getUnclaimedNodeCommission(await node2.getAddress());

    assert.equal(Number(rewardPoolNode1[0]), 0);
    assert.equal(Number(rewardPoolNode1[1]), 20);

    assert.equal(Number(rewardPoolNode2[0]), 0);
    assert.equal(Number(rewardPoolNode2[1]), 50);

    assert.equal(Number(unclaimedNode1Commission), 280);
    assert.equal(Number(unclaimedNode2Commission), 750);
  });

  it('rewards manager supports correct interfaces', async () => {
    const abi = [
      'function incrementRewardPool(address node, uint256 cycle, uint256 amount) external',
      'function getRewardPool(address node, uint256 cycle) external view returns (uint256)',
      'function getUnclaimedNodeCommission(address node) external view returns (uint256)',
      'function claim(address node, uint256 cycle) external',
    ];

    const interfaceId = getInterfaceId(abi);

    const supports = await rewardsManager.supportsInterface(interfaceId);

    assert.equal(
      supports,
      true,
      'Expected rewards manager to support correct interface',
    );

    const abiERC165 = [
      'function supportsInterface(bytes4 interfaceId) external view returns (bool)',
    ];

    const interfaceIdERC165 = getInterfaceId(abiERC165);

    const supportsERC165 = await rewardsManager.supportsInterface(
      interfaceIdERC165,
    );

    assert.equal(
      supportsERC165,
      true,
      'Expected rewards manager to support ERC165',
    );

    const invalidAbi = ['function foo(uint256 duration) external'];

    const invalidAbiInterfaceId = getInterfaceId(invalidAbi);

    const invalid = await rewardsManager.supportsInterface(
      invalidAbiInterfaceId,
    );

    assert.equal(
      invalid,
      false,
      'Expected rewards manager to not support incorrect interface',
    );
  });
});
