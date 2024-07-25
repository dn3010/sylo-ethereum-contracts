// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./IStakingOrchestrator.sol";
import "../IProtocolTimeManager.sol";
import "./seekers/ISeekerStatsOracle.sol";

/**
 * @notice The Staking Orchestrator is responsible for processing changes to a
 * user's sylo or seeker stake, and ensuring that for each node, and each of the
 * node's users, it keeps up to date their:
 *   - Staking Capacity
 *   - Staking Capacity Adjusted Stake
 *   - Reward Cycle Adjusted Stake
 *
 * It is intended for the SyloStakingManager contract and the
 * SeekerStakingManager contract to report changes to stake via the methods:
 * syloStakeAdded, syloStakeRemoved, seekerStakeAdded and seekerStakeRemoved.
 *
 * ==== Staking Capacity ====
 *
 * Staking capacity refers to the amount of Sylos that can be staked to a node,
 * or staked by an individual user without being penalized. Any stake above the
 * the capacity is divided by the `capacityPenaltyFactor`.

 * A node's staking capacity increases when users stake Seekers to it. The
 * capacity is based on the coverage calculation as the SeekerStatsOracle
 * contract. The attribute inputs to the coverage calculation method are determined
 * from the sum of all Seeker attributes staked towards that node. This contract
 * tracks the attribute sums whenever a change in Seeker stake is reported via
 * `seekerStakeAdded` and `seekerStakeRemoved`. The contract also tracks the
 * total `rank` value for a node, and each users total `rank` combination as
 * well. A users own staking capacity is the proportion of rank they contribute
 * compared to the node's overall rank, multiplied by the node's staking
 * capacity.
 *
 * When changes in Seeker stake are reported, the node's staking capacity is
 * updated, then the user's staking capacity is recalculated after (user's
 * staking capacity depends on the node's staking capacity). However, staking
 * capacities for other users are not adjusted. This means that when "user A"
 * changes seeker stake such that the node's capacity changes, "user B", "user
 * B", "user B" and etc do NOT have their own staking capacities readjusted. A
 * user's staking capacity only changes when they change seeker stake
 * themselves.
 *
 * ==== Staking Capacity Adjusted Stake ====
 *
 * A user's total stake is updated when `syloStakeAdded` and
 * `syloStakeRemoved` are invoked. The node's total stake is also tracked as the
 * sum of all of its users stakes. `Staking Capacity Adjusted Stake` refers to the
 * total stake that has been adjusted when considering staking capacities. We
 * first calculate each user's adjusted stake, then sum the stakes to get the
 * node's total adjusted stake. The node's stake is then modified once more
 * based on the node's staking capacity.
 *
 *   totalNodeStake = sum(userStake0, ...userStakeN)
 *   adjustedNodeStake = minimum(totalNodeStake, nodeStakingCapacity)
 *
 * Adjusted stakes are calculated by taking the minimum of stake and staking
 * capacity, then dividing the remainder by the `capacityPenaltyFactor`
 * parameter, and summing those two values together.
 *  stakingCapacityAdjustedStake = stake < stakingCapacity ? stake :
 *    stakingCapacity + (stake - stakingCapacity) / capacityPenaltyFactor
 *
 * As `staking capacity adjusted stake` is determined by the current staking
 * capacity, whenever the staking capacity changes (via `seekerStakeAdded` and
 * `seekerStakeRemoved`), we also update the adjusted stake as well.
 *
 * ==== Reward Cycle Adjusted Stake ====
 *
 * Rewards are distributed amongst stakes proportionally based on their
 * `stakingCapacityAdjustedStake` values, but also depend on when their stake
 * was updated.
 *
 * An increase in `stakingCapacityAdjustedStake` will be penalized based on how
 * far into the cycle the increase occurred. For example, when stake is
 * increased halfway through the cycle, only half of that stake is considered
 * for reward calculation purposes. When stake is decreased, that decreased gets
 * applied to the most previous increase in stake.
 *
 * Thus changes in stake for a given reward cycle follow First In, First Out
 * principles. The contract tracks changes in a user's
 * `stakingCapacityAdjustedStake` as a stack. Each element in the stack
 * represents an increase in stake, and when that increase occurred. A reduction
 * in stake is applied to the element at the top of the stack, where the
 * increase is reduced by the reduction amount (irregardless of when it
 * occurred). If the reduction amount is greater than the increase amount at the
 * top of the stack, then that element is popped, and the remainder of the
 * reduction is applied to the next element in the stack.
 *
 * Example: [ { updatedAt: 1800, amount: 400 }, // <-- reduction gets applied to
 *   top off stack { updatedAt: 1500, amount: 300 }, { updatedAt: 1000, amount:
 *     500 }, ]
 *
 * To calculate a user's reward cycle adjusted stake, we iterate through the
 * stack, penalize the amount based on when the update occurred, and then sum
 * the amounts to get the final reward cycle adjusted stake. The node's total
 * reward cycle adjusted stake is the sum of all of its user's stakes.
 *
 * As it is possible for a user to not make changes to their stake for an entire
 * cycle, we consider their `rewardCycleAdjustedStake` to be equivalent to their
 * `stakingCapacityAdjustedStake` at the time of that cycle.
 */
