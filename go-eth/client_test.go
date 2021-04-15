package eth_test

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"testing"
	"time"

	"github.com/dn3010/sylo-ethereum-contracts/go-eth"
	"github.com/dn3010/sylo-ethereum-contracts/go-eth/contracts"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/accounts/abi/bind/backends"
	ethcommon "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
)

const testPrivHex = "289c2857d4598e37fb9647507e47a309d6133539bf21a8b9cb6df88fd5232032"

var unlockDuration = big.NewInt(10)

func startSimulatedBackend(auth *bind.TransactOpts) eth.SimBackend {
	var gasLimit uint64 = 50000000

	genisis := make(core.GenesisAlloc)

	genisis[auth.From] = core.GenesisAccount{Balance: big.NewInt(1000000000000)}

	sim := backends.NewSimulatedBackend(genisis, gasLimit)

	return eth.NewSimBackend(sim)
}

func deployContracts(t *testing.T, ctx context.Context, auth *bind.TransactOpts, backend eth.SimBackend) eth.Addresses {

	var addresses eth.Addresses
	var err error
	var tx *types.Transaction

	// Deploying contracts can apparently panic if the transaction fails, so
	// we need to check for that.
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("panic during deployment of contracts: %v", r)
		}
	}()

	// deploy Sylo token
	addresses.Token, tx, _, err = contracts.DeploySyloToken(auth, backend)
	if err != nil {
		t.Fatalf("could not deploy sylo token: %v", err)
	}
	backend.Commit()
	_, err = backend.TransactionReceipt(ctx, tx.Hash())
	if err != nil {
		t.Fatalf("could not get transaction receipt: %v", err)
	}

	// deploy ticketing
	addresses.Ticketing, tx, _, err = contracts.DeploySyloTicketing(auth, backend, addresses.Token, unlockDuration)
	if err != nil {
		t.Fatalf("could not deploy ticketing: %v", err)
	}
	backend.Commit()
	_, err = backend.TransactionReceipt(ctx, tx.Hash())
	if err != nil {
		t.Fatalf("could not get transaction receipt: %v", err)
	}

	// deploy directory
	addresses.Directory, tx, _, err = contracts.DeployDirectory(auth, backend, addresses.Token, unlockDuration)
	if err != nil {
		t.Fatalf("could not deploy directory: %v", err)
	}
	backend.Commit()
	_, err = backend.TransactionReceipt(ctx, tx.Hash())
	if err != nil {
		t.Fatalf("could not get transaction receipt: %v", err)
	}

	// deploy listing
	addresses.Listings, tx, _, err = contracts.DeployListings(auth, backend)
	if err != nil {
		t.Fatalf("could not deploy listing: %v", err)
	}
	backend.Commit()
	_, err = backend.TransactionReceipt(ctx, tx.Hash())
	if err != nil {
		t.Fatalf("could not get transaction receipt: %v", err)
	}

	return addresses
}

