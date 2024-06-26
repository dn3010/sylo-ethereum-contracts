// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "./staking/StakingOrchestrator.sol";
import "./ProtocolTimeManager.sol";

import "./IProtocolTimeManager.sol";
import "./IDirectory.sol";

contract Directory is IDirectory, Initializable, Ownable2StepUpgradeable, ERC165 {
    StakingOrchestrator public stakingOrchestrator;
    ProtocolTimeManager public protocolTimeManager;

    /**
     * @notice Tracks each directory, these directories are apart of
     * each staking period for each reward cycle
     */
    mapping(uint256 => mapping(uint256 => Directory)) public directories;

    error CannotInitialiseWithZeroStakingOrchestratorAddress();
    error CannotInitialiseWithZeroProtocolTimeManagerAddress();
    error CannotJoinDirectoryWithZeroStake();
    error StakeeAlreadyJoinedDirectory();

    function initialize(
        StakingOrchestrator _stakingOrchestrator,
        ProtocolTimeManager _protocolTimeManager
    ) external initializer {
        Ownable2StepUpgradeable.__Ownable2Step_init();

        if (address(_stakingOrchestrator) == address(0)) {
            revert CannotInitialiseWithZeroStakingOrchestratorAddress();
        }
        if (address(_protocolTimeManager) == address(0)) {
            revert CannotInitialiseWithZeroProtocolTimeManagerAddress();
        }

        stakingOrchestrator = _stakingOrchestrator;
        protocolTimeManager = _protocolTimeManager;
    }

    /**
     * @notice Returns true if the contract implements the interface defined by
     * `interfaceId` from ERC165.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IDirectory).interfaceId || super.supportsInterface(interfaceId);
    }

    function scan(uint128 point) external view returns (address) {
        uint256 currentStakingPeriod = protocolTimeManager.getCurrentPeriod();
        IProtocolTimeManager.Cycle memory cycle = protocolTimeManager.getCurrentCycle();
        return _scan(point, cycle.iteration, currentStakingPeriod);
    }

    function scanWithTime(
        uint128 point,
        uint256 rewardCycleId,
        uint256 stakingPeriodId
    ) external view returns (address) {
        return _scan(point, rewardCycleId, stakingPeriodId);
    }

    /**
     * @notice Call this to perform a stake-weighted scan to find the Node assigned
     * to the given point of the requested directory (internal).
     * @dev The current implementation will perform a binary search through
     * the directory. This can allow gas costs to be low if this needs to be
     * used in a transaction.
     * @param point The point, which will usually be a hash of a public key.
     * @param rewardCycleId The reward cycle id associated with the directory to scan.
     * @param stakingPeriodId The period id associated with the directory to scan.
     */
    function _scan(
        uint128 point,
        uint256 rewardCycleId,
        uint256 stakingPeriodId
    ) internal view returns (address stakee) {
        uint256 entryLength = directories[rewardCycleId][stakingPeriodId].entries.length;
        if (entryLength == 0) {
            return address(0);
        }
        // Staking all the Sylo would only be 94 bits, so multiplying this with
        // a uint128 cannot overflow a uint256.
        uint256 expectedVal = (directories[rewardCycleId][stakingPeriodId].totalStake *
            uint256(point)) >> 128;
        uint256 left;
        uint256 right = entryLength - 1;
        // perform a binary search through the directory
        uint256 lower;
        uint256 upper;
        uint256 index;
        while (left <= right) {
            index = (left + right) >> 1;
            lower = index == 0
                ? 0
                : directories[rewardCycleId][stakingPeriodId].entries[index - 1].boundary;
            upper = directories[rewardCycleId][stakingPeriodId].entries[index].boundary;
            if (expectedVal >= lower && expectedVal < upper) {
                return directories[rewardCycleId][stakingPeriodId].entries[index].stakee;
            } else if (expectedVal < lower) {
                right = index - 1;
            } else {
                // expectedVal >= upper
                left = index + 1;
            }
        }
    }

    function joinNextDirectory() external {
        IProtocolTimeManager.Cycle memory currentRewardCycle = protocolTimeManager
            .getCurrentCycle();
        uint256 currentStakingPeriod = protocolTimeManager.getCurrentPeriod();

        uint256 nodeStake = stakingOrchestrator.getNodeCurrentStake(msg.sender);
        if (nodeStake == 0) {
            revert CannotJoinDirectoryWithZeroStake();
        }

        if (
            directories[currentRewardCycle.iteration][currentStakingPeriod + 1].stakes[
                msg.sender
            ] > 0
        ) {
            revert StakeeAlreadyJoinedDirectory();
        }

        uint256 stakingPeriod = 0;
        uint256 rewardCycle;
        if (!protocolTimeManager.isFinalStakingPeriod()) {
            stakingPeriod = currentStakingPeriod + 1;
            rewardCycle = currentRewardCycle.iteration;
        } else {
            rewardCycle = currentRewardCycle.iteration + 1;
        }

        uint256 nextBoundary = directories[rewardCycle][stakingPeriod].totalStake + nodeStake;

        directories[rewardCycle][stakingPeriod].entries.push(
            DirectoryEntry(msg.sender, nextBoundary)
        );
        directories[rewardCycle][stakingPeriod].stakes[msg.sender] = nodeStake;
        directories[rewardCycle][stakingPeriod].totalStake = nextBoundary;
    }
}
