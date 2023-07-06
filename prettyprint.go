package main

import (
	"fmt"

	"github.com/shopspring/decimal"
)

func PrettyPrintTokenData(data []TokenData) {
	for _, token := range data {
		//LoadAndShowCryptoIcon(token)
		fmt.Println("Token: ", token.Symbol)
		fmt.Println("Price: ", token.USDPrice)
		fmt.Println("Network Fee: ", token.NetworkPercentageFee, "%")
		if token.NetworkFlatFee.GreaterThan(decimal.Zero) {
			fmt.Println("Network TX Fee: ", token.NetworkFlatFee)
		}
		fmt.Println("Hive Price: ", token.HIVEPrice)
		fmt.Println("Swap Symbol: ", token.SwapSymbol)
		if len(token.SellOrders) > 0 {
			fmt.Println("Sell Orders: ")
		}
		for _, order := range token.SellOrders {
			fmt.Println(PrettyPrintOrderOneLine(order, "Sell"))
		}
		if len(token.BuyOrders) > 0 {
			fmt.Println("Buy Orders: ")
		}
		for _, order := range token.BuyOrders {
			fmt.Println(PrettyPrintOrderOneLine(order, "Buy"))
		}
		fmt.Println()
	}
}

func PrettyPrintOrderOneLine(order EngineMarketOrder, side string) string {
	return fmt.Sprintf("%s %s %s at %s SWAP.HIVE (@%s) (%s%%)", side, order.Quantity.String(), order.Symbol, order.Price.String(), order.Account, order.ProfitPercentage.StringFixed(2))
}

/*func LoadAndShowCryptoIcon(token TokenData) {
	// fetch crypto icon from api https://cryptoicons.org/api/:style/:currency/:size/:color

	// fetch the icon
	req, err := http.NewRequest("GET", "https://coinicons-api.vercel.app/api/icon/"+strings.ToLower(token.Symbol), nil)

	if err != nil {
		fmt.Println(err)
		return
	}

	// send the request
	res, err := http.DefaultClient.Do(req)

	if err != nil {
		fmt.Println(err)
		return
	}

	// close the response body
	defer res.Body.Close()

	// convert to image
	img, err := png.Decode(res.Body)

	if err != nil {
		fmt.Println("sillyerror:", err)
		return
	}

	// print to terminal using terminalimage
	arr, err := terminalimage.ImgDataToArray(img, 5, true)

	if err != nil {
		fmt.Println(err)
		return
	}

	// print to terminal
	for _, line := range arr {
		fmt.Println(line)
	}
}*/
