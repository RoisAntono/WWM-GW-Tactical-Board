import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';

const visualViewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'macbook-air', width: 1559, height: 975 },
  { name: 'compact', width: 1180, height: 760 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'portrait', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'mobile-landscape', width: 932, height: 430 },
] as const;

const matchCsv = [
  'IGN,Match Time,Kills,Assist,Deaths,Fun Coin,Damage,Tank,Heal,Siege Damage',
  'Alpha,2026/04/28 04:40,6,3,1,12,123456,4500,9000,222',
  'Beta,2026/04/28 04:40,4,5,2,8,98765,3000,1000,111',
].join('\n');

for (const viewport of visualViewports) {
  test(`board visual baseline ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await disableCaret(page);
    await expect(page.getByTestId('board-stage').locator('canvas').first()).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('board-stage').locator('canvas').evaluateAll(hasNonEmptyCanvas), { timeout: 10_000 })
      .toBe(true);

    await expect(page).toHaveScreenshot(`board-${viewport.name}.png`, {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });

  test(`settings diagnostics visual baseline ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await disableCaret(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Workspace Diagnostics' })).toBeVisible();

    await expect(page).toHaveScreenshot(`settings-diagnostics-${viewport.name}.png`, {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });
}

test('import review visual baseline desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await disableCaret(page);
  await page.getByRole('button', { name: 'Member Data' }).click();
  await page.getByTestId('match-csv-input').setInputFiles({
    name: 'match-import.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(matchCsv),
  });
  await expect(page.getByRole('dialog', { name: '2 detected rows' })).toBeVisible();

  await expect(page).toHaveScreenshot('import-review-desktop.png', {
    animations: 'disabled',
    fullPage: false,
    maxDiffPixelRatio: 0.02,
  });
});

async function disableCaret(page: { addStyleTag: (options: { content: string }) => Promise<unknown> }) {
  await page.addStyleTag({ content: '* { caret-color: transparent !important; }' });
}

function hasNonEmptyCanvas(canvases: Element[]): boolean {
  return canvases.some((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width <= 0 || canvas.height <= 0) {
      return false;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return false;
    }

    const x = Math.floor(canvas.width / 2);
    const y = Math.floor(canvas.height / 2);
    const [red, green, blue, alpha] = context.getImageData(x, y, 1, 1).data;
    return alpha > 0 && red + green + blue > 0;
  });
}
