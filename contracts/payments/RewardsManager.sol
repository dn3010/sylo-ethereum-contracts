// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../libraries/SyloUtils.sol";

import "../IProtocolTimeManager.sol";
import "../IRegistries.sol";
import "../staking/IStakingOrchestrator.sol";
import "./IRewardsManager.sol";
import "./ITicketing.sol";

contract RewardsManager is IRewardsManager, Initializable, AccessControl {
    /**
     * @notice The only ticketing role given to the ticketing contract
     * to restrict access to the incrementRewardPool function
     */
    bytes32 public constant onlyTicketing = keccak256("ONLY_TICKETING");

    /** ERC20 Sylo token contract.*/
    IERC20 public token;

    /**
     * @notice Registries contract
     */
    IRegistries public registries;

    /**
     * @notice Protocol Time Manager contract
     */
    IProtocolTimeManager public protocolTimeManager;

    /**
     * @notice Staking Orchestrator contract
     */
    IStakingOrchestrator public stakingOrchestrator;

    /**
     * @notice Tracks claims from staker accounts
     */
    mapping(address => mapping(address => mapping(uint256 => bool))) claims;

    /**
     * @notice Tracks reward pools for each reward cycle
     */
    mapping(address => mapping(uint256 => uint256)) rewardPools;

    /**
     * @notice Tracks the nodes unclaimed commission on redeemed tickets
     */
    mapping(address => uint256) unclaimedNodeCommission;

    error TokenAddressCannotBeNil();
    error RegistriesAddressCannotBeNil();
    error TicketingAddressCannotBeNil();
    error ProtocolTimeManagerAddressCannotBeNil();
    error StakingOrchestratorAddressCannotBeNil();
    error CannotIncrementRewardPoolWithZeroAmount();
    error RewardForCycleAlreadyClaimed();
    error CannotGetClaimForUnfinishedCycle();
    error CannotClaimZeroAmount();

    function initialize(
        IERC20 _token,
        IRegistries _registries,
        IProtocolTimeManager _protocolTimeManager,
        ITicketing _ticketing,
        IStakingOrchestrator _stakingOrchestrator
    ) external initializer {
        if (address(_token) == address(0)) {
            revert TokenAddressCannotBeNil();
        }
        if (address(_registries) == address(0)) {
            revert RegistriesAddressCannotBeNil();
        }
        if (address(_protocolTimeManager) == address(0)) {
            revert ProtocolTimeManagerAddressCannotBeNil();
        }
        if (address(_ticketing) == address(0)) {
            revert TicketingAddressCannotBeNil();
        }
        if (address(_stakingOrchestrator) == address(0)) {
            revert StakingOrchestratorAddressCannotBeNil();
        }

        token = _token;
        registries = _registries;
        protocolTimeManager = _protocolTimeManager;
        stakingOrchestrator = _stakingOrchestrator;

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
     * @param amount Increment amount of reward pool
     */
    function incrementRewardPool(address node, uint256 amount) external onlyRole(onlyTicketing) {
        if (amount == 0) {
            revert CannotIncrementRewardPoolWithZeroAmount();
        }

        IProtocolTimeManager.Cycle memory currentCycle = protocolTimeManager.getCurrentCycle();

        uint256 stakersReward = SyloUtils.percOf(amount, registries.getDefaultPayoutPercentage());
        uint256 nodesCommission = amount - stakersReward;
        unclaimedNodeCommission[node] += nodesCommission;
        rewardPools[node][currentCycle.id] += stakersReward;
    }

    /**
     * @notice Gets the reward pool for a node from a specific cycle
     * @param node Address of nodes
     * @param cycle Associated reward pools cycle
     */
    function getRewardPool(address node, uint256 cycle) external view returns (uint256) {
        return rewardPools[node][cycle];
    }

    function getUnclaimedReward(address node, address user, uint256 cycle) external view returns (uint256) {
        return _getUnclaimedReward(node, user, cycle);
    }

    function getUnclaimedRewards(address node, address user, uint256[] calldata cycles) external view returns (uint256[] memory) {
        uint256 [] memory unclaimedRewards = new uint256[](cycles.length);

        for (uint256 i = 0; i < cycles.length; i++) {
            unclaimedRewards[i] = _getUnclaimedReward(node, user, cycles[i]);
        }

        return unclaimedRewards;
    }

    function _getUnclaimedReward(address node, address user, uint256 cycle) internal view returns (uint256) {
        if (claims[node][user][cycle]) {
            return 0;
        }

        return _getClaim(node, user, cycle);
    }

    function getClaim(address node, address user, uint256 cycle) external view returns (uint256) {
        return _getClaim(node, user, cycle);
    }

    function _getClaim(address node, address user, uint256 cycle) internal view returns (uint256) {
        IProtocolTimeManager.Cycle memory currentCycle = protocolTimeManager.getCurrentCycle();

        if (currentCycle.id <= cycle) {
            revert CannotGetClaimForUnfinishedCycle();
        }

        uint256 nodeRewardCycleStake = stakingOrchestrator.getRewardCycleStakeByNode(cycle, node);
        uint256 userRewardCycleStake = stakingOrchestrator.getRewardCycleStakeByUser(
            cycle,
            node,
            user
        );

        if (nodeRewardCycleStake == 0) {
            return 0;
        }

        uint256 claimAmount = (rewardPools[node][cycle] * userRewardCycleStake) /
            nodeRewardCycleStake;

        return claimAmount;
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
        if (claims[node][msg.sender][cycle]) {
            revert RewardForCycleAlreadyClaimed();
        }

        uint256 claimAmount = _getClaim(node, msg.sender, cycle);

        if (msg.sender == node) {
            claimAmount += unclaimedNodeCommission[node];
        }

        if (claimAmount == 0) {
            revert CannotClaimZeroAmount();
        }

        SafeERC20.safeTransfer(token, msg.sender, claimAmount);

        claims[node][msg.sender][cycle] = true;

        if (msg.sender == node) {
            unclaimedNodeCommission[node] = 0;
        }
    }
}
