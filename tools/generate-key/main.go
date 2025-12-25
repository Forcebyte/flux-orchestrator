// +build tools

package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
)

func generateKey() (string, error) {
	var key [32]byte
	if _, err := rand.Read(key[:]); err != nil {
		return "", fmt.Errorf("failed to generate random key: %w", err)
	}

	return base64.URLEncoding.EncodeToString(key[:]), nil
}

func main() {
	key, err := generateKey()
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
