package main

import (
	"github.com/goccy/go-json"

	"github.com/shopspring/decimal"
)

type TokenData struct {
	USDPrice     decimal.Decimal `json:"usd"`
	USD24HChange decimal.Decimal `json:"usd_24h_change"`
	BTCPrice     decimal.Decimal `json:"btc"`
	BTC24HChange decimal.Decimal `json:"btc_24h_change"`
	LastUpdated  int64           `json:"last_updated_at"`

	// These are not part of the JSON response
	// but are added by the program
	HIVEPrice decimal.Decimal `json:"hive,omitempty"`

	NetworkPercentageFee decimal.Decimal `json:"network_percentage_fee,omitempty"`
	NetworkFlatFee       decimal.Decimal `json:"network_flat_fee,omitempty"`
	Network              string          `json:"network,omitempty"`

	CoinGeckoName string `json:"name,omitempty"`
	Symbol        string `json:"symbol,omitempty"`
	SwapSymbol    string `json:"swap_symbol,omitempty"`

	SellOrders []EngineMarketOrder `json:"sell_orders,omitempty"`
	BuyOrders  []EngineMarketOrder `json:"buy_orders,omitempty"`
}

type EngineJSONRPCRequest struct {
	Jsonrpc string       `json:"jsonrpc"`
	ID      int          `json:"id"`
	Method  string       `json:"method"`
	Params  EngineParams `json:"params"`
}

type EngineParams struct {
	Contract string          `json:"contract"`
	Table    string          `json:"table"`
	Query    json.RawMessage `json:"query"`
	Offset   int             `json:"offset"`
	Limit    int             `json:"limit"`
}

type EngineJSONRPCResponse struct {
	Jsonrpc string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   string          `json:"error,omitempty"`
}

type EngineMarketOrder struct {
	Account       string          `json:"account"`
	Expiration    int64           `json:"expiration"`
	Price         decimal.Decimal `json:"price"`
	Quantity      decimal.Decimal `json:"quantity"`
	Symbol        string          `json:"symbol"`
	Timestamp     int64           `json:"timestamp"`
	TransactionID string          `json:"txId"`
	ID            int             `json:"_id"`
}
