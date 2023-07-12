package main

import (
	"errors"
	"github.com/shopspring/decimal"
	"strings"
	"sync"
	"time"
)

type TokenNetworkData struct {
	Name                string `json:"name"`
	HiveEngineSymbol    string `json:"heSymbol"`
	HiveEnginePrecision int    `json:"hePrecision"`
	ContractAddress     string `json:"contractAddress"`
	DepositEnabled      bool   `json:"depositEnabled"`
	WithdrawalEnabled   bool   `json:"withdrawalEnabled"`

	// Calculated by the program
	Network  string          `json:"network,omitempty"`
	FixedFee decimal.Decimal `json:"fixed_fee,omitempty"`
}

type TokenFeeData struct {
	Status string          `json:"status"`
	Data   decimal.Decimal `json:"data"`
}

type TokenNetworkDataResponse struct {
	Status string             `json:"status"`
	Data   []TokenNetworkData `json:"data"`
}

// These ones don't appear in the API but can be requested from the fee endpoint and have the 1% fee
var TokenNetworkDataStoreDefault []TokenNetworkData = []TokenNetworkData{
	{
		Name:                "Ethereum",
		HiveEngineSymbol:    "SWAP.ETH",
		HiveEnginePrecision: 8,
		ContractAddress:     "",
		DepositEnabled:      true,
		WithdrawalEnabled:   true,
		Network:             "Ethereum",
	},
	{
		Name:                "BNB",
		HiveEngineSymbol:    "SWAP.BNB",
		HiveEnginePrecision: 8,
		ContractAddress:     "",
		DepositEnabled:      true,
		WithdrawalEnabled:   true,
		Network:             "Binance Smart Chain",
	},
	{
		Name:                "Polygon (MATIC)",
		HiveEngineSymbol:    "SWAP.MATIC",
		HiveEnginePrecision: 8,
		ContractAddress:     "",
		DepositEnabled:      true,
		WithdrawalEnabled:   true,
		Network:             "Polygon (Matic)",
	},
}

var TokenNetworkDataStore []TokenNetworkData = nil
var TokenNetworkDataStoreLock *sync.RWMutex = &sync.RWMutex{}

var LastSeenData []TokenData = nil
var LastSeenDataLock *sync.RWMutex = &sync.RWMutex{}

const BSC_TOKENS_URL = "https://bscgw.hive-engine.com/api/utils/tokens/bep20"
const ETH_TOKENS_URL = "https://ethgw.hive-engine.com/api/utils/tokens/erc20"
const POLYGON_TOKENS_URL = "https://polygw.hive-engine.com/api/utils/tokens/erc20"

var NetworksWithAdditionalFixedFee = map[string]string{
	"Binance Smart Chain": BSC_TOKENS_URL,
	"Ethereum":            ETH_TOKENS_URL,
	"Polygon (Matic)":     POLYGON_TOKENS_URL,
}

const ETH_GAS_PRICE_URL = "https://ethgw.hive-engine.com/api/utils/withdrawalfee/"
const POLYGON_GAS_PRICE_URL = "https://polygw.hive-engine.com/api/utils/withdrawalfee/"
const BSC_GAS_PRICE_URL = "https://bscgw.hive-engine.com/api/utils/withdrawalfee/"

var NetworksWithAdditionalFixedFeeEndpoints = map[string]string{
	"Binance Smart Chain": BSC_GAS_PRICE_URL,
	"Ethereum":            ETH_GAS_PRICE_URL,
	"Polygon (Matic)":     POLYGON_GAS_PRICE_URL,
}

var NetworkFeeCurrency = map[string]string{
	"Binance Smart Chain": "BNB",
	"Ethereum":            "ETH",
	"Polygon (Matic)":     "MATIC",
}

var Ready = false

func init() {
	// start a goroutine to update the fee data every 1 minute
	go func() {
		for {
			if LastSeenData == nil || TokenNetworkDataStore == nil {
				// Retry quickly if there's no data (it'll arrive soon)
				time.Sleep(time.Second)
				continue
			}

			// load cost of each token in TokenNetworkDataStore
			// and then add the cheapest fixed fee to the token
			for i, token := range TokenNetworkDataStore {
				var doWeHaveThisToken bool = false

				for _, tokenData := range LastSeenData {
					if strings.ToUpper(token.HiveEngineSymbol) == tokenData.SwapSymbol {
						doWeHaveThisToken = true
						break
					}
				}

				// no point making extra network requests if we don't have the token
				if !doWeHaveThisToken {
					continue
				}

				feeData, err := GetJSON[TokenFeeData](NetworksWithAdditionalFixedFeeEndpoints[token.Network] + token.HiveEngineSymbol)

				if err != nil {
					continue
				}

				if feeData.Status != "success" {
					continue
				}

				LastSeenDataLock.RLock()
				var newFee decimal.Decimal = decimal.Zero
				for _, data := range LastSeenData {
					if strings.ToUpper(data.Symbol) == NetworkFeeCurrency[token.Network] {
						newFee = data.HIVEPrice.Mul(feeData.Data)
					}
				}
				LastSeenDataLock.RUnlock()

				TokenNetworkDataStoreLock.Lock()
				TokenNetworkDataStore[i].FixedFee = newFee
				TokenNetworkDataStoreLock.Unlock()
			}

			Ready = true

			time.Sleep(time.Minute)
		}
	}()
}

func AddNetworkFee(data []TokenData) ([]TokenData, error) {
	LastSeenDataLock.Lock()
	LastSeenData = data
	LastSeenDataLock.Unlock()

	if TokenNetworkDataStore == nil {
		// load token network data (data that links token -> withdrawal network, so we know which endpoint to ask for the fee)

		for network, url := range NetworksWithAdditionalFixedFee {
			tokens, err := GetJSON[TokenNetworkDataResponse](url)

			if err != nil {
				return nil, err
			}

			if tokens.Status != "success" {
				return nil, errors.New("failed to get token network data for " + network)
			}

			for i := range tokens.Data {
				tokens.Data[i].Network = network
			}

			TokenNetworkDataStoreLock.Lock()
			// add defaults (these don't come from the api, but still need to get their fixed fee price)
			TokenNetworkDataStore = append(TokenNetworkDataStore, TokenNetworkDataStoreDefault...)

			TokenNetworkDataStore = append(TokenNetworkDataStore, tokens.Data...)
			TokenNetworkDataStoreLock.Unlock()
		}
	}

	for i, token := range data {
		// every token has a 0.75% fee (unless it is overridden by the network fee)
		data[i].NetworkPercentageFee, _ = decimal.NewFromString("0.75") // 0.75% fee

		for _, networkData := range TokenNetworkDataStore {
			// update price if it's the same token and the fee is less than the current fee or the current fee is 0 (not set)
			if strings.ToUpper(networkData.HiveEngineSymbol) == token.SwapSymbol && (networkData.FixedFee.LessThanOrEqual(token.NetworkFlatFee) || token.NetworkFlatFee.IsZero()) {
				data[i].NetworkPercentageFee = decimal.NewFromInt(1) // 1% fee
				data[i].NetworkFlatFee = networkData.FixedFee
				data[i].Network = networkData.Network
			}
		}
	}

	// Prevent data with wrong fee info from reaching the site
	if !Ready {
		return nil, errors.New("not ready yet")
	}

	return data, nil
}
