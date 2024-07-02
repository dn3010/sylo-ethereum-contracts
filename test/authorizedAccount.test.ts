import { ethers } from 'hardhat';
import { Signer } from 'ethers';
import { AuthorizedAccounts } from '../typechain-types';
import { deployContracts } from './utils';
import { assert, expect } from 'chai';
import { SyloContracts } from '../common/contracts';
import { Permission } from '../common/enum';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { getInterfaceId } from './utils';

describe('Authorized Accounts', () => {
  let accounts: Signer[];
  let mainAccount: Signer;
  let mainAccountAddress: string;
  let delegatedAccount1: string;
  let delegatedAccount2: string;
  let delegatedAccount3: string;

  let authAccountsConnectMain: AuthorizedAccounts;
  let contracts: SyloContracts;

  const permissionList: Permission[] = [Permission.PersonalSign];

  before(async () => {
    accounts = await ethers.getSigners();
    mainAccount = accounts[1];
    mainAccountAddress = await mainAccount.getAddress();
    delegatedAccount1 = await accounts[2].getAddress();
    delegatedAccount2 = await accounts[3].getAddress();
    delegatedAccount3 = await accounts[4].getAddress();
  });

  beforeEach(async () => {
    contracts = await deployContracts();
    authAccountsConnectMain = contracts.authorizedAccounts.connect(mainAccount);
  });

  it('authorized account cannot be initialized again', async () => {
    await expect(authAccountsConnectMain.initialize()).to.be.revertedWith(
      'Initializable: contract is already initialized',
    );
  });

  it('cannot add zero authorized account', async () => {
    await expect(
      authAccountsConnectMain.authorizeAccount(
        ethers.ZeroAddress,
        permissionList,
      ),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'AuthorizedAccountCannotBeZeroAddress',
    );
  });

  it('can add authorized account', async () => {
    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount1,
      permissionList,
    );
    const authorizedAccounts =
      await authAccountsConnectMain.getAuthorizedAccounts(mainAccountAddress);
    assert.equal(authorizedAccounts.length, 1);
    assert.equal(authorizedAccounts[0].account, delegatedAccount1);
    assert.equal(
      authorizedAccounts[0].permissions.length,
      permissionList.length,
    );
    assert.equal(
      authorizedAccounts[0].permissions[0].permission,
      BigInt(permissionList[0]),
    );
    assert.equal(
      authorizedAccounts[0].permissions[0].authorizedAt,
      await currentBlock(),
    );
    assert.equal(authorizedAccounts[0].permissions[0].unauthorizedAt, 0n);
    assert.equal(authorizedAccounts[0].authorizedAt, await currentBlock());
  });

  it('can add multiple authorized accounts', async () => {
    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount1,
      permissionList,
    );

    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount2,
      permissionList,
    );

    const authorizedAccounts =
      await authAccountsConnectMain.getAuthorizedAccounts(mainAccountAddress);

    assert.equal(authorizedAccounts[0].account, delegatedAccount1);
    assert.equal(authorizedAccounts[1].account, delegatedAccount2);
    assert.equal(authorizedAccounts.length, 2);
  });

  it('cannot add existing authorized account', async () => {
    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount1,
      permissionList,
    );
    await expect(
      authAccountsConnectMain.authorizeAccount(
        delegatedAccount1,
        permissionList,
      ),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'AccountAlreadyAuthorized',
    );
  });

  it('cannot unauthorize invalid authorized account', async () => {
    await expect(
      authAccountsConnectMain.unauthorizeAccount(ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'AuthorizedAccountCannotBeZeroAddress',
    );
  });

  it('cannot unauthorize account if account does not exist', async () => {
    await expect(
      authAccountsConnectMain.unauthorizeAccount(delegatedAccount1),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'AccountDoesNotExist',
    );
  });

  it('cannot unauthorize account that does not exist', async () => {
    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount1,
      permissionList,
    );
    await expect(
      authAccountsConnectMain.unauthorizeAccount(delegatedAccount2),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'AccountDoesNotExist',
    );
  });

  it('can unauthorize account', async () => {
    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount1,
      permissionList,
    );
    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount2,
      permissionList,
    );

    let result = authAccountsConnectMain.authorizeAccount(
      delegatedAccount3,
      permissionList,
    );
    await expect(result)
      .to.emit(authAccountsConnectMain, 'PermissionsAdded')
      .withArgs(
        await mainAccount.getAddress(),
        delegatedAccount3,
        permissionList,
      );

    let authorizedAccounts =
      await authAccountsConnectMain.getAuthorizedAccounts(mainAccountAddress);
    assert.equal(authorizedAccounts[0].account, delegatedAccount1);
    assert.equal(authorizedAccounts[1].account, delegatedAccount2);
    assert.equal(authorizedAccounts[2].account, delegatedAccount3);
    assert.equal(authorizedAccounts.length, 3);

    result = authAccountsConnectMain.unauthorizeAccount(delegatedAccount2);
    await expect(result)
      .to.emit(authAccountsConnectMain, 'PermissionsRemoved')
      .withArgs(
        await mainAccount.getAddress(),
        delegatedAccount2,
        permissionList,
      );

    authorizedAccounts = await authAccountsConnectMain.getAuthorizedAccounts(
      mainAccountAddress,
    );

    assert.equal(authorizedAccounts.length, 3);
    assert.equal(authorizedAccounts[0].account, delegatedAccount1);
    assert.equal(authorizedAccounts[1].account, delegatedAccount2);
    assert.equal(authorizedAccounts[2].account, delegatedAccount3);

    assert.equal(authorizedAccounts[1].authorizedAt, 0n);
    assert.equal(authorizedAccounts[1].permissions.length, 1);
    assert.equal(
      authorizedAccounts[1].permissions[0].permission,
      BigInt(permissionList[0]),
    );
    assert.equal(
      authorizedAccounts[1].permissions[0].unauthorizedAt,
      (await currentBlock()) + 1n,
    );
    expect(
      authorizedAccounts[1].permissions[0].unauthorizedAt,
    ).to.be.greaterThan(authorizedAccounts[1].permissions[0].authorizedAt);
  });

  it('can unauthorize account in the same block after authorizing account', async () => {
    await ethers.provider.send('evm_setAutomine', [false]);
    const block = await currentBlock();

    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount1,
      permissionList,
    );
    await authAccountsConnectMain.unauthorizeAccount(delegatedAccount1);

    assert.equal(await currentBlock(), block);

    await ethers.provider.send('evm_mine');
    await ethers.provider.send('evm_setAutomine', [true]);

    const authorizedAccounts =
      await authAccountsConnectMain.getAuthorizedAccounts(mainAccountAddress);

    assert.equal(authorizedAccounts.length, 1);
    assert.equal(authorizedAccounts[0].account, delegatedAccount1);
    assert.equal(authorizedAccounts[0].permissions.length, 1);
    assert.equal(
      authorizedAccounts[0].permissions[0].permission.toString(),
      BigInt(permissionList[0]).toString(),
    );
    assert.equal(
      authorizedAccounts[0].permissions[0].authorizedAt.toString(),
      (await currentBlock()).toString(),
    );
    assert.equal(
      authorizedAccounts[0].permissions[0].unauthorizedAt,
      (await currentBlock()) + 1n,
    );
  });

  it('can authorize, unauthorize, and authorize again in one block', async () => {
    await ethers.provider.send('evm_setAutomine', [false]);
    const block = await currentBlock();

    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount1,
      permissionList,
    );
    await authAccountsConnectMain.unauthorizeAccount(delegatedAccount1);
    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount1,
      permissionList,
    );

    assert.equal(await currentBlock(), block);

    await ethers.provider.send('evm_mine');
    await ethers.provider.send('evm_setAutomine', [true]);

    const authorizedAccounts =
      await authAccountsConnectMain.getAuthorizedAccounts(mainAccountAddress);

    assert.equal(authorizedAccounts.length, 1);
    assert.equal(authorizedAccounts[0].account, delegatedAccount1);
    assert.equal(authorizedAccounts[0].authorizedAt, await currentBlock());
    assert.equal(authorizedAccounts[0].permissions.length, 1);
    assert.equal(
      authorizedAccounts[0].permissions[0].permission,
      BigInt(permissionList[0]),
    );
    assert.equal(
      authorizedAccounts[0].permissions[0].authorizedAt,
      await currentBlock(),
    );
    assert.equal(
      authorizedAccounts[0].permissions[0].unauthorizedAt,
      authorizedAccounts[0].permissions[0].authorizedAt,
    );
  });

  it('cannot add permission for invalid authorized account', async () => {
    await expect(
      authAccountsConnectMain.addPermissions(
        ethers.ZeroAddress,
        permissionList,
      ),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'AuthorizedAccountCannotBeZeroAddress',
    );
  });

  it('cannot add permission for authorized account that does not exist', async () => {
    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount2,
      permissionList,
    );
    await expect(
      authAccountsConnectMain.addPermissions(delegatedAccount1, permissionList),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'AccountDoesNotExist',
    );
  });

  it('can add permission for authorized account', async () => {
    const permission: Permission[] = [];
    const newPermission: Permission[] = [Permission.PersonalSign];
    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount1,
      permission,
    );

    let result = authAccountsConnectMain.addPermissions(
      delegatedAccount1,
      permission,
    );

    await expect(result)
      .to.emit(authAccountsConnectMain, 'PermissionsAdded')
      .withArgs(await mainAccount.getAddress(), delegatedAccount1, permission);

    result = authAccountsConnectMain.addPermissions(
      delegatedAccount1,
      newPermission,
    );

    await expect(result)
      .to.emit(authAccountsConnectMain, 'PermissionsAdded')
      .withArgs(
        await mainAccount.getAddress(),
        delegatedAccount1,
        newPermission,
      );

    const accounts = await authAccountsConnectMain.getAuthorizedAccounts(
      mainAccountAddress,
    );

    assert.equal(accounts[0].permissions.length, 1);
    assert.equal(
      accounts[0].permissions[0].permission,
      BigInt(Permission.PersonalSign),
    );
    assert.equal(accounts[0].permissions[0].authorizedAt, await currentBlock());
  });

  it('can add multiple permissions (with duplicated permissions) for authorized account', async () => {
    const permission: Permission[] = [];
    const newPermissions: Permission[] = [
      Permission.PersonalSign,
      Permission.PersonalSign,
    ];
    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount1,
      permission,
    );
    await authAccountsConnectMain.addPermissions(
      delegatedAccount1,
      newPermissions,
    );
    const accounts = await authAccountsConnectMain.getAuthorizedAccounts(
      mainAccountAddress,
    );
    assert.equal(accounts[0].permissions.length, 1);
  });

  it('can add existing permission for current authorized account but permissions will not be duplicated', async () => {
    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount1,
      permissionList,
    );
    await authAccountsConnectMain.addPermissions(
      delegatedAccount1,
      permissionList,
    );
    const accounts = await authAccountsConnectMain.getAuthorizedAccounts(
      mainAccountAddress,
    );
    assert.equal(accounts[0].permissions.length, 1);
  });

  it('can remove multiple permissions (with duplicated permissions) for authorized account', async () => {
    const permissionsToAdd: Permission[] = [Permission.PersonalSign];
    const permissionsToRemove: Permission[] = [
      Permission.PersonalSign,
      Permission.PersonalSign,
    ];
    const emptyPermissions: Permission[] = [];
    const permission2: Permission[] = [Permission.PersonalSign];

    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount1,
      permissionsToAdd,
    );
    const authorizedAtBlock = await currentBlock();

    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount2,
      permission2,
    );

    let accounts = await authAccountsConnectMain.getAuthorizedAccounts(
      mainAccountAddress,
    );
    assert.equal(accounts[0].permissions.length, 1);

    let result = authAccountsConnectMain.removePermissions(
      delegatedAccount1,
      emptyPermissions,
    );

    await expect(result)
      .to.emit(authAccountsConnectMain, 'PermissionsRemoved')
      .withArgs(
        await mainAccount.getAddress(),
        delegatedAccount1,
        emptyPermissions,
      );

    accounts = await authAccountsConnectMain.getAuthorizedAccounts(
      mainAccountAddress,
    );
    assert.equal(accounts[0].permissions.length, 1);

    result = authAccountsConnectMain.removePermissions(
      delegatedAccount1,
      permissionsToRemove,
    );

    await expect(result)
      .to.emit(authAccountsConnectMain, 'PermissionsRemoved')
      .withArgs(
        await mainAccount.getAddress(),
        delegatedAccount1,
        permissionsToRemove,
      );

    accounts = await authAccountsConnectMain.getAuthorizedAccounts(
      mainAccountAddress,
    );

    assert.equal(accounts[0].permissions.length, 1);
    assert.equal(
      accounts[0].permissions[0].permission,
      BigInt(Permission.PersonalSign),
    );
    assert.equal(accounts[0].permissions[0].authorizedAt, authorizedAtBlock);
    assert.equal(
      accounts[0].permissions[0].unauthorizedAt,
      (await currentBlock()) + 1n,
    );
    expect(accounts[0].permissions[0].unauthorizedAt).to.be.greaterThan(
      accounts[0].permissions[0].authorizedAt,
    );
  });

  it('cannot remove permission for authorized account that does not exist', async () => {
    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount2,
      permissionList,
    );
    await expect(
      authAccountsConnectMain.removePermissions(
        delegatedAccount1,
        permissionList,
      ),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'AccountDoesNotExist',
    );
  });

  it('cannot remove permission with zero authorized account', async () => {
    const authorizedAddress = ethers.ZeroAddress;
    await expect(
      authAccountsConnectMain.removePermissions(
        authorizedAddress,
        permissionList,
      ),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'AuthorizedAccountCannotBeZeroAddress',
    );
  });

  it('can remove permission', async () => {
    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount1,
      permissionList,
    );
    const authorizedAtBlock = await currentBlock();

    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount2,
      permissionList,
    );

    let accounts = await authAccountsConnectMain.getAuthorizedAccounts(
      mainAccountAddress,
    );

    assert.equal(accounts[0].permissions.length, 1);

    await authAccountsConnectMain.removePermissions(
      delegatedAccount1,
      permissionList,
    );

    accounts = await authAccountsConnectMain.getAuthorizedAccounts(
      mainAccountAddress,
    );

    const expectedUnauthorizedAt = (await currentBlock()) + 1n;

    assert.equal(accounts[0].permissions.length, 1);
    assert.equal(
      accounts[0].permissions[0].permission,
      BigInt(permissionList[0]),
    );
    assert.equal(accounts[0].permissions[0].authorizedAt, authorizedAtBlock);
    assert.equal(
      accounts[0].permissions[0].unauthorizedAt,
      expectedUnauthorizedAt,
    );

    // can remove again without any effect
    await authAccountsConnectMain.removePermissions(
      delegatedAccount1,
      permissionList,
    );

    accounts = await authAccountsConnectMain.getAuthorizedAccounts(
      mainAccountAddress,
    );

    assert.equal(accounts[0].permissions.length, 1);
    assert.equal(
      accounts[0].permissions[0].permission,
      BigInt(permissionList[0]),
    );
    assert.equal(accounts[0].permissions[0].authorizedAt, authorizedAtBlock);
    assert.equal(
      accounts[0].permissions[0].unauthorizedAt,
      expectedUnauthorizedAt,
    );
  });

  it('cannot get authorized accounts associated with invalid main account', async () => {
    const main = ethers.ZeroAddress;
    await expect(
      authAccountsConnectMain.getAuthorizedAccounts(main),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'MainAccountCannotBeZeroAddress',
    );
  });

  it('cannot validate permission with invalid main address ', async () => {
    const main = ethers.ZeroAddress;
    const permission = Permission.PersonalSign;
    await expect(
      authAccountsConnectMain.validatePermission(
        main,
        delegatedAccount1,
        permission,
        await currentBlock(),
      ),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'MainAccountCannotBeZeroAddress',
    );
  });

  it('cannot validate permission with invalid authorized address ', async () => {
    const authorizedAddress = ethers.ZeroAddress;
    const permission = Permission.PersonalSign;
    await expect(
      authAccountsConnectMain.validatePermission(
        mainAccountAddress,
        authorizedAddress,
        permission,
        await currentBlock(),
      ),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'AuthorizedAccountCannotBeZeroAddress',
    );
  });

  it('cannot validate permission with invalid atBlock', async () => {
    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount1,
      permissionList,
    );
    await expect(
      authAccountsConnectMain.validatePermission(
        mainAccountAddress,
        delegatedAccount1,
        permissionList[0],
        0,
      ),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'AtBlockNumberCannotBeZero',
    );
  });

  it('return false if the account is never authorized', async () => {
    const validate = await authAccountsConnectMain.validatePermission(
      mainAccountAddress,
      delegatedAccount1,
      Permission.PersonalSign,
      await currentBlock(),
    );
    assert.equal(validate, false);
  });

  it('return false when validating permission with invalid authorized account', async () => {
    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount1,
      permissionList,
    );

    const validate = await authAccountsConnectMain.validatePermission(
      mainAccountAddress,
      delegatedAccount2,
      Permission.PersonalSign,
      await currentBlock(),
    );

    assert.equal(validate, false);
  });

  it('return false if authorized account does not have valid permission', async () => {
    const permission: Permission[] = [];
    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount1,
      permission,
    );

    const validate = await authAccountsConnectMain.validatePermission(
      mainAccountAddress,
      delegatedAccount1,
      Permission.PersonalSign,
      await currentBlock(),
    );

    assert.equal(validate, false);
  });

  it('can validate multiple cases with different atBlock', async () => {
    const authContract = authAccountsConnectMain;

    /**
     * Symbol:
     * A: authorizedAt
     * U: unauthorizedAt
     * B: atBlock
     */

    // A = 0 => false
    let validate = await authContract.validatePermission(
      mainAccountAddress,
      delegatedAccount1,
      Permission.PersonalSign,
      1000,
    );
    assert.equal(validate, false);

    await authContract.authorizeAccount(delegatedAccount1, permissionList);
    let authBlock = await currentBlock();

    // U = 0 && A < B => true
    validate = await authContract.validatePermission(
      mainAccountAddress,
      delegatedAccount1,
      Permission.PersonalSign,
      1000,
    );
    assert.equal(validate, true);

    // A < B < U => true
    await mine(5);
    await authContract.unauthorizeAccount(delegatedAccount1);
    let unauthBlock = (await currentBlock()) + 1n; // unauthorizeAt = block.number + 1n

    validate = await authContract.validatePermission(
      mainAccountAddress,
      delegatedAccount1,
      Permission.PersonalSign,
      (await currentBlock()) - 3n,
    );
    assert.equal(validate, true);

    // A = B < U => true
    validate = await authContract.validatePermission(
      mainAccountAddress,
      delegatedAccount1,
      Permission.PersonalSign,
      authBlock,
    );
    assert.equal(validate, true);

    // B < A < U => false
    validate = await authContract.validatePermission(
      mainAccountAddress,
      delegatedAccount1,
      Permission.PersonalSign,
      authBlock - 1n,
    );
    assert.equal(validate, false);

    // A < U = B => false
    validate = await authContract.validatePermission(
      mainAccountAddress,
      delegatedAccount1,
      Permission.PersonalSign,
      unauthBlock + 1n,
    );
    assert.equal(validate, false);

    // A < U < B => false
    validate = await authContract.validatePermission(
      mainAccountAddress,
      delegatedAccount1,
      Permission.PersonalSign,
      unauthBlock + 123n,
    );
    assert.equal(validate, false);

    // U = A = B (A is called after U) => true
    await authContract.authorizeAccount(delegatedAccount1, permissionList);
    authBlock = await currentBlock();

    validate = await authContract.validatePermission(
      mainAccountAddress,
      delegatedAccount1,
      Permission.PersonalSign,
      authBlock,
    );
    assert.equal(validate, true);

    // U = A < B => true
    validate = await authContract.validatePermission(
      mainAccountAddress,
      delegatedAccount1,
      Permission.PersonalSign,
      authBlock + 10n,
    );
    assert.equal(validate, true);

    // U = A > B => false
    validate = await authContract.validatePermission(
      mainAccountAddress,
      delegatedAccount1,
      Permission.PersonalSign,
      authBlock - 3n,
    );
    assert.equal(validate, false);

    // B < U < A => false
    await authContract.unauthorizeAccount(delegatedAccount1);
    unauthBlock = (await currentBlock()) + 1n; // unauthorizeAt = block.number + 1n
    await mine(1);
    await authContract.authorizeAccount(delegatedAccount1, permissionList);
    authBlock = await currentBlock();

    validate = await authContract.validatePermission(
      mainAccountAddress,
      delegatedAccount1,
      Permission.PersonalSign,
      authBlock - 3n,
    );
    assert.equal(validate, false);

    // U < A < B => true
    validate = await authContract.validatePermission(
      mainAccountAddress,
      delegatedAccount1,
      Permission.PersonalSign,
      authBlock + 3n,
    );
    assert.equal(validate, true);

    // U < B < A => false
    validate = await authContract.validatePermission(
      mainAccountAddress,
      delegatedAccount1,
      Permission.PersonalSign,
      authBlock - 1n,
    );
    assert.equal(validate, false);
  });

  it('return true if authorized account has valid permission', async () => {
    await authAccountsConnectMain.authorizeAccount(
      delegatedAccount1,
      permissionList,
    );

    const validate = await authAccountsConnectMain.validatePermission(
      mainAccountAddress,
      delegatedAccount1,
      Permission.PersonalSign,
      (await currentBlock()) + 1n,
    );

    assert.equal(validate, true);
  });

  it('can create proof and validate attached authorized account', async () => {
    const attachedAccount = delegatedAccount1;

    const block = await ethers.provider.getBlock('latest');

    const expiry = (block?.timestamp ?? 0) + 10000000;

    const prefix = 'prefix';
    const suffix = 'suffix';
    const infixOne = 'infix';

    const proofMessage =
      await authAccountsConnectMain.createAttachedAuthorizedAccountProofMessage(
        attachedAccount,
        expiry,
        prefix,
        suffix,
        infixOne,
      );

    const proof = await mainAccount.signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );

    await authAccountsConnectMain.validateAttachedAuthorizedAccount(
      mainAccountAddress,
      {
        account: attachedAccount,
        expiry,
        proof,
        prefix,
        suffix,
        infixOne,
      },
    );
  });

  it('reverts with error if account is expired', async () => {
    const attachedAccount = delegatedAccount1;

    const block = await ethers.provider.getBlock('latest');

    // set expiry to any value in the past
    const expiry = (block?.timestamp ?? 0) - 1;

    const prefix = 'prefix';
    const suffix = 'suffix';
    const infixOne = 'infix';

    const proofMessage =
      await authAccountsConnectMain.createAttachedAuthorizedAccountProofMessage(
        attachedAccount,
        expiry,
        prefix,
        suffix,
        infixOne,
      );

    const proof = await mainAccount.signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );

    await expect(
      authAccountsConnectMain.validateAttachedAuthorizedAccount(
        mainAccountAddress,
        {
          account: attachedAccount,
          expiry,
          proof,
          prefix,
          suffix,
          infixOne,
        },
      ),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'AttachedAuthorizedAccountExpired',
    );
  });

  it('reverts with error if authorized account is not signed by main account', async () => {
    const attachedAccount = delegatedAccount1;

    const block = await ethers.provider.getBlock('latest');

    const expiry = (block?.timestamp ?? 0) + 10000000;

    const prefix = 'prefix';
    const suffix = 'suffix';
    const infixOne = 'infix';

    const proofMessage =
      await authAccountsConnectMain.createAttachedAuthorizedAccountProofMessage(
        attachedAccount,
        expiry,
        prefix,
        suffix,
        infixOne,
      );

    const proof = await mainAccount.signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );

    await expect(
      authAccountsConnectMain.validateAttachedAuthorizedAccount(
        delegatedAccount2, // use any address that isn't the main address
        {
          account: attachedAccount,
          expiry,
          proof,
          prefix,
          suffix,
          infixOne,
        },
      ),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'AttachedAuthorizedAccountInvalidProof',
    );
  });

  it('reverts with error if delegated account in proof does not match', async () => {
    const attachedAccount = delegatedAccount1;

    const block = await ethers.provider.getBlock('latest');

    const expiry = (block?.timestamp ?? 0) + 10000000;

    const prefix = 'prefix';
    const suffix = 'suffix';
    const infixOne = 'infix';

    const invalidProofMessage =
      await authAccountsConnectMain.createAttachedAuthorizedAccountProofMessage(
        delegatedAccount2, // use any address that isn't the delegated address
        expiry,
        prefix,
        suffix,
        infixOne,
      );

    const proof = await mainAccount.signMessage(
      Buffer.from(invalidProofMessage.slice(2), 'hex'),
    );

    await expect(
      authAccountsConnectMain.validateAttachedAuthorizedAccount(
        mainAccountAddress,
        {
          account: attachedAccount,
          expiry,
          proof,
          prefix,
          suffix,
          infixOne,
        },
      ),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'AttachedAuthorizedAccountInvalidProof',
    );
  });

  it('reverts with error is message strings are not correct', async () => {
    const attachedAccount = delegatedAccount1;

    const block = await ethers.provider.getBlock('latest');

    const expiry = (block?.timestamp ?? 0) + 10000000;

    const prefix = '   PREFIX   ';
    const suffix = '   suffix   ';
    const infixOne = '  infix   ';

    const proofMessage =
      await authAccountsConnectMain.createAttachedAuthorizedAccountProofMessage(
        attachedAccount,
        expiry,
        prefix,
        suffix,
        infixOne,
      );

    const proof = await mainAccount.signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );

    await expect(
      authAccountsConnectMain.validateAttachedAuthorizedAccount(
        mainAccountAddress, // use any address that isn't the main address
        {
          account: attachedAccount,
          expiry,
          proof,
          prefix: 'invalid prefix',
          suffix,
          infixOne,
        },
      ),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'AttachedAuthorizedAccountInvalidProof',
    );

    await expect(
      authAccountsConnectMain.validateAttachedAuthorizedAccount(
        mainAccountAddress,
        {
          account: attachedAccount,
          expiry,
          proof,
          prefix,
          suffix: 'invalid suffix',
          infixOne,
        },
      ),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'AttachedAuthorizedAccountInvalidProof',
    );

    await expect(
      authAccountsConnectMain.validateAttachedAuthorizedAccount(
        mainAccountAddress, // use any address that isn't the main address
        {
          account: attachedAccount,
          expiry,
          proof,
          prefix,
          suffix,
          infixOne: 'invalid infix',
        },
      ),
    ).to.be.revertedWithCustomError(
      authAccountsConnectMain,
      'AttachedAuthorizedAccountInvalidProof',
    );
  });

  it('authorized accounts supports correct interfaces', async () => {
    const abi = [
      'function authorizeAccount(address authorized, uint8[] calldata permissions) external',
      'function unauthorizeAccount(address authorized) external',
      'function addPermissions(address authorized, uint8[] calldata permissions) external',
      'function removePermissions(address authorized, uint8[] calldata permissionsToRemove) external',
      'function validatePermission(address main, address authorized, uint8 permission, uint256 atBlock) external returns (bool)',
      'function getAuthorizedAccounts(address main) external view returns ((address, uint256, uint8[])[] memory)',
      'function createAttachedAuthorizedAccountProofMessage(address account, uint256 expiry, string calldata prefix, string calldata suffix, string calldata infixOne) external pure returns (bytes memory)',
      'function validateAttachedAuthorizedAccount(address main, (address, uint256, bytes, string, string, string) calldata account) external view',
    ];

    const interfaceId = getInterfaceId(abi);

    const supports = await authAccountsConnectMain.supportsInterface(
      interfaceId,
    );

    assert.equal(
      supports,
      true,
      'Expected authorized accounts to support correct interface',
    );

    const abiERC165 = [
      'function supportsInterface(bytes4 interfaceId) external view returns (bool)',
    ];

    const interfaceIdERC165 = getInterfaceId(abiERC165);

    const supportsERC165 = await authAccountsConnectMain.supportsInterface(
      interfaceIdERC165,
    );

    assert.equal(
      supportsERC165,
      true,
      'Expected authorized accounts to support ERC165',
    );

    const invalidAbi = ['function foo(uint256 duration) external'];

    const invalidAbiInterfaceId = getInterfaceId(invalidAbi);

    const invalid = await authAccountsConnectMain.supportsInterface(
      invalidAbiInterfaceId,
    );

    assert.equal(
      invalid,
      false,
      'Expected authorized accounts to not support incorrect interface',
    );
  });

  async function currentBlock(): Promise<bigint> {
    return BigInt(await ethers.provider.getBlockNumber());
  }
});
