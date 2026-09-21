#!/bin/sh
set -eu
debug_val="$(printf '%s' "${DEBUG:-false}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
level_val="$(printf '%s' "${LOG_LEVEL:-info}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"

if [ "$debug_val" = "1" ] || [ "$debug_val" = "true" ] || [ "$debug_val" = "yes" ] || [ "$debug_val" = "on" ] || [ "$level_val" = "debug" ]; then
    debug_enabled=true
else
    debug_enabled=false
fi
# Outside the read-only source mounts; only a boolean reaches the browser.
printf 'globalThis.CEM_DEBUG = %s;\n' "$debug_enabled" > /usr/share/nginx/html/runtime-debug.js
