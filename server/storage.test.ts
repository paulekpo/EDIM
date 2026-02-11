import { describe, it, expect, vi, beforeEach } from 'vitest';
import { users } from '@shared/schema';

// Use vi.hoisted to ensure mocks are available for the mock factories
const mocks = vi.hoisted(() => {
  const whereMock = vi.fn().mockResolvedValue(undefined);
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  const updateMock = vi.fn().mockReturnValue({ set: setMock });
  const eqMock = vi.fn((col, val) => ({ col, val, op: 'eq' }));

  return {
    whereMock,
    setMock,
    updateMock,
    eqMock,
  };
});

// Mock drizzle-orm
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: mocks.eqMock,
  };
});

// Mock db
vi.mock('./db', () => ({
  db: {
    update: mocks.updateMock,
  },
}));

// Import implementation after mocking
import { DatabaseStorage } from './storage';

describe('DatabaseStorage', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();
    storage = new DatabaseStorage();
  });

  describe('updateUserTierProgress', () => {
    it('should update progress only when no tier is provided', async () => {
      const userId = 'user-123';
      const progress = 50;

      await storage.updateUserTierProgress(userId, progress);

      // Verify update was called on users table
      expect(mocks.updateMock).toHaveBeenCalledWith(users);

      // Verify set was called with correct data
      expect(mocks.setMock).toHaveBeenCalledWith({ tierProgress: progress });

      // Verify eq was called correctly
      expect(mocks.eqMock).toHaveBeenCalledWith(users.id, userId);

      // Verify where was called with result of eq (our mock object)
      expect(mocks.whereMock).toHaveBeenCalledWith({ col: users.id, val: userId, op: 'eq' });
    });

    it('should update progress and tier when tier is provided', async () => {
      const userId = 'user-123';
      const progress = 100;
      const tier = 'Professional';

      await storage.updateUserTierProgress(userId, progress, tier);

      expect(mocks.updateMock).toHaveBeenCalledWith(users);
      expect(mocks.setMock).toHaveBeenCalledWith({
        tierProgress: progress,
        currentTier: tier
      });
      expect(mocks.eqMock).toHaveBeenCalledWith(users.id, userId);
      expect(mocks.whereMock).toHaveBeenCalledWith({ col: users.id, val: userId, op: 'eq' });
    });
  });
});
