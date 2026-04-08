/**
 * TripPlanner.jsx
 * ───────────────
 * Handles two modes:
 *  A) New trip  — default empty state
 *  B) Edit mode — when location.state.editData is present (from MapResults "Edit Trip"
 *                 or Dashboard "Edit" button), the form is pre-filled with the existing
 *                 trip data and editData.tripId is carried through so that saving will
 *                 PUT (update) rather than POST (create).
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import api from '../services/api';
import DestinationCard from '../components/DestinationCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { useGoogleMaps } from '../context/GoogleMapsContext';

// Monotonically increasing local IDs for DnD key management
let _id = 0;
const newId = () => `dest_${++_id}`;

// ─── Feasibility helpers (pure JS — no API call) ──────────────────────────────

function haversineKm(a, b) {
  const R    = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const chord =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

/**
 * Greedy nearest-neighbour estimate of minimum driving time (minutes).
 * Uses conservative 30 km/h city average.  This is a lower-bound estimate,
 * so if even this is too slow the trip is definitely infeasible.
 */
function estimateMinTravelMins(dests) {
  if (dests.length < 2) return 0;
  const AVG_SPEED_KMH = 30;
  let total   = 0;
  let current = dests[0];
  const pool  = dests.slice(1);

  while (pool.length > 0) {
    let minDist = Infinity;
    let minIdx  = 0;
    pool.forEach((d, i) => {
      const dist = haversineKm(current, d);
      if (dist < minDist) { minDist = dist; minIdx = i; }
    });
    total  += (minDist / AVG_SPEED_KMH) * 60;
    current = pool[minIdx];
    pool.splice(minIdx, 1);
  }
  return total;
}

// Convert a JS Date → "YYYY-MM-DDTHH:MM" (value for datetime-local input)
const toDatetimeLocal = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Safely parse any date-ish value to a datetime-local string
const parseDatetimeLocal = (value, fallbackHour) => {
  if (!value) {
    const d = new Date();
    d.setHours(fallbackHour, 0, 0, 0);
    return toDatetimeLocal(d);
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    const now = new Date();
    now.setHours(fallbackHour, 0, 0, 0);
    return toDatetimeLocal(now);
  }
  return toDatetimeLocal(d);
};

