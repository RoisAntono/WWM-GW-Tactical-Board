import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';

const matchCsv = [
  'IGN,Match Time,Kills,Assist,Deaths,Fun Coin,Damage,Tank,Heal,Siege Damage',
  'Alpha,2026/04/28 04:40,6,3,1,12,123456,4500,9000,222',
  'Beta,2026/04/28 04:40,4,5,2,8,98765,3000,1000,111',
].join('\n');

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p94AAAAASUVORK5CYII=',
  'base64',
);

const guildBackup = JSON.stringify({
  version: 1,
  guild: {
    members: [
      {
        id: 'member-phase-extra',
        ign: 'Phase Extra',
        role: 'Flex',
        memberRole: 'DPS',
        rank: 'Member',
        status: 'Member',
        createdAt: '2026-04-28T00:00:00.000Z',
        updatedAt: '2026-04-28T00:00:00.000Z',
      },
    ],
    matches: [],
    performances: [],
    importBatches: [],
    updatedAt: '2026-04-28T00:00:00.000Z',
  },
});

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('renders a non-empty tactical board canvas', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Guild Wars Tactical Board' })).toBeVisible();
  await expect(page.getByText('Wheel zoom')).toBeVisible();

  const boardStage = page.getByTestId('board-stage');
  await expect(boardStage.locator('canvas').first()).toBeVisible();

  await expect
    .poll(async () => boardStage.locator('canvas').evaluateAll(hasNonEmptyCanvas), { timeout: 10_000 })
    .toBe(true);
});

test('mobile board keeps canvas primary and opens side panels as drawers', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const boardStage = page.getByTestId('board-stage');
  await expect(boardStage.locator('canvas').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Focus', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Squad', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inspector', exact: true })).toBeVisible();

  await expect
    .poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);

  await page.getByRole('button', { name: 'Squad', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close squad panel' })).toBeVisible();
  await expect(page.getByText('Plan Squad')).toBeVisible();
  await page.getByRole('button', { name: 'Close squad panel' }).click();
  await expect(page.getByRole('button', { name: 'Close squad panel' })).toBeHidden();

  await page.getByRole('button', { name: 'Inspector', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close inspector panel' })).toBeVisible();
  await expect(page.getByText('No Selection')).toBeVisible();
  await page.getByRole('button', { name: 'Close inspector panel' }).click();

  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tools', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Squad', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inspector', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Focus', exact: true })).toBeVisible();
});

