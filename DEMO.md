# Flux Orchestrator Demo Site

This guide explains how to deploy a demo version of Flux Orchestrator to Vercel.

## What is Demo Mode?

Demo mode displays the Flux Orchestrator UI with realistic mock data instead of connecting to a real backend. Perfect for:
- Evaluating the UI without cluster access
- Testing UI changes without backend
- Presentations and demonstrations
- Documentation screenshots

## Features in Demo Mode

The demo includes:

- 3 sample Kubernetes clusters (Production, Staging, Development)
- 8+ mock Flux resources (Kustomizations, HelmReleases, GitRepositories)
- Activity feed with recent actions
- Flux statistics and health status
- Azure AKS subscription management UI
- OAuth provider configuration UI
- Resource tree visualization
- Settings management

## Try it out

[![Demo Site Screenshot](docs/demo-screenshot.png)](https://flux-orchestrator-demo.vercel.app)

[🚀 View Live Demo](https://flux-orchestrator-demo.vercel.app)

## Local Development in Demo Mode

To run demo mode locally:

```bash
# Clone th

## Demo vs Production

| Feature | Demo Mode | Production Mode |
|---------|-----------|-----------------|
| Data Source | Mock/Static data | Real Kubernetes clusters |
| Cluster Connection | Not required | Required |
| Resource Updates | Simulated only | Actual updates to cluster |
| Authentication | Disabled | OAuth supported |
| Backend API | Not required | Required |
| Database | Not required | PostgreSQL/MySQL required |

## Limitations

In demo mode:
- No real cluster connections are made
- Changes are simulated and don't persist
- Authentication is disabled
- API calls use mock responses
- Real-time updates are simulated

## Production Setup

For a full production deployment with real cluster connections, see:
- [Quick Start Guide](README.md#quick-start)
- [Architecture Documentation](docs/ARCHITECTURE.md)
- [Kubernetes Deployment](docs/AZURE_AKS.md)e repository
git clone https://github.com/forcebyte/flux-orchestrator.git
cd flux-orchestrator

# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Run in demo mode
npm run dev:demo
```

The app will be available at `http://localhost:5173`

Alternatively, set the environment variable manually:
```bash
export VITE_DEMO_MODE=true
npm run dev
```


## Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/forcebyte/flux-orchestrator&env=VITE_DEMO_MODE&envDescription=Demo%20mode%20configuration&envLink=https://github.com/forcebyte/flux-orchestrator/blob/main/demo.md&project-name=flux-orchestrator-demo&repository-name=flux-orchestrator-demo)

1. Click the "Deploy with Vercel" button above
2. Set the environment variable `VITE_DEMO_MODE` to `true`
3. Deploy!
