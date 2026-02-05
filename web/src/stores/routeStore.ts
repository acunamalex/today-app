import { create } from 'zustand';
import type { Route, Stop, Coordinates, RouteStatus, StopStatus } from '../types';
import { db, addToSyncQueue, getRouteStops } from '../db/dexie';
import { optimizeRoute } from '../services/routeService';

interface RouteState {
  currentRoute: Route | null;
  stops: Stop[];
  isLoading: boolean;
  isOptimizing: boolean;
  error: string | null;
  currentStopIndex: number;

  // Actions
  createRoute: (userId: string, date?: string) => Promise<Route>;
  loadRoute: (routeId: string) => Promise<void>;
  loadTodayRoute: (userId: string) => Promise<Route | null>;
  addStop: (address: string, coordinates: Coordinates, name?: string) => Promise<Stop>;
  removeStop: (stopId: string) => Promise<void>;
  reorderStops: (fromIndex: number, toIndex: number) => Promise<void>;
  optimizeRouteOrder: (startCoordinates?: Coordinates) => Promise<void>;
  updateRouteStatus: (status: RouteStatus) => Promise<void>;
  updateStopStatus: (stopId: string, status: StopStatus) => Promise<void>;
  markStopArrived: (stopId: string) => Promise<void>;
  markStopDeparted: (stopId: string) => Promise<void>;
  setCurrentStopIndex: (index: number) => void;
  goToNextStop: () => void;
  clearRoute: () => void;
  clearError: () => void;
}

