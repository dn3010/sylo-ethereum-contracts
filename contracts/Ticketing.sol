// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import "./ITicketing.sol";
import "./RewardsManager.sol";

contract Ticketing is ITicketing, Ownable2StepUpgradeable, ERC165 {
    /** Registries contract. */
    RewardsManager public rewardsManager;

    error CannotInitializeWithZeroRewardsManager();

    function initialize(RewardsManager _rewardsManager) external initializer {
        Ownable2StepUpgradeable.__Ownable2Step_init();

        if (address(_rewardsManager) == address(0)) {
            revert CannotInitializeWithZeroRewardsManager();
        }

        rewardsManager = _rewardsManager;
    }

    /**
     * @notice Returns true if the contract implements the interface defined by
     * `interfaceId` from ERC165.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(ITicketing).interfaceId || super.supportsInterface(interfaceId);
    }

    function testerIncrementRewardPool(address node, uint256 cycle, uint256 amount) external {
        rewardsManager.incrementRewardPool(node, cycle, amount);
    }
}
