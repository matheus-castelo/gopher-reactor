package main

import (
	"ytdlp/utils"
)

func main() {
	utils.IterarVtt("subtitles.en.vtt")

	// if err := utils.BaixarLegenda("https://www.youtube.com/watch?v=tNZnLkRBYA8", "en"); err != nil {
	// 	log.Fatal(err)
	// }
}
