import type { Coordinates, GeocodingResult } from '../types';

// Using Nominatim/Overpass API (OpenStreetMap) for free business search
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

export interface BusinessResult {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  type: string;
  distance?: number; // meters from search center
  phone?: string;
  website?: string;
  openingHours?: string;
}

export interface BusinessSearchOptions {
  center: Coordinates;
  radius: number; // meters (max 50000)
  category?: BusinessCategory;
  keyword?: string; // Search by name or type keyword
  limit?: number;
}

export type BusinessCategory =
  | 'all'
  | 'restaurant'
  | 'retail'
  | 'office'
  | 'healthcare'
  | 'automotive'
  | 'financial'
  | 'accommodation'
  | 'education';

// Map categories to OSM tags
const categoryTags: Record<BusinessCategory, string> = {
  all: 'shop|office|amenity',
  restaurant: 'amenity~"restaurant|cafe|fast_food|bar"',
  retail: 'shop',
  office: 'office',
  healthcare: 'amenity~"hospital|clinic|doctors|pharmacy|dentist"',
  automotive: 'shop~"car|car_repair|car_parts"|amenity~"fuel|car_wash"',
  financial: 'amenity~"bank|atm"|office~"insurance|financial"',
  accommodation: 'tourism~"hotel|motel|hostel|guest_house"',
  education: 'amenity~"school|university|college|kindergarten"',
};

/**
 * Search for businesses near a location using OpenStreetMap Overpass API
 */
export async function searchBusinesses(
  options: BusinessSearchOptions
): Promise<BusinessResult[]> {
  const { center, radius, category = 'all', keyword, limit = 50 } = options;

  // Build Overpass query
  const tagFilter = categoryTags[category];
  const boundingRadius = Math.min(radius, 50000);

  // If keyword provided, search for name containing keyword (case-insensitive)
  let query: string;
  if (keyword && keyword.trim()) {
    const escapedKeyword = keyword.trim().replace(/"/g, '\\"');
    query = `
      [out:json][timeout:25];
      (
        node["name"~"${escapedKeyword}",i][${tagFilter}](around:${boundingRadius},${center.lat},${center.lng});
        way["name"~"${escapedKeyword}",i][${tagFilter}](around:${boundingRadius},${center.lat},${center.lng});
        node["name"~"${escapedKeyword}",i](around:${boundingRadius},${center.lat},${center.lng});
        way["name"~"${escapedKeyword}",i](around:${boundingRadius},${center.lat},${center.lng});
      );
      out center ${limit * 2};
    `;
  } else {
    query = `
      [out:json][timeout:25];
      (
        node[${tagFilter}](around:${boundingRadius},${center.lat},${center.lng});
        way[${tagFilter}](around:${boundingRadius},${center.lat},${center.lng});
      );
      out center ${limit};
    `;
  }

  try {
    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.statusText}`);
    }

    const data = await response.json();

    let results: BusinessResult[] = data.elements
      .filter((el: any) => el.tags?.name)
      .map((el: any) => {
        const lat = el.lat || el.center?.lat;
        const lng = el.lon || el.center?.lon;

        return {
          id: el.id.toString(),
          name: el.tags.name,
          address: formatOSMAddress(el.tags),
          coordinates: { lat, lng },
          type: getBusinessType(el.tags),
          distance: calculateDistance(center, { lat, lng }),
          phone: el.tags.phone || el.tags['contact:phone'],
          website: el.tags.website || el.tags['contact:website'],
          openingHours: el.tags.opening_hours,
        };
      })
      .sort((a: BusinessResult, b: BusinessResult) => (a.distance || 0) - (b.distance || 0));

    // If keyword was used, also filter by keyword in type (in case the regex didn't match perfectly)
    if (keyword && keyword.trim()) {
      const lowerKeyword = keyword.toLowerCase();
      results = results.filter(
        (r) =>
          r.name.toLowerCase().includes(lowerKeyword) ||
          r.type.toLowerCase().includes(lowerKeyword)
      );
    }

    // Deduplicate by ID and limit results
    const seen = new Set<string>();
    results = results.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    }).slice(0, limit);

    return results;
  } catch (error) {
    console.error('Business search error:', error);
    return [];
  }
}

/**
 * Search for businesses along a route
 */
export async function searchBusinessesAlongRoute(
  stops: { coordinates: Coordinates }[],
  category: BusinessCategory = 'all',
  radiusPerStop: number = 1000
): Promise<BusinessResult[]> {
  const allResults: BusinessResult[] = [];
  const seenIds = new Set<string>();

  // Search around each stop
  for (const stop of stops) {
    const results = await searchBusinesses({
      center: stop.coordinates,
      radius: radiusPerStop,
      category,
      limit: 20,
    });

    // Add unique results
    for (const result of results) {
      if (!seenIds.has(result.id)) {
        seenIds.add(result.id);
        allResults.push(result);
      }
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Sort by distance from first stop
  if (stops.length > 0) {
    allResults.sort(
      (a, b) =>
        calculateDistance(stops[0].coordinates, a.coordinates) -
        calculateDistance(stops[0].coordinates, b.coordinates)
    );
  }

  return allResults;
}

/**
 * Format OSM tags into a readable address
 */
function formatOSMAddress(tags: any): string {
  const parts: string[] = [];

  if (tags['addr:housenumber'] && tags['addr:street']) {
    parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
  } else if (tags['addr:street']) {
    parts.push(tags['addr:street']);
  }

  if (tags['addr:city']) {
    parts.push(tags['addr:city']);
  }

  if (tags['addr:state']) {
    parts.push(tags['addr:state']);
  }

  if (tags['addr:postcode']) {
    parts.push(tags['addr:postcode']);
  }

  return parts.join(', ') || 'Address not available';
}

/**
 * Get a human-readable business type from OSM tags
 */
function getBusinessType(tags: any): string {
  if (tags.amenity) {
    return formatTagValue(tags.amenity);
  }
  if (tags.shop) {
    return `${formatTagValue(tags.shop)} Shop`;
  }
  if (tags.office) {
    return `${formatTagValue(tags.office)} Office`;
  }
  if (tags.tourism) {
    return formatTagValue(tags.tourism);
  }
  return 'Business';
}

/**
 * Format OSM tag value to human-readable string
 */
function formatTagValue(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(from: Coordinates, to: Coordinates): number {
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
 * Format distance for display
 */
export function formatBusinessDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Get category options for UI
 */
export function getBusinessCategories(): { value: BusinessCategory; label: string }[] {
  return [
    { value: 'all', label: 'All Businesses' },
    { value: 'restaurant', label: 'Restaurants & Cafes' },
    { value: 'retail', label: 'Retail Stores' },
    { value: 'office', label: 'Offices' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'automotive', label: 'Automotive' },
    { value: 'financial', label: 'Financial Services' },
    { value: 'accommodation', label: 'Hotels & Lodging' },
    { value: 'education', label: 'Education' },
  ];
}
