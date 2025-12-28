# Flux Orchestrator Demo Site

This guide explains how to deploy a demo version of Flux Orchestrator to Vercel.

## What is Demo Mode?

Demo mode displays the Flux Orchestrator UI with realistic mock data instead of connecting to a real backend

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

## Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/forcebyte/flux-orchestrator&env=VITE_DEMO_MODE&envDescription=Demo%20mode%20configuration&envLink=https://github.com/forcebyte/flux-orchestrator/blob/main/DEMO.md&project-name=flux-orchestrator-demo&repository-name=flux-orchestrator-demo)

1. Click the "Deploy with Vercel" button above
2. Set the environment variable `VITE_DEMO_MODE` to `true`
3. Deploy!
