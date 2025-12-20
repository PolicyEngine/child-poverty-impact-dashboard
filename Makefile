.PHONY: install install-backend install-frontend dev dev-backend dev-frontend test format clean

# Install all dependencies
install:
	uv venv
	. .venv/bin/activate && uv pip install -e ".[dev]"
	. .venv/bin/activate && uv pip install -r backend/requirements.txt
	cd frontend && bun install

# Install backend only
install-backend:
	uv venv
	. .venv/bin/activate && uv pip install -e ".[dev]"
	. .venv/bin/activate && uv pip install -r backend/requirements.txt

# Install frontend only
install-frontend:
	cd frontend && bun install

# Run full stack (backend + frontend)
dev:
	@echo "Starting backend on http://localhost:8000..."
	@. .venv/bin/activate && cd backend && uvicorn app.main:app --reload --port 8000 &
	@echo "Starting frontend on http://localhost:3000..."
	@cd frontend && bun run dev

# Run backend only
dev-backend:
	. .venv/bin/activate && cd backend && uvicorn app.main:app --reload --port 8000

# Run frontend only
dev-frontend:
	cd frontend && bun run dev

# Run tests
test:
	. .venv/bin/activate && pytest tests/

# Format code
format:
	. .venv/bin/activate && black .
	. .venv/bin/activate && isort .
	. .venv/bin/activate && ruff check --fix .
	cd frontend && bun run lint --fix || true

# Clean build artifacts
clean:
	rm -rf .venv
	rm -rf frontend/node_modules
	rm -rf frontend/.next
	rm -rf __pycache__ */__pycache__ */*/__pycache__
	rm -rf *.egg-info
	rm -rf .pytest_cache
	rm -rf .ruff_cache
