#!/bin/bash
# SessionStart hook pentru Claude Code on the web.
# Pregateste mediul: instaleaza dependentele si scrie un .env.local din .env.example
# daca lipseste, astfel incat lint/test/dev sa mearga imediat in sesiune.
set -euo pipefail

# Ruleaza doar in mediul remote (Claude Code on the web). Local nu e necesar.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Asigura pnpm (prin corepack daca lipseste).
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable pnpm 2>/dev/null || npm install -g pnpm
fi

# Instaleaza dependentele (install, nu ci - profita de cache-ul containerului).
pnpm install --frozen-lockfile || pnpm install

# Scaffold .env.local din exemplu daca lipseste (valorile reale se pun in
# secretele environment-ului, nu in repo).
if [ ! -f .env.local ] && [ -f .env.example ]; then
  cp .env.example .env.local
  echo "Creat .env.local din .env.example (completeaza valorile Supabase)."
fi

# Expune calea catre Chromium pre-provizionat pentru Playwright, daca exista.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  CHROME_BIN="$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1 || true)"
  if [ -n "$CHROME_BIN" ]; then
    echo "export PLAYWRIGHT_CHROMIUM_PATH=\"$CHROME_BIN\"" >> "$CLAUDE_ENV_FILE"
  fi
fi

echo "Setup complet: dependinte instalate."