export default function TripPlanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoaded: mapsLoaded } = useGoogleMaps();

  // editData is set when navigating here from "Edit Trip" (MapResults) or
  // "Edit" (Dashboard TripCard). It pre-fills the whole form.
  const editData = location.state?.editData ?? null;
  const isEditMode = !!editData;

  // ── State — initialised from editData when present ────────────────────────
  const [tripName, setTripName] = useState(() => editData?.tripName || '');
  const [destinations, setDestinations] = useState(() => {
    if (!editData?.destinations?.length) return [];
    // Re-attach local DnD ids that aren't stored in the DB
    return editData.destinations.map((d) => ({ ...d, id: newId() }));
  });
  const [startTime, setStartTime] = useState(() =>
    parseDatetimeLocal(editData?.startTime, 9)
  );
  const [endTime, setEndTime] = useState(() =>
    parseDatetimeLocal(editData?.endTime, 18)
  );
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const searchRef       = useRef(null);
  const autocompleteRef = useRef(null);

  // ── Google Places Autocomplete ────────────────────────────────────────────
  useEffect(() => {
    if (!mapsLoaded || !searchRef.current || !window.google) return;

    const ac = new window.google.maps.places.Autocomplete(searchRef.current, {
      fields: ['place_id', 'name', 'geometry', 'formatted_address'],
    });

    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place.geometry) return;

      setDestinations((prev) => [
        ...prev,
        {
          id:           newId(),
          name:         place.name,
          placeId:      place.place_id,
          lat:          place.geometry.location.lat(),
          lng:          place.geometry.location.lng(),
          address:      place.formatted_address || '',
          visitDuration: 60,
        },
      ]);

      setSearchInput('');
      if (searchRef.current) searchRef.current.value = '';
    });

    autocompleteRef.current = ac;

    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [mapsLoaded]);

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDestinations((items) => {
        const from = items.findIndex((i) => i.id === active.id);
        const to   = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, from, to);
      });
    }
  }, []);

  const removeDestination = useCallback(
    (id) => setDestinations((prev) => prev.filter((d) => d.id !== id)),
    []
  );

  const updateDestination = useCallback(
    (id, updates) =>
      setDestinations((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
      ),
    []
  );

  // ── Submit — call /api/plan-trip, then navigate to results ─────────────────
  const handlePlan = async (e) => {
    e.preventDefault();
    setError('');

    if (!tripName.trim()) {
      setError('Please enter a trip name.');
      return;
    }
    if (destinations.length === 0) {
      setError('Add at least one destination.');
      return;
    }
    if (new Date(startTime) >= new Date(endTime)) {
      setError('Start time must be before end time.');
      return;
    }

    // ── Client-side feasibility check (instant, no API call) ──────────────
    // Compare total visit time + conservative haversine travel estimate
    // against the available window. Catches obviously impossible trips before
    // hitting the backend.
    const availableMins  = (new Date(endTime) - new Date(startTime)) / 60_000;
    const visitMins      = destinations.reduce((s, d) => s + (d.visitDuration || 60), 0);
    const travelMins     = estimateMinTravelMins(destinations);
    const requiredMins   = visitMins + travelMins;

    if (requiredMins > availableMins) {
      setError(
        `Trip cannot be completed within selected time. ` +
        `Estimated need: ~${Math.round(requiredMins)} min ` +
        `(${Math.round(visitMins)} min visits + ~${Math.round(travelMins)} min travel), ` +
        `but only ${Math.round(availableMins)} min available. ` +
        `Remove a destination or extend your time window.`
      );
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/plan-trip', {
        destinations: destinations.map(({ id, ...rest }) => rest), // strip local id
        startTime: new Date(startTime).toISOString(),
        endTime:   new Date(endTime).toISOString(),
      });

      navigate('/results', {
        state: {
          plan:                 data,
          tripName:             tripName.trim(),
          startTime,
          endTime,
          originalDestinations: destinations,
          // Pass tripId through so MapResults knows to PUT instead of POST
          tripId:               editData?.tripId ?? null,
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

      {/* Page heading */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditMode ? 'Edit Trip' : 'Plan a New Trip'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isEditMode
            ? 'Change destinations or times, then re-optimise.'
            : "Add destinations, set your time window, and we'll do the rest."}
        </p>
      </div>

      {/* Edit-mode info banner */}
      {isEditMode && editData?.tripId && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm">
          Editing a saved trip — clicking "Generate Optimized Plan" will let you save your changes.
        </div>
      )}

      <form onSubmit={handlePlan} className="space-y-6">

        {/* Trip name */}
        <div className="card">
          <label className="label">Trip Name</label>
          <input
            type="text"
            className="input"
            placeholder="e.g. NYC Weekend Exploration"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
          />
        </div>

        {/* Time window */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Time Window</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Time</label>
              <input
                type="datetime-local"
                className="input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="label">End Time</label>
              <input
                type="datetime-local"
                className="input"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Destinations */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Destinations</h3>

          {/* Places Autocomplete search */}
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </div>
            <input
              ref={searchRef}
              type="text"
              className="input pl-9"
              placeholder={mapsLoaded ? 'Search for a place to add…' : 'Loading Maps…'}
              disabled={!mapsLoaded}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          {/* Sortable destination list */}
          {destinations.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={destinations.map((d) => d.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {destinations.map((dest, i) => (
                    <DestinationCard
                      key={dest.id}
                      destination={dest}
                      index={i}
                      onRemove={removeDestination}
                      onUpdate={updateDestination}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
              Search for places above to add them here
            </div>
          )}
        </div>

        {/* Validation error */}
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3 text-base"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Optimizing your route…
            </span>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Optimized Plan
            </>
          )}
        </button>
      </form>
    </div>
  );
}
