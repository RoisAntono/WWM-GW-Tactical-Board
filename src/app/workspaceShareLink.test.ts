import { describe, expect, it } from 'vitest';
import { defaultPlanTeams } from '../shared/constants';
import type { GuildDatabase, TacticalPlan } from '../types/domain';
import {
  buildWorkspaceShareUrl,
  createWorkspaceShareEncryptedSnapshot,
  createWorkspaceShareHash,
  createWorkspaceShareKeyHash,
  createWorkspaceSharePayload,
  decryptWorkspaceShareStoredSnapshot,
  decryptWorkspaceShareHash,
  readWorkspaceShareKeyHash,
  hasWorkspaceShareHash,
  readWorkspaceShareToken,
  WorkspaceShareLinkError,
} from './workspaceShareLink';

describe('workspace share links', () => {
  it('roundtrips an encrypted workspace snapshot', async () => {
    const payload = createWorkspaceSharePayload(planFixture(), guildFixture(), 'phase-battle', '2026-04-28T00:00:00.000Z');
    const hash = await createWorkspaceShareHash(payload, { compression: 'n' });
    const decrypted = await decryptWorkspaceShareHash(hash);

    expect(hash).toMatch(/^#wwm-share=v1\.n\./);
    expect(decrypted.plan.title).toBe('Shared Plan');
    expect(decrypted.guild.members).toHaveLength(1);
    expect(decrypted.activePhaseId).toBe('phase-battle');
    expect(decrypted.createdAt).toBe('2026-04-28T00:00:00.000Z');
  });

  it('does not include local settings or API keys in the link', async () => {
    const payload = {
      ...createWorkspaceSharePayload(planFixture(), guildFixture(), 'phase-battle', '2026-04-28T00:00:00.000Z'),
      settings: { geminiApiKey: 'secret-key' },
    };

    const hash = await createWorkspaceShareHash(payload, { compression: 'n' });
    const decrypted = await decryptWorkspaceShareHash(hash);

    expect(hash).not.toContain('secret-key');
    expect(hash).not.toContain('geminiApiKey');
    expect(decrypted).not.toHaveProperty('settings');
  });

  it('reads and builds share URL hashes', async () => {
    const payload = createWorkspaceSharePayload(planFixture(), guildFixture(), 'phase-battle', '2026-04-28T00:00:00.000Z');
    const hash = await createWorkspaceShareHash(payload, { compression: 'n' });
    const url = buildWorkspaceShareUrl(hash, 'https://example.test/app?room=1#old');

    expect(url).toContain('https://example.test/app?room=1#wwm-share=');
    expect(hasWorkspaceShareHash(new URL(url).hash)).toBe(true);
    expect(readWorkspaceShareToken(new URL(url).hash)).toBe(hash.replace('#wwm-share=', ''));
  });

  it('decrypts a stored short-link snapshot with the key kept in the URL hash', async () => {
    const payload = createWorkspaceSharePayload(planFixture(), guildFixture(), 'phase-battle', '2026-04-28T00:00:00.000Z');
    const encrypted = await createWorkspaceShareEncryptedSnapshot(payload, { compression: 'n' });
    const hash = createWorkspaceShareKeyHash(encrypted);
    const decrypted = await decryptWorkspaceShareStoredSnapshot(
      {
        version: 1,
        compression: encrypted.compression,
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext,
      },
      hash,
    );

    expect(hash).toMatch(/^#wwm-share-key=v1\.n\./);
    expect(readWorkspaceShareKeyHash(hash)).toMatchObject({ version: 1, compression: 'n' });
    expect(decrypted.plan.title).toBe('Shared Plan');
    expect(decrypted.activePhaseId).toBe('phase-battle');
  });

  it('rejects unsupported or corrupt hashes', async () => {
    await expect(decryptWorkspaceShareHash('#wwm-share=v2.n.key.iv.data')).rejects.toBeInstanceOf(WorkspaceShareLinkError);
    await expect(decryptWorkspaceShareHash('#wwm-share=v1.n.bad!.iv.data')).rejects.toBeInstanceOf(WorkspaceShareLinkError);

    const payload = createWorkspaceSharePayload(planFixture(), guildFixture(), 'phase-battle', '2026-04-28T00:00:00.000Z');
    const hash = await createWorkspaceShareHash(payload, { compression: 'n' });
    const tampered = `${hash.slice(0, -2)}aa`;

    await expect(decryptWorkspaceShareHash(tampered)).rejects.toThrow('invalid or has been changed');
  });
});

function planFixture(): TacticalPlan {
  return {
    version: 1,
    id: 'plan-share',
    title: 'Shared Plan',
    opponent: 'Blue Guild',
    roster: [],
    teams: defaultPlanTeams,
    phases: [
      {
        id: 'phase-opening',
        name: 'Opening',
        playerMarkers: [],
        routes: [],
        objectives: [],
        zones: [],
        notes: [],
      },
      {
        id: 'phase-battle',
        name: 'Battle',
        playerMarkers: [],
        routes: [],
        objectives: [],
        zones: [],
        notes: [],
      },
    ],
    updatedAt: '2026-04-28T00:00:00.000Z',
  };
}

function guildFixture(): GuildDatabase {
  return {
    members: [
      {
        id: 'member-alpha',
        ign: 'Alpha',
        role: 'Attack',
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
  };
}
