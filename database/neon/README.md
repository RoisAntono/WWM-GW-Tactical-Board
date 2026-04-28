# Neon Database Provider

Neon is intended to store optional short share-link snapshots. It is not the main workspace database.

The browser still encrypts the share payload. Neon should only store ciphertext and metadata. The decrypt key stays in the URL hash, for example:

```text
https://example.vercel.app/s/abc123#key=decrypt-key
```

The hash is not sent to the server during the HTTP request, so the database stores only encrypted data.

## Environment

Planned environment variables:

```text
SHARE_STORAGE_PROVIDER=neon
NEON_DATABASE_URL=postgres://...
```

Do not expose `NEON_DATABASE_URL` to the browser. It must only be used by server-side API routes.

## Migration

Run the SQL in:

```text
database/neon/migrations/001_create_share_snapshots.sql
```

The table stores encrypted snapshots with optional expiry metadata. A future cleanup endpoint or scheduled job can delete expired rows.

## Migration Path To Another Provider

If the app later moves away from Neon:

1. Add a new folder, for example `database/turso/` or `database/vercel-blob/`.
2. Add a runtime adapter under `src/server/database/<provider>/`.
3. Implement the `ShareSnapshotStore` interface.
4. Switch `SHARE_STORAGE_PROVIDER`.

Feature code should not need to change.
