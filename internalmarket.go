package main

import (
	"bytes"
	"errors"
	"github.com/goccy/go-json"
	"github.com/shopspring/decimal"
	"net/http"
	"strings"
	"time"
)

type HiveRequest struct {
	Id      int             `json:"id"`
	JsonRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

type HistoryData struct {
	Jsonrpc string `json:"jsonrpc"`
	Result  []struct {
		Date        string `json:"date"`
		CurrentPays string `json:"current_pays"`
		OpenPays    string `json:"open_pays"`
	} `json:"result"`
	Id int `json:"id"`
}

// FetchBlockchainHiveHBDRate fetch hive/hbd rate from internal market (most people don't have access to bittrex [the only major-ish exchange that trades hbd] but everyone has access to the hive blockchain internal market)
// fetch from deathwing's hive node using condenser.api.get_order_book
func FetchBlockchainHiveHBDRate() (decimal.Decimal, error) {
	timestamp1, timestamp2 := GetTimestampsForPastHour()

	reqData := HiveRequest{
		Id:      0,
		JsonRPC: "2.0",
		Method:  "condenser_api.get_trade_history",
		Params:  []byte(`["` + timestamp1 + `", "` + timestamp2 + `", 100]`),
	}

	reqJson, err := json.Marshal(reqData)

	if err != nil {
		return decimal.Decimal{}, err
	}

	var resp HistoryData

	req, err := http.NewRequest("POST", "https://api.deathwing.me/", bytes.NewBuffer(reqJson))

	if err != nil {
		return decimal.Decimal{}, err
	}

	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)

	if err != nil {
		return decimal.Decimal{}, err
	}

	defer res.Body.Close()

	err = json.NewDecoder(res.Body).Decode(&resp)

	if err != nil {
		return decimal.Decimal{}, err
	}

	if len(resp.Result) == 0 {
		return decimal.Decimal{}, errors.New("no results")
	}

	// get the last result
	lastResult := resp.Result[0]

	for _, result := range resp.Result {
		resultDate, _ := time.Parse("2006-01-02T15:04:05", result.Date)
		lastResultDate, _ := time.Parse("2006-01-02T15:04:05", lastResult.Date)

		if resultDate.After(lastResultDate) {
			lastResult = result
		}
	}

	// convert the string to a decimal
	currentPaysCurrency, currentPaysDecimal, err := GetCurrencyAndDecimalFromString(lastResult.CurrentPays)

	if err != nil {
		return decimal.Decimal{}, err
	}

	openPaysCurrency, openPaysDecimal, err := GetCurrencyAndDecimalFromString(lastResult.OpenPays)

	if err != nil {
		return decimal.Decimal{}, err
	}

	// work out hive per hbd rate
	if currentPaysCurrency == "HIVE" && openPaysCurrency == "HBD" {
		return currentPaysDecimal.Div(openPaysDecimal), nil
	} else if currentPaysCurrency == "HBD" && openPaysCurrency == "HIVE" {
		return openPaysDecimal.Div(currentPaysDecimal), nil
	}

	return decimal.Decimal{}, errors.New("no results")
}

func GetCurrencyAndDecimalFromString(str string) (string, decimal.Decimal, error) {
	// split the string on space
	split := strings.Split(str, " ")

	if len(split) != 2 {
		return "", decimal.Decimal{}, errors.New("invalid string")
	}

	// parse the decimal
	dec, err := decimal.NewFromString(split[0])

	if err != nil {
		return "", decimal.Decimal{}, err
	}

	return split[1], dec, nil
}

func GetTimestampsForPastHour() (string, string) {
	startTime := time.Now().Add(-4 * time.Hour)

	startTimeStr := startTime.UTC().Format("2006-01-02T15:04:05")

	endTimeStr := time.Now().UTC().Format("2006-01-02T15:04:05")

	return startTimeStr, endTimeStr
}
