// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

import "./IStakingOrchestrator.sol";
import "../IProtocolTimeManager.sol";
import "./seekers/ISeekerStatsOracle.sol";

contract StakingOrchestrator is
    IStakingOrchestrator,
    Initializable,
    Ownable2StepUpgradeable,
    ERC165
{
    IProtocolTimeManager public protocolTimeManager;

    ISeekerStatsOracle public seekerStatsOracle;

    uint256 capacityCoverageMultiplier;

    uint256 capacityPenaltyFactor;

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

    mapping(address => mapping(uint256 => uint256)) cycleStakesByNode;

    mapping(address => mapping(address => mapping(uint256 => UserCycleStake))) cycleStakesByUser;
    mapping(address => mapping(address => uint256[])) userCycleStakeUpdates;

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

    function initialize(IProtocolTimeManager _protocolTimeManager) external initializer {
        Ownable2StepUpgradeable.__Ownable2Step_init();

        protocolTimeManager = _protocolTimeManager;
    }

    function getNodeStake(address node) external returns (uint256) {
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

    function getUserStake(address node, address user) external returns (uint256) {
        return userStakes[node][user].seekerBonusAdjustedStake;
    }

    function getRewardCycleStakeByNode(uint256 cycle, address node) external returns (uint256) {
        return cycleStakesByNode[node][cycle];
    }

    function getRewardCycleStakeByUser(
        uint256 cycle,
        address node,
        address user
    ) external returns (uint256) {
        return cycleStakesByUser[node][user][cycle].cycleAdjustedRewardStake;
    }

    function getUserStake(uint256 cycle, address node, address user) external returns (uint256) {
        revert("not implemented");
    }

    function getCurrentNodeStake(address node) external view returns (uint256) {}

    function getCurrentUserStake(address node, address user) external returns (uint256) {
        revert("not implemented");
    }

    function syloStakeAdded(address node, address user, uint256 amount) external {
        // whenever stake changes for a user, we reconsolidate their staking
        // capacity
        updateUserStakingCapacity(node, user);

        userStakes[node][user].stake += amount;

        processIncreaseInUserSeekerBonusAdjustedStake(node, user);
    }

    function syloStakeRemoved(address node, address user, uint256 amount) external {
        // whenever stake changes for a user, we reconsolidate their staking
        // capacity
        updateUserStakingCapacity(node, user);

        userStakes[node][user].stake -= amount;

        processDecreaseInUserSeekerBonusAdjustedStake(node, user);
    }

    function seekerStakeAdded(address node, address user, uint256 seekerId) external {
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

    function seekerStakeRemoved(address node, address user, uint256 seekerId) external {
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

        userStakes[node][user].stakingCapacity =
            (seekerRankTotalsByUser[node][user] * nodeSeekerTotals.stakingCapacity) /
            nodeSeekerTotals.rank;
    }

    function processIncreaseInUserSeekerBonusAdjustedStake(address node, address user) internal {
        uint256 updatedSeekerBonusAdjustedStake = calculateUserSeekerBonusAdjustedStake(
            node,
            user
        );

        UserStake storage userStake = userStakes[node][user];

        if (updatedSeekerBonusAdjustedStake > userStake.seekerBonusAdjustedStake) {
            uint256 diff = updatedSeekerBonusAdjustedStake - userStake.seekerBonusAdjustedStake;

            seekerBonusAdjustedStakeByNode[node] += diff;
            adjustUserCycleStake(node, user, diff, true);

            userStake.seekerBonusAdjustedStake = updatedSeekerBonusAdjustedStake;
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

            seekerBonusAdjustedStakeByNode[node] -= diff;
            adjustUserCycleStake(node, user, diff, false);

            userStake.seekerBonusAdjustedStake = updatedSeekerBonusAdjustedStake;
        }
    }

    function calculateUserSeekerBonusAdjustedStake(
        address node,
        address user
    ) internal returns (uint256) {
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
        // update the node's directory stake
        // directoryStakes[node] += amount;

        IProtocolTimeManager.Cycle memory cycle = protocolTimeManager.getCurrentCycle();

        UserCycleStake storage userCycleStake = cycleStakesByUser[node][user][cycle.iteration];

        // first instance this user is updating stake this cycle
        if (userCycleStake.cycle == 0) {
            initializeUserCycleStake(node, user, cycle);
        }

        if (isIncrease) {
            userCycleStake.totalStake += amount;
            userCycleStake.stakingUpdates.push(UserStakeUpdate(block.timestamp, amount));
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

                if (i == 0) {
                    break;
                }
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
            cycleStakesByNode[node][cycle.iteration] += diff;
        } else {
            uint256 diff = userCycleStake.cycleAdjustedRewardStake - cycleAdjustedStake;
            cycleStakesByNode[node][cycle.iteration] -= diff;
        }

        userCycleStake.cycleAdjustedRewardStake = cycleAdjustedStake;
    }

    function initializeUserCycleStake(
        address node,
        address user,
        IProtocolTimeManager.Cycle memory cycle
    ) internal {
        UserCycleStake storage userCycleStake = cycleStakesByUser[node][user][cycle.iteration];

        userCycleStake.cycle = cycle.iteration;

        uint256 totalStake = 0;
        uint256[] storage cycleStakeUpdates = userCycleStakeUpdates[node][user];
        if (cycleStakeUpdates.length > 0) {
            uint256 lastCycleStakeUpdate = cycleStakeUpdates[cycleStakeUpdates.length - 1];
            UserCycleStake storage lastCycleStake = cycleStakesByUser[node][user][
                lastCycleStakeUpdate
            ];
            totalStake = lastCycleStake.totalStake;
        }

        userCycleStake.totalStake = totalStake;

        // we also make the first staking update amount equal to the
        // total stake the user had for the previous cycle
        userCycleStake.stakingUpdates.push(UserStakeUpdate(cycle.start, totalStake));

        userCycleStakeUpdates[node][user].push(cycle.iteration);
    }

    function calculateCycleAdjustedStake(
        IProtocolTimeManager.Cycle memory cycle,
        UserStakeUpdate[] storage updates
    ) internal returns (uint256) {
        uint256 totalAdjustedStake = 0;

        for (uint256 i = 0; i < updates.length; i++) {
            // for each update, we proportionally adjust the amount based on how
            // far into the cycle the update occurred.
            uint256 amount = updates[i].amount;
            uint256 elapsed = updates[i].updatedAt - cycle.start;
            uint256 adjustedAmount = amount - ((elapsed * amount) / cycle.duration);
            totalAdjustedStake += adjustedAmount;
        }

        return totalAdjustedStake;
    }
}
