import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/dexie';
import { useUIStore } from '../stores/uiStore';

interface SyncStatus {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  error: string | null;
}

export function useOfflineSync() {
  const [status, setStatus] = useState<SyncStatus>({
    pendingCount: 0,
    isSyncing: false,
    lastSyncTime: null,
    error: null,
  });

  const isOnline = useUIStore((state) => state.isOnline);
  const addToast = useUIStore((state) => state.addToast);

  // Count pending sync items
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await db.syncQueue.where('synced').equals(0).count();
      setStatus((prev) => ({ ...prev, pendingCount: count }));
    } catch (error) {
      console.error('Error counting pending items:', error);
    }
  }, []);

  // Sync pending items to server (placeholder for future backend)
  const syncToServer = useCallback(async () => {
    if (!isOnline) {
      setStatus((prev) => ({
        ...prev,
        error: 'Cannot sync while offline',
      }));
      return;
    }

    setStatus((prev) => ({ ...prev, isSyncing: true, error: null }));

    try {
      const pendingItems = await db.syncQueue
        .where('synced')
        .equals(0)
        .sortBy('timestamp');

      // In the future, this would sync to an actual backend
      // For now, we just mark items as synced
      for (const item of pendingItems) {
        // Simulate API call
        // await api.sync(item);

        // Mark as synced
        await db.syncQueue.update(item.id, {
          synced: true,
          attempts: item.attempts + 1,
        });
      }

      setStatus((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        pendingCount: 0,
      }));

      if (pendingItems.length > 0) {
        addToast(`Synced ${pendingItems.length} items`, 'success');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setStatus((prev) => ({
        ...prev,
        isSyncing: false,
        error: errorMessage,
      }));
      addToast('Sync failed. Will retry later.', 'error');
    }
  }, [isOnline, addToast]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && status.pendingCount > 0 && !status.isSyncing) {
      syncToServer();
    }
  }, [isOnline, status.pendingCount, status.isSyncing, syncToServer]);

  // Periodically update pending count
  useEffect(() => {
    updatePendingCount();

    const interval = setInterval(updatePendingCount, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [updatePendingCount]);

  // Clean up old synced items
  const cleanupSyncedItems = useCallback(async () => {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    try {
      await db.syncQueue
        .where('synced')
        .equals(1)
        .filter((item) => new Date(item.timestamp) < oneWeekAgo)
        .delete();
    } catch (error) {
      console.error('Error cleaning up sync queue:', error);
    }
  }, []);

  useEffect(() => {
    cleanupSyncedItems();
  }, [cleanupSyncedItems]);

  return {
    ...status,
    syncNow: syncToServer,
    refreshPendingCount: updatePendingCount,
  };
}

/**
 * Hook to detect and handle offline/online status
 */
export function useNetworkStatus() {
  const isOnline = useUIStore((state) => state.isOnline);
  const setOnline = useUIStore((state) => state.setOnline);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  return {
    isOnline,
    isOffline: !isOnline,
  };
}
