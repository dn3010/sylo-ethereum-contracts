// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

import "./IStakingOrchestrator.sol";
import "../IProtocolTimeManager.sol";
import "./seekers/ISeekerStatsOracle.sol";

import "hardhat/console.sol";

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
        uint256 stake;
        uint256 stakingCapacity;
        uint256 seekerBonusAdjustedStake;
    }

    mapping(address => mapping(address => UserStake)) userStakes;

    mapping(address => uint256) seekerBonusAdjustedStakeByNode;

    struct UserCycleStake {
        uint256 cycle;
        // Total stake the user has for this cycle
        uint256 totalStake;
        // Used to determine the user's stake for reward cycle calculations
        UserStakeUpdate[] stakingUpdates;
        // Holds the cycle adjusted stake value from folding over the
        // stakingUpdates array. We store this value as the node's cycle adjusted
        // stake is determined by summing up all of its user's cycle stakes.
        uint256 cycleAdjustedRewardStake;
    }

    struct UserStakeUpdate {
        uint256 updatedAt; // timestamp increase occurred
        uint256 amount;
    }

    struct NodeCycleStake {
        // we need this flag to know if the node's stake was updated this cycle
        bool isUpdated;
        uint256 amount;
    }

    mapping(address => mapping(uint256 => NodeCycleStake)) cycleStakesByNode;

    mapping(address => mapping(address => mapping(uint256 => UserCycleStake))) cycleStakesByUser;

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

    event CapacityCoverageMultiplierUpdated(uint256 capacityCoverageMultiplier);
    event CapacityPenaltyFactorUpdated(uint256 capacityPenaltyFactor);

    function initialize(
        IProtocolTimeManager _protocolTimeManager,
        ISeekerStatsOracle _seekerStatsOracle,
        uint256 _capacityCoverageMultiplier,
        uint256 _capacityPenaltyFactor
    ) external initializer {
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
        uint256 seekerBonusAdjustedStake = seekerBonusAdjustedStakeByNode[node];
        uint256 maximumNodeStakingCapacity = seekerTotalsByNode[node].stakingCapacity;

        if (maximumNodeStakingCapacity > seekerBonusAdjustedStake) {
            return seekerBonusAdjustedStake;
        } else {
            return
                maximumNodeStakingCapacity +
                (seekerBonusAdjustedStake - maximumNodeStakingCapacity) /
                capacityPenaltyFactor;
        }
    }

    function getUserStake(address node, address user) external view returns (uint256) {
        return userStakes[node][user].seekerBonusAdjustedStake;
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
        for (uint256 i = currentCycle.iteration; i > 0; i--) {
            if (cycleStakesByNode[node][i].isUpdated) {
                lastUpdate = i;
                break;
            }
        }

        if (lastUpdate < cycle) {
            return seekerBonusAdjustedStakeByNode[node];
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
            UserCycleStake storage userCycleStake = cycleStakesByUser[node][user][i];
            // we have the most previous cycle where the user updated their stake
            if (userCycleStake.cycle > 0) {
                cycleRewardStake = userCycleStake.totalStake;
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
        // whenever stake changes for a user, we reconsolidate their staking
        // capacity
        updateUserStakingCapacity(node, user);

        userStakes[node][user].stake += amount;

        processIncreaseInUserSeekerBonusAdjustedStake(node, user);
    }

    function syloStakeRemoved(
        address node,
        address user,
        uint256 amount
    ) external onlyRole(onlyStakingManager) {
        // whenever stake changes for a user, we reconsolidate their staking
        // capacity
        updateUserStakingCapacity(node, user);

        userStakes[node][user].stake -= amount;

        processDecreaseInUserSeekerBonusAdjustedStake(node, user);
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

        updateNodeStakingCapacity(node);

        seekerRankTotalsByUser[node][user] += stats.rank;

        updateUserStakingCapacity(node, user);

        processIncreaseInUserSeekerBonusAdjustedStake(node, user);
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

        updateNodeStakingCapacity(node);

        seekerRankTotalsByUser[node][user] -= stats.rank;

        updateUserStakingCapacity(node, user);

        processDecreaseInUserSeekerBonusAdjustedStake(node, user);
    }

    function updateNodeStakingCapacity(address node) internal {
        NodeSeekerTotals storage nodeSeekerTotals = seekerTotalsByNode[node];

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

    function updateUserStakingCapacity(address node, address user) internal {
        NodeSeekerTotals storage nodeSeekerTotals = seekerTotalsByNode[node];

        if (nodeSeekerTotals.stakingCapacity == 0) {
            userStakes[node][user].stakingCapacity = 0;
        } else {
            userStakes[node][user].stakingCapacity =
                (seekerRankTotalsByUser[node][user] * nodeSeekerTotals.stakingCapacity) /
                nodeSeekerTotals.rank;
        }
    }

    function processIncreaseInUserSeekerBonusAdjustedStake(address node, address user) internal {
        uint256 updatedSeekerBonusAdjustedStake = calculateUserSeekerBonusAdjustedStake(
            node,
            user
        );

        UserStake storage userStake = userStakes[node][user];

        if (updatedSeekerBonusAdjustedStake > userStake.seekerBonusAdjustedStake) {
            uint256 diff = updatedSeekerBonusAdjustedStake - userStake.seekerBonusAdjustedStake;

            userStake.seekerBonusAdjustedStake = updatedSeekerBonusAdjustedStake;
            adjustUserCycleStake(node, user, diff, true);

            seekerBonusAdjustedStakeByNode[node] += diff;
        }
    }

    function processDecreaseInUserSeekerBonusAdjustedStake(address node, address user) internal {
        uint256 updatedSeekerBonusAdjustedStake = calculateUserSeekerBonusAdjustedStake(
            node,
            user
        );

        UserStake storage userStake = userStakes[node][user];

        if (updatedSeekerBonusAdjustedStake < userStake.seekerBonusAdjustedStake) {
            uint256 diff = userStake.seekerBonusAdjustedStake - updatedSeekerBonusAdjustedStake;

            userStake.seekerBonusAdjustedStake = updatedSeekerBonusAdjustedStake;
            adjustUserCycleStake(node, user, diff, false);

            seekerBonusAdjustedStakeByNode[node] -= diff;
        }
    }

    function calculateUserSeekerBonusAdjustedStake(
        address node,
        address user
    ) internal view returns (uint256) {
        UserStake storage userStake = userStakes[node][user];

        if (userStake.stake > userStake.stakingCapacity) {
            return
                userStake.stakingCapacity +
                (userStake.stake - userStake.stakingCapacity) /
                capacityPenaltyFactor;
        } else {
            return userStake.stake;
        }
    }

    function adjustUserCycleStake(
        address node,
        address user,
        uint256 amount,
        bool isIncrease
    ) internal {
        IProtocolTimeManager.Cycle memory cycle = IProtocolTimeManager.Cycle(0, 0, 0);
        uint256 timestamp = block.timestamp;
        uint256 protocolStart = protocolTimeManager.getStart();
        if (protocolStart > block.timestamp) {
            cycle.iteration = 1;
            cycle.start = protocolStart;
            // duration just needs to be non-zero to prevent division by zero
            cycle.duration = 1;
            timestamp = 0;
        } else {
            cycle = protocolTimeManager.getCurrentCycle();
        }

        NodeCycleStake storage nodeCycleStake = cycleStakesByNode[node][cycle.iteration];

        // first time the node's stake is being updated this cycle
        if (!nodeCycleStake.isUpdated) {
            nodeCycleStake.isUpdated = true;

            // we set the initial cycle stake amount to the node's
            // seeker bonus adjusted stake (before cycle adjustment)
            nodeCycleStake.amount = seekerBonusAdjustedStakeByNode[node];

            // If there are cycles where the node's stake has not been updated,
            // we have to backfill the cycle immediately after the last cycle
            // it was updated. This is to ensure the `getRewardCycleStakeByNode`
            // calculation remains accurate for every cycle as the node's stake changes.
            for (uint256 i = cycle.iteration - 1; i > 0; --i) {
                NodeCycleStake storage previousCycleStake = cycleStakesByNode[node][i];

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

        UserCycleStake storage userCycleStake = cycleStakesByUser[node][user][cycle.iteration];

        // first instance this user is updating stake this cycle
        if (userCycleStake.cycle == 0) {
            initializeUserCycleStake(node, user, cycle);
        }

        if (isIncrease) {
            userCycleStake.totalStake += amount;
            userCycleStake.stakingUpdates.push(UserStakeUpdate(timestamp, amount));
        } else {
            userCycleStake.totalStake -= amount;
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

    function initializeUserCycleStake(
        address node,
        address user,
        IProtocolTimeManager.Cycle memory cycle
    ) internal {
        UserCycleStake storage userCycleStake = cycleStakesByUser[node][user][cycle.iteration];

        userCycleStake.totalStake = _getRewardCycleStakeByUser(cycle.iteration, node, user);

        userCycleStake.cycle = cycle.iteration;

        // we also make the first staking update amount equal to the
        // user's current total stake
        userCycleStake.stakingUpdates.push(UserStakeUpdate(0, userCycleStake.totalStake));

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
