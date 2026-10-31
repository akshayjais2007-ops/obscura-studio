// Structure templates (deterministic, not AI). They turn form answers into an editable scene list.
import type { Aspect, Scene } from './types';
import { newScene } from './project';

export interface TField { key: string; label: string; placeholder?: string; type?: 'text' | 'textarea' | 'number'; hint?: string }
export interface Template { id: string; name: string; aspect: Aspect; fields: TField[]; build: (v: Record<string, string>) => { title: string; scenes: Scene[] }; mediaHint: string }

const lines = (s = '') => s.split(/\n+/).map((x) => x.replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean);
const sentences = (s = '') => s.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
const sec = (n: number) => Math.max(2, Math.round(n * 10) / 10);
const readTime = (t: string) => sec(t.split(/\s+/).filter(Boolean).length / 2.6 + 0.8);

export const TEMPLATES: Record<string, Template> = {
  autopilot: {
    id: 'autopilot', name: 'Guided video', aspect: '16:9', mediaHint: 'Add a photo or clip for each scene.',
    fields: [{ key: 'topic', label: 'What is your video about?', placeholder: 'Three habits that helped me sleep better', type: 'textarea' }, { key: 'points', label: 'Main points (one per line)', type: 'textarea', placeholder: 'No screens after 10pm\nSame wake time daily\nCool, dark room' }, { key: 'cta', label: 'What should viewers do at the end?', placeholder: 'Subscribe for more' }],
    build: (v) => {
      const pts = lines(v.points);
      const scenes = [newScene({ title: v.topic || 'Intro', narration: v.topic ? `Here’s what nobody tells you about ${v.topic.toLowerCase()}.` : '', duration: 4, visual: v.topic })];
      pts.forEach((p, i) => scenes.push(newScene({ title: `${i + 1}. ${p}`, narration: p.endsWith('.') ? p : p + '.', duration: readTime(p) + 2, visual: p })));
      scenes.push(newScene({ title: v.cta || 'Thanks for watching', narration: v.cta ? `${v.cta}.` : 'Thanks for watching.', duration: 3 }));
      return { title: v.topic || 'My video', scenes };
    },
  },
  longform: {
    id: 'longform', name: 'Long-form YouTube', aspect: '16:9', mediaHint: 'Add A-roll and B-roll per chapter.',
    fields: [{ key: 'topic', label: 'Video topic', placeholder: 'How I built a tiny cabin for $8,000' }, { key: 'promise', label: 'What will viewers get by the end?', placeholder: 'The full cost breakdown and mistakes to avoid' }, { key: 'chapters', label: 'Chapters (one per line)', type: 'textarea', placeholder: 'Finding land\nFoundation\nFraming\nCost breakdown' }, { key: 'cta', label: 'Outro call to action', placeholder: 'Watch the build timelapse next' }],
    build: (v) => {
      const ch = lines(v.chapters);
      return {
        title: v.topic || 'Long-form video',
        scenes: [
          newScene({ title: 'Cold open', narration: `By the end of this video you’ll know ${v.promise || 'everything you need'}.`, duration: 8, visual: v.topic }),
          newScene({ title: 'Intro', narration: `This is ${v.topic || 'the story'}. Let’s get into it.`, duration: 10 }),
          ...ch.map((c) => newScene({ title: c, narration: `${c}.`, duration: 45, visual: c })),
          newScene({ title: 'Outro', narration: v.cta ? `${v.cta}.` : 'Thanks for watching.', duration: 12 }),
        ],
      };
    },
  },
  'product-ad': {
    id: 'product-ad', name: 'Product ad', aspect: '9:16', mediaHint: 'Add 3–5 product photos or clips.',
    fields: [{ key: 'product', label: 'Product name', placeholder: 'Lumen desk lamp' }, { key: 'problem', label: 'What problem does it solve?', placeholder: 'Eye strain from harsh office light' }, { key: 'benefits', label: 'Top benefits (one per line)', type: 'textarea', placeholder: 'Warm-to-cool dimming\nNo flicker\nUSB-C charging' }, { key: 'offer', label: 'Offer / CTA', placeholder: '20% off this week — tap to shop' }],
    build: (v) => ({
      title: `${v.product || 'Product'} ad`,
      scenes: [
        newScene({ title: v.problem ? `Tired of ${v.problem.toLowerCase()}?` : 'Sound familiar?', narration: v.problem ? `Tired of ${v.problem.toLowerCase()}?` : '', duration: 2.5, visual: v.problem }),
        newScene({ title: `Meet ${v.product || 'it'}`, narration: `Meet ${v.product}.`, duration: 2.5, visual: v.product }),
        ...lines(v.benefits).map((b) => newScene({ title: b, narration: b + '.', duration: 2.5, visual: `${v.product} ${b}` })),
        newScene({ title: v.offer || 'Shop now', narration: v.offer || 'Shop now.', duration: 3 }),
      ],
    }),
  },
  'local-biz': {
    id: 'local-biz', name: 'Local business promo', aspect: '9:16', mediaHint: 'Add photos of your space, team and products.',
    fields: [{ key: 'name', label: 'Business name', placeholder: 'Marigold Bakery' }, { key: 'what', label: 'What do you offer?', placeholder: 'Sourdough, pastries and coffee' }, { key: 'special', label: 'What makes you special?', placeholder: 'Baked fresh at 5am every day' }, { key: 'hours', label: 'Hours & address', placeholder: 'Tue–Sun 7–3 · 12 River St' }],
    build: (v) => ({ title: `${v.name || 'Business'} promo`, scenes: [
      newScene({ title: v.name || 'Welcome', narration: `Welcome to ${v.name}.`, duration: 3, visual: 'storefront' }),
      newScene({ title: v.what || 'What we do', narration: v.what ? v.what + '.' : '', duration: 3.5, visual: v.what }),
      newScene({ title: v.special || 'Made with care', narration: v.special ? v.special + '.' : '', duration: 3.5, visual: v.special }),
      newScene({ title: v.hours || 'Visit us', narration: `Visit us. ${v.hours ?? ''}`, duration: 4 }),
    ] }),
  },
  training: {
    id: 'training', name: 'Training video', aspect: '16:9', mediaHint: 'Add screenshots or screen recordings per step.',
    fields: [{ key: 'title', label: 'Lesson title', placeholder: 'Closing the register' }, { key: 'doc', label: 'Paste your document or SOP', type: 'textarea', hint: 'Each paragraph or numbered step becomes a scene.' }],
    build: (v) => ({ title: v.title || 'Training', scenes: [newScene({ title: v.title || 'Lesson', narration: `In this lesson: ${v.title}.`, duration: 4 }), ...lines(v.doc).map((l, i) => newScene({ title: `Step ${i + 1}`, narration: l, duration: readTime(l) + 1.5, visual: l })), newScene({ title: 'Recap', narration: 'Let’s recap the steps you just learned.', duration: 4 })] }),
  },
  textbook: {
    id: 'textbook', name: 'Textbook tutor', aspect: '16:9', mediaHint: 'Add diagrams or figures from the chapter.',
    fields: [{ key: 'chapter', label: 'Chapter title', placeholder: 'Photosynthesis' }, { key: 'text', label: 'Paste the chapter text', type: 'textarea' }],
    build: (v) => {
      const ss = sentences(v.text);
      const groups: string[] = [];
      for (let i = 0; i < ss.length; i += 2) groups.push(ss.slice(i, i + 2).join(' '));
      return { title: v.chapter || 'Chapter', scenes: [newScene({ title: v.chapter || 'Chapter', narration: `Today: ${v.chapter}.`, duration: 3.5 }), ...groups.slice(0, 14).map((g, i) => newScene({ title: `Part ${i + 1}`, narration: g, duration: readTime(g) + 1, visual: g })), newScene({ title: 'Check yourself', narration: `Pause and explain ${v.chapter} in your own words.`, duration: 5 })] };
    },
  },
  concept: {
    id: 'concept', name: 'Concept explainer', aspect: '16:9', mediaHint: 'Add a visual for the analogy and each step.',
    fields: [{ key: 'concept', label: 'Concept', placeholder: 'Compound interest' }, { key: 'analogy', label: 'Everyday analogy', placeholder: 'A snowball rolling downhill' }, { key: 'steps', label: 'How it works (one step per line)', type: 'textarea' }],
    build: (v) => ({ title: `Explaining ${v.concept || 'a concept'}`, scenes: [newScene({ title: `What is ${v.concept}?`, narration: `What is ${v.concept}?`, duration: 3 }), newScene({ title: 'Think of it like…', narration: v.analogy ? `Think of it like ${v.analogy.toLowerCase()}.` : '', duration: 4, visual: v.analogy }), ...lines(v.steps).map((s, i) => newScene({ title: `Step ${i + 1}`, narration: s, duration: readTime(s) + 1, visual: s })), newScene({ title: 'In one sentence', narration: `That’s ${v.concept}.`, duration: 3 })] }),
  },
  language: {
    id: 'language', name: 'Language practice', aspect: '9:16', mediaHint: 'Optional: add an image for each phrase.',
    fields: [{ key: 'lang', label: 'Language', placeholder: 'Spanish' }, { key: 'pairs', label: 'Phrases: “phrase = translation” per line', type: 'textarea', placeholder: '¿Dónde está la estación? = Where is the station?\nUn café, por favor = A coffee, please' }],
    build: (v) => ({ title: `${v.lang || 'Language'} practice`, scenes: lines(v.pairs).flatMap((l) => { const [a, b] = l.split('=').map((x) => x.trim()); return [newScene({ title: a, narration: `${a} — ${b ?? ''}`, duration: 3.5 }), newScene({ title: 'Your turn — repeat', narration: a, duration: 3 })]; }) }),
  },
  presentation: {
    id: 'presentation', name: 'Presentation to video', aspect: '16:9', mediaHint: 'Upload each slide as an image (export slides as PNG).',
    fields: [{ key: 'title', label: 'Presentation title' }, { key: 'notes', label: 'Speaker notes — one slide per paragraph', type: 'textarea' }],
    build: (v) => ({ title: v.title || 'Presentation', scenes: v.notes ? v.notes.split(/\n\s*\n/).map((n, i) => newScene({ title: `Slide ${i + 1}`, narration: n.trim(), duration: readTime(n) + 1 })) : [newScene({ title: 'Slide 1' })] }),
  },
  recipe: {
    id: 'recipe', name: 'Recipe video', aspect: '9:16', mediaHint: 'Add a photo or clip per step.',
    fields: [{ key: 'dish', label: 'Dish', placeholder: 'Crispy garlic noodles' }, { key: 'ingredients', label: 'Ingredients (one per line)', type: 'textarea' }, { key: 'steps', label: 'Steps (one per line)', type: 'textarea' }],
    build: (v) => ({ title: v.dish || 'Recipe', scenes: [newScene({ title: v.dish || 'Recipe', narration: `Let’s make ${v.dish}.`, duration: 3, visual: v.dish }), newScene({ title: 'You’ll need', narration: lines(v.ingredients).join(', ') + '.', duration: Math.max(4, lines(v.ingredients).length * 0.9), visual: 'ingredients' }), ...lines(v.steps).map((s, i) => newScene({ title: `Step ${i + 1}`, narration: s, duration: readTime(s) + 1, visual: s })), newScene({ title: 'Enjoy!', narration: 'Enjoy!', duration: 2.5, visual: v.dish })] }),
  },
  realestate: {
    id: 'realestate', name: 'Property tour', aspect: '16:9', mediaHint: 'Add one photo per room, in tour order.',
    fields: [{ key: 'address', label: 'Address or listing name', placeholder: '42 Elm Court' }, { key: 'facts', label: 'Key facts', placeholder: '3 bed · 2 bath · 1,850 sq ft' }, { key: 'rooms', label: 'Rooms/highlights (one per line)', type: 'textarea', placeholder: 'Sunlit kitchen with island\nPrimary suite with walk-in' }, { key: 'contact', label: 'Agent contact', placeholder: 'Call Jamie · 555-0142' }],
    build: (v) => ({ title: `${v.address || 'Property'} tour`, scenes: [newScene({ title: v.address || 'Welcome home', narration: `Welcome to ${v.address}.`, duration: 4, visual: 'exterior' }), newScene({ title: v.facts || 'At a glance', narration: v.facts ?? '', duration: 3.5 }), ...lines(v.rooms).map((r) => newScene({ title: r, narration: r + '.', duration: 4, visual: r })), newScene({ title: v.contact || 'Book a viewing', narration: `Book a viewing. ${v.contact ?? ''}`, duration: 4 })] }),
  },
  fitness: {
    id: 'fitness', name: 'Workout video', aspect: '9:16', mediaHint: 'Add a clip or photo per exercise (optional).',
    fields: [{ key: 'name', label: 'Workout name', placeholder: '12-minute core' }, { key: 'moves', label: 'Exercises: “name, seconds” per line', type: 'textarea', placeholder: 'Plank, 40\nDead bug, 40\nSide plank, 30' }, { key: 'rest', label: 'Rest between (seconds)', type: 'number', placeholder: '15' }],
    build: (v) => {
      const rest = Math.max(0, Number(v.rest || 15));
      const out = [newScene({ title: v.name || 'Workout', narration: `${v.name}. Let’s go.`, duration: 4 })];
      lines(v.moves).forEach((l, i, arr) => {
        const [n, s] = l.split(',').map((x) => x.trim());
        out.push(newScene({ title: `${n} — ${s || 30}s`, narration: n, duration: Math.max(5, Number(s) || 30), visual: n }));
        if (rest && i < arr.length - 1) out.push(newScene({ title: `Rest ${rest}s · Next: ${arr[i + 1].split(',')[0]}`, narration: '', duration: rest }));
      });
      out.push(newScene({ title: 'Done — great work', narration: 'Done. Great work.', duration: 3 }));
      return { title: v.name || 'Workout', scenes: out };
    },
  },
  'memory-film': {
    id: 'memory-film', name: 'Memory film', aspect: '16:9', mediaHint: 'Add your photos in order and a song on the Music track.',
    fields: [{ key: 'title', label: 'Title', placeholder: 'Summer in Lisbon' }, { key: 'dedication', label: 'Opening line', placeholder: 'For Mom, with love' }, { key: 'closing', label: 'Closing line', placeholder: 'Until next summer' }],
    build: (v) => ({ title: v.title || 'Memory film', scenes: [newScene({ title: v.title || 'Memories', narration: '', duration: 4 }), newScene({ title: v.dedication || '', narration: '', duration: 3.5 }), newScene({ title: v.closing || 'The end', narration: '', duration: 4 })] }),
  },
};

export const templateFor = (id: string) => TEMPLATES[id] ?? TEMPLATES.autopilot;
