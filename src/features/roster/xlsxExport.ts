import { selectMemberCsvRows, selectMemberStats, selectRosterCsvRows } from '../../app/data/selectors';
import { roleConfigs } from '../../shared/constants';
import type { GuildDatabase, TacticalPlan } from '../../types/domain';
import type { Cell, Workbook, Worksheet } from 'exceljs';

type SheetColumn = {
  header: string;
  key: string;
};

const rosterColumns: SheetColumn[] = [
  { header: 'IGN', key: 'IGN' },
  { header: 'Alias', key: 'Alias' },
  { header: 'Role', key: 'Role' },
  { header: 'Team', key: 'Team' },
  { header: 'Party', key: 'Party' },
  { header: 'Attendance', key: 'Attendance' },
  { header: 'Defeated', key: 'Defeated' },
  { header: 'Assist', key: 'Assist' },
  { header: 'Last Played', key: 'Last Played' },
  { header: 'Damage', key: 'Damage' },
  { header: 'Heal AVG', key: 'Heal AVG' },
  { header: 'Tank AVG', key: 'Tank AVG' },
  { header: 'Siege Damage', key: 'Siege Damage' },
  { header: 'Fun Coin', key: 'Fun Coin' },
  { header: 'Notes', key: 'Notes' },
];

const memberColumns: SheetColumn[] = [
  { header: 'IGN', key: 'IGN' },
  { header: 'Alias', key: 'Alias' },
  { header: 'Rank', key: 'Rank' },
  { header: 'Role', key: 'Role' },
  { header: 'Team', key: 'Team' },
  { header: 'Party', key: 'Party' },
  { header: 'Status', key: 'Status' },
  { header: 'Attendance', key: 'Attendance' },
  { header: 'Last Played', key: 'Last Played' },
  { header: 'Defeated AVG', key: 'Defeated AVG' },
  { header: 'Assist AVG', key: 'Assist AVG' },
  { header: 'Deaths AVG', key: 'Deaths AVG' },
  { header: 'Damage AVG', key: 'Damage AVG' },
  { header: 'Heal AVG', key: 'Heal AVG' },
  { header: 'Tank AVG', key: 'Tank AVG' },
  { header: 'Siege AVG', key: 'Siege AVG' },
  { header: 'Coin AVG', key: 'Coin AVG' },
  { header: 'Notes', key: 'Notes' },
];

const matchColumns: SheetColumn[] = [
  { header: 'Date', key: 'date' },
  { header: 'Opponent', key: 'opponent' },
  { header: 'Source', key: 'source' },
  { header: 'Rows', key: 'rows' },
  { header: 'Notes', key: 'notes' },
];

const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD9B66F' } };
const headerFont = { bold: true, color: { argb: 'FF07090A' } };
const border = { style: 'thin' as const, color: { argb: 'FF3B3020' } };

export async function createRosterWorkbookBlob(plan: TacticalPlan, guild: GuildDatabase): Promise<Blob> {
  const buffer = await createRosterWorkbookBuffer(plan, guild);
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export async function createRosterWorkbookBuffer(plan: TacticalPlan, guild: GuildDatabase): Promise<ArrayBuffer> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Guild Wars Tactical Board';
  workbook.created = new Date();
  workbook.modified = new Date(plan.updatedAt || guild.updatedAt || Date.now());

  addRowsSheet(workbook, 'Members', memberColumns, selectMemberCsvRows(selectMemberStats(guild)), {
    statusColumn: 'Status',
    frozenColumns: 2,
  });
  addRowsSheet(workbook, 'Plan Roster', rosterColumns, selectRosterCsvRows(plan, guild), {
    roleColumn: 'Role',
    frozenColumns: 2,
  });
  addRowsSheet(
    workbook,
    'Matches',
    matchColumns,
    guild.matches.map((match) => ({
      date: match.date,
      opponent: match.opponent,
      source: match.source,
      rows: guild.performances.filter((performance) => performance.matchId === match.id).length,
      notes: match.notes ?? '',
    })),
    { frozenColumns: 1 },
  );

  return workbook.xlsx.writeBuffer();
}

function addRowsSheet(
  workbook: Workbook,
  name: string,
  columns: SheetColumn[],
  rows: Array<Record<string, string | number>>,
  options: { roleColumn?: string; statusColumn?: string; frozenColumns?: number } = {},
) {
  const worksheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', xSplit: options.frozenColumns ?? 0, ySplit: 1 }],
  });
  worksheet.columns = columns.map((column) => ({ ...column, width: Math.max(column.header.length + 2, 12) }));
  worksheet.addRows(rows);
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows.length + 1), column: columns.length },
  };

  styleHeader(worksheet, columns.length);
  styleBody(worksheet, columns, rows, options);
  autoWidth(worksheet, columns, rows);
}

function styleHeader(worksheet: Worksheet, columnCount: number) {
  const header = worksheet.getRow(1);
  header.height = 22;
  for (let index = 1; index <= columnCount; index += 1) {
    const cell = header.getCell(index);
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { top: border, right: border, bottom: border, left: border };
  }
}

function styleBody(
  worksheet: Worksheet,
  columns: SheetColumn[],
  rows: Array<Record<string, string | number>>,
  options: { roleColumn?: string; statusColumn?: string },
) {
  const roleColumnIndex = options.roleColumn ? columns.findIndex((column) => column.key === options.roleColumn) + 1 : 0;
  const statusColumnIndex = options.statusColumn ? columns.findIndex((column) => column.key === options.statusColumn) + 1 : 0;

  rows.forEach((row, rowIndex) => {
    const excelRow = worksheet.getRow(rowIndex + 2);
    excelRow.eachCell((cell) => {
      cell.border = { top: border, right: border, bottom: border, left: border };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });

    if (roleColumnIndex > 0) {
      styleRoleCell(excelRow.getCell(roleColumnIndex), String(row[options.roleColumn ?? ''] ?? ''));
    }
    if (statusColumnIndex > 0) {
      styleStatusCell(excelRow.getCell(statusColumnIndex), String(row[options.statusColumn ?? ''] ?? ''));
    }
  });
}

function styleRoleCell(cell: Cell, role: string) {
  const config = Object.values(roleConfigs).find((item) => item.role === role);
  if (!config) {
    return;
  }

  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${config.color.replace('#', '').toUpperCase()}` },
  };
}

function styleStatusCell(cell: Cell, status: string) {
  const argb = statusColor(status);
  if (!argb) {
    return;
  }

  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function statusColor(status: string): string | undefined {
  if (status === 'Core' || status === 'Officer' || status === 'Member') {
    return 'FF2F7D4E';
  }
  if (status === 'Pending Review' || status === 'Trial' || status === 'Bench') {
    return 'FF9B6B24';
  }
  if (status === 'Inactive' || status === 'Left' || status === 'Blacklist') {
    return 'FF8C2F2F';
  }
  return undefined;
}

function autoWidth(worksheet: Worksheet, columns: SheetColumn[], rows: Array<Record<string, string | number>>) {
  columns.forEach((column, index) => {
    const longest = rows.reduce((length, row) => Math.max(length, String(row[column.key] ?? '').length), column.header.length);
    worksheet.getColumn(index + 1).width = Math.min(Math.max(longest + 2, 12), column.key === 'Notes' ? 48 : 24);
  });
}
