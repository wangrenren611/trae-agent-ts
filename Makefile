.PHONY: help install install-dev build test test-watch lint format clean dev

# Default target
help:
	@echo "Available targets:"
	@echo "  install      - Install production dependencies"
	@echo "  install-dev  - Install development dependencies"
	@echo "  build        - Build the project"
	@echo "  test         - Run tests"
	@echo "  test-watch   - Run tests in watch mode"
	@echo "  lint         - Run linting"
	@echo "  format       - Format code"
	@echo "  clean        - Clean build artifacts"
	@echo "  dev          - Start development mode"

# Installation
install:
	npm ci --production

install-dev:
	npm ci

# Build
build:
	npm run build

# Testing
test:
	npm test

test-watch:
	npm run test:watch

test-coverage:
	npm run test:coverage

# Code quality
lint:
	npm run lint

lint-fix:
	npm run lint:fix

format:
	npm run format

format-check:
	npm run format:check

# Development
dev:
	npm run build:watch

# Cleanup
clean:
	rm -rf dist/
	rm -rf coverage/
	rm -rf node_modules/
	rm -rf .nyc_output/
	rm -f *.tsbuildinfo

# All checks before commit
check: lint format-check test

# Release preparation
pre-release: clean install-dev build test
	@echo "Project is ready for release!"

# Docker support
docker-build:
	docker build -t trae-agent-ts .

docker-run:
	docker run -it --rm -v $(PWD):/workspace trae-agent-ts

# Documentation
docs:
	@echo "Opening documentation..."
	@echo "See README.md for detailed documentation"