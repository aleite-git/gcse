import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

let versionGet: () => Promise<Response>;

beforeAll(async () => {
  ({ GET: versionGet } = await import('@/app/api/version/route'));
});

describe('GET /api/version', () => {
  beforeEach(() => {
    delete process.env.COMMIT_SHA;
  });

  it('returns version from package.json', async () => {
    const response = await versionGet();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.version).toBe('0.1.0');
  });

  it('returns commit SHA when env var is set', async () => {
    process.env.COMMIT_SHA = 'abc1234';

    const response = await versionGet();
    const body = await response.json();

    expect(body.commit).toBe('abc1234');
  });

  it('returns null commit when env var is not set', async () => {
    const response = await versionGet();
    const body = await response.json();

    expect(body.commit).toBeNull();
  });
});
