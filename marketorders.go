package main

import (
	"github.com/shopspring/decimal"
)

// We will preload all the market orders for each token and then filter them out later (engine node/network requests are slower than filtering in memory)
var AllSellOrdersForSwap []EngineMarketOrder
var AllBuyOrdersForSwap []EngineMarketOrder

func GetAllSwapSellOrders() error {
	// get all sell orders (for all starting with SWAP.) using mongodb query $regex
	sellOrders, err := CallContractUntilEmpty[EngineMarketOrder]("market", "sellBook", []byte(`{"symbol":{"$regex":"^SWAP\\."}}`))

	if err != nil {
		return err
	}

	AllSellOrdersForSwap = sellOrders

	return nil
}

func GetAllSwapBuyOrders() error {
	// get all buy orders (for all starting with SWAP.) using mongodb query $regex
	buyOrders, err := CallContractUntilEmpty[EngineMarketOrder]("market", "buyBook", []byte(`{"symbol":{"$regex":"^SWAP\\."}}`))

	if err != nil {
		return err
	}

	AllBuyOrdersForSwap = buyOrders

	return nil
}

func GetUnderpricedMarketSellOrders(tokens []TokenData) ([]TokenData, error) {
	// Reload all the sell orders for SWAP. tokens
	_ = GetAllSwapSellOrders()

	for i, token := range tokens {
		orders := GetSellOrdersForToken(token, token.HIVEPrice)

		for j := range orders {
			orders[j].ProfitPercentage = token.HIVEPrice.Sub(orders[j].Price).Div(token.HIVEPrice).Mul(decimal.NewFromInt(100)).Abs()
		}

		tokens[i].SellOrders = orders
	}

	return tokens, nil
}

func GetSellOrdersForToken(token TokenData, hivePrice decimal.Decimal) []EngineMarketOrder {
	var allOrders []EngineMarketOrder

	for _, order := range AllSellOrdersForSwap {
		if order.Symbol == token.SwapSymbol && order.Price.LessThanOrEqual(hivePrice) {
			allOrders = append(allOrders, order)
		}
	}

	return allOrders
}

func GetUnderpricedMarketBuyOrders(tokens []TokenData) ([]TokenData, error) {
	// Reload all the buy orders for SWAP. tokens
	_ = GetAllSwapBuyOrders()

	for i, token := range tokens {
		orders := GetBuyOrdersForToken(token, token.HIVEPrice)

		for j := range orders {
			orders[j].ProfitPercentage = token.HIVEPrice.Sub(orders[j].Price).Div(token.HIVEPrice).Abs()
		}

		tokens[i].BuyOrders = orders
	}

	return tokens, nil
}

func GetBuyOrdersForToken(token TokenData, hivePrice decimal.Decimal) []EngineMarketOrder {
	var allOrders []EngineMarketOrder

	for _, order := range AllBuyOrdersForSwap {
		if order.Symbol == token.SwapSymbol && order.Price.GreaterThanOrEqual(hivePrice) {
			allOrders = append(allOrders, order)
		}
	}

	return allOrders
}
