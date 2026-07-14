package app

import (
	"context"
	"encoding/base64"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"ytdlp/internal/downloader"
	"ytdlp/internal/subtitles"
)

type App struct {
	ctx       context.Context
	mediaURL  string
	mu        sync.RWMutex
	videoPath string
}

func NewApp() *App {
	return &App{}
}

func (a *App) SpeakEdgeTTS(text string, voiceName string) (string, error) {
	tmpFile := filepath.Join(os.TempDir(), fmt.Sprintf("edge_tts_%d.mp3", time.Now().UnixNano()))
	defer func() { _ = os.Remove(tmpFile) }()

	cmd := edgeTTSCommand(voiceName, tmpFile, text)
	setHideWindow(cmd)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("edge-tts failed: %v — %s", err, string(output))
	}

	audioData, err := os.ReadFile(tmpFile)
	if err != nil {
		return "", err
	}

	if len(audioData) == 0 {
		return "", fmt.Errorf("edge-tts produced empty audio")
	}

	return base64.StdEncoding.EncodeToString(audioData), nil
}

func edgeTTSCommand(voice, outputPath, text string) *exec.Cmd {
	exePath, err := os.Executable()
	if err == nil {
		dir := filepath.Dir(exePath)
		helperBin := filepath.Join(dir, edgeTTSHelperName())
		if _, statErr := os.Stat(helperBin); statErr == nil {
			return exec.Command(helperBin, voice, outputPath, text)
		}
	}
	return exec.Command("python", "-m", "edge_tts", "--voice", voice, "--text", text, "--write-media", outputPath)
}

func edgeTTSHelperName() string {
	if goruntime.GOOS == "windows" {
		return "edge-tts-helper.exe"
	}
	return "edge-tts-helper"
}

func (a *App) HasWhisper() bool {
	conn, err := net.DialTimeout("tcp", "127.0.0.1:8080", 500*time.Millisecond)
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}
func (a *App) shutdown(ctx context.Context) {
}
func (a *App) GetMediaURL() string {
	return a.mediaURL
}
func (a *App) SelectVideoFile() string {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Video",
		Filters: []runtime.FileFilter{
			{DisplayName: "Videos (*.mp4, *.mkv, *.webm)", Pattern: "*.mp4;*.mkv;*.webm;*.avi"},
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
func (a *App) LoadSubtitle() string {
	selection, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Subtitle File",
		Filters: []runtime.FileFilter{
			{DisplayName: "Subtitles (*.srt, *.vtt)", Pattern: "*.srt;*.vtt"},
		},
	})
	if err != nil || selection == "" {
		return "[]"
	}
	return subtitles.ParseSubtitleToJSON(selection)
}
func (a *App) startMediaServer() {
	mux := http.NewServeMux()
	mux.HandleFunc("/video", func(w http.ResponseWriter, r *http.Request) {
		a.mu.RLock()
		vp := a.videoPath
		a.mu.RUnlock()
		if vp == "" {
			http.Error(w, "No video selected", http.StatusNotFound)
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", "*")
		http.ServeFile(w, r, vp)
	})
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatal(err)
	}
	go func() {
		_ = http.Serve(listener, mux)
	}()
	a.mediaURL = fmt.Sprintf("http://127.0.0.1:%d", listener.Addr().(*net.TCPAddr).Port)
	log.Printf("[Media Server] Running at: %s", a.mediaURL)
}
func (a *App) SelectDirectory() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select destination folder",
	})
}
func (a *App) ValidateURL(url string) error {
	return downloader.ValidateURL(url)
}
func (a *App) FetchAvailableSubtitles(url string) ([]downloader.SubtitleOption, error) {
	return downloader.FetchSubtitles(url)
}
func (a *App) FetchAvailableFormats(url string) ([]downloader.FormatOption, error) {
	return downloader.FetchFormats(url)
}
type ProgressData struct {
	ID       string  `json:"id"`
	Type     string  `json:"type"`
	Percent  float64 `json:"percent"`
	Status   string  `json:"status"`
	Filename string  `json:"filename"`
}
func (a *App) emitProgress(id string, pType string, percent float64, status string, filename string) {
	runtime.EventsEmit(a.ctx, "download:progress", ProgressData{
		ID:       id,
		Type:     pType,
		Percent:  percent,
		Status:   status,
		Filename: filename,
	})
}
func (a *App) DownloadVideo(url string, destPath string) error {
	return downloader.DownloadVideo(a.ctx, url, destPath, func(percent float64, status string, filename string) {
		a.emitProgress("vid", "Video", percent, status, filename)
	})
}
func (a *App) DownloadVideoWithFormat(url string, formatID string, destPath string) error {
	return downloader.DownloadVideoWithFormat(a.ctx, url, formatID, destPath, func(percent float64, status string, filename string) {
		a.emitProgress("vid", "Video", percent, status, filename)
	})
}
func (a *App) DownloadSubtitle(url string, language string, destPath string) error {
	return downloader.DownloadSubtitle(a.ctx, url, language, destPath, func(percent float64, status string, filename string) {
		a.emitProgress("sub", "Subtitle", percent, status, filename)
	})
}
func (a *App) DownloadSubtitleWithFormat(url string, language string, subtitleFormat string, destPath string) error {
	return downloader.DownloadSubtitleWithFormat(a.ctx, url, language, subtitleFormat, destPath, func(percent float64, status string, filename string) {
		a.emitProgress("sub", "Subtitle", percent, status, filename)
	})
}
func RunWailsProject(width, height int, assets fs.FS, kokoroHandler http.Handler) error {
	app := NewApp()
	app.startMediaServer()
	return wails.Run(&options.App{
		Title:     "Gopher Reactor",
		Width:     width,
		Height:    height,
		MinWidth:  900,
		MinHeight: 600,
		AssetServer: &assetserver.Options{
			Assets:  assets,
			Handler: kokoroHandler,
		},
		OnStartup:  app.startup,
		OnShutdown: app.shutdown,
		Bind:      []interface{}{app},
	})
}
