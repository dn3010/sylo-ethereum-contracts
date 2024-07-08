// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface IAuthorizedAccounts {
    enum Permission {
        // PersonalSign permission allows the authorized account to
        // sign on behalf of the sending account.
        PersonalSign
    }

    /**
     * @dev This type will hold the permission type and the block number from
     * which the permission was set to be authorized and unauthorized.
     * The permission is authorized when authorizedAt >= unauthorizedAt.
     *
     * Note: authorizedAt and unauthorizedAt won't be set to 0 when the permission
     * is updated, because they are both needed when validating the permission.
     */
    struct AuthorizedPermission {
        // Permission type
        Permission permission;
        // Block number from which the permission was set to be authorized.
        // If the transaction is called in block 1, the permission is
        // authorized from block 1 (authorizedAt = block.number).
        uint256 authorizedAt;
        // Block number from which the permission was set to be unauthorized.
        // If the transaction is called in block 1, the permission is
        // unauthorized from block 2 (unauthorizedAt = block.number + 1)
        // unauthorizedAt is set that way to avoid the case where the
        // permission is authorized and unauthorized in the same block:
        // E.g. addPermission is called => authorizedAt = 1
        //      removePermission is called => unauthorizedAt = 1
        // => We cannot tell if the permission is authorized or not.
        // E.g. addPermission is called => authorizedAt = 1
        //      removePermission is called => unauthorizedAt = 2
        //      addPermission is called => authorizedAt = 1 AND update unauthorizedAt = authorizedAt = 1
        // => The permission is authorized when authorizedAt >= unauthorizedAt
        uint256 unauthorizedAt;
    }

    struct AuthorizedAccount {
        // The authorized account
        address account;
        // Block number at which the account was authorized.
        // If the transaction is called in block 1, the account is
        // authorized at block 1 (authorizedAt = block.number).
        // If the account is unauthorized, authorizedAt will be set to 0.
        uint256 authorizedAt;
        // Permission list
        AuthorizedPermission[] permissions;
    }

    /**
     * @dev AttachedAuthorizedAccount represents a type of authorized account
     * that is intended to be supplied alongside each signature, as opposed
     * to the account being stored onchain.
     * This form of authorized account is only supported for receivers, so
     * a permission set field is not present. The struct includes a expiry,
     * and will no longer be valid when the current timestamp exceeds the expiry.
     */
    struct AttachedAuthorizedAccount {
        // The authorized account
        address account;
        // Unix timestamp when this authorized account is no longer valid.
        uint256 expiry;
        // Used to prove the authorization of this account.
        bytes proof;
        // The following strings are used when constructing the proof message.
        string prefix;
        string suffix;
        string infixOne;
    }

    function authorizeAccount(address authorized, Permission[] calldata permissions) external;

    function unauthorizeAccount(address authorized) external;

    function addPermissions(address authorized, Permission[] calldata permissions) external;

    function removePermissions(
        address authorized,
        Permission[] calldata permissionsToRemove
    ) external;

    function validatePermission(
        address main,
        address authorized,
        Permission permission,
        uint256 atBlock
    ) external view returns (bool);

    function getAuthorizedAccounts(
        address main
    ) external view returns (AuthorizedAccount[] memory);

    function createAttachedAuthorizedAccountProofMessage(
        address account,
        uint256 expiry,
        string calldata prefix,
        string calldata suffix,
        string calldata infixOne
    ) external pure returns (bytes memory);

    function validateAttachedAuthorizedAccount(
        address main,
        AttachedAuthorizedAccount calldata account
    ) external view;
}