func TestClient(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	chainID := big.NewInt(1337)

	key, _ := crypto.HexToECDSA(testPrivHex)
	auth, err := bind.NewKeyedTransactorWithChainID(key, chainID)
	if err != nil {
		t.Fatalf("could not create transaction signer: %v", err)
	}
	auth.Context = ctx

	backend := startSimulatedBackend(auth)
	addresses := deployContracts(t, ctx, auth, backend)

	var client eth.Client

	escrowAmount := big.NewInt(100000)
	penaltyAmount := big.NewInt(1000)

	t.Run("client can be created", func(t *testing.T) {
		if (addresses.Token == ethcommon.Address{}) {
			t.Error("Token address is empty")
		}

		if (addresses.Ticketing == ethcommon.Address{}) {
			t.Error("ticketingAddress address is empty")
		}

		client, err = eth.NewClientWithBackend(addresses, backend, auth)
		if err != nil {
			t.Fatalf("could not create client: %v", err)
		}
	})

	t.Run("can get latest block", func(t *testing.T) {
		blockNumberA, err := client.LatestBlock()
		if err != nil {
			t.Fatalf("could not get latest block: %v", err)
		}
		backend.Commit()
		blockNumberB, err := client.LatestBlock()
		if err != nil {
			t.Fatalf("could not get latest block: %v", err)
		}
		if !bigIntsEqual(blockNumberA.Add(blockNumberA, big.NewInt(1)), blockNumberB) {
			t.Fatalf("block number did not advance")
		}
	})

	t.Run("can deposit escrow", func(t *testing.T) {
		addEscrow(t, ctx, backend, client, auth.From, escrowAmount)

		deposit, err := client.Deposits(auth.From)
		if err != nil {
			t.Fatalf("could not get deposits: %v", err)
		}
		if !bigIntsEqual(deposit.Escrow, escrowAmount) {
			t.Fatalf("escrow deposit does not match: got %v: expected %v", deposit.Escrow, escrowAmount)
		}
	})

	t.Run("can deposit penalty", func(t *testing.T) {
		addPenalty(t, ctx, backend, client, auth.From, penaltyAmount)

		deposit, err := client.Deposits(auth.From)
		if err != nil {
			t.Fatalf("could not get deposits: %v", err)
		}
		if !bigIntsEqual(deposit.Penalty, penaltyAmount) {
			t.Fatalf("penalty deposit does not match: got %v: expected %v", deposit.Penalty, penaltyAmount)
		}
	})

	t.Run("can withdraw ticketing", func(t *testing.T) {
		tx, err := client.UnlockDeposits()
		if err != nil {
			t.Fatalf("could not unlock ticketing escrow: %v", err)
		}
		backend.Commit()

		_, err = client.CheckTx(ctx, tx)
		if err != nil {
			t.Fatalf("could not check transaction: %v", err)
		}

		_, err = client.Withdraw()
		if err == nil {
			t.Fatalf("expected error because unlock period isn't complete")
		}
		if !strings.HasSuffix(err.Error(), "Unlock period not complete") {
			t.Fatalf("could not withdraw: %v", err)
		}

		// advance enough blocks for the unlock period to end
		for i := uint64(0); i < unlockDuration.Uint64(); i++ {
			backend.Commit()
		}

		tx, err = client.Withdraw()
		if err != nil {
			t.Fatalf("could not withdraw: %v", err)
		}
		backend.Commit()
		_, err = client.CheckTx(ctx, tx)
		if err != nil {
			t.Fatalf("could not confirm transaction: %v", err)
		}

		deposit, err := client.Deposits(auth.From)
		if err != nil {
			t.Fatalf("could not get deposits: %v", err)
		}
		if !bigIntsEqual(deposit.Escrow, big.NewInt(0)) {
			t.Fatalf("escrow should be withdrawn")
		}
		if !bigIntsEqual(deposit.Penalty, big.NewInt(0)) {
			t.Fatalf("penalty should be withdrawn")
		}
	})

	t.Run("can redeem ticket", func(t *testing.T) {
		// make sure there is enough escrow
		deposit, err := client.Deposits(auth.From)
		if err != nil {
			t.Fatalf("could not get deposits: %v", err)
		}
		if deposit.Escrow.Cmp(escrowAmount) == -1 {
			addAmount := new(big.Int).Add(escrowAmount, new(big.Int).Neg(deposit.Escrow))
			addEscrow(t, ctx, backend, client, auth.From, addAmount)
		}

		receiver, err := eth.RandAddress()
		if err != nil {
			t.Fatalf("could not make random address: %v", err)
		}
		receiverRand := big.NewInt(1)

		var receiverRandHash [32]byte
		copy(receiverRandHash[:], crypto.Keccak256(receiverRand.FillBytes(receiverRandHash[:])))

		alwaysWin := new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 256), big.NewInt(1)) // 2^256-1
		ticket := contracts.SyloTicketingTicket{
			Sender:           auth.From,
			Receiver:         receiver,
			ReceiverRandHash: receiverRandHash,
			FaceValue:        big.NewInt(1),
			WinProb:          alwaysWin,
			ExpirationBlock:  big.NewInt(0),
			SenderNonce:      1,
		}

		ticketHash, err := client.GetTicketHash(ticket)
		if err != nil {
			t.Fatalf("could not get ticket hash: %v", err)
		}

		sig, err := crypto.Sign(ticketHash[:], key)
		if err != nil {
			t.Fatalf("could not sign hash: %v", err)
		}

		depositBefore, err := client.Deposits(ticket.Sender)
		if err != nil {
			t.Fatalf("could not get deposits: %v", err)
		}

		balanceBefore, err := client.BalanceOf(ticket.Receiver)
		if err != nil {
			t.Fatalf("could not get balance of receiver: %v", err)
		}

		tx, err := client.Redeem(ticket, receiverRand, sig)
		if err != nil {
			t.Fatalf("could not redeem ticket: %v", err)
		}
		backend.Commit()

		_, err = client.CheckTx(ctx, tx)
		if err != nil {
			t.Fatalf("could not check transaction: %v", err)
		}

		depositAfter, err := client.Deposits(ticket.Sender)
		if err != nil {
			t.Fatalf("could not get deposits: %v", err)
		}

		balanceAfter, err := client.BalanceOf(ticket.Receiver)
		if err != nil {
			t.Fatalf("could not get balance: %v", err)
		}

		if !bigIntsEqual(depositAfter.Escrow, new(big.Int).Add(depositBefore.Escrow, new(big.Int).Neg(ticket.FaceValue))) {
			t.Fatalf("escrow is %v: expected %v", depositAfter.Escrow, new(big.Int).Add(depositBefore.Escrow, new(big.Int).Neg(ticket.FaceValue)))
		}
		if !bigIntsEqual(balanceAfter, new(big.Int).Add(balanceBefore, ticket.FaceValue)) {
			t.Fatalf("balance is %v: expected %v", balanceAfter, new(big.Int).Add(balanceBefore, ticket.FaceValue))
		}
	})

	t.Run("cannot replay ticket", func(t *testing.T) {
		// receiver random number
		receiverRand := big.NewInt(2)

		var receiverRandHash [32]byte
		copy(receiverRandHash[:], crypto.Keccak256(receiverRand.FillBytes(receiverRandHash[:])))

		ticket := contracts.SyloTicketingTicket{
			Sender:           ethcommon.HexToAddress("0x970E8128AB834E8EAC17Ab8E3812F010678CF791"),
			Receiver:         ethcommon.HexToAddress("0x34D743d137a8cc298349F993b22B03Fea15c30c2"),
			ReceiverRandHash: receiverRandHash,
			FaceValue:        big.NewInt(1),
			WinProb:          new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 256), big.NewInt(1)), // 2^256-1
			ExpirationBlock:  big.NewInt(0),
			SenderNonce:      1,
		}

		ticketHash, err := client.GetTicketHash(ticket)
		if err != nil {
			t.Fatalf("could not get ticket hash: %v", err)
		}

		sig, err := crypto.Sign(ticketHash[:], key)
		if err != nil {
			t.Fatalf("could not sign hash: %v", err)
		}

		tx, err := client.Redeem(ticket, receiverRand, sig)
		if err != nil {
			t.Fatalf("could not redeem ticket: %v", err)
		}
		backend.Commit()

		_, err = client.CheckTx(ctx, tx)
		if err != nil {
			t.Fatalf("could not confirm transaction: %v", err)
		}

		_, err = client.Redeem(ticket, receiverRand, sig)
		if err == nil {
			t.Fatalf("expected error because ticket has already been used")
		}
		if !strings.HasSuffix(err.Error(), "Ticket already redeemed") {
			t.Fatalf("could not redeem: %v", err)
		}
	})

	t.Run("can unstake", func(t *testing.T) {
		stakeAmount := big.NewInt(1000)

		_, err = client.ApproveDirectory(stakeAmount)
		if err != nil {
			t.Fatalf("could not approve spending: %v", err)
		}
		backend.Commit()

		tx, err := client.AddStake(stakeAmount, auth.From)
		if err != nil {
			t.Fatalf("could not add stake: %v", err)
		}
		backend.Commit()

		_, err = client.CheckTx(ctx, tx)
		if err != nil {
			t.Fatalf("could not check transaction: %v", err)
		}

		tx, err = client.UnlockStake(stakeAmount, auth.From)
		if err != nil {
			t.Fatalf("could not unlock stake: %v", err)
		}
		backend.Commit()

		_, err = client.Unstake(auth.From)
		if err == nil {
			t.Fatalf("expected error because stake not yet unlocked")
		}
		if !strings.HasSuffix(err.Error(), "Stake not yet unlocked") {
			t.Fatalf("could not unstake: %v", err)
		}

		_, err = client.CheckTx(ctx, tx)
		if err != nil {
			t.Fatalf("could not check transaction: %v", err)
		}

		// Advance enough blocks for the unlock period to end
		for i := uint64(0); i < unlockDuration.Uint64(); i++ {
			backend.Commit()
		}

		balanceBefore, err := client.BalanceOf(auth.From)
		if err != nil {
			t.Fatalf("could not check balance: %v", err)
		}

		tx, err = client.Unstake(auth.From)
		if err != nil {
			t.Fatalf("could not unstake: %v", err)
		}
		backend.Commit()

		_, err = client.CheckTx(ctx, tx)
		if err != nil {
			t.Fatalf("could not check transaction: %v", err)
		}

		unlocking, err := client.GetUnlockingStake(auth.From, auth.From)
		if err != nil {
			t.Fatalf("could not check unlocking status: %v", err)
		}

		if !bigIntsEqual(unlocking.Amount, big.NewInt(0)) {
			t.Fatalf("unlocking amount should be zero")
		}
		if !bigIntsEqual(unlocking.UnlockAt, big.NewInt(0)) {
			t.Fatalf("unlocking at should be zero")
		}

		balanceAfter, err := client.BalanceOf(auth.From)
		if err != nil {
			t.Fatalf("could not check balance: %v", err)
		}

		// check the token balance has increased
		if !bigIntsEqual(balanceAfter, new(big.Int).Add(balanceBefore, stakeAmount)) {
			t.Fatalf("expected stake to be returned")
		}

		// should not be able to unstake again
		_, err = client.Unstake(auth.From)
		if err == nil {
			t.Fatalf("expected error because should not be able to unstake again")
		}
		if !strings.HasSuffix(err.Error(), "No amount to unlock") {
			t.Fatalf("could not unstake: %v", err)
		}
	})

	t.Run("can cancel unstaking", func(t *testing.T) {
		stakeAmount := big.NewInt(1000)

		_, err = client.ApproveDirectory(stakeAmount)
		if err != nil {
			t.Fatalf("could not approve staking amount: %v", err)
		}
		backend.Commit()

		tx, err := client.AddStake(stakeAmount, auth.From)
		if err != nil {
			t.Fatalf("could not add stake: %v", err)
		}
		backend.Commit()

		_, err = client.CheckTx(ctx, tx)
		if err != nil {
			t.Fatalf("could not check transaction: %v", err)
		}

		tx, err = client.UnlockStake(stakeAmount, auth.From)
		if err != nil {
			t.Fatalf("could not unlock stake: %v", err)
		}
		backend.Commit()

		_, err = client.CheckTx(ctx, tx)
		if err != nil {
			t.Fatalf("could not check transaction: %v", err)
		}

		_, err = client.LockStake(stakeAmount, auth.From)
		if err != nil {
			t.Fatalf("could not lock stake: %v", err)
		}
		backend.Commit()

		_, err = client.UnlockStake(stakeAmount, auth.From)
		if err != nil {
			t.Fatalf("could not unlock stake: %v", err)
		}
		backend.Commit()

		// Advance enough blocks for the unlock period to end
		for i := uint64(0); i < unlockDuration.Uint64(); i++ {
			backend.Commit()
		}

		_, err = client.LockStake(stakeAmount, auth.From)
		if err != nil {
			t.Fatalf("could not lock stake: %v", err)
		}
		backend.Commit()
	})
}

