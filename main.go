package main

import (
	"fmt"
	"os"
	"os/signal"
	"sync"
	"time"
)

var Tokens []TokenData
var TokensLock sync.RWMutex
var signals = make(chan os.Signal, 1)

func main() {
	signal.Notify(signals, os.Interrupt)

	go func() {
		for {
			data, err := LoadPriceAndSymbolData()

			if err == nil {
				fmt.Println("Loaded price and symbol data")

				data, err = AddNetworkFee(data)

				if err == nil {
					fmt.Println("Added network fee data")

					data, err = GetUnderpricedMarketSellOrders(data)

					if err == nil {
						fmt.Println("Added underpriced market sell orders")

						data, err = GetUnderpricedMarketBuyOrders(data)

						if err == nil {
							fmt.Println("Added underpriced market buy orders")

							PrettyPrintTokenData(data)
						}
					}
				}
			}

			// handle any error
			if err != nil {
				fmt.Println("error:", err)
			}

			time.Sleep(20 * time.Second)

			TokensLock.Lock()
			Tokens = data
			TokensLock.Unlock()
		}
	}()

	<-signals
}

func LoadPriceAndSymbolData() ([]TokenData, error) {
	tokens, err := GetJSON[map[string]TokenData]("https://api.coingecko.com/api/v3/simple/price?ids=hive,bitcoin,litecoin,dogecoin,ethereum,tether,binancecoin,binance-usd,wax,matic-network,bitcoin-cash,basic-attention-token,eos&vs_currencies=usd,btc&include_24hr_change=true&include_last_updated_at=true&precision=full")

	if err != nil {
		return nil, err
	}

	tokensArray := MapToTokenWithName(*tokens)

	tokensWithData := AddHivePriceInformation(AddAllSymbolInformation(tokensArray))

	return tokensWithData, nil
}

func MapToTokenWithName(data map[string]TokenData) []TokenData {
	var dataParsed []TokenData

	for key, value := range data {
		value.CoinGeckoName = key

		dataParsed = append(dataParsed, value)
	}

	return dataParsed
}
