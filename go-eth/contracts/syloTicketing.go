// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package contracts

import (
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/event"
)

// Reference imports to suppress errors if they are not otherwise used.
var (
	_ = big.NewInt
	_ = strings.NewReader
	_ = ethereum.NotFound
	_ = abi.U256
	_ = bind.Bind
	_ = common.Big1
	_ = types.BloomLookup
	_ = event.NewSubscription
)

// SyloTicketingTicket is an auto generated low-level Go binding around an user-defined struct.
type SyloTicketingTicket struct {
	Sender           common.Address
	Receiver         common.Address
	FaceValue        *big.Int
	WinProb          *big.Int
	ExpirationBlock  *big.Int
	ReceiverRandHash [32]byte
	SenderNonce      uint32
}

// SyloTicketingABI is the input ABI used to generate the binding from.
const SyloTicketingABI = "[{\"inputs\":[{\"internalType\":\"contractIERC20\",\"name\":\"token\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"_unlockDuration\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"address\",\"name\":\"previousOwner\",\"type\":\"address\"},{\"indexed\":true,\"internalType\":\"address\",\"name\":\"newOwner\",\"type\":\"address\"}],\"name\":\"OwnershipTransferred\",\"type\":\"event\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"name\":\"deposits\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"escrow\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"penalty\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"unlockAt\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"owner\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"renounceOwnership\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"newOwner\",\"type\":\"address\"}],\"name\":\"transferOwnership\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"unlockDuration\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"name\":\"usedTickets\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"newUnlockDuration\",\"type\":\"uint256\"}],\"name\":\"setUnlockDuration\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"}],\"name\":\"depositEscrow\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"account\",\"type\":\"address\"}],\"name\":\"depositEscrowFor\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"}],\"name\":\"depositPenalty\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"account\",\"type\":\"address\"}],\"name\":\"depositPenaltyFor\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"unlockDeposits\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"lockDeposits\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"withdraw\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"account\",\"type\":\"address\"}],\"name\":\"withdrawTo\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"components\":[{\"internalType\":\"address\",\"name\":\"sender\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"receiver\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"faceValue\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"winProb\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"expirationBlock\",\"type\":\"uint256\"},{\"internalType\":\"bytes32\",\"name\":\"receiverRandHash\",\"type\":\"bytes32\"},{\"internalType\":\"uint32\",\"name\":\"senderNonce\",\"type\":\"uint32\"}],\"internalType\":\"structSyloTicketing.Ticket\",\"name\":\"ticket\",\"type\":\"tuple\"},{\"internalType\":\"uint256\",\"name\":\"receiverRand\",\"type\":\"uint256\"},{\"internalType\":\"bytes\",\"name\":\"sig\",\"type\":\"bytes\"}],\"name\":\"redeem\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"components\":[{\"internalType\":\"address\",\"name\":\"sender\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"receiver\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"faceValue\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"winProb\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"expirationBlock\",\"type\":\"uint256\"},{\"internalType\":\"bytes32\",\"name\":\"receiverRandHash\",\"type\":\"bytes32\"},{\"internalType\":\"uint32\",\"name\":\"senderNonce\",\"type\":\"uint32\"}],\"internalType\":\"structSyloTicketing.Ticket\",\"name\":\"ticket\",\"type\":\"tuple\"}],\"name\":\"getTicketHash\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"stateMutability\":\"pure\",\"type\":\"function\"}]"

