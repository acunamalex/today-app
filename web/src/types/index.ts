// User & Authentication Types
export interface User {
  id: string;
  passcode: string; // SHA-256 hashed
  role: 'worker' | 'manager';
  name: string;
  email?: string;
  managerId?: string; // For workers, links to their manager
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  userId: string;
  expiresAt: Date;
}

// Coordinates
export interface Coordinates {
  lat: number;
  lng: number;
}

// Route & Stops
export type RouteStatus = 'planning' | 'active' | 'completed' | 'cancelled';
export type StopStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface Route {
  id: string;
  userId: string;
  date: string; // ISO date string YYYY-MM-DD
  name?: string;
  stops: Stop[];
  optimizedOrder: number[];
  totalDistance: number; // meters
  totalDuration: number; // seconds
  status: RouteStatus;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Stop {
  id: string;
  routeId: string;
  address: string;
  name?: string; // Optional friendly name
  coordinates: Coordinates;
  order: number;
  estimatedArrival?: Date;
  estimatedDuration?: number; // seconds from previous stop
  arrivedAt?: Date;
  departedAt?: Date;
  status: StopStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Questions & Responses
export type QuestionType =
  | 'text'
  | 'multipleChoice'
  | 'yesNo'
  | 'photo'
  | 'signature'
  | 'rating'
  | 'number'
  | 'date'
  | 'time';

export interface QuestionTemplate {
  id: string;
  userId: string;
  text: string;
  type: QuestionType;
  options?: string[]; // for multipleChoice
  required: boolean;
  isDefault: boolean;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionResponse {
  id: string;
  stopId: string;
  routeId: string;
  questionId: string;
  questionText: string;
  type: QuestionType;
  value: string | boolean | number | null;
  imageData?: string; // base64 compressed for photos/signatures
  timestamp: Date;
}

// Reports
export interface DayReport {
  id: string;
  routeId: string;
  userId: string;
  date: string;
  summary: ExecutiveSummary;
  stopReports: StopReport[];
  generatedAt: Date;
}

export interface ExecutiveSummary {
  totalStops: number;
  completedStops: number;
  skippedStops: number;
  totalDriveTime: number; // minutes
  totalOnSiteTime: number; // minutes
  totalTime: number; // minutes
  locationsPerHour: number;
  averageTimePerStop: number; // minutes
  totalDistance: number; // kilometers
  trends: TrendItem[];
  observations: string[]; // AI-generated insights
  flaggedIssues: FlaggedIssue[];
}

export interface TrendItem {
  label: string;
  value: string | number;
  change?: number; // percentage change from previous
  type: 'positive' | 'negative' | 'neutral';
}

export interface FlaggedIssue {
  severity: 'low' | 'medium' | 'high';
  description: string;
  stopId?: string;
}

export interface StopReport {
  stopId: string;
  address: string;
  name?: string;
  timeSpent: number; // minutes
  arrivedAt?: Date;
  departedAt?: Date;
  status: StopStatus;
  responses: QuestionResponse[];
}

// Sync Queue for Offline Support
export type SyncAction = 'create' | 'update' | 'delete';
export type SyncEntity = 'route' | 'stop' | 'response' | 'question' | 'user';

export interface SyncQueueItem {
  id: string;
  action: SyncAction;
  entity: SyncEntity;
  entityId: string;
  data: unknown;
  timestamp: Date;
  synced: boolean;
  attempts: number;
  lastError?: string;
}

// Settings
export interface AppSettings {
  id: string;
  userId: string;
  offlineMode: 'auto' | 'always' | 'never';
  locationTracking: boolean;
  notifications: boolean;
  theme: 'light' | 'dark' | 'system';
  defaultQuestionTemplateIds: string[];
  updatedAt: Date;
}

// Geolocation
export interface GeoPosition {
  coords: Coordinates;
  accuracy: number;
  timestamp: number;
}

// Route Optimization
export interface RouteOptimizationResult {
  orderedStops: number[];
  totalDistance: number;
  totalDuration: number;
  legs: RouteLeg[];
}

export interface RouteLeg {
  distance: number; // meters
  duration: number; // seconds
  startIndex: number;
  endIndex: number;
  geometry?: string; // encoded polyline
}

// Geocoding
export interface GeocodingResult {
  address: string;
  displayName: string;
  coordinates: Coordinates;
  type: string;
  importance: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// UI State Types
export interface ModalState {
  isOpen: boolean;
  type?: string;
  data?: unknown;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

// Manager Dashboard Types
export interface TeamMember {
  user: User;
  currentRoute?: Route;
  lastLocation?: GeoPosition;
  lastSeen?: Date;
  todayStats?: {
    stopsCompleted: number;
    totalStops: number;
  };
}

export interface ManagerStats {
  totalWorkers: number;
  activeWorkers: number;
  stopsCompletedToday: number;
  totalStopsToday: number;
  averageCompletionRate: number;
}
