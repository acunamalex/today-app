import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Shield,
  Users,
  Trash2,
  LogOut,
  ChevronRight,
  Database,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { clearAllData } from '../db/dexie';
import {
  Button,
  Card,
  Input,
  Toggle,
  Modal,
  ConfirmModal,
} from '../components/common';

export function Settings() {
  const navigate = useNavigate();
  const [showNameModal, setShowNameModal] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [newName, setNewName] = useState('');

  const { user, updateUser, logout } = useAuthStore();
  const { addToast } = useUIStore();

  const handleUpdateName = async () => {
    if (!newName.trim()) return;

    try {
      await updateUser({ name: newName.trim() });
      setShowNameModal(false);
      setNewName('');
      addToast('Name updated', 'success');
    } catch (error) {
      addToast('Failed to update name', 'error');
    }
  };

  const handleClearData = async () => {
    try {
      await clearAllData();
      logout();
      navigate('/login');
      addToast('All data cleared', 'success');
    } catch (error) {
      addToast('Failed to clear data', 'error');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-slate-900">Settings</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Profile Section */}
        <div>
          <h2 className="text-sm font-medium text-slate-500 mb-3 px-1">
            PROFILE
          </h2>
          <Card padding="none">
            <button
              onClick={() => {
                setNewName(user?.name || '');
                setShowNameModal(true);
              }}
              className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <User className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-slate-900">Name</p>
                <p className="text-sm text-slate-500">{user?.name}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>

            <div className="border-t border-slate-100" />

            <div className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900">Role</p>
                <p className="text-sm text-slate-500 capitalize">{user?.role}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Manager Section (if manager) */}
        {user?.role === 'manager' && (
          <div>
            <h2 className="text-sm font-medium text-slate-500 mb-3 px-1">
              MANAGEMENT
            </h2>
            <Card padding="none">
              <button
                onClick={() => navigate('/manager')}
                className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-slate-900">Team Dashboard</p>
                  <p className="text-sm text-slate-500">
                    View team routes and reports
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>
            </Card>
          </div>
        )}

        {/* Data Section */}
        <div>
          <h2 className="text-sm font-medium text-slate-500 mb-3 px-1">
            DATA
          </h2>
          <Card padding="none">
            <div className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <Database className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900">Local Storage</p>
                <p className="text-sm text-slate-500">
                  Data is stored locally on this device
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            <button
              onClick={() => setShowClearDataModal(true)}
              className="w-full flex items-center gap-4 p-4 hover:bg-danger-50 transition-colors text-danger-600"
            >
              <div className="w-10 h-10 rounded-full bg-danger-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium">Clear All Data</p>
                <p className="text-sm text-danger-500">
                  This cannot be undone
                </p>
              </div>
            </button>
          </Card>
        </div>

        {/* Account Section */}
        <div>
          <h2 className="text-sm font-medium text-slate-500 mb-3 px-1">
            ACCOUNT
          </h2>
          <Card padding="none">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-slate-900">Sign Out</p>
                <p className="text-sm text-slate-500">
                  Sign out of your account
                </p>
              </div>
            </button>
          </Card>
        </div>

        {/* App Info */}
        <div className="text-center text-sm text-slate-400">
          <p>Today v1.0.0</p>
          <p className="mt-1">Route Planning Made Simple</p>
        </div>
      </main>

      {/* Edit Name Modal */}
      <Modal
        isOpen={showNameModal}
        onClose={() => setShowNameModal(false)}
        title="Edit Name"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNameModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateName} disabled={!newName.trim()}>
              Save
            </Button>
          </>
        }
      >
        <Input
          label="Your Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Enter your name"
          autoFocus
        />
      </Modal>

      {/* Clear Data Confirmation */}
      <ConfirmModal
        isOpen={showClearDataModal}
        onClose={() => setShowClearDataModal(false)}
        onConfirm={handleClearData}
        title="Clear All Data?"
        message="This will permanently delete all your routes, stops, questions, and reports. This action cannot be undone."
        confirmText="Clear All Data"
        variant="danger"
      />
    </div>
  );
}
