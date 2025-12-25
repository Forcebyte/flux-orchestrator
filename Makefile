.PHONY: help build run test clean docker-build docker-run frontend-dev backend-dev deploy

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Build backend binary
	@echo "Building backend..."
	go build -o bin/flux-orchestrator ./backend/cmd/server

frontend-build: ## Build frontend
	@echo "Building frontend..."
	cd frontend && npm install && npm run build

run: ## Run the application locally (requires PostgreSQL)
	@echo "Starting backend..."
	go run backend/cmd/server/main.go

frontend-dev: ## Run frontend in development mode
	@echo "Starting frontend development server..."
	cd frontend && npm run dev

backend-dev: ## Run backend in development mode
	@echo "Starting backend..."
	DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=flux_orchestrator DB_SSLMODE=disable PORT=8080 go run backend/cmd/server/main.go

test: ## Run tests
	@echo "Running Go tests..."
	go test -v ./...

clean: ## Clean build artifacts
	@echo "Cleaning..."
	rm -rf bin/
	rm -rf frontend/build/
	rm -rf frontend/node_modules/

docker-build: ## Build Docker image
	@echo "Building Docker image..."
	docker build -t flux-orchestrator:latest .

docker-run: ## Run with Docker Compose
	@echo "Starting services with Docker Compose..."
	docker-compose up -d

docker-stop: ## Stop Docker Compose services
	@echo "Stopping services..."
	docker-compose down

deploy: ## Deploy to Kubernetes
	@echo "Deploying to Kubernetes..."
	kubectl apply -f deploy/kubernetes/manifests.yaml

deploy-delete: ## Delete from Kubernetes
	@echo "Removing from Kubernetes..."
	kubectl delete -f deploy/kubernetes/manifests.yaml
