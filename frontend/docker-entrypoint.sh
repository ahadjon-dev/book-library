#!/bin/sh
# Inject runtime environment variables into env-config.js
# This runs AFTER the container starts, so Railway's env vars are available.
cat > /usr/share/nginx/html/env-config.js << JSEOF
window.__RUNTIME_CONFIG__ = {
  VITE_API_URL: "${VITE_API_URL:-http://localhost:8000}"
};
JSEOF

echo "Runtime config written: VITE_API_URL=${VITE_API_URL:-http://localhost:8000}"

# Start nginx
nginx -g "daemon off;"
