// Vercel Serverless Function: GET / POST /api/db
// Syncs Obscura relational database state to serverless storage (/tmp/obscura-db.json) or Postgres webhook.
import fs from 'node:fs';
import path from 'node:path';

const TMP_FILE = path.join('/tmp', 'obscura-cloud-db.json');
let memoryStore = null;

function readStore() {
  if (memoryStore) return memoryStore;
  try {
    if (fs.existsSync(TMP_FILE)) {
      memoryStore = JSON.parse(fs.readFileSync(TMP_FILE, 'utf-8'));
      return memoryStore;
    }
  } catch {}
  return null;
}

function writeStore(data) {
  memoryStore = data;
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(data), 'utf-8');
  } catch {}
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const stored = readStore();
    return res.status(200).json({
      ok: true,
      syncedAt: stored?.syncedAt || null,
      db: stored?.db || null,
    });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON payload' }); }
    }
    const incoming = body?.db;
    if (!incoming || incoming.version !== 1 || !Array.isArray(incoming.users)) {
      return res.status(400).json({ error: 'Invalid Obscura DB snapshot format' });
    }
    const payload = { db: incoming, syncedAt: Date.now() };
    writeStore(payload);
    return res.status(200).json({ ok: true, syncedAt: payload.syncedAt });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
