// Vercel Serverless Function: GET /api/stock?q=...
const CURATED_STOCK = [
  { id: 101, keywords: ['forest', 'nature', 'sunrise', 'fog', 'mountain', 'morning', 'calm', 'quiet'], thumb: '/media/scene-forest.jpg', full: '/media/scene-forest.jpg', photographer: 'Obscura Studio Sample (AI)', url: 'https://www.pexels.com' },
  { id: 102, keywords: ['city', 'night', 'rain', 'street', 'urban', 'traffic', 'neon'], thumb: '/media/scene-city.jpg', full: '/media/scene-city.jpg', photographer: 'Obscura Studio Sample (AI)', url: 'https://www.pexels.com' },
  { id: 103, keywords: ['studio', 'creator', 'podcast', 'microphone', 'camera', 'desk', 'work'], thumb: '/media/scene-studio.jpg', full: '/media/scene-studio.jpg', photographer: 'Obscura Studio Sample (AI)', url: 'https://www.pexels.com' },
  { id: 104, keywords: ['kitchen', 'food', 'cooking', 'chef', 'recipe', 'plating', 'restaurant'], thumb: '/media/scene-kitchen.jpg', full: '/media/scene-kitchen.jpg', photographer: 'Obscura Studio Sample (AI)', url: 'https://www.pexels.com' },
  { id: 105, keywords: ['hero', 'eclipse', 'cinematic', 'horizon', 'dark', 'space', 'premiere'], thumb: '/media/hero.jpg', full: '/media/hero.jpg', photographer: 'Obscura Studio Sample (AI)', url: 'https://www.pexels.com' },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const url = new URL(req.url || '/api/stock', `http://${req.headers?.host || 'localhost'}`);
  const q = (url.searchParams.get('q') || req.query?.q || 'cinematic').toString().trim();
  const pexelsKey = process.env.PEXELS_API_KEY?.trim();
  const strict = process.env.STRICT_INTEGRATIONS === '1';

  if (pexelsKey) {
    try {
      const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape`, {
        headers: { Authorization: pexelsKey },
        signal: AbortSignal.timeout(7000),
      });
      if (!r.ok) throw new Error(`Pexels API returned HTTP ${r.status}`);
      const data = await r.json();
      const results = (data.photos || []).map((p) => ({
        id: p.id,
        thumb: p.src?.medium || p.src?.small,
        full: p.src?.large2x || p.src?.large || p.src?.original,
        photographer: p.photographer || 'Pexels Contributor',
        url: p.url || 'https://www.pexels.com',
      }));
      return res.status(200).json({ results, provider: 'pexels' });
    } catch (e) {
      if (strict) return res.status(502).json({ error: e.message });
    }
  }

  if (strict) {
    return res.status(501).json({ error: 'PEXELS_API_KEY is not configured.' });
  }

  const terms = q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const scored = CURATED_STOCK.map((item) => {
    const hits = terms.filter((t) => item.keywords.some((k) => k.includes(t) || t.includes(k))).length;
    return { item, hits };
  }).sort((a, b) => b.hits - a.hits);

  return res.status(200).json({
    results: scored.map(({ item }) => ({
      id: item.id,
      thumb: item.thumb,
      full: item.full,
      photographer: item.photographer,
      url: item.url,
    })),
    provider: 'built-in-catalog',
  });
}
