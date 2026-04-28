export type ShareSnapshotCompression = 'gzip' | 'none';

export type ShareSnapshotRecord = {
  id: string;
  ciphertext: string;
  iv: string;
  compression: ShareSnapshotCompression;
  createdAt: string;
  expiresAt?: string;
  openedAt?: string;
  openCount: number;
};

export type CreateShareSnapshotInput = {
  id: string;
  ciphertext: string;
  iv: string;
  compression: ShareSnapshotCompression;
  createdAt?: string;
  expiresAt?: string;
};

export type FindShareSnapshotOptions = {
  now?: Date;
  touch?: boolean;
};
