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
	_ = bind.Bind
	_ = common.Big1
	_ = types.BloomLookup
	_ = event.NewSubscription
)

// StakingManagerStake is an auto generated low-level Go binding around an user-defined struct.
type StakingManagerStake struct {
	Amount *big.Int
	Stakee common.Address
}

// StakingManagerABI is the input ABI used to generate the binding from.
const StakingManagerABI = "[{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"address\",\"name\":\"previousOwner\",\"type\":\"address\"},{\"indexed\":true,\"internalType\":\"address\",\"name\":\"newOwner\",\"type\":\"address\"}],\"name\":\"OwnershipTransferred\",\"type\":\"event\"},{\"inputs\":[],\"name\":\"owner\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"renounceOwnership\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"name\":\"stakees\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"name\":\"stakers\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"name\":\"stakes\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"stakee\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"totalStake\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"name\":\"totalStakes\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"newOwner\",\"type\":\"address\"}],\"name\":\"transferOwnership\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"unlockDuration\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"name\":\"unlockings\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"unlockAt\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"contractIERC20\",\"name\":\"token\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"_unlockDuration\",\"type\":\"uint256\"}],\"name\":\"initialize\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"newUnlockDuration\",\"type\":\"uint256\"}],\"name\":\"setUnlockDuration\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"stakee\",\"type\":\"address\"}],\"name\":\"addStake\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"stakee\",\"type\":\"address\"}],\"name\":\"unlockStake\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"stakee\",\"type\":\"address\"}],\"name\":\"withdrawStake\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"stakee\",\"type\":\"address\"}],\"name\":\"cancelUnlocking\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"staker\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"stakee\",\"type\":\"address\"}],\"name\":\"getKey\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"stateMutability\":\"pure\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"getCountOfStakees\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"count\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"getTotalStake\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"staker\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"stakee\",\"type\":\"address\"}],\"name\":\"getStake\",\"outputs\":[{\"components\":[{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"stakee\",\"type\":\"address\"}],\"internalType\":\"structStakingManager.Stake\",\"name\":\"\",\"type\":\"tuple\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"stakee\",\"type\":\"address\"}],\"name\":\"getStakers\",\"outputs\":[{\"internalType\":\"address[]\",\"name\":\"\",\"type\":\"address[]\"}],\"stateMutability\":\"view\",\"type\":\"function\"}]"

