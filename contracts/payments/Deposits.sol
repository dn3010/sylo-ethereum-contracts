// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "./IDeposits.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "../libraries/SyloUtils.sol";

import "./RewardsManager.sol";
import "./Ticketing.sol";

contract Deposits is IDeposits, Initializable, Ownable, AccessControl {
    /**
     * @notice The only ticketing role given to the ticketing contract
     * to restrict access to the deposit management functions
     */
    bytes32 public constant onlyTicketing = keccak256("ONLY_TICKETING");

    /** ERC20 Sylo token contract.*/
    IERC20 public token;

    /** RewardsManager contract */
    RewardsManager public rewardsManager;

    /**
     * @notice The number of blocks a user must wait after calling "unlock"
     * before they can withdraw their funds.
     */
    uint256 public unlockDuration;

    /** @notice Mapping of user deposits */
    mapping(address => Deposit) public deposits;

    event UnlockDurationUpdated(uint256 unlockDuration);

    error TokenAddressCannotBeNil();
    error RewardsManagerAddressCannotBeNil();
    error TicketingAddressCannotBeNil();
    error NoEscrowAndPenalty();
    error UnlockingInProcess();
    error UnlockingNotInProcess();
    error UnlockingNotCompleted();
    error EscrowAmountCannotBeZero();
    error PenaltyAmountCannotBeZero();
    error UnlockDurationCannotBeZero();
    error AccountCannotBeZeroAddress();

    function initialize(
        IERC20 _token,
        RewardsManager _rewardsManager,
        Ticketing _ticketing,
        uint256 _unlockDuration
    ) external initializer {
        if (address(_token) == address(0)) {
            revert TokenAddressCannotBeNil();
        }
        if (address(_rewardsManager) == address(0)) {
            revert RewardsManagerAddressCannotBeNil();
        }
        if (address(_ticketing) == address(0)) {
            revert TicketingAddressCannotBeNil();
        }
        if (_unlockDuration == 0) {
            revert UnlockDurationCannotBeZero();
        }

        token = _token;
        rewardsManager = _rewardsManager;
        unlockDuration = _unlockDuration;

        _grantRole(onlyTicketing, address(_ticketing));
    }

    /**
     * @notice Set the unlock duration for deposits. Only callable
     * by the owner.
     * @param _unlockDuration The unlock duration in blocks.
     */
    function setUnlockDuration(uint256 _unlockDuration) external onlyOwner {
        if (_unlockDuration == 0) {
            revert UnlockDurationCannotBeZero();
        }

        unlockDuration = _unlockDuration;
        emit UnlockDurationUpdated(_unlockDuration);
    }

    /**
     * @notice Retrieve the deposit for the given account.
     * @param account The ethereum account to retrieve the deposit for.
     */
    function getDeposit(address account) external view returns (Deposit memory) {
        return deposits[account];
    }

    /**
     * @notice Use this function to deposit funds into the
     * escrow. This will fail if the deposit is currently being
     * unlocked.
     * @param amount The amount in SOLO to add to the escrow.
     * @param account The address of the account holding the escrow.
     */
    function depositEscrow(uint256 amount, address account) external {
        if (amount == 0) {
            revert EscrowAmountCannotBeZero();
        }
        if (account == address(0)) {
            revert AccountCannotBeZeroAddress();
        }

        Deposit storage deposit = deposits[account];
        if (deposit.unlockAt != 0) {
            revert UnlockingInProcess();
        }

        deposit.escrow = deposit.escrow + amount;

        SafeERC20.safeTransferFrom(token, msg.sender, address(this), amount);
    }

    /**
     * @notice Use this function to deposit funds into the
     * penalty. This will fail if the deposit is currently being
     * unlocked.
     * @param amount The amount in SOLO to add to the escrow.
     * @param account The address of the account holding the penalty.
     */
    function depositPenalty(uint256 amount, address account) external {
        if (amount == 0) {
            revert PenaltyAmountCannotBeZero();
        }
        if (account == address(0)) {
            revert AccountCannotBeZeroAddress();
        }

        Deposit storage deposit = deposits[account];
        if (deposit.unlockAt != 0) {
            revert UnlockingInProcess();
        }

        deposit.penalty = deposit.penalty + amount;

        SafeERC20.safeTransferFrom(token, msg.sender, address(this), amount);
    }

    /**
     * @notice Delete the penalty for a given account
     * @param account The ethereum account to delete penalty for
     */
    function removePenalty(address account) external onlyRole(onlyTicketing) {
        SafeERC20.safeTransfer(
            token,
            address(0x000000000000000000000000000000000000dEaD),
            deposits[account].penalty
        );
        delete deposits[account].penalty;
    }

    /**
     * @notice Delete spend escrow for the given account
     * @param account The ethereum account to spend from
     */
    function spendEscrow(
        address account,
        uint256 amount
    ) external onlyRole(onlyTicketing) returns (uint256) {
        SafeERC20.safeTransfer(token, address(rewardsManager), amount);
        deposits[account].escrow -= amount;
        return deposits[account].escrow;
    }

    /**
     * @notice Call this function to begin unlocking deposits. This function
     * will fail if no deposit exists, or if the unlock process has
     * already begun.
     */
    function unlockDeposits() external returns (uint256) {
        Deposit storage deposit = deposits[msg.sender];

        if (deposit.escrow == 0 && deposit.penalty == 0) {
            revert NoEscrowAndPenalty();
        }
        if (deposit.unlockAt != 0) {
            revert UnlockingInProcess();
        }

        deposit.unlockAt = block.number + unlockDuration;

        return deposit.unlockAt;
    }

    /**
     * @notice Call this function to cancel any deposit that is in the
     * unlocking process.
     */
    function lockDeposits() external {
        Deposit storage deposit = deposits[msg.sender];
        if (deposit.unlockAt == 0) {
            revert UnlockingNotInProcess();
        }

        delete deposit.unlockAt;
    }

    /**
     * @notice Call this function once the unlock duration has
     * elapsed in order to transfer the unlocked tokens to the caller's account.
     */
    function withdraw() external {
        return withdrawTo(msg.sender);
    }

    /**
     * @notice Call this function once the unlock duration has
     * elapsed in order to transfer the unlocked tokens to the specified
     * account.
     * @param account The address of the account the tokens should be
     * transferred to.
     */
    function withdrawTo(address account) public {
        Deposit memory deposit = deposits[msg.sender];
        if (deposit.unlockAt == 0) {
            revert UnlockingNotInProcess();
        }
        if (deposit.unlockAt >= block.number) {
            revert UnlockingNotCompleted();
        }

        uint256 amount = deposit.escrow + deposit.penalty;

        // Reset deposit values to 0
        delete deposits[msg.sender];

        SafeERC20.safeTransfer(token, account, amount);
    }
}