func addEscrow(t *testing.T, ctx context.Context, backend eth.SimBackend, client eth.Client, from ethcommon.Address, escrowAmount *big.Int) {
	err := addDeposit(ctx, backend, client, from, escrowAmount, client.DepositEscrow)
	if err != nil {
		t.Fatalf("could not add escrow amount: %v", err)
	}
}

func addPenalty(t *testing.T, ctx context.Context, backend eth.SimBackend, client eth.Client, from ethcommon.Address, penaltyAmount *big.Int) {
	err := addDeposit(ctx, backend, client, from, penaltyAmount, client.DepositPenalty)
	if err != nil {
		t.Fatalf("could not add penalty amount: %v", err)
	}
}

type depositF func(amount *big.Int, account ethcommon.Address) (*types.Transaction, error)

func addDeposit(ctx context.Context, backend eth.SimBackend, client eth.Client, from ethcommon.Address, amount *big.Int, f depositF) error {
	tx, err := client.ApproveTicketing(amount)
	if err != nil {
		return fmt.Errorf("could not approve penalty amount: %v", err)
	}
	backend.Commit()

	_, err = client.CheckTx(ctx, tx)
	if err != nil {
		return fmt.Errorf("could not check transaction: %v", err)
	}

	tx, err = f(amount, from)
	if err != nil {
		return fmt.Errorf("could not deposit penalty: %v", err)
	}
	backend.Commit()

	_, err = client.CheckTx(ctx, tx)
	if err != nil {
		return fmt.Errorf("could not confirm penalty deposit transaction: %v", err)
	}

	return nil
}

func bigIntsEqual(x *big.Int, y *big.Int) bool {
	return x.Cmp(y) == 0
}
