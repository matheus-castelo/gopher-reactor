package downloader

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/lrstanley/go-ytdlp"
)

var ytdlpReady bool

type ProgressCallback func(percent float64, status string, filename string)

func EnsureDependencies() error {
	if ytdlpReady {
		return nil
	}
	if _, err := ytdlp.Install(context.Background(), nil); err != nil {
		return fmt.Errorf("failed to install yt-dlp: %w", err)
	}
	ytdlpReady = true
	return nil
}

func ValidateURL(videoURL string) error {
	u, err := url.ParseRequestURI(videoURL)
	if err != nil {
		return fmt.Errorf("invalid URL format")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("URL must start with http or https")
	}
	if !strings.Contains(u.Host, "youtube.com") && !strings.Contains(u.Host, "youtu.be") {
		return fmt.Errorf("currently only YouTube URLs are fully supported")
	}
	return nil
}

func resolveDirectory(path string) (string, error) {
	dir := path
	if dir == "" {
		pwd, err := os.Getwd()
		if err != nil {
			return "", err
		}
		dir = pwd
	}
	dir = filepath.Clean(dir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

func availableLanguages(url string) (map[string]bool, error) {
	dl := ytdlp.New().DumpSingleJSON().SkipDownload().NoWarnings()
	res, err := dl.Run(context.Background(), url)
	if err != nil {
		return nil, fmt.Errorf("yt-dlp error: %w", err)
	}

	var info struct {
		Subtitles         map[string]any `json:"subtitles"`
		AutomaticCaptions map[string]any `json:"automatic_captions"`
	}
	if err := json.Unmarshal([]byte(res.Stdout), &info); err != nil {
		return nil, err
	}

	available := make(map[string]bool)
	for lang := range info.Subtitles {
		available[lang] = true
	}
	for lang := range info.AutomaticCaptions {
		available[lang] = true
	}
	return available, nil
}

type SubtitleOption struct {
	Code  string `json:"code"`
	Label string `json:"label"`
	Auto  bool   `json:"auto"`
}

func FetchSubtitles(url string) ([]SubtitleOption, error) {
	if err := EnsureDependencies(); err != nil {
		return nil, err
	}

	dl := ytdlp.New().DumpSingleJSON().SkipDownload().NoWarnings()
	res, err := dl.Run(context.Background(), url)
	if err != nil {
		return nil, err
	}

	var info struct {
		Subtitles         map[string]any `json:"subtitles"`
		AutomaticCaptions map[string]any `json:"automatic_captions"`
	}
	if err := json.Unmarshal([]byte(res.Stdout), &info); err != nil {
		return nil, err
	}

	var options []SubtitleOption
	seen := make(map[string]bool)

	for lang := range info.Subtitles {
		options = append(options, SubtitleOption{Code: lang, Label: lang, Auto: false})
		seen[lang] = true
	}

	for lang := range info.AutomaticCaptions {
		if !seen[lang] {
			options = append(options, SubtitleOption{Code: lang, Label: lang + " (auto)", Auto: true})
		}
	}

	sort.Slice(options, func(i, j int) bool {
		return options[i].Code < options[j].Code
	})

	return options, nil
}

func DownloadSubtitle(ctx context.Context, url string, language string, destPath string, cb ProgressCallback) error {
	language = strings.TrimSpace(strings.Split(language, " ")[0])
	if language == "" {
		return fmt.Errorf("language not specified")
	}

	if err := EnsureDependencies(); err != nil {
		return err
	}

	available, err := availableLanguages(url)
	if err != nil {
		return err
	}

	found := false
	for lang := range available {
		if lang == language || strings.HasPrefix(lang, language+"-") {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("language '%s' not available", language)
	}

	dir, err := resolveDirectory(destPath)
	if err != nil {
		return err
	}

	before, _ := os.ReadDir(dir)
	outputTemplate := filepath.Join(dir, "%(title)s.%(ext)s")
	langQuery := language + ".*," + language

	dl := ytdlp.New().
		SkipDownload().
		WriteSubs().
		WriteAutoSubs().
		SubLangs(langQuery).
		SubFormat("vtt").
		Output(outputTemplate)

	if cb != nil {
		dl.ProgressFunc(time.Millisecond*500, func(update ytdlp.ProgressUpdate) {
			cb(update.Percent(), string(update.Status), update.Filename)
		})
	}

	if _, err := dl.Run(ctx, url); err != nil {
		return err
	}

	after, _ := os.ReadDir(dir)
	downloaded := false
	for _, f := range after {
		if !strings.HasSuffix(f.Name(), ".vtt") {
			continue
		}
		existed := false
		for _, a := range before {
			if a.Name() == f.Name() {
				existed = true
				break
			}
		}
		if !existed {
			downloaded = true
		}
	}

	if !downloaded {
		return fmt.Errorf("no subtitle found")
	}
	return nil
}

type FormatOption struct {
	FormatID   string  `json:"format_id"`
	Extension  string  `json:"ext"`
	Resolution string  `json:"resolution"`
	Note       string  `json:"note"`
	Codec      string  `json:"codec"`
	Size       string  `json:"size"`
	TBR        float64 `json:"tbr"`
	AudioOnly  bool    `json:"audio_only"`
}

func FetchFormats(url string) ([]FormatOption, error) {
	if err := EnsureDependencies(); err != nil {
		return nil, err
	}

	dl := ytdlp.New().DumpSingleJSON().SkipDownload().NoWarnings()
	res, err := dl.Run(context.Background(), url)
	if err != nil {
		return nil, err
	}

	var info struct {
		Formats []struct {
			FormatID       string   `json:"format_id"`
			Ext            string   `json:"ext"`
			Width          *float64 `json:"width"`
			Height         *float64 `json:"height"`
			Resolution     string   `json:"resolution"`
			FormatNote     string   `json:"format_note"`
			VCodec         string   `json:"vcodec"`
			ACodec         string   `json:"acodec"`
			TBR            float64  `json:"tbr"`
			FileSize       *int     `json:"filesize"`
			FileSizeApprox *int     `json:"filesize_approx"`
		} `json:"formats"`
	}

	if err := json.Unmarshal([]byte(res.Stdout), &info); err != nil {
		return nil, err
	}

	var options []FormatOption
	for _, f := range info.Formats {
		resolution := f.Resolution
		if resolution == "" {
			if f.Width != nil && f.Height != nil {
				resolution = fmt.Sprintf("%.0fx%.0f", *f.Width, *f.Height)
			} else {
				resolution = "audio only"
			}
		}

		codec := ""
		if f.VCodec != "" && f.VCodec != "none" {
			codec = f.VCodec
		}
		if f.ACodec != "" && f.ACodec != "none" {
			if codec != "" {
				codec += " / " + f.ACodec
			} else {
				codec = f.ACodec
			}
		}

		audioOnly := (f.VCodec == "" || f.VCodec == "none") && (f.ACodec != "" && f.ACodec != "none")

		size := ""
		bytes := 0
		if f.FileSize != nil && *f.FileSize > 0 {
			bytes = *f.FileSize
		} else if f.FileSizeApprox != nil && *f.FileSizeApprox > 0 {
			bytes = *f.FileSizeApprox
		}
		if bytes > 0 {
			mb := float64(bytes) / (1024 * 1024)
			if mb >= 1024 {
				size = fmt.Sprintf("%.1f GiB", mb/1024)
			} else {
				size = fmt.Sprintf("%.1f MiB", mb)
			}
		}

		options = append(options, FormatOption{
			FormatID:   f.FormatID,
			Extension:  f.Ext,
			Resolution: resolution,
			Note:       f.FormatNote,
			Codec:      codec,
			Size:       size,
			TBR:        f.TBR,
			AudioOnly:  audioOnly,
		})
	}
	return options, nil
}

func DownloadVideo(ctx context.Context, url string, destPath string, cb ProgressCallback) error {
	if err := EnsureDependencies(); err != nil {
		return err
	}

	dir, err := resolveDirectory(destPath)
	if err != nil {
		return err
	}

	outputTemplate := filepath.Join(dir, "%(extractor)s - %(title)s.%(ext)s")
	dl := ytdlp.New().FormatSort("res,ext:mp4:m4a").RecodeVideo("mp4").Output(outputTemplate)

	if cb != nil {
		dl.ProgressFunc(time.Millisecond*500, func(update ytdlp.ProgressUpdate) {
			cb(update.Percent(), string(update.Status), update.Filename)
		})
	}

	if _, err := dl.Run(ctx, url); err != nil {
		return err
	}
	return nil
}

func DownloadVideoWithFormat(ctx context.Context, url string, formatID string, destPath string, cb ProgressCallback) error {
	if err := EnsureDependencies(); err != nil {
		return err
	}

	dir, err := resolveDirectory(destPath)
	if err != nil {
		return err
	}

	outputTemplate := filepath.Join(dir, "%(extractor)s - %(title)s.%(ext)s")
	dl := ytdlp.New().Format(formatID).Output(outputTemplate)

	if cb != nil {
		dl.ProgressFunc(time.Millisecond*500, func(update ytdlp.ProgressUpdate) {
			cb(update.Percent(), string(update.Status), update.Filename)
		})
	}

	if _, err := dl.Run(ctx, url); err != nil {
		return err
	}
	return nil
}

func DownloadSubtitleWithFormat(ctx context.Context, url string, language string, subtitleFormat string, destPath string, cb ProgressCallback) error {
	language = strings.TrimSpace(strings.Split(language, " ")[0])
	if language == "" {
		return fmt.Errorf("language not specified")
	}
	if subtitleFormat == "" {
		subtitleFormat = "vtt"
	}
	subtitleFormat = strings.TrimSpace(strings.ToLower(subtitleFormat))

	if err := EnsureDependencies(); err != nil {
		return err
	}

	available, err := availableLanguages(url)
	if err != nil {
		return err
	}

	found := false
	for lang := range available {
		if lang == language || strings.HasPrefix(lang, language+"-") {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("language '%s' not available", language)
	}

	dir, err := resolveDirectory(destPath)
	if err != nil {
		return err
	}

	before, _ := os.ReadDir(dir)
	outputTemplate := filepath.Join(dir, "%(title)s.%(ext)s")
	langQuery := language + ".*," + language

	dl := ytdlp.New().
		SkipDownload().
		WriteSubs().
		WriteAutoSubs().
		SubLangs(langQuery).
		SubFormat(subtitleFormat).
		Output(outputTemplate)

	if cb != nil {
		dl.ProgressFunc(time.Millisecond*500, func(update ytdlp.ProgressUpdate) {
			cb(update.Percent(), string(update.Status), update.Filename)
		})
	}

	if _, err := dl.Run(ctx, url); err != nil {
		return err
	}

	after, _ := os.ReadDir(dir)
	downloaded := false
	for _, f := range after {
		existed := false
		for _, a := range before {
			if a.Name() == f.Name() {
				existed = true
				break
			}
		}
		if !existed {
			downloaded = true
		}
	}

	if !downloaded {
		return fmt.Errorf("no subtitle found")
	}
	return nil
}
