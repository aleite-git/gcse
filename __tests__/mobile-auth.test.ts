import { describe, expect, it } from '@jest/globals';
import bcrypt from 'bcryptjs';
import {
  checkMobileUsernameAvailability,
  loginMobileOAuthUser,
  loginMobileUser,
  MobileAuthError,
  registerMobileUser,
  type OAuthProfile,
  updateMobileUsername,
} from '@/lib/mobile-auth';
import { createProfanityFilter } from '@/lib/profanity-filter';

function createInMemoryStore(seed: Array<{
  id: string;
  email: string;
  emailLower: string;
  passwordHash: string;
  username: string;
  usernameLower: string;
  usernameChangeCount: number;
  oauthProvider?: 'google' | 'apple';
  oauthSubject?: string;
  createdAt: Date;
}> = []) {
  const users = [...seed];

  const store = {
    getByEmail: async (emailLower: string) => users.find((user) => user.emailLower === emailLower) ?? null,
    getByUsername: async (usernameLower: string) => users.find((user) => user.usernameLower === usernameLower) ?? null,
    getByOAuth: async (provider: 'google' | 'apple', subject: string) =>
      users.find((user) => user.oauthProvider === provider && user.oauthSubject === subject) ?? null,
    createUser: async (user: {
      email: string;
      emailLower: string;
      passwordHash: string;
      username: string;
      usernameLower: string;
      usernameChangeCount: number;
      oauthProvider?: 'google' | 'apple';
      oauthSubject?: string;
      createdAt: Date;
    }) => {
      const created = {
        id: `user-${users.length + 1}`,
        ...user,
      };
      users.push(created);
      return created;
    },
    updateUsername: async (
      userId: string,
      update: { username: string; usernameLower: string; usernameChangeCount: number }
    ) => {
      const index = users.findIndex((user) => user.id === userId);
      if (index >= 0) {
        users[index] = { ...users[index], ...update };
      }
    },
    updateOAuth: async (
      userId: string,
      update: { oauthProvider: 'google' | 'apple'; oauthSubject: string }
    ) => {
      const index = users.findIndex((user) => user.id === userId);
      if (index >= 0) {
        users[index] = { ...users[index], ...update };
      }
    },
  };

  return { store, users };
}

describe('mobile auth registration', () => {
  it('rejects missing email', async () => {
    const { store } = createInMemoryStore();

    await expect(
      registerMobileUser(
        { email: 123, password: 'Password1', username: 'valid_user' },
        store
      )
    ).rejects.toMatchObject({
      message: 'Email is required',
      status: 400,
    });
  });

  it('rejects invalid email format', async () => {
    const { store } = createInMemoryStore();

    await expect(
      registerMobileUser(
        { email: 'not-an-email', password: 'Password1', username: 'valid_user' },
        store
      )
    ).rejects.toMatchObject({
      message: 'Invalid email format',
      status: 400,
    });
  });

  it('rejects missing password', async () => {
    const { store } = createInMemoryStore();

    await expect(
      registerMobileUser(
        { email: 'test@example.com', password: '   ', username: 'valid_user' },
        store
      )
    ).rejects.toMatchObject({
      message: 'Password is required',
      status: 400,
    });
  });

  it('rejects missing username', async () => {
    const { store } = createInMemoryStore();

    await expect(
      registerMobileUser(
        { email: 'test@example.com', password: 'Password1', username: '' },
        store
      )
    ).rejects.toMatchObject({
      message: 'Username is required',
      status: 400,
    });
  });

  it('rejects usernames shorter than 5 characters', async () => {
    const { store } = createInMemoryStore();

    await expect(
      registerMobileUser(
        { email: 'test@example.com', password: 'Password1', username: 'abc' },
        store
      )
    ).rejects.toMatchObject({
      message: 'Username must be 5-15 characters',
      status: 400,
    });
  });

  it('rejects usernames with invalid characters', async () => {
    const { store } = createInMemoryStore();

    await expect(
      registerMobileUser(
        { email: 'test@example.com', password: 'Password1', username: 'bad-name' },
        store
      )
    ).rejects.toMatchObject({
      message: 'Username can only contain letters, numbers, and underscores',
      status: 400,
    });
  });

  it('rejects duplicate email', async () => {
    const existingHash = await bcrypt.hash('Password1', 12);
    const { store } = createInMemoryStore([
      {
        id: 'user-1',
        email: 'Existing@Example.com',
        emailLower: 'existing@example.com',
        passwordHash: existingHash,
        username: 'ExistingUser',
        usernameLower: 'existinguser',
        usernameChangeCount: 0,
        createdAt: new Date(),
      },
    ]);

    await expect(
      registerMobileUser(
        { email: 'existing@example.com', password: 'Password1', username: 'new_user' },
        store
      )
    ).rejects.toMatchObject({
      message: 'Email already in use',
      status: 409,
    });
  });

  it('rejects duplicate username', async () => {
    const existingHash = await bcrypt.hash('Password1', 12);
    const { store } = createInMemoryStore([
      {
        id: 'user-1',
        email: 'existing@example.com',
        emailLower: 'existing@example.com',
        passwordHash: existingHash,
        username: 'ExistingUser',
        usernameLower: 'existinguser',
        usernameChangeCount: 0,
        createdAt: new Date(),
      },
    ]);

    await expect(
      registerMobileUser(
        { email: 'new@example.com', password: 'Password1', username: 'ExistingUser' },
        store
      )
    ).rejects.toMatchObject({
      message: 'Username already in use',
      status: 409,
    });
  });

  it('registers a user with normalized fields', async () => {
    const { store, users } = createInMemoryStore();

    const user = await registerMobileUser(
      { email: 'User@Example.com', password: 'Password1', username: 'Valid_User' },
      store
    );

    expect(user.email).toBe('User@Example.com');
    expect(user.emailLower).toBe('user@example.com');
    expect(user.username).toBe('Valid_User');
    expect(user.usernameLower).toBe('valid_user');
    expect(user.usernameChangeCount).toBe(0);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(users).toHaveLength(1);
  });
});

