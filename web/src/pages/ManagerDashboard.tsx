import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  ArrowLeft,
  Users,
  MapPin,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Eye,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { db } from '../db/dexie';
import { RouteMap } from '../components/route';
import {
  Button,
  Card,
  CardHeader,
  Badge,
  StatusBadge,
  EmptyState,
  LoadingCard,
  Select,
} from '../components/common';
import type { User, Route, DayReport, Stop } from '../types';
import { formatSmartDate, getTodayString, formatDuration } from '../utils/timeCalculations';

interface WorkerSummary {
  user: User;
  todayRoute?: Route;
  todayStops?: Stop[];
  completedStops: number;
  totalStops: number;
  lastReport?: DayReport;
}

export function ManagerDashboard() {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<WorkerSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(getTodayString());
  const [refreshKey, setRefreshKey] = useState(0);

  const { user } = useAuthStore();
  const { addToast } = useUIStore();

  // Load team data
  useEffect(() => {
    const loadTeamData = async () => {
      if (!user || user.role !== 'manager') return;

      setIsLoading(true);

      try {
        // Get all workers (in a real app, this would filter by manager's team)
        const allUsers = await db.users
          .where('role')
          .equals('worker')
          .toArray();

        const workerSummaries: WorkerSummary[] = await Promise.all(
          allUsers.map(async (worker) => {
            // Get today's route
            const todayRoute = await db.routes
              .where({ userId: worker.id, date: dateFilter })
              .first();

            let todayStops: Stop[] = [];
            let completedStops = 0;
            let totalStops = 0;

            if (todayRoute) {
              todayStops = await db.stops
                .where({ routeId: todayRoute.id })
                .sortBy('order');

              totalStops = todayStops.length;
              completedStops = todayStops.filter(
                (s) => s.status === 'completed'
              ).length;
            }

            // Get latest report
            const lastReport = await db.dayReports
              .where({ userId: worker.id })
              .reverse()
              .first();

            return {
              user: worker,
              todayRoute,
              todayStops,
              completedStops,
              totalStops,
              lastReport,
            };
          })
        );

        setWorkers(workerSummaries);
      } catch (error) {
        console.error('Error loading team data:', error);
        addToast('Failed to load team data', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadTeamData();
  }, [user, dateFilter, refreshKey, addToast]);

  // Calculate team stats
  const teamStats = {
    totalWorkers: workers.length,
    activeWorkers: workers.filter((w) => w.todayRoute?.status === 'active').length,
    totalStopsToday: workers.reduce((sum, w) => sum + w.totalStops, 0),
    completedStopsToday: workers.reduce((sum, w) => sum + w.completedStops, 0),
    avgCompletionRate:
      workers.length > 0
        ? workers.reduce((sum, w) => {
            if (w.totalStops === 0) return sum;
            return sum + (w.completedStops / w.totalStops) * 100;
          }, 0) / workers.filter((w) => w.totalStops > 0).length || 0
        : 0,
  };

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (user?.role !== 'manager') {
    return (
      <div className="min-h-screen bg-background p-4">
        <EmptyState
          icon={Users}
          title="Access Denied"
          description="This page is only available for managers"
          action={{
            label: 'Go Back',
            onClick: () => navigate('/'),
          }}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <LoadingCard message="Loading team data..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-lg hover:bg-slate-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-slate-900">Team Dashboard</h1>
              <p className="text-xs text-slate-500">
                Manage your team's routes
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Date Filter */}
        <div className="flex items-center gap-4">
          <Calendar className="w-5 h-5 text-slate-400" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <span className="text-sm text-slate-500">
            {formatSmartDate(dateFilter)}
          </span>
        </div>

        {/* Team Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center">
            <Users className="w-6 h-6 text-primary-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-900">
              {teamStats.totalWorkers}
            </p>
            <p className="text-xs text-slate-500">Total Workers</p>
          </Card>
          <Card className="text-center">
            <MapPin className="w-6 h-6 text-success-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-900">
              {teamStats.activeWorkers}
            </p>
            <p className="text-xs text-slate-500">Active Now</p>
          </Card>
          <Card className="text-center">
            <CheckCircle className="w-6 h-6 text-primary-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-900">
              {teamStats.completedStopsToday}/{teamStats.totalStopsToday}
            </p>
            <p className="text-xs text-slate-500">Stops Completed</p>
          </Card>
          <Card className="text-center">
            <TrendingUp className="w-6 h-6 text-success-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-900">
              {teamStats.avgCompletionRate.toFixed(0)}%
            </p>
            <p className="text-xs text-slate-500">Avg. Completion</p>
          </Card>
        </div>

        {/* Team Map View (showing all active workers) */}
        {workers.some((w) => w.todayRoute?.status === 'active') && (
          <Card padding="none" className="overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="font-medium text-slate-900">Live Route View</h3>
              <p className="text-xs text-slate-500">
                Active workers and their stops
              </p>
            </div>
            <RouteMap
              stops={workers
                .filter((w) => w.todayStops && w.todayStops.length > 0)
                .flatMap((w) => w.todayStops || [])}
              height="300px"
            />
          </Card>
        )}

        {/* Workers List */}
        <div>
          <h3 className="font-semibold text-slate-900 mb-3">Team Members</h3>
          {workers.length > 0 ? (
            <div className="space-y-3">
              {workers.map((worker) => (
                <Card
                  key={worker.user.id}
                  hoverable
                  onClick={() => setSelectedWorker(worker)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary-600">
                        {worker.user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-slate-900">
                          {worker.user.name}
                        </h4>
                        {worker.todayRoute && (
                          <StatusBadge status={worker.todayRoute.status} size="sm" />
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {worker.todayRoute
                          ? `${worker.completedStops}/${worker.totalStops} stops completed`
                          : 'No route scheduled'}
                      </p>
                    </div>

                    {/* Progress */}
                    {worker.totalStops > 0 && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">
                          {Math.round(
                            (worker.completedStops / worker.totalStops) * 100
                          )}
                          %
                        </p>
                        <p className="text-xs text-slate-500">complete</p>
                      </div>
                    )}

                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>

                  {/* Progress bar */}
                  {worker.totalStops > 0 && (
                    <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full transition-all duration-300',
                          worker.completedStops === worker.totalStops
                            ? 'bg-success-500'
                            : 'bg-primary-500'
                        )}
                        style={{
                          width: `${(worker.completedStops / worker.totalStops) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="No Team Members"
              description="Workers will appear here once they create accounts"
            />
          )}
        </div>

        {/* Worker Detail Modal */}
        {selectedWorker && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4"
            onClick={() => setSelectedWorker(null)}
          >
            <div
              className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg max-h-[80vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary-600">
                      {selectedWorker.user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {selectedWorker.user.name}
                    </h2>
                    <p className="text-slate-500">
                      {selectedWorker.user.email || 'No email'}
                    </p>
                  </div>
                </div>

                {/* Today's Route */}
                {selectedWorker.todayRoute ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-slate-900">Today's Route</h3>
                      <StatusBadge status={selectedWorker.todayRoute.status} />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <p className="text-xl font-bold text-slate-900">
                          {selectedWorker.totalStops}
                        </p>
                        <p className="text-xs text-slate-500">Total Stops</p>
                      </div>
                      <div className="text-center p-3 bg-success-50 rounded-lg">
                        <p className="text-xl font-bold text-success-700">
                          {selectedWorker.completedStops}
                        </p>
                        <p className="text-xs text-success-600">Completed</p>
                      </div>
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <p className="text-xl font-bold text-slate-900">
                          {(
                            selectedWorker.todayRoute.totalDistance / 1000
                          ).toFixed(1)}
                          km
                        </p>
                        <p className="text-xs text-slate-500">Distance</p>
                      </div>
                    </div>

                    {/* Stop list */}
                    {selectedWorker.todayStops &&
                      selectedWorker.todayStops.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-slate-700">
                            Stops
                          </h4>
                          {selectedWorker.todayStops.map((stop, index) => (
                            <div
                              key={stop.id}
                              className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg text-sm"
                            >
                              <div
                                className={clsx(
                                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                                  stop.status === 'completed'
                                    ? 'bg-success-500 text-white'
                                    : stop.status === 'in_progress'
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-slate-200 text-slate-600'
                                )}
                              >
                                {index + 1}
                              </div>
                              <span className="flex-1 truncate">
                                {stop.name || stop.address}
                              </span>
                              <StatusBadge status={stop.status} size="sm" />
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500">No route scheduled for today</p>
                  </div>
                )}

                {/* Last Report Summary */}
                {selectedWorker.lastReport && (
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <h4 className="text-sm font-medium text-slate-700 mb-2">
                      Last Report - {formatSmartDate(selectedWorker.lastReport.date)}
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Stops:</span>
                        <span className="font-medium">
                          {selectedWorker.lastReport.summary.completedStops}/
                          {selectedWorker.lastReport.summary.totalStops}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Distance:</span>
                        <span className="font-medium">
                          {selectedWorker.lastReport.summary.totalDistance.toFixed(
                            1
                          )}
                          km
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  fullWidth
                  variant="outline"
                  onClick={() => setSelectedWorker(null)}
                  className="mt-6"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
