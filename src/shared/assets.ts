const mapFallback = import.meta.env.DEV ? '/Assets/gw-maps.png' : undefined;

export const assets = {
  map: new URL('../../Assets/gw-maps.webp', import.meta.url).href,
  mapFallback,
  mapFormat: 'webp',
  background: new URL('../../Assets/any-background.png', import.meta.url).href,
  backgroundCard: new URL('../../Assets/any-backgroundcard.png', import.meta.url).href,
  objectives: {
    blueGoose: new URL('../../Assets/Game Assets/blue-goose.svg', import.meta.url).href,
    blueTower: new URL('../../Assets/Game Assets/blue-tower.svg', import.meta.url).href,
    blueTree: new URL('../../Assets/Game Assets/blue-tree.svg', import.meta.url).href,
    redGoose: new URL('../../Assets/Game Assets/red-goose.svg', import.meta.url).href,
    redTower: new URL('../../Assets/Game Assets/red-tower.svg', import.meta.url).href,
    redTree: new URL('../../Assets/Game Assets/red-tree.svg', import.meta.url).href,
    redFarm: new URL('../../Assets/Game Assets/red-dot-farm.svg', import.meta.url).href,
    bossSummon: new URL('../../Assets/Game Assets/boss-summon.svg', import.meta.url).href,
  },
};
