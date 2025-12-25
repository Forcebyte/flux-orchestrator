# Kubeconfig Encryption

Flux Orchestrator uses Fernet symmetric encryption to protect kubeconfig data stored in the database. This ensures that anyone with direct database access cannot read the kubeconfig contents without the encryption key.

## How It Works

1. **Encryption at Rest**: When a cluster is added, the kubeconfig is encrypted using Fernet before being stored in the database
2. **Decryption on Load**: When the application starts or accesses a cluster, it decrypts the kubeconfig in memory
3. **Key Management**: A single encryption key is used and must be provided via the `ENCRYPTION_KEY` environment variable

## Generating an Encryption Key

### Using Go Tool

```bash
go run ./tools/generate-key/main.go
```

### Using Python

```bash
python3 -c "import base64; import os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
```

### Using OpenSSL

```bash
openssl rand -base64 32 | tr '/+' '_-'
```

The key should be a 32-byte value encoded in URL-safe base64 format.

## Configuration

### Kubernetes Deployment

The encryption key is stored as a Kubernetes Secret:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: flux-orchestrator-encryption
  namespace: flux-orchestrator
type: Opaque
stringData:
  ENCRYPTION_KEY: "YOUR_GENERATED_KEY_HERE"
```

**Important**: Update the `ENCRYPTION_KEY` value in [deploy/kubernetes/manifests.yaml](../deploy/kubernetes/manifests.yaml) before deploying!

### Local Development

Set the environment variable:

```bash
export ENCRYPTION_KEY="YOUR_GENERATED_KEY_HERE"
```

Or add it to your `.env` file:

```
ENCRYPTION_KEY=YOUR_GENERATED_KEY_HERE
```

## Security Considerations

1. **Key Rotation**: If you need to rotate the encryption key:
   - Generate a new key
   - Decrypt all existing kubeconfigs with the old key
   - Re-encrypt them with the new key
   - Update the `ENCRYPTION_KEY` environment variable
   - Restart the application

2. **Key Storage**:
   - Never commit the encryption key to version control
   - Use Kubernetes Secrets or a secrets management system
   - Restrict access to the encryption key

3. **Database Access**:
   - Even with encryption, limit database access to authorized personnel
   - Use database access controls and audit logging
   - Consider additional database-level encryption (encryption at rest)

## Migration from Unencrypted Data

If you have existing unencrypted kubeconfigs in the database:

1. Generate an encryption key
2. Create a migration script to:
   - Read all kubeconfigs from the database
   - Encrypt each one
   - Update the records with encrypted data
3. Deploy the updated application with encryption enabled

## What Gets Encrypted

- **Encrypted**: Kubeconfig data stored in the `clusters.kubeconfig` column
- **Not Encrypted**: Cluster names, descriptions, IDs, status, and other metadata

## Algorithm Details

- **Algorithm**: Fernet (AES-128-CBC with HMAC-SHA256)
- **Key Size**: 256 bits (32 bytes)
- **Encoding**: URL-safe base64
- **Library**: [fernet-go](https://github.com/fernet/fernet-go)

Fernet provides:
- Authenticated encryption (prevents tampering)
- Timestamp verification
- Secure key derivation
- Industry-standard cryptographic primitives
