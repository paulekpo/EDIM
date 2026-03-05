import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyticsImports } from '@shared/schema';

// Mock the db module using vi.hoisted to ensure mocks are available before hoisting
const { mockInsert, mockValues, mockReturning } = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockValues = vi.fn(() => ({ returning: mockReturning }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));
  return { mockInsert, mockValues, mockReturning };
});

vi.mock('./db', () => ({
  db: {
    insert: mockInsert,
  },
}));

// Import the class under test AFTER mocking dependencies
import { DatabaseStorage } from './storage';

describe('DatabaseStorage', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DatabaseStorage();
  });

  describe('createAnalyticsImport', () => {
    it('should create an analytics import successfully', async () => {
      // Test Data
      const inputData = {
        userId: 'user-123',
        trafficSources: { tiktok: 100 },
        searchQueries: ['query1', 'query2'],
        rawImageUrl: 'http://example.com/image.png',
      };

      const expectedResult = {
        id: 'uuid-1',
        createdAt: new Date(),
        ...inputData,
      };

      // Setup Mock
      mockReturning.mockResolvedValue([expectedResult]);

      // Execute
      const result = await storage.createAnalyticsImport(inputData);

      // Verify
      expect(mockInsert).toHaveBeenCalledWith(analyticsImports);
      expect(mockValues).toHaveBeenCalledWith(inputData);
      expect(mockReturning).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });

    it('should throw an error if db insertion fails', async () => {
       const inputData = {
        userId: 'user-123',
      };

      const error = new Error('DB Error');
      mockReturning.mockRejectedValue(error);

      await expect(storage.createAnalyticsImport(inputData)).rejects.toThrow('DB Error');
    });
  });
});
