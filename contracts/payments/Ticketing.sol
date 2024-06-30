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
import "./IDeposits.sol";
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

    /** Sylo Depoists contract */
    IDeposits public _deposits;

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

    /** @notice The value of a winning ticket in SOLO. */
    uint256 public faceValue;

    /**
     * @notice The probability of a ticket winning during the start of its lifetime.
     * This is a uint128 value representing the numerator in the probability
     * ratio where 2^128 - 1 is the denominator.
     */
    uint128 public baseLiveWinProb;

    /**
     * @notice The probability of a ticket winning after it has expired.
     * This is a uint128 value representing the numerator in the probability
     * ratio where 2^128 - 1 is the denominator. Note: Redeeming expired
     * tickets is currently not supported.
     */
    uint128 public expiredWinProb;

    /**
     * @notice The length in blocks before a ticket is considered expired.
     * The default initialization value is 80,000. This equates
     * to roughly two weeks (15s per block).
     */
    uint256 public ticketDuration;

    /**
     * @notice A percentage value representing the proportion of the base win
     * probability that will be decayed once a ticket has expired.
     * Example: 80% decayRate indicates that a ticket will decay down to 20% of its
     * base win probability upon reaching the block before its expiry.
     * The value is expressed as a fraction of 100000.
     */
    uint32 public decayRate;

    /** @notice The value of a winning multi-receiver ticket in SOLO.
     * This value was added from an upgrade, so is not present int the initialize
     * method.
     */
    uint256 public multiReceiverFaceValue;

    /** @notice Mapping of ticket hashes, used to check if a ticket has been redeemed */
    mapping(bytes32 => bool) public usedTickets;

    event FaceValueUpdated(uint256 faceValue);
    event BaseLiveWinProbUpdated(uint128 baseLiveWinprob);
    event ExpiredWinProbUpdated(uint128 expiredWinProb);
    event TicketDurationUpdated(uint256 ticketDuration);
    event DecayRateUpdated(uint32 decayRate);
    event MultiReceiverFaceValueUpdated(uint256 multiReceiverFaceValue);

    event SenderPenaltyBurnt(address sender);
    event Redemption(
        uint256 indexed cycle,
        address indexed redeemer,
        address indexed sender,
        address receiver,
        uint256 generationBlock,
        uint256 amount
    );
    event MultiReceiverRedemption(
        uint256 indexed cycle,
        address indexed redeemer,
        address indexed sender,
        address receiver,
        uint256 generationBlock,
        uint256 amount
    );

    error FaceValueCannotBeZero();
    error TicketDurationCannotBeZero();
    error InvalidSigningPermission();
    error SenderCannotUseAttachedAuthorizedAccount();
    error TicketNotWinning();
    error MissingFuturepassAccount(address receiver);
    error TicketAlreadyUsed();
    error TicketEpochNotFound();
    error TicketAlreadyRedeemed();
    error RedeemerCommitMismatch();
    error InvalidSignature();
    error TokenAddressCannotBeNil();
    error TicketCannotBeFromFutureBlock();
    error TicketSenderCannotBeZeroAddress();
    error TicketReceiverCannotBeZeroAddress();
    error TicketRedeemerCannotBeZeroAddress();

    function initialize(
        IERC20 token,
        IDeposits deposits,
        IRegistries registries,
        IRewardsManager rewardsManager,
        IAuthorizedAccounts authorizedAccounts,
        IFuturepassRegistrar futurepassRegistrar,
        uint256 _faceValue,
        uint256 _multiReceiverFaceValue,
        uint128 _baseLiveWinProb,
        uint128 _expiredWinProb,
        uint32 _decayRate,
        uint256 _ticketDuration
    ) external initializer {
        if (address(token) == address(0)) {
            revert TokenAddressCannotBeNil();
        }

        Ownable2StepUpgradeable.__Ownable2Step_init();

        _token = token;
        _deposits = deposits;
        _registries = registries;
        _rewardsManager = rewardsManager;
        _authorizedAccounts = authorizedAccounts;
        _futurepassRegistrar = futurepassRegistrar;

        faceValue = _faceValue;
        multiReceiverFaceValue = _multiReceiverFaceValue;
        baseLiveWinProb = _baseLiveWinProb;
        expiredWinProb = _expiredWinProb;
        decayRate = _decayRate;
        ticketDuration = _ticketDuration;
    }

    /**
     * @notice Returns true if the contract implements the interface defined by
     * `interfaceId` from ERC165.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(ITicketing).interfaceId;
    }

    /**
     * @notice Set the face value for tickets in SOLO. Only callable by
     * the contract owner.
     * @param _faceValue The face value to set in SOLO.
     */
    function setFaceValue(uint256 _faceValue) external onlyOwner {
        if (_faceValue == 0) {
            revert FaceValueCannotBeZero();
        }

        faceValue = _faceValue;
        emit FaceValueUpdated(_faceValue);
    }

    function setMultiReceiverFaceValue(uint256 _multiReceiverFaceValue) external onlyOwner {
        if (_multiReceiverFaceValue == 0) {
            revert FaceValueCannotBeZero();
        }

        multiReceiverFaceValue = _multiReceiverFaceValue;
        emit MultiReceiverFaceValueUpdated(multiReceiverFaceValue);
    }

    /**
     * @notice Set the base live win probability of a ticket. Only callable by
     * the contract owner.
     * @param _baseLiveWinProb The probability represented as a value
     * between 0 to 2**128 - 1.
     */
    function setBaseLiveWinProb(uint128 _baseLiveWinProb) external onlyOwner {
        baseLiveWinProb = _baseLiveWinProb;
        emit BaseLiveWinProbUpdated(_baseLiveWinProb);
    }

    /**
     * @notice Set the expired win probability of a ticket. Only callable by
     * the contract owner.
     * @param _expiredWinProb The probability represented as a value
     * between 0 to 2**128 - 1.
     */
    function setExpiredWinProb(uint128 _expiredWinProb) external onlyOwner {
        expiredWinProb = _expiredWinProb;
        emit ExpiredWinProbUpdated(_expiredWinProb);
    }

    /**
     * @notice Set the decay rate of a ticket. Only callable by the
     * the contract owner.
     * @param _decayRate The decay rate as a percentage, where the
     * denominator is 10000.
     */
    function setDecayRate(uint32 _decayRate) external onlyOwner {
        decayRate = _decayRate;
        emit DecayRateUpdated(_decayRate);
    }

    /**
     * @notice Set the ticket duration of a ticket. Only callable by the
     * contract owner.
     * @param _ticketDuration The duration of a ticket in number of blocks.
     */
    function setTicketDuration(uint256 _ticketDuration) external onlyOwner {
        if (_ticketDuration == 0) {
            revert TicketDurationCannotBeZero();
        }

        ticketDuration = _ticketDuration;
        emit TicketDurationUpdated(_ticketDuration);
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

        _redeem(ticket);
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

        _redeemMultiReceiver(ticket, receiver);
    }

    function _redeem(Ticket calldata ticket) internal {
        uint256 rewardAmount = rewardRedeemer(ticket.cycle, ticket.sender, ticket.redeemer);

        emit Redemption(
            ticket.cycle,
            ticket.redeemer,
            ticket.sender,
            ticket.receiver,
            ticket.generationBlock,
            rewardAmount
        );
    }

    function _redeemMultiReceiver(
        MultiReceiverTicket calldata ticket,
        address receiver
    ) internal {
        uint256 rewardAmount = rewardRedeemer(
            ticket.cycle,
            ticket.sender,
            ticket.redeemer
        );

        emit MultiReceiverRedemption(
            ticket.cycle,
            ticket.redeemer,
            ticket.sender,
            receiver,
            ticket.generationBlock,
            rewardAmount
        );
    }

    function rewardRedeemer(
        uint256 cycle,
        address sender,
        address redeemer
    ) internal returns (uint256) {
        IDeposits.Deposit memory deposit = _deposits.getDeposit(sender);

        uint256 amount;

        if (faceValue > deposit.escrow) {
            amount = deposit.escrow;
            incrementRewardPool(redeemer, cycle, deposit, amount);
            SafeERC20.safeTransferFrom(
                _token,
                address(_deposits),
                address(0x000000000000000000000000000000000000dEaD),
                deposit.penalty
            );

            delete deposit.penalty;
            emit SenderPenaltyBurnt(sender);
        } else {
            amount = faceValue;
            incrementRewardPool(redeemer, cycle, deposit, amount);
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
     * @param generationBlock The generationBlock of the ticket.
     * @param redeemerRand The redeemer random value, generated by the Node prior
     * to performing the event relay.
     * @return True if a ticket is a winner.
     */
    function isWinningTicket(
        bytes memory senderSig,
        bytes memory receiverSig,
        uint256 generationBlock,
        uint256 redeemerRand
    ) public view returns (bool) {
        uint256 winProb = calculateWinningProbability(generationBlock);
        // bitshift the winProb to a 256 bit value to allow comparison to a 32 byte hash
        uint256 prob = (uint256(winProb) << 128) | uint256(winProb);
        return uint256(keccak256(abi.encodePacked(senderSig, receiverSig, redeemerRand))) < prob;
    }

    /**
     * @notice This function calculates the probability of a ticket winning at
     * the block that this function was called. A ticket's winning probability
     * will decay every block since its issuance. The amount of decay will depend
     * on the decay rate parameter of the epoch the ticket was generated in.
     * @param generationBlock The generationBlock of the ticket.
     */
    function calculateWinningProbability(
        uint256 generationBlock
    ) public view returns (uint128) {
        uint256 elapsedDuration = block.number - generationBlock;

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
                    ticket.cycle,
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
                    ticket.cycle,
                    ticket.sender,
                    ticket.redeemer,
                    ticket.generationBlock,
                    ticket.redeemerCommit
                )
            );
    }

    function incrementRewardPool(
        address stakee,
        uint256 cycle,
        IDeposits.Deposit memory deposit,
        uint256 amount
    ) internal {
        deposit.escrow = deposit.escrow - amount;

        SafeERC20.safeTransferFrom(_token, address(_deposits), address(_rewardsManager), amount);
        _rewardsManager.incrementRewardPool(stakee, cycle, amount);
    }

    function testerIncrementRewardPool(address node, uint256 cycle, uint256 amount) external {
        _rewardsManager.incrementRewardPool(node, cycle, amount);
    }
}
