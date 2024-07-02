// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import "./IProtocolTimeManager.sol";

contract ProtocolTimeManager is
    IProtocolTimeManager,
    Initializable,
    Ownable2StepUpgradeable,
    ERC165
{
    struct CycleDurationUpdate {
        uint256 duration;
        // The unix timestamp this update becomes effective (takes effect at
        // the start of the next cycle
        uint256 updatesAt;
    }

    struct PeriodDurationUpdate {
        uint256 duration;
        // The cycle this duration becomes effective
        uint256 updatesAt;
    }

    /**
     * @notice Holds the unix timestamp for when the protocol starts
     */
    uint256 start;

    /**
     * @notice Updates to the cycle duration are stored as an array. We
     * fold over the array to determine the current cycle and duration.
     */
    CycleDurationUpdate[] cycleDurationUpdates;

    /**
     * @notice Updates to the period duration are stored as an array. We
     * fold over the array to determine the current period and duration.
     */
    PeriodDurationUpdate[] periodDurationUpdates;

    error CannotInitializeWithZeroCycleDuration();
    error CannotInitializeWithZeroPeriodDuration();
    error CannotSetStartInThePast();
    error CannotSetStartAfterProtocolHasStarted();
    error CannotSetProtocolStartToZero();
    error CannotSetZeroCycleDuration();
    error CannotSetZeroPeriodDuration();
    error ProtocolHasNotBegun();

    function initialize(uint256 _cycleDuration, uint256 _periodDuration) external initializer {
        if (_cycleDuration == 0) {
            revert CannotInitializeWithZeroCycleDuration();
        }
        if (_periodDuration == 0) {
            revert CannotInitializeWithZeroPeriodDuration();
        }

        Ownable2StepUpgradeable.__Ownable2Step_init();

        _setCycleDuration(_cycleDuration);
        _setPeriodDuration(_periodDuration);
    }

    /**
     * @notice Returns true if the contract implements the interface defined by
     * `interfaceId` from ERC165.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == type(IProtocolTimeManager).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @notice Sets the start time for the protocol
     * @param _start A unix timestamp representing the start time
     */
    function setProtocolStart(uint256 _start) external onlyOwner {
        if (_start == 0) {
            revert CannotSetProtocolStartToZero();
        }

        if (_start <= block.timestamp) {
            revert CannotSetStartInThePast();
        }

        if (hasProtocolStarted()) {
            revert CannotSetStartAfterProtocolHasStarted();
        }

        start = _start;
        // update when the next cycle starts
        cycleDurationUpdates[0].updatesAt = _start;
    }

    function hasProtocolStarted() internal view returns (bool) {
        return block.timestamp >= start && start != 0;
    }

    /**
     * @notice Sets the cycle duration for the next cycles.
     * @param _cycleDuration The duration in seconds for the cycles
     */
    function setCycleDuration(uint256 _cycleDuration) external onlyOwner {
        _setCycleDuration(_cycleDuration);
    }

    /**
     * @notice Sets the period duration for the next cycles.
     * @param _periodDuration The duration in seconds for the periods
     */
    function setPeriodDuration(uint256 _periodDuration) external onlyOwner {
        _setPeriodDuration(_periodDuration);
    }

    function _setCycleDuration(uint256 _cycleDuration) internal {
        if (_cycleDuration == 0) {
            revert CannotSetZeroCycleDuration();
        }

        // check if this is the first instance we are setting the cycle's duration
        if (cycleDurationUpdates.length == 0) {
            cycleDurationUpdates.push(
                CycleDurationUpdate(
                    _cycleDuration,
                    0 // start value will be updated once `start()` is called
                )
            );
            return;
        }

        CycleDurationUpdate storage lastUpdate = cycleDurationUpdates[
            cycleDurationUpdates.length - 1
        ];

        // check if we are updating the duration again before the protocol has
        // started
        if (!hasProtocolStarted()) {
            lastUpdate.duration = _cycleDuration;
            return;
        }

        // Check if the next cycle's duration has already been updated. In this
        // case we overwrite the existing update
        if (lastUpdate.updatesAt > block.timestamp) {
            lastUpdate.duration = _cycleDuration;
            return;
        }

        Cycle memory cycle = _getCurrentCycle();

        uint256 nextCycleStart = cycle.start + cycle.duration;

        cycleDurationUpdates.push(CycleDurationUpdate(_cycleDuration, nextCycleStart));
    }

    /**
     * @notice Sets the period duration
     * @param _periodDuration The duration for which periods should last in unix
     */
    function _setPeriodDuration(uint256 _periodDuration) internal {
        if (_periodDuration == 0) {
            revert CannotSetZeroPeriodDuration();
        }

        // check if this is the first instance of setting the period duration
        if (periodDurationUpdates.length == 0) {
            periodDurationUpdates.push(PeriodDurationUpdate(_periodDuration, 1));
            return;
        }

        PeriodDurationUpdate storage lastUpdate = periodDurationUpdates[
            periodDurationUpdates.length - 1
        ];

        // check if we are updating the duration again before the protocol has
        // started
        if (!hasProtocolStarted()) {
            lastUpdate.duration = _periodDuration;
            return;
        }

        Cycle memory cycle = _getCurrentCycle();
        uint256 nextCycle = cycle.iteration + 1;

        // Check if the next cycle's period duration has already been updated. In this
        // case we overwrite the existing update
        if (lastUpdate.updatesAt == nextCycle) {
            lastUpdate.duration = _periodDuration;
            return;
        }

        periodDurationUpdates.push(PeriodDurationUpdate(_periodDuration, nextCycle));
    }

    /**
     * @notice Get the current cycle
     */
    function getCurrentCycle() external view returns (Cycle memory) {
        return _getCurrentCycle();
    }

    /**
     * @notice Get the current period
     */
    function getCurrentPeriod() external view returns (uint256) {
        return _getCurrentPeriod();
    }

    /**
     * @notice  Calculates the current cycle by iterating through the cycle
     * duration updates, which are stored as an array.
     * Example:
     *  updates -
     *    [{ duration: 100, updatesAt: 1 },
     *     { duration: 50, updatesAt: 5 },
     *     { duration: 25, updatesAt: 9 }]
     *  Based on these updates:
     *   - Cycles 1 to 4 will have a duration of 100 seconds.
     *   - Cycles 5 to 8 will have a duration of 50 seconds.
     *   - Cycles 9 and onwards will have a duration of 25 seconds.
     *
     * The function determines the current cycle and its duration by calculating
     * the total time elapsed since the protocol started and iterating through
     * the duration updates to find out how many cycles have occurred.
     *
     * The process involves:
     *  - Checking if the protocol has started.
     *  - Calculating the total elapsed time since the protocol's start.
     *  - Iterating through the cycle duration updates to count how many cycles
     *    occurred with each duration.
     *  - If the next update is scheduled for the future, processing only up to
     *    the second to last update.
     *  - Finally, computing the number of cycles at the current duration and
     *    determining the start of the current cycle.
     *
     * @return Cycle The current cycle, its start time, and its duration.
     */
    function _getCurrentCycle() internal view returns (Cycle memory) {
        if (!hasProtocolStarted()) {
            revert ProtocolHasNotBegun();
        }

        uint256 totalTimeElapsed = block.timestamp - start;
        uint256 cycles = 1;

        uint256 cursor = 0;
        uint256 currentDuration = cycleDurationUpdates[cursor].duration;
        uint256 currentDurationStart = cycleDurationUpdates[cursor].updatesAt;
        uint256 currentCycleStart = 0;

        uint256 lastUpdateToProcess = 0;

        // We need to process up to the most recent cycle duration update.
        // However, if the cycle's duration for the proceeding cycle has been
        // updated, then we should only process up to the second to last update.
        if (cycleDurationUpdates[cycleDurationUpdates.length - 1].updatesAt > block.timestamp) {
            lastUpdateToProcess = cycleDurationUpdates.length - 1;
        } else {
            lastUpdateToProcess = cycleDurationUpdates.length;
        }

        while (true) {
            // we have reached the end of the cycle updates
            if (cursor + 1 == lastUpdateToProcess) {
                // add the cycles that occurred with the current duration
                uint256 cyclesAtCurrentDuration = totalTimeElapsed / currentDuration;
                cycles += cyclesAtCurrentDuration;

                currentCycleStart =
                    currentDurationStart +
                    cyclesAtCurrentDuration *
                    currentDuration;
                break;
            } else {
                uint256 nextDurationUpdate = cycleDurationUpdates[cursor + 1].updatesAt;

                uint256 timeElapsedAtCurrentDuration = nextDurationUpdate - currentDurationStart;

                // add the cycles that occurred with the current duration
                uint256 cyclesAtCurrentDuration = timeElapsedAtCurrentDuration / currentDuration;
                cycles += cyclesAtCurrentDuration;

                // as we iterate through the updates, we track how much
                // of the total time remaining to account for before
                // processing the next cycle duration update
                totalTimeElapsed -= timeElapsedAtCurrentDuration;

                // update cursors
                cursor++;
                currentDuration = cycleDurationUpdates[cursor].duration;
                currentDurationStart = cycleDurationUpdates[cursor].updatesAt;
            }
        }

        return Cycle(cycles, currentCycleStart, currentDuration);
    }

    /**
     * @notice  Calculates the current period within the ongoing cycle. Periods are
     * defined by a duration, and the function determines how many periods have
     * elapsed within the current cycle.
     *
     * If the protocol has not started, the function reverts with an error. Otherwise,
     * the current period is determined by dividing the total elapsed time within the
     * ongoing cycle, by the current period duraiton.
     * @return uint256 The current period within the ongoing cycle.
     */
    function _getCurrentPeriod() internal view returns (uint256) {
        if (!hasProtocolStarted()) {
            revert ProtocolHasNotBegun();
        }

        Cycle memory cycle = _getCurrentCycle();
        uint256 totalTimeElapsedWithinPeriod = block.timestamp - cycle.start;

        uint256 periodDuration = _getPeriodDuration();

        return totalTimeElapsedWithinPeriod / periodDuration;
    }

    /**
     * @notice Get the cycle duration
     */
    function getCycleDuration() external view returns (uint256) {
        return _getCycleDuration();
    }

    function _getCycleDuration() internal view returns (uint256) {
        // if the protocol has not started, then the current duration is the
        // first update
        if (!hasProtocolStarted()) {
            return cycleDurationUpdates[0].duration;
        }

        CycleDurationUpdate storage lastUpdate = cycleDurationUpdates[
            cycleDurationUpdates.length - 1
        ];

        // if the last update occurred before the current timestamp, then the
        // last update holds the current duration
        if (lastUpdate.updatesAt <= block.timestamp) {
            return lastUpdate.duration;
            // else the duration has been updated for the next cycle, so the current
            // cycle duration is defined in the previous update
        } else {
            return cycleDurationUpdates[cycleDurationUpdates.length - 2].duration;
        }
    }

    /**
     * @notice Gets the current period duration
     */
    function getPeriodDuration() external view returns (uint256) {
        return _getPeriodDuration();
    }

    /**
     * @notice  Retrieves the current period duration. Period duration updates are stored as an array with each update specifying a
     * new duration and the cycle at which the update takes effect.
     *
     * If the protocol has not started, the current duration is the duration of
     * the first update.
     *
     * The function first checks if the protocol has started. If it has, it
     * retrieves the current cycle using `_getCurrentCycle()`. It then determines
     * the correct period duration based on the updates:
     *
     *  - If the last update occurred before or at the current cycle, the last
     *    update holds the current duration.
     *  - If the last update is scheduled for a future cycle, the current duration
     *    is defined in the previous update.
     *
     * @return uint256 The current period duration.
     */
    function _getPeriodDuration() internal view returns (uint256) {
        // if the protocol has not started, then the current duration is the
        // first update
        if (!hasProtocolStarted()) {
            return periodDurationUpdates[0].duration;
        }

        Cycle memory cycle = _getCurrentCycle();

        PeriodDurationUpdate storage lastUpdate = periodDurationUpdates[
            periodDurationUpdates.length - 1
        ];

        // if the last update occurred before the current cycle, then the
        // last update holds the current duration
        if (lastUpdate.updatesAt <= cycle.iteration) {
            return lastUpdate.duration;
            // else the duration has been updated for the next cycle, so the current
            // period duration is defined in the previous update
        } else {
            return periodDurationUpdates[periodDurationUpdates.length - 2].duration;
        }
    }

    /**
     * @notice Get the start time of the cycle/period intervals
     */
    function getStart() external view returns (uint256) {
        return start;
    }

    /**
     * @notice Get the cycle and period durations
     */
    function getTime() external view returns (uint256, uint256, Cycle memory) {
        Cycle memory cycle = _getCurrentCycle();
        uint256 period = _getCurrentPeriod();
        return (cycle.iteration, period, cycle);
    }
}
