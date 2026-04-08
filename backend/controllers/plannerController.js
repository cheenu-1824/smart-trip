const { optimizeRoute } = require('../services/routeOptimizer');
const { getPlaceDetails } = require('../services/googleMapsService');

// ─── Haversine helpers (no external dependency) ───────────────────────────────

function toRad(deg) { return (deg * Math.PI) / 180; }

function haversineKm(a, b) {
  const R    = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const chord =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

/**
 * Greedy nearest-neighbour travel estimate (straight-line, no API).
 * Used only for the pre-flight feasibility check — quick and dependency-free.
 * Assumes avgSpeedKmh city driving.
 *
 * @param {Array<{lat, lng}>} dests
 * @param {number} avgSpeedKmh  default 30 (conservative city estimate)
 * @returns {number} estimated total travel time in minutes
 */
function estimateMinTravelMins(dests, avgSpeedKmh = 30) {
  if (dests.length < 2) return 0;

  let total   = 0;
  let current = dests[0];
  const pool  = dests.slice(1);   // mutable copy of remaining stops

  while (pool.length > 0) {
    // Find nearest unvisited stop from current position
    let minDist = Infinity;
    let minIdx  = 0;
    pool.forEach((d, i) => {
      const dist = haversineKm(current, d);
      if (dist < minDist) { minDist = dist; minIdx = i; }
    });

    total  += (minDist / avgSpeedKmh) * 60;
    current = pool[minIdx];
    pool.splice(minIdx, 1);
  }

  return total;
}

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * POST /api/plan-trip
 *
 * Body:  { destinations, startTime, endTime }
 * Reply: { orderedPlaces, schedule, directionsData, summary }
 */
const planTrip = async (req, res, next) => {
  try {
    const { destinations, startTime, endTime } = req.body;

    // ── Basic input validation ─────────────────────────────────────────────
    if (!destinations || !Array.isArray(destinations) || destinations.length === 0) {
      return res.status(400).json({ error: 'At least one destination is required.' });
    }
    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'startTime and endTime are required.' });
    }

    const start = new Date(startTime);
    const end   = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format for startTime or endTime.' });
    }
    if (start >= end) {
      return res.status(400).json({ error: 'startTime must be before endTime.' });
    }

    // ── Feasibility pre-check (no external API needed) ────────────────────
    // Compare sum-of-visit-durations + conservative travel estimate
    // against the available time window.  Rejects obviously impossible
    // trips before we hit the Distance Matrix API quota.
    const availableMinutes  = (end - start) / 60_000;
    const totalVisitMinutes = destinations.reduce(
      (s, d) => s + (d.visitDuration ?? 60), 0
    );
    const minTravelMinutes  = estimateMinTravelMins(destinations);
    const estimatedTotal    = totalVisitMinutes + minTravelMinutes;

    if (estimatedTotal > availableMinutes) {
      return res.status(400).json({
        error:
          'Trip cannot be completed within selected time. ' +
          'Reduce destinations or extend your time window.',
        details: {
          availableMinutes: Math.round(availableMinutes),
          requiredMinutes:  Math.round(estimatedTotal),
          visitMinutes:     Math.round(totalVisitMinutes),
          travelMinutes:    Math.round(minTravelMinutes),
        },
      });
    }

    // ── Enrich destinations with opening hours ────────────────────────────
    const enrichedDestinations = await Promise.all(
      destinations.map(async (dest) => {
        let openingHours = null;
        if (dest.placeId) {
          try {
            const details = await getPlaceDetails(dest.placeId);
            openingHours  = details?.opening_hours ?? null;
          } catch {
            // Non-fatal — proceed without hours data
          }
        }
        return { ...dest, openingHours };
      })
    );

    // ── Optimize route ────────────────────────────────────────────────────
    const result = await optimizeRoute(enrichedDestinations, start, end);

    // ── Build response summary ────────────────────────────────────────────
    const summary = {
      totalStops:      result.orderedPlaces.length,
      totalTravelTime: Math.round(result.totalTravelTime),
      totalVisitTime:  Math.round(result.totalVisitTime),
      totalTripTime:   Math.round(result.totalTravelTime + result.totalVisitTime),
      startTime:       result.schedule[0]?.arrivalTime ?? start,
      endTime:         result.schedule[result.schedule.length - 1]?.departureTime ?? end,
    };

    res.json({
      orderedPlaces: result.orderedPlaces,
      schedule:      result.schedule,
      directionsData: result.directionsData,
      summary,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { planTrip };
