# Backend builder
FROM golang:1.23-alpine AS backend-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY backend ./backend
RUN CGO_ENABLED=0 GOOS=linux go build -o /flux-orchestrator ./backend/cmd/server

# Frontend builder
FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
RUN npm run build

# Final image
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=backend-builder /flux-orchestrator .
COPY --from=frontend-builder /app/build ./frontend/build

EXPOSE 8080
CMD ["./flux-orchestrator"]
