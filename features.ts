export type FeatureStatus = 'working' | 'partial' | 'pending';
export type Category = 'create' | 'shorts' | 'youtube' | 'ads' | 'learn' | 'podcasts' | 'personal' | 'agency' | 'ai' | 'projects' | 'analytics' | 'billing';

export interface Feature {
  n: number;
  id: string;
  name: string;
  desc: string;
  cats: Category[];
  status: FeatureStatus;
  note: string;
  needs?: string[];
  route?: string; // when the feature lives on a core page
  projectTool?: boolean;
}

export const FEATURES: Feature[] = [
  { n: 1, id: 'retention', name: 'Retention Doctor', desc: 'Finds weak hooks, slow pacing, black gaps and likely drop-offs — with one-click fixes.', cats: ['youtube', 'shorts', 'analytics'], status: 'working', note: 'Rule-based analysis of your real timeline. Audience-retention data needs the analytics integration.', projectTool: true },
  { n: 2, id: 'continuity', name: 'Story Continuity Checker', desc: 'Tracks characters, outfits, places and time of day across scenes.', cats: ['ai', 'youtube'], status: 'working', note: 'Checks the scene sheet you fill in. Automatic visual detection needs a vision provider.', projectTool: true },
  { n: 3, id: 'consistency', name: 'Visual Consistency Lock', desc: 'Keep characters and style steady across AI-generated scenes using reference images.', cats: ['ai'], status: 'pending', note: 'Requires an image/video generation provider with reference conditioning.', needs: ['image'], projectTool: true },
  { n: 4, id: 'broll', name: 'Auto B-Roll Engine', desc: 'Matches narration keywords to your uploads (and stock when connected) and places them on the timeline.', cats: ['ai', 'youtube', 'create'], status: 'partial', note: 'Upload matching works now. Stock search needs PEXELS_API_KEY; AI visuals need an image provider.', needs: ['stock', 'image'], projectTool: true },
  { n: 5, id: 'sound', name: 'Sound Designer', desc: 'Balance voice, music and clip audio; auto-duck music under speech.', cats: ['ai', 'podcasts'], status: 'partial', note: 'Volume balance and ducking work. Music/SFX library needs a music provider.', needs: ['music'], projectTool: true },
  { n: 6, id: 'thumb-ab', name: 'Thumbnail A/B Lab', desc: 'Design thumbnail variants from your frames. Results compare only with real analytics.', cats: ['youtube'], status: 'partial', note: 'Variant design + PNG export work. Winner selection needs YouTube analytics.', needs: ['analytics'], projectTool: true },
  { n: 7, id: 'revision', name: 'One-Click Revision Agent', desc: 'Type “make captions bigger and vertical” — preview the change, apply, undo.', cats: ['ai', 'create'], status: 'working', note: 'Understands a defined set of edit commands. Open-ended edits need the text provider.', projectTool: true },
  { n: 8, id: 'dubbing', name: 'Dubbing & Lip-Sync Studio', desc: 'Translate narration, generate voices and align lips.', cats: ['ai', 'youtube'], status: 'pending', note: 'Requires speech-to-text, translation and TTS/lip-sync providers.', needs: ['stt', 'tts'], projectTool: true },
  { n: 9, id: 'safezone', name: 'Safe-Zone Guardian', desc: 'Shows platform UI overlays and moves text out of covered areas.', cats: ['shorts', 'analytics'], status: 'working', note: 'Zones for Shorts, TikTok, Reels, YouTube and square feeds.', projectTool: true },
  { n: 10, id: 'cost', name: 'Render Cost Optimizer', desc: 'Time and credit estimates for every export option before you commit.', cats: ['analytics', 'billing'], status: 'working', note: 'Uses the live credit price table.', projectTool: true },
  { n: 11, id: 'factcheck', name: 'Fact-Check Assistant', desc: 'Extracts claims, flags uncertainty and finds credible sources.', cats: ['ai', 'learn', 'youtube'], status: 'partial', note: 'Claim extraction works locally. Verification with sources needs the text provider.', needs: ['text'], projectTool: true },
  { n: 12, id: 'license', name: 'Copyright & License Tracker', desc: 'Records the source, license and attribution of every asset in a video.', cats: ['projects', 'agency'], status: 'working', note: 'Generates an attribution sheet. Licenses are what you record — we never invent them.', projectTool: true },
  { n: 13, id: 'repurpose', name: 'Repurposing Brain', desc: 'Turn a long video into vertical Shorts, Reels and summaries.', cats: ['shorts', 'youtube'], status: 'partial', note: 'Segment-to-vertical project creation works. AI summaries need the text provider.', needs: ['text'], projectTool: true },
  { n: 14, id: 'memory', name: 'Creator Performance Memory', desc: 'Remembers preferences you approve and your real project history.', cats: ['analytics', 'ai'], status: 'partial', note: 'Approved preferences and history work. Performance metrics need analytics.', needs: ['analytics'] },
  { n: 15, id: 'diff', name: 'Version Diff', desc: 'Compare snapshots: scenes, script, timing, captions and audio. Restore any version.', cats: ['projects', 'agency'], status: 'working', note: 'Snapshots are taken on export and on demand.', projectTool: true },
  { n: 16, id: 'a11y', name: 'Accessibility Inspector', desc: 'Caption speed, length, overlap and WCAG text contrast.', cats: ['analytics', 'learn'], status: 'working', note: 'WCAG AA contrast and caption-timing rules.', projectTool: true },
  { n: 17, id: 'structure', name: 'Story Structure Simulator', desc: 'Compare structures and see where your scenes land against each beat.', cats: ['youtube', 'ai'], status: 'working', note: 'Five structure models.', projectTool: true },
  { n: 18, id: 'approval', name: 'Client Approval Workspace', desc: 'Previews, timestamped feedback, approvals and change requests.', cats: ['agency'], status: 'partial', note: 'Works for members on this device. Shareable external links need the hosted database.', needs: ['database'], projectTool: true },
  { n: 19, id: 'quality', name: 'Export Quality Gate', desc: 'Resolution, fps, audio clipping, captions and missing media — before you render.', cats: ['analytics'], status: 'working', note: 'Runs automatically before each export.', projectTool: true },
  { n: 20, id: 'autopilot', name: 'Workflow Autopilot', desc: 'Idea → script → media → captions → assemble → check → export, with your approval at each step.', cats: ['create', 'ai'], status: 'partial', note: 'Full wizard works; AI script step needs the text provider (templates available).', needs: ['text'], route: '/app/create' },
  { n: 21, id: 'longform', name: 'Long-Form YouTube Studio', desc: 'Scripts, scenes, chapters, intro and outro for 8–20 minute videos.', cats: ['youtube'], status: 'partial', note: 'Structured templates + chapters export work; AI drafting needs the text provider.', needs: ['text'] },
  { n: 22, id: 'thumb-psych', name: 'Thumbnail Psychology Lab', desc: 'Checks composition, focal point, text length and contrast of a thumbnail.', cats: ['youtube'], status: 'working', note: 'Measures real image properties; it doesn’t predict click-through.', projectTool: true },
  { n: 23, id: 'styledna', name: 'Style DNA', desc: 'Save caption, transition, pacing and format presets and apply them anywhere.', cats: ['ai', 'projects'], status: 'working', note: 'Applies to any project.' },
  { n: 24, id: 'publish', name: 'Publishing Pack', desc: 'Per-platform ratios, titles, descriptions, tags and chapter lists.', cats: ['youtube', 'shorts', 'ads'], status: 'partial', note: 'Specs, chapters and copy templates work; AI copy needs the text provider. Direct upload needs platform OAuth.', needs: ['text', 'analytics'], projectTool: true },
  { n: 25, id: 'hooks', name: 'Hook Battle Arena', desc: 'Write or generate hooks and score them head-to-head.', cats: ['shorts', 'youtube', 'ai'], status: 'partial', note: 'Scoring is a transparent heuristic. Generation needs the text provider.', needs: ['text'] },
  { n: 26, id: 'product-ad', name: 'Product-to-Video Ads', desc: 'Product name, benefits and photos into a 15–30s ad.', cats: ['ads'], status: 'partial', note: 'Template workflow; AI copy needs the text provider.', needs: ['text'] },
  { n: 27, id: 'training', name: 'Training Video Maker', desc: 'Paste a document or SOP and turn each section into a lesson scene.', cats: ['learn', 'ads'], status: 'partial', note: 'Splits documents into scenes; AI rewriting needs the text provider.', needs: ['text'] },
  { n: 28, id: 'local-biz', name: 'Local Business Assistant', desc: 'Promo videos for shops, cafés and services with hours and location.', cats: ['ads'], status: 'partial', note: 'Template workflow.', needs: ['text'] },
  { n: 29, id: 'experiments', name: 'Ad Experiment Manager', desc: 'Group ad variants with a hypothesis; results come from connected metrics.', cats: ['ads', 'analytics'], status: 'partial', note: 'Variant tracking works. Metrics need an ads/analytics integration.', needs: ['analytics'] },
  { n: 30, id: 'brand-guardian', name: 'Brand Guardian', desc: 'Checks logos, colors, fonts and required disclaimers against your brand kit.', cats: ['ads', 'agency'], status: 'working', note: 'Uses your brand kits.', projectTool: true },
  { n: 31, id: 'textbook', name: 'Textbook-to-Video Tutor', desc: 'Turn a chapter into short explainer scenes with recap questions.', cats: ['learn'], status: 'partial', note: 'Section splitter + recap template; AI rewriting needs the text provider.', needs: ['text'] },
  { n: 32, id: 'lecture-kit', name: 'Lecture-to-Learning Kit', desc: 'Transcript into notes, key terms and flashcards.', cats: ['learn'], status: 'partial', note: 'Works on pasted transcripts. Automatic transcription needs speech-to-text.', needs: ['stt'] },
  { n: 33, id: 'concept', name: 'Concept Explainer', desc: 'Explain one idea with analogy, steps and recap scenes.', cats: ['learn'], status: 'partial', note: 'Template workflow; animated diagrams need an image provider.', needs: ['text', 'image'] },
  { n: 34, id: 'language', name: 'Language Practice Maker', desc: 'Phrase-by-phrase videos with translation captions and repeat pauses.', cats: ['learn'], status: 'partial', note: 'Builds bilingual caption videos from your phrase list. Native voices need TTS.', needs: ['tts'] },
  { n: 35, id: 'presentation', name: 'Presentation-to-Video', desc: 'Upload slide images and speaker notes; get a narrated-style video.', cats: ['learn', 'ads'], status: 'partial', note: 'Slide images + notes work. PPTX parsing and voice need providers.', needs: ['tts'] },
  { n: 36, id: 'podcast', name: 'Podcast Producer', desc: 'Find loud/energetic moments and build audiogram clips with waveforms.', cats: ['podcasts'], status: 'partial', note: 'Audio analysis + audiograms work. Summaries need text + STT providers.', needs: ['stt', 'text'] },
  { n: 37, id: 'gaming', name: 'Gaming Highlights Finder', desc: 'Detects audio spikes (shouts, explosions) in gameplay and cuts highlight clips.', cats: ['podcasts', 'shorts'], status: 'working', note: 'Audio-energy detection runs on your device.' },
  { n: 38, id: 'stream-shorts', name: 'Stream-to-Shorts', desc: 'Pick moments from a stream and reframe them vertically with captions.', cats: ['podcasts', 'shorts'], status: 'partial', note: 'Reframing and caption tracks work; auto-transcribed captions need speech-to-text.', needs: ['stt'] },
  { n: 39, id: 'speakers', name: 'Multi-Speaker Editor', desc: 'Detect and label speakers, then edit by speaker.', cats: ['podcasts'], status: 'partial', note: 'Manual speaker labels on captions work. Automatic detection needs speech-to-text with diarization.', needs: ['stt'], projectTool: true },
  { n: 40, id: 'beats', name: 'Beat-Synced Montage', desc: 'Detects beats in your music and cuts your photos/clips on them.', cats: ['shorts', 'personal'], status: 'working', note: 'Beat detection runs on your device.' },
  { n: 41, id: 'agency-ws', name: 'Agency Workspace', desc: 'Client spaces, roles and permissions under one agency.', cats: ['agency'], status: 'partial', note: 'Spaces and roles work on this device; per-client invoicing needs payments.', needs: ['payments', 'database'], route: '/app/agency' },
  { n: 42, id: 'review-portal', name: 'Client Review Portal', desc: 'A clean review screen for clients: watch, comment at a timestamp, approve.', cats: ['agency'], status: 'partial', note: 'Works for reviewers on this device. Public links need the hosted database.', needs: ['database'], route: '/app/agency?tab=reviews' },
  { n: 43, id: 'pipeline', name: 'Pipeline Manager', desc: 'Assign projects, set deadlines and move them from idea to delivered.', cats: ['agency', 'projects'], status: 'working', note: 'Board persists with your projects.', route: '/app/agency?tab=pipeline' },
  { n: 44, id: 'asset-intel', name: 'Shared Asset Intelligence', desc: 'Tags, exact-duplicate detection (SHA-256) and usage history.', cats: ['projects', 'agency'], status: 'working', note: 'Visual near-duplicate detection would need a vision provider.', route: '/app/projects?tab=assets' },
  { n: 45, id: 'freelancer', name: 'Freelancer Delivery Kit', desc: 'Bundle the render, captions, attribution sheet and a delivery note for a client.', cats: ['agency'], status: 'working', note: 'Downloads real files from your project.', projectTool: true },
  { n: 46, id: 'memory-film', name: 'Memory Film Maker', desc: 'Photos and a song into a gentle keepsake film.', cats: ['personal'], status: 'working', note: 'Uses your photos and music; beat-synced pacing optional.' },
  { n: 47, id: 'recipe', name: 'Recipe-to-Video', desc: 'Ingredients and steps into a step-by-step cooking video.', cats: ['personal', 'ads'], status: 'partial', note: 'Template workflow.', needs: ['text'] },
  { n: 48, id: 'realestate', name: 'Real Estate Assistant', desc: 'Listing details and room photos into a property tour.', cats: ['ads'], status: 'partial', note: 'Template workflow.', needs: ['text'] },
  { n: 49, id: 'fitness', name: 'Fitness & Coaching Studio', desc: 'Workouts with exercise cards, timers and rest intervals.', cats: ['personal', 'learn'], status: 'working', note: 'Builds timed workout videos from your plan.' },
  { n: 50, id: 'a11y-studio', name: 'Universal Accessibility Studio', desc: 'Captions, transcripts (SRT/VTT/TXT) and audio description scripts.', cats: ['learn', 'analytics'], status: 'partial', note: 'Captions + transcript exports work. Auto captions and voiced audio description need STT/TTS.', needs: ['stt', 'tts'], projectTool: true },
  { n: 51, id: 'universal-create', name: 'Universal Create Button', desc: 'Describe what you want in plain words; we route you to the right workflow.', cats: ['create'], status: 'working', note: 'Keyword router on your device.', route: '/app/create' },
  { n: 52, id: 'i18n', name: 'Multilingual Interface', desc: 'English, Español, Français, Deutsch, Português.', cats: ['billing'], status: 'partial', note: 'Navigation and core labels are translated; long help text is English.', route: '/app/settings' },
  { n: 53, id: 'credits', name: 'AI Credit System', desc: 'Balances, estimates, reservations, refunds and a full ledger.', cats: ['billing'], status: 'working', note: 'Enforced in the app’s data layer; server-side enforcement needs the hosted database.', route: '/app/billing' },
  { n: 54, id: 'modes', name: 'Beginner and Pro Modes', desc: 'Beginner keeps one action per screen; Pro unlocks every control.', cats: ['billing'], status: 'working', note: 'Toggle in the top bar.', route: '/app/settings' },
  { n: 55, id: 'trust', name: 'Trust & Transparency Center', desc: 'How AI is used, data handling, rights, limits and live integration status.', cats: ['billing', 'analytics'], status: 'working', note: 'Integration status comes from the live server check.', route: '/app/trust' },
];

