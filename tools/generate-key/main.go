// +build tools

package main

import (
	"fmt"
	"log"

	"github.com/Forcebyte/flux-orchestrator/backend/internal/encryption"
)

func main() {
	key, err := encryption.GenerateKey()
	if err != nil {
		log.Fatalf("Failed to generate key: %v", err)
	}

	fmt.Println("Generated Fernet Encryption Key:")
	fmt.Println(key)
	fmt.Println()
	fmt.Println("Add this to your Kubernetes Secret or environment variables as ENCRYPTION_KEY")
	fmt.Println()
	fmt.Println("Example:")
	fmt.Printf("export ENCRYPTION_KEY=%s\n", key)
}
