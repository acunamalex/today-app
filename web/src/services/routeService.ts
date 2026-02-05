import type { Coordinates, RouteOptimizationResult, RouteLeg } from '../types';

// OpenRouteService API - Free tier: 2,000 requests/day
const ORS_BASE_URL = 'https://api.openrouteservice.org/v2';

// You'll need to get a free API key from https://openrouteservice.org/dev/#/signup
// For now, we'll use a placeholder that should be replaced
const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY || '';

/**
 * Optimize route order using OpenRouteService
 */
export async function optimizeRoute(
  coordinates: Coordinates[]
): Promise<RouteOptimizationResult | null> {
  if (coordinates.length < 2) return null;

  // If no API key, fall back to simple optimization
  if (!ORS_API_KEY) {
    console.warn('No OpenRouteService API key found. Using basic optimization.');
    return basicOptimization(coordinates);
  }

  try {
    // For optimization, we use the optimization endpoint
    // which requires jobs and vehicles format
    const response = await fetch(`${ORS_BASE_URL}/optimization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: ORS_API_KEY,
      },
      body: JSON.stringify({
        jobs: coordinates.slice(1).map((coord, index) => ({
          id: index + 1,
          location: [coord.lng, coord.lat],
        })),
        vehicles: [
          {
            id: 1,
            profile: 'driving-car',
            start: [coordinates[0].lng, coordinates[0].lat],
            end: [coordinates[0].lng, coordinates[0].lat], // Return to start
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Route optimization failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error('No routes returned');
    }

    const route = data.routes[0];
    const orderedStops = route.steps
      .filter((step: any) => step.type === 'job')
      .map((step: any) => step.job);

    // Add starting point (index 0)
    orderedStops.unshift(0);

    return {
      orderedStops,
      totalDistance: route.distance,
      totalDuration: route.duration,
      legs: [], // ORS optimization doesn't return detailed legs
    };
  } catch (error) {
    console.error('Route optimization error:', error);
    // Fall back to basic optimization
    return basicOptimization(coordinates);
  }
}

/**
 * Get directions between waypoints
 */
export async function getDirections(
  coordinates: Coordinates[]
): Promise<{
  distance: number;
  duration: number;
  geometry: string;
  legs: RouteLeg[];
} | null> {
  if (coordinates.length < 2) return null;

  if (!ORS_API_KEY) {
    console.warn('No OpenRouteService API key found.');
    return null;
  }

  try {
    const coordsString = coordinates
      .map((c) => `${c.lng},${c.lat}`)
      .join('|');

    const response = await fetch(
      `${ORS_BASE_URL}/directions/driving-car?api_key=${ORS_API_KEY}&start=${coordinates[0].lng},${coordinates[0].lat}&end=${coordinates[coordinates.length - 1].lng},${coordinates[coordinates.length - 1].lat}`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Directions request failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return null;
    }

    const feature = data.features[0];
    const properties = feature.properties;

    return {
      distance: properties.summary.distance,
      duration: properties.summary.duration,
      geometry: JSON.stringify(feature.geometry),
      legs: properties.segments.map((segment: any, index: number) => ({
        distance: segment.distance,
        duration: segment.duration,
        startIndex: index,
        endIndex: index + 1,
      })),
    };
  } catch (error) {
    console.error('Directions error:', error);
    return null;
  }
}

/**
 * Basic nearest-neighbor optimization when API is not available
 */
function basicOptimization(
  coordinates: Coordinates[]
): RouteOptimizationResult {
  if (coordinates.length <= 2) {
    return {
      orderedStops: coordinates.map((_, i) => i),
      totalDistance: calculateTotalDistance(coordinates),
      totalDuration: estimateDuration(calculateTotalDistance(coordinates)),
      legs: [],
    };
  }

  const visited = new Set<number>();
  const order: number[] = [0]; // Start with first coordinate
  visited.add(0);

  let current = 0;
  let totalDistance = 0;

  while (visited.size < coordinates.length) {
    let nearest = -1;
    let nearestDistance = Infinity;

    for (let i = 0; i < coordinates.length; i++) {
      if (!visited.has(i)) {
        const distance = haversineDistance(
          coordinates[current],
          coordinates[i]
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = i;
        }
      }
    }

    if (nearest !== -1) {
      order.push(nearest);
      visited.add(nearest);
      totalDistance += nearestDistance;
      current = nearest;
    }
  }

  return {
    orderedStops: order,
    totalDistance,
    totalDuration: estimateDuration(totalDistance),
    legs: [],
  };
}

/**
 * Calculate total distance of a route
 */
function calculateTotalDistance(coordinates: Coordinates[]): number {
  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    total += haversineDistance(coordinates[i], coordinates[i + 1]);
  }
  return total;
}

/**
 * Haversine distance between two coordinates (in meters)
 */
function haversineDistance(from: Coordinates, to: Coordinates): number {
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

/**
 * Estimate duration based on distance (assuming 25 mph average speed in urban areas)
 */
function estimateDuration(distanceMeters: number): number {
  const avgSpeedMps = 25 * 1609.34 / 3600; // 25 mph in m/s
  return distanceMeters / avgSpeedMps;
}

/**
 * Format route summary for display
 */
export function formatRouteSummary(
  distance: number,
  duration: number
): { distance: string; duration: string } {
  const distanceMiles = distance / 1609.34;
  const durationMinutes = Math.round(duration / 60);

  let distanceStr: string;
  if (distanceMiles < 0.1) {
    const feet = distance * 3.28084;
    distanceStr = `${Math.round(feet)} ft`;
  } else {
    distanceStr = `${distanceMiles.toFixed(1)} mi`;
  }

  let durationStr: string;
  if (durationMinutes < 60) {
    durationStr = `${durationMinutes} min`;
  } else {
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    durationStr = `${hours}h ${mins}m`;
  }

  return { distance: distanceStr, duration: durationStr };
}
