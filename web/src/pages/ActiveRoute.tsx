import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  MapPin,
  ChevronUp,
  ChevronDown,
  Navigation,
  CheckCircle,
  XCircle,
  Clock,
  Flag,
  ArrowLeft,
  Send,
  Home,
  FileText,
  Mail,
  Copy,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useRouteStore } from '../stores/routeStore';
import { useUIStore } from '../stores/uiStore';
import { useGeolocation } from '../hooks/useGeolocation';
import { RouteMap } from '../components/route';
import { Button, Card, StatusBadge, ConfirmModal, Modal, Input } from '../components/common';
import { useReportStore } from '../stores/reportStore';
import {
  shareExecutiveSummaryViaEmail,
  copyExecutiveSummaryToClipboard,
} from '../services/exportService';
import {
  sendExecutiveSummaryEmail,
  isEmailConfigured,
} from '../services/emailService';
import { formatDuration, formatDistance } from '../services/geocodeService';
import type { Stop } from '../types';

export function ActiveRoute() {
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showRouteCompletedModal, setShowRouteCompletedModal] = useState(false);
  const [isSendingSummary, setIsSendingSummary] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);

  const { user } = useAuthStore();
  const {
    currentRoute,
    stops,
    currentStopIndex,
    loadTodayRoute,
    setCurrentStopIndex,
    markStopArrived,
    markStopDeparted,
    updateStopStatus,
    updateRouteStatus,
    goToNextStop,
  } = useRouteStore();
  const { addToast } = useUIStore();
  const { position } = useGeolocation({ watch: true });
  const { currentReport, generateReport } = useReportStore();

  // Load today's route
  useEffect(() => {
    if (user && !currentRoute) {
      loadTodayRoute(user.id);
    }
  }, [user, currentRoute, loadTodayRoute]);

  // Redirect if no active route
  useEffect(() => {
    if (currentRoute && currentRoute.status !== 'active') {
      if (currentRoute.status === 'completed') {
        navigate('/reports');
      } else {
        navigate('/');
      }
    }
  }, [currentRoute, navigate]);

  const currentStop = stops[currentStopIndex];
  const completedStops = stops.filter((s) => s.status === 'completed').length;
  const progress = stops.length > 0 ? (completedStops / stops.length) * 100 : 0;

  const handleArrived = async () => {
    if (!currentStop) return;

    try {
      await markStopArrived(currentStop.id);
      navigate(`/visit/${currentStop.id}`);
    } catch (error) {
      addToast('Failed to mark arrival', 'error');
    }
  };

  const handleSkipStop = async () => {
    if (!currentStop) return;

    try {
      await updateStopStatus(currentStop.id, 'skipped');
      goToNextStop();
      setShowSkipModal(false);
      addToast('Stop skipped', 'warning');
    } catch (error) {
      addToast('Failed to skip stop', 'error');
    }
  };

  const handleCompleteRoute = async () => {
    try {
      await updateRouteStatus('completed');
      setShowCompleteModal(false);

      // Generate the report
      if (currentRoute) {
        await generateReport(currentRoute.id);
      }

      // Show the route completed modal with options
      setShowRouteCompletedModal(true);
    } catch (error) {
      addToast('Failed to complete route', 'error');
    }
  };

  const handleSendSummary = async () => {
    if (!currentReport) {
      addToast('Report not ready yet', 'warning');
      return;
    }

    // If email service is configured and we have an email, send directly
    if (isEmailConfigured() && recipientEmail) {
      setIsSendingSummary(true);
      try {
        const result = await sendExecutiveSummaryEmail(currentReport, recipientEmail);
        if (result.success) {
          addToast(result.message, 'success');
          setShowEmailInput(false);
          setRecipientEmail('');
        } else {
          addToast(result.message, 'error');
        }
      } catch (error) {
        addToast('Failed to send summary', 'error');
      } finally {
        setIsSendingSummary(false);
      }
    } else {
      // Fall back to email client
      shareExecutiveSummaryViaEmail(currentReport, recipientEmail);
      addToast('Opening email client...', 'success');
    }
  };

  const handleOpenEmailClient = () => {
    if (!currentReport) {
      addToast('Report not ready yet', 'warning');
      return;
    }
    shareExecutiveSummaryViaEmail(currentReport, recipientEmail);
    addToast('Opening email client...', 'success');
  };

  const handleCopySummary = async () => {
    if (!currentReport) {
      addToast('Report not ready yet', 'warning');
      return;
    }

    const success = await copyExecutiveSummaryToClipboard(currentReport);
    if (success) {
      addToast('Summary copied to clipboard!', 'success');
    } else {
      addToast('Failed to copy summary', 'error');
    }
  };

  const handleOpenNavigation = () => {
    if (!currentStop) return;

    const { lat, lng } = currentStop.coordinates;
    // Open in default maps app
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const allStopsCompleted = stops.every(
    (s) => s.status === 'completed' || s.status === 'skipped'
  );

  // Handle loading state
  if (!currentRoute) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-slate-500">Loading route...</p>
      </div>
    );
  }

  // Handle case when all stops are done but no current stop selected
  if (!currentStop && stops.length > 0) {
    // Find the last stop to display or show completion screen
    const lastStop = stops[stops.length - 1];
    if (allStopsCompleted) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
          <div className="w-20 h-20 rounded-full bg-success-100 flex items-center justify-center mb-6">
            <CheckCircle className="w-12 h-12 text-success-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Route Complete!</h1>
          <p className="text-slate-600 mb-8 text-center">
            You've completed {completedStops} of {stops.length} stops today.
          </p>
          <div className="space-y-3 w-full max-w-xs">
            <Button
              fullWidth
              onClick={() => setShowCompleteModal(true)}
              leftIcon={<Flag className="w-4 h-4" />}
            >
              Finish & Send Summary
            </Button>
            <Button
              fullWidth
              variant="outline"
              onClick={() => navigate('/reports')}
              leftIcon={<FileText className="w-4 h-4" />}
            >
              View Report
            </Button>
            <Button
              fullWidth
              variant="ghost"
              onClick={() => navigate('/')}
              leftIcon={<Home className="w-4 h-4" />}
            >
              Back to Home
            </Button>
          </div>

          {/* Complete route modal */}
          <ConfirmModal
            isOpen={showCompleteModal}
            onClose={() => setShowCompleteModal(false)}
            onConfirm={handleCompleteRoute}
            title="Complete Route?"
            message="Great work! Ready to generate your daily report and send the summary?"
            confirmText="Complete & Send Summary"
          />

          {/* Route Completed Modal */}
          <Modal
            isOpen={showRouteCompletedModal}
            onClose={() => {}}
            title="Route Complete!"
            size="sm"
          >
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-success-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Great Work Today!
                </h3>
                <p className="text-slate-600 text-sm">
                  You completed {completedStops} of {stops.length} stops.
                </p>
              </div>

              <div className="space-y-3">
                {/* Email input section */}
                <div className="space-y-2">
                  <Input
                    label="Recipient Email"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="manager@company.com"
                  />

                  <Button
                    fullWidth
                    onClick={handleSendSummary}
                    isLoading={isSendingSummary}
                    leftIcon={<Send className="w-4 h-4" />}
                    disabled={!recipientEmail || !recipientEmail.includes('@')}
                  >
                    {isEmailConfigured() ? 'Send Email Directly' : 'Send via Email Client'}
                  </Button>

                  {!isEmailConfigured() && (
                    <p className="text-xs text-slate-400 text-center">
                      Opens your default email app
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-3 space-y-2">
                  <Button
                    fullWidth
                    variant="outline"
                    onClick={handleCopySummary}
                    leftIcon={<Copy className="w-4 h-4" />}
                  >
                    Copy Summary to Clipboard
                  </Button>

                  <Button
                    fullWidth
                    variant="outline"
                    onClick={() => {
                      setShowRouteCompletedModal(false);
                      navigate('/reports');
                    }}
                    leftIcon={<FileText className="w-4 h-4" />}
                  >
                    View Full Report
                  </Button>

                  <Button
                    fullWidth
                    variant="ghost"
                    onClick={() => {
                      setShowRouteCompletedModal(false);
                      navigate('/');
                    }}
                    leftIcon={<Home className="w-4 h-4" />}
                  >
                    Back to Home
                  </Button>
                </div>
              </div>
            </div>
          </Modal>
        </div>
      );
    }
  }

  // If still no current stop, show loading
  if (!currentStop) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-slate-500">Loading route...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-20">
        <button
          onClick={() => navigate('/')}
          className="p-2 -ml-2 rounded-lg hover:bg-slate-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="font-semibold text-slate-900">Active Route</h1>
          <p className="text-xs text-slate-500">
            {completedStops} of {stops.length} stops
          </p>
        </div>
        <button
          onClick={() => setShowCompleteModal(true)}
          className="p-2 -mr-2 rounded-lg hover:bg-slate-100 text-primary-600"
        >
          <Flag className="w-5 h-5" />
        </button>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-slate-200">
        <div
          className="h-full bg-primary-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <RouteMap
          stops={stops}
          userLocation={position?.coords}
          onStopClick={(stopId) => {
            const index = stops.findIndex((s) => s.id === stopId);
            if (index >= 0) setCurrentStopIndex(index);
          }}
          height="100%"
          className="rounded-none border-none"
        />

        {/* Stop selector pills */}
        <div className="absolute top-4 left-4 right-4 flex gap-2 overflow-x-auto pb-2">
          {stops.map((stop, index) => (
            <button
              key={stop.id}
              onClick={() => setCurrentStopIndex(index)}
              className={clsx(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                index === currentStopIndex
                  ? 'bg-primary-600 text-white shadow-lg'
                  : stop.status === 'completed'
                  ? 'bg-success-100 text-success-700'
                  : stop.status === 'skipped'
                  ? 'bg-warning-100 text-warning-700'
                  : 'bg-white text-slate-700 shadow'
              )}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom drawer */}
      <div
        className={clsx(
          'bg-white border-t border-slate-200 transition-all duration-300',
          isDrawerOpen ? 'max-h-[50vh]' : 'max-h-24'
        )}
      >
        {/* Drawer handle */}
        <button
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className="w-full py-2 flex items-center justify-center"
        >
          {isDrawerOpen ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {/* Current stop info */}
        <div className="px-4 pb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center">
                  {currentStopIndex + 1}
                </span>
                <StatusBadge status={currentStop.status} />
              </div>
              {currentStop.name && (
                <h2 className="text-lg font-semibold text-slate-900">
                  {currentStop.name}
                </h2>
              )}
              <p className="text-slate-600 flex items-center gap-1">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                {currentStop.address}
              </p>
            </div>
          </div>

          {isDrawerOpen && (
            <>
              {/* Time info */}
              {currentStop.arrivedAt && (
                <div className="flex items-center gap-4 mb-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Arrived:{' '}
                    {new Date(currentStop.arrivedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                {currentStop.status === 'pending' && (
                  <>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handleOpenNavigation}
                        leftIcon={<Navigation className="w-4 h-4" />}
                        className="flex-1"
                      >
                        Navigate
                      </Button>
                      <Button
                        onClick={handleArrived}
                        leftIcon={<CheckCircle className="w-4 h-4" />}
                        className="flex-1"
                      >
                        I've Arrived
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      fullWidth
                      onClick={() => setShowSkipModal(true)}
                      leftIcon={<XCircle className="w-4 h-4" />}
                    >
                      Skip This Stop
                    </Button>
                  </>
                )}

                {currentStop.status === 'in_progress' && (
                  <Button
                    fullWidth
                    onClick={() => navigate(`/visit/${currentStop.id}`)}
                  >
                    Continue Visit Form
                  </Button>
                )}

                {(currentStop.status === 'completed' ||
                  currentStop.status === 'skipped') && (
                  <div className="text-center py-4">
                    <p className="text-slate-500 mb-3">
                      This stop has been{' '}
                      {currentStop.status === 'completed' ? 'completed' : 'skipped'}
                    </p>
                    {currentStopIndex < stops.length - 1 ? (
                      <Button onClick={goToNextStop}>Go to Next Stop</Button>
                    ) : (
                      <Button onClick={() => setShowCompleteModal(true)}>
                        Complete Route
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Skip confirmation modal */}
      <ConfirmModal
        isOpen={showSkipModal}
        onClose={() => setShowSkipModal(false)}
        onConfirm={handleSkipStop}
        title="Skip This Stop?"
        message="This stop will be marked as skipped and you'll move to the next one."
        confirmText="Skip Stop"
        variant="danger"
      />

      {/* Complete route modal */}
      <ConfirmModal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        onConfirm={handleCompleteRoute}
        title="Complete Route?"
        message={
          allStopsCompleted
            ? 'Great work! Ready to generate your daily report?'
            : `You still have ${stops.length - completedStops} stop(s) remaining. Complete the route anyway?`
        }
        confirmText="Complete & View Report"
      />

      {/* Route Completed Modal */}
      <Modal
        isOpen={showRouteCompletedModal}
        onClose={() => {}}
        title="Route Complete!"
        size="sm"
      >
        <div className="space-y-4">
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-success-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Great Work Today!
            </h3>
            <p className="text-slate-600 text-sm">
              You completed {completedStops} of {stops.length} stops.
            </p>
          </div>

          <div className="space-y-3">
            {/* Email input section */}
            <div className="space-y-2">
              <Input
                label="Recipient Email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="manager@company.com"
              />

              <Button
                fullWidth
                onClick={handleSendSummary}
                isLoading={isSendingSummary}
                leftIcon={<Send className="w-4 h-4" />}
                disabled={!recipientEmail || !recipientEmail.includes('@')}
              >
                {isEmailConfigured() ? 'Send Email Directly' : 'Send via Email Client'}
              </Button>

              {!isEmailConfigured() && (
                <p className="text-xs text-slate-400 text-center">
                  Opens your default email app
                </p>
              )}
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-2">
              <Button
                fullWidth
                variant="outline"
                onClick={handleCopySummary}
                leftIcon={<Copy className="w-4 h-4" />}
              >
                Copy Summary to Clipboard
              </Button>

              <Button
                fullWidth
                variant="outline"
                onClick={() => {
                  setShowRouteCompletedModal(false);
                  navigate('/reports');
                }}
                leftIcon={<FileText className="w-4 h-4" />}
              >
                View Full Report
              </Button>

              <Button
                fullWidth
                variant="ghost"
                onClick={() => {
                  setShowRouteCompletedModal(false);
                  navigate('/');
                }}
                leftIcon={<Home className="w-4 h-4" />}
              >
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
