#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

cat > "$DIST_DIR/index.html" <<'HTML'
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Portfolio - Lite Preview</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: radial-gradient(circle at 20% 10%, #1f2937 0%, #000 65%);
      font-family: "IBM Plex Mono", Menlo, Monaco, monospace;
      color: #e5e7eb;
      padding: 24px;
    }
    .card {
      width: min(760px, 100%);
      border: 1px solid #374151;
      border-radius: 14px;
      background: rgba(17, 24, 39, 0.78);
      backdrop-filter: blur(2px);
      padding: 28px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.45);
    }
    h1 { margin: 0 0 10px; font-size: 28px; }
    p { margin: 8px 0; line-height: 1.5; color: #cbd5e1; }
    .tag {
      display: inline-block;
      margin-bottom: 14px;
      border: 1px solid #4b5563;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: #93c5fd;
    }
  </style>
</head>
<body>
  <main class="card">
    <span class="tag">Lite Deploy Active</span>
    <h1>Portfolio Preview Is Live</h1>
    <p>This is a temporary lightweight deployment to bypass Vercel build memory limits.</p>
    <p>The full 3D scene remains in the codebase and can be re-enabled once build resources are increased.</p>
  </main>
</body>
</html>
HTML

echo "Built lite site to $DIST_DIR"