export const CATEGORIES: { id: Category; key: string; icon: string; blurb: string }[] = [
  { id: 'create', key: 'nav.create', icon: 'Sparkles', blurb: 'Start from an idea, a file or a template.' },
  { id: 'shorts', key: 'nav.shorts', icon: 'Smartphone', blurb: 'Vertical videos that hook in the first second.' },
  { id: 'youtube', key: 'nav.youtube', icon: 'Youtube', blurb: 'Long-form scripts, thumbnails and retention.' },
  { id: 'ads', key: 'nav.ads', icon: 'Megaphone', blurb: 'Product ads, local promos and brand safety.' },
  { id: 'learn', key: 'nav.learn', icon: 'GraduationCap', blurb: 'Lessons, lectures and explainers.' },
  { id: 'podcasts', key: 'nav.podcasts', icon: 'Mic', blurb: 'Clips, audiograms and highlights.' },
  { id: 'personal', key: 'nav.personal', icon: 'Heart', blurb: 'Memories, recipes, workouts.' },
  { id: 'agency', key: 'nav.agency', icon: 'Users', blurb: 'Clients, reviews, pipelines and delivery.' },
  { id: 'ai', key: 'nav.ai', icon: 'Wand2', blurb: 'Analysis, revision and generation tools.' },
  { id: 'projects', key: 'nav.projects', icon: 'FolderOpen', blurb: 'Your projects, media and exports.' },
  { id: 'analytics', key: 'nav.analytics', icon: 'Activity', blurb: 'Usage, quality checks and real metrics.' },
  { id: 'billing', key: 'nav.billing', icon: 'CreditCard', blurb: 'Plans, credits and preferences.' },
];

