import { describe, expect, it } from 'vitest';
import { buildWorkspaceShortShareUrl, readWorkspaceShortShareId } from './workspaceShortShare';

describe('workspace short share links', () => {
  it('builds compact share paths while keeping the decrypt key in the hash', () => {
    const url = buildWorkspaceShortShareUrl(
      'abc123_DEF',
      '#wwm-share-key=v1.g.secret',
      'https://example.test/current/path?old=1#previous',
    );

    expect(url).toBe('https://example.test/s/abc123_DEF#wwm-share-key=v1.g.secret');
    expect(readWorkspaceShortShareId(new URL(url).pathname)).toBe('abc123_DEF');
  });
});
