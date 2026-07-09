package utils

import (
	"context"
	"fmt"
	"os/exec"

	"github.com/lrstanley/go-ytdlp"
)

func VerificarYTDLP() bool {
	_, err := exec.LookPath("yt-dlp")

	return err == nil
}

func GarantirDependencias() error {
	if VerificarYTDLP() {
		fmt.Println("[OK] yt-dlp já está instalado e pronto para uso.")
		return nil
	}

	fmt.Println("[Aviso] yt-dlp não encontrado. Iniciando o download pela primeira vez...")
	fmt.Println("Isso pode levar alguns segundos...")

	_, err := ytdlp.Install(context.TODO(), nil)
	if err != nil {
		return fmt.Errorf("falha ao baixar o yt-dlp: %w", err)
	}

	fmt.Println("[Sucesso] yt-dlp instalado com sucesso!")
	return nil
}

func BaixarLegenda(url string, idioma string) error {
	fmt.Println("Iniciando o download da legenda...")

	ytdlp.MustInstall(context.TODO(), nil)

	dl := ytdlp.New().
		SkipDownload().   
		WriteAutoSubs().   
		WriteSubs().        
		SubFormat("vtt").  
		SubLangs(idioma).   
		Output("subtitles")

	fmt.Println("Baixando legenda...")

	_, err := dl.Run(context.Background(), url)
	if err != nil {
		return fmt.Errorf("erro ao extrair legenda: %w", err)
	}

	fmt.Println("Legenda salva com sucesso no formato VTT!")
	return nil
}

func DownloadVideo(url string) {
	ytdlp.MustInstall(context.TODO(), nil)

	dl := ytdlp.New().
		FormatSort("res,ext:mp4:m4a").
		RecodeVideo("mp4").
		Output("%(extractor)s - %(title)s.%(ext)s")

	_, err := dl.Run(context.TODO(), url)
	if err != nil {
		panic(err)
	}
}
