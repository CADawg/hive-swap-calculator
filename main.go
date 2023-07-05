package main

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"time"

	"github.com/goccy/go-json"
)

var Tokens []TokenData
var TokensLock sync.RWMutex
var signals = make(chan os.Signal, 1)

func main() {
	signal.Notify(signals, os.Interrupt)

	go func() {
		for {
			/*TokensLock.RLock()
			if LenTokensMarketOrders(Tokens) > 5 {
				TokensLock.RUnlock()
				continue // for testing if we have more than 5 tokens with market orders then don't update
			}
			TokensLock.RUnlock()*/

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

			TokensLock.Lock()
			Tokens = data
			TokensLock.Unlock()

			time.Sleep(10 * time.Second)
		}
	}()

	go func() {
		// start the server

		mux := http.NewServeMux()

		mux.HandleFunc("/pricing", func(w http.ResponseWriter, r *http.Request) {
			TokensLock.RLock()
			defer TokensLock.RUnlock()

			if r.Method != "GET" {
				w.WriteHeader(http.StatusMethodNotAllowed)
				return
			}

			err := json.NewEncoder(w).Encode(Tokens)

			if err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
		})

		server := http.Server{
			Addr:              ":8080",
			ReadHeaderTimeout: 5 * time.Second, // no slowloris pls
			ReadTimeout:       5 * time.Second,
			Handler:           mux,
		}

		// serve
		err := server.ListenAndServe()

		if err != nil {
			if errors.Is(err, http.ErrServerClosed) {
				fmt.Println("server closed")
			} else {
				panic("error starting server: " + err.Error())
			}
		}
	}()

	<-signals
}

func LoadPriceAndSymbolData() ([]TokenData, error) {
	tokens, err := GetJSON[map[string]TokenData]("https://api.coingecko.com/api/v3/simple/price?ids=hive,bitcoin,litecoin,hive_dollar,steem,dogecoin,ethereum,tether,binancecoin,binance-usd,wax,matic-network,bitcoin-cash,basic-attention-token,eos&vs_currencies=usd,btc&include_24hr_change=true&include_last_updated_at=true&precision=full")

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
