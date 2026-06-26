.PHONY: api-dev web-dev dev test typecheck compose-config

api-dev:
	cd api && uv run python main.py

web-dev:
	cd web && BACKEND_URL=$${BACKEND_URL:-http://127.0.0.1:8000} pnpm run dev

dev:
	@printf '%s\n' 'Starting API on http://127.0.0.1:8000 and Web on http://127.0.0.1:3000'
	@trap 'kill 0' INT TERM EXIT; \
	(cd api && uv run python main.py) & \
	(cd web && BACKEND_URL=$${BACKEND_URL:-http://127.0.0.1:8000} pnpm run dev) & \
	wait

test:
	cd api && uv run python -m pytest -q
	cd web && pnpm run test:unit

typecheck:
	cd web && pnpm exec tsc --noEmit

compose-config:
	docker compose -f deploy/hs/docker-compose.yml config
