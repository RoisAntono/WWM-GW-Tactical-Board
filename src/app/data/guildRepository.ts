import { getMemberTeamId, getMemberTeamRole } from '../../shared/constants';
import { createId } from '../../shared/id';
import type {
  GuildDatabase,
  GuildMember,
  GuildWarPerformance,
  GuildWarMatch,
  ImportBatch,
  ImportRow,
  MatchSource,
  MemberStatus,
  Player,
  TacticalPlan,
} from '../../types/domain';
import {
  createGuildMemberFromInput,
  findMemberByIgn,
  isMemberRank,
  isMemberStatus,
  isRole,
  normalizeDisplayIgn,
  normalizeIgn,
  rankFromStatus,
  statOrZero,
  summaryFromImportRow,
  uniqueImportRowsByIgn,
} from './domainUtils';
import {
  countImportWarnings,
  createImportBatch,
  getValidImportRows,
  validateImportRows,
  type ImportBatchInput,
} from './importValidation';

export type ImportMode = 'append' | 'replace';

export type MatchImportMeta = {
  date: string;
  opponent: string;
  source: MatchSource;
  notes?: string;
  fileName?: string;
  rowCount?: number;
  acceptedCount?: number;
  warningCount?: number;
  model?: string;
  detectedMatchTime?: string;
  files?: ImportBatchInput['files'];
};

export type MemberImportMeta = Partial<
  Pick<
    ImportBatchInput,
    'source' | 'fileName' | 'rowCount' | 'acceptedCount' | 'warningCount' | 'model' | 'detectedMatchTime' | 'files'
  >
>;

type UpsertMembersOptions = {
  updateSummary?: boolean;
};

export function normalizeGuildDatabase(guild?: GuildDatabase): GuildDatabase {
  const now = new Date().toISOString();
  if (!guild) {
    return {
      members: [],
      matches: [],
      performances: [],
      importBatches: [],
      updatedAt: now,
    };
  }

  const seenIgns = new Set<string>();
  const members = (Array.isArray(guild.members) ? guild.members : [])
    .map((member) =>
      createGuildMemberFromInput({
        ...member,
        id: member.id || createId('member'),
        role: isRole(member.role) ? member.role : 'Flex',
        rank: isMemberRank(member.rank) ? member.rank : rankFromStatus(member.status),
        status: isMemberStatus(member.status) ? member.status : 'Member',
        createdAt: member.createdAt || now,
        updatedAt: member.updatedAt || now,
      }),
    )
    .filter((member) => {
      const ignKey = normalizeIgn(member.ign);
      if (!ignKey || seenIgns.has(ignKey)) {
        return false;
      }

      seenIgns.add(ignKey);
      return true;
    });

  const memberIds = new Set(members.map((member) => member.id));
  const matches = Array.isArray(guild.matches) ? guild.matches.filter((match) => match.id && match.date) : [];
  const matchIds = new Set(matches.map((match) => match.id));
  const performances = (Array.isArray(guild.performances) ? guild.performances : []).filter(
    (performance) => memberIds.has(performance.memberId) && matchIds.has(performance.matchId),
  );
  const importBatches = normalizeImportBatches((guild as Partial<GuildDatabase>).importBatches);

  return {
    members,
    matches,
    performances,
    importBatches,
    updatedAt: guild.updatedAt || now,
  };
}

export function addGuildMember(guild: GuildDatabase, ign: string): GuildDatabase {
  const trimmedIgn = normalizeDisplayIgn(ign);
  const normalizedGuild = normalizeGuildDatabase(guild);
  if (!trimmedIgn || findMemberByIgn(normalizedGuild.members, trimmedIgn)) {
    return normalizedGuild;
  }

  const now = new Date().toISOString();
  return {
    ...normalizedGuild,
    members: [
      ...normalizedGuild.members,
      createGuildMemberFromInput({
        ign: trimmedIgn,
        status: 'Member',
        createdAt: now,
        updatedAt: now,
      }),
    ],
    updatedAt: now,
  };
}

