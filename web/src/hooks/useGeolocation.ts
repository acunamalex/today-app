import { useState, useEffect, useCallback } from 'react';
import type { GeoPosition, Coordinates } from '../types';

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watch?: boolean;
}

interface UseGeolocationReturn {
  position: GeoPosition | null;
  error: string | null;
  isLoading: boolean;
  isSupported: boolean;
  requestPermission: () => Promise<boolean>;
  refresh: () => void;
}

const defaultOptions: UseGeolocationOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
  watch: false,
};

export function useGeolocation(
  options: UseGeolocationOptions = {}
): UseGeolocationReturn {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const opts = { ...defaultOptions, ...options };
  const isSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const handleSuccess = useCallback((pos: GeolocationPosition) => {
    setPosition({
      coords: {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      },
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
    });
    setError(null);
    setIsLoading(false);
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    let errorMessage = 'Unable to get location';

    switch (err.code) {
      case err.PERMISSION_DENIED:
        errorMessage = 'Location permission denied. Please enable location access.';
        break;
      case err.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable.';
        break;
      case err.TIMEOUT:
        errorMessage = 'Location request timed out.';
        break;
    }

    setError(errorMessage);
    setIsLoading(false);
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    setIsLoading(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handleSuccess(pos);
          resolve(true);
        },
        (err) => {
          handleError(err);
          resolve(false);
        },
        {
          enableHighAccuracy: opts.enableHighAccuracy,
          timeout: opts.timeout,
          maximumAge: opts.maximumAge,
        }
      );
    });
  }, [isSupported, opts.enableHighAccuracy, opts.timeout, opts.maximumAge, handleSuccess, handleError]);

  const refresh = useCallback(() => {
    if (!isSupported) return;

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: opts.enableHighAccuracy,
      timeout: opts.timeout,
      maximumAge: 0, // Force fresh position
    });
  }, [isSupported, opts.enableHighAccuracy, opts.timeout, handleSuccess, handleError]);

  // Watch position if enabled
  useEffect(() => {
    if (!isSupported || !opts.watch) return;

    setIsLoading(true);

    const watchId = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: opts.enableHighAccuracy,
        timeout: opts.timeout,
        maximumAge: opts.maximumAge,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [
    isSupported,
    opts.watch,
    opts.enableHighAccuracy,
    opts.timeout,
    opts.maximumAge,
    handleSuccess,
    handleError,
  ]);

  return {
    position,
    error,
    isLoading,
    isSupported,
    requestPermission,
    refresh,
  };
}

/**
 * Calculate distance between user's current position and a target
 */
export function useDistanceTo(target: Coordinates | null) {
  const { position } = useGeolocation({ watch: true });

  if (!position || !target) return null;

  return calculateHaversineDistance(position.coords, target);
}

/**
 * Haversine distance formula
 */
function calculateHaversineDistance(from: Coordinates, to: Coordinates): number {
  const R = 6371e3; // Earth's radius in meters
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const deltaLat = ((to.lat - from.lat) * Math.PI) / 180;
  const deltaLng = ((to.lng - from.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