describe('mobile auth login', () => {
  it('rejects invalid email format', async () => {
    const { store } = createInMemoryStore();

    await expect(
      loginMobileUser({ email: 'nope', password: 'Password1' }, store)
    ).rejects.toMatchObject({
      message: 'Invalid email format',
      status: 400,
    });
  });

  it('rejects missing password', async () => {
    const { store } = createInMemoryStore();

    await expect(
      loginMobileUser({ email: 'test@example.com', password: ' ' }, store)
    ).rejects.toMatchObject({
      message: 'Password is required',
      status: 400,
    });
  });

  it('rejects unknown users', async () => {
    const { store } = createInMemoryStore();

    await expect(
      loginMobileUser({ email: 'missing@example.com', password: 'Password1' }, store)
    ).rejects.toMatchObject({
      message: 'Invalid email or password',
      status: 401,
    });
  });

  it('rejects invalid passwords', async () => {
    const existingHash = await bcrypt.hash('Password1', 12);
    const { store } = createInMemoryStore([
      {
        id: 'user-1',
        email: 'user@example.com',
        emailLower: 'user@example.com',
        passwordHash: existingHash,
        username: 'UserOne',
        usernameLower: 'userone',
        usernameChangeCount: 0,
        createdAt: new Date(),
      },
    ]);

    await expect(
      loginMobileUser({ email: 'user@example.com', password: 'WrongPassword' }, store)
    ).rejects.toMatchObject({
      message: 'Invalid email or password',
      status: 401,
    });
  });

  it('returns the user for valid credentials', async () => {
    const passwordHash = await bcrypt.hash('Password1', 12);
    const { store } = createInMemoryStore([
      {
        id: 'user-1',
        email: 'user@example.com',
        emailLower: 'user@example.com',
        passwordHash,
        username: 'UserOne',
        usernameLower: 'userone',
        usernameChangeCount: 0,
        createdAt: new Date(),
      },
    ]);

    const user = await loginMobileUser(
      { email: 'User@Example.com', password: 'Password1' },
      store
    );

    expect(user.username).toBe('UserOne');
  });

  it('exposes status on MobileAuthError', () => {
    const error = new MobileAuthError('Boom', 418);
    expect(error.status).toBe(418);
  });
});

