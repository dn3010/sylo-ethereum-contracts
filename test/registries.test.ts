import { ethers } from 'hardhat';
import { Signer } from 'ethers';
import { Registries } from '../typechain-types';
import { assert, expect } from 'chai';
import { deployContracts } from './utils';
import { SyloContracts } from '../common/contracts';
import { getInterfaceId } from './utils';

describe('Registries', () => {
  let contracts: SyloContracts;
  let accounts: Signer[];
  let owner: string;

  let registries: Registries;

  before(async () => {
    accounts = await ethers.getSigners();
    owner = await accounts[0].getAddress();
  });

  beforeEach(async () => {
    contracts = await deployContracts();
    registries = contracts.registries;
  });

  it('registries cannot initialize twice', async () => {
    await expect(registries.initialize(5000)).to.be.revertedWith(
      'Initializable: contract is already initialized',
    );
  });

  it('registries cannot initialize with invalid arguments', async () => {
    const registriesFactory = await ethers.getContractFactory('Registries');
    registries = await registriesFactory.deploy();

    await expect(registries.initialize(100001)).to.be.revertedWithCustomError(
      registries,
      'PercentageCannotExceed100000',
    );
  });

  it('can allow owner to set default payout percentage', async () => {
    await expect(registries.setDefaultPayoutPercentage(2000))
      .to.emit(registries, 'DefaultPayoutPercentageUpdated')
      .withArgs(2000);

    const p = await registries.defaultPayoutPercentage();
    assert.equal(
      p,
      2000n,
      'Expected default payout percentage to be correctly updated',
    );
  });

  it('not owner cannot set default payout percentage', async () => {
    await expect(
      registries.connect(accounts[1]).setDefaultPayoutPercentage(2000),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('can set registry', async () => {
    await registries.register('http://api');

    const registry = await registries.getRegistry(owner);

    assert.equal(
      registry.publicEndpoint,
      'http://api',
      'Expected registries to have correct address',
    );
  });

  it('can set registry twice', async () => {
    await registries.register('http://api');
    await registries.register('http://api2');

    const registry = await registries.getRegistry(owner);

    assert.equal(
      registry.publicEndpoint,
      'http://api2',
      'Expected registries to have correct address',
    );
  });

  it('can retrieve all registered nodes', async () => {
    await registries.register('http://api');
    await registries.connect(accounts[1]).register('http://api');

    const nodes = await registries.getNodes();

    assert.deepEqual(nodes, [
      await accounts[0].getAddress(),
      await accounts[1].getAddress(),
    ]);
  });

  it('can query total number of registered nodes', async () => {
    await registries.register('http://api');
    await registries.connect(accounts[1]).register('http://api');

    const n = await registries.getTotalNodes();

    assert.equal(n, 2n);
  });

  it('can retrieve a list of registries', async () => {
    const addresses = await Promise.all(accounts.map(a => a.getAddress()));

    for (let i = 0; i < 20; i++) {
      await registries.connect(accounts[i]).register(`http://api/${i}`);
    }

    const result = await registries.getRegistries(0, 20);

    assert.deepEqual(result[0], addresses, 'Expected 20 registries returned');

    for (let i = 0; i < 20; i++) {
      assert.equal(
        result[0][i],
        addresses[i],
        'Expected correct registry to be returned',
      );
      assert.equal(
        result[1][i].publicEndpoint,
        `http://api/${i}`,
        'Expected correct registry to be returned',
      );
    }
  });

  it('can retrieve a list of registries with start and end indexes', async () => {
    const addresses = await Promise.all(accounts.map(a => a.getAddress()));

    for (let i = 0; i < 20; i++) {
      await registries.connect(accounts[i]).register(`http://api/${i}`);
    }

    const result = await registries.getRegistries(5, 10);

    assert.deepEqual(
      result[0],
      addresses.slice(5, 10),
      'Expected only accounts 5 to 9 to be returned from query',
    );

    for (let i = 5; i < 10; i++) {
      assert.equal(
        result[0][i - 5],
        addresses[i],
        'Expected correct registry to be returned',
      );
      assert.equal(
        result[1][i - 5].publicEndpoint,
        `http://api/${i}`,
        'Expected correct registry to be returned',
      );
    }

    await expect(registries.getRegistries(8, 5)).to.be.revertedWithCustomError(
      registries,
      'EndMustBeGreaterThanStart',
    );

    await expect(registries.getRegistries(8, 21))
      .to.be.revertedWithCustomError(registries, 'EndCannotExceedNumberOfNodes')
      .withArgs(20);
  });

  it('requires default payout percentage to not exceed 100%', async () => {
    await expect(
      registries.setDefaultPayoutPercentage(100001),
    ).to.be.revertedWithCustomError(registries, 'PercentageCannotExceed100000');
  });

  it('requires registry to not have empty public endpoint string', async () => {
    await expect(registries.register('')).to.be.revertedWithCustomError(
      registries,
      'PublicEndpointCannotBeEmpty',
    );
  });

  it('registries supports correct interfaces', async () => {
    const abi = [
      'function register(string calldata publicEndpoint) external',
      'function setDefaultPayoutPercentage(uint32 _defaultPayoutPercentage) external',
      'function getRegistry(address account) external view returns ((uint32, string) memory)',
      'function getNodes() external view returns (address[] memory)',
      'function getRegistries(uint256 start, uint256 end) external view returns (address[] memory, (uint32, string)[] memory)',
      'function getTotalNodes() external view returns (uint256)',
    ];

    const interfaceId = getInterfaceId(abi);

    const supports = await registries.supportsInterface(interfaceId);

    assert.equal(
      supports,
      true,
      'Expected registries to support correct interface',
    );

    const abiERC165 = [
      'function supportsInterface(bytes4 interfaceId) external view returns (bool)',
    ];

    const interfaceIdERC165 = getInterfaceId(abiERC165);

    const supportsERC165 = await registries.supportsInterface(
      interfaceIdERC165,
    );

    assert.equal(supportsERC165, true, 'Expected registries to support ERC165');

    const invalidAbi = ['function foo(uint256 duration) external'];

    const invalidAbiInterfaceId = getInterfaceId(invalidAbi);

    const invalid = await registries.supportsInterface(invalidAbiInterfaceId);

    assert.equal(
      invalid,
      false,
      'Expected registries to not support incorrect interface',
    );
  });
});
