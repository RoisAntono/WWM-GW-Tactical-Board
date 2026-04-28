import type { CreateShareSnapshotInput, FindShareSnapshotOptions, ShareSnapshotRecord } from './shareSnapshotTypes';

export type ShareSnapshotStore = {
  create(input: CreateShareSnapshotInput): Promise<ShareSnapshotRecord>;
  findById(id: string, options?: FindShareSnapshotOptions): Promise<ShareSnapshotRecord | undefined>;
  deleteExpired(now?: Date): Promise<number>;
};

export class ShareSnapshotStoreError extends Error {
  constructor(message: string, public readonly code: 'invalid-input' | 'not-found' | 'storage-error') {
    super(message);
    this.name = 'ShareSnapshotStoreError';
  }
}
