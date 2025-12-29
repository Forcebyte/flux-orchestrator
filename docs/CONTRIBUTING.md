---
layout: default
title: Contributing
nav_order: 13
description: "How to contribute to Flux Orchestrator"
---

# Contributing to Flux Orchestrator
{: .no_toc }

Learn how to contribute to the project.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

# Contributing Overview

Thank you for your interest in contributing to Flux Orchestrator! This document provides guidelines and information for contributors.

## Code of Conduct

Please be respectful and considerate in your interactions with other contributors.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Go version, etc.)

### Suggesting Features

Feature suggestions are welcome! Please create an issue describing:
- The use case
- How it would work
- Why it would be valuable

### Submitting Changes

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow the existing code style
   - Add tests if applicable
   - Update documentation

4. **Test your changes**
   ```bash
   # Backend
   go test ./...
   go build ./backend/cmd/server
   
   # Frontend
   cd frontend
   npm run build
   ```

5. **Commit your changes**
   - Use clear, descriptive commit messages
   - Reference issues if applicable
   ```bash
   git commit -m "Add feature X to improve Y"
   ```

6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request**
   - Describe what your PR does
   - Link to related issues
   - Explain any breaking changes

## Development Setup

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed setup instructions.

## Code Style

### Go

- Follow standard Go conventions
- Run `go fmt` before committing
- Use meaningful variable and function names
- Add comments for exported functions
- Keep functions small and focused

### TypeScript/React

- Use TypeScript for type safety
- Follow React best practices
- Use functional components with hooks
- Keep components focused and reusable
- Use meaningful component and variable names

### Documentation

- Update README.md if adding features
- Add inline comments for complex logic
- Update API documentation for API changes
- Include examples where helpful

## Testing

- Add tests for new features
- Ensure existing tests pass
- Test manually when possible

### Backend Tests

```bash
go test ./...
```

### Frontend Tests

```bash
cd frontend
npm test
```

## Pull Request Process

1. Ensure your PR has a clear description
2. Link to related issues
3. Update documentation
4. Wait for review from maintainers
5. Address review feedback
6. Once approved, your PR will be merged

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Feel free to open an issue for any questions about contributing!
