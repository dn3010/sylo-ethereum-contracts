// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./libraries/SyloUtils.sol";

import "./IRewardsManager.sol";
import "../Registries.sol";
import "./Ticketing.sol";
import "./ITicketing.sol";

contract RewardsManager is IRewardsManager, Initializable, AccessControl {
    /**
     * @notice The only ticketing role given to the ticketing contract
     * to restrict access to the incrementRewardPool function
     */
    bytes32 public constant onlyTicketing = keccak256("ONLY_TICKETING");

    /**
     * @notice Registries contract
     */
    Registries public registries;

    /**
     * @notice Tracks claims from staker accounts
     */
    mapping(address => mapping(address => uint256)) claims;

    /**
     * @notice Tracks reward pools for each reward cycle
     */
    mapping(address => mapping(uint256 => uint256)) rewardPools;

    /**
     * @notice Tracks the nodes unclaimed commission on redeemed tickets
     */
    mapping(address => uint256) unclaimedNodeCommission;

    error RegistriesAddressCannotBeNil();
    error TicketingAddressCannotBeNil();
    error CannotIncrementRewardPoolWithZeroNodeAddress();
    error CannotIncrementRewardPoolWithZeroAmount();
    error CannotInitializeWithNonTicketing();

    function initialize(Registries _registries, Ticketing _ticketing) external initializer {
        if (address(_registries) == address(0)) {
            revert RegistriesAddressCannotBeNil();
        }
        if (address(_ticketing) == address(0)) {
            revert TicketingAddressCannotBeNil();
        }
        if (!ERC165(address(_ticketing)).supportsInterface(type(ITicketing).interfaceId)) {
            revert CannotInitializeWithNonTicketing();
        }

        registries = _registries;

        _grantRole(onlyTicketing, address(_ticketing));
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Returns true if the contract implements the interface defined by
     * `interfaceId` from ERC165.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == type(IRewardsManager).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @notice Increments a nodes reward pool. Callable only by the ticketing
     * contract when redeeming a ticket.
     * @param node Address of the node
     * @param cycle Current reward cycle
     * @param amount Increment amount of reward pool
     */
    function incrementRewardPool(
        address node,
        uint256 cycle,
        uint256 amount
    ) external onlyRole(onlyTicketing) {
        if (amount == 0) {
            revert CannotIncrementRewardPoolWithZeroAmount();
        }

        uint256 stakersReward = SyloUtils.percOf(amount, registries.defaultPayoutPercentage());
        uint256 nodesCommission = amount - stakersReward;
        unclaimedNodeCommission[node] += nodesCommission;
        rewardPools[node][cycle] += stakersReward;
    }

    /**
     * @notice Gets the reward pool for a node from a specific cycle
     * @param node Address of nodes
     * @param cycle Associated reward pools cycle
     */
    function getRewardPool(address node, uint256 cycle) external view returns (uint256) {
        return rewardPools[node][cycle];
    }

    /**
     * @notice Sums the nodes reward pools over the given cycles.
     * Returning the stakers reward over multiple cycles.
     * @param node Address of nodes
     * @param cycles Associated reward pools cycles
     */
    function getRewardPools(
        address node,
        uint256[] calldata cycles
    ) external view returns (uint256[] memory) {
        uint256[] memory rewards = new uint256[](cycles.length);
        for (uint i = 0; i < cycles.length; i++) {
            rewards[i] = rewardPools[node][cycles[i]];
        }
        return rewards;
    }

    /**
     * @notice Get the unclaimed node commission from ticket redemptions
     * @param node Address of node
     */
    function getUnclaimedNodeCommission(address node) external view returns (uint256) {
        return unclaimedNodeCommission[node];
    }

    /**
     * @notice Claims outstanding rewards
     * @param node Address of node
     * @param cycle Reward cycle to claim reward from
     */
    function claim(address node, uint256 cycle) external {
        revert("not implemented");
    }
}