export function updateGuildMember(guild: GuildDatabase, memberId: string, patch: Partial<GuildMember>): GuildDatabase {
  const normalizedGuild = normalizeGuildDatabase(guild);
  const nextIgn = patch.ign !== undefined ? normalizeDisplayIgn(patch.ign) : undefined;
  if (patch.ign !== undefined && !nextIgn) {
    return normalizedGuild;
  }

  const member = normalizedGuild.members.find((item) => item.id === memberId);
  if (!member) {
    return normalizedGuild;
  }

  if (nextIgn) {
    const duplicate = normalizedGuild.members.some(
      (item) => item.id !== memberId && normalizeIgn(item.ign) === normalizeIgn(nextIgn),
    );
    if (duplicate) {
      return normalizedGuild;
    }
  }

  const now = new Date().toISOString();
  return {
    ...normalizedGuild,
    members: normalizedGuild.members.map((item) =>
      item.id === memberId
        ? createGuildMemberFromInput({
            ...item,
            ...patch,
            ign: nextIgn ?? item.ign,
            role: patch.role === undefined ? item.role : patch.role,
            rank: patch.rank === undefined ? item.rank : patch.rank,
            status: patch.status === undefined ? item.status : patch.status,
            updatedAt: now,
          })
        : item,
    ),
    updatedAt: now,
  };
}

export function updateGuildMemberFromPlayerPatch(guild: GuildDatabase, memberId: string, patch: Partial<Player>): GuildDatabase {
  const normalizedPatch: Partial<GuildMember> = {};
  const hasPatchValue = (key: keyof Player) => Object.prototype.hasOwnProperty.call(patch, key);

  if (patch.ign !== undefined) {
    normalizedPatch.ign = patch.ign;
  }
  if (hasPatchValue('alias')) {
    normalizedPatch.alias = patch.alias;
  }
  if (hasPatchValue('role')) {
    normalizedPatch.role = patch.role;
  }
  if (hasPatchValue('teamId')) {
    normalizedPatch.teamId = getMemberTeamId(patch.teamId);
    normalizedPatch.role = getMemberTeamRole(normalizedPatch.teamId) ?? patch.role ?? 'Flex';
  }
  if (hasPatchValue('party')) {
    normalizedPatch.party = patch.party;
  }
  if (hasPatchValue('notes')) {
    normalizedPatch.notes = patch.notes;
  }

  return updateGuildMember(guild, memberId, normalizedPatch);
}

export function removeGuildMember(guild: GuildDatabase, memberId: string): GuildDatabase {
  const normalizedGuild = normalizeGuildDatabase(guild);
  const now = new Date().toISOString();
  return {
    ...normalizedGuild,
    members: normalizedGuild.members.filter((member) => member.id !== memberId),
    performances: normalizedGuild.performances.filter((performance) => performance.memberId !== memberId),
    updatedAt: now,
  };
}

export function applyMemberImportRows(
  guild: GuildDatabase,
  rows: ImportRow[],
  mode: ImportMode,
  teams: TacticalPlan['teams'],
  meta: MemberImportMeta = {},
): GuildDatabase {
  const validatedRows = validateImportRows(rows, 'member');
  const validRows = uniqueImportRowsByIgn(getValidImportRows(validatedRows, 'member'));
  if (validRows.length === 0) {
    return normalizeGuildDatabase(guild);
  }

  const nextGuild = mode === 'replace'
    ? replaceMembersFromRows(guild, validRows, teams)
    : upsertMembersFromRows(guild, validRows, teams, 'Member').guild;

  return addImportBatch(nextGuild, {
    source: meta.source ?? validRows[0]?.source ?? 'csv',
    kind: 'member',
    fileName: meta.fileName,
    rowCount: meta.rowCount ?? rows.length,
    acceptedCount: meta.acceptedCount ?? validRows.length,
    warningCount: meta.warningCount ?? countImportWarnings(validatedRows),
    model: meta.model,
    detectedMatchTime: meta.detectedMatchTime,
    files: meta.files,
  });
}

export function applyMatchImportRows(
  guild: GuildDatabase,
  rows: ImportRow[],
  teams: TacticalPlan['teams'],
  meta: MatchImportMeta,
): GuildDatabase {
  const validatedRows = validateImportRows(rows, 'match');
  const validRows = uniqueImportRowsByIgn(getValidImportRows(validatedRows, 'match'));
  if (validRows.length === 0) {
    return normalizeGuildDatabase(guild);
  }

  const now = new Date().toISOString();
  const match: GuildWarMatch = {
    id: createId('match'),
    date: meta.date || new Date().toISOString().slice(0, 10),
    opponent: meta.opponent.trim() || 'Unknown Opponent',
    source: meta.source,
    notes: meta.notes?.trim() || undefined,
    createdAt: now,
  };
  const { guild: guildWithMembers, memberByIgn } = upsertMembersFromRows(guild, validRows, teams, 'Pending Review', {
    updateSummary: false,
  });
  const performances: GuildWarPerformance[] = validRows
    .map((row) => {
      const member = memberByIgn.get(normalizeIgn(row.ign));
      if (!member) {
        return undefined;
      }

      return performanceFromRow(row, match.id, member.id);
    })
    .filter((performance): performance is GuildWarPerformance => Boolean(performance));

  return addImportBatch({
    ...guildWithMembers,
    matches: [match, ...guildWithMembers.matches],
    performances: [...guildWithMembers.performances, ...performances],
    updatedAt: now,
  }, {
    source: meta.source === 'manual' ? validRows[0]?.source ?? 'csv' : meta.source,
    kind: 'match',
    fileName: meta.fileName,
    rowCount: meta.rowCount ?? rows.length,
    acceptedCount: meta.acceptedCount ?? validRows.length,
    warningCount: meta.warningCount ?? countImportWarnings(validatedRows),
    matchId: match.id,
    model: meta.model,
    detectedMatchTime: meta.detectedMatchTime,
    files: meta.files,
  });
}

