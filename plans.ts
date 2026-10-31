import type { Config, Plan } from './types';

export const PLANS: Plan[] = [
  { id: 'free', name: 'Free', price: 0, monthlyCredits: 200, maxRes: 720, seats: 1, storageMB: 2000, blurb: 'Learn the studio and ship your first videos.' },
  { id: 'creator', name: 'Creator', price: 19, monthlyCredits: 2000, maxRes: 1080, seats: 1, storageMB: 20000, blurb: 'For weekly YouTubers and short-form creators.' },
  { id: 'studio', name: 'Studio', price: 49, monthlyCredits: 8000, maxRes: 1080, seats: 5, storageMB: 100000, blurb: 'Small teams, brand kits and client reviews.' },
  { id: 'agency', name: 'Agency', price: 149, monthlyCredits: 30000, maxRes: 1080, seats: 25, storageMB: 500000, blurb: 'Client spaces, pipelines and delivery kits.' },
];

export const DEFAULT_CONFIG: Config = {
  costs: { renderPer15s: 1, draftPer15s: 0, aiScript: 5, aiHooks: 3, aiTitles: 2, aiFactcheck: 6 },
  failedJobPolicy: 'full_refund',
};

export const planById = (id: string) => PLANS.find((p) => p.id === id) ?? PLANS[0];

/** Pure: credit cost for a render of `duration` seconds. */
export function renderCost(duration: number, draft: boolean, cfg: Config = DEFAULT_CONFIG) {
  const per = draft ? cfg.costs.draftPer15s : cfg.costs.renderPer15s;
  if (per <= 0) return 0;
  return Math.max(1, Math.ceil(duration / 15) * per);
}

/** Pure: can a user afford a charge */
export function canAfford(balance: number, cost: number) {
  return cost <= 0 || balance >= cost;
}
