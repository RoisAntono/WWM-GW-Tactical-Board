import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const sourcePath = path.resolve('Assets/gw-maps.png');
const outputPath = path.resolve('Assets/gw-maps.webp');
const expectedWidth = 5792;
const expectedHeight = 4344;
const quality = Number.parseInt(process.env.MAP_WEBP_QUALITY ?? '82', 10);
const effort = Number.parseInt(process.env.MAP_WEBP_EFFORT ?? '6', 10);

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  const image = sharp(sourcePath);
  const metadata = await image.metadata();

  if (metadata.width !== expectedWidth || metadata.height !== expectedHeight) {
    throw new Error(
      `Unexpected map dimensions ${metadata.width}x${metadata.height}; expected ${expectedWidth}x${expectedHeight}. Refusing to resize tactical coordinates.`,
    );
  }

  await image.webp({ quality, effort }).toFile(outputPath);

  const [sourceStats, outputStats] = await Promise.all([fs.stat(sourcePath), fs.stat(outputPath)]);
  console.log(`Map source: ${formatBytes(sourceStats.size)} (${expectedWidth}x${expectedHeight})`);
  console.log(`Map output: ${formatBytes(outputStats.size)} (${expectedWidth}x${expectedHeight}, webp q${quality}, effort ${effort})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
