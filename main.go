package main

import (
	"context"
	"embed"
	"fmt"
	"log"
	"net"
	"net/http"
	"sync"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend
var assets embed.FS

type App struct {
	ctx       context.Context
	mediaURL  string
	mu        sync.RWMutex
	videoPath string
	vttPath   string
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) GetMediaURL() string {
	return a.mediaURL
}

func (a *App) SelectVideoFile() string {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Selecionar Vídeo",
		Filters: []runtime.FileFilter{
			{DisplayName: "Vídeos (*.mp4, *.mkv, *.webm)", Pattern: "*.mp4;*.mkv;*.webm;*.avi"},
		},
	})
	if err == nil && path != "" {
		a.mu.Lock()
		a.videoPath = path
		a.mu.Unlock()
		return path
	}
	return ""
}

func (a *App) SelectVTTFile() string {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Selecionar Legenda",
		Filters: []runtime.FileFilter{
			{DisplayName: "Legendas (*.vtt)", Pattern: "*.vtt"},
		},
	})
	if err == nil && path != "" {
		a.mu.Lock()
		a.vttPath = path
		a.mu.Unlock()
		return path
	}
	return ""
}

func (a *App) startMediaServer() {
	mux := http.NewServeMux()
	mux.HandleFunc("/video", func(w http.ResponseWriter, r *http.Request) {
		a.mu.RLock()
		vp := a.videoPath
		a.mu.RUnlock()

		if vp == "" {
			http.Error(w, "Vídeo não selecionado", http.StatusNotFound)
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", "*")
		http.ServeFile(w, r, vp)
	})
	
	mux.HandleFunc("/vtt", func(w http.ResponseWriter, r *http.Request) {
		a.mu.RLock()
		vp := a.vttPath
		a.mu.RUnlock()

		if vp == "" {
			http.Error(w, "VTT não selecionado", http.StatusNotFound)
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "text/vtt; charset=utf-8")
		http.ServeFile(w, r, vp)
	})

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatal(err)
	}

	go http.Serve(listener, mux)
	a.mediaURL = fmt.Sprintf("http://127.0.0.1:%d", listener.Addr().(*net.TCPAddr).Port)
	log.Printf("[Media Server] Rodando em: %s", a.mediaURL)
}

func main() {
	app := NewApp()
	app.startMediaServer()

	err := wails.Run(&options.App{
		Title:  "Gopher Reactor - Protótipo Simples",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup: app.startup,
		Bind:      []interface{}{app},
	})
	if err != nil {
		log.Fatal(err)
	}
}