describe('mobile username availability', () => {
  it('returns unavailable for profane usernames', async () => {
    const { store } = createInMemoryStore();
    const filter = createProfanityFilter();

    const result = await checkMobileUsernameAvailability(
      { username: 'asshole' },
      store,
      filter
    );

    expect(result.available).toBe(false);
    expect(result.reason).toBe('Username is not allowed');
  });

  it('returns unavailable when username exists', async () => {
    const { store } = createInMemoryStore([
      {
        id: 'user-1',
        email: 'existing@example.com',
        emailLower: 'existing@example.com',
        passwordHash: await bcrypt.hash('Password1', 12),
        username: 'ExistingUser',
        usernameLower: 'existinguser',
        usernameChangeCount: 0,
        createdAt: new Date(),
      },
    ]);
    const filter = createProfanityFilter();

    const result = await checkMobileUsernameAvailability(
      { username: 'ExistingUser' },
      store,
      filter
    );

    expect(result.available).toBe(false);
    expect(result.reason).toBe('Username already in use');
  });

  it('returns available when username is free', async () => {
    const { store } = createInMemoryStore();
    const filter = createProfanityFilter();

    const result = await checkMobileUsernameAvailability(
      { username: 'NewUser' },
      store,
      filter
    );

    expect(result.available).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});

describe('mobile username update', () => {
  it('rejects update when user is missing', async () => {
    const { store } = createInMemoryStore();
    const filter = createProfanityFilter();

    await expect(
      updateMobileUsername(
        { currentUsername: 'MissingUser', newUsername: 'NewUser' },
        store,
        filter
      )
    ).rejects.toMatchObject({
      message: 'Unauthorized',
      status: 401,
    });
  });

  it('rejects update when change limit reached', async () => {
    const { store } = createInMemoryStore([
      {
        id: 'user-1',
        email: 'user@example.com',
        emailLower: 'user@example.com',
        passwordHash: await bcrypt.hash('Password1', 12),
        username: 'UserOne',
        usernameLower: 'userone',
        usernameChangeCount: 3,
        createdAt: new Date(),
      },
    ]);
    const filter = createProfanityFilter();

    await expect(
      updateMobileUsername(
        { currentUsername: 'UserOne', newUsername: 'NewUser' },
        store,
        filter
      )
    ).rejects.toMatchObject({
      message: 'Username change limit reached',
      status: 403,
    });
  });

  it('rejects update when username is unchanged', async () => {
    const { store } = createInMemoryStore([
      {
        id: 'user-1',
        email: 'user@example.com',
        emailLower: 'user@example.com',
        passwordHash: await bcrypt.hash('Password1', 12),
        username: 'UserOne',
        usernameLower: 'userone',
        usernameChangeCount: 0,
        createdAt: new Date(),
      },
    ]);
    const filter = createProfanityFilter();

    await expect(
      updateMobileUsername(
        { currentUsername: 'UserOne', newUsername: 'UserOne' },
        store,
        filter
      )
    ).rejects.toMatchObject({
      message: 'Username is unchanged',
      status: 400,
    });
  });

  it('rejects update when username is profane', async () => {
    const { store } = createInMemoryStore([
      {
        id: 'user-1',
        email: 'user@example.com',
        emailLower: 'user@example.com',
        passwordHash: await bcrypt.hash('Password1', 12),
        username: 'UserOne',
        usernameLower: 'userone',
        usernameChangeCount: 0,
        createdAt: new Date(),
      },
    ]);
    const filter = createProfanityFilter();

    await expect(
      updateMobileUsername(
        { currentUsername: 'UserOne', newUsername: 'asshole' },
        store,
        filter
      )
    ).rejects.toMatchObject({
      message: 'Username is not allowed',
      status: 400,
    });
  });

  it('rejects update when username is taken', async () => {
    const { store } = createInMemoryStore([
      {
        id: 'user-1',
        email: 'user@example.com',
        emailLower: 'user@example.com',
        passwordHash: await bcrypt.hash('Password1', 12),
        username: 'UserOne',
        usernameLower: 'userone',
        usernameChangeCount: 0,
        createdAt: new Date(),
      },
      {
        id: 'user-2',
        email: 'other@example.com',
        emailLower: 'other@example.com',
        passwordHash: await bcrypt.hash('Password1', 12),
        username: 'TakenUser',
        usernameLower: 'takenuser',
        usernameChangeCount: 1,
        createdAt: new Date(),
      },
    ]);
    const filter = createProfanityFilter();

    await expect(
      updateMobileUsername(
        { currentUsername: 'UserOne', newUsername: 'TakenUser' },
        store,
        filter
      )
    ).rejects.toMatchObject({
      message: 'Username already in use',
      status: 409,
    });
  });

  it('updates username and increments change count', async () => {
    const { store, users } = createInMemoryStore([
      {
        id: 'user-1',
        email: 'user@example.com',
        emailLower: 'user@example.com',
        passwordHash: await bcrypt.hash('Password1', 12),
        username: 'UserOne',
        usernameLower: 'userone',
        usernameChangeCount: 1,
        createdAt: new Date(),
      },
    ]);
    const filter = createProfanityFilter();

    const result = await updateMobileUsername(
      { currentUsername: 'UserOne', newUsername: 'NewUser' },
      store,
      filter
    );

    expect(result.user.username).toBe('NewUser');
    expect(result.user.usernameLower).toBe('newuser');
    expect(result.user.usernameChangeCount).toBe(2);
    expect(result.remainingChanges).toBe(1);
    expect(users[0].username).toBe('NewUser');
  });
});

describe('mobile oauth login', () => {
  const baseProfile: OAuthProfile = {
    provider: 'google',
    subject: 'subject-123',
    email: 'user@example.com',
    emailLower: 'user@example.com',
    emailVerified: true,
  };

  it('returns existing user by oauth subject', async () => {
    const { store } = createInMemoryStore([
      {
        id: 'user-1',
        email: 'user@example.com',
        emailLower: 'user@example.com',
        passwordHash: await bcrypt.hash('Password1', 12),
        username: 'UserOne',
        usernameLower: 'userone',
        usernameChangeCount: 0,
        oauthProvider: 'google',
        oauthSubject: 'subject-123',
        createdAt: new Date(),
      },
    ]);
    const filter = createProfanityFilter();

    const user = await loginMobileOAuthUser(
      { profile: baseProfile, username: 'IgnoredUser' },
      store,
      filter
    );

    expect(user.username).toBe('UserOne');
  });

  it('updates existing user by email with oauth info', async () => {
    const { store, users } = createInMemoryStore([
      {
        id: 'user-1',
        email: 'user@example.com',
        emailLower: 'user@example.com',
        passwordHash: await bcrypt.hash('Password1', 12),
        username: 'UserOne',
        usernameLower: 'userone',
        usernameChangeCount: 0,
        createdAt: new Date(),
      },
    ]);
    const filter = createProfanityFilter();

    const user = await loginMobileOAuthUser(
      { profile: baseProfile, username: 'IgnoredUser' },
      store,
      filter
    );

    expect(user.oauthProvider).toBe('google');
    expect(users[0].oauthSubject).toBe('subject-123');
  });

  it('rejects oauth signup when email is missing', async () => {
    const { store } = createInMemoryStore();
    const filter = createProfanityFilter();

    await expect(
      loginMobileOAuthUser(
        {
          profile: {
            ...baseProfile,
            email: '',
            emailLower: '',
          },
          username: 'NewUser',
        },
        store,
        filter
      )
    ).rejects.toMatchObject({
      message: 'Email is required',
      status: 400,
    });
  });

  it('rejects oauth signup when username is missing', async () => {
    const { store } = createInMemoryStore();
    const filter = createProfanityFilter();

    await expect(
      loginMobileOAuthUser(
        {
          profile: baseProfile,
          username: ' ',
        },
        store,
        filter
      )
    ).rejects.toMatchObject({
      message: 'Username is required',
      status: 400,
    });
  });

  it('creates a new oauth user', async () => {
    const { store, users } = createInMemoryStore();
    const filter = createProfanityFilter();

    const user = await loginMobileOAuthUser(
      {
        profile: baseProfile,
        username: 'NewUser',
      },
      store,
      filter
    );

    expect(user.username).toBe('NewUser');
    expect(user.oauthProvider).toBe('google');
    expect(users).toHaveLength(1);
  });
});