// SyloTicketingBin is the compiled bytecode used for deploying new contracts.
var SyloTicketingBin = "0x608060405234801561001057600080fd5b5060405161161938038061161983398101604081905261002f916100b9565b60006100426001600160e01b036100b516565b600080546001600160a01b0319166001600160a01b0383169081178255604051929350917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0908290a350600180546001600160a01b0319166001600160a01b0393909316929092179091556002556100f1565b3390565b600080604083850312156100cb578182fd5b82516001600160a01b03811681146100e1578283fd5b6020939093015192949293505050565b611519806101006000396000f3fe608060405234801561001057600080fd5b506004361061011b5760003560e01c80637d6babb4116100b2578063cb991efe11610081578063dd90076911610066578063dd9007691461021a578063f2fde38b1461022d578063fc7e286d146102405761011b565b8063cb991efe146101ff578063d088a231146102125761011b565b80637d6babb4146101c75780638594b093146101cf5780638a1fcd60146101e25780638da5cb5b146101ea5761011b565b8063715018a6116100ee578063715018a61461017957806371e6af6e1461018157806372b0d90c146101a157806374d3fe72146101b45761011b565b80633ccfd60b146101205780634e055fe21461012a57806359a515ba1461013d5780636fd459dc14610166575b600080fd5b610128610262565b005b610128610138366004610d51565b61026d565b61015061014b366004610d1e565b6103e3565b60405161015d9190610f26565b60405180910390f35b610128610174366004610dfd565b6103f8565b6101286104bb565b61019461018f366004610d36565b610552565b60405161015d9190610ecc565b6101286101af366004610cdc565b6105a4565b6101286101c2366004610d1e565b610646565b610194610653565b6101286101dd366004610dfd565b6106c3565b610194610731565b6101f2610737565b60405161015d9190610ed5565b61012861020d366004610d1e565b610746565b610128610750565b610128610228366004610d1e565b61078c565b61012861023b366004610cdc565b6107c6565b61025361024e366004610cdc565b610804565b60405161015d9392919061147a565b61026b336105a4565b565b600061027884610552565b905061028684828585610825565b60006102958560000151610975565b90508460400151816001015482600001540110156102ce5760405162461bcd60e51b81526004016102c59061116b565b60405180910390fd5b60008281526004602052604090819020805460ff191660011790558154908601511115610336578054604086015160009161030f919063ffffffff61098f16565b60008355600183015490915061032b908263ffffffff61098f16565b60018301555061034f565b6040850151815461034c9163ffffffff61098f16565b81555b6001546020860151604080880151905163a9059cbb60e01b81526001600160a01b039093169263a9059cbb92610389929091600401610f0d565b602060405180830381600087803b1580156103a357600080fd5b505af11580156103b7573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906103db9190610cf7565b505050505050565b60046020526000908152604090205460ff1681565b600061040382610975565b905080600201546000146104295760405162461bcd60e51b81526004016102c5906110fd565b8054830181556001546040516323b872dd60e01b81526001600160a01b03909116906323b872dd9061046390339030908890600401610ee9565b602060405180830381600087803b15801561047d57600080fd5b505af1158015610491573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906104b59190610cf7565b50505050565b6104c36109da565b6000546001600160a01b039081169116146104f05760405162461bcd60e51b81526004016102c5906112d5565b600080546040516001600160a01b03909116907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0908390a3600080547fffffffffffffffffffffffff0000000000000000000000000000000000000000169055565b80516020808301516040808501516060860151608087015160a088015160c08901519451600098610587989097969101610e29565b604051602081830303815290604052805190602001209050919050565b60006105af33610975565b905060008160020154116105d55760405162461bcd60e51b81526004016102c5906113af565b438160020154106105f85760405162461bcd60e51b81526004016102c59061129e565b6001808201805483546000808655928390556002850192909255915460405163a9059cbb60e01b815291909201916001600160a01b03169063a9059cbb906104639086908590600401610f0d565b61065081336106c3565b50565b60008061065f33610975565b8054909150151580610675575060008160010154115b6106915760405162461bcd60e51b81526004016102c590610ff0565b6002810154156106b35760405162461bcd60e51b81526004016102c590611341565b6002805443019101819055905090565b60006106ce82610975565b905080600201546000146106f45760405162461bcd60e51b81526004016102c5906110fd565b6001808201805485019055546040516323b872dd60e01b81526001600160a01b03909116906323b872dd9061046390339030908890600401610ee9565b60025481565b6000546001600160a01b031690565b61065081336103f8565b600061075b33610975565b90508060020154600014156107825760405162461bcd60e51b81526004016102c590611134565b6000600290910155565b6107946109da565b6000546001600160a01b039081169116146107c15760405162461bcd60e51b81526004016102c5906112d5565b600255565b6107ce6109da565b6000546001600160a01b039081169116146107fb5760405162461bcd60e51b81526004016102c5906112d5565b610650816109de565b60036020526000908152604090208054600182015460029092015490919083565b83516001600160a01b031661084c5760405162461bcd60e51b81526004016102c590611378565b60208401516001600160a01b03166108765760405162461bcd60e51b81526004016102c590611443565b6080840151158061088b575043846080015110155b6108a75760405162461bcd60e51b81526004016102c590611084565b60008381526004602052604090205460ff16156108d65760405162461bcd60e51b81526004016102c59061130a565b8360a00151826040516020016108ec9190610ecc565b604051602081830303815290604052805190602001201461091f5760405162461bcd60e51b81526004016102c590611241565b61092e81856000015185610a77565b61094a5760405162461bcd60e51b81526004016102c5906113e6565b61095981838660600151610a9f565b6104b55760405162461bcd60e51b81526004016102c5906111c8565b6001600160a01b0316600090815260036020526040902090565b60006109d183836040518060400160405280601e81526020017f536166654d6174683a207375627472616374696f6e206f766572666c6f770000815250610ad6565b90505b92915050565b3390565b6001600160a01b038116610a045760405162461bcd60e51b81526004016102c590611027565b600080546040516001600160a01b03808516939216917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e091a3600080547fffffffffffffffffffffffff0000000000000000000000000000000000000000166001600160a01b0392909216919091179055565b6000826001600160a01b0316610a8d8386610b02565b6001600160a01b031614949350505050565b6000818484604051602001610ab5929190610eaa565b60408051601f19818403018152919052805160209091012010949350505050565b60008184841115610afa5760405162461bcd60e51b81526004016102c59190610f4f565b505050900390565b60008151604114610b255760405162461bcd60e51b81526004016102c590610fb9565b60208201516040830151606084015160001a7f7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0821115610b775760405162461bcd60e51b81526004016102c5906110bb565b601b8160ff161015610b8757601b015b8060ff16601b14158015610b9f57508060ff16601c14155b15610bbc5760405162461bcd60e51b81526004016102c5906111ff565b600060018783868660405160008152602001604052604051610be19493929190610f31565b6020604051602081039080840390855afa158015610c03573d6000803e3d6000fd5b5050604051601f1901519150506001600160a01b038116610c365760405162461bcd60e51b81526004016102c590610f82565b9695505050505050565b80356001600160a01b03811681146109d457600080fd5b600060e08284031215610c68578081fd5b610c7260e0611490565b9050610c7e8383610c40565b8152610c8d8360208401610c40565b602082015260408201356040820152606082013560608201526080820135608082015260a082013560a082015260c082013563ffffffff81168114610cd157600080fd5b60c082015292915050565b600060208284031215610ced578081fd5b6109d18383610c40565b600060208284031215610d08578081fd5b81518015158114610d17578182fd5b9392505050565b600060208284031215610d2f578081fd5b5035919050565b600060e08284031215610d47578081fd5b6109d18383610c57565b60008060006101208486031215610d66578182fd5b610d708585610c57565b925060e0840135915061010084013567ffffffffffffffff80821115610d94578283fd5b81860187601f820112610da5578384fd5b8035925081831115610db5578384fd5b610dc8601f8401601f1916602001611490565b9150828252876020848301011115610dde578384fd5b8260208201602084013750826020838301015280925050509250925092565b60008060408385031215610e0f578182fd5b82359150610e208460208501610c40565b90509250929050565b606097881b7fffffffffffffffffffffffffffffffffffffffff00000000000000000000000090811682529690971b9095166014870152602886019390935260488501919091526068840152608883015260e01b7fffffffff000000000000000000000000000000000000000000000000000000001660a882015260ac0190565b60008351610ebc8184602088016114b7565b9190910191825250602001919050565b90815260200190565b6001600160a01b0391909116815260200190565b6001600160a01b039384168152919092166020820152604081019190915260600190565b6001600160a01b03929092168252602082015260400190565b901515815260200190565b93845260ff9290921660208401526040830152606082015260800190565b6000602082528251806020840152610f6e8160408501602087016114b7565b601f01601f19169190910160400192915050565b60208082526018908201527f45434453413a20696e76616c6964207369676e61747572650000000000000000604082015260600190565b6020808252601f908201527f45434453413a20696e76616c6964207369676e6174757265206c656e67746800604082015260600190565b60208082526013908201527f4e6f7468696e6720746f20776974686472617700000000000000000000000000604082015260600190565b60208082526026908201527f4f776e61626c653a206e6577206f776e657220697320746865207a65726f206160408201527f6464726573730000000000000000000000000000000000000000000000000000606082015260800190565b60208082526012908201527f5469636b65742068617320657870697265640000000000000000000000000000604082015260600190565b60208082526022908201527f45434453413a20696e76616c6964207369676e6174757265202773272076616c604082015261756560f01b606082015260800190565b6020808252601e908201527f43616e6e6f74206465706f736974207768696c6520756e6c6f636b696e670000604082015260600190565b6020808252601a908201527f4e6f7420756e6c6f636b696e672c2063616e6e6f74206c6f636b000000000000604082015260600190565b60208082526027908201527f53656e64657220646f65736e2774206861766520656e6f7567682066756e647360408201527f20746f2070617900000000000000000000000000000000000000000000000000606082015260800190565b60208082526016908201527f5469636b6574206973206e6f7420612077696e6e657200000000000000000000604082015260600190565b60208082526022908201527f45434453413a20696e76616c6964207369676e6174757265202776272076616c604082015261756560f01b606082015260800190565b60208082526033908201527f48617368206f6620726563656976657252616e6420646f65736e2774206d617460408201527f636820726563656976657252616e644861736800000000000000000000000000606082015260800190565b6020808252601a908201527f556e6c6f636b20706572696f64206e6f7420636f6d706c657465000000000000604082015260600190565b6020808252818101527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572604082015260600190565b60208082526017908201527f5469636b657420616c72656164792072656465656d6564000000000000000000604082015260600190565b6020808252601a908201527f556e6c6f636b20616c726561647920696e2070726f6772657373000000000000604082015260600190565b60208082526015908201527f5469636b65742073656e646572206973206e756c6c0000000000000000000000604082015260600190565b60208082526015908201527f4465706f73697473206e6f7420756e6c6f636b65640000000000000000000000604082015260600190565b60208082526025908201527f5469636b657420646f65736e2774206861766520612076616c6964207369676e60408201527f6174757265000000000000000000000000000000000000000000000000000000606082015260800190565b60208082526017908201527f5469636b6574207265636569766572206973206e756c6c000000000000000000604082015260600190565b9283526020830191909152604082015260600190565b60405181810167ffffffffffffffff811182821017156114af57600080fd5b604052919050565b60005b838110156114d25781810151838201526020016114ba565b838111156104b5575050600091015256fea2646970667358221220620220d83110f50c5fd516eed73f3977b83a4c21ff9a697fe169b117839b89ba64736f6c63430006040033"