test('mobile landscape can focus the board canvas by hiding chrome', async ({ page }) => {
  await page.setViewportSize({ width: 932, height: 430 });
  await page.goto('/');

  const boardStage = page.getByTestId('board-stage');
  await expect(boardStage.locator('canvas').first()).toBeVisible();
  const initialHeight = await boardStage.evaluate((element) => element.getBoundingClientRect().height);

  await page.getByRole('button', { name: 'Focus' }).click();
  await expect(page.getByRole('button', { name: 'Tools' })).toBeVisible();
  await expect(page.getByLabel('Focus board tools').getByRole('button', { name: 'Place Player' })).toBeVisible();
  await expect(page.getByLabel('Focus board tools').getByRole('button', { name: 'Draw Route' })).toBeVisible();
  await expect(page.getByLabel('Focus board tools').getByRole('button', { name: 'Place Objective' })).toBeVisible();
  await expect(page.getByLabel('Focus board tools').getByRole('button', { name: 'Add Note' })).toBeVisible();
  await expect(page.getByLabel('Focus board tools').getByRole('button', { name: 'Remove Tool' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Guild Wars Tactical Board' })).toHaveCount(0);
  const focusedHeight = await boardStage.evaluate((element) => element.getBoundingClientRect().height);

  expect(focusedHeight).toBeGreaterThan(initialHeight + 80);
  await page.getByRole('button', { name: 'Tools' }).click();
  await expect(page.getByRole('button', { name: 'Focus' })).toBeVisible();
});

test('opens match CSV import review with audit metadata and source column', async ({ page }) => {
  await page.getByRole('button', { name: 'Member Data' }).click();
  await page.getByTestId('match-csv-input').setInputFiles({
    name: 'match-import.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(matchCsv),
  });

  const dialog = page.getByRole('dialog', { name: '2 detected rows' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Import Review')).toBeVisible();
  await expect(dialog.getByRole('columnheader', { name: 'Source' })).toHaveCount(0);
  await expect(dialog.getByRole('columnheader', { name: 'Match Time' })).toBeVisible();
  await expect(dialog.getByText('2026-04-28 04:40').first()).toBeVisible();
});

test('opens screenshot session modal before OCR processing', async ({ page }) => {
  await page.getByRole('button', { name: 'Member Data' }).click();
  await page.getByTestId('ocr-image-input').setInputFiles({
    name: 'scoreboard.png',
    mimeType: 'image/png',
    buffer: transparentPng,
  });

  const dialog = page.getByRole('dialog', { name: 'Match OCR Session' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('scoreboard.png')).toBeVisible();
  await expect(dialog.getByText('Files')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Process' })).toBeEnabled();
});

test('saves local settings and toggles OCR warning preference', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();

  await page.getByLabel('API Key').fill('test-api-key');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved')).toBeVisible();

  const warningToggle = page.getByLabel('Do not show OCR warning before Match OCR');
  await warningToggle.check();
  await expect(warningToggle).toBeChecked();

  const diagnostics = page.getByLabel('Workspace diagnostics');
  await expect(diagnostics.getByText('Persist Version')).toBeVisible();
  await expect(diagnostics.getByText('Local Storage')).toBeVisible();
  await expect(diagnostics.getByText('Map Format')).toBeVisible();
  await expect(diagnostics.getByText('Board Objects')).toBeVisible();
  await expect(page.getByText('Map Asset', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Run Frame Check' }).click();
  await expect(page.getByText(/Avg \d+\.\d ms, p95 \d+\.\d ms/)).toBeVisible();
});

test('reports backup compatibility after guild restore', async ({ page }) => {
  await page.getByRole('button', { name: 'Member Data' }).click();
  await page.getByTestId('backup-input').setInputFiles({
    name: 'guild-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(guildBackup),
  });

  const dialog = page.getByRole('dialog', { name: 'Guild backup restored' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Format: Guild database backup')).toBeVisible();
  await expect(dialog.getByText('Members: 1')).toBeVisible();
  await dialog.getByRole('button', { name: 'OK' }).click();
});

test('shows custom confirmation dialog for member deletion', async ({ page }) => {
  await page.getByRole('button', { name: 'Member Data' }).click();
  await page.getByPlaceholder('New member IGN').fill('Phase Four');
  await page.getByRole('button', { name: 'Add member' }).click();

  await page.getByRole('button', { name: 'Delete Phase Four' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete Phase Four?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('This removes the member from the guild database')).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep Member' }).click();
  await expect(dialog).toBeHidden();
});

test('creates encrypted share link and previews before saving copy', async ({ page }) => {
  await page.getByLabel('Plan title').fill('Shared Link Plan');
  await page.getByRole('button', { name: /02 First Rotate/ }).click();
  await page.getByRole('button', { name: 'Share encrypted workspace link' }).click();

  const shareDialog = page.getByRole('dialog', { name: 'Encrypted Share Link' });
  await expect(shareDialog).toBeVisible();
  const shareUrlField = shareDialog.getByLabel('Share URL');
  await expect(shareUrlField).toHaveValue(/#wwm-share=v1\./);
  const shareUrl = await shareUrlField.inputValue();
  await expect(shareDialog.getByText(/characters/)).toBeVisible();
  await shareDialog.getByRole('button', { name: 'Done' }).click();

  await page.getByLabel('Plan title').fill('Local Draft');
  await expect(page.getByLabel('Plan title')).toHaveValue('Local Draft');

  await page.goto(shareUrl);
  const previewDialog = page.getByRole('dialog', { name: 'Open Shared Workspace' });
  await expect(previewDialog).toBeVisible();
  await expect(previewDialog.getByLabel('Shared workspace summary').getByText('Shared Link Plan')).toBeVisible();
  await expect(previewDialog.getByLabel('Shared workspace summary').getByText('First Rotate')).toBeVisible();
  await expect(page.getByLabel('Plan title')).toHaveValue('Local Draft');
  await expect(previewDialog.getByTestId('share-preview-stage').locator('canvas').first()).toBeVisible();

  await previewDialog.getByRole('button', { name: 'Save Copy' }).click();
  await expect(previewDialog).toBeHidden();
  await expect(page.getByLabel('Plan title')).toHaveValue('Shared Link Plan');
  await expect(page.locator('.phase-tab-item.is-active').getByRole('button', { name: /02 First Rotate/ })).toBeVisible();
});

test('shows an error for corrupt encrypted share links', async ({ page }) => {
  await page.goto('/#wwm-share=v1.n.bad!.iv.data');

  const dialog = page.getByRole('dialog', { name: 'Unable To Open Share Link' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/shared workspace link format/i)).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
});

function hasNonEmptyCanvas(canvases: Element[]): boolean {
  return canvases.some((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width <= 0 || canvas.height <= 0) {
      return false;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return false;
    }

    const samplePoints = [
      [0.5, 0.5],
      [0.25, 0.25],
      [0.75, 0.25],
      [0.25, 0.75],
      [0.75, 0.75],
    ];

    return samplePoints.some(([xRatio, yRatio]) => {
      const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(canvas.width * xRatio)));
      const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(canvas.height * yRatio)));
      const [red, green, blue, alpha] = context.getImageData(x, y, 1, 1).data;
      return alpha > 0 && red + green + blue > 0;
    });
  });
}
