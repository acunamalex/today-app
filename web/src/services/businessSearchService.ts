import type { Coordinates } from '../types';

// Using multiple free APIs for business search
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const GOOGLE_PLACES_API = 'https://maps.googleapis.com/maps/api/place';

// Google Places API key (optional - enhances search results)
const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';

export interface BusinessResult {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  type: string;
  distance?: number;
  phone?: string;
  website?: string;
  openingHours?: string;
}

export interface BusinessSearchOptions {
  center: Coordinates;
  radius: number;
  category?: BusinessCategory;
  keyword?: string;
  limit?: number;
}

export type BusinessCategory =
  | 'all'
  | 'restaurant'
  | 'retail'
  | 'electronics'
  | 'wireless'
  | 'office'
  | 'healthcare'
  | 'automotive'
  | 'financial'
  | 'accommodation'
  | 'education'
  | 'services';

/**
 * Search for businesses using Nominatim (OpenStreetMap) - better for keyword search
 */
async function searchWithNominatim(
  keyword: string,
  center: Coordinates,
  radius: number,
  limit: number
): Promise<BusinessResult[]> {
  // Calculate viewbox from center and radius
  const latDelta = (radius / 111320);
  const lngDelta = (radius / (111320 * Math.cos(center.lat * Math.PI / 180)));

  const viewbox = [
    center.lng - lngDelta,
    center.lat + latDelta,
    center.lng + lngDelta,
    center.lat - latDelta,
  ].join(',');

  const params = new URLSearchParams({
    q: keyword,
    format: 'json',
    addressdetails: '1',
    extratags: '1',
    namedetails: '1',
    viewbox: viewbox,
    bounded: '1',
    limit: String(Math.min(limit * 2, 50)),
  });

  try {
    const response = await fetch(`${NOMINATIM_SEARCH}?${params}`, {
      headers: {
        'User-Agent': 'TodayRouteApp/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.statusText}`);
    }

    const data = await response.json();

    return data
      .filter((item: any) => {
        // Filter to only include businesses (not residential, highways, etc.)
        const itemClass = item.class || '';
        const itemType = item.type || '';
        const excludeClasses = ['highway', 'boundary', 'place', 'natural', 'waterway', 'landuse'];
        const excludeTypes = ['residential', 'house', 'apartments', 'suburb', 'neighbourhood'];
        return !excludeClasses.includes(itemClass) && !excludeTypes.includes(itemType);
      })
      .map((item: any) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);

        return {
          id: `nom-${item.place_id}`,
          name: item.namedetails?.name || item.display_name.split(',')[0],
          address: formatNominatimAddress(item),
          coordinates: { lat, lng },
          type: formatTagValue(item.type || item.class || 'Business'),
          distance: calculateDistance(center, { lat, lng }),
          phone: item.extratags?.phone || item.extratags?.['contact:phone'],
          website: item.extratags?.website || item.extratags?.['contact:website'],
          openingHours: item.extratags?.opening_hours,
        };
      })
      .filter((r: BusinessResult) => (r.distance || 0) <= radius)
      .slice(0, limit);
  } catch (error) {
    console.error('Nominatim search error:', error);
    return [];
  }
}

/**
 * Search for businesses using Google Places API (much better results)
 */
