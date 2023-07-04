package main

import (
	"github.com/shopspring/decimal"
)

func GetUnderpricedMarketSellOrders(tokens []TokenData) ([]TokenData, error) {
	for i, token := range tokens {
		// this should be the hive price we're willing to pay minus the network fee
		hivePrice := token.HIVEPrice.Mul(decimal.NewFromInt(1).Sub(token.NetworkPercentageFee.Div(decimal.NewFromInt(100))))

		orders, err := GetSellOrdersForToken(token, hivePrice)

		var goodOrders []EngineMarketOrder

		// filter out any orders that are more than we're willing to pay
		for _, order := range orders {
			if order.Price.LessThanOrEqual(hivePrice) {
				goodOrders = append(goodOrders, order)
			}
		}

		if err != nil {
			return nil, err
		}

		tokens[i].SellOrders = goodOrders
	}

	return tokens, nil
}

func GetSellOrdersForToken(token TokenData, hivePrice decimal.Decimal) ([]EngineMarketOrder, error) {
	var allOrders []EngineMarketOrder

	orders, err := CallContract[EngineMarketOrder]("market", "sellBook", []byte(`{"symbol":"`+token.SwapSymbol+`"}`), 0)

	if err != nil {
		return nil, err
	}

	allOrders = append(allOrders, orders...)

	for len(orders) == 1000 {
		orders, err = CallContract[EngineMarketOrder]("market", "sellBook", []byte(`{"symbol":"`+token.SwapSymbol+`"}`), len(allOrders))

		if err != nil {
			return nil, err
		}

		allOrders = append(allOrders, orders...)
	}

	return allOrders, nil
}

func GetUnderpricedMarketBuyOrders(tokens []TokenData) ([]TokenData, error) {
	for i, token := range tokens {
		// calculate hiveprice + network fee (percentage) as anything less than this is unprofitable
		// 1/(1-fee) = the price we need to sell for or more in order to make a profit
		hivePrice := token.HIVEPrice.Mul(decimal.NewFromInt(1).Div(decimal.NewFromInt(1).Sub(token.NetworkPercentageFee.Div(decimal.NewFromInt(100)))))

		orders, err := GetBuyOrdersForToken(token, hivePrice)

		var goodOrders []EngineMarketOrder

		// filter out any orders that are less than the hive price we're willing to sell for
		for _, order := range orders {
			if order.Price.GreaterThanOrEqual(hivePrice) {
				goodOrders = append(goodOrders, order)
			}
		}

		if err != nil {
			return nil, err
		}

		tokens[i].BuyOrders = goodOrders
	}

	return tokens, nil
}

func GetBuyOrdersForToken(token TokenData, hivePrice decimal.Decimal) ([]EngineMarketOrder, error) {
	var allOrders []EngineMarketOrder

	orders, err := CallContract[EngineMarketOrder]("market", "buyBook", []byte(`{"symbol":"`+token.Symbol+`"}`), 0)

	if err != nil {
		return nil, err
	}

	allOrders = append(allOrders, orders...)

	for len(orders) == 1000 {
		orders, err = CallContract[EngineMarketOrder]("market", "buyBook", []byte(`{"symbol":"`+token.Symbol+`"}`), len(allOrders))

		if err != nil {
			return nil, err
		}

		allOrders = append(allOrders, orders...)
	}

	return allOrders, nil
}