// StakingManagerBin is the compiled bytecode used for deploying new contracts.
var StakingManagerBin = "0x608060405234801561001057600080fd5b5061167c806100206000396000f3fe608060405234801561001057600080fd5b50600436106101775760003560e01c80638fee6407116100d8578063c8b6cbf71161008c578063dd90076911610066578063dd90076914610399578063df349ed5146103ac578063f2fde38b146103cc57600080fd5b8063c8b6cbf714610360578063cd6dc68714610373578063d2d6c0da1461038657600080fd5b8063a859f172116100bd578063a859f172146102e2578063bc298553146102f5578063c23a5cea1461034d57600080fd5b80638fee6407146102595780639341a536146102a657600080fd5b80637bc742251161012f5780638a1fcd60116101145780638a1fcd60146102225780638b0e9f3f1461022b5780638da5cb5b1461023457600080fd5b80637bc74225146101e357806382dda22d146101eb57600080fd5b806338b9437d1161016057806338b9437d146101a4578063715018a6146101bb57806379193610146101c357600080fd5b806323314c6c1461017c5780632d49aa1c14610191575b600080fd5b61018f61018a366004611557565b6103df565b005b61018f61019f366004611557565b6104e4565b606c545b6040519081526020015b60405180910390f35b61018f610596565b6101d66101d1366004611499565b6105fc565b6040516101b2919061157b565b606b546101a8565b6101fe6101f93660046114bc565b610672565b60408051825181526020928301516001600160a01b031692810192909252016101b2565b6101a860665481565b6101a8606b5481565b6033546001600160a01b03165b6040516001600160a01b0390911681526020016101b2565b61028961026736600461153f565b606860205260009081526040902080546001909101546001600160a01b031682565b604080519283526001600160a01b039091166020830152016101b2565b6102cd6102b436600461153f565b606d602052600090815260409020805460019091015482565b604080519283526020830191909152016101b2565b6101a86102f0366004611557565b610713565b6101a86103033660046114bc565b6040516bffffffffffffffffffffffff19606084811b8216602084015283901b16603482015260009060480160405160208183030381529060405280519060200120905092915050565b61018f61035b366004611499565b610bbd565b61024161036e3660046114f4565b610d7f565b61018f6103813660046114f4565b610db7565b61024161039436600461153f565b610e93565b61018f6103a736600461153f565b610ebd565b6101a86103ba366004611499565b606a6020526000908152604090205481565b61018f6103da366004611499565b610f1c565b600061043033836040516bffffffffffffffffffffffff19606084811b8216602084015283901b16603482015260009060480160405160208183030381529060405280519060200120905092915050565b6000818152606d60205260409020805491925090841415610465576000828152606d60205260408120818155600101556104d4565b805484106104ba5760405162461bcd60e51b815260206004820152601e60248201527f556e6c6f636b2068617320696e73756666696369656e7420616d6f756e74000060448201526064015b60405180910390fd5b838160000160008282546104ce91906115e0565b90915550505b6104de8484610ffe565b50505050565b6104ee8282610ffe565b6065546040517f23b872dd000000000000000000000000000000000000000000000000000000008152336004820152306024820152604481018490526001600160a01b03909116906323b872dd90606401602060405180830381600087803b15801561055957600080fd5b505af115801561056d573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610591919061151f565b505050565b6033546001600160a01b031633146105f05760405162461bcd60e51b815260206004820181905260248201527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e657260448201526064016104b1565b6105fa600061122d565b565b6001600160a01b03811660009081526069602090815260409182902080548351818402810184019094528084526060939283018282801561066657602002820191906000526020600020905b81546001600160a01b03168152600190910190602001808311610648575b50505050509050919050565b6040805180820190915260008082526020820152606860006106d985856040516bffffffffffffffffffffffff19606084811b8216602084015283901b16603482015260009060480160405160208183030381529060405280519060200120905092915050565b81526020808201929092526040908101600020815180830190925280548252600101546001600160a01b0316918101919091529392505050565b60008061076533846040516bffffffffffffffffffffffff19606084811b8216602084015283901b16603482015260009060480160405160208183030381529060405280519060200120905092915050565b60008181526068602052604090208054919250906107c55760405162461bcd60e51b815260206004820152601260248201527f4e6f7468696e6720746f20756e7374616b65000000000000000000000000000060448201526064016104b1565b80548511156108165760405162461bcd60e51b815260206004820152601e60248201527f43616e6e6f7420756e6c6f636b206d6f7265207468616e207374616b6564000060448201526064016104b1565b8481600001600082825461082a91906115e0565b909155505080546109c357600082815260686020908152604080832083815560010180546001600160a01b03191690556001600160a01b038716835260699091528120905b815463ffffffff821610156109c057336001600160a01b0316828263ffffffff16815481106108ae57634e487b7160e01b600052603260045260246000fd5b6000918252602090912001546001600160a01b031614156109ae57815482906108d9906001906115e0565b815481106108f757634e487b7160e01b600052603260045260246000fd5b9060005260206000200160009054906101000a90046001600160a01b0316828263ffffffff168154811061093b57634e487b7160e01b600052603260045260246000fd5b9060005260206000200160006101000a8154816001600160a01b0302191690836001600160a01b031602179055508180548061098757634e487b7160e01b600052603160045260246000fd5b600082815260209020810160001990810180546001600160a01b03191690550190556109c0565b806109b8816115f7565b91505061086f565b50505b6001600160a01b0384166000908152606a6020526040812080548792906109eb9084906115e0565b9250508190555084606b6000828254610a0491906115e0565b9091555050606b54610b655760005b606c5463ffffffff82161015610b6357846001600160a01b0316606c8263ffffffff1681548110610a5457634e487b7160e01b600052603260045260246000fd5b6000918252602090912001546001600160a01b03161415610b5157606c8054610a7f906001906115e0565b81548110610a9d57634e487b7160e01b600052603260045260246000fd5b600091825260209091200154606c80546001600160a01b039092169163ffffffff8416908110610add57634e487b7160e01b600052603260045260246000fd5b9060005260206000200160006101000a8154816001600160a01b0302191690836001600160a01b03160217905550606c805480610b2a57634e487b7160e01b600052603160045260246000fd5b600082815260209020810160001990810180546001600160a01b0319169055019055610b63565b80610b5b816115f7565b915050610a13565b505b6000828152606d60205260408120606654909190610b8390436115c8565b90508082600101541015610b9957600182018190555b86826000016000828254610bad91906115c8565b9091555090979650505050505050565b6000610c0e33836040516bffffffffffffffffffffffff19606084811b8216602084015283901b16603482015260009060480160405160208183030381529060405280519060200120905092915050565b6000818152606d602052604090206001810154919250904311610c735760405162461bcd60e51b815260206004820152601660248201527f5374616b65206e6f742079657420756e6c6f636b65640000000000000000000060448201526064016104b1565b8054610cc15760405162461bcd60e51b815260206004820152601560248201527f4e6f20616d6f756e7420746f207769746864726177000000000000000000000060448201526064016104b1565b80546000838152606d60205260408082208281556001019190915560655490517fa9059cbb000000000000000000000000000000000000000000000000000000008152336004820152602481018390526001600160a01b039091169063a9059cbb90604401602060405180830381600087803b158015610d4057600080fd5b505af1158015610d54573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610d78919061151f565b5050505050565b60696020528160005260406000208181548110610d9b57600080fd5b6000918252602090912001546001600160a01b03169150829050565b600054610100900460ff1680610dd0575060005460ff16155b610e335760405162461bcd60e51b815260206004820152602e60248201527f496e697469616c697a61626c653a20636f6e747261637420697320616c72656160448201526d191e481a5b9a5d1a585b1a5e995960921b60648201526084016104b1565b600054610100900460ff16158015610e55576000805461ffff19166101011790555b610e5d61127f565b606580546001600160a01b0319166001600160a01b03851617905560668290558015610591576000805461ff0019169055505050565b606c8181548110610ea357600080fd5b6000918252602090912001546001600160a01b0316905081565b6033546001600160a01b03163314610f175760405162461bcd60e51b815260206004820181905260248201527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e657260448201526064016104b1565b606655565b6033546001600160a01b03163314610f765760405162461bcd60e51b815260206004820181905260248201527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e657260448201526064016104b1565b6001600160a01b038116610ff25760405162461bcd60e51b815260206004820152602660248201527f4f776e61626c653a206e6577206f776e657220697320746865207a65726f206160448201527f646472657373000000000000000000000000000000000000000000000000000060648201526084016104b1565b610ffb8161122d565b50565b6001600160a01b0381166110545760405162461bcd60e51b815260206004820152600f60248201527f41646472657373206973206e756c6c000000000000000000000000000000000060448201526064016104b1565b816110a15760405162461bcd60e51b815260206004820152601460248201527f43616e6e6f74207374616b65206e6f7468696e6700000000000000000000000060448201526064016104b1565b3360006110f382846040516bffffffffffffffffffffffff19606084811b8216602084015283901b16603482015260009060480160405160208183030381529060405280519060200120905092915050565b600081815260686020526040902080549192509061115d576001600160a01b0380851660008181526069602090815260408220805460018181018355918452919092200180549387166001600160a01b031994851617905587845583018054909216179055611177565b8481600001600082825461117191906115c8565b90915550505b6001600160a01b0384166000908152606a60205260409020546111e057606c80546001810182556000919091527f2b4a51ab505fc96a0952efda2ba61bcd3078d4c02c39a186ec16f21883fbe0160180546001600160a01b0319166001600160a01b0386161790555b6001600160a01b0384166000908152606a6020526040812080548792906112089084906115c8565b9250508190555084606b600082825461122191906115c8565b90915550505050505050565b603380546001600160a01b038381166001600160a01b0319831681179093556040519116919082907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e090600090a35050565b600054610100900460ff1680611298575060005460ff16155b6112fb5760405162461bcd60e51b815260206004820152602e60248201527f496e697469616c697a61626c653a20636f6e747261637420697320616c72656160448201526d191e481a5b9a5d1a585b1a5e995960921b60648201526084016104b1565b600054610100900460ff1615801561131d576000805461ffff19166101011790555b611325611341565b61132d6113f2565b8015610ffb576000805461ff001916905550565b600054610100900460ff168061135a575060005460ff16155b6113bd5760405162461bcd60e51b815260206004820152602e60248201527f496e697469616c697a61626c653a20636f6e747261637420697320616c72656160448201526d191e481a5b9a5d1a585b1a5e995960921b60648201526084016104b1565b600054610100900460ff1615801561132d576000805461ffff19166101011790558015610ffb576000805461ff001916905550565b600054610100900460ff168061140b575060005460ff16155b61146e5760405162461bcd60e51b815260206004820152602e60248201527f496e697469616c697a61626c653a20636f6e747261637420697320616c72656160448201526d191e481a5b9a5d1a585b1a5e995960921b60648201526084016104b1565b600054610100900460ff16158015611490576000805461ffff19166101011790555b61132d3361122d565b6000602082840312156114aa578081fd5b81356114b581611631565b9392505050565b600080604083850312156114ce578081fd5b82356114d981611631565b915060208301356114e981611631565b809150509250929050565b60008060408385031215611506578182fd5b823561151181611631565b946020939093013593505050565b600060208284031215611530578081fd5b815180151581146114b5578182fd5b600060208284031215611550578081fd5b5035919050565b60008060408385031215611569578182fd5b8235915060208301356114e981611631565b6020808252825182820181905260009190848201906040850190845b818110156115bc5783516001600160a01b031683529284019291840191600101611597565b50909695505050505050565b600082198211156115db576115db61161b565b500190565b6000828210156115f2576115f261161b565b500390565b600063ffffffff808316818114156116115761161161161b565b6001019392505050565b634e487b7160e01b600052601160045260246000fd5b6001600160a01b0381168114610ffb57600080fdfea2646970667358221220b5515cb3a259cead09e613d4e38c9c0f136461275f56c414369b34c8c45accb464736f6c63430008040033"