export function upsertMembersFromRows(
  guild: GuildDatabase,
  rows: ImportRow[],
  teams: TacticalPlan['teams'],
  statusForNew: MemberStatus,
  options: UpsertMembersOptions = {},
): { guild: GuildDatabase; memberByIgn: Map<string, GuildMember> } {
  const now = new Date().toISOString();
  const shouldUpdateSummary = options.updateSummary ?? true;
  const normalizedGuild = normalizeGuildDatabase(guild);
  const members = [...normalizedGuild.members];
  const memberByIgn = new Map(members.map((member) => [normalizeIgn(member.ign), member]));

  rows.forEach((row) => {
    const ign = normalizeDisplayIgn(row.ign);
    if (!ign) {
      return;
    }

    const ignKey = normalizeIgn(ign);
    const normalizedTeamId = getMemberTeamId(row.team);
    const matchedTeam = normalizedTeamId
      ? teams.find((team) => team.id === normalizedTeamId)
      : row.team
        ? teams.find((team) => team.name.toLowerCase() === row.team?.toLowerCase() || team.id === row.team)
        : undefined;
    const existingMember = memberByIgn.get(ignKey);

    if (existingMember) {
      const updatedMember: GuildMember = {
        ...existingMember,
        alias: row.alias?.trim() || existingMember.alias,
        role: row.role ?? getMemberTeamRole(normalizedTeamId) ?? matchedTeam?.role ?? existingMember.role,
        memberRole: row.memberRole ?? existingMember.memberRole ?? 'DPS',
        teamId: normalizedTeamId ?? matchedTeam?.id ?? existingMember.teamId,
        party: row.party?.trim() || existingMember.party,
        rank: row.rank ?? existingMember.rank,
        summary: shouldUpdateSummary ? summaryFromImportRow(row) ?? existingMember.summary : existingMember.summary,
        notes: row.notes?.trim() || existingMember.notes,
        updatedAt: now,
      };
      const index = members.findIndex((member) => member.id === existingMember.id);
      members[index] = updatedMember;
      memberByIgn.set(ignKey, updatedMember);
      return;
    }

    const member = createGuildMemberFromInput({
      ign,
      alias: row.alias,
      role: row.role ?? getMemberTeamRole(normalizedTeamId) ?? matchedTeam?.role ?? 'Flex',
      memberRole: row.memberRole ?? 'DPS',
      teamId: normalizedTeamId ?? matchedTeam?.id,
      party: row.party,
      rank: row.rank,
      summary: shouldUpdateSummary ? summaryFromImportRow(row) : undefined,
      notes: row.notes,
      status: statusForNew,
      createdAt: now,
      updatedAt: now,
    });
    members.push(member);
    memberByIgn.set(ignKey, member);
  });

  return {
    guild: {
      ...normalizedGuild,
      members,
      updatedAt: now,
    },
    memberByIgn,
  };
}

