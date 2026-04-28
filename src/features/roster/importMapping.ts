import { memberRoleOrder, roleOrder } from '../../shared/constants';
import { createPlayerFromImportRow } from '../../app/data/planRepository';
import { createId } from '../../shared/id';
import { parseStatNumber } from '../../shared/number';
import type { ImportRow, ImportSource, MemberRank, MemberRole, Player, Role, Team } from '../../types/domain';

const headerAliases: Record<string, keyof ImportRow> = {
  ign: 'ign',
  player: 'ign',
  playername: 'ign',
  playerinfo: 'ign',
  name: 'ign',
  username: 'ign',
  alias: 'alias',
  role: 'memberRole',
  class: 'memberRole',
  job: 'memberRole',
  memberrole: 'memberRole',
  tacticalrole: 'role',
  boardrole: 'role',
  rank: 'rank',
  guildrank: 'rank',
  commandrank: 'rank',
  matchtime: 'matchTime',
  matchdatetime: 'matchTime',
  date: 'matchTime',
  datetime: 'matchTime',
  matchdate: 'matchTime',
  battletime: 'matchTime',
  gwtime: 'matchTime',
  team: 'team',
  group: 'team',
  party: 'party',
  attendance: 'attendance',
  defeated: 'defeated',
  defeatedavg: 'defeated',
  defeatedkills: 'defeated',
  kills: 'defeated',
  killsavg: 'defeated',
  kill: 'defeated',
  killavg: 'defeated',
  defeateddeaths: 'deaths',
  deathsavg: 'deaths',
  deaths: 'deaths',
  death: 'deaths',
  deathavg: 'deaths',
  defeat: 'defeated',
  defeats: 'defeated',
  assist: 'assist',
  assistavg: 'assist',
  assists: 'assist',
  assistsavg: 'assist',
  lastplayed: 'lastPlayed',
  lastplayedgw: 'lastPlayed',
  lastplayedguildwar: 'lastPlayed',
  lastplay: 'lastPlayed',
  dpsavg: 'dpsAvg',
  damage: 'dpsAvg',
  damageavg: 'dpsAvg',
  healavg: 'healAvg',
  heal: 'healAvg',
  tankavg: 'tankAvg',
  tank: 'tankAvg',
  siegeavg: 'siegeAvg',
  siegedamage: 'siegeAvg',
  coinavg: 'coinAvg',
  funcoin: 'coinAvg',
  funcion: 'coinAvg',
  notes: 'notes',
};

const memberRankAliases: Record<string, MemberRank> = {
  commander: 'Commander',
  command: 'Commander',
  leader: 'Leader',
  lead: 'Leader',
  officer: 'Officer',
  core: 'Core',
  member: 'Member',
  trial: 'Trial',
  bench: 'Bench',
};

const memberRoleAliases: Record<string, MemberRole> = {
  dps: 'DPS',
  damage: 'DPS',
  attacker: 'DPS',
  attack: 'DPS',
  melee: 'DPS',
  meleedps: 'DPS',
  range: 'DPS Range',
  ranged: 'DPS Range',
  rangedps: 'DPS Range',
  dpsrange: 'DPS Range',
  rangeddps: 'DPS Range',
  healer: 'Healer',
  heal: 'Healer',
  supportheal: 'Healer',
  support: 'Healer',
  tank: 'Tank',
  tanker: 'Tank',
  flex: 'DPS',
};

export function normalizeHeader(header: string): keyof ImportRow | undefined {
  return headerAliases[header.toLowerCase().replace(/[^a-z0-9]/g, '')];
}

export function normalizeRole(value?: unknown): Role | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  return roleOrder.find((role) => role.toLowerCase() === normalized);
}

export function normalizeMemberRank(value?: unknown): MemberRank | undefined {
  if (!value) {
    return undefined;
  }

  return memberRankAliases[String(value).trim().toLowerCase().replace(/[^a-z]/g, '')];
}

export function normalizeMemberRole(value?: unknown): MemberRole | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    memberRoleAliases[normalized] ??
    memberRoleOrder.find((role) => role.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized)
  );
}

export function rowToPlayer(row: ImportRow, teams: Team[]): Player {
  return createPlayerFromImportRow(row, teams);
}

export function buildImportRow(raw: Record<string, unknown>, source: ImportSource, confidence?: number): ImportRow {
  const mapped: Partial<ImportRow> = {};
  Object.entries(raw).forEach(([key, value]) => {
    const field = normalizeHeader(key);
    if (!field || field === 'id' || field === 'source' || field === 'warnings' || field === 'confidence') {
      return;
    }

    if (field === 'role') {
      mapped.role = normalizeRole(value);
      return;
    }

    if (field === 'memberRole') {
      mapped.memberRole = normalizeMemberRole(value);
      if (!mapped.memberRole) {
        mapped.role = normalizeRole(value);
      }
      return;
    }

    if (field === 'rank') {
      mapped.rank = normalizeMemberRank(value);
      return;
    }

    if (
      field === 'attendance' ||
      field === 'defeated' ||
      field === 'deaths' ||
      field === 'assist' ||
      field === 'dpsAvg' ||
      field === 'healAvg' ||
      field === 'tankAvg' ||
      field === 'siegeAvg' ||
      field === 'coinAvg'
    ) {
      mapped[field] = parseStatNumber(value);
      return;
    }

    mapped[field] = String(value ?? '').trim() as never;
  });

  const warnings: string[] = [];
  if (!mapped.ign) {
    warnings.push('Missing IGN');
  }
  if (mapped.memberRole === undefined && raw.role) {
    warnings.push('Unknown member role; will import as DPS');
  }
  if (mapped.rank === undefined && raw.rank) {
    warnings.push('Unknown rank; will import as Member');
  }
  if (source === 'ocr' && confidence !== undefined && confidence < 70) {
    warnings.push('Low OCR confidence');
  }
  if (source === 'gemini' && !hasMatchStat(mapped)) {
    warnings.push('No match stats detected; review manually');
  }

  return {
    id: createId('import'),
    ign: mapped.ign?.trim() ?? '',
    alias: mapped.alias,
    role: mapped.role,
    memberRole: mapped.memberRole,
    rank: mapped.rank,
    matchTime: mapped.matchTime,
    team: mapped.team,
    party: mapped.party,
    attendance: mapped.attendance,
    defeated: mapped.defeated,
    deaths: mapped.deaths,
    assist: mapped.assist,
    lastPlayed: mapped.lastPlayed,
    dpsAvg: mapped.dpsAvg,
    healAvg: mapped.healAvg,
    tankAvg: mapped.tankAvg,
    siegeAvg: mapped.siegeAvg,
    coinAvg: mapped.coinAvg,
    notes: mapped.notes,
    confidence,
    source,
    warnings,
  };
}

function hasMatchStat(row: Partial<ImportRow>): boolean {
  return [row.defeated, row.deaths, row.assist, row.dpsAvg, row.healAvg, row.tankAvg, row.siegeAvg, row.coinAvg].some(
    (value) => value !== undefined && Number.isFinite(value),
  );
}
