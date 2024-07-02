// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./IAuthorizedAccounts.sol";

/**
 * @notice Manages authorized accounts with limited permissions on behalf of main account
 * these authorized accounts are allowed to perform some certain actions in the Sylo network
 * in order to reduce the works for main account
 */
contract AuthorizedAccounts is
    IAuthorizedAccounts,
    Initializable,
    Ownable2StepUpgradeable,
    ERC165
{
    /**
     * @notice Tracks authorized accounts for every main account
     */
    mapping(address => AuthorizedAccount[]) public authorizedAccounts;

    event PermissionsAdded(
        address indexed main,
        address indexed authorized,
        Permission[] permissions
    );

    event PermissionsRemoved(
        address indexed main,
        address indexed authorized,
        Permission[] permissions
    );

    error AuthorizedAccountCannotBeZeroAddress();
    error MainAccountCannotBeZeroAddress();
    error AtBlockNumberCannotBeZero();
    error AccountAlreadyAuthorized();
    error AccountDoesNotExist();
    error AttachedAuthorizedAccountExpired();
    error AttachedAuthorizedAccountInvalidProof();

    function initialize() external initializer {
        Ownable2StepUpgradeable.__Ownable2Step_init();
    }

    /**
     * @notice Returns true if the contract implements the interface defined by
     * `interfaceId` from ERC165.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == type(IAuthorizedAccounts).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @notice Adds new authorized accounts with certain permissions.
     * This will revert if the account has already existed.
     * @param authorized The address that the main account wants to authorize
     * @param permissions The list of permissions that the authorized account
     * can perform within the Sylo network.
     */
    function authorizeAccount(address authorized, Permission[] calldata permissions) external {
        if (authorized == address(0)) {
            revert AuthorizedAccountCannotBeZeroAddress();
        }

        // check if account has already been authorized
        AuthorizedAccount[] storage authAccounts = authorizedAccounts[msg.sender];
        for (uint i; i < authAccounts.length; ++i) {
            if (authAccounts[i].account == authorized) {
                if (authAccounts[i].authorizedAt != 0) {
                    revert AccountAlreadyAuthorized();
                }

                authAccounts[i].authorizedAt = block.number;
                return _addPermissions(authorized, authAccounts[i], permissions);
            }
        }

        // add new authorized account to the list
        authAccounts.push();
        AuthorizedAccount storage newAccount = authAccounts[authAccounts.length - 1];
        newAccount.account = authorized;
        newAccount.authorizedAt = block.number;

        _addPermissions(authorized, newAccount, permissions);
    }

    /**
     * @notice Removes all permissions of a specific authorized account
     * associated with the msg.sender, and sets the account's authorizedAt to 0.
     * Note: It does not remove the authorized account from the list.
     * This will revert if the account does not exist.
     * @param authorized The address of the authorized account
     */
    function unauthorizeAccount(address authorized) external {
        if (authorized == address(0)) {
            revert AuthorizedAccountCannotBeZeroAddress();
        }

        AuthorizedAccount[] storage authAccounts = authorizedAccounts[msg.sender];
        for (uint i; i < authAccounts.length; ++i) {
            if (authAccounts[i].account == authorized) {
                delete authAccounts[i].authorizedAt;
                return _removePermissions(authorized, authAccounts[i], getAllPermissions());
            }
        }

        revert AccountDoesNotExist();
    }

    /**
     * @notice Adds new permissions to a specific authorized account.
     * - Adding permissions that don't exist in the Permission enum will return
     * with panic code 0x21 (convert a value that is too big or negative into an enum type).
     * - Adding duplicate permissions will update the permissions' authorizedAt value.
     * - Adding permissions that were previously unauthorized will update
     * the authorizedAt and unauthorizedAt values (refer to the comment in
     * IAuthorizedAccount -> AuthorizedPermission struct).
     * This will revert if the account does not exist.
     * @param authorized The authorized account address
     * @param permissions The new permissions will be added to the authorized account
     */
    function addPermissions(address authorized, Permission[] calldata permissions) external {
        if (authorized == address(0)) {
            revert AuthorizedAccountCannotBeZeroAddress();
        }

        AuthorizedAccount[] storage authAccounts = authorizedAccounts[msg.sender];
        for (uint i; i < authAccounts.length; ++i) {
            if (authAccounts[i].account == authorized) {
                return _addPermissions(authorized, authAccounts[i], permissions);
            }
        }

        revert AccountDoesNotExist();
    }

    function _addPermissions(
        address authorized,
        AuthorizedAccount storage authAccount,
        Permission[] memory permissions
    ) private {
        for (uint i; i < permissions.length; ++i) {
            bool exists;
            for (uint j; j < authAccount.permissions.length; ++j) {
                AuthorizedPermission storage authPermission = authAccount.permissions[j];
                if (permissions[i] == authPermission.permission) {
                    exists = true;
                    authPermission.authorizedAt = block.number;

                    // make sure unauthorizedAt is not greater than authorizedAt
                    // (refer to the comment in IAuthorizedAccount -> AuthorizedPermission struct)
                    if (authPermission.unauthorizedAt > authPermission.authorizedAt) {
                        authPermission.unauthorizedAt = authPermission.authorizedAt;
                    }
                    break;
                }
            }
            if (!exists) {
                authAccount.permissions.push(
                    AuthorizedPermission({
                        permission: permissions[i],
                        authorizedAt: block.number,
                        unauthorizedAt: 0
                    })
                );
            }
        }

        emit PermissionsAdded(msg.sender, authorized, permissions);
    }

    /**
     * @notice Removes permissions of specific authorized account.
     * - Removing permissions that don't exist in the Permission enum will return
     * with panic code 0x21 (convert a value that is too big or negative into an enum type).
     * - Removing duplicate/authorized permissions will update the permissions'
     * unauthorizedAt value.
     * This will revert if the account does not exist.
     * @param authorized The address of authorized account
     * @param permissions The list of permissions will be removed
     */
    function removePermissions(address authorized, Permission[] calldata permissions) external {
        if (authorized == address(0)) {
            revert AuthorizedAccountCannotBeZeroAddress();
        }

        AuthorizedAccount[] storage authAccounts = authorizedAccounts[msg.sender];
        for (uint i; i < authAccounts.length; ++i) {
            if (authAccounts[i].account == authorized) {
                return _removePermissions(authorized, authAccounts[i], permissions);
            }
        }

        revert AccountDoesNotExist();
    }

    function _removePermissions(
        address authorized,
        AuthorizedAccount storage authAccount,
        Permission[] memory permissions
    ) private {
        for (uint i; i < permissions.length; ++i) {
            for (uint j; j < authAccount.permissions.length; ++j) {
                if (permissions[i] == authAccount.permissions[j].permission) {
                    // only update unauthorizedAt if the permission is authorized
                    if (
                        authAccount.permissions[j].authorizedAt >=
                        authAccount.permissions[j].unauthorizedAt
                    ) {
                        authAccount.permissions[j].unauthorizedAt = block.number + 1;
                    }
                    break;
                }
            }
        }

        emit PermissionsRemoved(msg.sender, authorized, permissions);
    }

    /**
     * @notice Validates permission of an authorized account associated with the main account.
     *
     * @param main The address of main account
     * @param authorized The address of authorized account
     * @param permission The permission needs to be verified with the authorized account
     * @param atBlock The block number to check if the permission is valid between
     * the permission's authorizedAt and unauthorizedAt period. It is added later to prevent
     * the timing attack. E.g. If the main account authorizes the PersonalSign permission at
     * block 1, creates a ticket at block 2, then unauthorizes the permission at block 3, the
     * ticket will be invalid and cannot be redeemed. To avoid this, the `atBlock` param is
     * needed to check if the permission is authorized between its authorizedAt and unauthorizedAt
     * duration.
     *
     * @return boolean value
     */
    function validatePermission(
        address main,
        address authorized,
        Permission permission,
        uint256 atBlock
    ) external view returns (bool) {
        if (main == address(0)) {
            revert MainAccountCannotBeZeroAddress();
        }

        if (authorized == address(0)) {
            revert AuthorizedAccountCannotBeZeroAddress();
        }

        if (atBlock == 0) {
            revert AtBlockNumberCannotBeZero();
        }

        AuthorizedAccount[] storage authAccounts = authorizedAccounts[main];

        for (uint i = 0; i < authAccounts.length; ++i) {
            if (authAccounts[i].account == authorized) {
                for (uint j = 0; j < authAccounts[i].permissions.length; ++j) {
                    if (authAccounts[i].permissions[j].permission == permission) {
                        uint256 authorizedAt = authAccounts[i].permissions[j].authorizedAt;
                        uint256 unauthorizedAt = authAccounts[i].permissions[j].unauthorizedAt;

                        bool isPermissionUnauthorized = authorizedAt > 0 &&
                            authorizedAt < unauthorizedAt;
                        if (isPermissionUnauthorized) {
                            // the permission was previously valid, so we check that
                            // the `atBlock` is referencing a time when the permission was valid
                            return authorizedAt <= atBlock && atBlock < unauthorizedAt;
                        }

                        // otherwise just check if the permission was authorized before the
                        // atBlock
                        return authorizedAt > 0 && authorizedAt <= atBlock;
                    }
                }
            }
        }

        return false;
    }

    /**
     * @notice Get all authorized accounts associated with a given account
     * @param main The address of main account
     * @return An array of authorized accounts
     */
    function getAuthorizedAccounts(
        address main
    ) external view returns (AuthorizedAccount[] memory) {
        if (main == address(0)) {
            revert MainAccountCannotBeZeroAddress();
        }

        return authorizedAccounts[main];
    }

    function getAllPermissions() internal pure returns (Permission[] memory) {
        Permission[] memory permissions = new Permission[](1);
        permissions[0] = Permission.PersonalSign;
        return permissions;
    }

    /**
     * @notice Creates a proof for an authorized account. The prefix, suffix,
     * and infix strings allow applications to create more human-readable
     * messages for personal_sign requests.
     * @param account The authorized account
     * @param prefix String that is prefixed before the account address in the
     * signing message
     * @param suffix String that is placed after the expiry value in the signing
     * message
     * @param infixOne String that is placed between the address and expiry in
     * the signing message
     */
    function createAttachedAuthorizedAccountProofMessage(
        address account,
        uint256 expiry,
        string calldata prefix,
        string calldata suffix,
        string calldata infixOne
    ) external pure returns (bytes memory) {
        return
            _createAttachedAuthorizedAccountProofMessage(
                account,
                expiry,
                prefix,
                suffix,
                infixOne
            );
    }

    function _createAttachedAuthorizedAccountProofMessage(
        address account,
        uint256 expiry,
        string calldata prefix,
        string calldata suffix,
        string calldata infixOne
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                prefix,
                Strings.toHexString(uint256(uint160(account)), 20),
                infixOne,
                Strings.toString((expiry)),
                suffix
            );
    }

    function validateAttachedAuthorizedAccount(
        address main,
        AttachedAuthorizedAccount calldata account
    ) external view {
        if (block.timestamp > account.expiry) {
            revert AttachedAuthorizedAccountExpired();
        }

        bytes memory proofMessage = _createAttachedAuthorizedAccountProofMessage(
            account.account,
            account.expiry,
            account.prefix,
            account.suffix,
            account.infixOne
        );
        bytes32 ethProof = ECDSA.toEthSignedMessageHash(proofMessage);

        if (ECDSA.recover(ethProof, account.proof) != main) {
            revert AttachedAuthorizedAccountInvalidProof();
        }
    }
}
