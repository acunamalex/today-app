import type { GeocodingResult, Coordinates } from '../types';

// Nominatim API (OpenStreetMap) - Free, 1 request/second limit
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds to be safe

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();
  return fetch(url, {
    headers: {
      'User-Agent': 'TodayApp/1.0 (Route Planning App)',
    },
  });
}

/**
 * Search for addresses matching a query
 */
export async function searchAddresses(
  query: string,
  limit = 5
): Promise<GeocodingResult[]> {
  if (!query.trim()) return [];

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: limit.toString(),
    });

    const response = await rateLimitedFetch(
      `${NOMINATIM_BASE_URL}/search?${params}`
    );

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();

    return data.map((item: any) => ({
      address: formatAddress(item),
      displayName: item.display_name,
      coordinates: {
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      },
      type: item.type,
      importance: item.importance,
    }));
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
}

/**
 * Reverse geocode coordinates to an address
 */
export async function reverseGeocode(
  coordinates: Coordinates
): Promise<GeocodingResult | null> {
  try {
    const params = new URLSearchParams({
      lat: coordinates.lat.toString(),
      lon: coordinates.lng.toString(),
      format: 'json',
      addressdetails: '1',
    });

    const response = await rateLimitedFetch(
      `${NOMINATIM_BASE_URL}/reverse?${params}`
    );

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      return null;
    }

    return {
      address: formatAddress(data),
      displayName: data.display_name,
      coordinates: {
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lon),
      },
      type: data.type,
      importance: data.importance || 0,
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Format address from Nominatim response
 */
function formatAddress(item: any): string {
  const address = item.address || {};

  // Try to build a concise address
  const parts: string[] = [];

  // Street address
  if (address.house_number && address.road) {
    parts.push(`${address.house_number} ${address.road}`);
  } else if (address.road) {
    parts.push(address.road);
  } else if (item.name) {
    parts.push(item.name);
  }

  // City
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county;
  if (city) {
    parts.push(city);
  }

  // State
  if (address.state) {
    parts.push(address.state);
  }

  // Postal code
  if (address.postcode) {
    parts.push(address.postcode);
  }

  return parts.join(', ') || item.display_name;
}

/**
 * Get coordinates for a specific address
 */
export async function getCoordinates(
  address: string
): Promise<Coordinates | null> {
  const results = await searchAddresses(address, 1);
  return results.length > 0 ? results[0].coordinates : null;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(
  from: Coordinates,
  to: Coordinates
): number {
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

  return R * c; // Distance in meters
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