contract StakingOrchestrator is IStakingOrchestrator, Initializable, AccessControl {
    /**
     * @notice The only staking manger role given to the sylo and seeker staking
     * manager contracts. The staking manager contracts are responsible for
     * informing the orchestrator of when a user's sylo or seeker stake changes.
     */
    bytes32 public constant onlyStakingManager = keccak256("ONLY_STAKING_MANAGER");

    /**
     * @notice Standard only owner role access.
     */
    bytes32 public constant onlyOwner = keccak256("ONLY_OWNER");

    IProtocolTimeManager public protocolTimeManager;

    ISeekerStatsOracle public seekerStatsOracle;

    uint256 public capacityCoverageMultiplier;

    uint256 public capacityPenaltyFactor;

    struct UserStake {
        // Sum of all staking changes reported via `syloStakeAdded` and
        // `syloStakeRemoved`
        uint256 stake;
        // Staking capacity which gets updated when `seekerStakeAdded` and
        // `seekerStakeRemoved` are called
        uint256 stakingCapacity;
        // Update whenever a change in user's sylo or seeker stake occurs
        uint256 stakingCapacityAdjustedStake;
    }

    mapping(address => mapping(address => UserStake)) userStakes;

    // Each node's adjusted stake value is updated whenever one of its
    // users has a change in staking capacity adjusted stake
    mapping(address => uint256) stakingCapacityAdjustedStakeByNode;

    struct UserCycleAdjustedStake {
        uint256 cycle;
        // Total stake the user has for this cycle. Equivalent to the
        // `stakingCapacityAdjustedStake` at the time of the cycle.
        uint256 currentStakingCapacityAdjustedStake;
        // Track updates to stake as a stack
        UserStakeUpdate[] stakingUpdates;
        // Holds the cycle adjusted stake value from folding over the
        // stakingUpdates array. We need to store this value because the node's
        // `cycle adjusted stake` is determined by summing up all of the individual
        // `user cycle adjusted stake`.
        uint256 cycleAdjustedRewardStake;
    }

    struct UserStakeUpdate {
        uint256 updatedAt; // timestamp increase occurred
        uint256 amount;
    }

    struct NodeCycleAdjustedStake {
        // we need this flag to know if the node's stake was updated this cycle
        bool isUpdated;
        uint256 amount;
    }

    mapping(address => mapping(uint256 => NodeCycleAdjustedStake)) cycleStakesByNode;

    mapping(address => mapping(address => mapping(uint256 => UserCycleAdjustedStake))) cycleStakesByUser;

    struct NodeSeekerTotals {
        uint256 rank;
        uint256 attrReactor;
        uint256 attrCores;
        uint256 attrDurability;
        uint256 attrSensors;
        uint256 attrStorage;
        uint256 attrChip;
        uint256 stakingCapacity;
    }

    mapping(address => NodeSeekerTotals) seekerTotalsByNode;

    mapping(address => mapping(address => uint256)) seekerRankTotalsByUser;

    /** events **/
    event CapacityCoverageMultiplierUpdated(uint256 capacityCoverageMultiplier);
    event CapacityPenaltyFactorUpdated(uint256 capacityPenaltyFactor);

    /** errors **/
    error ProtocolTimeManagerAddressCannotBeNil();
    error SeekerStatsOracleAddressCannotBeNil();

    function initialize(
        IProtocolTimeManager _protocolTimeManager,
        ISeekerStatsOracle _seekerStatsOracle,
        uint256 _capacityCoverageMultiplier,
        uint256 _capacityPenaltyFactor
    ) external initializer {
        if (address(_protocolTimeManager) == address(0)) {
            revert ProtocolTimeManagerAddressCannotBeNil();
        }

        if (address(_seekerStatsOracle) == address(0)) {
            revert SeekerStatsOracleAddressCannotBeNil();
        }

        protocolTimeManager = _protocolTimeManager;
        seekerStatsOracle = _seekerStatsOracle;

        capacityCoverageMultiplier = _capacityCoverageMultiplier;
        capacityPenaltyFactor = _capacityPenaltyFactor;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(onlyOwner, msg.sender);
    }

    function setCapacityCoverageMultiplier(
        uint256 _capacityCoverageMultiplier
    ) external onlyRole(onlyOwner) {
        capacityCoverageMultiplier = _capacityCoverageMultiplier;
        emit CapacityCoverageMultiplierUpdated(capacityCoverageMultiplier);
    }

    function setCapacityPenaltyFactor(
        uint256 _capacityPenaltyFactor
    ) external onlyRole(onlyOwner) {
        capacityPenaltyFactor = _capacityPenaltyFactor;
        emit CapacityPenaltyFactorUpdated(capacityPenaltyFactor);
    }

    function getStakingCapacityByNode(address node) external view returns (uint256) {
        return seekerTotalsByNode[node].stakingCapacity;
    }

    function getStakingCapacityByUser(address node, address user) external view returns (uint256) {
        return userStakes[node][user].stakingCapacity;
    }

    function getNodeStake(address node) external view returns (uint256) {
        uint256 stakingCapacityAdjustedStake = stakingCapacityAdjustedStakeByNode[node];
        uint256 maximumNodeStakingCapacity = seekerTotalsByNode[node].stakingCapacity;

        if (maximumNodeStakingCapacity > stakingCapacityAdjustedStake) {
            return stakingCapacityAdjustedStake;
        } else {
            return
                maximumNodeStakingCapacity +
                (stakingCapacityAdjustedStake - maximumNodeStakingCapacity) /
                capacityPenaltyFactor;
        }
    }

    function getUserStake(address node, address user) external view returns (uint256) {
        return userStakes[node][user].stakingCapacityAdjustedStake;
    }

    function getRewardCycleStakeByNode(
        uint256 cycle,
        address node
    ) external view returns (uint256) {
        return _getRewardCycleStakeByNode(cycle, node);
    }

    function _getRewardCycleStakeByNode(
        uint256 cycle,
        address node
    ) internal view returns (uint256) {
        if (cycle == 0) {
            return 0;
        }

        IProtocolTimeManager.Cycle memory currentCycle = protocolTimeManager.getCurrentCycle();

        if (cycleStakesByNode[node][cycle].isUpdated) {
            return cycleStakesByNode[node][cycle].amount;
        }

        uint256 lastUpdate = 0;
        for (uint256 i = currentCycle.id; i > 0; i--) {
            if (cycleStakesByNode[node][i].isUpdated) {
                lastUpdate = i;
                break;
            }
        }

        if (lastUpdate < cycle) {
            return stakingCapacityAdjustedStakeByNode[node];
        }

        uint256 cycleRewardStake = 0;

        for (uint256 i = cycle - 1; i > 0; --i) {
            if (cycleStakesByNode[node][i].isUpdated) {
                cycleRewardStake = cycleStakesByNode[node][i].amount;
                break;
            }
        }

        return cycleRewardStake;
    }

    function getRewardCycleStakeByUser(
        uint256 cycle,
        address node,
        address user
    ) external view returns (uint256) {
        return _getRewardCycleStakeByUser(cycle, node, user);
    }

    function _getRewardCycleStakeByUser(
        uint256 cycle,
        address node,
        address user
    ) internal view returns (uint256) {
        if (cycle == 0) {
            return 0;
        }

        // the user updated their stake for the cycle to query, so we use
        // that cycle's adjusted rewarded stake
        if (cycleStakesByUser[node][user][cycle].cycle > 0) {
            return cycleStakesByUser[node][user][cycle].cycleAdjustedRewardStake;
        }

        uint256 cycleRewardStake = 0;

        // if the user has not updated their stake for the cycle to query, then we
        // need to work backwards to determine when the user last updated
        // their stake, and use the user's total stake for that cycle to determine
        // the current cycle's stake
        for (uint256 i = cycle - 1; i > 0; --i) {
            UserCycleAdjustedStake storage userCycleStake = cycleStakesByUser[node][user][i];
            // we have the most previous cycle where the user updated their stake
            if (userCycleStake.cycle > 0) {
                cycleRewardStake = userCycleStake.currentStakingCapacityAdjustedStake;
                break;
            }
        }

        return cycleRewardStake;
    }

    function syloStakeAdded(
        address node,
        address user,
        uint256 amount
    ) external onlyRole(onlyStakingManager) {
        UserStake storage userStake = userStakes[node][user];

        // whenever stake changes for a user, we reconsolidate their staking
        // capacity
        updateUserStakingCapacity(node, user, userStake);

        userStake.stake += amount;

        processIncreaseInUserSeekerPenaltyAdjustedStake(node, user, userStake);
    }

    function syloStakeRemoved(
        address node,
        address user,
        uint256 amount
    ) external onlyRole(onlyStakingManager) {
        UserStake storage userStake = userStakes[node][user];

        // whenever stake changes for a user, we reconsolidate their staking
        // capacity
        updateUserStakingCapacity(node, user, userStake);

        userStake.stake -= amount;

        processDecreaseInUserSeekerPenaltyAdjustedStake(node, user, userStake);
    }

    function seekerStakeAdded(
        address node,
        address user,
        uint256 seekerId
    ) external onlyRole(onlyStakingManager) {
        ISeekerStatsOracle.Seeker memory stats = seekerStatsOracle.getSeekerStats(seekerId);

        NodeSeekerTotals storage nodeSeekerTotals = seekerTotalsByNode[node];
        nodeSeekerTotals.rank += stats.rank;
        nodeSeekerTotals.attrReactor += stats.attrReactor;
        nodeSeekerTotals.attrCores += stats.attrCores;
        nodeSeekerTotals.attrDurability += stats.attrDurability;
        nodeSeekerTotals.attrSensors += stats.attrSensors;
        nodeSeekerTotals.attrStorage += stats.attrStorage;
        nodeSeekerTotals.attrChip += stats.attrChip;

        updateNodeStakingCapacity(nodeSeekerTotals);

        seekerRankTotalsByUser[node][user] += stats.rank;

        UserStake storage userStake = userStakes[node][user];

        updateUserStakingCapacity(node, user, userStake);

        processIncreaseInUserSeekerPenaltyAdjustedStake(node, user, userStake);
    }

    function seekerStakeRemoved(
        address node,
        address user,
        uint256 seekerId
    ) external onlyRole(onlyStakingManager) {
        ISeekerStatsOracle.Seeker memory stats = seekerStatsOracle.getSeekerStats(seekerId);

        NodeSeekerTotals storage nodeSeekerTotals = seekerTotalsByNode[node];
        nodeSeekerTotals.rank -= stats.rank;
        nodeSeekerTotals.attrReactor -= stats.attrReactor;
        nodeSeekerTotals.attrCores -= stats.attrCores;
        nodeSeekerTotals.attrDurability -= stats.attrDurability;
        nodeSeekerTotals.attrSensors -= stats.attrSensors;
        nodeSeekerTotals.attrStorage -= stats.attrStorage;
        nodeSeekerTotals.attrChip -= stats.attrChip;

        updateNodeStakingCapacity(nodeSeekerTotals);

        seekerRankTotalsByUser[node][user] -= stats.rank;

        UserStake storage userStake = userStakes[node][user];

        updateUserStakingCapacity(node, user, userStake);

        processDecreaseInUserSeekerPenaltyAdjustedStake(node, user, userStake);
    }

    function updateNodeStakingCapacity(NodeSeekerTotals storage nodeSeekerTotals) internal {
        int256 coverage = seekerStatsOracle.calculateAttributeCoverage(
            nodeSeekerTotals.attrReactor,
            nodeSeekerTotals.attrCores,
            nodeSeekerTotals.attrDurability,
            nodeSeekerTotals.attrSensors,
            nodeSeekerTotals.attrStorage,
            nodeSeekerTotals.attrChip
        );

        nodeSeekerTotals.stakingCapacity =
            SafeCast.toUint256(coverage) *
            capacityCoverageMultiplier;
    }

    function updateUserStakingCapacity(
        address node,
        address user,
        UserStake storage userStake
    ) internal {
        NodeSeekerTotals storage nodeSeekerTotals = seekerTotalsByNode[node];

        if (nodeSeekerTotals.stakingCapacity == 0) {
            userStake.stakingCapacity = 0;
        } else {
            userStake.stakingCapacity =
                (seekerRankTotalsByUser[node][user] * nodeSeekerTotals.stakingCapacity) /
                nodeSeekerTotals.rank;
        }
    }

    function processIncreaseInUserSeekerPenaltyAdjustedStake(
        address node,
        address user,
        UserStake storage userStake
    ) internal {
        uint256 updatedSeekerPenaltyAdjustedStake = calculateUserSeekerPenaltyAdjustedStake(
            userStake
        );

        if (updatedSeekerPenaltyAdjustedStake > userStake.stakingCapacityAdjustedStake) {
            uint256 diff = updatedSeekerPenaltyAdjustedStake -
                userStake.stakingCapacityAdjustedStake;

            userStake.stakingCapacityAdjustedStake = updatedSeekerPenaltyAdjustedStake;
            adjustUserCycleAdjustedStake(node, user, diff, true);

            stakingCapacityAdjustedStakeByNode[node] += diff;
        }
    }

    function processDecreaseInUserSeekerPenaltyAdjustedStake(
        address node,
        address user,
        UserStake storage userStake
    ) internal {
        uint256 updatedSeekerPenaltyAdjustedStake = calculateUserSeekerPenaltyAdjustedStake(
            userStake
        );

        if (updatedSeekerPenaltyAdjustedStake < userStake.stakingCapacityAdjustedStake) {
            uint256 diff = userStake.stakingCapacityAdjustedStake -
                updatedSeekerPenaltyAdjustedStake;

            userStake.stakingCapacityAdjustedStake = updatedSeekerPenaltyAdjustedStake;
            adjustUserCycleAdjustedStake(node, user, diff, false);

            stakingCapacityAdjustedStakeByNode[node] -= diff;
        }
    }

    function calculateUserSeekerPenaltyAdjustedStake(
        UserStake memory userStake
    ) internal view returns (uint256) {
        if (userStake.stake > userStake.stakingCapacity) {
            return
                userStake.stakingCapacity +
                (userStake.stake - userStake.stakingCapacity) /
                capacityPenaltyFactor;
        } else {
            return userStake.stake;
        }
    }

    function adjustUserCycleAdjustedStake(
        address node,
        address user,
        uint256 amount,
        bool isIncrease
    ) internal {
        IProtocolTimeManager.Cycle memory cycle = IProtocolTimeManager.Cycle(0, 0, 0);
        uint256 timestamp = block.timestamp;
        uint256 protocolStart = protocolTimeManager.getStart();
        if (protocolStart > block.timestamp) {
            cycle.id = 1;
            cycle.start = protocolStart;
            // duration just needs to be non-zero to prevent division by zero
            cycle.duration = 1;
            timestamp = 0;
        } else {
            cycle = protocolTimeManager.getCurrentCycle();
        }

        NodeCycleAdjustedStake storage nodeCycleStake = cycleStakesByNode[node][cycle.id];

        // first time the node's stake is being updated this cycle
        if (!nodeCycleStake.isUpdated) {
            nodeCycleStake.isUpdated = true;

            // we set the initial cycle stake amount to the node's
            // seeker penalty adjusted stake (before cycle adjustment)
            nodeCycleStake.amount = stakingCapacityAdjustedStakeByNode[node];

            // If there are cycles where the node's stake has not been updated,
            // we have to backfill the cycle immediately after the last cycle
            // it was updated. This is to ensure the `getRewardCycleStakeByNode`
            // calculation remains accurate for every cycle as the node's stake changes.
            for (uint256 i = cycle.id - 1; i > 0; --i) {
                NodeCycleAdjustedStake storage previousCycleStake = cycleStakesByNode[node][i];

                if (!previousCycleStake.isUpdated) {
                    if (cycleStakesByNode[node][i - 1].isUpdated) {
                        previousCycleStake.isUpdated = true;
                        previousCycleStake.amount = nodeCycleStake.amount;
                        break;
                    }
                } else {
                    break;
                }
            }
        }

        UserCycleAdjustedStake storage userCycleStake = cycleStakesByUser[node][user][cycle.id];

        // first instance this user is updating stake this cycle
        if (userCycleStake.cycle == 0) {
            initializeUserCycleAdjustedStake(node, user, cycle);
        }

        if (isIncrease) {
            userCycleStake.currentStakingCapacityAdjustedStake += amount;
            userCycleStake.stakingUpdates.push(UserStakeUpdate(timestamp, amount));
        } else {
            userCycleStake.currentStakingCapacityAdjustedStake -= amount;
            uint256 stakeToSubtract = amount;
            uint256 i = userCycleStake.stakingUpdates.length - 1;
            while (i >= 0) {
                uint256 updateAmount = userCycleStake.stakingUpdates[i].amount;
                if (updateAmount <= stakeToSubtract) {
                    userCycleStake.stakingUpdates.pop();
                    stakeToSubtract -= updateAmount;
                } else {
                    userCycleStake.stakingUpdates[i].amount -= stakeToSubtract;
                    break;
                }

                i--;
            }
        }

        // recalculate the cycle adjusted stake
        uint256 cycleAdjustedStake = calculateCycleAdjustedStake(
            cycle,
            userCycleStake.stakingUpdates
        );

        // calculate the difference and update the node's cycle adjusted stake
        if (cycleAdjustedStake >= userCycleStake.cycleAdjustedRewardStake) {
            uint256 diff = cycleAdjustedStake - userCycleStake.cycleAdjustedRewardStake;
            nodeCycleStake.amount += diff;
        } else {
            uint256 diff = userCycleStake.cycleAdjustedRewardStake - cycleAdjustedStake;
            nodeCycleStake.amount -= diff;
        }

        userCycleStake.cycleAdjustedRewardStake = cycleAdjustedStake;
    }

    function initializeUserCycleAdjustedStake(
        address node,
        address user,
        IProtocolTimeManager.Cycle memory cycle
    ) internal {
        UserCycleAdjustedStake storage userCycleStake = cycleStakesByUser[node][user][cycle.id];

        userCycleStake.currentStakingCapacityAdjustedStake = _getRewardCycleStakeByUser(
            cycle.id,
            node,
            user
        );

        userCycleStake.cycle = cycle.id;

        // we also make the first staking update amount equal to the
        // user's current total stake
        userCycleStake.stakingUpdates.push(
            UserStakeUpdate(0, userCycleStake.currentStakingCapacityAdjustedStake)
        );

        userCycleStake.cycleAdjustedRewardStake = calculateCycleAdjustedStake(
            cycle,
            userCycleStake.stakingUpdates
        );
    }

    function calculateCycleAdjustedStake(
        IProtocolTimeManager.Cycle memory cycle,
        UserStakeUpdate[] storage updates
    ) internal view returns (uint256) {
        uint256 totalAdjustedStake = 0;

        for (uint256 i = 0; i < updates.length; i++) {
            // for each update, we proportionally adjust the amount based on how
            // far into the cycle the update occurred.
            uint256 amount = updates[i].amount;
            uint256 elapsed = 0;
            if (updates[i].updatedAt > cycle.start) {
                elapsed = updates[i].updatedAt - cycle.start;
            }

            uint256 adjustedAmount = amount - ((elapsed * amount) / cycle.duration);
            totalAdjustedStake += adjustedAmount;
        }

        return totalAdjustedStake;
    }
}