// DeployStakingManager deploys a new Ethereum contract, binding an instance of StakingManager to it.
func DeployStakingManager(auth *bind.TransactOpts, backend bind.ContractBackend) (common.Address, *types.Transaction, *StakingManager, error) {
	parsed, err := abi.JSON(strings.NewReader(StakingManagerABI))
	if err != nil {
		return common.Address{}, nil, nil, err
	}

	address, tx, contract, err := bind.DeployContract(auth, parsed, common.FromHex(StakingManagerBin), backend)
	if err != nil {
		return common.Address{}, nil, nil, err
	}
	return address, tx, &StakingManager{StakingManagerCaller: StakingManagerCaller{contract: contract}, StakingManagerTransactor: StakingManagerTransactor{contract: contract}, StakingManagerFilterer: StakingManagerFilterer{contract: contract}}, nil
}

// StakingManager is an auto generated Go binding around an Ethereum contract.
type StakingManager struct {
	StakingManagerCaller     // Read-only binding to the contract
	StakingManagerTransactor // Write-only binding to the contract
	StakingManagerFilterer   // Log filterer for contract events
}

// StakingManagerCaller is an auto generated read-only Go binding around an Ethereum contract.
type StakingManagerCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// StakingManagerTransactor is an auto generated write-only Go binding around an Ethereum contract.
type StakingManagerTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// StakingManagerFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type StakingManagerFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// StakingManagerSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type StakingManagerSession struct {
	Contract     *StakingManager   // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// StakingManagerCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type StakingManagerCallerSession struct {
	Contract *StakingManagerCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts         // Call options to use throughout this session
}

// StakingManagerTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type StakingManagerTransactorSession struct {
	Contract     *StakingManagerTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts         // Transaction auth options to use throughout this session
}

// StakingManagerRaw is an auto generated low-level Go binding around an Ethereum contract.
type StakingManagerRaw struct {
	Contract *StakingManager // Generic contract binding to access the raw methods on
}

// StakingManagerCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type StakingManagerCallerRaw struct {
	Contract *StakingManagerCaller // Generic read-only contract binding to access the raw methods on
}

// StakingManagerTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type StakingManagerTransactorRaw struct {
	Contract *StakingManagerTransactor // Generic write-only contract binding to access the raw methods on
}

