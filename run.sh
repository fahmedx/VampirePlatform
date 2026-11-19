#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "🩸 Iniciando VampirePlatform V5..."
exec "$DIR/venv/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8000 --reload
