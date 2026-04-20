import type { GameMode } from '@/types';

export interface ModeRules {
  mode: GameMode;
  title: string;
  mapCode: string;
  mapName: string;
  rulesTitle: string;
  rules: string[];
}

export const MATCH_MODE_RULES: Record<GameMode, ModeRules> = {
  Realistic: {
    mode: 'Realistic',
    title: 'REALISTIC',
    mapCode: '9854-1829-8735',
    mapName: 'Finest Realistics',
    rulesTitle: 'Realistic Rules',
    rules: [
      'Opening chests, ammo crates, collecting floor loot, or using slurp barrels during a round will lead to forfeiture of that round.',
      'If a player leaves once loot has been distributed, the round must continue. Do not exit the match.',
      'Respawning during an active round will result in forfeiting the round.',
      "'Zone Wars' and 'Comp Mode' options must be enabled.",
    ],
  },
  'Box Fight': {
    mode: 'Box Fight',
    title: 'BOXFIGHT',
    mapCode: '2640-2394-7508',
    mapName: 'Elite Box Fights',
    rulesTitle: 'Boxfight Rules',
    rules: [
      'You must not exploit bugs to keep extra loot from round to round.',
      'If a player leaves once the barrier falls, the round must continue. Do not exit the match.',
      'Respawning during an active round will result in forfeiting the round.',
    ],
  },
  'Zone Wars': {
    mode: 'Zone Wars',
    title: 'ZONE WARS',
    mapCode: '3537-4087-0888',
    mapName: 'Zone Wars',
    rulesTitle: 'Zone Wars Rules',
    rules: [
      'If damage is dealt, the round counts regardless of the circumstances.',
      'If no players go through the portal, the round will not count.',
      'The round does not count if no players from either team go through the portals.',
    ],
  },
};

export const GENERAL_MATCH_RULES = {
  title: 'General Rules',
  rules: [
    "Players have a maximum of 10 minutes from the match starting to get into the lobby. If you aren't ready within this time, you will be forfeited.",
    'If a player goes AFK or disconnects midgame, the game can be paused for up to 6 minutes. After this period, the game must continue or the absent player will be forfeited.',
    'If a player has linked a game account with incorrect platform or name, they have 5 minutes to rectify this from the time a Staff member arrives.',
  ],
};

export const MATCH_RULES_ORDER: GameMode[] = ['Realistic', 'Box Fight', 'Zone Wars'];

export function getModeRules(mode: GameMode | string | null | undefined): ModeRules {
  if (mode === 'Realistic' || mode === 'Box Fight' || mode === 'Zone Wars') {
    return MATCH_MODE_RULES[mode];
  }

  return MATCH_MODE_RULES['Box Fight'];
}
