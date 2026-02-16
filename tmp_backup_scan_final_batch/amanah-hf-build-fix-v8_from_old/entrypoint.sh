#!/bin/sh
set -e

# Hugging Face Spaces expects the app to listen on port 7860
PORT="${PORT:-7860}"

# Serve the built Vite app
exec serve -s dist -l "$PORT"
