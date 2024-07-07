// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface IStakingOrchestrator {
    function getNodeStake(uint256 cycle, address node) external returns (uint256);

    function getUserStake(uint256 cycle, address node, address user) external returns (uint256);

    function getCurrentNodeStake(address node) external returns (uint256);

    function getCurrentUserStake(address node, address user) external returns (uint256);

    function syloStakeAdded(address node, address user, uint256 amount) external;

    function syloStakeRemoved(address node, address user, uint256 amount) external;

    function seekerStakeAdded(address node, address user, uint256 seekerId) external;

    function seekerStakeRemoved(address node, address user, uint256 seekerId) external;
}


// recalculate node capacity based on attribute coverage * capacity multiplier
        /**
            user A withdrawing seeker stake does *NOT* affect everyone else's
            current stakes.

            amount of stake added by user is capped by their current staking capacity

            withdrawing stake is also determined by their staking capacity.

            Example:

            1250 staking capacity

            1500 currently staked (250 over capacity)

            adjusted stake = 1250 + 250 / 4 = 1312

            User withdraws 1000

            500 current staked (0 over capacity)

            minus 812

            adjusted stake = 500

            Example 2:

            User withdraws 100

            1400 currently staked (150 over capacity)

            adjusted stake = 1250 + 150 / 4 = 1287

            Add Sylo Stake:

            currentStake
            seekerBonusAdjustedStake
            stakingCapacity

            updatedStake = currentStake + amount
            updatedSeekerBonusAdjustedStake =
                if updatedStake > stakingCapacity
                  stakingCapacity + (updatedStake - stakingCapacity) * 0.25
                else
                  updatedStake
            addition = updatedSeekerBonusAdjustedStake - seekerBonusAdjustedStake

            Subtract Sylo Stake:

            currentStake
            seekerBonusAdjustedStake
            stakingCapacity

            updatedStake = currentStake - amount
            updatedSeekerBonusAdjustedStake
                if updatedStake > stakingCapacity
                  stakingCapacity + (updatedStake - stakingCapacity) * 0.25
                else
                  updatedStake
            subtraction = seekerBonusAdjustedStake - updatedSeekerBonusAdjustedStake

            Add Seeker Stake

            currentStake - constant
            stakingCapacity - will update
            seekerBonusAdjustedStake - will update

            algo:

            stakingCapacity = calculateNewStakingCap
            updatedSeekerBonusAdjustedStake
                if currentStake > stakingCapacity
                  stakingCapacity + (updatedStake - stakingCapacity) * 0.25
                else
                  currentStake
            addition = seekerBonusAdjustedStake - updatedSeekerBonusAdjustedStake
            seekerBonusAdjustedStake = updatedSeekerBonusAdjustedStake
         */