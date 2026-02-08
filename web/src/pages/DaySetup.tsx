import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Route,
  Map,
  Clock,
  Navigation2,
  ChevronRight,
  Settings,
  Loader2,
  Upload,
  Building2,
  Trash2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useRouteStore } from '../stores/routeStore';
import { useUIStore } from '../stores/uiStore';
import { useGeolocation } from '../hooks/useGeolocation';
import { AddressInput, StopList, RouteMap } from '../components/route';
import { ImportStops } from '../components/route/ImportStops';
import { BusinessSearch } from '../components/route/BusinessSearch';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  LoadingCard,
} from '../components/common';
import { formatRouteSummary } from '../services/routeService';
import type { GeocodingResult, Coordinates } from '../types';
import { getGreeting, formatSmartDate } from '../utils/timeCalculations';

export function DaySetup() {
  const navigate = useNavigate();
  const [addressInput, setAddressInput] = useState('');
  const [showMap, setShowMap] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBusinessSearch, setShowBusinessSearch] = useState(false);
  const [selectedStops, setSelectedStops] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const { user } = useAuthStore();
  const {
    currentRoute,
    stops,
    isLoading,
    isOptimizing,
    createRoute,
    loadTodayRoute,
    addStop,
    removeStop,
    reorderStops,
    optimizeRouteOrder,
    updateRouteStatus,
  } = useRouteStore();
  const { addToast } = useUIStore();
  const { position, requestPermission } = useGeolocation();

  // Load or create today's route
  useEffect(() => {
    let isMounted = true;

    const initRoute = async () => {
      if (!user) return;

      try {
        const existingRoute = await loadTodayRoute(user.id);
        if (!existingRoute && isMounted) {
          await createRoute(user.id);
        }
      } catch (error) {
        console.error('Failed to initialize route:', error);
      }
    };

    initRoute();

    return () => {
      isMounted = false;
    };
  }, [user?.id]); // Only depend on user.id, not functions

  // Request location permission
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  const handleAddressSelect = async (result: GeocodingResult) => {
    if (!currentRoute) return;

    try {
      await addStop(result.address, result.coordinates);
      setAddressInput('');
      addToast('Stop added', 'success');
    } catch (error) {
      addToast('Failed to add stop', 'error');
    }
  };

  const handleImportStops = async (
    importedStops: { address: string; name?: string; coordinates: Coordinates }[]
  ) => {
    if (!currentRoute) return;

    let successCount = 0;
    for (const stop of importedStops) {
      try {
        await addStop(stop.address, stop.coordinates, stop.name);
        successCount++;
      } catch (error) {
        console.error('Failed to add stop:', error);
      }
    }

    if (successCount > 0) {
      addToast(`Added ${successCount} stops`, 'success');
    }
    setShowImportModal(false);
  };

  const handleAddBusinessStop = async (
    address: string,
    name: string,
    coordinates: Coordinates
  ) => {
    if (!currentRoute) return;

    try {
      await addStop(address, coordinates, name);
      addToast(`Added ${name}`, 'success');
    } catch (error) {
      addToast('Failed to add stop', 'error');
    }
  };

  const handleRemoveStop = async (stopId: string) => {
    try {
      await removeStop(stopId);
      addToast('Stop removed', 'success');
    } catch (error) {
      addToast('Failed to remove stop', 'error');
    }
  };

  const toggleStopSelection = (stopId: string) => {
    setSelectedStops((prev) => {
      const next = new Set(prev);
      if (next.has(stopId)) {
        next.delete(stopId);
      } else {
        next.add(stopId);
      }
      return next;
    });
  };

  const selectAllStops = () => {
    if (selectedStops.size === stops.length) {
      setSelectedStops(new Set());
    } else {
      setSelectedStops(new Set(stops.map((s) => s.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedStops.size === 0) return;

    const count = selectedStops.size;
    for (const stopId of selectedStops) {
      try {
        await removeStop(stopId);
      } catch (error) {
        console.error('Failed to remove stop:', stopId, error);
      }
    }
    setSelectedStops(new Set());
    setIsSelectionMode(false);
    addToast(`Removed ${count} stops`, 'success');
  };

  const handleClearAllStops = async () => {
    if (stops.length === 0) return;

    const count = stops.length;
    for (const stop of stops) {
      try {
        await removeStop(stop.id);
      } catch (error) {
        console.error('Failed to remove stop:', stop.id, error);
      }
    }
    addToast(`Cleared all ${count} stops`, 'success');
  };

  const handleOptimize = async () => {
    if (stops.length < 2) {
      addToast('Add at least 2 stops to optimize', 'warning');
      return;
    }

    try {
      await optimizeRouteOrder(position?.coords);
      addToast('Route optimized!', 'success');
    } catch (error) {
      addToast('Failed to optimize route', 'error');
    }
  };

  const handleStartRoute = async () => {
    if (stops.length === 0) {
      addToast('Add at least one stop to start', 'warning');
      return;
    }

    try {
      await updateRouteStatus('active');
      navigate('/route');
    } catch (error) {
      addToast('Failed to start route', 'error');
    }
  };

  const routeSummary = currentRoute
    ? formatRouteSummary(currentRoute.totalDistance, currentRoute.totalDuration)
    : null;

  if (isLoading && !currentRoute) {
    return (
      <div className="min-h-screen bg-background p-4">
        <LoadingCard message="Setting up your day..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {getGreeting()}, {user?.name?.split(' ')[0]}
              </h1>
              <p className="text-sm text-slate-500">{formatSmartDate(new Date())}</p>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Settings className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Add Address */}
        <Card variant="elevated" padding="lg">
          <CardHeader
            title="Plan Your Stops"
            subtitle="Add addresses for today's visits"
          />
          <div className="mt-4">
            <AddressInput
              value={addressInput}
              onChange={setAddressInput}
              onSelect={handleAddressSelect}
              placeholder="Search for an address..."
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportModal(true)}
              leftIcon={<Upload className="w-4 h-4" />}
            >
              Import CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBusinessSearch(true)}
              leftIcon={<Building2 className="w-4 h-4" />}
            >
              Find Businesses
            </Button>
          </div>
        </Card>

        {/* Route Stats */}
        {stops.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="text-center">
              <div className="flex flex-col items-center">
                <Map className="w-5 h-5 text-primary-500 mb-1" />
                <span className="text-2xl font-bold text-slate-900">
                  {stops.length}
                </span>
                <span className="text-xs text-slate-500">Stops</span>
              </div>
            </Card>
            <Card className="text-center">
              <div className="flex flex-col items-center">
                <Navigation2 className="w-5 h-5 text-primary-500 mb-1" />
                <span className="text-2xl font-bold text-slate-900">
                  {routeSummary?.distance || '—'}
                </span>
                <span className="text-xs text-slate-500">Distance</span>
              </div>
            </Card>
            <Card className="text-center">
              <div className="flex flex-col items-center">
                <Clock className="w-5 h-5 text-primary-500 mb-1" />
                <span className="text-2xl font-bold text-slate-900">
                  {routeSummary?.duration || '—'}
                </span>
                <span className="text-xs text-slate-500">Est. Time</span>
              </div>
            </Card>
          </div>
        )}

        {/* Map Toggle & View */}
        {stops.length > 0 && (
          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="font-medium text-slate-900">Route Map</h3>
              <button
                onClick={() => setShowMap(!showMap)}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                {showMap ? 'Hide' : 'Show'}
              </button>
            </div>
            {showMap && (
              <RouteMap
                stops={stops}
                userLocation={position?.coords}
                height="250px"
              />
            )}
          </Card>
        )}

        {/* Stops List */}
        {stops.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-slate-900">
                  Today's Stops ({stops.length})
                </h3>
                {isSelectionMode && selectedStops.size > 0 && (
                  <span className="text-sm text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                    {selectedStops.size} selected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isSelectionMode ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllStops}
                      leftIcon={
                        selectedStops.size === stops.length ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )
                      }
                    >
                      {selectedStops.size === stops.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleDeleteSelected}
                      disabled={selectedStops.size === 0}
                      leftIcon={<Trash2 className="w-4 h-4" />}
                    >
                      Delete ({selectedStops.size})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsSelectionMode(false);
                        setSelectedStops(new Set());
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsSelectionMode(true)}
                      leftIcon={<CheckSquare className="w-4 h-4" />}
                    >
                      Select
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleOptimize}
                      isLoading={isOptimizing}
                      leftIcon={<Route className="w-4 h-4" />}
                    >
                      Optimize
                    </Button>
                  </>
                )}
              </div>
            </div>
            <StopList
              stops={stops}
              onReorder={reorderStops}
              onRemove={handleRemoveStop}
              isSelectionMode={isSelectionMode}
              selectedStops={selectedStops}
              onToggleSelection={toggleStopSelection}
            />
          </div>
        ) : (
          <EmptyState
            icon={Map}
            title="No stops added yet"
            description="Search for addresses above to add stops to your route"
          />
        )}

        {/* Questions Setup Link */}
        {stops.length > 0 && (
          <Card
            hoverable
            onClick={() => navigate('/questions')}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-slate-900">
                  Configure Questions
                </h3>
                <p className="text-sm text-slate-500">
                  Set up the questions you'll answer at each stop
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </div>
          </Card>
        )}

        {/* Start Route Button */}
        {stops.length > 0 && (
          <Button
            fullWidth
            size="lg"
            onClick={handleStartRoute}
            leftIcon={<Navigation2 className="w-5 h-5" />}
          >
            Start Route
          </Button>
        )}
      </main>

      {/* Import Stops Modal */}
      <ImportStops
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportStops}
      />

      {/* Business Search Modal */}
      <BusinessSearch
        isOpen={showBusinessSearch}
        onClose={() => setShowBusinessSearch(false)}
        onAddStop={handleAddBusinessStop}
        userLocation={position?.coords}
      />
    </div>
  );
}
