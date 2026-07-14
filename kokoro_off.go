//go:build !kokoro

package main

import "net/http"

func getKokoroHandler() http.Handler {
	return nil
}
