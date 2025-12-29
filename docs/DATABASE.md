---
layout: default
title: Database
nav_order: 1
parent: Operations
permalink: /database
description: "PostgreSQL and MySQL configuration"
---

# Database Support
{: .no_toc }

Configure PostgreSQL or MySQL for Flux Orchestrator.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

# Database Support

Flux Orchestrator supports both PostgreSQL and MySQL as database backends.

## Database Drivers

The application uses the `DB_DRIVER` environment variable to determine which database to use:
- `postgres` - PostgreSQL (default)
- `mysql` - MySQL/MariaDB

## PostgreSQL (Default)

### Local Development

```bash
# Start PostgreSQL
docker run -d \
  --name flux-orchestrator-postgres \
  -e POSTGRES_DB=flux_orchestrator \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15-alpine

# Configure backend
export DB_DRIVER=postgres
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASSWORD=postgres
export DB_NAME=flux_orchestrator
export DB_SSLMODE=disable
export PORT=8080

# Start backend
go run backend/cmd/server/main.go
```

### Docker Compose

```bash
docker-compose up -d
```

### Kubernetes

The default `deploy/kubernetes/manifests.yaml` includes a PostgreSQL StatefulSet.

## MySQL

### Local Development

```bash
# Start MySQL
docker run -d \
  --name flux-orchestrator-mysql \
  -e MYSQL_DATABASE=flux_orchestrator \
  -e MYSQL_USER=flux \
  -e MYSQL_PASSWORD=flux \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -p 3306:3306 \
  mysql:8

# Configure backend
export DB_DRIVER=mysql
export DB_HOST=localhost
export DB_PORT=3306
export DB_USER=flux
export DB_PASSWORD=flux
export DB_NAME=flux_orchestrator
export PORT=8080

# Start backend
go run backend/cmd/server/main.go
```

### Docker Compose

```bash
docker-compose -f docker-compose-mysql.yml up -d
```

### Kubernetes

To use MySQL in Kubernetes:

1. Remove the PostgreSQL StatefulSet from `deploy/kubernetes/manifests.yaml`
2. Add a MySQL StatefulSet or use an external MySQL instance
3. Update the ConfigMap:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: flux-orchestrator-config
  namespace: flux-orchestrator
data:
  DB_DRIVER: "mysql"
  DB_HOST: "mysql"
  DB_PORT: "3306"
  DB_USER: "flux"
  DB_NAME: "flux_orchestrator"
  PORT: "8080"
```

## Schema Differences

The application automatically handles schema differences between PostgreSQL and MySQL:

### PostgreSQL
- Uses `JSONB` for metadata storage
- Uses `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` for timestamps
- Foreign key constraints inline in table definition

### MySQL
- Uses `JSON` for metadata storage
- Uses `TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
- Foreign key constraints as separate clauses
- `NULL` timestamp columns explicitly declared

## External Databases

For production deployments, it's recommended to use managed database services:

### PostgreSQL Services
- AWS RDS PostgreSQL
- Azure Database for PostgreSQL
- Google Cloud SQL for PostgreSQL
- DigitalOcean Managed PostgreSQL

### MySQL Services
- AWS RDS MySQL
- Azure Database for MySQL
- Google Cloud SQL for MySQL
- DigitalOcean Managed MySQL

### Configuration

Set the connection parameters via environment variables:

```yaml
env:
  - name: DB_DRIVER
    value: "postgres"  # or "mysql"
  - name: DB_HOST
    value: "your-db-host.region.provider.com"
  - name: DB_PORT
    value: "5432"  # or "3306" for MySQL
  - name: DB_USER
    valueFrom:
      secretKeyRef:
        name: db-credentials
        key: username
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: db-credentials
        key: password
  - name: DB_NAME
    value: "flux_orchestrator"
  - name: DB_SSLMODE
    value: "require"  # for PostgreSQL only
```

## Performance Considerations

Both PostgreSQL and MySQL perform well for the Flux Orchestrator use case:

- **PostgreSQL**: Better JSON query performance, native JSONB support
- **MySQL**: Simpler setup, wider support in some environments

For most deployments, the choice between PostgreSQL and MySQL will depend on:
- Existing infrastructure and expertise
- Compliance requirements
- Cloud provider preferences
- Backup and disaster recovery procedures

## Migration Between Databases

To migrate from PostgreSQL to MySQL (or vice versa):

1. Export data from the source database
2. Set up the target database
3. Update the `DB_DRIVER` environment variable
4. Restart the application (schema will be auto-created)
5. Re-add clusters via the UI or API

Note: Direct database migration tools may not preserve all data types correctly due to differences in JSON storage. It's recommended to re-register clusters rather than migrate data.
