/**
 * MapResults.jsx
 * ──────────────
 * Loaded in two ways:
 *  A) Fresh plan  → location.state.plan   (just optimised in TripPlanner)
 *  B) Saved trip  → location.state.trip   (opened from Dashboard)
 *
 * Save / Update logic:
 *  - If a tripId is present (editing an existing saved trip), we PUT to overwrite it.
 *  - Otherwise we POST to create a new trip record.
 */
import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import MapView from '../components/MapView';
import ScheduleList from '../components/ScheduleList';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../services/api';

const fmtMin = (m) => {
  if (!m) return '—';
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const rem = Math.round(m % 60);
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
};

export default function MapResults() {
  const location = useLocation();
  const navigate  = useNavigate();

  const {
    plan,
    tripName,
    startTime,
    endTime,
    originalDestinations,
    trip,
    tripId,           // set when coming from TripPlanner in "edit" mode
  } = location.state || {};

  // Resolve which saved-trip ID we're dealing with (if any)
  // Priority: explicit tripId (from edit flow) → trip._id (from Dashboard view)
  const existingTripId = tripId ?? trip?._id ?? null;

  // Normalise data from either source
  const schedule      = plan?.schedule       ?? trip?.schedule      ?? [];
  const orderedPlaces = plan?.orderedPlaces  ?? trip?.destinations  ?? [];
  const summary = plan?.summary ?? {
    totalStops:     trip?.destinations?.length ?? 0,
    totalTravelTime: trip?.totalTravelTime     ?? 0,
    totalVisitTime:  trip?.totalVisitTime      ?? 0,
    totalTripTime:  (trip?.totalTravelTime ?? 0) + (trip?.totalVisitTime ?? 0),
  };
  const displayName = tripName ?? trip?.name ?? 'Trip Details';

  // Saving state
  // If we arrived from Dashboard (not from a fresh plan) it's already saved.
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(!!trip && !plan); // already saved when viewing from dashboard
  const [saveError, setSaveError] = useState('');

  // ── No data guard ─────────────────────────────────────────────────────────
  if (!schedule.length && !orderedPlaces.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-gray-500">No trip data found.</p>
        <Link to="/plan" className="btn-primary">Plan a Trip</Link>
      </div>
    );
  }

  // ── Save / Update ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveError('');

    const payload = {
      name:            displayName,
      destinations:    originalDestinations ?? orderedPlaces,
      schedule,
      startTime:       startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
      endTime:         endTime   ? new Date(endTime).toISOString()   : new Date().toISOString(),
      totalTravelTime: summary.totalTravelTime,
      totalVisitTime:  summary.totalVisitTime,
      // directionsData is no longer stored — MapView re-fetches it live
      optimizedRoute:  null,
    };

    try {
      if (existingTripId) {
        // Overwrite an existing saved trip
        await api.put(`/trips/${existingTripId}`, payload);
      } else {
        // Create a brand-new trip record
        await api.post('/trips', payload);
      }
      setSaved(true);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Edit Trip: go back to TripPlanner pre-filled ──────────────────────────
  const handleEditTrip = () => {
    navigate('/plan', {
      state: {
        editData: {
          tripName:     displayName,
          destinations: originalDestinations ?? orderedPlaces,
          startTime,
          endTime,
          tripId:       existingTripId, // preserve so saving will PUT not POST
        },
      },
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-500 ml-8">
            <span>📍 {summary.totalStops} stops</span>
            <span>🚗 {fmtMin(summary.totalTravelTime)} driving</span>
            <span>⏱️ {fmtMin(summary.totalVisitTime)} visits</span>
            <span>🕐 {fmtMin(summary.totalTripTime)} total</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">

          {/* Edit Trip — always available */}
          <button onClick={handleEditTrip} className="btn-secondary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Trip
          </button>

          {/* Save / Update — only when not yet saved */}
          {!saved && (
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  {existingTripId ? 'Updating…' : 'Saving…'}
                </span>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  {existingTripId ? 'Update Trip' : 'Save Trip'}
                </>
              )}
            </button>
          )}

          {/* Saved confirmation badge */}
          {saved && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 text-green-700 text-sm font-medium border border-green-200">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {existingTripId ? 'Updated' : 'Saved'}
            </div>
          )}

          <Link to="/plan" className="btn-secondary">New Trip</Link>
        </div>
      </div>

      {/* Error banner */}
      {saveError && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {saveError}
        </div>
      )}

      {/* ── Map + Schedule ────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-6">

        {/* Map — directionsData no longer needed; MapView fetches route itself */}
        <div className="lg:col-span-3 h-[500px] rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <MapView orderedPlaces={orderedPlaces} />
        </div>

        {/* Schedule timeline */}
        <div className="lg:col-span-2 overflow-y-auto max-h-[500px] pr-1">
          <h2 className="font-semibold text-gray-900 mb-4 text-lg">Your Schedule</h2>
          <ScheduleList
            schedule={schedule}
            totalTravelTime={summary.totalTravelTime}
            totalVisitTime={summary.totalVisitTime}
          />
        </div>
      </div>
    </div>
  );
}