export const useRouteStore = create<RouteState>()((set, get) => ({
  currentRoute: null,
  stops: [],
  isLoading: false,
  isOptimizing: false,
  error: null,
  currentStopIndex: 0,

  createRoute: async (userId, date) => {
    set({ isLoading: true, error: null });

    try {
      const routeDate = date || new Date().toISOString().split('T')[0];

      // Check for existing route on this date
      const existingRoute = await db.routes
        .where({ userId, date: routeDate })
        .first();

      if (existingRoute) {
        const stops = await getRouteStops(existingRoute.id);
        set({
          currentRoute: existingRoute,
          stops,
          isLoading: false,
          currentStopIndex: stops.findIndex((s) => s.status === 'pending') || 0,
        });
        return existingRoute;
      }

      const newRoute: Route = {
        id: crypto.randomUUID(),
        userId,
        date: routeDate,
        stops: [],
        optimizedOrder: [],
        totalDistance: 0,
        totalDuration: 0,
        status: 'planning',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.routes.add(newRoute);
      await addToSyncQueue('create', 'route', newRoute.id, newRoute);

      set({
        currentRoute: newRoute,
        stops: [],
        isLoading: false,
        currentStopIndex: 0,
      });

      return newRoute;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create route',
        isLoading: false,
      });
      throw error;
    }
  },

  loadRoute: async (routeId) => {
    set({ isLoading: true, error: null });

    try {
      const route = await db.routes.get(routeId);
      if (!route) {
        throw new Error('Route not found');
      }

      const stops = await getRouteStops(routeId);

      set({
        currentRoute: route,
        stops,
        isLoading: false,
        currentStopIndex: stops.findIndex((s) => s.status === 'pending' || s.status === 'in_progress') || 0,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load route',
        isLoading: false,
      });
    }
  },

  loadTodayRoute: async (userId) => {
    set({ isLoading: true, error: null });

    try {
      const today = new Date().toISOString().split('T')[0];
      const route = await db.routes
        .where({ userId, date: today })
        .first();

      if (!route) {
        set({ isLoading: false, currentRoute: null, stops: [] });
        return null;
      }

      const stops = await getRouteStops(route.id);

      set({
        currentRoute: route,
        stops,
        isLoading: false,
        currentStopIndex: stops.findIndex((s) => s.status === 'pending' || s.status === 'in_progress') || 0,
      });

      return route;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load route',
        isLoading: false,
      });
      return null;
    }
  },

  addStop: async (address, coordinates, name) => {
    const { currentRoute, stops } = get();
    if (!currentRoute) throw new Error('No active route');

    const newStop: Stop = {
      id: crypto.randomUUID(),
      routeId: currentRoute.id,
      address,
      name,
      coordinates,
      order: stops.length,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.stops.add(newStop);
    await addToSyncQueue('create', 'stop', newStop.id, newStop);

    const updatedStops = [...stops, newStop];
    set({ stops: updatedStops });

    // Update route's stop reference
    await db.routes.update(currentRoute.id, {
      stops: updatedStops,
      updatedAt: new Date(),
    });

    return newStop;
  },

  removeStop: async (stopId) => {
    const { currentRoute, stops } = get();
    if (!currentRoute) throw new Error('No active route');

    await db.stops.delete(stopId);
    await addToSyncQueue('delete', 'stop', stopId, { id: stopId });

    const updatedStops = stops
      .filter((s) => s.id !== stopId)
      .map((s, index) => ({ ...s, order: index }));

    // Update order in database
    await Promise.all(
      updatedStops.map((s) =>
        db.stops.update(s.id, { order: s.order, updatedAt: new Date() })
      )
    );

    set({ stops: updatedStops });
  },

  reorderStops: async (fromIndex, toIndex) => {
    const { stops } = get();

    const newStops = [...stops];
    const [movedStop] = newStops.splice(fromIndex, 1);
    newStops.splice(toIndex, 0, movedStop);

    // Update order for all stops
    const updatedStops = newStops.map((s, index) => ({
      ...s,
      order: index,
      updatedAt: new Date(),
    }));

    // Update in database
    await Promise.all(
      updatedStops.map((s) =>
        db.stops.update(s.id, { order: s.order, updatedAt: s.updatedAt })
      )
    );

    set({ stops: updatedStops });
  },

  optimizeRouteOrder: async (startCoordinates) => {
    const { currentRoute, stops } = get();
    if (!currentRoute || stops.length < 2) return;

    set({ isOptimizing: true, error: null });

    try {
      const coordinates = stops.map((s) => s.coordinates);

      // Add start position if provided (user's current location)
      const allCoordinates = startCoordinates
        ? [startCoordinates, ...coordinates]
        : coordinates;

      const result = await optimizeRoute(allCoordinates);

      if (!result) {
        throw new Error('Failed to optimize route');
      }

      // Adjust indices if we added a start position
      const optimizedIndices = startCoordinates
        ? result.orderedStops.slice(1).map((i) => i - 1)
        : result.orderedStops;

      // Reorder stops based on optimization
      const optimizedStops = optimizedIndices.map((originalIndex, newOrder) => ({
        ...stops[originalIndex],
        order: newOrder,
        updatedAt: new Date(),
      }));

      // Update database
      await Promise.all(
        optimizedStops.map((s) =>
          db.stops.update(s.id, { order: s.order, updatedAt: s.updatedAt })
        )
      );

      // Update route with totals
      await db.routes.update(currentRoute.id, {
        optimizedOrder: optimizedIndices,
        totalDistance: result.totalDistance,
        totalDuration: result.totalDuration,
        updatedAt: new Date(),
      });

      set({
        stops: optimizedStops.sort((a, b) => a.order - b.order),
        currentRoute: {
          ...currentRoute,
          optimizedOrder: optimizedIndices,
          totalDistance: result.totalDistance,
          totalDuration: result.totalDuration,
        },
        isOptimizing: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to optimize route',
        isOptimizing: false,
      });
    }
  },

  updateRouteStatus: async (status) => {
    const { currentRoute } = get();
    if (!currentRoute) throw new Error('No active route');

    const updates: Partial<Route> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'active' && !currentRoute.startedAt) {
      updates.startedAt = new Date();
    }

    if (status === 'completed') {
      updates.completedAt = new Date();
    }

    await db.routes.update(currentRoute.id, updates);
    await addToSyncQueue('update', 'route', currentRoute.id, updates);

    set({
      currentRoute: { ...currentRoute, ...updates },
    });
  },

  updateStopStatus: async (stopId, status) => {
    const { stops } = get();

    await db.stops.update(stopId, { status, updatedAt: new Date() });
    await addToSyncQueue('update', 'stop', stopId, { status });

    set({
      stops: stops.map((s) =>
        s.id === stopId ? { ...s, status, updatedAt: new Date() } : s
      ),
    });
  },

  markStopArrived: async (stopId) => {
    const { stops } = get();
    const now = new Date();

    await db.stops.update(stopId, {
      status: 'in_progress',
      arrivedAt: now,
      updatedAt: now,
    });
    await addToSyncQueue('update', 'stop', stopId, {
      status: 'in_progress',
      arrivedAt: now,
    });

    set({
      stops: stops.map((s) =>
        s.id === stopId
          ? { ...s, status: 'in_progress', arrivedAt: now, updatedAt: now }
          : s
      ),
    });
  },

  markStopDeparted: async (stopId) => {
    const { stops } = get();
    const now = new Date();

    await db.stops.update(stopId, {
      status: 'completed',
      departedAt: now,
      updatedAt: now,
    });
    await addToSyncQueue('update', 'stop', stopId, {
      status: 'completed',
      departedAt: now,
    });

    set({
      stops: stops.map((s) =>
        s.id === stopId
          ? { ...s, status: 'completed', departedAt: now, updatedAt: now }
          : s
      ),
    });
  },

  setCurrentStopIndex: (index) => {
    set({ currentStopIndex: index });
  },

  goToNextStop: () => {
    const { stops, currentStopIndex } = get();
    const nextIndex = Math.min(currentStopIndex + 1, stops.length - 1);
    set({ currentStopIndex: nextIndex });
  },

  clearRoute: () => {
    set({
      currentRoute: null,
      stops: [],
      currentStopIndex: 0,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));
