// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "solidity-trigonometry/src/Trigonometry.sol";

import "./ISeekerStatsOracle.sol";

contract SeekerStatsOracle is ISeekerStatsOracle, Initializable, Ownable2StepUpgradeable, ERC165 {
    /**
     * @notice The oracle account. This contract accepts any attestations of
     * Seeker power that have been signed by this account.
     */
    address public oracle;

    /**
     * @notice Tracks the set of Seeker Stats and Rank with Seeker ID
     */
    mapping(uint256 => Seeker) public seekerStats;

    /**
     * @notice variable used for comparision with the mapping
     * "seekerStats", specificly whether the value for a given
     * key has been defined.
     */
    Seeker public defaultSeeker;

    /**
     * @notice Holds the angle used for coverage calculation in radians
     */
    int256 private coverageAngle =
        Trigonometry.sin(((Trigonometry.TWO_PI / 6) + Trigonometry.TWO_PI));

    event SeekerStatsUpdated(
        uint256 indexed seekerId,
        uint256 attrReactor,
        uint256 attrCores,
        uint256 attrDurability,
        uint256 attrSensors,
        uint256 attrStorage,
        uint256 attrChip
    );

    /** events **/
    event OracleUpdated(address oracle);

    /** errors **/
    error OracleAddressCannotBeNil();
    error SenderMustBeOracelAccount();
    error InvalidSignatureForSeekerProof();
    error SeekerNotRegistered(uint256 seekerId);

    function initialize(address _oracle) external initializer {
        if (_oracle == address(0)) {
            revert OracleAddressCannotBeNil();
        }

        Ownable2StepUpgradeable.__Ownable2Step_init();

        oracle = _oracle;
    }

    /**
     * @notice Returns true if the contract implements the interface defined by
     * `interfaceId` from ERC165.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(ISeekerStatsOracle).interfaceId;
    }

    /**
     * @notice Sets the oracle account.
     * @param _oracle The oracle account.
     */
    function setOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) {
            revert OracleAddressCannotBeNil();
        }
        oracle = _oracle;

        emit OracleUpdated(_oracle);
    }

    /**
     * @notice Returns true if the oracle account signed the proof message for the given seeker.
     * @param seeker The object containing the seeker's statistics.
     * @param signature The signature of the seekers proof message, signed by the oracle account.
     */
    function isSeekerStatsProofValid(
        Seeker calldata seeker,
        bytes calldata signature
    ) internal view returns (bool) {
        bytes memory proof = _createProofMessage(seeker);
        bytes32 ecdsaHash = ECDSA.toEthSignedMessageHash(proof);
        address signerAddress = ECDSA.recover(ecdsaHash, signature);
        if (signerAddress == oracle) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * @notice Creates a unique proofing message for the provided seeker.
     * @param seeker The object containing the seeker's statistics.
     */
    function createProofMessage(Seeker calldata seeker) external pure returns (bytes memory) {
        return _createProofMessage(seeker);
    }

    /**
     * @notice Creates a unique proofing message for the provided seeker.
     * @param seeker The object containing the seekers statistics.
     */
    function _createProofMessage(Seeker calldata seeker) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                seeker.seekerId,
                seeker.rank,
                seeker.attrChip,
                seeker.attrDurability,
                seeker.attrSensors,
                seeker.attrCores,
                seeker.attrStorage,
                seeker.attrReactor
            );
    }

    /**
     * @notice Registers a seeker - only callable from oracle
     * @param seeker The object containing the seekers statistics.
     */
    function registerSeekerRestricted(Seeker calldata seeker) external {
        if (msg.sender != oracle) {
            revert SenderMustBeOracelAccount();
        }

        seekerStats[seeker.seekerId] = seeker;
        emit SeekerStatsUpdated(
            seeker.seekerId,
            seeker.attrReactor,
            seeker.attrCores,
            seeker.attrDurability,
            seeker.attrSensors,
            seeker.attrStorage,
            seeker.attrChip
        );
    }

    /**
     * @notice Registers a seeker
     * @param seeker The object containing the seekers statistics.
     * @param proof The signature of the seekers proof message, signed by the oracle account.
     */
    function registerSeeker(Seeker calldata seeker, bytes calldata proof) external {
        if (!isSeekerStatsProofValid(seeker, proof)) {
            revert InvalidSignatureForSeekerProof();
        }

        seekerStats[seeker.seekerId] = seeker;
        emit SeekerStatsUpdated(
            seeker.seekerId,
            seeker.attrReactor,
            seeker.attrCores,
            seeker.attrDurability,
            seeker.attrSensors,
            seeker.attrStorage,
            seeker.attrChip
        );
    }

    /**
     * @notice Validates that the contract has registered the given seeker
     * @param seeker The object containing the seeker statistics
     */
    function isSeekerRegistered(Seeker calldata seeker) external view returns (bool) {
        return _isSeekerRegistered(seeker);
    }

    function _isSeekerRegistered(Seeker memory seeker) internal view returns (bool) {
        return
            keccak256(abi.encode(seekerStats[seeker.seekerId])) !=
            keccak256(abi.encode(defaultSeeker));
    }

    /**
     * @notice Calculates the coverage score for the given seekers. This score is used by
     *  nodes to determine the staking capacity and is a reflection of the diversity
     *  in attributes of the seekers staked against the node.
     * @param seekers A list containing seekers, will revert if any seeker is not registered.
     */
    function calculateAttributeCoverage(Seeker[] calldata seekers) external view returns (int256) {
        int256 coverage = 0;

        int256 totalReactor = 0;
        int256 totalCores = 0;
        int256 totalDurability = 0;
        int256 totalSensors = 0;
        int256 totalStorage = 0;
        int256 totalChip = 0;

        for (uint256 i = 0; i < seekers.length; i++) {
            Seeker memory seeker = seekers[i];
            Seeker memory registeredSeeker = seekerStats[seeker.seekerId];

            // We validate the seeker has been registered by checking if it is
            // not equal to the default, empty-value Seeker.
            if (!_isSeekerRegistered(registeredSeeker)) {
                revert SeekerNotRegistered(seeker.seekerId);
            }

            totalReactor += int256(registeredSeeker.attrReactor);
            totalCores += int256(registeredSeeker.attrCores);
            totalDurability += int256(registeredSeeker.attrDurability);
            totalSensors += int256(registeredSeeker.attrSensors);
            totalStorage += int256(registeredSeeker.attrStorage);
            totalChip += int256(registeredSeeker.attrChip);
        }

        coverage += (int256(totalReactor) * coverageAngle * int256(totalCores)) / 2;
        coverage += (int256(totalCores) * coverageAngle * int256(totalDurability)) / 2;
        coverage += (int256(totalDurability) * coverageAngle * int256(totalSensors)) / 2;
        coverage += (int256(totalSensors) * coverageAngle * int256(totalStorage)) / 2;
        coverage += (int256(totalStorage) * coverageAngle * int256(totalChip)) / 2;
        coverage += (int256(totalChip) * coverageAngle * int256(totalReactor)) / 2;

        return coverage;
    }

    /**
     * @notice Get registered seeker statistics for given seeker ID
     * @param seekerId Id of the seekers statistics to retrieve
     */
    function getSeekerStats(uint256 seekerId) external view returns (Seeker memory) {
        return seekerStats[seekerId];
    }
}
