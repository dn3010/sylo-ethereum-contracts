// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface IDeposits {
    struct Deposit {
        uint256 escrow; // Balance of users escrow
        uint256 penalty; // Balance of users penalty
        uint256 unlockAt; // Block number a user can withdraw their balances
    }

    function setUnlockDuration(uint256 _unlockDuration) external;

    function getDeposit(address account) external view returns (Deposit memory);

    function depositEscrow(uint256 amount, address account) external;

    function depositPenalty(uint256 amount, address account) external;

    function removePenalty(address account) external;

    function spendEscrow(address account, uint256 amount) external returns (uint256);

    function unlockDeposits() external returns (uint256);

    function lockDeposits() external;

    function withdraw() external;
}
