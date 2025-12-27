package encryption

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"

	"github.com/fernet/fernet-go"
)

// Encryptor handles encryption and decryption of sensitive data
type Encryptor struct {
	key *fernet.Key
}

// NewEncryptor creates a new encryptor with the given key
func NewEncryptor(keyString string) (*Encryptor, error) {
	if keyString == "" {
		return nil, fmt.Errorf("encryption key cannot be empty")
	}

	key, err := fernet.DecodeKey(keyString)
	if err != nil {
		return nil, fmt.Errorf("failed to decode encryption key: %w", err)
	}

	return &Encryptor{key: key}, nil
}

// Encrypt encrypts plaintext data
func (e *Encryptor) Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	token, err := fernet.EncryptAndSign([]byte(plaintext), e.key)
	if err != nil {
		return "", fmt.Errorf("encryption failed: %w", err)
	}

	return string(token), nil
}

// Decrypt decrypts encrypted data
func (e *Encryptor) Decrypt(ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}

	plaintext := fernet.VerifyAndDecrypt([]byte(ciphertext), 0, []*fernet.Key{e.key})
	if plaintext == nil {
		return "", fmt.Errorf("decryption failed: invalid token or key")
	}

	return string(plaintext), nil
}

// GenerateKey generates a new Fernet key
func GenerateKey() (string, error) {
	var key [32]byte
	if _, err := rand.Read(key[:]); err != nil {
		return "", fmt.Errorf("failed to generate random key: %w", err)
	}

	return base64.URLEncoding.EncodeToString(key[:]), nil
}