// NewStakingManager creates a new instance of StakingManager, bound to a specific deployed contract.
func NewStakingManager(address common.Address, backend bind.ContractBackend) (*StakingManager, error) {
	contract, err := bindStakingManager(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &StakingManager{StakingManagerCaller: StakingManagerCaller{contract: contract}, StakingManagerTransactor: StakingManagerTransactor{contract: contract}, StakingManagerFilterer: StakingManagerFilterer{contract: contract}}, nil
}

// NewStakingManagerCaller creates a new read-only instance of StakingManager, bound to a specific deployed contract.
func NewStakingManagerCaller(address common.Address, caller bind.ContractCaller) (*StakingManagerCaller, error) {
	contract, err := bindStakingManager(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &StakingManagerCaller{contract: contract}, nil
}

// NewStakingManagerTransactor creates a new write-only instance of StakingManager, bound to a specific deployed contract.
func NewStakingManagerTransactor(address common.Address, transactor bind.ContractTransactor) (*StakingManagerTransactor, error) {
	contract, err := bindStakingManager(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &StakingManagerTransactor{contract: contract}, nil
}

// NewStakingManagerFilterer creates a new log filterer instance of StakingManager, bound to a specific deployed contract.
func NewStakingManagerFilterer(address common.Address, filterer bind.ContractFilterer) (*StakingManagerFilterer, error) {
	contract, err := bindStakingManager(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &StakingManagerFilterer{contract: contract}, nil
}

// bindStakingManager binds a generic wrapper to an already deployed contract.
func bindStakingManager(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := abi.JSON(strings.NewReader(StakingManagerABI))
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_StakingManager *StakingManagerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _StakingManager.Contract.StakingManagerCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_StakingManager *StakingManagerRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _StakingManager.Contract.StakingManagerTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_StakingManager *StakingManagerRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _StakingManager.Contract.StakingManagerTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_StakingManager *StakingManagerCallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _StakingManager.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_StakingManager *StakingManagerTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _StakingManager.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_StakingManager *StakingManagerTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _StakingManager.Contract.contract.Transact(opts, method, params...)
}

// GetCountOfStakees is a free data retrieval call binding the contract method 0x38b9437d.
//
// Solidity: function getCountOfStakees() view returns(uint256 count)
func (_StakingManager *StakingManagerCaller) GetCountOfStakees(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _StakingManager.contract.Call(opts, &out, "getCountOfStakees")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// GetCountOfStakees is a free data retrieval call binding the contract method 0x38b9437d.
//
// Solidity: function getCountOfStakees() view returns(uint256 count)
func (_StakingManager *StakingManagerSession) GetCountOfStakees() (*big.Int, error) {
	return _StakingManager.Contract.GetCountOfStakees(&_StakingManager.CallOpts)
}

// GetCountOfStakees is a free data retrieval call binding the contract method 0x38b9437d.
//
// Solidity: function getCountOfStakees() view returns(uint256 count)
func (_StakingManager *StakingManagerCallerSession) GetCountOfStakees() (*big.Int, error) {
	return _StakingManager.Contract.GetCountOfStakees(&_StakingManager.CallOpts)
}

// GetKey is a free data retrieval call binding the contract method 0xbc298553.
//
// Solidity: function getKey(address staker, address stakee) pure returns(bytes32)
func (_StakingManager *StakingManagerCaller) GetKey(opts *bind.CallOpts, staker common.Address, stakee common.Address) ([32]byte, error) {
	var out []interface{}
	err := _StakingManager.contract.Call(opts, &out, "getKey", staker, stakee)

	if err != nil {
		return *new([32]byte), err
	}

	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)

	return out0, err

}

// GetKey is a free data retrieval call binding the contract method 0xbc298553.
//
// Solidity: function getKey(address staker, address stakee) pure returns(bytes32)
func (_StakingManager *StakingManagerSession) GetKey(staker common.Address, stakee common.Address) ([32]byte, error) {
	return _StakingManager.Contract.GetKey(&_StakingManager.CallOpts, staker, stakee)
}

// GetKey is a free data retrieval call binding the contract method 0xbc298553.
//
// Solidity: function getKey(address staker, address stakee) pure returns(bytes32)
func (_StakingManager *StakingManagerCallerSession) GetKey(staker common.Address, stakee common.Address) ([32]byte, error) {
	return _StakingManager.Contract.GetKey(&_StakingManager.CallOpts, staker, stakee)
}

// GetStake is a free data retrieval call binding the contract method 0x82dda22d.
//
// Solidity: function getStake(address staker, address stakee) view returns((uint256,address))
func (_StakingManager *StakingManagerCaller) GetStake(opts *bind.CallOpts, staker common.Address, stakee common.Address) (StakingManagerStake, error) {
	var out []interface{}
	err := _StakingManager.contract.Call(opts, &out, "getStake", staker, stakee)

	if err != nil {
		return *new(StakingManagerStake), err
	}

	out0 := *abi.ConvertType(out[0], new(StakingManagerStake)).(*StakingManagerStake)

	return out0, err

}

// GetStake is a free data retrieval call binding the contract method 0x82dda22d.
//
// Solidity: function getStake(address staker, address stakee) view returns((uint256,address))
func (_StakingManager *StakingManagerSession) GetStake(staker common.Address, stakee common.Address) (StakingManagerStake, error) {
	return _StakingManager.Contract.GetStake(&_StakingManager.CallOpts, staker, stakee)
}

// GetStake is a free data retrieval call binding the contract method 0x82dda22d.
//
// Solidity: function getStake(address staker, address stakee) view returns((uint256,address))
func (_StakingManager *StakingManagerCallerSession) GetStake(staker common.Address, stakee common.Address) (StakingManagerStake, error) {
	return _StakingManager.Contract.GetStake(&_StakingManager.CallOpts, staker, stakee)
}

// GetStakers is a free data retrieval call binding the contract method 0x79193610.
//
// Solidity: function getStakers(address stakee) view returns(address[])
func (_StakingManager *StakingManagerCaller) GetStakers(opts *bind.CallOpts, stakee common.Address) ([]common.Address, error) {
	var out []interface{}
	err := _StakingManager.contract.Call(opts, &out, "getStakers", stakee)

	if err != nil {
		return *new([]common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new([]common.Address)).(*[]common.Address)

	return out0, err

}

// GetStakers is a free data retrieval call binding the contract method 0x79193610.
//
// Solidity: function getStakers(address stakee) view returns(address[])
func (_StakingManager *StakingManagerSession) GetStakers(stakee common.Address) ([]common.Address, error) {
	return _StakingManager.Contract.GetStakers(&_StakingManager.CallOpts, stakee)
}

// GetStakers is a free data retrieval call binding the contract method 0x79193610.
//
// Solidity: function getStakers(address stakee) view returns(address[])
func (_StakingManager *StakingManagerCallerSession) GetStakers(stakee common.Address) ([]common.Address, error) {
	return _StakingManager.Contract.GetStakers(&_StakingManager.CallOpts, stakee)
}

// GetTotalStake is a free data retrieval call binding the contract method 0x7bc74225.
//
// Solidity: function getTotalStake() view returns(uint256)
func (_StakingManager *StakingManagerCaller) GetTotalStake(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _StakingManager.contract.Call(opts, &out, "getTotalStake")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// GetTotalStake is a free data retrieval call binding the contract method 0x7bc74225.
//
// Solidity: function getTotalStake() view returns(uint256)
func (_StakingManager *StakingManagerSession) GetTotalStake() (*big.Int, error) {
	return _StakingManager.Contract.GetTotalStake(&_StakingManager.CallOpts)
}

// GetTotalStake is a free data retrieval call binding the contract method 0x7bc74225.
//
// Solidity: function getTotalStake() view returns(uint256)
func (_StakingManager *StakingManagerCallerSession) GetTotalStake() (*big.Int, error) {
	return _StakingManager.Contract.GetTotalStake(&_StakingManager.CallOpts)
}

// Owner is a free data retrieval call binding the contract method 0x8da5cb5b.
//
// Solidity: function owner() view returns(address)
func (_StakingManager *StakingManagerCaller) Owner(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _StakingManager.contract.Call(opts, &out, "owner")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// Owner is a free data retrieval call binding the contract method 0x8da5cb5b.
//
// Solidity: function owner() view returns(address)
func (_StakingManager *StakingManagerSession) Owner() (common.Address, error) {
	return _StakingManager.Contract.Owner(&_StakingManager.CallOpts)
}

// Owner is a free data retrieval call binding the contract method 0x8da5cb5b.
//
// Solidity: function owner() view returns(address)
func (_StakingManager *StakingManagerCallerSession) Owner() (common.Address, error) {
	return _StakingManager.Contract.Owner(&_StakingManager.CallOpts)
}

// Stakees is a free data retrieval call binding the contract method 0xd2d6c0da.
//
// Solidity: function stakees(uint256 ) view returns(address)
func (_StakingManager *StakingManagerCaller) Stakees(opts *bind.CallOpts, arg0 *big.Int) (common.Address, error) {
	var out []interface{}
	err := _StakingManager.contract.Call(opts, &out, "stakees", arg0)

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// Stakees is a free data retrieval call binding the contract method 0xd2d6c0da.
//
// Solidity: function stakees(uint256 ) view returns(address)
func (_StakingManager *StakingManagerSession) Stakees(arg0 *big.Int) (common.Address, error) {
	return _StakingManager.Contract.Stakees(&_StakingManager.CallOpts, arg0)
}

// Stakees is a free data retrieval call binding the contract method 0xd2d6c0da.
//
// Solidity: function stakees(uint256 ) view returns(address)
func (_StakingManager *StakingManagerCallerSession) Stakees(arg0 *big.Int) (common.Address, error) {
	return _StakingManager.Contract.Stakees(&_StakingManager.CallOpts, arg0)
}

// Stakers is a free data retrieval call binding the contract method 0xc8b6cbf7.
//
// Solidity: function stakers(address , uint256 ) view returns(address)
func (_StakingManager *StakingManagerCaller) Stakers(opts *bind.CallOpts, arg0 common.Address, arg1 *big.Int) (common.Address, error) {
	var out []interface{}
	err := _StakingManager.contract.Call(opts, &out, "stakers", arg0, arg1)

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// Stakers is a free data retrieval call binding the contract method 0xc8b6cbf7.
//
// Solidity: function stakers(address , uint256 ) view returns(address)
func (_StakingManager *StakingManagerSession) Stakers(arg0 common.Address, arg1 *big.Int) (common.Address, error) {
	return _StakingManager.Contract.Stakers(&_StakingManager.CallOpts, arg0, arg1)
}

// Stakers is a free data retrieval call binding the contract method 0xc8b6cbf7.
//
// Solidity: function stakers(address , uint256 ) view returns(address)
func (_StakingManager *StakingManagerCallerSession) Stakers(arg0 common.Address, arg1 *big.Int) (common.Address, error) {
	return _StakingManager.Contract.Stakers(&_StakingManager.CallOpts, arg0, arg1)
}

// Stakes is a free data retrieval call binding the contract method 0x8fee6407.
//
// Solidity: function stakes(bytes32 ) view returns(uint256 amount, address stakee)
func (_StakingManager *StakingManagerCaller) Stakes(opts *bind.CallOpts, arg0 [32]byte) (struct {
	Amount *big.Int
	Stakee common.Address
}, error) {
	var out []interface{}
	err := _StakingManager.contract.Call(opts, &out, "stakes", arg0)

	outstruct := new(struct {
		Amount *big.Int
		Stakee common.Address
	})
	if err != nil {
		return *outstruct, err
	}

	outstruct.Amount = *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)
	outstruct.Stakee = *abi.ConvertType(out[1], new(common.Address)).(*common.Address)

	return *outstruct, err

}

// Stakes is a free data retrieval call binding the contract method 0x8fee6407.
//
// Solidity: function stakes(bytes32 ) view returns(uint256 amount, address stakee)
func (_StakingManager *StakingManagerSession) Stakes(arg0 [32]byte) (struct {
	Amount *big.Int
	Stakee common.Address
}, error) {
	return _StakingManager.Contract.Stakes(&_StakingManager.CallOpts, arg0)
}

// Stakes is a free data retrieval call binding the contract method 0x8fee6407.
//
// Solidity: function stakes(bytes32 ) view returns(uint256 amount, address stakee)
func (_StakingManager *StakingManagerCallerSession) Stakes(arg0 [32]byte) (struct {
	Amount *big.Int
	Stakee common.Address
}, error) {
	return _StakingManager.Contract.Stakes(&_StakingManager.CallOpts, arg0)
}

// TotalStake is a free data retrieval call binding the contract method 0x8b0e9f3f.
//
// Solidity: function totalStake() view returns(uint256)
func (_StakingManager *StakingManagerCaller) TotalStake(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _StakingManager.contract.Call(opts, &out, "totalStake")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// TotalStake is a free data retrieval call binding the contract method 0x8b0e9f3f.
//
// Solidity: function totalStake() view returns(uint256)
func (_StakingManager *StakingManagerSession) TotalStake() (*big.Int, error) {
	return _StakingManager.Contract.TotalStake(&_StakingManager.CallOpts)
}

// TotalStake is a free data retrieval call binding the contract method 0x8b0e9f3f.
//
// Solidity: function totalStake() view returns(uint256)
func (_StakingManager *StakingManagerCallerSession) TotalStake() (*big.Int, error) {
	return _StakingManager.Contract.TotalStake(&_StakingManager.CallOpts)
}

// TotalStakes is a free data retrieval call binding the contract method 0xdf349ed5.
//
// Solidity: function totalStakes(address ) view returns(uint256)
func (_StakingManager *StakingManagerCaller) TotalStakes(opts *bind.CallOpts, arg0 common.Address) (*big.Int, error) {
	var out []interface{}
	err := _StakingManager.contract.Call(opts, &out, "totalStakes", arg0)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// TotalStakes is a free data retrieval call binding the contract method 0xdf349ed5.
//
// Solidity: function totalStakes(address ) view returns(uint256)
func (_StakingManager *StakingManagerSession) TotalStakes(arg0 common.Address) (*big.Int, error) {
	return _StakingManager.Contract.TotalStakes(&_StakingManager.CallOpts, arg0)
}

// TotalStakes is a free data retrieval call binding the contract method 0xdf349ed5.
//
// Solidity: function totalStakes(address ) view returns(uint256)
func (_StakingManager *StakingManagerCallerSession) TotalStakes(arg0 common.Address) (*big.Int, error) {
	return _StakingManager.Contract.TotalStakes(&_StakingManager.CallOpts, arg0)
}

// UnlockDuration is a free data retrieval call binding the contract method 0x8a1fcd60.
//
// Solidity: function unlockDuration() view returns(uint256)
func (_StakingManager *StakingManagerCaller) UnlockDuration(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _StakingManager.contract.Call(opts, &out, "unlockDuration")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// UnlockDuration is a free data retrieval call binding the contract method 0x8a1fcd60.
//
// Solidity: function unlockDuration() view returns(uint256)
func (_StakingManager *StakingManagerSession) UnlockDuration() (*big.Int, error) {
	return _StakingManager.Contract.UnlockDuration(&_StakingManager.CallOpts)
}

// UnlockDuration is a free data retrieval call binding the contract method 0x8a1fcd60.
//
// Solidity: function unlockDuration() view returns(uint256)
func (_StakingManager *StakingManagerCallerSession) UnlockDuration() (*big.Int, error) {
	return _StakingManager.Contract.UnlockDuration(&_StakingManager.CallOpts)
}

// Unlockings is a free data retrieval call binding the contract method 0x9341a536.
//
// Solidity: function unlockings(bytes32 ) view returns(uint256 amount, uint256 unlockAt)
func (_StakingManager *StakingManagerCaller) Unlockings(opts *bind.CallOpts, arg0 [32]byte) (struct {
	Amount   *big.Int
	UnlockAt *big.Int
}, error) {
	var out []interface{}
	err := _StakingManager.contract.Call(opts, &out, "unlockings", arg0)

	outstruct := new(struct {
		Amount   *big.Int
		UnlockAt *big.Int
	})
	if err != nil {
		return *outstruct, err
	}

	outstruct.Amount = *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)
	outstruct.UnlockAt = *abi.ConvertType(out[1], new(*big.Int)).(**big.Int)

	return *outstruct, err

}

// Unlockings is a free data retrieval call binding the contract method 0x9341a536.
//
// Solidity: function unlockings(bytes32 ) view returns(uint256 amount, uint256 unlockAt)
func (_StakingManager *StakingManagerSession) Unlockings(arg0 [32]byte) (struct {
	Amount   *big.Int
	UnlockAt *big.Int
}, error) {
	return _StakingManager.Contract.Unlockings(&_StakingManager.CallOpts, arg0)
}

// Unlockings is a free data retrieval call binding the contract method 0x9341a536.
//
// Solidity: function unlockings(bytes32 ) view returns(uint256 amount, uint256 unlockAt)
func (_StakingManager *StakingManagerCallerSession) Unlockings(arg0 [32]byte) (struct {
	Amount   *big.Int
	UnlockAt *big.Int
}, error) {
	return _StakingManager.Contract.Unlockings(&_StakingManager.CallOpts, arg0)
}

// AddStake is a paid mutator transaction binding the contract method 0x2d49aa1c.
//
// Solidity: function addStake(uint256 amount, address stakee) returns()
func (_StakingManager *StakingManagerTransactor) AddStake(opts *bind.TransactOpts, amount *big.Int, stakee common.Address) (*types.Transaction, error) {
	return _StakingManager.contract.Transact(opts, "addStake", amount, stakee)
}

// AddStake is a paid mutator transaction binding the contract method 0x2d49aa1c.
//
// Solidity: function addStake(uint256 amount, address stakee) returns()
func (_StakingManager *StakingManagerSession) AddStake(amount *big.Int, stakee common.Address) (*types.Transaction, error) {
	return _StakingManager.Contract.AddStake(&_StakingManager.TransactOpts, amount, stakee)
}

// AddStake is a paid mutator transaction binding the contract method 0x2d49aa1c.
//
// Solidity: function addStake(uint256 amount, address stakee) returns()
func (_StakingManager *StakingManagerTransactorSession) AddStake(amount *big.Int, stakee common.Address) (*types.Transaction, error) {
	return _StakingManager.Contract.AddStake(&_StakingManager.TransactOpts, amount, stakee)
}

// CancelUnlocking is a paid mutator transaction binding the contract method 0x23314c6c.
//
// Solidity: function cancelUnlocking(uint256 amount, address stakee) returns()
func (_StakingManager *StakingManagerTransactor) CancelUnlocking(opts *bind.TransactOpts, amount *big.Int, stakee common.Address) (*types.Transaction, error) {
	return _StakingManager.contract.Transact(opts, "cancelUnlocking", amount, stakee)
}

// CancelUnlocking is a paid mutator transaction binding the contract method 0x23314c6c.
//
// Solidity: function cancelUnlocking(uint256 amount, address stakee) returns()
func (_StakingManager *StakingManagerSession) CancelUnlocking(amount *big.Int, stakee common.Address) (*types.Transaction, error) {
	return _StakingManager.Contract.CancelUnlocking(&_StakingManager.TransactOpts, amount, stakee)
}

// CancelUnlocking is a paid mutator transaction binding the contract method 0x23314c6c.
//
// Solidity: function cancelUnlocking(uint256 amount, address stakee) returns()
func (_StakingManager *StakingManagerTransactorSession) CancelUnlocking(amount *big.Int, stakee common.Address) (*types.Transaction, error) {
	return _StakingManager.Contract.CancelUnlocking(&_StakingManager.TransactOpts, amount, stakee)
}

// Initialize is a paid mutator transaction binding the contract method 0xcd6dc687.
//
// Solidity: function initialize(address token, uint256 _unlockDuration) returns()
func (_StakingManager *StakingManagerTransactor) Initialize(opts *bind.TransactOpts, token common.Address, _unlockDuration *big.Int) (*types.Transaction, error) {
	return _StakingManager.contract.Transact(opts, "initialize", token, _unlockDuration)
}

// Initialize is a paid mutator transaction binding the contract method 0xcd6dc687.
//
// Solidity: function initialize(address token, uint256 _unlockDuration) returns()
func (_StakingManager *StakingManagerSession) Initialize(token common.Address, _unlockDuration *big.Int) (*types.Transaction, error) {
	return _StakingManager.Contract.Initialize(&_StakingManager.TransactOpts, token, _unlockDuration)
}

// Initialize is a paid mutator transaction binding the contract method 0xcd6dc687.
//
// Solidity: function initialize(address token, uint256 _unlockDuration) returns()
func (_StakingManager *StakingManagerTransactorSession) Initialize(token common.Address, _unlockDuration *big.Int) (*types.Transaction, error) {
	return _StakingManager.Contract.Initialize(&_StakingManager.TransactOpts, token, _unlockDuration)
}

// RenounceOwnership is a paid mutator transaction binding the contract method 0x715018a6.
//
// Solidity: function renounceOwnership() returns()
func (_StakingManager *StakingManagerTransactor) RenounceOwnership(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _StakingManager.contract.Transact(opts, "renounceOwnership")
}

// RenounceOwnership is a paid mutator transaction binding the contract method 0x715018a6.
//
// Solidity: function renounceOwnership() returns()
func (_StakingManager *StakingManagerSession) RenounceOwnership() (*types.Transaction, error) {
	return _StakingManager.Contract.RenounceOwnership(&_StakingManager.TransactOpts)
}

// RenounceOwnership is a paid mutator transaction binding the contract method 0x715018a6.
//
// Solidity: function renounceOwnership() returns()
func (_StakingManager *StakingManagerTransactorSession) RenounceOwnership() (*types.Transaction, error) {
	return _StakingManager.Contract.RenounceOwnership(&_StakingManager.TransactOpts)
}

// SetUnlockDuration is a paid mutator transaction binding the contract method 0xdd900769.
//
// Solidity: function setUnlockDuration(uint256 newUnlockDuration) returns()
func (_StakingManager *StakingManagerTransactor) SetUnlockDuration(opts *bind.TransactOpts, newUnlockDuration *big.Int) (*types.Transaction, error) {
	return _StakingManager.contract.Transact(opts, "setUnlockDuration", newUnlockDuration)
}

// SetUnlockDuration is a paid mutator transaction binding the contract method 0xdd900769.
//
// Solidity: function setUnlockDuration(uint256 newUnlockDuration) returns()
func (_StakingManager *StakingManagerSession) SetUnlockDuration(newUnlockDuration *big.Int) (*types.Transaction, error) {
	return _StakingManager.Contract.SetUnlockDuration(&_StakingManager.TransactOpts, newUnlockDuration)
}

// SetUnlockDuration is a paid mutator transaction binding the contract method 0xdd900769.
//
// Solidity: function setUnlockDuration(uint256 newUnlockDuration) returns()
func (_StakingManager *StakingManagerTransactorSession) SetUnlockDuration(newUnlockDuration *big.Int) (*types.Transaction, error) {
	return _StakingManager.Contract.SetUnlockDuration(&_StakingManager.TransactOpts, newUnlockDuration)
}

// TransferOwnership is a paid mutator transaction binding the contract method 0xf2fde38b.
//
// Solidity: function transferOwnership(address newOwner) returns()
func (_StakingManager *StakingManagerTransactor) TransferOwnership(opts *bind.TransactOpts, newOwner common.Address) (*types.Transaction, error) {
	return _StakingManager.contract.Transact(opts, "transferOwnership", newOwner)
}

// TransferOwnership is a paid mutator transaction binding the contract method 0xf2fde38b.
//
// Solidity: function transferOwnership(address newOwner) returns()
func (_StakingManager *StakingManagerSession) TransferOwnership(newOwner common.Address) (*types.Transaction, error) {
	return _StakingManager.Contract.TransferOwnership(&_StakingManager.TransactOpts, newOwner)
}

// TransferOwnership is a paid mutator transaction binding the contract method 0xf2fde38b.
//
// Solidity: function transferOwnership(address newOwner) returns()
func (_StakingManager *StakingManagerTransactorSession) TransferOwnership(newOwner common.Address) (*types.Transaction, error) {
	return _StakingManager.Contract.TransferOwnership(&_StakingManager.TransactOpts, newOwner)
}

// UnlockStake is a paid mutator transaction binding the contract method 0xa859f172.
//
// Solidity: function unlockStake(uint256 amount, address stakee) returns(uint256)
func (_StakingManager *StakingManagerTransactor) UnlockStake(opts *bind.TransactOpts, amount *big.Int, stakee common.Address) (*types.Transaction, error) {
	return _StakingManager.contract.Transact(opts, "unlockStake", amount, stakee)
}

// UnlockStake is a paid mutator transaction binding the contract method 0xa859f172.
//
// Solidity: function unlockStake(uint256 amount, address stakee) returns(uint256)
func (_StakingManager *StakingManagerSession) UnlockStake(amount *big.Int, stakee common.Address) (*types.Transaction, error) {
	return _StakingManager.Contract.UnlockStake(&_StakingManager.TransactOpts, amount, stakee)
}

// UnlockStake is a paid mutator transaction binding the contract method 0xa859f172.
//
// Solidity: function unlockStake(uint256 amount, address stakee) returns(uint256)
func (_StakingManager *StakingManagerTransactorSession) UnlockStake(amount *big.Int, stakee common.Address) (*types.Transaction, error) {
	return _StakingManager.Contract.UnlockStake(&_StakingManager.TransactOpts, amount, stakee)
}

// WithdrawStake is a paid mutator transaction binding the contract method 0xc23a5cea.
//
// Solidity: function withdrawStake(address stakee) returns()
func (_StakingManager *StakingManagerTransactor) WithdrawStake(opts *bind.TransactOpts, stakee common.Address) (*types.Transaction, error) {
	return _StakingManager.contract.Transact(opts, "withdrawStake", stakee)
}

// WithdrawStake is a paid mutator transaction binding the contract method 0xc23a5cea.
//
// Solidity: function withdrawStake(address stakee) returns()
func (_StakingManager *StakingManagerSession) WithdrawStake(stakee common.Address) (*types.Transaction, error) {
	return _StakingManager.Contract.WithdrawStake(&_StakingManager.TransactOpts, stakee)
}

// WithdrawStake is a paid mutator transaction binding the contract method 0xc23a5cea.
//
// Solidity: function withdrawStake(address stakee) returns()
func (_StakingManager *StakingManagerTransactorSession) WithdrawStake(stakee common.Address) (*types.Transaction, error) {
	return _StakingManager.Contract.WithdrawStake(&_StakingManager.TransactOpts, stakee)
}

// StakingManagerOwnershipTransferredIterator is returned from FilterOwnershipTransferred and is used to iterate over the raw logs and unpacked data for OwnershipTransferred events raised by the StakingManager contract.
type StakingManagerOwnershipTransferredIterator struct {
	Event *StakingManagerOwnershipTransferred // Event containing the contract specifics and raw log

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
func (it *StakingManagerOwnershipTransferredIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(StakingManagerOwnershipTransferred)
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
		it.Event = new(StakingManagerOwnershipTransferred)
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
func (it *StakingManagerOwnershipTransferredIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *StakingManagerOwnershipTransferredIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// StakingManagerOwnershipTransferred represents a OwnershipTransferred event raised by the StakingManager contract.
type StakingManagerOwnershipTransferred struct {
	PreviousOwner common.Address
	NewOwner      common.Address
	Raw           types.Log // Blockchain specific contextual infos
}

// FilterOwnershipTransferred is a free log retrieval operation binding the contract event 0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0.
//
// Solidity: event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
func (_StakingManager *StakingManagerFilterer) FilterOwnershipTransferred(opts *bind.FilterOpts, previousOwner []common.Address, newOwner []common.Address) (*StakingManagerOwnershipTransferredIterator, error) {

	var previousOwnerRule []interface{}
	for _, previousOwnerItem := range previousOwner {
		previousOwnerRule = append(previousOwnerRule, previousOwnerItem)
	}
	var newOwnerRule []interface{}
	for _, newOwnerItem := range newOwner {
		newOwnerRule = append(newOwnerRule, newOwnerItem)
	}

	logs, sub, err := _StakingManager.contract.FilterLogs(opts, "OwnershipTransferred", previousOwnerRule, newOwnerRule)
	if err != nil {
		return nil, err
	}
	return &StakingManagerOwnershipTransferredIterator{contract: _StakingManager.contract, event: "OwnershipTransferred", logs: logs, sub: sub}, nil
}

// WatchOwnershipTransferred is a free log subscription operation binding the contract event 0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0.
//
// Solidity: event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
func (_StakingManager *StakingManagerFilterer) WatchOwnershipTransferred(opts *bind.WatchOpts, sink chan<- *StakingManagerOwnershipTransferred, previousOwner []common.Address, newOwner []common.Address) (event.Subscription, error) {

	var previousOwnerRule []interface{}
	for _, previousOwnerItem := range previousOwner {
		previousOwnerRule = append(previousOwnerRule, previousOwnerItem)
	}
	var newOwnerRule []interface{}
	for _, newOwnerItem := range newOwner {
		newOwnerRule = append(newOwnerRule, newOwnerItem)
	}

	logs, sub, err := _StakingManager.contract.WatchLogs(opts, "OwnershipTransferred", previousOwnerRule, newOwnerRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(StakingManagerOwnershipTransferred)
				if err := _StakingManager.contract.UnpackLog(event, "OwnershipTransferred", log); err != nil {
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
func (_StakingManager *StakingManagerFilterer) ParseOwnershipTransferred(log types.Log) (*StakingManagerOwnershipTransferred, error) {
	event := new(StakingManagerOwnershipTransferred)
	if err := _StakingManager.contract.UnpackLog(event, "OwnershipTransferred", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}
