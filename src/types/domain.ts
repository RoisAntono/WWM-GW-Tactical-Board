export type Role =
  | 'Shotcaller'
  | 'Attack'
  | 'Defense'
  | 'Splitpush'
  | 'Jungler'
  | 'Scout'
  | 'Support'
  | 'Flex';

export type ToolMode = 'select' | 'place-player' | 'draw-route' | 'place-objective' | 'place-zone' | 'note' | 'remove';

export type ObjectiveType =
  | 'blue-goose'
  | 'blue-tower'
  | 'blue-tree'
  | 'red-goose'
  | 'red-tower'
  | 'red-tree'
  | 'red-farm'
  | 'boss-summon';

export type ObjectiveCategory = 'tower' | 'farm' | 'boss' | 'goose' | 'tree';

export type ObjectiveCategoryVisibility = Record<ObjectiveCategory, boolean>;

export type LayerKey = 'players' | 'routes' | 'objectives' | 'zones' | 'notes' | 'enemyAssumptions';

export type LayerVisibility = Record<LayerKey, boolean>;

export type Coordinate = {
  x: number;
  y: number;
};

export type PlayerStats = {
  attendance?: number;
  defeated?: number;
  deaths?: number;
  assist?: number;
  lastPlayed?: string;
  dpsAvg?: number;
  healAvg?: number;
  tankAvg?: number;
  siegeAvg?: number;
  coinAvg?: number;
};

export type Player = {
  id: string;
  memberId?: string;
  ign: string;
  alias?: string;
  role: Role;
  teamId?: string;
  party?: string;
  stats?: PlayerStats;
  notes?: string;
};

export type MemberStatus =
  | 'Pending Review'
  | 'Trial'
  | 'Member'
  | 'Core'
  | 'Officer'
  | 'Bench'
  | 'Inactive'
  | 'Left'
  | 'Blacklist';

export type MemberRank = 'Commander' | 'Leader' | 'Officer' | 'Core' | 'Member' | 'Trial' | 'Bench';

export type MemberRole = 'DPS' | 'DPS Range' | 'Healer' | 'Tank';

export type GuildMemberSummary = {
  attendance?: number;
  lastPlayed?: string;
  defeatedAvg?: number;
  deathsAvg?: number;
  assistAvg?: number;
  damageAvg?: number;
  tankAvg?: number;
  healAvg?: number;
  siegeDamageAvg?: number;
  funCoinAvg?: number;
};

export type GuildMember = {
  id: string;
  ign: string;
  alias?: string;
  role: Role;
  memberRole: MemberRole;
  teamId?: string;
  party?: string;
  rank: MemberRank;
  status: MemberStatus;
  summary?: GuildMemberSummary;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type MatchSource = 'csv' | 'ocr' | 'gemini' | 'manual';

export type ImportSource = Exclude<MatchSource, 'manual'>;

export type ImportKind = 'member' | 'match';

export type GuildWarMatch = {
  id: string;
  date: string;
  opponent: string;
  source: MatchSource;
  notes?: string;
  createdAt: string;
};

export type GuildWarPerformance = {
  id: string;
  matchId: string;
  memberId: string;
  defeated: number;
  deaths?: number;
  assist: number;
  damage: number;
  tank: number;
  heal: number;
  siegeDamage: number;
  funCoin: number;
};

export type ImportBatch = {
  id: string;
  source: ImportSource;
  kind: ImportKind;
  fileName?: string;
  createdAt: string;
  rowCount: number;
  acceptedCount: number;
  warningCount: number;
  matchId?: string;
  model?: string;
  detectedMatchTime?: string;
  files?: ImportBatchFile[];
};

export type ImportBatchFile = {
  id: string;
  source: ImportSource;
  fileName?: string;
  rowCount: number;
  acceptedCount: number;
  warningCount: number;
  detectedMatchTime?: string;
  timestampOnly?: boolean;
  confidenceAvg?: number;
  error?: string;
};

export type GuildDatabase = {
  members: GuildMember[];
  matches: GuildWarMatch[];
  performances: GuildWarPerformance[];
  importBatches: ImportBatch[];
  updatedAt: string;
};

export type Team = {
  id: string;
  name: string;
  role: Role;
  color: string;
};

export type PlayerMarker = {
  id: string;
  playerId: string;
  position: Coordinate;
  task?: string;
  routeId?: string;
  priority?: 'low' | 'normal' | 'high';
};

export type Route = {
  id: string;
  name: string;
  role: Role;
  points: Coordinate[];
  style: 'solid' | 'dashed' | 'fallback';
  assignedPlayerIds: string[];
};

export type ObjectiveMarker = {
  id: string;
  type: ObjectiveType;
  label: string;
  position: Coordinate;
  owner: 'ally' | 'enemy' | 'neutral';
};

export type Zone = {
  id: string;
  name: string;
  role: Role;
  points: Coordinate[];
  opacity: number;
};

export type BoardNote = {
  id: string;
  text: string;
  position: Coordinate;
};

export type Phase = {
  id: string;
  name: string;
  playerMarkers: PlayerMarker[];
  routes: Route[];
  objectives: ObjectiveMarker[];
  zones: Zone[];
  notes: BoardNote[];
  briefing?: string;
};

export type TacticalPlan = {
  version: 1;
  id: string;
  title: string;
  opponent?: string;
  roster: Player[];
  teams: Team[];
  phases: Phase[];
  updatedAt: string;
};

export type WorkspaceSnapshot = {
  plan: TacticalPlan;
  guild: GuildDatabase;
  activePhaseId: string;
};

export type WorkspaceBackup = {
  version: 1;
  plan: TacticalPlan;
  guild: GuildDatabase;
};

export type RoleConfig = {
  role: Role;
  color: string;
  label: string;
  description: string;
};

export type ImportRow = {
  id: string;
  ign: string;
  alias?: string;
  role?: Role;
  memberRole?: MemberRole;
  team?: string;
  party?: string;
  rank?: MemberRank;
  matchTime?: string;
  attendance?: number;
  defeated?: number;
  deaths?: number;
  assist?: number;
  lastPlayed?: string;
  dpsAvg?: number;
  healAvg?: number;
  tankAvg?: number;
  siegeAvg?: number;
  coinAvg?: number;
  notes?: string;
  confidence?: number;
  sourceFileId?: string;
  sourceFileName?: string;
  sourceFileIds?: string[];
  sourceFileNames?: string[];
  mergedSourceRows?: ImportRowSourceSnapshot[];
  source: ImportSource;
  warnings: string[];
};

export type ImportRowSourceSnapshot = {
  id: string;
  sourceFileName?: string;
  ign: string;
  confidence?: number;
  defeated?: number;
  deaths?: number;
  assist?: number;
  dpsAvg?: number;
  healAvg?: number;
  tankAvg?: number;
  siegeAvg?: number;
  coinAvg?: number;
  warnings: string[];
};
