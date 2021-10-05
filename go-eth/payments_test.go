package eth_test

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/sha256"
	"math/big"
	"testing"
	"time"

	sylopayments "github.com/dn3010/sylo-ethereum-contracts/go-eth"
	"github.com/dn3010/sylo-ethereum-contracts/go-eth/contracts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

func TestPayments(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	backend, addresses, faucet, owner := sylopayments.StartupEthereum(t, ctx)
	t.Log("started ethereum")

	// create a node
	node, _ := sylopayments.CreateRandomClient(t, ctx, backend, addresses)
	t.Log("created node")
	depositEth(t, faucet, node, big.NewInt(1000000))
	t.Log("node deposited 1 eth")
	depositSylo(t, faucet, node, big.NewInt(1000000))
	t.Log("node deposited 1000000 sylo")

	// list
	sylopayments.List(t, ctx, backend, node, "0.0.0.0/0", big.NewInt(1))

	// stake
	sylopayments.Stake(t, ctx, backend, node, big.NewInt(600))
	t.Log("node A stake 600 sylo")

	// participate in next epoch
	sylopayments.JoinNextDirectory(t, ctx, backend, node)
	sylopayments.InitializeNextRewardPool(t, ctx, backend, node)

	// initialize epoch
	_, err := owner.TransferDirectoryOwnership(addresses.EpochsManager)
	if err != nil {
		t.Fatalf("could not transfer directory ownership: %v", err)
	}

	sylopayments.InitializeEpoch(t, ctx, backend, owner)

	// create alice
	alice, aliceSK := sylopayments.CreateRandomClient(t, ctx, backend, addresses)
	t.Log("created alice")
	depositEth(t, faucet, alice, big.NewInt(1000000))
	t.Log("bob deposited 1000000 wei")
	depositSylo(t, faucet, alice, big.NewInt(1000000))
	t.Log("alice deposited 1000000 sylo")
	sylopayments.TopUpDeposits(t, ctx, backend, alice)
	t.Log("alice set up escrow and penalty accounts")

	// create bob
	bob, bobSK := sylopayments.CreateRandomClient(t, ctx, backend, addresses)
	bobPK := &bobSK.PublicKey
	t.Log("created bob")
	depositEth(t, faucet, bob, big.NewInt(1000000))
	t.Log("bob deposited 1000000 wei")
	depositSylo(t, faucet, bob, big.NewInt(1000000))
	t.Log("bob deposited 1000000 sylo")
	sylopayments.TopUpDeposits(t, ctx, backend, bob)
	t.Log("bob set up escrow and penalty accounts")

	// alice scans for bob's node
	scanAddress, err := alice.Scan(hashPublicKey(bobPK))
	if err != nil {
		t.Fatalf("could not scan for bob's node: %v", err)
	}
	if !bytes.Equal(scanAddress.Bytes(), node.Address().Bytes()) {
		t.Fatalf("should get back the node's address")
	}
	t.Log("alice scanned and found the node to be serving bob")

	// alice makes a random number for the node
	aliceRand, aliceRandHash := createRandomNumber(t)

	// the node makes a random number for alice
	nodeRand, nodeRandHash := createRandomNumber(t)
	t.Log("alice received a random hash from the node")

	// alice creates a ticket for the scanned node
	ticket, sig := createSignedTicket(t, alice, aliceSK, node.Address(), aliceRandHash, nodeRandHash)
	t.Log("alice created a signed ticket for the node")

	// the node redeems the ticket
	redeemTicket(t, ctx, backend, node, ticket, aliceRand, nodeRand, sig)
	t.Log("node redeemed the ticket")
}

func depositEth(t *testing.T, faucet sylopayments.FaucetF, client sylopayments.Client, ethAmount *big.Int) {
	faucet(t, client.Address(), ethAmount, big.NewInt(0))
}

func depositSylo(t *testing.T, faucet sylopayments.FaucetF, client sylopayments.Client, syloAmount *big.Int) {
	faucet(t, client.Address(), big.NewInt(0), syloAmount)
}

func hashPublicKey(pk *ecdsa.PublicKey) *big.Int {
	hash := sha256.Sum256(crypto.FromECDSAPub(pk))
	return new(big.Int).SetBytes(hash[:16])
}

func createRandomNumber(t *testing.T) (n *big.Int, h [32]byte) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		t.Fatalf("could not read random bytes: %v", err)
	}
	randNum := new(big.Int).SetBytes(b)
	var randNumHash [32]byte
	copy(randNumHash[:], crypto.Keccak256(randNum.FillBytes(randNumHash[:])))
	return randNum, randNumHash
}

func createSignedTicket(t *testing.T, sender sylopayments.Client, senderPK *ecdsa.PrivateKey, receiver common.Address, senderCommit [32]byte, redeemerCommit [32]byte) (contracts.SyloTicketingTicket, []byte) {
	latestBlock, err := sender.LatestBlock()
	if err != nil {
		t.Fatalf("could not retrieve the latest block: %v", err)
	}

	epoch, err := sender.GetCurrentActiveEpoch()
	if err != nil {
		t.Fatalf("could not retrieve current epoch %v", err)
	}

	ticket := contracts.SyloTicketingTicket{
		EpochId:         epoch.Iteration,
		Sender:          sender.Address(),
		Redeemer:        receiver,
		SenderCommit:    senderCommit,
		RedeemerCommit:  redeemerCommit,
		GenerationBlock: latestBlock.Add(latestBlock, big.NewInt(1)),
	}

	ticketHash, err := sender.GetTicketHash(ticket)
	if err != nil {
		t.Fatalf("could not get ticket hash: %v", err)
	}

	sig, err := crypto.Sign(ticketHash[:], senderPK)
	if err != nil {
		t.Fatalf("could not sign hash: %v", err)
	}
	return ticket, sig
}

func redeemTicket(t *testing.T, ctx context.Context, backend sylopayments.SimBackend, client sylopayments.Client, ticket contracts.SyloTicketingTicket, senderRand *big.Int, redeemerRand *big.Int, sig []byte) {
	tx, err := client.Redeem(ticket, senderRand, redeemerRand, sig)
	if err != nil {
		t.Fatalf("could not redeem ticket: %v", err)
	}
	backend.Commit()

	_, err = client.CheckTx(ctx, tx)
	if err != nil {
		t.Fatalf("could not check transaction: %v", err)
	}
}
