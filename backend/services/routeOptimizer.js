/**
 * routeOptimizer.js
 * ──────────────────
 * Two-phase route optimization:
 *
 * Phase 1 — Greedy nearest-neighbour with improved scoring
 *   Score = travel_time + rush-hour penalty + backtrack penalty
 *   Backtrack penalty: cost of the NEAREST remaining stop from j,
 *   weighted at 0.25. Discourages picking a stop that leaves us
 *   isolated far from everything else.
 *
 * Phase 2 — 2-opt local search
 *   After the greedy pass, try reversing every segment [i+1 … j].
 *   A swap is committed only when:
 *     a) it reduces total travel time, AND
 *     b) the resulting schedule still satisfies opening-hours + time-window
 *        constraints for every stop.
 *   Repeats until no improving swap is found.
 */

const { getDistanceMatrix, getDirections } = require('./googleMapsService');
const { isPlaceOpenAt, canCompleteVisit, buildSchedule } = require('./timeScheduler');

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * @param {Array<Object>} places  {name, placeId, lat, lng, visitDuration, openingHours}
 * @param {Date|string}   startTime
 * @param {Date|string}   endTime
 */
async function optimizeRoute(places, startTime, endTime) {
  if (!places || places.length === 0) {
    throw new Error('No places provided for optimization.');
  }

  const start = new Date(startTime);
  const end   = new Date(endTime);

  if (isNaN(start) || isNaN(end)) throw new Error('Invalid start or end time.');
  if (start >= end)               throw new Error('Start time must be before end time.');

  // ── 1. Distance matrix (traffic-aware; haversine fallback) ───────────────
  let travelMatrix;
  try {
    travelMatrix = await getDistanceMatrix(places, start);
  } catch (err) {
    console.warn('[routeOptimizer] Distance Matrix API failed, using haversine:', err.message);
    travelMatrix = buildHaversineMatrix(places, 40);
  }

  // ── 2. Greedy nearest-neighbour with backtrack penalty ───────────────────
  const n       = places.length;
  const visited = new Array(n).fill(false);
  const orderedIndices = [0];           // always start from the user's first place
  visited[0] = true;

  let currentIdx  = 0;
  let currentTime = new Date(start);

  for (let step = 1; step < n; step++) {
    let bestIdx   = -1;
    let bestScore = Infinity;

    for (let j = 0; j < n; j++) {
      if (visited[j]) continue;

      const travelMin = isFinite(travelMatrix[currentIdx][j])
        ? travelMatrix[currentIdx][j]
        : 999;

      const arrivalTime = new Date(currentTime.getTime() + travelMin * 60_000);

      // ── Hard constraints ──────────────────────────────────────────────
      if (arrivalTime >= end)                                  continue;
      if (!isPlaceOpenAt(places[j].openingHours, arrivalTime)) continue;
      if (!canCompleteVisit(places[j], arrivalTime))           continue;
      const dep = new Date(arrivalTime.getTime() + (places[j].visitDuration ?? 60) * 60_000);
      if (dep > end)                                           continue;

      // ── Soft scoring ──────────────────────────────────────────────────
      // a) Rush-hour penalty (travelMin already traffic-aware from API)
      const rushPenalty = timeOfDayPenalty(arrivalTime);

      // b) Backtrack penalty: after visiting j, how close is the nearest
      //    remaining unvisited stop?  A large value means we're heading
      //    somewhere isolated, which will force costly backtracking later.
      //    Weight 0.25 keeps it subordinate to the primary travel-time term.
      let backtrackPenalty = 0;
      const remaining = [];
      for (let k = 0; k < n; k++) {
        if (!visited[k] && k !== j) remaining.push(k);
      }
      if (remaining.length > 0) {
        const nearestFromJ = Math.min(
          ...remaining.map((k) =>
            isFinite(travelMatrix[j][k]) ? travelMatrix[j][k] : 999
          )
        );
        backtrackPenalty = nearestFromJ * 0.25;
      }

      const score = travelMin + rushPenalty + backtrackPenalty;

      if (score < bestScore) {
        bestScore = score;
        bestIdx   = j;
      }
    }

    if (bestIdx === -1) break;  // no feasible next stop

    visited[bestIdx] = true;
    orderedIndices.push(bestIdx);

    currentTime = new Date(
      currentTime.getTime() +
      travelMatrix[currentIdx][bestIdx] * 60_000 +
      (places[bestIdx].visitDuration ?? 60) * 60_000
    );
    currentIdx = bestIdx;
  }

  // ── 3. 2-opt local search ────────────────────────────────────────────────
  //    Only applied to the subset of stops we could actually fit (orderedIndices
  //    may be shorter than n if some places couldn't be reached).
  const improvedIndices = twoOptImprove(
    orderedIndices,
    places,
    travelMatrix,
    start,
    end
  );

  const orderedPlaces = improvedIndices.map((i) => places[i]);

  // ── 4. Build schedule ────────────────────────────────────────────────────
  const schedule = buildSchedule(orderedPlaces, travelMatrix, improvedIndices, start);

  // ── 5. Totals ────────────────────────────────────────────────────────────
  const totalTravelTime = schedule.reduce((sum, s) => sum + s.travelTimeFromPrev, 0);
  const totalVisitTime  = orderedPlaces.reduce((sum, p) => sum + (p.visitDuration ?? 60), 0);

  // ── 6. Directions polyline (best-effort; MapView re-fetches anyway) ──────
  let directionsData = null;
  if (orderedPlaces.length >= 2) {
    try {
      directionsData = await getDirections(
        orderedPlaces[0],
        orderedPlaces[orderedPlaces.length - 1],
        orderedPlaces.slice(1, -1),
        start
      );
    } catch (err) {
      console.warn('[routeOptimizer] Directions API failed:', err.message);
    }
  }

  return { orderedPlaces, schedule, totalTravelTime, totalVisitTime, directionsData, travelMatrix };
}