export function replaceMembersFromRows(guild: GuildDatabase, rows: ImportRow[], teams: TacticalPlan['teams']): GuildDatabase {
  const now = new Date().toISOString();
  const normalizedGuild = normalizeGuildDatabase(guild);
  const existingByIgn = new Map(normalizedGuild.members.map((member) => [normalizeIgn(member.ign), member]));
  const members = uniqueImportRowsByIgn(rows).map((row) => {
    const existing = existingByIgn.get(normalizeIgn(row.ign));
    const normalizedTeamId = getMemberTeamId(row.team);
    const matchedTeam = normalizedTeamId
      ? teams.find((team) => team.id === normalizedTeamId)
      : row.team
        ? teams.find((team) => team.name.toLowerCase() === row.team?.toLowerCase() || team.id === row.team)
        : undefined;

    return createGuildMemberFromInput({
      id: existing?.id,
      ign: row.ign,
      alias: row.alias ?? existing?.alias,
      role: row.role ?? getMemberTeamRole(normalizedTeamId) ?? matchedTeam?.role ?? existing?.role ?? 'Flex',
      memberRole: row.memberRole ?? existing?.memberRole ?? 'DPS',
      teamId: normalizedTeamId ?? matchedTeam?.id ?? existing?.teamId,
      party: row.party ?? existing?.party,
      rank: row.rank ?? existing?.rank ?? 'Member',
      status: existing?.status ?? 'Member',
      summary: summaryFromImportRow(row) ?? existing?.summary,
      notes: row.notes ?? existing?.notes,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  });
  const memberIds = new Set(members.map((member) => member.id));

  return {
    ...normalizedGuild,
    members,
    performances: normalizedGuild.performances.filter((performance) => memberIds.has(performance.memberId)),
    updatedAt: now,
  };
}

function performanceFromRow(row: ImportRow, matchId: string, memberId: string): GuildWarPerformance {
  return {
    id: createId('performance'),
    matchId,
    memberId,
    ...performanceStatsFromImportRow(row),
  };
}

export function performanceStatsFromImportRow(row: ImportRow): Omit<GuildWarPerformance, 'id' | 'matchId' | 'memberId'> {
  return {
    defeated: statOrZero(row.defeated ?? row.attendance),
    deaths: statOrZero(row.deaths),
    assist: statOrZero(row.assist),
    damage: statOrZero(row.dpsAvg),
    tank: statOrZero(row.tankAvg),
    heal: statOrZero(row.healAvg),
    siegeDamage: statOrZero(row.siegeAvg),
    funCoin: statOrZero(row.coinAvg),
  };
}

function addImportBatch(guild: GuildDatabase, input: ImportBatchInput): GuildDatabase {
  return {
    ...guild,
    importBatches: [createImportBatch(input), ...guild.importBatches],
  };
}

function normalizeImportBatches(batches: unknown): ImportBatch[] {
  if (!Array.isArray(batches)) {
    return [];
  }

  return batches
    .filter((batch): batch is Partial<ImportBatch> => typeof batch === 'object' && batch !== null)
    .filter((batch) => batch.source === 'csv' || batch.source === 'ocr' || batch.source === 'gemini')
    .filter((batch) => batch.kind === 'member' || batch.kind === 'match')
    .map((batch) => {
      const source = batch.source as ImportBatch['source'];
      const kind = batch.kind as ImportBatch['kind'];
      return createImportBatch({
        id: batch.id,
        source,
        kind,
        fileName: batch.fileName,
        createdAt: batch.createdAt,
        rowCount: Number(batch.rowCount ?? 0),
        acceptedCount: Number(batch.acceptedCount ?? 0),
        warningCount: Number(batch.warningCount ?? 0),
        matchId: batch.matchId,
        model: batch.model,
        detectedMatchTime: readStringProperty(batch, 'detectedMatchTime') ?? readStringProperty(batch, 'matchTime'),
        files: normalizeImportBatchFiles(readUnknownProperty(batch, 'files'), source),
      });
    });
}

function normalizeImportBatchFiles(files: unknown, fallbackSource: ImportBatch['source']): ImportBatchInput['files'] {
  if (!Array.isArray(files)) {
    return undefined;
  }

  return files
    .filter((file): file is Record<string, unknown> => typeof file === 'object' && file !== null)
    .map((file) => {
      const source = file.source === 'csv' || file.source === 'ocr' || file.source === 'gemini' ? file.source : fallbackSource;
      return {
        id: readStringProperty(file, 'id'),
        source,
        fileName: readStringProperty(file, 'fileName') ?? readStringProperty(file, 'name'),
        rowCount: Number(file.rowCount ?? 0),
        acceptedCount: Number(file.acceptedCount ?? 0),
        warningCount: Number(file.warningCount ?? 0),
        detectedMatchTime: readStringProperty(file, 'detectedMatchTime') ?? readStringProperty(file, 'matchTime'),
        timestampOnly: file.timestampOnly === true,
        confidenceAvg: Number(file.confidenceAvg),
        error: readStringProperty(file, 'error'),
      };
    });
}

function readUnknownProperty(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

function readStringProperty(value: unknown, key: string): string | undefined {
  const property = readUnknownProperty(value, key);
  return typeof property === 'string' ? property : undefined;
}
