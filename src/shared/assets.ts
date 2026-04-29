const mapFallback = import.meta.env.DEV ? '/Assets/gw-maps.png' : undefined;

export const assets = {
  map: new URL('../../Assets/gw-maps.webp', import.meta.url).href,
  mapCompact: new URL('../../Assets/gw-maps-compact.webp', import.meta.url).href,
  mapFallback,
  mapFormat: 'webp',
  background: new URL('../../Assets/any-background.webp', import.meta.url).href,
  backgroundCard: new URL('../../Assets/any-backgroundcard.webp', import.meta.url).href,
  objectives: {
    blueGoose: new URL('../../Assets/Game Assets/blue-goose.webp', import.meta.url).href,
    blueTower: new URL('../../Assets/Game Assets/blue-tower.webp', import.meta.url).href,
    blueTree: new URL('../../Assets/Game Assets/blue-tree.webp', import.meta.url).href,
    redGoose: new URL('../../Assets/Game Assets/red-goose.webp', import.meta.url).href,
    redTower: new URL('../../Assets/Game Assets/red-tower.webp', import.meta.url).href,
    redTree: new URL('../../Assets/Game Assets/red-tree.webp', import.meta.url).href,
    redFarm: new URL('../../Assets/Game Assets/red-dot-farm.webp', import.meta.url).href,
    bossSummon: new URL('../../Assets/Game Assets/boss-summon.webp', import.meta.url).href,
  },
};
