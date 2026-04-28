import type { ShareSnapshotStore } from '../share/shareSnapshotStore';
import {
  createNeonShareSnapshotStore,
  type NeonSqlExecutor,
} from './neon/neonShareSnapshotStore';
import { normalizeShareStorageProvider, type ShareStorageProvider } from './storageProvider';

export type ShareSnapshotStoreConfig = {
  provider?: ShareStorageProvider;
  neon?: {
    sql: NeonSqlExecutor;
  };
};

export function createShareSnapshotStore(config: ShareSnapshotStoreConfig): ShareSnapshotStore {
  const provider = normalizeShareStorageProvider(config.provider);

  if (provider === 'neon') {
    if (!config.neon?.sql) {
      throw new Error('Neon share snapshot store requires a SQL executor.');
    }

    return createNeonShareSnapshotStore(config.neon.sql);
  }

  return unreachableProvider(provider);
}

function unreachableProvider(provider: never): never {
  throw new Error(`Unsupported share storage provider: ${provider}`);
}
