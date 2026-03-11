#!/usr/bin/env bash
set -euo pipefail

DEPLOYMENT_ID="${1:-dpl_AvMjMZCjuR1JduuWLZnqXBw5QP3J}"
OUT_DIR="${2:-exact-copy}"
TREE_JSON="/tmp/deployment-files-${DEPLOYMENT_ID}.json"

mkdir -p "$OUT_DIR"
XDG_CACHE_HOME=/tmp VERCEL_DISABLE_UPDATE_CHECK=1 vercel api "/v13/deployments/${DEPLOYMENT_ID}/files" > "$TREE_JSON"

node - "$TREE_JSON" "$OUT_DIR" "$DEPLOYMENT_ID" <<'NODE'
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const treePath = process.argv[2];
const outDir = process.argv[3];
const deploymentId = process.argv[4];
const tree = JSON.parse(fs.readFileSync(treePath, 'utf8'));

const files = [];
function walk(node, parent) {
  const current = parent ? path.posix.join(parent, node.name) : node.name;
  if (node.type === 'directory') {
    for (const child of node.children || []) walk(child, current);
    return;
  }
  if (node.type === 'file') {
    files.push({ rel: current, uid: node.uid, mode: node.mode });
  }
}
for (const n of tree) walk(n, '');

for (const f of files) {
  const target = path.join(outDir, f.rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });

  const cmd = `XDG_CACHE_HOME=/tmp VERCEL_DISABLE_UPDATE_CHECK=1 vercel api /v8/deployments/${deploymentId}/files/${f.uid}`;
  const raw = execSync(cmd, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  });
  const parsed = JSON.parse(raw);
  const b64 = parsed && parsed.data;
  if (!b64) {
    throw new Error(`No data for ${f.rel} (${f.uid})`);
  }
  fs.writeFileSync(target, Buffer.from(b64, 'base64'));

  if ((f.mode & 0o111) !== 0) {
    fs.chmodSync(target, 0o755);
  }
  process.stdout.write(`Recovered ${f.rel}\n`);
}

console.log(`Recovered ${files.length} files to ${outDir}`);
NODE
