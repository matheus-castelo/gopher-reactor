//go:build kokoro

package main

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed kokoro_assets/*
var kokoroFS embed.FS

func getKokoroHandler() http.Handler {
	subFS, err := fs.Sub(kokoroFS, "kokoro_assets")
	if err != nil {
		return nil
	}
	return http.FileServer(http.FS(subFS))
}
