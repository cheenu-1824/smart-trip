/**
 * timeScheduler.js
 * ─────────────────
 * Handles all time-awareness logic:
 *  - Parsing Google Places opening hours
 *  - Checking whether a place is open at a given time
 *  - Computing arrival / departure times along a route
 */

/**
 * Google Places API weekday index: Sunday=0 … Saturday=6
 * JS Date.getDay() also uses the same convention.
 */

/**
 * Check if a place is open at the given JS Date.
 * Falls back to `true` when opening hours are unavailable (don't block the trip).
 *
 * @param {Object|null} openingHours  - result.opening_hours from Places API
 * @param {Date}        time
 * @returns {boolean}
 */
function isPlaceOpenAt(openingHours, time) {
  if (!openingHours || !openingHours.periods) return true; // assume open if unknown

  const dayOfWeek = time.getDay(); // 0 = Sunday
  const hhmm = time.getHours() * 100 + time.getMinutes(); // e.g. 14:30 → 1430

  const todayPeriods = openingHours.periods.filter((p) => p.open?.day === dayOfWeek);

  // 24-hour open: open.time === "0000" and no close
  if (todayPeriods.some((p) => p.open?.time === '0000' && !p.close)) return true;

  return todayPeriods.some((period) => {
    const openHHMM = parseInt(period.open?.time ?? '0000', 10);
    // Close can be next day; treat it as > 2400 so overnight venues work
    let closeHHMM = parseInt(period.close?.time ?? '2359', 10);
    if (period.close && period.close.day !== period.open.day) closeHHMM += 2400;

    return hhmm >= openHHMM && hhmm < closeHHMM;
  });
}

/**
 * Return the closing time (in minutes-since-midnight) for a place on a given day.
 * Returns Infinity when unavailable.
 *
 * @param {Object|null} openingHours
 * @param {Date}        time
 * @returns {number} minutes since midnight
 */
function getClosingMinutes(openingHours, time) {
  if (!openingHours || !openingHours.periods) return Infinity;

  const dayOfWeek = time.getDay();
  const hhmm = time.getHours() * 100 + time.getMinutes();

  const todayPeriods = openingHours.periods.filter((p) => p.open?.day === dayOfWeek);

  for (const period of todayPeriods) {
    const openHHMM = parseInt(period.open?.time ?? '0000', 10);
    let closeHHMM = parseInt(period.close?.time ?? '2359', 10);
    const isOvernight = period.close && period.close.day !== period.open.day;
    if (isOvernight) closeHHMM += 2400;

    if (hhmm >= openHHMM && hhmm < closeHHMM) {
      // Convert close HHMM to minutes since midnight
      const closeHours = Math.floor(closeHHMM / 100);
      const closeMins = closeHHMM % 100;
      return closeHours * 60 + closeMins;
    }
  }

  return Infinity;
}

/**
 * Given an ordered list of places + pairwise travel times, compute
 * the arrival and departure time at each stop starting from `startTime`.
 *
 * @param {Array<Object>} orderedPlaces   - each has visitDuration (minutes), openingHours
 * @param {number[][]}    travelMatrix    - travelMatrix[i][j] in minutes
 * @param {number[]}      indexMap        - index of each orderedPlace in the matrix
 * @param {Date}          startTime
 * @returns {Array<{place, arrivalTime, departureTime, travelTimeFromPrev}>}
 */
function buildSchedule(orderedPlaces, travelMatrix, indexMap, startTime) {
  const schedule = [];
  let currentTime = new Date(startTime);

  orderedPlaces.forEach((place, i) => {
    let travelMin = 0;

    if (i > 0) {
      const fromIdx = indexMap[i - 1];
      const toIdx = indexMap[i];
      travelMin = isFinite(travelMatrix[fromIdx][toIdx])
        ? Math.round(travelMatrix[fromIdx][toIdx])
        : 0;
      currentTime = new Date(currentTime.getTime() + travelMin * 60_000);
    }

    const arrivalTime = new Date(currentTime);
    const visitMin = place.visitDuration ?? 60;
    const departureTime = new Date(currentTime.getTime() + visitMin * 60_000);

    schedule.push({
      place,
      arrivalTime,
      departureTime,
      travelTimeFromPrev: travelMin,
    });

    currentTime = departureTime;
  });

  return schedule;
}

/**
 * Check whether a place can be fully visited (arrival + duration) before it closes.
 *
 * @param {Object} place        - has openingHours, visitDuration
 * @param {Date}   arrivalTime
 * @returns {boolean}
 */
function canCompleteVisit(place, arrivalTime) {
  const closingMin = getClosingMinutes(place.openingHours, arrivalTime);
  if (!isFinite(closingMin)) return true; // no data → allow

  const arrivalMin = arrivalTime.getHours() * 60 + arrivalTime.getMinutes();
  const requiredMin = arrivalMin + (place.visitDuration ?? 60);
  return requiredMin <= closingMin;
}

module.exports = {
  isPlaceOpenAt,
  getClosingMinutes,
  buildSchedule,
  canCompleteVisit,
};
