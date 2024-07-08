// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import "../../SyloToken.sol";
import "./ISyloStakingManager.sol";

contract SyloStakingManager is
    ISyloStakingManager,
    Initializable,
    Ownable2StepUpgradeable,
    ERC165
{
    /** IERC20 Sylo Token address */
    IERC20 public _syloToken;

    /**
     * @notice Tracks the managed stake for every Node.
     */
    mapping(address => Stake) public stakes;

    /**
     * @notice Tracks overall total stake held by this contract
     */
    uint256 public totalManagedStake;

    /**
     * @notice The duration in seconds a user must wait after calling "unlock"
     * before they can withdraw their stake
     */
    uint256 public unlockDuration;

    /**
     * @notice Tracks funds that are in the process of being unlocked.
     */
    mapping(address => mapping(address => Unlocking)) public unlockings;

    /** events **/
    event UnlockDurationUpdated(uint256 unlockDuration);

    /** errors **/
    error SyloAddressCannotBeNil();
    error NodeAddressCannotBeNil();
    error UnlockDurationCannotBeZero();
    error CannotStakeZeroAmount();
    error CannotUnlockZeroAmount();
    error CannotCancelUnlockingZeroAmount();
    error CannotUnlockMoreThanStaked(uint256 stakeAmount, uint256 unlockAmount);
    error CannotTransferMoreThanStaked(uint256 stakeAmount, uint256 transferAmount);
    error StakeNotYetUnlocked();

    function initialize(IERC20 syloToken, uint256 _unlockDuration) external initializer {
        if (address(syloToken) == address(0)) {
            revert SyloAddressCannotBeNil();
        }

        Ownable2StepUpgradeable.__Ownable2Step_init();

        _syloToken = syloToken;

        _setUnlockDuration(_unlockDuration);
    }

    /**
     * @notice Returns true if the contract implements the interface defined by
     * `interfaceId` from ERC165.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == type(ISyloStakingManager).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function setUnlockDuration(uint256 _unlockDuration) external onlyOwner {
        _setUnlockDuration(_unlockDuration);
    }

    function _setUnlockDuration(uint256 _unlockDuration) internal {
        if (_unlockDuration == 0) {
            revert UnlockDurationCannotBeZero();
        }

        unlockDuration = _unlockDuration;
        emit UnlockDurationUpdated(_unlockDuration);
    }

    /**
     * @notice Called by stakers to add stake to a given node.
     * This function will fail under the following conditions:
     *   - If the Node address is invalid
     *   - If the stake amount is zero
     * @param node The address of the node.
     * @param amount The amount of stake to add in SOLO.
     */
    function addStake(address node, uint256 amount) external {
        if (node == address(0)) {
            revert NodeAddressCannotBeNil();
        }

        if (amount == 0) {
            revert CannotStakeZeroAmount();
        }

        _addStake(node, amount);

        // update total stake managed by this contract
        totalManagedStake += amount;

        SafeERC20.safeTransferFrom(_syloToken, msg.sender, address(this), amount);
    }

    function _addStake(address node, uint256 amount) internal {
        // update staking entry
        StakeEntry storage stakeEntry = stakes[node].entries[msg.sender];
        stakeEntry.amount += amount;
        stakeEntry.updatedAt = block.timestamp;

        // update total managed stake for this node
        stakes[node].totalManagedStake += amount;
    }

    /**
     * @notice Call this method to begin the unlocking process. Any
     * stake that was already in the unlocking phase will have the specified
     * amount added to it, and its duration refreshed. This function will fail
     * under the following conditions:
     *   - If the Node address is invalid
     *   - If no stake exists for the caller
     *   - If the unlocking amount is zero
     *   - If the unlocking amount is more than what is staked
     * @param node The address of the node.
     * @param amount The amount of stake to unlock in SOLO.
     */
    function unlockStake(address node, uint256 amount) external returns (uint256) {
        if (node == address(0)) {
            revert NodeAddressCannotBeNil();
        }

        if (amount == 0) {
            revert CannotUnlockZeroAmount();
        }

        StakeEntry storage stakeEntry = stakes[node].entries[msg.sender];

        if (stakeEntry.amount < amount) {
            revert CannotUnlockMoreThanStaked(stakeEntry.amount, amount);
        }

        // update staking entry
        stakeEntry.amount -= amount;
        stakeEntry.updatedAt = block.timestamp;

        // update total managed stake for this node
        stakes[node].totalManagedStake -= amount;

        // update total stake managed by this contract
        totalManagedStake -= amount;

        // update unlocking
        Unlocking storage unlocking = unlockings[node][msg.sender];

        uint256 unlockAt = block.timestamp + unlockDuration;

        // refresh the unlocking timestamp, but only in the case where
        // the unlock duration has not been reduced
        if (unlocking.unlockAt < unlockAt) {
            unlocking.unlockAt = unlockAt;
        }

        unlocking.amount += amount;

        return unlockAt;
    }

    /**
     * @notice Call this function to withdraw stake that has finished unlocking.
     * This will fail if the stake has not yet unlocked.
     * @param node The address of the node.
     */
    function withdrawStake(address node) external {
        if (node == address(0)) {
            revert NodeAddressCannotBeNil();
        }

        Unlocking storage unlocking = unlockings[node][msg.sender];

        if (unlocking.unlockAt > block.timestamp) {
            revert StakeNotYetUnlocked();
        }

        uint256 amount = unlocking.amount;

        delete unlockings[node][msg.sender];

        SafeERC20.safeTransfer(_syloToken, msg.sender, amount);
    }

    /**
     * @notice Call this function to cancel any stake that is in the process
     * of unlocking. This will restake the amount that has been cancelled.
     * This function will fail under the following conditions:
     *   - If the Node address is invalid
     *   - If the cancelling amount is zero
     * If the specified amount to cancel is greater than the stake that is
     * currently being unlocked, it will cancel the maximum stake possible.
     * @param node The address of the node.
     * @param amount The amount of unlocking stake to cancel in SOLO.
     */
    function cancelUnlocking(address node, uint256 amount) external {
        if (node == address(0)) {
            revert NodeAddressCannotBeNil();
        }

        if (amount == 0) {
            revert CannotCancelUnlockingZeroAmount();
        }

        Unlocking storage unlocking = unlockings[node][msg.sender];

        if (amount >= unlocking.amount) {
            amount = unlocking.amount;
            delete unlockings[node][msg.sender];
        } else {
            unlocking.amount -= amount;
        }

        _addStake(node, amount);

        // update total stake managed by this contract
        totalManagedStake += amount;
    }

    /**
     * @notice Call this function to transfer existing stake from one node
     * to another, bypassing the usual unlocking requirement.
     * This function will fail under the following conditions:
     *   - If the from or to Node addresses are invalid
     *   - If the transfer amount is greater than the existing stake
     * @param from The address of the node to transfer stake from.
     * @param from The address of the node to transfer stake to.
     * @param amount The amount of stake to transfer in SOLO.
     */
    function transferStake(address from, address to, uint256 amount) external {
        if (from == address(0)) {
            revert NodeAddressCannotBeNil();
        }

        if (to == address(0)) {
            revert NodeAddressCannotBeNil();
        }

        StakeEntry storage stakeEntry = stakes[from].entries[msg.sender];

        if (amount > stakeEntry.amount) {
            revert CannotTransferMoreThanStaked(stakeEntry.amount, amount);
        }

        stakeEntry.amount -= amount;
        stakeEntry.updatedAt = block.timestamp;

        _addStake(to, amount);
    }

    function getManagedStake(
        address node,
        address user
    ) external view returns (StakeEntry memory) {
        return stakes[node].entries[user];
    }

    function getUnlocking(address node, address user) external view returns (Unlocking memory) {
        return unlockings[node][user];
    }

    function getTotalManagedStake() external view returns (uint256) {
        return totalManagedStake;
    }

    function getTotalManagedStakeByNode(address node) external view returns (uint256) {
        return stakes[node].totalManagedStake;
    }
}
