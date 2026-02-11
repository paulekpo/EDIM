
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Define mocks using vi.hoisted so they are available in vi.mock
const { mockStorage } = vi.hoisted(() => {
  return {
    mockStorage: {
      getIdea: vi.fn(),
      getChecklistItems: vi.fn(),
      getUser: vi.fn(),
      updateUserActivity: vi.fn(),
      deleteIdea: vi.fn(),
      createChecklistItem: vi.fn(),
      updateChecklistItem: vi.fn(),
      toggleChecklistItem: vi.fn(),
      deleteChecklistItem: vi.fn(),
      countUncheckedItems: vi.fn(),
      getNotifications: vi.fn(),
      markNotificationRead: vi.fn(),
      getAdminStats: vi.fn(),
      getAllUsers: vi.fn(),
      setUserAdmin: vi.fn(),
      createAnalyticsImport: vi.fn(),
      getAnalyticsImportForUser: vi.fn(),
      hasAnalyticsImports: vi.fn(),
      getIdeasByUser: vi.fn(),
      getActiveIdeas: vi.fn(),
      updateIdea: vi.fn(),
      countCompletedIdeasInTier: vi.fn(),
      createNotification: vi.fn(),
      updateUserTierProgress: vi.fn(),
      getChecklistItem: vi.fn(),
      getNotification: vi.fn(),
    }
  };
});

vi.mock('./storage', () => ({
  storage: mockStorage
}));

// Mock auth
vi.mock('./replit_integrations/auth', () => ({
  setupAuth: vi.fn(),
  registerAuthRoutes: vi.fn(),
  isAuthenticated: (req: any, res: any, next: any) => {
    const userId = req.headers['x-user-id'];
    if (userId) {
      req.user = { claims: { sub: userId } };
      next();
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
  }
}));

// Mock DB
vi.mock('./db', () => ({ db: {} }));

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: class {
      chat = { completions: { create: vi.fn() } }
    }
  };
});

// Mock Object Storage
vi.mock('./replit_integrations/object_storage', () => ({
  registerObjectStorageRoutes: vi.fn(),
  ObjectStorageService: class {}
}));

// Import routes after mocks
import { registerRoutes } from './routes';

describe('Security Vulnerability Tests', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    // We need to await registerRoutes because it's async
    await registerRoutes(app as any, app);
  });

  // 1. GET /api/ideas/:id
  it('GET /api/ideas/:id should fail without auth', async () => {
    mockStorage.getIdea.mockResolvedValue({ id: '1', userId: 'user1', title: 'Test Idea' });
    mockStorage.getChecklistItems.mockResolvedValue([]);

    const res = await request(app).get('/api/ideas/1');
    expect(res.status).toBe(401);
  });

  it('GET /api/ideas/:id should fail for different user', async () => {
    mockStorage.getIdea.mockResolvedValue({ id: '1', userId: 'user1', title: 'Test Idea' });
    mockStorage.getChecklistItems.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/ideas/1')
      .set('x-user-id', 'user2');

    expect(res.status).toBe(403);
  });

  it('GET /api/ideas/:id should succeed for owner', async () => {
    mockStorage.getIdea.mockResolvedValue({ id: '1', userId: 'user1', title: 'Test Idea' });
    mockStorage.getChecklistItems.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/ideas/1')
      .set('x-user-id', 'user1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('1');
  });

  // 2. DELETE /api/ideas/:id
  it('DELETE /api/ideas/:id should fail for different user', async () => {
    mockStorage.getIdea.mockResolvedValue({ id: '1', userId: 'user1', title: 'Test Idea' });

    const res = await request(app)
      .delete('/api/ideas/1')
      .set('x-user-id', 'user2');

    expect(res.status).toBe(403);
  });

  // 3. POST /api/ideas/:ideaId/checklist
  it('POST /api/ideas/:ideaId/checklist should fail for different user', async () => {
    mockStorage.getIdea.mockResolvedValue({ id: '1', userId: 'user1', title: 'Test Idea' });
    // Note: getChecklistItems is called inside to determine position
    mockStorage.getChecklistItems.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/ideas/1/checklist')
      .send({ text: 'New Item' })
      .set('x-user-id', 'user2');

    expect(res.status).toBe(403);
  });

  // 4. PATCH /api/checklist/:id
  it('PATCH /api/checklist/:id should fail for different user', async () => {
    mockStorage.getChecklistItem.mockResolvedValue({ id: 'item1', ideaId: '1', text: 'Item 1' });
    mockStorage.getIdea.mockResolvedValue({ id: '1', userId: 'user1' });

    const res = await request(app)
      .patch('/api/checklist/item1')
      .send({ text: 'Updated' })
      .set('x-user-id', 'user2');

    expect(res.status).toBe(403);
  });

  // 5. PATCH /api/checklist/:id/toggle
  it('PATCH /api/checklist/:id/toggle should fail for different user', async () => {
    mockStorage.getChecklistItem.mockResolvedValue({ id: 'item1', ideaId: '1', isChecked: false });
    mockStorage.getIdea.mockResolvedValue({ id: '1', userId: 'user1' });

    const res = await request(app)
      .patch('/api/checklist/item1/toggle')
      .set('x-user-id', 'user2');

    expect(res.status).toBe(403);
    // Ensure it didn't call toggle
    expect(mockStorage.toggleChecklistItem).not.toHaveBeenCalled();
  });

  // 6. DELETE /api/checklist/:id
  it('DELETE /api/checklist/:id should fail for different user', async () => {
    mockStorage.getChecklistItem.mockResolvedValue({ id: 'item1', ideaId: '1' });
    mockStorage.getIdea.mockResolvedValue({ id: '1', userId: 'user1' });

    const res = await request(app)
      .delete('/api/checklist/item1')
      .set('x-user-id', 'user2');

    expect(res.status).toBe(403);
    expect(mockStorage.deleteChecklistItem).not.toHaveBeenCalled();
  });

  // 7. PATCH /api/notifications/:id/read
  it('PATCH /api/notifications/:id/read should fail for different user', async () => {
    mockStorage.getNotification.mockResolvedValue({ id: 'notif1', userId: 'user1' });

    const res = await request(app)
      .patch('/api/notifications/notif1/read')
      .set('x-user-id', 'user2');

    expect(res.status).toBe(403);
    expect(mockStorage.markNotificationRead).not.toHaveBeenCalled();
  });
});
