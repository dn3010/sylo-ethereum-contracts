// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../libraries/SyloUtils.sol";

import "./ITicketing.sol";
import "./IRewardsManager.sol";
import "../IRegistries.sol";
import "../IAuthorizedAccounts.sol";
import "../IFuturepassRegistrar.sol";
import "../staking/sylo/ISyloStakingManager.sol";

/**
 * @notice The SyloTicketing contract manages the Probabilistic
 * Micro-Payment Ticketing system that pays Nodes for providing the
 * Event Relay service.
 */
contract Ticketing is ITicketing, Initializable, Ownable2StepUpgradeable, ERC165 {
    /** ERC20 Sylo token contract.*/
    IERC20 public _token;

    /** Sylo Registries contract */
    IRegistries public _registries;

    /** Sylo Staking Manager contract */
    ISyloStakingManager public _stakingManager;

    /** Rewards Manager contract */
    IRewardsManager public _rewardsManager;

    /**
     * @notice Sylo Authorized Accounts.
     */
    IAuthorizedAccounts public _authorizedAccounts;

    /**
     * @notice Futurepass Registrar Pre-compile.
     */
    IFuturepassRegistrar public _futurepassRegistrar;

    /**
     * @notice The number of blocks a user must wait after calling "unlock"
     * before they can withdraw their funds.
     */
    uint256 public unlockDuration;

    /** @notice Mapping of user deposits */
    mapping(address => Deposit) public deposits;

    /** @notice Mapping of ticket hashes, used to check if a ticket has been redeemed */
    mapping(bytes32 => bool) public usedTickets;

    event UnlockDurationUpdated(uint256 unlockDuration);
    event SenderPenaltyBurnt(address sender);
    event Redemption(
        uint256 indexed epochId,
        address indexed redeemer,
        address indexed sender,
        address receiver,
        uint256 generationBlock,
        uint256 amount
    );
    event MultiReceiverRedemption(
        uint256 indexed epochId,
        address indexed redeemer,
        address indexed sender,
        address receiver,
        uint256 generationBlock,
        uint256 amount
    );

    error NoEsrowAndPenalty();
    error UnlockingInProcess();
    error UnlockingNotInProcess();
    error UnlockingNotCompleted();
    error EscrowAmountCannotBeZero();
    error PenaltyAmountCannotBeZero();
    error UnlockDurationCannotBeZero();
    error AccountCannotBeZeroAddress();
    error InvalidSigningPermission();
    error SenderCannotUseAttachedAuthorizedAccount();

    error TicketNotWinning();
    error MissingFuturepassAccount(address receiver);
    error TicketAlreadyUsed();
    error TicketEpochNotFound();
    error TicketAlreadyRedeemed();
    error RedeemerCommitMismatch();
    error InvalidSignature();
    error TokenCannotBeZeroAddress();
    error TicketNotCreatedInTheEpoch();
    error TicketCannotBeFromFutureBlock();
    error TicketSenderCannotBeZeroAddress();
    error TicketReceiverCannotBeZeroAddress();
    error TicketRedeemerCannotBeZeroAddress();
    error RedeemerMustHaveJoinedEpoch(uint256 epochId);

    function initialize(
        IERC20 token,
        IRegistries registries,
        ISyloStakingManager stakingManager,
        IRewardsManager rewardsManager,
        IAuthorizedAccounts authorizedAccounts,
        IFuturepassRegistrar futurepassRegistrar,
        uint256 _unlockDuration
    ) external initializer {
        if (address(token) == address(0)) {
            revert TokenCannotBeZeroAddress();
        }

        SyloUtils.validateContractInterface(
            "Registries",
            address(registries),
            type(IRegistries).interfaceId
        );

        SyloUtils.validateContractInterface(
            "SyloStakingManager",
            address(stakingManager),
            type(ISyloStakingManager).interfaceId
        );

        SyloUtils.validateContractInterface(
            "RewardsManager",
            address(rewardsManager),
            type(IRewardsManager).interfaceId
        );

        SyloUtils.validateContractInterface(
            "AuthorizedAccounts",
            address(authorizedAccounts),
            type(IAuthorizedAccounts).interfaceId
        );

        if (_unlockDuration == 0) {
            revert UnlockDurationCannotBeZero();
        }

        Ownable2StepUpgradeable.__Ownable2Step_init();

        _token = token;
        _registries = registries;
        _stakingManager = stakingManager;
        _rewardsManager = rewardsManager;
        _authorizedAccounts = authorizedAccounts;
        _futurepassRegistrar = futurepassRegistrar;

        unlockDuration = _unlockDuration;
    }

    /**
     * @notice Returns true if the contract implements the interface defined by
     * `interfaceId` from ERC165.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(ITicketing).interfaceId;
    }

    /**
     * @notice Set the unlock duration for deposits. Only callable
     * by the owner.
     * @param _unlockDuration The unlock duration in blocks.
     */
    function setUnlockDuration(uint256 _unlockDuration) external onlyOwner {
        if (_unlockDuration == 0) {
            revert UnlockDurationCannotBeZero();
        }

        unlockDuration = _unlockDuration;
        emit UnlockDurationUpdated(_unlockDuration);
    }

    /**
     * @notice Use this function to deposit funds into the
     * escrow. This will fail if the deposit is currently being
     * unlocked.
     * @param amount The amount in SOLO to add to the escrow.
     * @param account The address of the account holding the escrow.
     */
    function depositEscrow(uint256 amount, address account) external {
        if (amount == 0) {
            revert EscrowAmountCannotBeZero();
        }
        if (account == address(0)) {
            revert AccountCannotBeZeroAddress();
        }

        Deposit storage deposit = getDeposit(account);
        if (deposit.unlockAt != 0) {
            revert UnlockingInProcess();
        }

        deposit.escrow = deposit.escrow + amount;

        SafeERC20.safeTransferFrom(_token, msg.sender, address(this), amount);
    }

    /**
     * @notice Use this function to deposit funds into the
     * penalty. This will fail if the deposit is currently being
     * unlocked.
     * @param amount The amount in SOLO to add to the escrow.
     * @param account The address of the account holding the penalty.
     */
    function depositPenalty(uint256 amount, address account) external {
        if (amount == 0) {
            revert PenaltyAmountCannotBeZero();
        }
        if (account == address(0)) {
            revert AccountCannotBeZeroAddress();
        }

        Deposit storage deposit = getDeposit(account);
        if (deposit.unlockAt != 0) {
            revert UnlockingInProcess();
        }

        deposit.penalty = deposit.penalty + amount;

        SafeERC20.safeTransferFrom(_token, msg.sender, address(this), amount);
    }

    /**
     * @notice Call this function to begin unlocking deposits. This function
     * will fail if no deposit exists, or if the unlock process has
     * already begun.
     */
    function unlockDeposits() external returns (uint256) {
        Deposit storage deposit = getDeposit(msg.sender);

        if (deposit.escrow == 0 && deposit.penalty == 0) {
            revert NoEsrowAndPenalty();
        }
        if (deposit.unlockAt != 0) {
            revert UnlockingInProcess();
        }

        deposit.unlockAt = block.number + unlockDuration;

        return deposit.unlockAt;
    }

    /**
     * @notice Call this function to cancel any deposit that is in the
     * unlocking process.
     */
    function lockDeposits() external {
        Deposit storage deposit = getDeposit(msg.sender);
        if (deposit.unlockAt == 0) {
            revert UnlockingNotInProcess();
        }

        delete deposit.unlockAt;
    }

    /**
     * @notice Call this function once the unlock duration has
     * elapsed in order to transfer the unlocked tokens to the caller's account.
     */
    function withdraw() external {
        return withdrawTo(msg.sender);
    }

    /**
     * @notice Call this function once the unlock duration has
     * elapsed in order to transfer the unlocked tokens to the specified
     * account.
     * @param account The address of the account the tokens should be
     * transferred to.
     */
    function withdrawTo(address account) public {
        Deposit memory deposit = getDeposit(msg.sender);
        if (deposit.unlockAt == 0) {
            revert UnlockingNotInProcess();
        }
        if (deposit.unlockAt >= block.number) {
            revert UnlockingNotCompleted();
        }

        uint256 amount = deposit.escrow + deposit.penalty;

        // Reset deposit values to 0
        delete deposits[msg.sender];

        SafeERC20.safeTransfer(_token, account, amount);
    }

    /**
     * @notice Nodes should call this function on completing an event
     * delivery. This function will fail if the ticket is invalid or if the
     * ticket is not a winner. Clients should calculate if the ticket is a
     * winner locally, but can also use the public view functions:
     * `requireValidWinningTicket` and `isWinningTicket` to check that a ticket
     * is winning.
     * @param ticket The ticket issued by the sender.
     * @param redeemerRand The redeemer random value, generated by the Node prior
     * to performing the event relay.
     * @param senderSig The signature of the sender of the ticket.
     * @param receiverSig The signature of the redeemer of the ticket.
     */
    function redeem(
        Ticket calldata ticket,
        uint256 redeemerRand,
        UserSignature calldata senderSig,
        UserSignature calldata receiverSig
    ) external {
        if (ticket.generationBlock > block.number) {
            revert TicketCannotBeFromFutureBlock();
        }

        bytes32 ticketHash = requireValidWinningTicket(
            ticket,
            redeemerRand,
            senderSig,
            receiverSig
        );

        usedTickets[ticketHash] = true;

        _redeem(1 /* TODO */, ticket);
    }

    /**
     * @notice Nodes should call this function on completing a one-to-many event
     * delivery. This function will fail if the ticket is invalid or if the
     * ticket is not a winner. Additionally, the specified receiver must have
     * a valid futurepass account associated with it. Clients should calculate
     * if the ticket is a winner locally, but can also use the public view
     * functions:
     * `requireValidWinningMultiReceiverTicket` and `isWinningTicket` to check
     * that a ticket is winning.
     * @param ticket The ticket issued by the sender.
     * @param redeemerRand The redeemer random value, generated by the Node prior
     * to performing the event relay.
     * @param receiver A valid receiver of the the relay.
     * @param senderSig The signature of the sender of the ticket.
     * @param receiverSig The signature of the redeemer of the ticket.
     */
    function redeemMultiReceiver(
        MultiReceiverTicket calldata ticket,
        uint256 redeemerRand,
        address receiver,
        UserSignature calldata senderSig,
        UserSignature calldata receiverSig
    ) external {
        if (ticket.generationBlock > block.number) {
            revert TicketCannotBeFromFutureBlock();
        }

        (, bytes32 ticketReceiverHash) = requireValidWinningMultiReceiverTicket(
            ticket,
            receiver,
            redeemerRand,
            senderSig,
            receiverSig
        );

        usedTickets[ticketReceiverHash] = true;

        _redeemMultiReceiver(1 /* TODO */, ticket, receiver);
    }

    function _redeem(uint256 faceValue, Ticket calldata ticket) internal {
        uint256 rewardAmount = rewardRedeemer(faceValue, ticket.sender, ticket.redeemer);

        emit Redemption(
            ticket.epochId,
            ticket.redeemer,
            ticket.sender,
            ticket.receiver,
            ticket.generationBlock,
            rewardAmount
        );
    }

    function _redeemMultiReceiver(
        uint256 multiReceiverFaceValue,
        MultiReceiverTicket calldata ticket,
        address receiver
    ) internal {
        uint256 rewardAmount = rewardRedeemer(
            multiReceiverFaceValue,
            ticket.sender,
            ticket.redeemer
        );

        emit MultiReceiverRedemption(
            ticket.epochId,
            ticket.redeemer,
            ticket.sender,
            receiver,
            ticket.generationBlock,
            rewardAmount
        );
    }

    function rewardRedeemer(
        uint256 faceValue,
        address sender,
        address redeemer
    ) internal returns (uint256) {
        Deposit storage deposit = getDeposit(sender);

        uint256 amount;

        if (faceValue > deposit.escrow) {
            amount = deposit.escrow;
            incrementRewardPool(redeemer, deposit, amount);
            SafeERC20.safeTransfer(
                _token,
                address(0x000000000000000000000000000000000000dEaD),
                deposit.penalty
            );

            delete deposit.penalty;
            emit SenderPenaltyBurnt(sender);
        } else {
            amount = faceValue;
            incrementRewardPool(redeemer, deposit, amount);
        }

        return amount;
    }

    /**
     * @notice Call this function to check if a ticket is valid and is
     * a winning ticket. It will fail if the ticket is invalid or is not
     * a winner. A ticket is invalid if:
     *      - The sender or redeemer addresses are null
     *      - The ticket has already been redeemed.
     *      - The secret random value of the sender does not match the commit
     *        in the ticket.
     *      - The signatures are invalid.
     * @param ticket The ticket issued by the sender.
     * @param redeemerRand The redeemer random value, generated by the Node prior
     * to performing the event relay.
     * @param senderSig The signature of the sender of the ticket.
     * @param receiverSig The signature of the redeemer of the ticket.
     * @return ticketHash The hash of the ticket. Should match the hash generated
     * by `getTicketHash`.
     */
    function requireValidWinningTicket(
        Ticket memory ticket,
        uint256 redeemerRand,
        UserSignature memory senderSig,
        UserSignature memory receiverSig
    ) public view returns (bytes32 ticketHash) {
        if (ticket.sender == address(0)) {
            revert TicketSenderCannotBeZeroAddress();
        }
        if (ticket.receiver == address(0)) {
            revert TicketReceiverCannotBeZeroAddress();
        }
        if (ticket.redeemer == address(0)) {
            revert TicketRedeemerCannotBeZeroAddress();
        }

        ticketHash = getTicketHash(ticket);
        if (usedTickets[ticketHash]) {
            revert TicketAlreadyRedeemed();
        }

        // validate the redeemer has knowledge of the redeemer rand
        if (createCommit(ticket.generationBlock, redeemerRand) != ticket.redeemerCommit) {
            revert RedeemerCommitMismatch();
        }

        if (senderSig.sigType == SignatureType.AttachedAuthorized) {
            revert SenderCannotUseAttachedAuthorizedAccount();
        }

        validateTicketSig(ticket.sender, senderSig, ticket.generationBlock, ticketHash);
        validateTicketSig(ticket.receiver, receiverSig, ticket.generationBlock, ticketHash);

        if (
            !isWinningTicket(
                senderSig.signature,
                receiverSig.signature,
                ticket.epochId,
                ticket.generationBlock,
                redeemerRand
            )
        ) {
            revert TicketNotWinning();
        }
    }

    /**
     * @notice Call this function to check if a multi receiver ticket is valid and is
     * a winning ticket. It will fail if the ticket is invalid or is not
     * a winner. A ticket is invalid if:
     *      - The sender, receiver or redeemer addresses are null
     *      - The receiver does not have a valid futurepass account
     *      - The ticket has already been redeemed.
     *      - The secret random value of the redeemer does not match the commit
     *        in the ticket.
     *      - The signatures are invalid.
     * @param ticket The ticket issued by the sender.
     * @param receiver The receiver associated with the ticket.
     * @param redeemerRand The redeemer random value, generated by the Node prior
     * to performing the event relay.
     * @param senderSig The signature of the sender of the ticket.
     * @param receiverSig The signature of the redeemer of the ticket.
     */
    function requireValidWinningMultiReceiverTicket(
        MultiReceiverTicket memory ticket,
        address receiver,
        uint256 redeemerRand,
        UserSignature memory senderSig,
        UserSignature memory receiverSig
    ) public view returns (bytes32 ticketHash, bytes32 ticketReceiverHash) {
        if (ticket.sender == address(0)) {
            revert TicketSenderCannotBeZeroAddress();
        }
        if (receiver == address(0)) {
            revert TicketReceiverCannotBeZeroAddress();
        }
        if (ticket.redeemer == address(0)) {
            revert TicketRedeemerCannotBeZeroAddress();
        }

        address futurepassAccount = _futurepassRegistrar.futurepassOf(receiver);
        if (futurepassAccount == address(0)) {
            revert MissingFuturepassAccount(receiver);
        }

        // There are two hashes create. The first hash is signed by the
        // sender and receiver, and is primarily used to validate these actors
        // agreed on the contents of the ticket.
        // The second hash is to prevent re-use. In a multi-receiver context,
        // the same ticket can be re-used amongst many receiver, but should
        // only be used ONCE per futurepass account. Thus the second hash
        // additionally appends the futurepass address as well.
        ticketHash = getMultiReceiverTicketHash(ticket);
        ticketReceiverHash = keccak256(abi.encodePacked(ticketHash, futurepassAccount));
        if (usedTickets[ticketReceiverHash]) {
            revert TicketAlreadyRedeemed();
        }

        // validate the redeemer has knowledge of the redeemer rand
        if (createCommit(ticket.generationBlock, redeemerRand) != ticket.redeemerCommit) {
            revert RedeemerCommitMismatch();
        }

        if (senderSig.sigType == SignatureType.AttachedAuthorized) {
            revert SenderCannotUseAttachedAuthorizedAccount();
        }

        validateTicketSig(ticket.sender, senderSig, ticket.generationBlock, ticketHash);
        validateTicketSig(receiver, receiverSig, ticket.generationBlock, ticketHash);

        if (
            !isWinningTicket(
                senderSig.signature,
                receiverSig.signature,
                ticket.epochId,
                ticket.generationBlock,
                redeemerRand
            )
        ) {
            revert TicketNotWinning();
        }

        return (ticketHash, ticketReceiverHash);
    }

    function hasSigningPermission(
        address main,
        address delegated,
        uint256 generationBlock
    ) internal view returns (bool) {
        IAuthorizedAccounts.Permission permission = IAuthorizedAccounts.Permission.PersonalSign;
        return
            _authorizedAccounts.validatePermission(main, delegated, permission, generationBlock);
    }

    function createCommit(uint256 generationBlock, uint256 rand) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(keccak256(abi.encodePacked(generationBlock, rand))));
    }

    function getDeposit(address account) private view returns (Deposit storage) {
        return deposits[account];
    }

    function validateTicketSig(
        address main,
        UserSignature memory sig,
        uint256 generationBlock,
        bytes32 ticketHash
    ) internal view {
        if (sig.sigType == SignatureType.Main) {
            if (!isValidTicketSig(main, sig.signature, ticketHash)) {
                revert InvalidSignature();
            }
        } else if (sig.sigType == SignatureType.Authorized) {
            if (!hasSigningPermission(main, sig.authorizedAccount, generationBlock)) {
                revert InvalidSigningPermission();
            }

            if (!isValidTicketSig(sig.authorizedAccount, sig.signature, ticketHash)) {
                revert InvalidSignature();
            }
        } else if (sig.sigType == SignatureType.AttachedAuthorized) {
            _authorizedAccounts.validateAttachedAuthorizedAccount(
                main,
                sig.attachedAuthorizedAccount
            );

            if (
                !isValidTicketSig(sig.attachedAuthorizedAccount.account, sig.signature, ticketHash)
            ) {
                revert InvalidSignature();
            }
        }
    }

    function isValidTicketSig(
        address signer,
        bytes memory sig,
        bytes32 ticketHash
    ) internal pure returns (bool) {
        bytes32 ethHash = ECDSA.toEthSignedMessageHash(ticketHash);
        return ECDSA.recover(ethHash, sig) == signer;
    }

    /**
     * @notice Use this function to check if a ticket is winning.
     * @param senderSig The signature of the sender of the ticket.
     * @param receiverSig The signature of the receiver of the ticket.
     * @param epochId The epochId of the ticket.
     * @param generationBlock The generationBlock of the ticket.
     * @param redeemerRand The redeemer random value, generated by the Node prior
     * to performing the event relay.
     * @return True if a ticket is a winner.
     */
    function isWinningTicket(
        bytes memory senderSig,
        bytes memory receiverSig,
        uint256 epochId,
        uint256 generationBlock,
        uint256 redeemerRand
    ) public view returns (bool) {
        uint256 winProb = calculateWinningProbability(epochId, generationBlock);
        // bitshift the winProb to a 256 bit value to allow comparison to a 32 byte hash
        uint256 prob = (uint256(winProb) << 128) | uint256(winProb);
        return uint256(keccak256(abi.encodePacked(senderSig, receiverSig, redeemerRand))) < prob;
    }

    /**
     * @notice This function calculates the probability of a ticket winning at
     * the block that this function was called. A ticket's winning probability
     * will decay every block since its issuance. The amount of decay will depend
     * on the decay rate parameter of the epoch the ticket was generated in.
     * @param epochId The epochId of the ticket.
     * @param generationBlock The generationBlock of the ticket.
     */
    function calculateWinningProbability(
        uint256 epochId,
        uint256 generationBlock
    ) public view returns (uint128) {
        // EpochsManager.Epoch memory epoch = _epochsManager.getEpoch(epochId);
        // if (epoch.startBlock == 0) {
        //     revert TicketEpochNotFound();
        // }

        // if (
        //     generationBlock < epoch.startBlock ||
        //     (epoch.endBlock > 0 && generationBlock >= epoch.endBlock)
        // ) {
        //     revert TicketNotCreatedInTheEpoch();
        // }

        uint256 elapsedDuration = block.number - generationBlock;

        uint128 baseLiveWinProb = 1;
        uint256 ticketDuration = 1;
        uint32 decayRate = 1;

        // Ticket has completely expired
        if (elapsedDuration >= ticketDuration) {
            return 0;
        }

        uint256 maxDecayValue = SyloUtils.percOf(baseLiveWinProb, decayRate);

        // determine the amount of probability that has actually decayed
        // by multiplying the maximum decay value against ratio of the tickets elapsed duration
        // vs the actual ticket duration. The max decay value is calculated from a fraction of a
        // uint128 value so we cannot phantom overflow here
        uint256 decayedProbability = (maxDecayValue * elapsedDuration) / ticketDuration;

        // calculate the remaining probability by subtracting the decayed probability
        // from the base
        return baseLiveWinProb - SafeCast.toUint128(decayedProbability);
    }

    /**
     * @notice Returns the hash of the ticket. Takes all fields in a ticket
     * as inputs to the hash.
     * @return A byte-array representing the hash.
     */
    function getTicketHash(Ticket memory ticket) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    ticket.epochId,
                    ticket.sender,
                    ticket.receiver,
                    ticket.redeemer,
                    ticket.generationBlock,
                    ticket.redeemerCommit
                )
            );
    }

    /**
     * @notice Returns the hash of a multi receiver ticket. Takes all fields in
     * a ticket as inputs to the hash, as well as a specific receiver.
     * @return A byte-array representing the hash.
     */
    function getMultiReceiverTicketHash(
        MultiReceiverTicket memory ticket
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    ticket.epochId,
                    ticket.sender,
                    ticket.redeemer,
                    ticket.generationBlock,
                    ticket.redeemerCommit
                )
            );
    }

    function incrementRewardPool(
        address stakee,
        Deposit storage deposit,
        uint256 amount
    ) internal {
        deposit.escrow = deposit.escrow - amount;

        SafeERC20.safeTransfer(_token, address(_rewardsManager), amount);
        _rewardsManager.incrementRewardPool(stakee, 0 /* TODO */, amount);
    }

    function testerIncrementRewardPool(address node, uint256 cycle, uint256 amount) external {
        _rewardsManager.incrementRewardPool(node, cycle, amount);
    }
}
