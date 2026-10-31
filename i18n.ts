import { useDB, DEFAULT_SETTINGS, update } from './db';
import { useSessionId } from './auth';
import type { Settings } from './types';

type Dict = Record<string, string>;
const en: Dict = {
  'nav.create': 'Create', 'nav.shorts': 'Shorts & Clips', 'nav.youtube': 'YouTube Studio', 'nav.ads': 'Ads & Business',
  'nav.learn': 'Learn', 'nav.podcasts': 'Podcasts & Gaming', 'nav.personal': 'Personal Videos', 'nav.agency': 'Agency & Teams',
  'nav.ai': 'AI Tools', 'nav.projects': 'Projects & Assets', 'nav.analytics': 'Analytics & Quality', 'nav.billing': 'Billing & Settings',
  'nav.home': 'Home', 'cta.create': 'Create a video', 'help': 'Help', 'credits': 'credits', 'mode.beginner': 'Beginner', 'mode.pro': 'Pro',
  'saved': 'Saved', 'saving': 'Saving…', 'undo': 'Undo', 'redo': 'Redo', 'signout': 'Sign out', 'settings': 'Settings',
  'greeting': 'Welcome back', 'recent': 'Recent projects', 'new.project': 'New project', 'open': 'Open', 'delete': 'Delete',
  'search': 'Search', 'notifications': 'Notifications', 'upload': 'Upload media', 'export': 'Export', 'preview': 'Preview',
};
const es: Dict = {
  'nav.create': 'Crear', 'nav.shorts': 'Shorts y clips', 'nav.youtube': 'Estudio YouTube', 'nav.ads': 'Anuncios y negocios',
  'nav.learn': 'Aprender', 'nav.podcasts': 'Podcasts y gaming', 'nav.personal': 'Videos personales', 'nav.agency': 'Agencias y equipos',
  'nav.ai': 'Herramientas IA', 'nav.projects': 'Proyectos y recursos', 'nav.analytics': 'Analítica y calidad', 'nav.billing': 'Facturación y ajustes',
  'nav.home': 'Inicio', 'cta.create': 'Crear un video', 'help': 'Ayuda', 'credits': 'créditos', 'mode.beginner': 'Principiante', 'mode.pro': 'Pro',
  'saved': 'Guardado', 'saving': 'Guardando…', 'undo': 'Deshacer', 'redo': 'Rehacer', 'signout': 'Cerrar sesión', 'settings': 'Ajustes',
  'greeting': 'Bienvenido de nuevo', 'recent': 'Proyectos recientes', 'new.project': 'Nuevo proyecto', 'open': 'Abrir', 'delete': 'Eliminar',
  'search': 'Buscar', 'notifications': 'Notificaciones', 'upload': 'Subir medios', 'export': 'Exportar', 'preview': 'Vista previa',
};
const fr: Dict = {
  'nav.create': 'Créer', 'nav.shorts': 'Shorts et clips', 'nav.youtube': 'Studio YouTube', 'nav.ads': 'Pubs et entreprises',
  'nav.learn': 'Apprendre', 'nav.podcasts': 'Podcasts et gaming', 'nav.personal': 'Vidéos perso', 'nav.agency': 'Agences et équipes',
  'nav.ai': 'Outils IA', 'nav.projects': 'Projets et médias', 'nav.analytics': 'Analyse et qualité', 'nav.billing': 'Facturation et réglages',
  'nav.home': 'Accueil', 'cta.create': 'Créer une vidéo', 'help': 'Aide', 'credits': 'crédits', 'mode.beginner': 'Débutant', 'mode.pro': 'Pro',
  'saved': 'Enregistré', 'saving': 'Enregistrement…', 'undo': 'Annuler', 'redo': 'Rétablir', 'signout': 'Se déconnecter', 'settings': 'Réglages',
  'greeting': 'Bon retour', 'recent': 'Projets récents', 'new.project': 'Nouveau projet', 'open': 'Ouvrir', 'delete': 'Supprimer',
  'search': 'Rechercher', 'notifications': 'Notifications', 'upload': 'Importer', 'export': 'Exporter', 'preview': 'Aperçu',
};
const de: Dict = {
  'nav.create': 'Erstellen', 'nav.shorts': 'Shorts & Clips', 'nav.youtube': 'YouTube-Studio', 'nav.ads': 'Werbung & Business',
  'nav.learn': 'Lernen', 'nav.podcasts': 'Podcasts & Gaming', 'nav.personal': 'Private Videos', 'nav.agency': 'Agentur & Teams',
  'nav.ai': 'KI-Werkzeuge', 'nav.projects': 'Projekte & Medien', 'nav.analytics': 'Analyse & Qualität', 'nav.billing': 'Abrechnung & Einstellungen',
  'nav.home': 'Start', 'cta.create': 'Video erstellen', 'help': 'Hilfe', 'credits': 'Credits', 'mode.beginner': 'Einsteiger', 'mode.pro': 'Profi',
  'saved': 'Gespeichert', 'saving': 'Speichert…', 'undo': 'Rückgängig', 'redo': 'Wiederholen', 'signout': 'Abmelden', 'settings': 'Einstellungen',
  'greeting': 'Willkommen zurück', 'recent': 'Letzte Projekte', 'new.project': 'Neues Projekt', 'open': 'Öffnen', 'delete': 'Löschen',
  'search': 'Suchen', 'notifications': 'Mitteilungen', 'upload': 'Medien hochladen', 'export': 'Exportieren', 'preview': 'Vorschau',
};
const pt: Dict = {
  'nav.create': 'Criar', 'nav.shorts': 'Shorts e clipes', 'nav.youtube': 'Estúdio YouTube', 'nav.ads': 'Anúncios e negócios',
  'nav.learn': 'Aprender', 'nav.podcasts': 'Podcasts e games', 'nav.personal': 'Vídeos pessoais', 'nav.agency': 'Agências e equipes',
  'nav.ai': 'Ferramentas IA', 'nav.projects': 'Projetos e mídias', 'nav.analytics': 'Análise e qualidade', 'nav.billing': 'Cobrança e ajustes',
  'nav.home': 'Início', 'cta.create': 'Criar um vídeo', 'help': 'Ajuda', 'credits': 'créditos', 'mode.beginner': 'Iniciante', 'mode.pro': 'Pro',
  'saved': 'Salvo', 'saving': 'Salvando…', 'undo': 'Desfazer', 'redo': 'Refazer', 'signout': 'Sair', 'settings': 'Ajustes',
  'greeting': 'Bem-vindo de volta', 'recent': 'Projetos recentes', 'new.project': 'Novo projeto', 'open': 'Abrir', 'delete': 'Excluir',
  'search': 'Buscar', 'notifications': 'Notificações', 'upload': 'Enviar mídia', 'export': 'Exportar', 'preview': 'Prévia',
};
export const LANGS: { id: Settings['lang']; label: string }[] = [
  { id: 'en', label: 'English' }, { id: 'es', label: 'Español' }, { id: 'fr', label: 'Français' }, { id: 'de', label: 'Deutsch' }, { id: 'pt', label: 'Português' },
];
const dicts = { en, es, fr, de, pt };

export function useSettings(): Settings {
  const id = useSessionId();
  const db = useDB();
  return (id && db.settings[id]) || DEFAULT_SETTINGS;
}

export function setSettings(userId: string, patch: Partial<Settings>) {
  update((d) => { d.settings[userId] = { ...(d.settings[userId] ?? DEFAULT_SETTINGS), ...patch }; });
}

export function useT() {
  const s = useSettings();
  const d = dicts[s.lang] ?? en;
  return (k: string) => d[k] ?? en[k] ?? k;
}
