# Repository Guidelines

## Project Structure & Module Organization
- `cmd/yaci/`: CLI entrypoint and command wiring.
- `internal/`: core packages (client, extractor, output, metrics, config, utils, testutil).
- `docs/`: user and deployment documentation.
- `docker/` and `scripts/`: local/e2e infrastructure and deployment helpers.
- `config/`: sample configuration and templates.

## Build, Test, and Development
- Build development binary: `make build` (outputs `bin/yaci`).
- Unit tests: `make test` (`go test -short -race ./...`).
- End-to-end tests: `make test-e2e` (uses Docker infra, 30m timeout).
- Coverage: `make coverage` (prints summary and generates `coverage.html`).
- Lint & format: `make lint`, `make lint-fix`, `make format`.
- Local demo stack: `make docker-up` / `make docker-down`.

## Coding Style & Naming
- Language: Go; use tabs for indentation and `goimports` via `make format` for imports and spacing.
- Keep imports grouped; local imports under `github.com/manifest-network/yaci`.
- Exported identifiers: PascalCase; unexported: camelCase; avoid abbreviations in public APIs.
- New CLI commands live under `cmd/yaci/`; reusable logic belongs in `internal/<package>/`.

## Testing Guidelines
- Place tests in `*_test.go` files near the code; prefer table-driven tests.
- Use helpers in `internal/testutil/` when touching DB, I/O, or integration logic.
- Ensure `make test` passes locally; add or update tests to keep coverage roughly stable.

## Commit & Pull Request Guidelines
- Prefer conventional prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `ci:` plus a short imperative summary (e.g., `feat: add postgres events view`).
- Reference issues/PRs in the body (`Closes #123`) when applicable.
- PRs should describe motivation, key changes, and testing (`make test`, `make test-e2e` if relevant); include screenshots or logs for user-visible or operational changes.

## Security & Configuration
- Never commit secrets or real connection strings; use placeholders in examples.
- Use env vars (`YACI_*`) or config files as documented in `README.md` and `docs/`.
- Run `make govulncheck` for significant dependency, security, or protocol-related changes.

