import { describe, expect, it, vi } from 'vitest';

import { createAuthRepository } from '../auth/repository.js';

describe('auth repository', () => {
  it('does not query the UUID column for a malformed user id', async () => {
    const select = vi.fn();
    const repository = createAuthRepository({ select });

    await expect(repository.getUserById('e2e-user')).resolves.toBeNull();
    expect(select).not.toHaveBeenCalled();
  });
});
