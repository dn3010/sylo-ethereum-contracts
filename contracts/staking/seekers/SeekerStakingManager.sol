// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./ISeekerStakingManager.sol";
import "./ISeekerStatsOracle.sol";
import "../IStakingOrchestrator.sol";

contract SeekerStakingManager is
    ISeekerStakingManager,
    Initializable,
    Ownable2StepUpgradeable,
    ERC165
{
    /**
     * @notice ERC721 contract for bridged Seekers in TRN. Used for verifying ownership
     * of a seeker.
     */
    IERC721 public rootSeekers;

    /**
     * @notice Holds the Seekers metadata from Ethereum, set manually in TRN
     */
    ISeekerStatsOracle public oracle;

    /** Staking Orchestrator address */
    IStakingOrchestrator public stakingOrchestrator;

    /**
     * @notice mapping to track staked seekers by seeker ID
     */
    mapping(uint256 => StakedSeeker) public stakedSeekersById;

    /**
     * @notice mapping to track staked seekers by node address
     */
    mapping(address => uint256[]) public stakedSeekersByNode;

    /**
     * @notice mapping to track staked seekers by user address
     */
    mapping(address => uint256[]) public stakedSeekersByUser;

    /**
     * @notice variable used for comparision with the mapping
     * "stakedSeekersById", specificly whether the value for a given
     * key has been defined.
     */
    StakedSeeker private defaultStakedSeeker;

    error NodeAddressCannotBeNil();
    error FromNodeAddressCannotBeNil();
    error SeekerProofCannotBeEmpty();
    error RootSeekersCannotBeZeroAddress();
    error SeekerStatsOracleCannotBeNil();
    error SenderMustOwnSeekerId();
    error SeekerNotYetStaked();
    error SeekerNotStakedToNode();
    error SeekerNotStakedBySender();

    enum StakedErrors {
        SEEKER_NOT_YET_STAKED,
        SEEKER_NOT_STAKED_TO_NODE,
        SEEKER_NOT_STAKED_BY_SENDER,
        NIL // No error
    }

    function initialize(IERC721 _rootSeekers, ISeekerStatsOracle _oracle, IStakingOrchestrator _stakingOrchestrator) external initializer {
        if (address(_rootSeekers) == address(0)) {
            revert RootSeekersCannotBeZeroAddress();
        }
        if (address(_oracle) == address(0)) {
            revert SeekerStatsOracleCannotBeNil();
        }

        Ownable2StepUpgradeable.__Ownable2Step_init();

        rootSeekers = _rootSeekers;
        oracle = _oracle;
        stakingOrchestrator = _stakingOrchestrator;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(ISeekerStakingManager).interfaceId;
    }

    /**
     * @notice Stakes a seeker, this will unstake a seeker if it is
     * already staked.
     * @param node Address of node to stake seeker against
     * @param seeker The object containing the seekers statistics
     * @param seekerStatsProof The signature of the seekers proof
     * message, signed by the oracle account and only required if
     * the seeker is not registered yet.
     */
    function stakeSeeker(
        address node,
        SeekerStatsOracle.Seeker calldata seeker,
        bytes calldata seekerStatsProof
    ) external {
        _stakeSeeker(node, seeker, seekerStatsProof);
    }

    /**
     * @notice Stake a multiple seekers, this will unstake a seeker if it is already staked.
     * @param node Address of node to stake seeker against
     * @param seekers A list of objects containing the seekers statistics
     * @param seekerStatsProofs A list of seeker proof message
     * signatures, signed by the oracle account and only required if
     * the seeker is not registered yet.
     */
    function stakeSeekers(
        address node,
        SeekerStatsOracle.Seeker[] calldata seekers,
        bytes[] calldata seekerStatsProofs
    ) external {
        for (uint256 i = 0; i < seekers.length; ++i) {
            _stakeSeeker(node, seekers[i], seekerStatsProofs[i]);
        }
    }

    function _stakeSeeker(
        address node,
        SeekerStatsOracle.Seeker calldata seeker,
        bytes calldata seekerStatsProof
    ) internal {
        if (node == address(0)) {
            revert NodeAddressCannotBeNil();
        }
        if (rootSeekers.ownerOf(seeker.seekerId) != msg.sender) {
            revert SenderMustOwnSeekerId();
        }
        // Register a seeker if not registered yet
        if (!oracle.isSeekerRegistered(seeker.seekerId)) {
            if (seekerStatsProof.length == 0) {
                revert SeekerProofCannotBeEmpty();
            }
            oracle.registerSeeker(seeker, seekerStatsProof);
        }

        if (_validateStakedSeeker(node, seeker.seekerId) == StakedErrors.NIL) {
            _unstakeSeeker(node, seeker.seekerId);
        }

        stakedSeekersById[seeker.seekerId] = StakedSeeker({
            seekerId: seeker.seekerId,
            node: node,
            user: msg.sender
        });
        stakedSeekersByNode[node].push(seeker.seekerId);
        stakedSeekersByUser[msg.sender].push(seeker.seekerId);

        // report to staking orchestrator
        stakingOrchestrator.seekerStakeAdded(node, msg.sender, seeker.seekerId);
    }

    /**
     * @notice Unstakes a seeker, will revert with staked error with
     * one of four cases.
     * 1) Sender does not own seeker
     * 2) Seeker is not yet staked
     * 3) Seeker is not staked by the sender
     * 4) Seeker is not staked to provided node address
     * @param node Address of node to unstake seeker from
     * @param seekerId Seeker ID of staked seeker
     */
    function unstakeSeeker(address node, uint256 seekerId) external {
        if (node == address(0)) {
            revert FromNodeAddressCannotBeNil();
        }
        if (rootSeekers.ownerOf(seekerId) != msg.sender) {
            revert SenderMustOwnSeekerId();
        }

        StakedErrors err = _validateStakedSeeker(node, seekerId);
        if (err == StakedErrors.SEEKER_NOT_YET_STAKED) {
            revert SeekerNotYetStaked();
        }
        if (err == StakedErrors.SEEKER_NOT_STAKED_BY_SENDER) {
            revert SeekerNotStakedBySender();
        }
        if (err == StakedErrors.SEEKER_NOT_STAKED_TO_NODE) {
            revert SeekerNotStakedToNode();
        }

        _unstakeSeeker(node, seekerId);
    }

    function _unstakeSeeker(address node, uint256 seekerId) internal {
        for (uint256 i = 0; i < stakedSeekersByNode[node].length; ++i) {
            if (stakedSeekersByNode[node][i] == seekerId) {
                stakedSeekersByNode[node][i] = stakedSeekersByNode[node][
                    stakedSeekersByNode[node].length - 1
                ];

                stakedSeekersByNode[node].pop();
                break;
            }
        }

        for (uint256 i = 0; i < stakedSeekersByUser[msg.sender].length; ++i) {
            if (stakedSeekersByUser[msg.sender][i] == seekerId) {
                stakedSeekersByUser[msg.sender][i] = stakedSeekersByUser[msg.sender][
                    stakedSeekersByUser[msg.sender].length - 1
                ];

                stakedSeekersByUser[msg.sender].pop();
                break;
            }
        }

        delete stakedSeekersById[seekerId];

        // report to staking orchestrator
        stakingOrchestrator.seekerStakeRemoved(node, msg.sender, seekerId);
    }

    function _validateStakedSeeker(
        address node,
        uint256 seekerId
    ) internal view returns (StakedErrors) {
        if (
            keccak256(abi.encode(stakedSeekersById[seekerId])) ==
            keccak256(abi.encode(defaultStakedSeeker))
        ) {
            return StakedErrors.SEEKER_NOT_YET_STAKED;
        }
        if (stakedSeekersById[seekerId].user != msg.sender) {
            return StakedErrors.SEEKER_NOT_STAKED_BY_SENDER;
        }
        if (stakedSeekersById[seekerId].node != node) {
            return StakedErrors.SEEKER_NOT_STAKED_TO_NODE;
        }
        return StakedErrors.NIL;
    }

    /**
     * @notice Get all seekers that were staked to a specific node address
     * @param node Address of node seeker is staked against
     */
    function getStakedSeekersByNode(address node) external view returns (uint256[] memory) {
        return stakedSeekersByNode[node];
    }

    /**
     * @notice Get all staked seekers owned by user address
     * @param user Address of user that staked seeker
     */
    function getStakedSeekersByUser(address user) external view returns (uint256[] memory) {
        return stakedSeekersByUser[user];
    }
}
