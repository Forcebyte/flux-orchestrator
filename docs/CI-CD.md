# CI/CD Pipeline

Flux Orchestrator uses GitHub Actions for continuous integration and delivery.

## Overview

The CI pipeline automatically builds and publishes Docker images to GitHub Container Registry (ghcr.io) on every push to certain branches and on tags.

## Workflow File

Location: `.github/workflows/build.yml`

## Triggers

The CI pipeline runs on:

1. **Push to branches:**
   - `main` branch
   - Any branch matching `copilot/**`

2. **Pull requests:**
   - Pull requests targeting `main`

3. **Tags:**
   - Any tag matching `v*` (e.g., `v1.0.0`, `v2.1.0`)

## Build Process

The workflow performs the following steps:

1. **Checkout** - Clones the repository
2. **Setup Docker Buildx** - Prepares multi-platform builds
3. **Login to GHCR** - Authenticates with GitHub Container Registry
4. **Extract Metadata** - Generates appropriate tags and labels
5. **Build and Push** - Builds the Docker image and pushes to ghcr.io

## Image Tags

Images are tagged based on the trigger:

| Trigger | Tag Format | Example |
|---------|-----------|---------|
| Main branch | `latest` | `ghcr.io/forcebyte/flux-orchestrator:latest` |
| Branch push | `branch-name` | `ghcr.io/forcebyte/flux-orchestrator:copilot-add-flux-management-ui` |
| Pull request | `pr-<number>` | `ghcr.io/forcebyte/flux-orchestrator:pr-123` |
| Commit SHA | `branch-<sha>` | `ghcr.io/forcebyte/flux-orchestrator:main-abc1234` |
| Version tag | `v1.0.0`, `1.0`, `1` | `ghcr.io/forcebyte/flux-orchestrator:v1.0.0` |

## Multi-Architecture Support

The pipeline builds images for:
- `linux/amd64` (x86_64)
- `linux/arm64` (ARM64/aarch64)

This ensures compatibility with:
- Standard x86 servers
- ARM-based servers (e.g., AWS Graviton, Azure ARM VMs)
- Apple Silicon (M1/M2) Macs for local development

## Using Pre-built Images

### Latest Version

```bash
docker pull ghcr.io/forcebyte/flux-orchestrator:latest
```

### Specific Version

```bash
docker pull ghcr.io/forcebyte/flux-orchestrator:v1.0.0
```

### Specific Branch

```bash
docker pull ghcr.io/forcebyte/flux-orchestrator:main
```

### Kubernetes Deployment

The manifests already reference the GHCR image:

```yaml
image: ghcr.io/forcebyte/flux-orchestrator:latest
```

To use a specific version:

```bash
# Edit the manifests
sed -i 's/:latest/:v1.0.0/g' deploy/kubernetes/manifests.yaml

# Apply
kubectl apply -f deploy/kubernetes/manifests.yaml
```

## Build Cache

The workflow uses GitHub Actions cache to speed up builds:
- Cache is stored per branch
- Subsequent builds reuse layers from previous builds
- Significantly reduces build time

## Permissions

The workflow requires:
- `contents: read` - To checkout the repository
- `packages: write` - To push images to GHCR

These are automatically provided by GitHub Actions.

## Image Visibility

Images are public by default on GHCR. Anyone can pull and use them:

```bash
docker pull ghcr.io/forcebyte/flux-orchestrator:latest
```

No authentication is required to pull public images.

## Manual Triggers

You can manually trigger the workflow from the GitHub Actions tab:

1. Go to the repository on GitHub
2. Click "Actions"
3. Select "Build and Push Docker Image"
4. Click "Run workflow"
5. Choose the branch
6. Click "Run workflow"

## Local Development

For local development, you can still build locally:

```bash
# Build locally
docker build -t flux-orchestrator:dev .

# Or use make
make docker-build
```

## Versioning Strategy

### Semantic Versioning

Use semantic versioning for releases:

```bash
# Tag a release
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

This will automatically:
1. Trigger the CI pipeline
2. Build and push images with tags:
   - `ghcr.io/forcebyte/flux-orchestrator:v1.0.0`
   - `ghcr.io/forcebyte/flux-orchestrator:1.0`
   - `ghcr.io/forcebyte/flux-orchestrator:1`

### Pre-release Versions

For pre-releases:

```bash
git tag -a v1.0.0-beta.1 -m "Beta release"
git push origin v1.0.0-beta.1
```

### Development Branches

Development branches are automatically built and tagged with the branch name.

## Monitoring Builds

### Via GitHub UI

1. Go to the repository
2. Click "Actions"
3. View recent workflow runs
4. Click on a run to see details and logs

### Via CLI (GitHub CLI)

```bash
# Install GitHub CLI
gh auth login

# List workflow runs
gh run list --workflow=build.yml

# View logs for a specific run
gh run view <run-id> --log
```

## Troubleshooting

### Build Failures

If the build fails:

1. Check the workflow logs in GitHub Actions
2. Look for Docker build errors
3. Verify Dockerfile syntax
4. Ensure all dependencies are available

### Image Not Found

If you can't pull an image:

1. Verify the tag exists: Check GitHub Packages
2. Ensure image visibility is public
3. Check for typos in the image name

### Slow Builds

If builds are slow:

1. Cache may not be working - check cache steps in logs
2. Consider reducing the number of layers in Dockerfile
3. Multi-stage builds help reduce final image size

## Security

### Image Scanning

Consider adding image scanning to the workflow:

```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ghcr.io/forcebyte/flux-orchestrator:${{ github.sha }}
    format: 'sarif'
    output: 'trivy-results.sarif'
```

### Secrets

Never hardcode secrets in:
- Dockerfile
- GitHub Actions workflow
- Application code

Use GitHub Secrets or Kubernetes Secrets for sensitive data.

## Cost

GitHub Actions provides:
- 2,000 minutes/month for free (public repositories)
- Unlimited minutes for public repositories (with some limitations)
- Additional minutes can be purchased for private repositories

GHCR (GitHub Container Registry):
- 500MB free storage
- 1GB free bandwidth per month
- Additional storage/bandwidth available for purchase

For this project, the free tier should be sufficient for most use cases.
