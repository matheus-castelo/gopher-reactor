package utils

import (
	"fmt"
	"log"

	"github.com/asticode/go-astisub"
)

func IterarVtt(caminhoVTT string) {
	subs, err := astisub.OpenFile(caminhoVTT)
	if err != nil {
		log.Fatalf("Erro ao abrir o arquivo VTT: %v", err)
	}

	for index, item := range subs.Items {

		fmt.Printf("--- Bloco %d ---\n", index+1)
		fmt.Printf("Início: %v | Fim: %v\n", item.StartAt, item.EndAt)

		fmt.Print("Texto: ")
		for _, line := range item.Lines {

			for _, lineItem := range line.Items {
				fmt.Print(lineItem.Text)
			}
			fmt.Print(" ")
		}
		fmt.Println("\n\n")
	}
}
