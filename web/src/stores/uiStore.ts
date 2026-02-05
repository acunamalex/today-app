import { create } from 'zustand';
import type { ToastMessage, ModalState } from '../types';

interface UIState {
  // Toast notifications
  toasts: ToastMessage[];
  addToast: (message: string, type?: ToastMessage['type'], duration?: number) => void;
  removeToast: (id: string) => void;

  // Modal state
  modal: ModalState;
  openModal: (type: string, data?: unknown) => void;
  closeModal: () => void;

  // Sidebar/menu state
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;

  // Online status
  isOnline: boolean;
  setOnline: (isOnline: boolean) => void;

  // Loading states
  globalLoading: boolean;
  setGlobalLoading: (isLoading: boolean) => void;

  // Current view/page for mobile navigation
  currentView: 'setup' | 'route' | 'form' | 'reports' | 'manager';
  setCurrentView: (view: UIState['currentView']) => void;
}

export const useUIStore = create<UIState>()((set, get) => ({
  // Toast notifications
  toasts: [],

  addToast: (message, type = 'info', duration = 4000) => {
    const id = crypto.randomUUID();
    const toast: ToastMessage = { id, message, type, duration };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  // Modal state
  modal: { isOpen: false },

  openModal: (type, data) => {
    set({ modal: { isOpen: true, type, data } });
  },

  closeModal: () => {
    set({ modal: { isOpen: false } });
  },

  // Sidebar state
  isSidebarOpen: false,

  toggleSidebar: () => {
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
  },

  setSidebarOpen: (isOpen) => {
    set({ isSidebarOpen: isOpen });
  },

  // Online status
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

  setOnline: (isOnline) => {
    set({ isOnline });
  },

  // Loading states
  globalLoading: false,

  setGlobalLoading: (isLoading) => {
    set({ globalLoading: isLoading });
  },

  // Current view
  currentView: 'setup',

  setCurrentView: (view) => {
    set({ currentView: view });
  },
}));

// Initialize online/offline listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useUIStore.getState().setOnline(true);
    useUIStore.getState().addToast('You are back online', 'success');
  });

  window.addEventListener('offline', () => {
    useUIStore.getState().setOnline(false);
    useUIStore.getState().addToast('You are offline. Changes will sync when online.', 'warning', 6000);
  });
}
