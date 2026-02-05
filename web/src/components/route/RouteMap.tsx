import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Stop, Coordinates } from '../../types';

// Fix for default marker icons in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom marker icon
const createNumberedIcon = (number: number, status: Stop['status']) => {
  const colors = {
    pending: '#64748B',
    in_progress: '#2563EB',
    completed: '#10B981',
    skipped: '#F59E0B',
  };

  const color = colors[status] || colors.pending;

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background-color: ${color};
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 14px;
      ">${number}</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

// Current location icon
const currentLocationIcon = L.divIcon({
  className: 'current-location-marker',
  html: `
    <div style="
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background-color: #2563EB;
      border: 3px solid white;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.3);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

interface MapUpdaterProps {
  stops: Stop[];
  userLocation?: Coordinates | null;
}

function MapUpdater({ stops, userLocation }: MapUpdaterProps) {
  const map = useMap();

  useEffect(() => {
    if (stops.length === 0 && !userLocation) return;

    const points: L.LatLngExpression[] = stops.map((s) => [
      s.coordinates.lat,
      s.coordinates.lng,
    ]);

    if (userLocation) {
      points.push([userLocation.lat, userLocation.lng]);
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, stops, userLocation]);

  return null;
}

export interface RouteMapProps {
  stops: Stop[];
  userLocation?: Coordinates | null;
  onStopClick?: (stopId: string) => void;
  showRoute?: boolean;
  height?: string;
  className?: string;
}

export function RouteMap({
  stops,
  userLocation,
  onStopClick,
  showRoute = true,
  height = '400px',
  className = '',
}: RouteMapProps) {
  const defaultCenter: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [39.8283, -98.5795]; // Center of US

  const defaultZoom = userLocation || stops.length > 0 ? 12 : 4;

  // Create polyline coordinates for route
  const routeCoordinates: [number, number][] = stops
    .sort((a, b) => a.order - b.order)
    .map((s) => [s.coordinates.lat, s.coordinates.lng]);

  return (
    <div className={`rounded-xl overflow-hidden border border-slate-200 ${className}`} style={{ height }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapUpdater stops={stops} userLocation={userLocation} />

        {/* User location marker */}
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={currentLocationIcon}
          >
            <Popup>Your location</Popup>
          </Marker>
        )}

        {/* Stop markers */}
        {stops.map((stop, index) => (
          <Marker
            key={stop.id}
            position={[stop.coordinates.lat, stop.coordinates.lng]}
            icon={createNumberedIcon(index + 1, stop.status)}
            eventHandlers={{
              click: () => onStopClick?.(stop.id),
            }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{stop.name || `Stop ${index + 1}`}</strong>
                <br />
                {stop.address}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Route line */}
        {showRoute && routeCoordinates.length > 1 && (
          <Polyline
            positions={routeCoordinates}
            color="#2563EB"
            weight={4}
            opacity={0.7}
            dashArray="10, 10"
          />
        )}
      </MapContainer>
    </div>
  );
}

// Mini map for previews
export function MiniMap({
  coordinates,
  height = '150px',
}: {
  coordinates: Coordinates;
  height?: string;
}) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ height }}>
      <MapContainer
        center={[coordinates.lat, coordinates.lng]}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[coordinates.lat, coordinates.lng]} />
      </MapContainer>
    </div>
  );
}
