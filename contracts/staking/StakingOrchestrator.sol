// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

import "./IStakingOrchestrator.sol";
import "../IProtocolTimeManager.sol";

contract StakingOrchestrator is
    IStakingOrchestrator,
    Initializable,
    Ownable2StepUpgradeable,
    ERC165
{

    /**   sdf  */
    IProtocolTimeManager public protocolTimeManager;

    struct NodeRewardCycleStake {
        uint256 cycle;
        uint256 amount;
    }

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

    // The stake a Node will have for a directory is determined by the total
    // stake supplied by its users at the time of the directory, and also the
    // Seekers staked by the users. We track and update the node's current directory
    // stake whenever the Sylos or Seekers staked to it change.
    mapping(address => uint256) directoryStakes;

    mapping(address => mapping (uint256 => uint256)) cycleStakesByNode;

    // mapping(address => mapping (address => UserRewardCycleStake[])) rewardCycleStakesByUser;

    mapping(address => mapping (address => mapping(uint256 => UserCycleStake))) cycleStakesByUser;
    mapping(address => mapping (address => uint256[])) userCycleStakeUpdates;

    function initialize(IProtocolTimeManager _protocolTimeManager) external initializer {
        Ownable2StepUpgradeable.__Ownable2Step_init();

        protocolTimeManager = _protocolTimeManager;
    }

    function adjustDirectoryStake(address node, address user, uint256 amount) internal {

    }

    function adjustUserCycleStake(address node, address user, uint256 amount, bool isIncrease) internal {
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
            userCycleStake.stakingUpdates.push(UserStakeUpdate(
                block.timestamp,
                amount
            ));
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
        uint256 cycleAdjustedStake = calculateCycleAdjustedStake(cycle, userCycleStake.stakingUpdates);

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

    function initializeUserCycleStake(address node, address user, IProtocolTimeManager.Cycle memory cycle) internal {
        UserCycleStake storage userCycleStake = cycleStakesByUser[node][user][cycle.iteration];

        userCycleStake.cycle = cycle.iteration;

        uint256 totalStake = 0;
        uint256[] storage cycleStakeUpdates = userCycleStakeUpdates[node][user];
        if (cycleStakeUpdates.length > 0) {
            uint256 lastCycleStakeUpdate = cycleStakeUpdates[cycleStakeUpdates.length - 1];
            UserCycleStake storage lastCycleStake = cycleStakesByUser[node][user][lastCycleStakeUpdate];
            totalStake = lastCycleStake.totalStake;
        }

        userCycleStake.totalStake = totalStake;

        // we also make the first staking update amount equal to the
        // total stake the user had for the previous cycle
        userCycleStake.stakingUpdates.push(UserStakeUpdate(
            cycle.start,
            totalStake
        ));

        userCycleStakeUpdates[node][user].push(cycle.iteration);
    }

    function calculateCycleAdjustedStake(IProtocolTimeManager.Cycle memory cycle, UserStakeUpdate[] storage updates) internal returns (uint256) {
        uint256 totalAdjustedStake = 0;

        for (uint256 i = 0; i < updates.length; i++) {
            // for each update, we proportionally adjust the amount based on how
            // far into the cycle the update occurred.
            uint256 amount = updates[i].amount;
            uint256 elapsed = updates[i].updatedAt - cycle.start;
            uint256 adjustedAmount = amount - (elapsed * amount / cycle.duration);
            totalAdjustedStake += adjustedAmount;
        }

        return totalAdjustedStake;
    }


    function getDirectoryStake(address node) external returns (uint256) {
        return 0;
    }

    function getRewardCycleStakeByNode(uint256 cycle, address node) external returns (uint256) {
        return 0;
    }

    function getRewardCycleStakeByUser(uint256 cycle, address node, address user) external returns (uint256) {
        return 0;
    }

    function getNodeStake(uint256 cycle, address node) external returns (uint256) {
        return 0;
    }

    function getUserStake(uint256 cycle, address node, address user) external returns (uint256) {
        revert("not implemented");
    }

    function getCurrentNodeStake(address node) external view returns (uint256) {
    }

    function getCurrentUserStake(address node, address user) external returns (uint256) {
        revert("not implemented");
    }

    function syloStakeAdded(address node, address user, uint256 newAmount) external {
    }

    function syloStakeRemoved(address node, address user, uint256 amount) external {
        revert("not implemented");
    }

    function seekerStakeAdded(address node, address user, uint256 seekerId) external {
        revert("not implemented");
    }

    function seekerStakeRemoved(address node, address user, uint256 seekerId) external {
        revert("not implemented");
    }
}
