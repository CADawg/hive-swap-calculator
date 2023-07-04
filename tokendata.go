package main

import (
	"strings"

	"github.com/shopspring/decimal"
)

func AddAllSymbolInformation(tokens []TokenData) []TokenData {
	for i, token := range tokens {
		tokens[i] = AddSymbolInformation(token, token.CoinGeckoName)
	}

	return tokens
}

func AddSymbolInformation(data TokenData, name string) TokenData {
	data.CoinGeckoName = name

	switch strings.ToLower(name) {
	case "basic-attention-token":
		data.Symbol = "BAT"
	case "binancecoin":
		data.Symbol = "BNB"
	case "binance-usd":
		data.Symbol = "BUSD"
	case "bitcoin":
		data.Symbol = "BTC"
	case "bitcoin-cash":
		data.Symbol = "BCH"
	case "dogecoin":
		data.Symbol = "DOGE"
	case "eos":
		data.Symbol = "EOS"
	case "ethereum":
		data.Symbol = "ETH"
	case "hive":
		data.Symbol = "HIVE"
	case "litecoin":
		data.Symbol = "LTC"
	case "matic-network":
		data.Symbol = "MATIC"
	case "tether":
		data.Symbol = "USDT"
	case "wax":
		data.Symbol = "WAX"
	}

	data.SwapSymbol = "SWAP." + data.Symbol

	return data
}

func AddHivePriceInformation(tokens []TokenData) []TokenData {
	hivePrice := decimal.Decimal{}

	for _, token := range tokens {
		if token.Symbol == "HIVE" {
			hivePrice = token.USDPrice
		}
	}

	for i, token := range tokens {
		tokens[i].HIVEPrice = token.USDPrice.Div(hivePrice)

		if token.Symbol == "HIVE" {
			tokens[i].HIVEPrice = decimal.NewFromInt(1)
		}
	}

	return tokens
}
