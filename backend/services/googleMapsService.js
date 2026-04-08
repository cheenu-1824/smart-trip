const axios = require('axios');

const MAPS_BASE = 'https://maps.googleapis.com/maps/api';
const API_KEY = () => process.env.GOOGLE_MAPS_API_KEY;

/**
 * Get travel times between every pair of locations using Distance Matrix API.
 * Returns a 2D matrix: travelTimes[i][j] = travel time in minutes from i to j.
 * Traffic-aware when departureTime is provided.
 *
 * @param {Array<{lat, lng}>} locations
 * @param {Date|null} departureTime
 * @returns {Promise<number[][]>}
 */
async function getDistanceMatrix(locations, departureTime = null) {
  if (locations.length < 2) return [[0]];

  const latLngs = locations.map((l) => `${l.lat},${l.lng}`).join('|');

  const params = {
    origins: latLngs,
    destinations: latLngs,
    key: API_KEY(),
    mode: 'driving',
    units: 'metric',
  };

  // Use traffic model when departure time is provided
  if (departureTime) {
    params.departure_time = Math.floor(new Date(departureTime).getTime() / 1000);
    params.traffic_model = 'best_guess';
  }

  const response = await axios.get(`${MAPS_BASE}/distancematrix/json`, { params });
  const data = response.data;

  if (data.status !== 'OK') {
    throw new Error(`Distance Matrix API error: ${data.status} - ${data.error_message || ''}`);
  }

  const n = locations.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(Infinity));

  data.rows.forEach((row, i) => {
    row.elements.forEach((element, j) => {
      if (element.status === 'OK') {
        // Prefer duration_in_traffic (traffic-aware) if available, else duration
        const durationSec =
          element.duration_in_traffic?.value ?? element.duration?.value ?? Infinity;
        matrix[i][j] = durationSec / 60; // convert seconds → minutes
      }
    });
  });

  return matrix;
}

/**
 * Get detailed directions + polyline for the ordered route.
 *
 * @param {{lat, lng}} origin
 * @param {{lat, lng}} destination
 * @param {Array<{lat, lng}>} waypoints - stops in order (excluding origin & dest)
 * @param {Date|null} departureTime
 * @returns {Promise<Object>} Google Directions API response
 */
async function getDirections(origin, destination, waypoints = [], departureTime = null) {
  const params = {
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    key: API_KEY(),
    mode: 'driving',
  };

  if (waypoints.length > 0) {
    params.waypoints = waypoints.map((w) => `${w.lat},${w.lng}`).join('|');
  }

  if (departureTime) {
    params.departure_time = Math.floor(new Date(departureTime).getTime() / 1000);
    params.traffic_model = 'best_guess';
  }

  const response = await axios.get(`${MAPS_BASE}/directions/json`, { params });
  const data = response.data;

  if (data.status !== 'OK') {
    throw new Error(`Directions API error: ${data.status} - ${data.error_message || ''}`);
  }

  return data;
}

/**
 * Fetch place details (opening hours, name, address) from Places API.
 *
 * @param {string} placeId
 * @returns {Promise<Object>}
 */
async function getPlaceDetails(placeId) {
  const params = {
    place_id: placeId,
    fields: 'name,opening_hours,formatted_address,geometry,business_status',
    key: API_KEY(),
  };

  const response = await axios.get(`${MAPS_BASE}/place/details/json`, { params });
  const data = response.data;

  if (data.status !== 'OK') {
    // Not fatal — some places have no details
    console.warn(`Places API warning for ${placeId}: ${data.status}`);
    return null;
  }

  return data.result;
}

/**
 * Compute a "busyness score" (0–10) for a location at a given time.
 * Uses the ratio of traffic-aware travel time vs free-flow travel time.
 * Higher score = more congested.
 *
 * @param {number} trafficDuration  - seconds with traffic
 * @param {number} normalDuration   - seconds without traffic
 * @returns {number} busyness 0–10
 */
function computeBusynessScore(trafficDuration, normalDuration) {
  if (!trafficDuration || !normalDuration || normalDuration === 0) return 0;
  const ratio = trafficDuration / normalDuration;
  // ratio 1.0 = no delay = score 0; ratio 2.0 = double time = score 10
  const score = Math.min(10, Math.max(0, (ratio - 1) * 10));
  return Math.round(score * 10) / 10;
}

module.exports = {
  getDistanceMatrix,
  getDirections,
  getPlaceDetails,
  computeBusynessScore,
};