async function searchWithGooglePlaces(
  keyword: string,
  center: Coordinates,
  radius: number,
  limit: number
): Promise<BusinessResult[]> {
  if (!GOOGLE_PLACES_KEY) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      location: `${center.lat},${center.lng}`,
      radius: String(Math.min(radius, 50000)),
      keyword: keyword,
      type: 'store|electronics_store|shopping_mall',
      key: GOOGLE_PLACES_KEY,
    });

    const response = await fetch(
      `${GOOGLE_PLACES_API}/nearbysearch/json?${params}`
    );

    if (!response.ok) {
      throw new Error(`Google Places error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data.status, data.error_message);
      return [];
    }

    return (data.results || [])
      .filter((place: any) => place.business_status === 'OPERATIONAL')
      .slice(0, limit)
      .map((place: any) => ({
        id: `gp-${place.place_id}`,
        name: place.name,
        address: place.vicinity || place.formatted_address || '',
        coordinates: {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
        },
        type: formatGooglePlaceType(place.types),
        distance: calculateDistance(center, {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
        }),
        openingHours: place.opening_hours?.open_now ? 'Open now' : undefined,
      }));
  } catch (error) {
    console.error('Google Places search error:', error);
    return [];
  }
}

function formatGooglePlaceType(types: string[]): string {
  const typeMap: Record<string, string> = {
    electronics_store: 'Electronics Store',
    mobile_phone_store: 'Mobile Phone Store',
    store: 'Store',
    shopping_mall: 'Shopping Mall',
    point_of_interest: 'Business',
    establishment: 'Business',
  };

  for (const t of types) {
    if (typeMap[t]) return typeMap[t];
  }
  return 'Business';
}

/**
 * Search for businesses using Overpass API with improved query
 */
async function searchWithOverpass(
  options: BusinessSearchOptions
): Promise<BusinessResult[]> {
  const { center, radius, category = 'all', keyword, limit = 50 } = options;
  const boundingRadius = Math.min(radius, 50000);

  let query: string;

  if (keyword && keyword.trim()) {
    // Keyword search - search across all name tags
    const escapedKeyword = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query = `
      [out:json][timeout:30];
      (
        node["name"~"${escapedKeyword}",i](around:${boundingRadius},${center.lat},${center.lng});
        way["name"~"${escapedKeyword}",i](around:${boundingRadius},${center.lat},${center.lng});
        node["brand"~"${escapedKeyword}",i](around:${boundingRadius},${center.lat},${center.lng});
        way["brand"~"${escapedKeyword}",i](around:${boundingRadius},${center.lat},${center.lng});
      );
      out center ${limit * 2};
    `;
  } else {
    // Category-based search
    const categoryQueries = getCategoryQuery(category);
    query = `
      [out:json][timeout:30];
      (
        ${categoryQueries.map(q => `node${q}(around:${boundingRadius},${center.lat},${center.lng});`).join('\n        ')}
        ${categoryQueries.map(q => `way${q}(around:${boundingRadius},${center.lat},${center.lng});`).join('\n        ')}
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
      .filter((el: any) => el.tags?.name || el.tags?.brand)
      .map((el: any) => {
        const lat = el.lat || el.center?.lat;
        const lng = el.lon || el.center?.lon;

        return {
          id: `osm-${el.id}`,
          name: el.tags.name || el.tags.brand,
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

    // Deduplicate
    const seen = new Set<string>();
    results = results.filter((r) => {
      const key = `${r.name.toLowerCase()}-${Math.round(r.coordinates.lat * 1000)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);

    return results;
  } catch (error) {
    console.error('Overpass search error:', error);
    return [];
  }
}

/**
 * Get Overpass query parts for a category
 */
function getCategoryQuery(category: BusinessCategory): string[] {
  const queries: Record<BusinessCategory, string[]> = {
    all: [
      '["shop"]["name"]',
      '["amenity"~"restaurant|cafe|bar|bank|pharmacy|hospital|clinic"]["name"]',
      '["office"]["name"]',
    ],
    restaurant: [
      '["amenity"="restaurant"]["name"]',
      '["amenity"="cafe"]["name"]',
      '["amenity"="fast_food"]["name"]',
      '["amenity"="bar"]["name"]',
      '["amenity"="pub"]["name"]',
      '["shop"="bakery"]["name"]',
    ],
    retail: [
      '["shop"]["name"]',
      '["shop"="electronics"]["name"]',
      '["shop"="mobile_phone"]["name"]',
      '["shop"="computer"]["name"]',
    ],
    electronics: [
      '["shop"="electronics"]["name"]',
      '["shop"="mobile_phone"]["name"]',
      '["shop"="computer"]["name"]',
      '["shop"="hifi"]["name"]',
    ],
    wireless: [
      '["shop"="mobile_phone"]["name"]',
      '["shop"="electronics"]["name"]',
      '["name"~"verizon|t-mobile|at&t|sprint|cricket|metro|boost|wireless|cellular|cell phone|phone repair",i]',
      '["brand"~"verizon|t-mobile|at&t|cricket|metro|boost",i]',
    ],
    office: [
      '["office"]["name"]',
    ],
    healthcare: [
      '["amenity"="hospital"]["name"]',
      '["amenity"="clinic"]["name"]',
      '["amenity"="doctors"]["name"]',
      '["amenity"="pharmacy"]["name"]',
      '["amenity"="dentist"]["name"]',
      '["healthcare"]["name"]',
    ],
    automotive: [
      '["shop"="car"]["name"]',
      '["shop"="car_repair"]["name"]',
      '["shop"="car_parts"]["name"]',
      '["amenity"="fuel"]["name"]',
      '["amenity"="car_wash"]["name"]',
    ],
    financial: [
      '["amenity"="bank"]["name"]',
      '["office"="insurance"]["name"]',
      '["office"="financial"]["name"]',
    ],
    accommodation: [
      '["tourism"="hotel"]["name"]',
      '["tourism"="motel"]["name"]',
      '["tourism"="hostel"]["name"]',
      '["tourism"="guest_house"]["name"]',
    ],
    education: [
      '["amenity"="school"]["name"]',
      '["amenity"="university"]["name"]',
      '["amenity"="college"]["name"]',
      '["amenity"="kindergarten"]["name"]',
    ],
    services: [
      '["shop"="hairdresser"]["name"]',
      '["shop"="beauty"]["name"]',
      '["shop"="laundry"]["name"]',
      '["craft"]["name"]',
    ],
  };

  return queries[category] || queries.all;
}

/**
 * Main search function - combines multiple sources for better results
 */
export async function searchBusinesses(
  options: BusinessSearchOptions
): Promise<BusinessResult[]> {
  const { keyword, limit = 50 } = options;

  let results: BusinessResult[] = [];
  const searchPromises: Promise<BusinessResult[]>[] = [];

  // If keyword search, use all available sources
  if (keyword && keyword.trim()) {
    // Try Google Places first (best quality results, if API key available)
    if (GOOGLE_PLACES_KEY) {
      searchPromises.push(
        searchWithGooglePlaces(keyword, options.center, options.radius, limit)
      );
    }

    // Also try Nominatim (good for text search)
    searchPromises.push(
      searchWithNominatim(keyword, options.center, options.radius, limit)
    );

    // Run initial searches in parallel
    const initialResults = await Promise.all(searchPromises);
    results = initialResults.flat();

    // Wait to respect Overpass rate limits
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Then try Overpass (good for structured OSM data)
    const overpassResults = await searchWithOverpass(options);
    results = [...results, ...overpassResults];
  } else {
    // Category-only search - use Overpass
    results = await searchWithOverpass(options);
  }

  // Deduplicate by name + approximate location
  const seen = new Set<string>();
  const deduplicated = results.filter((r) => {
    const key = `${r.name.toLowerCase().trim()}-${Math.round(r.coordinates.lat * 100)}-${Math.round(r.coordinates.lng * 100)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by distance and limit
  return deduplicated
    .sort((a, b) => (a.distance || 0) - (b.distance || 0))
    .slice(0, limit);
}

/**
 * Search along a route
 */
export async function searchBusinessesAlongRoute(
  stops: { coordinates: Coordinates }[],
  category: BusinessCategory = 'all',
  keyword?: string,
  radiusPerStop: number = 2000
): Promise<BusinessResult[]> {
  const allResults: BusinessResult[] = [];
  const seenIds = new Set<string>();

  for (const stop of stops) {
    const results = await searchBusinesses({
      center: stop.coordinates,
      radius: radiusPerStop,
      category,
      keyword,
      limit: 20,
    });

    for (const result of results) {
      if (!seenIds.has(result.id)) {
        seenIds.add(result.id);
        allResults.push(result);
      }
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return allResults.sort((a, b) => (a.distance || 0) - (b.distance || 0));
}

// Helper functions
function formatNominatimAddress(item: any): string {
  const addr = item.address;
  if (!addr) {
    return item.display_name?.split(',').slice(0, 3).join(', ') || 'Address not available';
  }

  const parts: string[] = [];
  if (addr.house_number && addr.road) {
    parts.push(`${addr.house_number} ${addr.road}`);
  } else if (addr.road) {
    parts.push(addr.road);
  }
  if (addr.city || addr.town || addr.village) {
    parts.push(addr.city || addr.town || addr.village);
  }
  if (addr.state) {
    parts.push(addr.state);
  }
  if (addr.postcode) {
    parts.push(addr.postcode);
  }

  return parts.join(', ') || 'Address not available';
}

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

function getBusinessType(tags: any): string {
  if (tags.amenity) return formatTagValue(tags.amenity);
  if (tags.shop) return `${formatTagValue(tags.shop)} Shop`;
  if (tags.office) return `${formatTagValue(tags.office)} Office`;
  if (tags.tourism) return formatTagValue(tags.tourism);
  if (tags.craft) return formatTagValue(tags.craft);
  if (tags.healthcare) return formatTagValue(tags.healthcare);
  return 'Business';
}

function formatTagValue(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function calculateDistance(from: Coordinates, to: Coordinates): number {
  const R = 6371e3;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const deltaLat = ((to.lat - from.lat) * Math.PI) / 180;
  const deltaLng = ((to.lng - from.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function formatBusinessDistance(meters: number): string {
  const miles = meters / 1609.34;
  if (miles < 0.1) {
    const feet = meters * 3.28084;
    return `${Math.round(feet)} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

export function getBusinessCategories(): { value: BusinessCategory; label: string }[] {
  return [
    { value: 'all', label: 'All Businesses' },
    { value: 'wireless', label: 'Wireless & Cell Phones' },
    { value: 'electronics', label: 'Electronics Stores' },
    { value: 'retail', label: 'Retail Stores' },
    { value: 'restaurant', label: 'Restaurants & Cafes' },
    { value: 'office', label: 'Offices' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'automotive', label: 'Automotive' },
    { value: 'financial', label: 'Financial Services' },
    { value: 'accommodation', label: 'Hotels & Lodging' },
    { value: 'education', label: 'Education' },
    { value: 'services', label: 'Services' },
  ];
}
