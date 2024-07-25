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
    error NodeAlreadyJoinedDirectory();

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
        (
            IProtocolTimeManager.Cycle memory cycle,
            IProtocolTimeManager.Period memory period
        ) = protocolTimeManager.getTime();
        return _scan(point, cycle.id, period.id);
    }

    function scanWithTime(
        uint128 point,
        uint256 cycleId,
        uint256 periodId
    ) external view returns (address) {
        return _scan(point, cycleId, periodId);
    }

    /**
     * @notice Call this to perform a stake-weighted scan to find the Node assigned
     * to the given point of the requested directory (internal).
     * @dev The current implementation will perform a binary search through
     * the directory. This can allow gas costs to be low if this needs to be
     * used in a transaction.
     * @param point The point, which will usually be a hash of a public key.
     * @param cycleId The reward cycle id associated with the directory to scan.
     * @param periodId The period id associated with the directory to scan.
     */
    function _scan(
        uint128 point,
        uint256 cycleId,
        uint256 periodId
    ) internal view returns (address stakee) {
        uint256 entryLength = directories[cycleId][periodId].entries.length;
        if (entryLength == 0) {
            return address(0);
        }
        // Staking all the Sylo would only be 94 bits, so multiplying this with
        // a uint128 cannot overflow a uint256.
        uint256 expectedVal = (directories[cycleId][periodId].totalStake *
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
                : directories[cycleId][periodId].entries[index - 1].boundary;
            upper = directories[cycleId][periodId].entries[index].boundary;
            if (expectedVal >= lower && expectedVal < upper) {
                return directories[cycleId][periodId].entries[index].stakee;
            } else if (expectedVal < lower) {
                right = index - 1;
            } else {
                // expectedVal >= upper
                left = index + 1;
            }
        }
    }

    function joinNextDirectory() external {
        (
            IProtocolTimeManager.Cycle memory currentRewardCycle,
            IProtocolTimeManager.Period memory currentPeriod
        ) = protocolTimeManager.getTime();

        uint256 nodeStake = stakingOrchestrator.getNodeStake(msg.sender);
        if (nodeStake == 0) {
            revert CannotJoinDirectoryWithZeroStake();
        }

        if (directories[currentRewardCycle.id][currentPeriod.id + 1].stakes[msg.sender] > 0) {
            revert NodeAlreadyJoinedDirectory();
        }

        uint256 stakingPeriod = 0;
        uint256 rewardCycle;
        if (
            !((block.timestamp + currentPeriod.duration) >=
                (currentRewardCycle.start + currentRewardCycle.duration))
        ) {
            stakingPeriod = currentPeriod.id + 1;
            rewardCycle = currentRewardCycle.id;
        } else {
            rewardCycle = currentRewardCycle.id + 1;
        }

        uint256 nextBoundary = directories[rewardCycle][stakingPeriod].totalStake + nodeStake;

        directories[rewardCycle][stakingPeriod].entries.push(
            DirectoryEntry(msg.sender, nextBoundary)
        );
        directories[rewardCycle][stakingPeriod].stakes[msg.sender] = nodeStake;
        directories[rewardCycle][stakingPeriod].totalStake = nextBoundary;
    }

    function getDirectoryStake(uint256 cycleId, uint256 periodId, address node) external view returns (uint256) {
        return directories[cycleId][periodId].stakes[node];
    }
}
