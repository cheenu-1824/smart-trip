/**
 * GoogleMapsContext
 * ─────────────────
 * Loads the Google Maps JavaScript API exactly once for the entire app.
 * All components that need `isLoaded` / `loadError` should consume this
 * context instead of calling useJsApiLoader themselves — multiple calls
 * with different `libraries` arrays cause silent failures (the second
 * call is ignored, so the libraries from the first call win).
 */
import React, { createContext, useContext } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

// Keep this array stable (module-level constant) to avoid re-loading
const LIBRARIES = ['places', 'geometry'];

const GoogleMapsContext = createContext({ isLoaded: false, loadError: undefined });

export function GoogleMapsProvider({ children }) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export const useGoogleMaps = () => useContext(GoogleMapsContext);
