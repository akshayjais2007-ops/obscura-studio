export type ID = string;
export type Aspect = '16:9' | '9:16' | '1:1' | '4:5';
export type Role = 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer';
export type TrackKind = 'video' | 'audio' | 'caption' | 'overlay';
export type ClipKind = 'video' | 'image' | 'audio' | 'text' | 'caption' | 'color' | 'wave';
export type Transition = 'none' | 'fade' | 'slide' | 'zoom';

export interface TextStyle {
  font: 'display' | 'sans' | 'mono';
  size: number; // % of the short side
  color: string;
  bg: string; // '' = none
  weight: number;
  x: number; // 0..1 center
  y: number; // 0..1 center
  align: 'left' | 'center' | 'right';
}

export interface Clip {
  id: ID;
  kind: ClipKind;
  assetId?: ID;
  start: number;
  duration: number;
  offset: number; // source in-point
  volume: number; // 0..1.5
  text?: string;
  style?: TextStyle;
  color?: string;
  transform: { scale: number; x: number; y: number };
  transition: Transition;
  fadeIn: number;
  fadeOut: number;
  speaker?: string;
}

export interface Track {
  id: ID;
  kind: TrackKind;
  name: string;
  muted: boolean;
  locked: boolean;
  hidden: boolean;
  clips: Clip[];
}

export interface Scene {
  id: ID;
  title: string;
  narration: string;
  visual: string; // description / keywords for b-roll matching
  duration: number;
  characters: string; // "Maya (red coat), Leo (suit)"
  location: string;
  timeOfDay: 'day' | 'night' | 'dawn' | 'dusk' | '';
  assetId?: ID;
}

export type PipelineStage = 'idea' | 'scripting' | 'editing' | 'review' | 'delivered';
export type ReviewStatus = 'draft' | 'in_review' | 'changes_requested' | 'approved';

export interface Project {
  id: ID;
  workspaceId: ID;
  ownerId: ID;
  title: string;
  aspect: Aspect;
  fps: number;
  template: string;
  script: string;
  scenes: Scene[];
  tracks: Track[];
  brandKitId?: ID;
  styleId?: ID;
  stage: PipelineStage;
  review: ReviewStatus;
  assignee?: string;
  deadline?: string;
  demo?: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface Asset {
  id: ID;
  workspaceId: ID;
  ownerId: ID;
  name: string;
  type: 'video' | 'audio' | 'image';
  mime: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  hash: string;
  tags: string[];
  source: 'upload' | 'render' | 'stock' | 'ai' | 'sample';
  license: string;
  attribution: string;
  thumb?: string;
  peaks?: number[];
  projectId?: ID; // for renders
  demo?: boolean;
  createdAt: number;
  deletedAt?: number;
}

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
export type JobType = 'render' | 'ai_script' | 'ai_hooks' | 'ai_titles' | 'ai_factcheck' | 'analyze_media';

export interface Job {
  id: ID;
  userId: ID;
  type: JobType;
  label: string;
  projectId?: ID;
  params: Record<string, unknown>;
  status: JobStatus;
  progress: number;
  credits: number;
  error?: string;
  result?: Record<string, unknown>;
  outputAssetId?: ID;
  attempt: number;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

export interface CreditTx {
  id: ID;
  userId: ID;
  amount: number;
  kind: 'grant' | 'charge' | 'refund' | 'adjust';
  reason: string;
  jobId?: ID;
  balanceAfter: number;
  at: number;
}

export type PlanId = 'free' | 'creator' | 'studio' | 'agency';
export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  monthlyCredits: number;
  maxRes: 480 | 720 | 1080;
  seats: number;
  storageMB: number;
  blurb: string;
}

export interface Subscription {
  userId: ID;
  plan: PlanId;
  status: 'active' | 'pending_payment' | 'canceled';
  periodStart: number;
  periodEnd: number;
}

export interface User {
  id: ID;
  email: string;
  name: string;
  passHash: string;
  salt: string;
  role: 'user' | 'admin';
  onboarded: boolean;
  intent?: string;
  createdAt: number;
  suspended?: boolean;
}

export interface Workspace {
  id: ID;
  name: string;
  ownerId: ID;
  kind: 'personal' | 'agency' | 'client';
  parentId?: ID;
  createdAt: number;
}

export interface Member {
  id: ID;
  workspaceId: ID;
  email: string;
  userId?: ID;
  role: Role;
  addedAt: number;
}

export interface Comment {
  id: ID;
  projectId: ID;
  author: string;
  time: number;
  text: string;
  resolved: boolean;
  at: number;
}

export interface Approval {
  id: ID;
  projectId: ID;
  decision: 'approved' | 'changes_requested';
  by: string;
  note: string;
  at: number;
}

export interface Audit {
  id: ID;
  actorId: ID;
  action: string;
  target: string;
  meta?: string;
  at: number;
}

export interface Snapshot {
  id: ID;
  projectId: ID;
  label: string;
  at: number;
  data: Pick<Project, 'title' | 'aspect' | 'script' | 'scenes' | 'tracks'>;
}

export interface Notice {
  id: ID;
  userId: ID;
  text: string;
  link?: string;
  tone: 'info' | 'ok' | 'warn' | 'bad';
  read: boolean;
  at: number;
}

export interface BrandKit {
  id: ID;
  workspaceId: ID;
  name: string;
  colors: string[];
  headingFont: TextStyle['font'];
  bodyFont: TextStyle['font'];
  logoAssetId?: ID;
  disclaimer: string;
  createdAt: number;
}

export interface StylePreset {
  id: ID;
  workspaceId: ID;
  name: string;
  caption: TextStyle;
  transition: Transition;
  fade: number;
  aspect: Aspect;
  pace: number; // default seconds per image
  createdAt: number;
}

export interface Preference {
  id: ID;
  userId: ID;
  key: string;
  value: string;
  at: number;
}

export interface AbuseReport {
  id: ID;
  reporter: string;
  target: string;
  reason: string;
  status: 'open' | 'resolved';
  at: number;
}

export interface Experiment {
  id: ID;
  userId: ID;
  name: string;
  hypothesis: string;
  variants: { projectId: ID; label: string }[];
  createdAt: number;
}

export interface Settings {
  mode: 'beginner' | 'pro';
  textScale: 1 | 1.125 | 1.25 | 1.4;
  contrast: 'normal' | 'high';
  motion: 'system' | 'reduced' | 'full';
  familySafe: boolean;
  lang: 'en' | 'es' | 'fr' | 'de' | 'pt';
  toursDone: string[];
}

export interface Config {
  costs: { renderPer15s: number; draftPer15s: number; aiScript: number; aiHooks: number; aiTitles: number; aiFactcheck: number };
  failedJobPolicy: 'full_refund';
}
