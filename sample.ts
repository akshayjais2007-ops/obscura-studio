import { ingestFile } from './media';
import { assembleFromScenes, createProject, newScene, saveProject, scriptFromScenes, CAPTION_STYLE } from './project';
import { getDB } from './db';
import type { Asset } from './types';

const FILES = [
  { url: '/media/scene-forest.jpg', name: 'forest-ridge-sunrise-fog.jpg', license: 'Demo image (AI-generated for Obscura samples)', tags: ['forest', 'sunrise', 'fog', 'nature', 'mountain'] },
  { url: '/media/scene-city.jpg', name: 'night-city-rain-street.jpg', license: 'Demo image (AI-generated for Obscura samples)', tags: ['city', 'night', 'rain', 'street', 'urban'] },
  { url: '/media/scene-studio.jpg', name: 'creator-home-studio.jpg', license: 'Demo image (AI-generated for Obscura samples)', tags: ['studio', 'creator', 'microphone', 'camera', 'desk'] },
  { url: '/media/scene-kitchen.jpg', name: 'kitchen-plating-food.jpg', license: 'Demo image (AI-generated for Obscura samples)', tags: ['kitchen', 'food', 'cooking', 'chef', 'recipe'] },
  { url: '/media/sample-waves.mp4', name: 'beach-sunset-waves.mp4', license: 'Pexels License (free to use)', attribution: 'Video by Joem Castillo via Pexels', tags: ['beach', 'ocean', 'waves', 'sunset'] },
];

/** Loads demo-labeled sample media and builds an editable project from it. */
export async function loadSampleProject(userId: string, workspaceId: string, onStep?: (s: string) => void) {
  const assets: Asset[] = [];
  const skipped: string[] = [];
  for (const f of FILES) {
    onStep?.(`Loading ${f.name}`);
    const r = await fetch(f.url);
    if (!r.ok) { skipped.push(`Couldn’t download ${f.name}.`); continue; }
    const blob = await r.blob();
    const file = new File([blob], f.name, { type: blob.type });
    const res = await ingestFile(file, { userId, workspaceId, source: 'sample', license: f.license, attribution: f.attribution ?? '', tags: f.tags, demo: true });
    const a = res.asset ?? res.duplicateOf;
    if (a) assets.push(a);
    else if (res.error) skipped.push(res.error);
  }
  onStep?.('Assembling the timeline');
  const by = (tag: string) => assets.find((a) => a.tags.includes(tag));
  const scenes = [
    newScene({ title: 'The quiet before', narration: 'Every great story starts somewhere quiet.', visual: 'forest sunrise fog', duration: 4, assetId: by('forest')?.id, characters: 'Maya (grey coat)', location: 'Ridge', timeOfDay: 'dawn' }),
    newScene({ title: 'Into the city', narration: 'Then the world gets loud, fast and full of light.', visual: 'city night rain', duration: 4, assetId: by('city')?.id, characters: 'Maya (grey coat)', location: 'City', timeOfDay: 'night' }),
    newScene({ title: 'Back to the desk', narration: 'You sit down, press record, and shape it into something real.', visual: 'creator studio microphone', duration: 4.5, assetId: by('studio')?.id, characters: 'Maya (grey coat)', location: 'Studio', timeOfDay: 'night' }),
    newScene({ title: 'The craft', narration: 'Small details, carefully plated.', visual: 'kitchen food plating', duration: 3.5, assetId: by('kitchen')?.id, location: 'Kitchen', timeOfDay: 'night' }),
    newScene({ title: 'Premiere', narration: 'And then you share it with the world. Follow for more.', visual: 'beach waves sunset', duration: 6, assetId: by('beach')?.id, location: 'Beach', timeOfDay: 'dusk' }),
  ];
  const project = createProject(userId, workspaceId, { title: 'Sample — Every idea deserves a premiere', aspect: '16:9', template: 'autopilot', demo: true, scenes, stage: 'editing' });
  const tracks = assembleFromScenes({ ...project, scenes }, getDB().assets, { captions: true, captionStyle: { ...CAPTION_STYLE } });
  saveProject(project.id, { tracks, script: scriptFromScenes(scenes) });
  return { id: project.id, skipped };
}
