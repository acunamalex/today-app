import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Session } from '../types';
import { db, initializeDefaultQuestions } from '../db/dexie';

// Simple hash function for passcode (in production, use a proper crypto library)
async function hashPasscode(passcode: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(passcode + 'today-app-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;

  // Actions
  createUser: (name: string, passcode: string, role: 'worker' | 'manager') => Promise<void>;
  login: (passcode: string) => Promise<boolean>;
  logout: () => void;
  checkSession: () => Promise<boolean>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,

      createUser: async (name, passcode, role) => {
        set({ isLoading: true, error: null });

        try {
          const hashedPasscode = await hashPasscode(passcode);

          const newUser: User = {
            id: crypto.randomUUID(),
            name,
            passcode: hashedPasscode,
            role,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await db.users.add(newUser);

          // Initialize default question templates for the new user
          await initializeDefaultQuestions(newUser.id);

          const session: Session = {
            userId: newUser.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          };

          set({
            user: newUser,
            session,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create user',
            isLoading: false,
          });
          throw error;
        }
      },

      login: async (passcode) => {
        set({ isLoading: true, error: null });

        try {
          const hashedPasscode = await hashPasscode(passcode);
          const users = await db.users.toArray();
          const user = users.find((u) => u.passcode === hashedPasscode);

          if (!user) {
            set({
              error: 'Invalid passcode',
              isLoading: false,
              isAuthenticated: false,
            });
            return false;
          }

          const session: Session = {
            userId: user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          };

          set({
            user,
            session,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to login',
            isLoading: false,
            isAuthenticated: false,
          });
          return false;
        }
      },

      logout: () => {
        set({
          user: null,
          session: null,
          isAuthenticated: false,
          error: null,
        });
      },

      checkSession: async () => {
        const { session } = get();

        if (!session) {
          set({ isAuthenticated: false });
          return false;
        }

        if (new Date(session.expiresAt) < new Date()) {
          set({
            user: null,
            session: null,
            isAuthenticated: false,
          });
          return false;
        }

        try {
          const user = await db.users.get(session.userId);
          if (!user) {
            set({
              user: null,
              session: null,
              isAuthenticated: false,
            });
            return false;
          }

          set({ user, isAuthenticated: true });
          return true;
        } catch {
          set({ isAuthenticated: false });
          return false;
        }
      },

      updateUser: async (updates) => {
        const { user } = get();
        if (!user) throw new Error('No user logged in');

        const updatedUser = {
          ...user,
          ...updates,
          updatedAt: new Date(),
        };

        await db.users.update(user.id, updatedUser);
        set({ user: updatedUser });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'today-auth-storage',
      partialize: (state) => ({
        session: state.session,
      }),
    }
  )
);

// Check if any users exist (for determining first-time setup)
export async function hasExistingUsers(): Promise<boolean> {
  const count = await db.users.count();
  return count > 0;
}
