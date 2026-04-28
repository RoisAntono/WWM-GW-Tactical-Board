# Database Providers

This folder contains provider-specific database assets for optional server-side features.

The main application remains local-first. Browser `localStorage` is still the source of truth for the active workspace. Database providers are intended for optional services such as short encrypted share links.

## Structure

```text
database/
  neon/
    migrations/
    README.md
```

Runtime adapters live separately under `src/server/database/` so API handlers can depend on a provider-neutral interface instead of importing provider-specific code directly.

## Provider Rules

- Keep schema, migrations, and setup notes inside `database/<provider>/`.
- Keep runtime implementation inside `src/server/database/<provider>/`.
- Keep feature code dependent on interfaces in `src/server/share/`.
- Do not import provider-specific clients from React/client code.
- Add a new provider folder instead of rewriting existing provider folders.

## Current Providers

- `neon`: planned Postgres-backed storage for short encrypted share snapshots.
