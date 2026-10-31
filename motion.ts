// Shared motion tokens. Components import these instead of inventing timings.
export const dur = { instant: 0.12, fast: 0.2, base: 0.34, slow: 0.6, cinematic: 1.1 } as const;
export const ease = {
  out: [0.22, 1, 0.36, 1] as [number, number, number, number],
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
  film: [0.16, 1, 0.3, 1] as [number, number, number, number],
};
export const stagger = { tight: 0.04, base: 0.07, loose: 0.12 } as const;
export const distance = { sm: 8, md: 16, lg: 32 } as const;
export const blur = { sm: 'blur(4px)', md: 'blur(10px)' } as const;
export const spring = { snappy: { type: 'spring', stiffness: 420, damping: 38 }, soft: { type: 'spring', stiffness: 220, damping: 30 } } as const;

export const fadeUp = {
  hidden: { opacity: 0, y: distance.md, filter: blur.sm },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: dur.slow, ease: ease.out } },
};
export const staggerKids = (s: number = stagger.base) => ({ hidden: {}, show: { transition: { staggerChildren: s } } });
