package subtitles
import (
	"encoding/json"
	"log"
	"regexp"
	"strings"
	"github.com/asticode/go-astisub"
)
type Word struct {
	Text string  `json:"text"`
	Time float64 `json:"time"`
}
type SubtitleBlock struct {
	Start      float64 `json:"start"`
	End        float64 `json:"end"`
	FullPhrase string  `json:"full_phrase"`
	Words      []Word  `json:"words"`
}
func ParseSubtitleToJSON(vttPath string) string {
	subs, err := astisub.OpenFile(vttPath)
	if err != nil {
		log.Printf("Error opening VTT file: %v\n", err)
		return "[]"
	}
	var subtitleBlocks []SubtitleBlock
	reTags := regexp.MustCompile(`<[^>]+>`)
	for _, item := range subs.Items {
		startSec := item.StartAt.Seconds()
		endSec := item.EndAt.Seconds()
		var rawLines []string
		for _, line := range item.Lines {
			var lineTexts []string
			for _, lineItem := range line.Items {
				lineTexts = append(lineTexts, lineItem.Text)
			}
			joined := strings.Join(lineTexts, " ")
			cleaned := reTags.ReplaceAllString(joined, "")
			cleaned = strings.Join(strings.Fields(cleaned), " ")
			if cleaned != "" {
				rawLines = append(rawLines, cleaned)
			}
		}
		if len(rawLines) == 0 {
			continue
		}
		cleanText := rawLines[len(rawLines)-1]
		if cleanText == "" {
			continue
		}
		textWords := strings.Split(cleanText, " ")
		var wordList []Word
		phraseDuration := endSec - startSec
		timePerWord := phraseDuration / float64(len(textWords))
		for i, word := range textWords {
			wordList = append(wordList, Word{
				Text: word,
				Time: startSec + (float64(i) * timePerWord),
			})
		}
		subtitleBlocks = append(subtitleBlocks, SubtitleBlock{
			Start:      startSec,
			End:        endSec,
			FullPhrase: cleanText,
			Words:      wordList,
		})
	}
	jsonData, err := json.Marshal(subtitleBlocks)
	if err != nil {
		log.Printf("Error generating JSON: %v\n", err)
		return "[]"
	}
	return string(jsonData)
}
