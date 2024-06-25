// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "../IAuthorizedAccounts.sol";

interface ISyloTicketing {
    struct Deposit {
        uint256 escrow; // Balance of users escrow
        uint256 penalty; // Balance of users penalty
        uint256 unlockAt; // Block number a user can withdraw their balances
    }

    enum SignatureType {
        Main,
        Authorized,
        AttachedAuthorized
    }

    struct UserSignature {
        SignatureType sigType;
        bytes signature;
        // This field will only be non-zero if the sig type is `AuthorizedAccount`
        address authorizedAccount;
        // This field will only be present if the sig type is `AttachedAuthorized`
        IAuthorizedAccounts.AttachedAuthorizedAccount attachedAuthorizedAccount;
    }

    struct Ticket {
        uint256 epochId; // The epoch this ticket is associated with
        address sender; // Ticket sender's address
        address receiver; // Ticket receiver's address
        address redeemer; // Address of the intended recipient
        uint256 generationBlock; // Block number the ticket was generated
        bytes32 redeemerCommit; // Hash of the secret random number of the redeemer
    }

    // A type of ticket that does not explicit state the receiver address.
    struct MultiReceiverTicket {
        uint256 epochId; // The epoch this ticket is associated with
        address sender; // Ticket sender's address
        address redeemer; // Ticket redeemer's address
        uint256 generationBlock; // Block number the ticket was generated
        bytes32 redeemerCommit; // Hash of the secret random number of the redeemer
    }

    function setUnlockDuration(uint256 _unlockDuration) external;

    function depositEscrow(uint256 amount, address account) external;

    function depositPenalty(uint256 amount, address account) external;

    function unlockDeposits() external returns (uint256);

    function lockDeposits() external;

    function withdraw() external;

    function redeem(
        Ticket calldata ticket,
        uint256 redeemerRand,
        UserSignature calldata senderSig,
        UserSignature calldata receiverSig
    ) external;

    function redeemMultiReceiver(
        MultiReceiverTicket calldata ticket,
        uint256 redeemerRand,
        address receiver,
        UserSignature calldata senderSig,
        UserSignature calldata receiverSig
    ) external;
}
