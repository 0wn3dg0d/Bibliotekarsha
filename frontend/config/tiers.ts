export type LocTier = 'voice' | 'subtitles' | 'none';

export const TIERS: readonly LocTier[] = ['voice', 'subtitles', 'none'] as const;

export interface TierMeta {
  label: string;
  shortLabel: string;
  color: string;
}

export const TIER_INFO: Record<string, TierMeta> = {
  voice: {
    label: 'Русская озвучка',
    shortLabel: 'Озвучка',
    color: '#4caf50',
  },
  subtitles: {
    label: 'Субтитры / интерфейс',
    shortLabel: 'Текст / субт.',
    color: '#2196f3',
  },
  none: {
    label: 'Без русского языка',
    shortLabel: 'Без RU',
    color: '#757575',
  },
};

export interface GameMeta {
  tier: LocTier;
  interface: boolean;
  subtitles: boolean;
  voice: boolean;
  releaseYear: string;
  reviewCount: number;
  reviewPercent: number;
  tagIds: number[];
  updatedAt: number;
}

export function formatLocDetail(data: GameMeta | null | undefined): string {
  if (!data) return 'Загрузка...';
  if (data.voice) return 'Русская озвучка';
  if (data.interface && data.subtitles) return 'Субтитры + интерфейс';
  if (data.interface) return 'Только интерфейс';
  if (data.subtitles) return 'Только субтитры';
  return 'Без русского';
}