// DeploySyloTicketing deploys a new Ethereum contract, binding an instance of SyloTicketing to it.
func DeploySyloTicketing(auth *bind.TransactOpts, backend bind.ContractBackend, token common.Address, _unlockDuration *big.Int) (common.Address, *types.Transaction, *SyloTicketing, error) {
	parsed, err := abi.JSON(strings.NewReader(SyloTicketingABI))
	if err != nil {
		return common.Address{}, nil, nil, err
	}

	address, tx, contract, err := bind.DeployContract(auth, parsed, common.FromHex(SyloTicketingBin), backend, token, _unlockDuration)
	if err != nil {
		return common.Address{}, nil, nil, err
	}
	return address, tx, &SyloTicketing{SyloTicketingCaller: SyloTicketingCaller{contract: contract}, SyloTicketingTransactor: SyloTicketingTransactor{contract: contract}, SyloTicketingFilterer: SyloTicketingFilterer{contract: contract}}, nil
}

// SyloTicketing is an auto generated Go binding around an Ethereum contract.
type SyloTicketing struct {
	SyloTicketingCaller     // Read-only binding to the contract
	SyloTicketingTransactor // Write-only binding to the contract
	SyloTicketingFilterer   // Log filterer for contract events
}

// SyloTicketingCaller is an auto generated read-only Go binding around an Ethereum contract.
type SyloTicketingCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// SyloTicketingTransactor is an auto generated write-only Go binding around an Ethereum contract.
type SyloTicketingTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// SyloTicketingFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type SyloTicketingFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// SyloTicketingSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type SyloTicketingSession struct {
	Contract     *SyloTicketing    // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// SyloTicketingCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type SyloTicketingCallerSession struct {
	Contract *SyloTicketingCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts        // Call options to use throughout this session
}

// SyloTicketingTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type SyloTicketingTransactorSession struct {
	Contract     *SyloTicketingTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts        // Transaction auth options to use throughout this session
}

// SyloTicketingRaw is an auto generated low-level Go binding around an Ethereum contract.
type SyloTicketingRaw struct {
	Contract *SyloTicketing // Generic contract binding to access the raw methods on
}

// SyloTicketingCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type SyloTicketingCallerRaw struct {
	Contract *SyloTicketingCaller // Generic read-only contract binding to access the raw methods on
}

// SyloTicketingTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type SyloTicketingTransactorRaw struct {
	Contract *SyloTicketingTransactor // Generic write-only contract binding to access the raw methods on
}

// NewSyloTicketing creates a new instance of SyloTicketing, bound to a specific deployed contract.
func NewSyloTicketing(address common.Address, backend bind.ContractBackend) (*SyloTicketing, error) {
	contract, err := bindSyloTicketing(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &SyloTicketing{SyloTicketingCaller: SyloTicketingCaller{contract: contract}, SyloTicketingTransactor: SyloTicketingTransactor{contract: contract}, SyloTicketingFilterer: SyloTicketingFilterer{contract: contract}}, nil
}

// NewSyloTicketingCaller creates a new read-only instance of SyloTicketing, bound to a specific deployed contract.
func NewSyloTicketingCaller(address common.Address, caller bind.ContractCaller) (*SyloTicketingCaller, error) {
	contract, err := bindSyloTicketing(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &SyloTicketingCaller{contract: contract}, nil
}

// NewSyloTicketingTransactor creates a new write-only instance of SyloTicketing, bound to a specific deployed contract.
func NewSyloTicketingTransactor(address common.Address, transactor bind.ContractTransactor) (*SyloTicketingTransactor, error) {
	contract, err := bindSyloTicketing(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &SyloTicketingTransactor{contract: contract}, nil
}

// NewSyloTicketingFilterer creates a new log filterer instance of SyloTicketing, bound to a specific deployed contract.
func NewSyloTicketingFilterer(address common.Address, filterer bind.ContractFilterer) (*SyloTicketingFilterer, error) {
	contract, err := bindSyloTicketing(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &SyloTicketingFilterer{contract: contract}, nil
}

// bindSyloTicketing binds a generic wrapper to an already deployed contract.
func bindSyloTicketing(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := abi.JSON(strings.NewReader(SyloTicketingABI))
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_SyloTicketing *SyloTicketingRaw) Call(opts *bind.CallOpts, result interface{}, method string, params ...interface{}) error {
	return _SyloTicketing.Contract.SyloTicketingCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_SyloTicketing *SyloTicketingRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _SyloTicketing.Contract.SyloTicketingTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_SyloTicketing *SyloTicketingRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _SyloTicketing.Contract.SyloTicketingTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_SyloTicketing *SyloTicketingCallerRaw) Call(opts *bind.CallOpts, result interface{}, method string, params ...interface{}) error {
	return _SyloTicketing.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_SyloTicketing *SyloTicketingTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _SyloTicketing.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_SyloTicketing *SyloTicketingTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _SyloTicketing.Contract.contract.Transact(opts, method, params...)
}

// Deposits is a free data retrieval call binding the contract method 0xfc7e286d.
//
// Solidity: function deposits(address ) constant returns(uint256 escrow, uint256 penalty, uint256 unlockAt)
func (_SyloTicketing *SyloTicketingCaller) Deposits(opts *bind.CallOpts, arg0 common.Address) (struct {
	Escrow   *big.Int
	Penalty  *big.Int
	UnlockAt *big.Int
}, error) {
	ret := new(struct {
		Escrow   *big.Int
		Penalty  *big.Int
		UnlockAt *big.Int
	})
	out := ret
	err := _SyloTicketing.contract.Call(opts, out, "deposits", arg0)
	return *ret, err
}

// Deposits is a free data retrieval call binding the contract method 0xfc7e286d.
//
// Solidity: function deposits(address ) constant returns(uint256 escrow, uint256 penalty, uint256 unlockAt)
func (_SyloTicketing *SyloTicketingSession) Deposits(arg0 common.Address) (struct {
	Escrow   *big.Int
	Penalty  *big.Int
	UnlockAt *big.Int
}, error) {
	return _SyloTicketing.Contract.Deposits(&_SyloTicketing.CallOpts, arg0)
}

// Deposits is a free data retrieval call binding the contract method 0xfc7e286d.
//
// Solidity: function deposits(address ) constant returns(uint256 escrow, uint256 penalty, uint256 unlockAt)
func (_SyloTicketing *SyloTicketingCallerSession) Deposits(arg0 common.Address) (struct {
	Escrow   *big.Int
	Penalty  *big.Int
	UnlockAt *big.Int
}, error) {
	return _SyloTicketing.Contract.Deposits(&_SyloTicketing.CallOpts, arg0)
}

// GetTicketHash is a free data retrieval call binding the contract method 0x71e6af6e.
//
// Solidity: function getTicketHash(SyloTicketingTicket ticket) constant returns(bytes32)
func (_SyloTicketing *SyloTicketingCaller) GetTicketHash(opts *bind.CallOpts, ticket SyloTicketingTicket) ([32]byte, error) {
	var (
		ret0 = new([32]byte)
	)
	out := ret0
	err := _SyloTicketing.contract.Call(opts, out, "getTicketHash", ticket)
	return *ret0, err
}

// GetTicketHash is a free data retrieval call binding the contract method 0x71e6af6e.
//
// Solidity: function getTicketHash(SyloTicketingTicket ticket) constant returns(bytes32)
func (_SyloTicketing *SyloTicketingSession) GetTicketHash(ticket SyloTicketingTicket) ([32]byte, error) {
	return _SyloTicketing.Contract.GetTicketHash(&_SyloTicketing.CallOpts, ticket)
}

// GetTicketHash is a free data retrieval call binding the contract method 0x71e6af6e.
//
// Solidity: function getTicketHash(SyloTicketingTicket ticket) constant returns(bytes32)
func (_SyloTicketing *SyloTicketingCallerSession) GetTicketHash(ticket SyloTicketingTicket) ([32]byte, error) {
	return _SyloTicketing.Contract.GetTicketHash(&_SyloTicketing.CallOpts, ticket)
}

// Owner is a free data retrieval call binding the contract method 0x8da5cb5b.
//
// Solidity: function owner() constant returns(address)
func (_SyloTicketing *SyloTicketingCaller) Owner(opts *bind.CallOpts) (common.Address, error) {
	var (
		ret0 = new(common.Address)
	)
	out := ret0
	err := _SyloTicketing.contract.Call(opts, out, "owner")
	return *ret0, err
}

// Owner is a free data retrieval call binding the contract method 0x8da5cb5b.
//
// Solidity: function owner() constant returns(address)
func (_SyloTicketing *SyloTicketingSession) Owner() (common.Address, error) {
	return _SyloTicketing.Contract.Owner(&_SyloTicketing.CallOpts)
}

// Owner is a free data retrieval call binding the contract method 0x8da5cb5b.
//
// Solidity: function owner() constant returns(address)
func (_SyloTicketing *SyloTicketingCallerSession) Owner() (common.Address, error) {
	return _SyloTicketing.Contract.Owner(&_SyloTicketing.CallOpts)
}

// UnlockDuration is a free data retrieval call binding the contract method 0x8a1fcd60.
//
// Solidity: function unlockDuration() constant returns(uint256)
func (_SyloTicketing *SyloTicketingCaller) UnlockDuration(opts *bind.CallOpts) (*big.Int, error) {
	var (
		ret0 = new(*big.Int)
	)
	out := ret0
	err := _SyloTicketing.contract.Call(opts, out, "unlockDuration")
	return *ret0, err
}

// UnlockDuration is a free data retrieval call binding the contract method 0x8a1fcd60.
//
// Solidity: function unlockDuration() constant returns(uint256)
func (_SyloTicketing *SyloTicketingSession) UnlockDuration() (*big.Int, error) {
	return _SyloTicketing.Contract.UnlockDuration(&_SyloTicketing.CallOpts)
}

// UnlockDuration is a free data retrieval call binding the contract method 0x8a1fcd60.
//
// Solidity: function unlockDuration() constant returns(uint256)
func (_SyloTicketing *SyloTicketingCallerSession) UnlockDuration() (*big.Int, error) {
	return _SyloTicketing.Contract.UnlockDuration(&_SyloTicketing.CallOpts)
}

// UsedTickets is a free data retrieval call binding the contract method 0x59a515ba.
//
// Solidity: function usedTickets(bytes32 ) constant returns(bool)
func (_SyloTicketing *SyloTicketingCaller) UsedTickets(opts *bind.CallOpts, arg0 [32]byte) (bool, error) {
	var (
		ret0 = new(bool)
	)
	out := ret0
	err := _SyloTicketing.contract.Call(opts, out, "usedTickets", arg0)
	return *ret0, err
}

// UsedTickets is a free data retrieval call binding the contract method 0x59a515ba.
//
// Solidity: function usedTickets(bytes32 ) constant returns(bool)
func (_SyloTicketing *SyloTicketingSession) UsedTickets(arg0 [32]byte) (bool, error) {
	return _SyloTicketing.Contract.UsedTickets(&_SyloTicketing.CallOpts, arg0)
}

// UsedTickets is a free data retrieval call binding the contract method 0x59a515ba.
//
// Solidity: function usedTickets(bytes32 ) constant returns(bool)
func (_SyloTicketing *SyloTicketingCallerSession) UsedTickets(arg0 [32]byte) (bool, error) {
	return _SyloTicketing.Contract.UsedTickets(&_SyloTicketing.CallOpts, arg0)
}

// DepositEscrow is a paid mutator transaction binding the contract method 0xcb991efe.
//
// Solidity: function depositEscrow(uint256 amount) returns()
func (_SyloTicketing *SyloTicketingTransactor) DepositEscrow(opts *bind.TransactOpts, amount *big.Int) (*types.Transaction, error) {
	return _SyloTicketing.contract.Transact(opts, "depositEscrow", amount)
}

// DepositEscrow is a paid mutator transaction binding the contract method 0xcb991efe.
//
// Solidity: function depositEscrow(uint256 amount) returns()
func (_SyloTicketing *SyloTicketingSession) DepositEscrow(amount *big.Int) (*types.Transaction, error) {
	return _SyloTicketing.Contract.DepositEscrow(&_SyloTicketing.TransactOpts, amount)
}

// DepositEscrow is a paid mutator transaction binding the contract method 0xcb991efe.
//
// Solidity: function depositEscrow(uint256 amount) returns()
func (_SyloTicketing *SyloTicketingTransactorSession) DepositEscrow(amount *big.Int) (*types.Transaction, error) {
	return _SyloTicketing.Contract.DepositEscrow(&_SyloTicketing.TransactOpts, amount)
}

// DepositEscrowFor is a paid mutator transaction binding the contract method 0x6fd459dc.
//
// Solidity: function depositEscrowFor(uint256 amount, address account) returns()
func (_SyloTicketing *SyloTicketingTransactor) DepositEscrowFor(opts *bind.TransactOpts, amount *big.Int, account common.Address) (*types.Transaction, error) {
	return _SyloTicketing.contract.Transact(opts, "depositEscrowFor", amount, account)
}

// DepositEscrowFor is a paid mutator transaction binding the contract method 0x6fd459dc.
//
// Solidity: function depositEscrowFor(uint256 amount, address account) returns()
func (_SyloTicketing *SyloTicketingSession) DepositEscrowFor(amount *big.Int, account common.Address) (*types.Transaction, error) {
	return _SyloTicketing.Contract.DepositEscrowFor(&_SyloTicketing.TransactOpts, amount, account)
}

// DepositEscrowFor is a paid mutator transaction binding the contract method 0x6fd459dc.
//
// Solidity: function depositEscrowFor(uint256 amount, address account) returns()
func (_SyloTicketing *SyloTicketingTransactorSession) DepositEscrowFor(amount *big.Int, account common.Address) (*types.Transaction, error) {
	return _SyloTicketing.Contract.DepositEscrowFor(&_SyloTicketing.TransactOpts, amount, account)
}

// DepositPenalty is a paid mutator transaction binding the contract method 0x74d3fe72.
//
// Solidity: function depositPenalty(uint256 amount) returns()
func (_SyloTicketing *SyloTicketingTransactor) DepositPenalty(opts *bind.TransactOpts, amount *big.Int) (*types.Transaction, error) {
	return _SyloTicketing.contract.Transact(opts, "depositPenalty", amount)
}

// DepositPenalty is a paid mutator transaction binding the contract method 0x74d3fe72.
//
// Solidity: function depositPenalty(uint256 amount) returns()
func (_SyloTicketing *SyloTicketingSession) DepositPenalty(amount *big.Int) (*types.Transaction, error) {
	return _SyloTicketing.Contract.DepositPenalty(&_SyloTicketing.TransactOpts, amount)
}

// DepositPenalty is a paid mutator transaction binding the contract method 0x74d3fe72.
//
// Solidity: function depositPenalty(uint256 amount) returns()
func (_SyloTicketing *SyloTicketingTransactorSession) DepositPenalty(amount *big.Int) (*types.Transaction, error) {
	return _SyloTicketing.Contract.DepositPenalty(&_SyloTicketing.TransactOpts, amount)
}

// DepositPenaltyFor is a paid mutator transaction binding the contract method 0x8594b093.
//
// Solidity: function depositPenaltyFor(uint256 amount, address account) returns()
func (_SyloTicketing *SyloTicketingTransactor) DepositPenaltyFor(opts *bind.TransactOpts, amount *big.Int, account common.Address) (*types.Transaction, error) {
	return _SyloTicketing.contract.Transact(opts, "depositPenaltyFor", amount, account)
}

// DepositPenaltyFor is a paid mutator transaction binding the contract method 0x8594b093.
//
// Solidity: function depositPenaltyFor(uint256 amount, address account) returns()
func (_SyloTicketing *SyloTicketingSession) DepositPenaltyFor(amount *big.Int, account common.Address) (*types.Transaction, error) {
	return _SyloTicketing.Contract.DepositPenaltyFor(&_SyloTicketing.TransactOpts, amount, account)
}

// DepositPenaltyFor is a paid mutator transaction binding the contract method 0x8594b093.
//
// Solidity: function depositPenaltyFor(uint256 amount, address account) returns()
func (_SyloTicketing *SyloTicketingTransactorSession) DepositPenaltyFor(amount *big.Int, account common.Address) (*types.Transaction, error) {
	return _SyloTicketing.Contract.DepositPenaltyFor(&_SyloTicketing.TransactOpts, amount, account)
}

// LockDeposits is a paid mutator transaction binding the contract method 0xd088a231.
//
// Solidity: function lockDeposits() returns()
func (_SyloTicketing *SyloTicketingTransactor) LockDeposits(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _SyloTicketing.contract.Transact(opts, "lockDeposits")
}

// LockDeposits is a paid mutator transaction binding the contract method 0xd088a231.
//
// Solidity: function lockDeposits() returns()
func (_SyloTicketing *SyloTicketingSession) LockDeposits() (*types.Transaction, error) {
	return _SyloTicketing.Contract.LockDeposits(&_SyloTicketing.TransactOpts)
}

// LockDeposits is a paid mutator transaction binding the contract method 0xd088a231.
//
// Solidity: function lockDeposits() returns()
func (_SyloTicketing *SyloTicketingTransactorSession) LockDeposits() (*types.Transaction, error) {
	return _SyloTicketing.Contract.LockDeposits(&_SyloTicketing.TransactOpts)
}

// Redeem is a paid mutator transaction binding the contract method 0x4e055fe2.
//
// Solidity: function redeem(SyloTicketingTicket ticket, uint256 receiverRand, bytes sig) returns()
func (_SyloTicketing *SyloTicketingTransactor) Redeem(opts *bind.TransactOpts, ticket SyloTicketingTicket, receiverRand *big.Int, sig []byte) (*types.Transaction, error) {
	return _SyloTicketing.contract.Transact(opts, "redeem", ticket, receiverRand, sig)
}

// Redeem is a paid mutator transaction binding the contract method 0x4e055fe2.
//
// Solidity: function redeem(SyloTicketingTicket ticket, uint256 receiverRand, bytes sig) returns()
func (_SyloTicketing *SyloTicketingSession) Redeem(ticket SyloTicketingTicket, receiverRand *big.Int, sig []byte) (*types.Transaction, error) {
	return _SyloTicketing.Contract.Redeem(&_SyloTicketing.TransactOpts, ticket, receiverRand, sig)
}

// Redeem is a paid mutator transaction binding the contract method 0x4e055fe2.
//
// Solidity: function redeem(SyloTicketingTicket ticket, uint256 receiverRand, bytes sig) returns()
func (_SyloTicketing *SyloTicketingTransactorSession) Redeem(ticket SyloTicketingTicket, receiverRand *big.Int, sig []byte) (*types.Transaction, error) {
	return _SyloTicketing.Contract.Redeem(&_SyloTicketing.TransactOpts, ticket, receiverRand, sig)
}

// RenounceOwnership is a paid mutator transaction binding the contract method 0x715018a6.
//
// Solidity: function renounceOwnership() returns()
func (_SyloTicketing *SyloTicketingTransactor) RenounceOwnership(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _SyloTicketing.contract.Transact(opts, "renounceOwnership")
}

// RenounceOwnership is a paid mutator transaction binding the contract method 0x715018a6.
//
// Solidity: function renounceOwnership() returns()
func (_SyloTicketing *SyloTicketingSession) RenounceOwnership() (*types.Transaction, error) {
	return _SyloTicketing.Contract.RenounceOwnership(&_SyloTicketing.TransactOpts)
}

// RenounceOwnership is a paid mutator transaction binding the contract method 0x715018a6.
//
// Solidity: function renounceOwnership() returns()
func (_SyloTicketing *SyloTicketingTransactorSession) RenounceOwnership() (*types.Transaction, error) {
	return _SyloTicketing.Contract.RenounceOwnership(&_SyloTicketing.TransactOpts)
}

// SetUnlockDuration is a paid mutator transaction binding the contract method 0xdd900769.
//
// Solidity: function setUnlockDuration(uint256 newUnlockDuration) returns()
func (_SyloTicketing *SyloTicketingTransactor) SetUnlockDuration(opts *bind.TransactOpts, newUnlockDuration *big.Int) (*types.Transaction, error) {
	return _SyloTicketing.contract.Transact(opts, "setUnlockDuration", newUnlockDuration)
}

// SetUnlockDuration is a paid mutator transaction binding the contract method 0xdd900769.
//
// Solidity: function setUnlockDuration(uint256 newUnlockDuration) returns()
func (_SyloTicketing *SyloTicketingSession) SetUnlockDuration(newUnlockDuration *big.Int) (*types.Transaction, error) {
	return _SyloTicketing.Contract.SetUnlockDuration(&_SyloTicketing.TransactOpts, newUnlockDuration)
}

// SetUnlockDuration is a paid mutator transaction binding the contract method 0xdd900769.
//
// Solidity: function setUnlockDuration(uint256 newUnlockDuration) returns()
func (_SyloTicketing *SyloTicketingTransactorSession) SetUnlockDuration(newUnlockDuration *big.Int) (*types.Transaction, error) {
	return _SyloTicketing.Contract.SetUnlockDuration(&_SyloTicketing.TransactOpts, newUnlockDuration)
}

// TransferOwnership is a paid mutator transaction binding the contract method 0xf2fde38b.
//
// Solidity: function transferOwnership(address newOwner) returns()
func (_SyloTicketing *SyloTicketingTransactor) TransferOwnership(opts *bind.TransactOpts, newOwner common.Address) (*types.Transaction, error) {
	return _SyloTicketing.contract.Transact(opts, "transferOwnership", newOwner)
}

// TransferOwnership is a paid mutator transaction binding the contract method 0xf2fde38b.
//
// Solidity: function transferOwnership(address newOwner) returns()
func (_SyloTicketing *SyloTicketingSession) TransferOwnership(newOwner common.Address) (*types.Transaction, error) {
	return _SyloTicketing.Contract.TransferOwnership(&_SyloTicketing.TransactOpts, newOwner)
}

// TransferOwnership is a paid mutator transaction binding the contract method 0xf2fde38b.
//
// Solidity: function transferOwnership(address newOwner) returns()
func (_SyloTicketing *SyloTicketingTransactorSession) TransferOwnership(newOwner common.Address) (*types.Transaction, error) {
	return _SyloTicketing.Contract.TransferOwnership(&_SyloTicketing.TransactOpts, newOwner)
}

// UnlockDeposits is a paid mutator transaction binding the contract method 0x7d6babb4.
//
// Solidity: function unlockDeposits() returns(uint256)
func (_SyloTicketing *SyloTicketingTransactor) UnlockDeposits(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _SyloTicketing.contract.Transact(opts, "unlockDeposits")
}

// UnlockDeposits is a paid mutator transaction binding the contract method 0x7d6babb4.
//
// Solidity: function unlockDeposits() returns(uint256)
func (_SyloTicketing *SyloTicketingSession) UnlockDeposits() (*types.Transaction, error) {
	return _SyloTicketing.Contract.UnlockDeposits(&_SyloTicketing.TransactOpts)
}

// UnlockDeposits is a paid mutator transaction binding the contract method 0x7d6babb4.
//
// Solidity: function unlockDeposits() returns(uint256)
func (_SyloTicketing *SyloTicketingTransactorSession) UnlockDeposits() (*types.Transaction, error) {
	return _SyloTicketing.Contract.UnlockDeposits(&_SyloTicketing.TransactOpts)
}

// Withdraw is a paid mutator transaction binding the contract method 0x3ccfd60b.
//
// Solidity: function withdraw() returns()
func (_SyloTicketing *SyloTicketingTransactor) Withdraw(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _SyloTicketing.contract.Transact(opts, "withdraw")
}

// Withdraw is a paid mutator transaction binding the contract method 0x3ccfd60b.
//
// Solidity: function withdraw() returns()
func (_SyloTicketing *SyloTicketingSession) Withdraw() (*types.Transaction, error) {
	return _SyloTicketing.Contract.Withdraw(&_SyloTicketing.TransactOpts)
}

// Withdraw is a paid mutator transaction binding the contract method 0x3ccfd60b.
//
// Solidity: function withdraw() returns()
func (_SyloTicketing *SyloTicketingTransactorSession) Withdraw() (*types.Transaction, error) {
	return _SyloTicketing.Contract.Withdraw(&_SyloTicketing.TransactOpts)
}

// WithdrawTo is a paid mutator transaction binding the contract method 0x72b0d90c.
//
// Solidity: function withdrawTo(address account) returns()
func (_SyloTicketing *SyloTicketingTransactor) WithdrawTo(opts *bind.TransactOpts, account common.Address) (*types.Transaction, error) {
	return _SyloTicketing.contract.Transact(opts, "withdrawTo", account)
}

// WithdrawTo is a paid mutator transaction binding the contract method 0x72b0d90c.
//
// Solidity: function withdrawTo(address account) returns()
func (_SyloTicketing *SyloTicketingSession) WithdrawTo(account common.Address) (*types.Transaction, error) {
	return _SyloTicketing.Contract.WithdrawTo(&_SyloTicketing.TransactOpts, account)
}

// WithdrawTo is a paid mutator transaction binding the contract method 0x72b0d90c.
//
// Solidity: function withdrawTo(address account) returns()
func (_SyloTicketing *SyloTicketingTransactorSession) WithdrawTo(account common.Address) (*types.Transaction, error) {
	return _SyloTicketing.Contract.WithdrawTo(&_SyloTicketing.TransactOpts, account)
}

// SyloTicketingOwnershipTransferredIterator is returned from FilterOwnershipTransferred and is used to iterate over the raw logs and unpacked data for OwnershipTransferred events raised by the SyloTicketing contract.
type SyloTicketingOwnershipTransferredIterator struct {
	Event *SyloTicketingOwnershipTransferred // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *SyloTicketingOwnershipTransferredIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(SyloTicketingOwnershipTransferred)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(SyloTicketingOwnershipTransferred)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *SyloTicketingOwnershipTransferredIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *SyloTicketingOwnershipTransferredIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// SyloTicketingOwnershipTransferred represents a OwnershipTransferred event raised by the SyloTicketing contract.
type SyloTicketingOwnershipTransferred struct {
	PreviousOwner common.Address
	NewOwner      common.Address
	Raw           types.Log // Blockchain specific contextual infos
}

// FilterOwnershipTransferred is a free log retrieval operation binding the contract event 0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0.
//
// Solidity: event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
func (_SyloTicketing *SyloTicketingFilterer) FilterOwnershipTransferred(opts *bind.FilterOpts, previousOwner []common.Address, newOwner []common.Address) (*SyloTicketingOwnershipTransferredIterator, error) {

	var previousOwnerRule []interface{}
	for _, previousOwnerItem := range previousOwner {
		previousOwnerRule = append(previousOwnerRule, previousOwnerItem)
	}
	var newOwnerRule []interface{}
	for _, newOwnerItem := range newOwner {
		newOwnerRule = append(newOwnerRule, newOwnerItem)
	}

	logs, sub, err := _SyloTicketing.contract.FilterLogs(opts, "OwnershipTransferred", previousOwnerRule, newOwnerRule)
	if err != nil {
		return nil, err
	}
	return &SyloTicketingOwnershipTransferredIterator{contract: _SyloTicketing.contract, event: "OwnershipTransferred", logs: logs, sub: sub}, nil
}

// WatchOwnershipTransferred is a free log subscription operation binding the contract event 0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0.
//
// Solidity: event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
func (_SyloTicketing *SyloTicketingFilterer) WatchOwnershipTransferred(opts *bind.WatchOpts, sink chan<- *SyloTicketingOwnershipTransferred, previousOwner []common.Address, newOwner []common.Address) (event.Subscription, error) {

	var previousOwnerRule []interface{}
	for _, previousOwnerItem := range previousOwner {
		previousOwnerRule = append(previousOwnerRule, previousOwnerItem)
	}
	var newOwnerRule []interface{}
	for _, newOwnerItem := range newOwner {
		newOwnerRule = append(newOwnerRule, newOwnerItem)
	}

	logs, sub, err := _SyloTicketing.contract.WatchLogs(opts, "OwnershipTransferred", previousOwnerRule, newOwnerRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(SyloTicketingOwnershipTransferred)
				if err := _SyloTicketing.contract.UnpackLog(event, "OwnershipTransferred", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseOwnershipTransferred is a log parse operation binding the contract event 0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0.
//
// Solidity: event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
func (_SyloTicketing *SyloTicketingFilterer) ParseOwnershipTransferred(log types.Log) (*SyloTicketingOwnershipTransferred, error) {
	event := new(SyloTicketingOwnershipTransferred)
	if err := _SyloTicketing.contract.UnpackLog(event, "OwnershipTransferred", log); err != nil {
		return nil, err
	}
	return event, nil
}
