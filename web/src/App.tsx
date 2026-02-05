import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useNetworkStatus } from './hooks/useOfflineSync';
import { PasscodeScreen } from './components/auth';
import { ToastContainer } from './components/common';
import { LoadingOverlay } from './components/common/LoadingSpinner';

// Pages
import { DaySetup } from './pages/DaySetup';
import { ActiveRoute } from './pages/ActiveRoute';
import { VisitForm } from './pages/VisitForm';
import { Reports } from './pages/Reports';
import { Questions } from './pages/Questions';
import { Settings } from './pages/Settings';
import { ManagerDashboard } from './pages/ManagerDashboard';

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <LoadingOverlay message="Loading..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Offline indicator
function OfflineIndicator() {
  const { isOffline } = useNetworkStatus();

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-warning-500 text-white text-center py-1 text-sm font-medium z-50">
      You're offline. Changes will sync when back online.
    </div>
  );
}

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const { checkSession, isAuthenticated } = useAuthStore();

  // Check session on app load
  useEffect(() => {
    const init = async () => {
      await checkSession();
      setIsInitialized(true);
    };
    init();
  }, [checkSession]);

  if (!isInitialized) {
    return <LoadingOverlay message="Starting Today..." />;
  }

  // Get base path for GitHub Pages deployment
  const basename = import.meta.env.BASE_URL || '/';

  return (
    <BrowserRouter basename={basename}>
      <div className="min-h-screen bg-background">
        <OfflineIndicator />
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <PasscodeScreen />
            }
          />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DaySetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/route"
            element={
              <ProtectedRoute>
                <ActiveRoute />
              </ProtectedRoute>
            }
          />
          <Route
            path="/visit/:stopId"
            element={
              <ProtectedRoute>
                <VisitForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/questions"
            element={
              <ProtectedRoute>
                <Questions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager"
            element={
              <ProtectedRoute>
                <ManagerDashboard />
              </ProtectedRoute>
            }
          />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Global toast notifications */}
        <ToastContainer />
      </div>
    </BrowserRouter>
  );
}

export default App;
