/**
 * MapView.jsx
 * ───────────
 * Renders the Google Map with:
 *  - Custom numbered markers (green=first, red=last, blue=middle)
 *  - A blue driving-route polyline via the Maps JS DirectionsService
 *  - InfoWindow on marker click
 *
 * WHY DirectionsService here (not backend)?
 *  The Maps JavaScript API is loaded in the browser via our API key, so the
 *  Directions service is always available without an extra HTTP call.
 *  This eliminates the dependency on the backend directionsData field and
 *  works even when the backend Directions API call silently fails.
 */
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  GoogleMap,
  Marker,
  Polyline,
  InfoWindow,
  DirectionsRenderer,
} from '@react-google-maps/api';
import { useGoogleMaps } from '../context/GoogleMapsContext';

const MAP_STYLES = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
];

const containerStyle = { width: '100%', height: '100%' };

function computeCenter(places) {
  if (!places || places.length === 0) return { lat: 40.7128, lng: -74.006 };
  return {
    lat: places.reduce((s, p) => s + p.lat, 0) / places.length,
    lng: places.reduce((s, p) => s + p.lng, 0) / places.length,
  };
}

/**
 * Build a numbered-pin icon using an inline SVG data URL.
 *
 * WHY SVG instead of SymbolPath.CIRCLE + label?
 *  When Google Maps renders a Symbol icon, the `label` prop is positioned
 *  relative to the symbol's `labelOrigin`, which is not always visually
 *  centred. An SVG icon bakes the number directly into the graphic so it
 *  is always pixel-perfectly centred inside the circle, at every zoom level.
 *
 * @param {number} number      - stop index (1-based)
 * @param {string} fillColor   - hex colour for the circle
 * @returns {Object}           - Google Maps icon descriptor
 */
function makeNumberedPin(number, fillColor) {
  // Slightly smaller font for two-digit numbers to stay inside the circle
  const fontSize = number > 9 ? 11 : 13;

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">',
    `<circle cx="18" cy="18" r="16" fill="${fillColor}" stroke="white" stroke-width="2.5"/>`,
    `<text x="18" y="${18 + fontSize / 2 - 1}" text-anchor="middle"`,
    ` font-size="${fontSize}" font-weight="700" fill="white"`,
    ' font-family="Arial,sans-serif">',
    String(number),
    '</text>',
    '</svg>',
  ].join('');

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    // scaledSize must be a google.maps.Size — built lazily inside the component
    // so window.google is guaranteed to exist when this is called.
    scaledSize: new window.google.maps.Size(36, 36),
    anchor:     new window.google.maps.Point(18, 18),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MapView({ orderedPlaces = [] }) {
  const { isLoaded, loadError } = useGoogleMaps();

  const [directions, setDirections] = useState(null);
  const [dirError, setDirError]     = useState(false);
  const [activeMarker, setActiveMarker] = useState(null);

  // Stable string key: only re-fire Directions when the actual places change
  const placesKey = useMemo(
    () => orderedPlaces.map((p) => `${p.lat},${p.lng}`).join('|'),
    [orderedPlaces]
  );

  // ── Request driving directions whenever the ordered stops change ────────────
  useEffect(() => {
    if (!isLoaded || orderedPlaces.length < 2) {
      setDirections(null);
      setDirError(false);
      return;
    }

    setDirections(null);
    setDirError(false);

    const service = new window.google.maps.DirectionsService();

    const origin      = { lat: orderedPlaces[0].lat, lng: orderedPlaces[0].lng };
    const destination = {
      lat: orderedPlaces[orderedPlaces.length - 1].lat,
      lng: orderedPlaces[orderedPlaces.length - 1].lng,
    };
    // Middle stops become waypoints
    const waypoints = orderedPlaces.slice(1, -1).map((p) => ({
      location: { lat: p.lat, lng: p.lng },
      stopover: true,
    }));

    service.route(
      {
        origin,
        destination,
        waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING,
        // Don't re-optimise — we already did that in the backend
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status === 'OK') {
          setDirections(result);
        } else {
          // Non-fatal: fall back to a straight-line polyline
          console.warn('[MapView] DirectionsService failed:', status);
          setDirError(true);
        }
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, placesKey]);

  // ── Map onLoad: fit bounds to show all markers ──────────────────────────────
  const onMapLoad = useCallback(
    (map) => {
      if (orderedPlaces.length > 1 && window.google) {
        const bounds = new window.google.maps.LatLngBounds();
        orderedPlaces.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        map.fitBounds(bounds, 60);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placesKey]
  );

  const center = computeCenter(orderedPlaces);

  // ── Error / loading states ──────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-2xl">
        <div className="text-center p-6">
          <div className="text-4xl mb-2">🗺️</div>
          <p className="text-gray-500 text-sm font-medium">Map unavailable</p>
          <p className="text-gray-400 text-xs mt-1">Check your Google Maps API key</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-2xl">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary-200 border-t-primary-700" />
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={orderedPlaces.length === 1 ? 15 : 13}
      onLoad={onMapLoad}
      options={{
        styles: MAP_STYLES,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
      }}
    >
      {/* ── Route: DirectionsRenderer draws the real road-following polyline ── */}
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            // Hide A/B/C default markers — we draw our own numbered ones below
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#2563eb',
              strokeOpacity: 0.9,
              strokeWeight: 5,
            },
          }}
        />
      )}

      {/* ── Fallback straight-line polyline when Directions unavailable ──────── */}
      {!directions && dirError && orderedPlaces.length > 1 && (
        <Polyline
          path={orderedPlaces.map((p) => ({ lat: p.lat, lng: p.lng }))}
          options={{
            strokeColor: '#93c5fd',
            strokeOpacity: 0.7,
            strokeWeight: 3,
          }}
        />
      )}

      {/* ── Numbered markers — SVG pins with stop number centred inside ──────── */}
      {orderedPlaces.map((place, i) => {
        // Color key: green = first stop, red = last stop, blue = intermediate
        const fillColor =
          i === 0                          ? '#16a34a' :
          i === orderedPlaces.length - 1   ? '#dc2626' :
                                             '#2563eb';

        return (
        <Marker
          key={`${place.placeId || place.name}-${i}`}
          position={{ lat: place.lat, lng: place.lng }}
          icon={makeNumberedPin(i + 1, fillColor)}
          zIndex={100 + i}   // always above the route polyline
          onClick={() => setActiveMarker(i)}
        >
          {activeMarker === i && (
            <InfoWindow onCloseClick={() => setActiveMarker(null)}>
              <div style={{ maxWidth: 200 }}>
                <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                  {place.name}
                </p>
                {place.address && (
                  <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                    {place.address}
                  </p>
                )}
                <p style={{ fontSize: 11, color: '#2563eb' }}>
                  Stop #{i + 1} · {place.visitDuration ?? 60} min visit
                </p>
              </div>
            </InfoWindow>
          )}
        </Marker>
        );
      })}
    </GoogleMap>
  );
}
