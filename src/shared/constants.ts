import type {
  LayerVisibility,
  MemberRank,
  MemberRole,
  MemberStatus,
  ObjectiveCategory,
  ObjectiveCategoryVisibility,
  ObjectiveType,
  Role,
  RoleConfig,
  Team,
} from '../types/domain';
import { assets } from './assets';

export const roleConfigs: Record<Role, RoleConfig> = {
  Shotcaller: {
    role: 'Shotcaller',
    color: '#d9b66f',
    label: 'Shotcaller',
    description: 'Primary caller and macro decision maker.',
  },
  Attack: {
    role: 'Attack',
    color: '#d95757',
    label: 'Attack',
    description: 'Main pressure group for siege and collapse.',
  },
  Defense: {
    role: 'Defense',
    color: '#4d8fe8',
    label: 'Defense',
    description: 'Hold structures, peel, and stabilize fights.',
  },
  Splitpush: {
    role: 'Splitpush',
    color: '#e2a94f',
    label: 'Splitpush',
    description: 'Side pressure and lane diversion.',
  },
  Jungler: {
    role: 'Jungler',
    color: '#42b883',
    label: 'Jungler',
    description: 'Farm, rotate, and objective control.',
  },
  Scout: {
    role: 'Scout',
    color: '#49c4c7',
    label: 'Scout',
    description: 'Vision, enemy read, and early warning.',
  },
  Support: {
    role: 'Support',
    color: '#a77be8',
    label: 'Support',
    description: 'Healing, utility, peel, and sustain.',
  },
  Flex: {
    role: 'Flex',
    color: '#aeb4bd',
    label: 'Flex',
    description: 'Adaptive assignment based on phase trigger.',
  },
};

export const roleOrder = Object.keys(roleConfigs) as Role[];

export const memberRoleOrder: MemberRole[] = ['DPS', 'DPS Range', 'Healer', 'Tank'];

export const memberRankOptions: MemberRank[] = ['Commander', 'Leader', 'Officer', 'Core', 'Member', 'Trial', 'Bench'];

export const memberStatusOptions: MemberStatus[] = [
  'Pending Review',
  'Trial',
  'Member',
  'Core',
  'Officer',
  'Bench',
  'Inactive',
  'Left',
  'Blacklist',
];

export const memberTeamOptions = [
  { id: 'team-attack', label: 'Attack', role: 'Attack' },
  { id: 'team-splitpush', label: 'Splitpush', role: 'Splitpush' },
  { id: 'team-defense', label: 'Defense', role: 'Defense' },
  { id: 'team-jungler', label: 'Jungler', role: 'Jungler' },
] as const;

export const defaultPlanTeams: Team[] = [
  { id: 'team-shotcaller', name: 'Command', role: 'Shotcaller', color: roleConfigs.Shotcaller.color },
  ...memberTeamOptions.map((team) => ({
    id: team.id,
    name: team.label,
    role: team.role,
    color: roleConfigs[team.role].color,
  })),
];

export function isMemberRoleOption(value: unknown): value is MemberRole {
  return typeof value === 'string' && memberRoleOrder.includes(value as MemberRole);
}

export function isMemberRankOption(value: unknown): value is MemberRank {
  return typeof value === 'string' && memberRankOptions.includes(value as MemberRank);
}

export function isMemberStatusOption(value: unknown): value is MemberStatus {
  return typeof value === 'string' && memberStatusOptions.includes(value as MemberStatus);
}

export function normalizeMemberRoleValue(value: unknown, fallback: MemberRole = 'DPS'): MemberRole {
  if (isMemberRoleOption(value)) {
    return value;
  }

  if (value === 'Melee' || value === 'Flex') {
    return 'DPS';
  }

  if (value === 'Support') {
    return 'Healer';
  }

  return fallback;
}

export function getMemberTeamId(value?: string): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return memberTeamOptions.find((team) => team.id.toLowerCase() === normalized || team.label.toLowerCase() === normalized)?.id;
}

export function getMemberTeamLabel(teamId?: string): string {
  if (!teamId) {
    return 'No Team';
  }

  return memberTeamOptions.find((team) => team.id === teamId || team.label === teamId)?.label ?? teamId;
}

export function getMemberTeamRole(teamId?: string): Role | undefined {
  const normalizedTeamId = getMemberTeamId(teamId);
  return memberTeamOptions.find((team) => team.id === normalizedTeamId)?.role;
}

export const defaultLayerVisibility: LayerVisibility = {
  players: true,
  routes: true,
  objectives: true,
  zones: true,
  notes: true,
  enemyAssumptions: false,
};

export const defaultObjectiveCategoryVisibility: ObjectiveCategoryVisibility = {
  tower: true,
  farm: true,
  boss: true,
  goose: true,
  tree: true,
};

export const defaultPhaseNames = [
  'Opening',
  'First Rotate',
  'Objective Setup',
  'Siege Push',
  'Defense Hold',
  'Emergency Collapse',
  'Endgame',
];

export const objectiveAssets: Record<ObjectiveType, string> = {
  'blue-goose': assets.objectives.blueGoose,
  'blue-tower': assets.objectives.blueTower,
  'blue-tree': assets.objectives.blueTree,
  'red-goose': assets.objectives.redGoose,
  'red-tower': assets.objectives.redTower,
  'red-tree': assets.objectives.redTree,
  'red-farm': assets.objectives.redFarm,
  'boss-summon': assets.objectives.bossSummon,
};

export const objectiveLabels: Record<ObjectiveType, string> = {
  'blue-goose': 'Blue Goose',
  'blue-tower': 'Blue Tower',
  'blue-tree': 'Blue Tree',
  'red-goose': 'Red Goose',
  'red-tower': 'Red Tower',
  'red-tree': 'Red Tree',
  'red-farm': 'Red Farm',
  'boss-summon': 'Boss Summon',
};

export const objectiveCategoryLabels: Record<ObjectiveCategory, string> = {
  tower: 'Tower',
  farm: 'Farm',
  boss: 'Boss',
  goose: 'Goose',
  tree: 'Tree',
};

export function getObjectiveCategory(type: ObjectiveType): ObjectiveCategory {
  if (type === 'red-farm') {
    return 'farm';
  }

  if (type === 'boss-summon') {
    return 'boss';
  }

  if (type.includes('tree')) {
    return 'tree';
  }

  if (type.includes('goose')) {
    return 'goose';
  }

  return 'tower';
}
