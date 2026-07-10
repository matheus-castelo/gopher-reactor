package main

import (
	"embed"
	"io/fs"
	"log"
	"ytdlp/internal/app"
)

//go:embed all:frontend
var assets embed.FS

func main() {
	frontendFS, err := fs.Sub(assets, "frontend")
	if err != nil {
		log.Fatal("Failed to read frontend folder:", err)
	}

	err = app.RunWailsProject(1280, 720, frontendFS)
	if err != nil {
		log.Fatal("Fatal app error:", err)
	}
}
