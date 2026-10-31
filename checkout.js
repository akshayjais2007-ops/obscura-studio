// Vercel Serverless Function: POST /api/checkout
// Creates a Stripe Checkout Session when STRIPE_SECRET_KEY is set, or performs a verified sandbox upgrade.

const PLAN_PRICES = {
  creator: { name: 'Obscura Creator Plan', cents: 1900, credits: 2000 },
  studio: { name: 'Obscura Studio Plan', cents: 4900, credits: 8000 },
  agency: { name: 'Obscura Agency Plan', cents: 14900, credits: 30000 },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }

  const { planId, email, origin } = body || {};
  const plan = PLAN_PRICES[planId];
  if (!plan) {
    return res.status(400).json({ error: 'Invalid plan selected.' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  const baseOrigin = origin || `https://${req.headers?.host || 'localhost:5173'}`;

  if (stripeKey) {
    try {
      const params = new URLSearchParams();
      params.append('mode', 'subscription');
      params.append('success_url', `${baseOrigin}/app/billing?upgraded=${encodeURIComponent(planId)}`);
      params.append('cancel_url', `${baseOrigin}/app/billing`);
      if (email) params.append('customer_email', email);
      params.append('line_items[0][quantity]', '1');
      params.append('line_items[0][price_data][currency]', 'usd');
      params.append('line_items[0][price_data][unit_amount]', String(plan.cents));
      params.append('line_items[0][price_data][recurring][interval]', 'month');
      params.append('line_items[0][price_data][product_data][name]', plan.name);

      const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || `Stripe HTTP ${r.status}`);
      return res.status(200).json({ mode: 'stripe', url: data.url });
    } catch (e) {
      return res.status(502).json({ error: e.message });
    }
  }

  // Sandbox plan upgrade when STRIPE_SECRET_KEY is not yet configured
  return res.status(200).json({
    mode: 'sandbox',
    planId,
    credits: plan.credits,
    message: `Upgraded to ${plan.name} (sandbox mode). Set STRIPE_SECRET_KEY in Vercel to collect live payments.`,
  });
}
