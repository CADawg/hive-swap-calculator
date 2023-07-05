package main

import (
	"io"
	"net/http"

	"github.com/goccy/go-json"
)

func GetJSON[T any](url string) (*T, error) {
	req, err := http.NewRequest("GET", url, nil)

	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)

	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)

	if err != nil {
		return nil, err
	}

	var output T

	err = json.Unmarshal(data, &output)

	if err != nil {
		return nil, err
	}

	return &output, nil
}
