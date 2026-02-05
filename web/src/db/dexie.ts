import Dexie, { Table } from 'dexie';
import type {
  User,
  Route,
  Stop,
  QuestionTemplate,
  QuestionResponse,
  DayReport,
  SyncQueueItem,
  AppSettings,
} from '../types';

export class TodayDatabase extends Dexie {
  users!: Table<User, string>;
  routes!: Table<Route, string>;
  stops!: Table<Stop, string>;
  questionTemplates!: Table<QuestionTemplate, string>;
  questionResponses!: Table<QuestionResponse, string>;
  dayReports!: Table<DayReport, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  appSettings!: Table<AppSettings, string>;

  constructor() {
    super('TodayDB');

    this.version(1).stores({
      users: 'id, email, role, managerId, createdAt',
      routes: 'id, userId, date, status, createdAt',
      stops: 'id, routeId, order, status, createdAt',
      questionTemplates: 'id, userId, isDefault, isActive, order, createdAt',
      questionResponses: 'id, stopId, routeId, questionId, timestamp',
      dayReports: 'id, routeId, userId, date, generatedAt',
      syncQueue: 'id, entity, entityId, synced, timestamp',
      appSettings: 'id, userId',
    });

    // Add hooks for automatic timestamps
    this.routes.hook('creating', (primKey, obj) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
    });

    this.routes.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });

    this.stops.hook('creating', (primKey, obj) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
    });

    this.stops.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });

    this.questionTemplates.hook('creating', (primKey, obj) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
    });

    this.questionTemplates.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });

    this.users.hook('creating', (primKey, obj) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
    });

    this.users.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });
  }
}

export const db = new TodayDatabase();

// Initialize default question templates
export async function initializeDefaultQuestions(userId: string): Promise<void> {
  const existingDefaults = await db.questionTemplates
    .where({ userId, isDefault: true })
    .count();

  if (existingDefaults > 0) return;

  const defaultQuestions: Omit<QuestionTemplate, 'createdAt' | 'updatedAt'>[] = [
    {
      id: crypto.randomUUID(),
      userId,
      text: 'Contact Name',
      type: 'text',
      required: false,
      isDefault: true,
      isActive: true,
      order: 1,
    },
    {
      id: crypto.randomUUID(),
      userId,
      text: 'Was anyone present?',
      type: 'yesNo',
      required: true,
      isDefault: true,
      isActive: true,
      order: 2,
    },
    {
      id: crypto.randomUUID(),
      userId,
      text: 'Visit outcome',
      type: 'multipleChoice',
      options: ['Completed successfully', 'Partially completed', 'Unable to complete', 'Rescheduled'],
      required: true,
      isDefault: true,
      isActive: true,
      order: 3,
    },
    {
      id: crypto.randomUUID(),
      userId,
      text: 'Any issues found?',
      type: 'yesNo',
      required: true,
      isDefault: true,
      isActive: true,
      order: 4,
    },
    {
      id: crypto.randomUUID(),
      userId,
      text: 'Issue description',
      type: 'text',
      required: false,
      isDefault: true,
      isActive: true,
      order: 5,
    },
    {
      id: crypto.randomUUID(),
      userId,
      text: 'Photo documentation',
      type: 'photo',
      required: false,
      isDefault: true,
      isActive: true,
      order: 6,
    },
    {
      id: crypto.randomUUID(),
      userId,
      text: 'Customer satisfaction',
      type: 'rating',
      required: false,
      isDefault: true,
      isActive: true,
      order: 7,
    },
    {
      id: crypto.randomUUID(),
      userId,
      text: 'Follow-up needed?',
      type: 'yesNo',
      required: true,
      isDefault: true,
      isActive: true,
      order: 8,
    },
    {
      id: crypto.randomUUID(),
      userId,
      text: 'Customer signature',
      type: 'signature',
      required: false,
      isDefault: true,
      isActive: true,
      order: 9,
    },
    {
      id: crypto.randomUUID(),
      userId,
      text: 'Additional notes',
      type: 'text',
      required: false,
      isDefault: true,
      isActive: true,
      order: 10,
    },
  ];

  await db.questionTemplates.bulkAdd(
    defaultQuestions.map((q) => ({
      ...q,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
  );
}

// Helper function to add item to sync queue
export async function addToSyncQueue(
  action: SyncQueueItem['action'],
  entity: SyncQueueItem['entity'],
  entityId: string,
  data: unknown
): Promise<void> {
  await db.syncQueue.add({
    id: crypto.randomUUID(),
    action,
    entity,
    entityId,
    data,
    timestamp: new Date(),
    synced: false,
    attempts: 0,
  });
}

// Helper function to get user's active route for today
export async function getTodayRoute(userId: string): Promise<Route | undefined> {
  const today = new Date().toISOString().split('T')[0];
  return db.routes
    .where({ userId, date: today })
    .first();
}

// Helper function to get stops for a route
export async function getRouteStops(routeId: string): Promise<Stop[]> {
  return db.stops
    .where({ routeId })
    .sortBy('order');
}

// Helper function to get responses for a stop
export async function getStopResponses(stopId: string): Promise<QuestionResponse[]> {
  return db.questionResponses
    .where({ stopId })
    .toArray();
}

// Helper function to get active question templates
export async function getActiveQuestions(userId: string): Promise<QuestionTemplate[]> {
  return db.questionTemplates
    .where({ userId, isActive: true })
    .sortBy('order');
}

// Clear all data (for testing/reset)
export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.users.clear(),
    db.routes.clear(),
    db.stops.clear(),
    db.questionTemplates.clear(),
    db.questionResponses.clear(),
    db.dayReports.clear(),
    db.syncQueue.clear(),
    db.appSettings.clear(),
  ]);
}