// ─── 2-opt local search ───────────────────────────────────────────────────────

/**
 * Try reversing every segment [i+1 … j] of the current route.
 * Commit the swap only when:
 *   1. It reduces total travel time (≥ 0.5 min gain to avoid floating-point noise), AND
 *   2. Every stop in the new schedule still satisfies opening hours + end-time.
 * Repeat until no improving swap is found (or the route is ≤ 2 stops).
 *
 * Complexity: O(n² × n) per outer iteration — negligible for n ≤ 20.
 *
 * @param {number[]}  indices      - current ordered indices into `places`
 * @param {Object[]}  places
 * @param {number[][]} travelMatrix
 * @param {Date}      start
 * @param {Date}      end
 * @returns {number[]} improved indices
 */
function twoOptImprove(indices, places, travelMatrix, start, end) {
  if (indices.length <= 2) return indices;  // nothing to swap

  let best     = [...indices];
  let improved = true;

  while (improved) {
    improved = false;

    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 2; j < best.length; j++) {

        // Travel cost of the two edges being considered for removal
        const costBefore =
          safeDist(travelMatrix, best[i], best[i + 1]) +
          (j + 1 < best.length ? safeDist(travelMatrix, best[j], best[j + 1]) : 0);

        // Travel cost of the two replacement edges
        const costAfter =
          safeDist(travelMatrix, best[i], best[j]) +
          (j + 1 < best.length ? safeDist(travelMatrix, best[i + 1], best[j + 1]) : 0);

        if (costAfter >= costBefore - 0.5) continue;  // not worth swapping

        // Build candidate route by reversing segment [i+1 … j]
        const candidate = [
          ...best.slice(0, i + 1),
          ...best.slice(i + 1, j + 1).reverse(),
          ...best.slice(j + 1),
        ];

        // Validate the new schedule against all constraints
        if (scheduleIsValid(candidate, places, travelMatrix, start, end)) {
          best     = candidate;
          improved = true;
        }
      }
    }
  }

  return best;
}

/**
 * Return true when every stop in the schedule built from `indices` satisfies:
 *  - arrival before end time
 *  - place is open on arrival
 *  - full visit can be completed before closing AND before end time
 */
function scheduleIsValid(indices, places, travelMatrix, start, end) {
  const orderedPlaces = indices.map((i) => places[i]);
  const schedule = buildSchedule(orderedPlaces, travelMatrix, indices, start);

  return schedule.every((stop) => {
    const arr = new Date(stop.arrivalTime);
    const dep = new Date(stop.departureTime);
    return (
      arr < end &&
      dep <= end &&
      isPlaceOpenAt(stop.place.openingHours, arr) &&
      canCompleteVisit(stop.place, arr)
    );
  });
}

/** Safe matrix lookup — returns 999 for undefined or infinite entries. */
function safeDist(matrix, i, j) {
  if (i == null || j == null) return 0;
  const v = matrix?.[i]?.[j];
  return isFinite(v) ? v : 999;
}

// ─── Rush-hour penalty ────────────────────────────────────────────────────────

/**
 * Extra minutes added during known peak windows.
 * The Distance Matrix API already reflects live traffic; this is an additional
 * soft bias that steers the optimizer away from peak-hour departures.
 *
 *   07:00–09:30  Morning rush  +10 min
 *   16:30–19:00  Evening rush  +12 min
 *   12:00–13:30  Lunch rush    + 4 min
 */
function timeOfDayPenalty(time) {
  const h = time.getHours() + time.getMinutes() / 60;
  if (h >= 7    && h < 9.5)  return 10;
  if (h >= 16.5 && h < 19)   return 12;
  if (h >= 12   && h < 13.5) return  4;
  return 0;
}

// ─── Haversine fallback matrix ────────────────────────────────────────────────

/**
 * Straight-line travel-time matrix (used when Distance Matrix API is unavailable).
 * Assumes avgSpeedKmh city driving speed.
 */
function buildHaversineMatrix(places, avgSpeedKmh = 40) {
  const n = places.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => {
      if (i === j) return 0;
      return (haversineKm(places[i], places[j]) / avgSpeedKmh) * 60;
    })
  );
}

function haversineKm(a, b) {
  const R      = 6371;
  const dLat   = toRad(b.lat - a.lat);
  const dLng   = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(b.lng - a.lng > 0 ? dLng / 2 : -dLng / 2);
  const chord  =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

function toRad(deg) { return (deg * Math.PI) / 180; }

module.exports = { optimizeRoute };
