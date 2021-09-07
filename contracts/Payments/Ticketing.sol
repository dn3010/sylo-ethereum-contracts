// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "../Listings.sol";
import "../Staking/Directory.sol";
import "../ECDSA.sol";
import "../Utils.sol";
import "../Epochs/Manager.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract SyloTicketing is Initializable, OwnableUpgradeable {

    /**
     * The maximum probability value, where probability is represented
     * as an integer between 0 to 2^128 - 1.
     */
    uint128 constant MAX_PROB = type(uint128).max;

    struct Deposit {
        uint256 escrow; // Balance of users escrow
        uint256 penalty; // Balance of users penalty

        uint256 unlockAt; // Block number a user can withdraw their balances
    }

    struct Ticket {
        bytes32 epochId; // The epoch this ticket is associated with
        address sender; // Address of the ticket sender
        address redeemer; // Address of the intended recipient
        uint256 generationBlock; // Block number the ticket was generated
        bytes32 senderCommit; // Hash of the secret random number of the sender
        bytes32 redeemerCommit; // Hash of the secret random number of the redeemder
    }

    /* ERC 20 compatible token we are dealing with */
    IERC20 _token;

    /* Sylo Listings contract */
    Listings _listings;

    /* Sylo Directory contract */
    Directory _directory;

    /* Sylo Epochs Manager.
     * This contract holds various ticketing parameters
     */
    EpochsManager _epochsManager;

    /*
     * The number of blocks a user must wait after calling "unlock"
     * before they can withdraw their funds
     */
    uint256 public unlockDuration;

    /* Mapping of user deposits to their address */
    mapping(address => Deposit) public deposits;

    /* Mapping of ticket hashes, used to check if ticket has been redeemed */
    mapping (bytes32 => bool) public usedTickets;

    struct RewardPool {
        uint256 balance;
        mapping (address => uint256) claims;
    }

    mapping (bytes32 => RewardPool) public rewardPools;

    // TODO define events

    function initialize(
        IERC20 token,
        Listings listings,
        Directory directory,
        EpochsManager epochsManager,
        uint256 _unlockDuration
    ) public initializer {
        OwnableUpgradeable.__Ownable_init();
        _token = token;
        _listings = listings;
        _directory = directory;
        _epochsManager = epochsManager;
        unlockDuration = _unlockDuration;
    }

    function setUnlockDuration(uint256 newUnlockDuration) public onlyOwner {
        unlockDuration = newUnlockDuration;
    }

    function depositEscrow(uint256 amount, address account) public {
        Deposit storage deposit = getDeposit(account);
        require(deposit.unlockAt == 0, "Cannot deposit while unlocking");

        deposit.escrow += amount;

        _token.transferFrom(msg.sender, address(this), amount);
    }

    function depositPenalty(uint256 amount, address account) public {
        Deposit storage deposit = getDeposit(account);
        require(deposit.unlockAt == 0, "Cannot deposit while unlocking");

        deposit.penalty += amount;

        _token.transferFrom(msg.sender, address(this), amount);
    }

    // Unlock deposits, starting the withdrawl process
    function unlockDeposits() public returns (uint256) {

        Deposit storage deposit = getDeposit(msg.sender);
        require(deposit.escrow > 0 || deposit.penalty > 0, "Nothing to withdraw");
        require(deposit.unlockAt == 0, "Unlock already in progress");

        deposit.unlockAt = block.number + unlockDuration;

        return deposit.unlockAt;
    }

    // Cancel the withdrawl process
    function lockDeposits() public {

        Deposit storage deposit = getDeposit(msg.sender);
        require(deposit.unlockAt != 0, "Not unlocking, cannot lock");

        deposit.unlockAt = 0;
    }

    function withdraw() public {
        return withdrawTo(msg.sender);
    }

    // Complete the withdrawl process and withdraw the deposits
    function withdrawTo(address account) public {

        Deposit storage deposit = getDeposit(msg.sender);
        require(deposit.unlockAt > 0, "Deposits not unlocked");
        require(deposit.unlockAt < block.number, "Unlock period not complete");

        uint256 amount = deposit.escrow + deposit.penalty;

        // Set values to 0
        deposit.escrow = 0;
        deposit.penalty = 0;

        // Re-lock so if more funds are deposited they must be unlocked again
        deposit.unlockAt = 0;

        _token.transfer(account, amount);
    }

    function redeem(
        Ticket memory ticket,
        uint256 senderRand,
        uint256 redeemerRand,
        bytes memory sig
    ) public {
        EpochsManager.Epoch memory epoch = _epochsManager.getEpoch(ticket.epochId);
        require(epoch.startBlock > 0, "Ticket's associated epoch does not exist");
        require(
            ticket.generationBlock >= epoch.startBlock &&
                (epoch.endBlock > 0 ? ticket.generationBlock < epoch.endBlock : true),
            "This ticket was not generated during it's associated epoch"
        );

        bytes32 ticketHash = getTicketHash(ticket);

        requireValidWinningTicket(ticket, ticketHash, senderRand, redeemerRand, sig, epoch);

        Listings.Listing memory listing = _listings.getListing(ticket.redeemer);
        require(listing.initialized == true, "Ticket redeemer must have a valid listing");

        usedTickets[ticketHash] = true;

        Directory.Stake[] memory stakes = _directory.getStakes(epoch.directoryId, ticket.redeemer);
        require(stakes.length > 0, "Ticket redeemer must have stake for this epoch");

        rewardRedeemer(epoch, ticket);
    }

    function rewardRedeemer(
        EpochsManager.Epoch memory epoch,
        Ticket memory ticket
    ) internal {
        Deposit storage deposit = getDeposit(ticket.sender);

        if (epoch.faceValue > deposit.escrow) {
            incrementRewardPool(ticket.epochId, ticket.redeemer, deposit, deposit.escrow);
            _token.transfer(address(0x000000000000000000000000000000000000dEaD), deposit.penalty);

            deposit.escrow = 0;
            deposit.penalty = 0;
        } else {
            incrementRewardPool(ticket.epochId, ticket.redeemer, deposit, epoch.faceValue);
        }
    }

    function requireValidWinningTicket(
        Ticket memory ticket,
        bytes32 ticketHash,
        uint256 senderRand,
        uint256 redeemerRand,
        bytes memory sig,
        EpochsManager.Epoch memory epoch
    ) internal view {
        require(ticket.sender != address(0), "Ticket sender is null");
        require(ticket.redeemer != address(0), "Ticket redeemer is null");

        require(!usedTickets[ticketHash], "Ticket already redeemed");

        // validate that the sender's random number has been revealed to
        // the redeemer
        require(
            keccak256(abi.encodePacked(senderRand)) == ticket.senderCommit,
            "Hash of senderRand doesn't match senderRandHash"
        );

        // validate the redeemer has knowledge of the redeemer rand
        require(
            keccak256(abi.encodePacked(redeemerRand)) == ticket.redeemerCommit,
            "Hash of redeemerRand doesn't match redeemerRandHash"
        );

        require(isValidTicketSig(sig, ticket.sender, ticketHash), "Ticket doesn't have a valid signature");

        uint128 remainingProbability = calculateWinningProbability(ticket, epoch);
        require(isWinningTicket(sig, redeemerRand, remainingProbability), "Ticket is not a winner");
    }

    function getDeposit(address account) private view returns (Deposit storage) {
        return deposits[account];
    }

    function isValidTicketSig(
        bytes memory sig,
        address sender,
        bytes32 ticketHash
    ) internal pure returns (bool) {
        return ECDSA.recover(ticketHash, sig) == sender;
    }

    function isWinningTicket(
        bytes memory sig,
        uint256 redeemerRand,
        uint128 winProb
    ) internal pure returns (bool) {
        // bitshift the winProb to a 256 bit value to allow comparison to a 32 byte hash
        uint256 prob = uint256(winProb) << 128 | uint256(winProb);
        return uint256(keccak256(abi.encodePacked(sig, redeemerRand))) < prob;
    }

    function calculateWinningProbability(
        Ticket memory ticket,
        EpochsManager.Epoch memory epoch
    ) public view returns (uint128) {
        uint256 elapsedDuration = block.number - ticket.generationBlock;

        // Ticket has completely expired
        if (elapsedDuration >= epoch.ticketDuration) {
            return 0;
        }

        uint256 maxDecayValue = SyloUtils.percOf(epoch.baseLiveWinProb, epoch.decayRate);

        // determine the amount of probability that has actually decayed
        // by multiplying the maximum decay value against ratio of the tickets elapsed duration
        // vs the actual ticket duration. The max decay value is calculated from a fraction of a
        // uint128 value so we cannot phantom overflow here
        uint256 decayedProbability = maxDecayValue * elapsedDuration / epoch.ticketDuration;

        // calculate the remaining probability by substracting the decayed probability
        // from the base
        return epoch.baseLiveWinProb - uint128(decayedProbability);
    }

    function getTicketHash(Ticket memory ticket) public pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                ticket.epochId,
                ticket.sender,
                ticket.redeemer,
                ticket.generationBlock,
                ticket.senderCommit,
                ticket.redeemerCommit
            )
        );
    }

    function getRewardPoolKey(bytes32 epochId, address stakee) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(epochId, stakee));
    }

    function getRewardPoolTotalBalance(bytes32 epochId, address stakee) public view returns (uint256) {
        return rewardPools[getRewardPoolKey(epochId, stakee)].balance;
    }

    function getRewardPoolClaimAmount(bytes32 epochId, address stakee) public view returns (uint256) {
        EpochsManager.Epoch memory epoch = _epochsManager.getEpoch(epochId);
        require(epoch.startBlock > 0, "Epoch does not exist");

        RewardPool storage rewardPool = rewardPools[getRewardPoolKey(epochId, stakee)];

        // Calculate the amount of reward that has been accumalted since the last time
        // this sender claimed their reward
        uint256 accumalatedReward = rewardPool.balance - rewardPool.claims[msg.sender];

        require(accumalatedReward > 0, "Accumalated reward is 0");

        Directory.Stake[] memory stakes = _directory.getStakes(epoch.directoryId, stakee);

        uint256 totalStake = 0;
        // check if we are a delagated staker here and
        // also tally up the total delegated stake
        bool delegatedStaker = false;
        for (uint i = 0; i < stakes.length; i++) {
            if (stakes[i].staker == msg.sender) {
                delegatedStaker = true;
            }
            totalStake += stakes[i].amount;
        }
        require(delegatedStaker || msg.sender == stakee, "Must be a delegated staker or the stakee to claim rewards");

        require(totalStake > 0, "Ticket redeemer must have stake for this epoch");

        uint256 delegatedStakersPayout = SyloUtils.percOf(
            uint128(accumalatedReward), // we can safely cast the balance to uint128 as all sylos would only be 94 bits
            epoch.defaultPayoutPercentage
        );

        uint256 totalPayout = 0;

        // Calculate the payout for the delegated staker but also track any value lost from
        // rounding down
        uint256 stakersPayoutRemainder = delegatedStakersPayout;
        for (uint i = 0; i < stakes.length; i++) {
            // we calculate the payout for this staker by taking their
            // proporiton of stake against the total stake, and multiplying
            // that against the total reward for the stakers
            uint256 payout = stakes[i].amount * delegatedStakersPayout / totalStake;
            stakersPayoutRemainder -= payout;
            if (stakes[i].staker == msg.sender) {
                totalPayout += payout;

                if (msg.sender != stakee) {
                    break;
                }
            }
        }

        // if the caller is the stakee, then payout the remainder
        if (msg.sender == stakee) {
            totalPayout += accumalatedReward - delegatedStakersPayout;
            totalPayout += stakersPayoutRemainder;
        }

        return totalPayout;
    }

    function incrementRewardPool(bytes32 epochId, address stakee, Deposit storage deposit, uint256 amount) internal {
        require(deposit.escrow >= amount, "Spender does not have enough to transfer to reward");

        deposit.escrow = deposit.escrow - amount;

        bytes32 rewardPoolKey = getRewardPoolKey(epochId, stakee);

        rewardPools[rewardPoolKey].balance += amount;
    }

    function claimReward(bytes32 epochId, address stakee) public {
        RewardPool storage rewardPool = rewardPools[getRewardPoolKey(epochId, stakee)];

        uint256 reward = getRewardPoolClaimAmount(epochId, stakee);

        rewardPool.claims[msg.sender] = rewardPool.balance;

        _token.transfer(msg.sender, reward);
    }
}
