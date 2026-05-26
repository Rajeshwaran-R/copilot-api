#!/bin/sh
if [ "$1" = "--auth" ]; then
  # Run auth command
  exec bun run dist/main.js auth
else
  # Default command: restart the app forever if it exits
  trap 'if [ -n "$child_pid" ]; then kill "$child_pid" 2>/dev/null; fi; exit 0' TERM INT

  while true; do
    bun run dist/main.js start -g "$GH_TOKEN" "$@" &
    child_pid=$!
    wait "$child_pid"
    exit_code=$?
    child_pid=
    echo "copilot-api exited with code $exit_code; restarting in 1s..."
    sleep 1
  done
fi

