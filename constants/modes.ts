import { type FunctionType } from '@/services/modelConfigs';

export type ModeKey = FunctionType;

export interface ModeConfigUI {
  key: ModeKey;
  title: string;
  description: string;
  icon: string; // SF Symbol name used by IconSymbol
  gradient: [string, string];
}

export const MODE_TILES: ModeConfigUI[] = [
  {
    key: 'restoration',
    title: 'Restore',
    description: 'Fix damage & enhance',
    icon: 'wand.and.stars',
    gradient: ['#f97316', '#fb923c'],
  },
  {
    key: 'unblur',
    title: 'Unblur',
    description: 'Sharpen details',
    icon: 'eye',
    gradient: ['#8b5cf6', '#a78bfa'],
  },
  {
    key: 'colorize',
    title: 'Colorize',
    description: 'Add color to B&W',
    icon: 'paintbrush',
    gradient: ['#10b981', '#34d399'],
  },
  {
    key: 'descratch',
    title: 'Descratch',
    description: 'Remove scratches',
    icon: 'bandage',
    gradient: ['#ef4444', '#f87171'],
  },
];