export const featureById = (id: string) => FEATURES.find((f) => f.id === id);
export const featureRoute = (f: Feature) => f.route ?? `/app/tool/${f.id}`;

/** Universal Create: route a plain request to a workflow. Pure. */
export function routeRequest(text: string): { feature: Feature; why: string } {
  const t = text.toLowerCase();
  const rules: [RegExp, string, string][] = [
    [/\b(recipe|cook|bake|dish|ingredient)/, 'recipe', 'mentions cooking'],
    [/\b(house|home tour|listing|apartment|property|real estate)/, 'realestate', 'mentions a property'],
    [/\b(workout|fitness|exercise|yoga|hiit|coach)/, 'fitness', 'mentions a workout'],
    [/\b(memories|memory|wedding|birthday|anniversary|vacation|family photos|tribute)/, 'memory-film', 'sounds like a keepsake'],
    [/\b(beat|music video|montage|dance)/, 'beats', 'mentions music or beats'],
    [/\b(gameplay|gaming|stream|twitch|clutch|kill)/, 'gaming', 'mentions gameplay'],
    [/\b(podcast|episode|interview|audiogram)/, 'podcast', 'mentions a podcast'],
    [/\b(lecture|class recording|transcript|flashcard)/, 'lecture-kit', 'mentions a lecture'],
    [/\b(textbook|chapter)/, 'textbook', 'mentions a textbook'],
    [/\b(slides|presentation|deck|powerpoint)/, 'presentation', 'mentions slides'],
    [/\b(training|onboarding|sop|procedure|employees)/, 'training', 'sounds like training'],
    [/\b(language|vocabulary|phrases|spanish|french|learn to say)/, 'language', 'mentions language practice'],
    [/\b(explain|explainer|how does|what is)/, 'concept', 'asks to explain a concept'],
    [/\b(product|ad\b|advert|commercial|launch|sale|promo)/, 'product-ad', 'sounds like an ad'],
    [/\b(shop|cafe|café|restaurant|salon|bakery|local|store)/, 'local-biz', 'mentions a local business'],
    [/\b(long|youtube video|documentary|essay|10 minute|deep dive)/, 'longform', 'sounds like long-form YouTube'],
    [/\b(repurpose|cut into shorts|clips from)/, 'repurpose', 'asks to repurpose'],
    [/\b(thumbnail)/, 'thumb-ab', 'mentions a thumbnail'],
    [/\b(hook)/, 'hooks', 'mentions hooks'],
  ];
  for (const [re, id, why] of rules) if (re.test(t)) return { feature: featureById(id)!, why };
  return { feature: featureById('autopilot')!, why: 'general idea — the guided workflow fits best' };
}
