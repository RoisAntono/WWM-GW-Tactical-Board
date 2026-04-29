import Papa from 'papaparse';
import { formatCompactNumber } from '../../shared/number';
import { selectMemberCsvRows, selectMemberStats, selectRosterCsvRows } from '../../app/data/selectors';
import type { GuildDatabase, ImportRow, Player, TacticalPlan } from '../../types/domain';
import { buildImportRow } from './importMapping';

export function parseRosterCsv(content: string): ImportRow[] {
  const result = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length > 0) {
    const firstError = result.errors[0];
    throw new Error(firstError.message || 'Unable to parse CSV file.');
  }

  return result.data.map((row) => buildImportRow(row, 'csv')).filter((row) => row.ign || row.warnings.length);
}

export function playersToCsv(players: Player[]): string {
  const data = players.map((player) => ({
    IGN: player.ign,
    Alias: player.alias ?? '',
    Role: player.role,
    Team: player.teamId ?? '',
    Party: player.party ?? '',
    Attendance: player.stats?.attendance ?? '',
    Defeated: player.stats?.defeated ?? '',
    Assist: player.stats?.assist ?? '',
    'Last Played': player.stats?.lastPlayed ?? '',
    Damage: player.stats?.dpsAvg ?? '',
    'Heal AVG': player.stats?.healAvg ?? '',
    'Tank AVG': player.stats?.tankAvg ?? '',
    'Siege Damage': player.stats?.siegeAvg ?? '',
    'Fun Coin': player.stats?.coinAvg ?? '',
    Notes: player.notes ?? '',
  }));

  return Papa.unparse(data);
}

export function planRosterToCsv(plan: TacticalPlan, guild: GuildDatabase): string {
  return Papa.unparse(selectRosterCsvRows(plan, guild));
}

export function guildMembersToCsv(guild: GuildDatabase): string {
  return Papa.unparse(selectMemberCsvRows(selectMemberStats(guild)));
}

export function summarizePlayerStats(players: Player[]): Record<string, string> {
  const sum = (selector: (player: Player) => number | undefined) =>
    players.reduce((total, player) => total + (selector(player) ?? 0), 0);

  return {
    players: String(players.length),
    damage: formatCompactNumber(sum((player) => player.stats?.dpsAvg)),
    heal: formatCompactNumber(sum((player) => player.stats?.healAvg)),
    tank: formatCompactNumber(sum((player) => player.stats?.tankAvg)),
    siegeDamage: formatCompactNumber(sum((player) => player.stats?.siegeAvg)),
  };
}
