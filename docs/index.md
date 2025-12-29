---
layout: default
title: Home
nav_order: 1
description: "Flux Orchestrator - A comprehensive multi-cluster GitOps management platform for Flux CD"
permalink: /
---

# Flux Orchestrator
{: .fs-9 }

A comprehensive multi-cluster GitOps management platform for Flux CD, similar to ArgoCD's UI.
{: .fs-6 .fw-300 }

[Get Started](quickstart){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View Demo](https://flux-orchestrator-demo.vercel.app){: .btn .fs-5 .mb-4 .mb-md-0 }
[GitHub](https://github.com/Forcebyte/flux-orchestrator){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## What is Flux Orchestrator?

Flux Orchestrator provides a centralized UI and API for managing Flux CD across multiple Kubernetes clusters. It offers an easy-to-access interface to view, validate, and remediate FluxCD configurations at scale.

### Key Features

✨ **Multi-Cluster Management**
- Connect and manage multiple Kubernetes clusters from a single interface
- Real-time resource synchronization and health monitoring
- Cluster favoriting and organization

🎯 **Flux Resource Management**
- View and manage Kustomizations, HelmReleases, GitRepositories, and more
- Real-time reconciliation status and condition monitoring
- Manual reconciliation, suspend/resume operations
- Resource tree visualization with parent-child relationships

🔐 **Enterprise Security**
- Role-Based Access Control (RBAC) with granular permissions
- OAuth 2.0 authentication (GitHub, Microsoft Entra/Azure AD)
- Encrypted kubeconfig storage using Fernet encryption
- Audit logging for all operations

☁️ **Cloud Integration**
- Azure AKS cluster discovery and automatic registration
- Support for managed Kubernetes services
- In-cluster discovery mode

📊 **Advanced Features**
- YAML diff viewer for configuration changes
- Log aggregation across multiple clusters and pods
- Resource export (JSON/CSV)
- Real-time activity feed
- WebSocket support for live updates

🌓 **Modern UI**
- Dark/light theme support
- Mobile-responsive design
- Splunk-like log viewing experience
- Interactive resource trees

## Architecture

The Flux Orchestrator consists of:

- **Backend API** (Go): RESTful API server with gorilla/mux, GORM, and client-go
- **Frontend UI** (React 19 + TypeScript): Modern Vite-powered interface
- **Database**: PostgreSQL or MySQL for storing configurations and cached states
- **Kubernetes Integration**: Direct cluster access via kubeconfig

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Forcebyte/flux-orchestrator.git
cd flux-orchestrator

# Start with Docker Compose (PostgreSQL)
docker-compose up -d

# Or with MySQL
docker-compose -f docker-compose-mysql.yml up -d

# Access the UI
open http://localhost:3000
```

For detailed setup instructions, see the [Quick Start Guide](quickstart).

## Demo Mode

Try the hosted demo without installing anything:

🔗 **[Live Demo](https://flux-orchestrator-demo.vercel.app)**

Or run locally:
```bash
cd frontend
npm install
npm run dev:demo
```

See [DEMO.md](https://github.com/Forcebyte/flux-orchestrator/blob/main/DEMO.md) for more information.

## Documentation

<div class="code-example" markdown="1">

### Getting Started
- [Quick Start Guide](quickstart) - Get up and running in 5 minutes
- [Development Setup](development) - Local development environment
- [Architecture Overview](architecture) - System design and components

### Features
- [RBAC & Permissions](rbac) - Role-based access control
- [OAuth Authentication](oauth) - GitHub & Entra ID integration
- [Azure AKS Integration](azure-aks) - Automatic cluster discovery
- [Resource Diff & Logs](diff-viewer-and-logs) - Advanced debugging tools
- [Mobile Support](mobile) - Responsive design features

### Operations
- [Database Setup](database) - PostgreSQL & MySQL configuration
- [Encryption](encryption) - Fernet key management

### Contributing
- [Contributing Guide](contributing) - How to contribute to the project

</div>

## System Requirements

### Production
- Kubernetes 1.19+
- PostgreSQL 12+ or MySQL 8+
- 2+ CPU cores
- 4GB+ RAM

### Development
- Go 1.21+
- Node.js 18+
- Docker & Docker Compose

## License

Apache License 2.0 - See [LICENSE](https://github.com/Forcebyte/flux-orchestrator/blob/main/LICENSE)

## Support

- 📖 [Documentation](https://forcebyte.github.io/flux-orchestrator)
- 🐛 [Issue Tracker](https://github.com/Forcebyte/flux-orchestrator/issues)
- 💬 [Discussions](https://github.com/Forcebyte/flux-orchestrator/discussions)

---

Built with ❤️ for the Flux CD community
