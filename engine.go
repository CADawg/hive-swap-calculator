package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
)

const NODE = "https://engine.rishipanthee.com"

func CallContract[T any](contract string, table string, query json.RawMessage, offset int) ([]T, error) {
	// call hive engine contract rpc with contract, method, params, and offset
	request := EngineJSONRPCRequest{
		Jsonrpc: "2.0",
		ID:      1,
		Method:  "find",
		Params: EngineParams{
			Contract: contract,
			Table:    table,
			Query:    query,
			Offset:   offset,
			Limit:    1000,
		},
	}

	// encode to stream so the request can take it

	var buf = new(bytes.Buffer)

	err := json.NewEncoder(buf).Encode(request)

	if err != nil {
		return nil, err
	}

	// send req
	req, err := http.NewRequest("POST", NODE+"/contracts", buf)

	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	// get resp
	resp, err := http.DefaultClient.Do(req)

	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	var output EngineJSONRPCResponse

	// parse resp
	var outputResponse []T

	err = json.NewDecoder(resp.Body).Decode(&output)

	if err != nil {
		return nil, err
	}

	if output.Error != "" {
		return nil, errors.New(output.Error)
	}

	err = json.Unmarshal(output.Result, &outputResponse)

	if err != nil {
		return nil, err
	}

	return outputResponse, nil
}
