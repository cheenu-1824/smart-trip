const Trip = require('../models/Trip');
const User = require('../models/User');

/**
 * GET /api/trips
 * Return all trips for the logged-in user (newest first).
 */
const getTrips = async (req, res, next) => {
  try {
    const trips = await Trip.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('-__v');
    res.json({ trips });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/trips/:id
 * Return a single trip (must belong to the requesting user).
 */
const getTripById = async (req, res, next) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, user: req.user._id });
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.' });
    }
    res.json({ trip });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/trips
 * Save a new trip (expects the already-optimized payload from the planner).
 */
const createTrip = async (req, res, next) => {
  try {
    const {
      name,
      destinations,
      schedule,
      startTime,
      endTime,
      totalTravelTime,
      totalVisitTime,
      optimizedRoute,
    } = req.body;

    if (!name || !destinations || !startTime || !endTime) {
      return res.status(400).json({ error: 'name, destinations, startTime, and endTime are required.' });
    }

    const trip = await Trip.create({
      user: req.user._id,
      name,
      destinations,
      schedule: schedule || [],
      startTime,
      endTime,
      totalTravelTime: totalTravelTime || 0,
      totalVisitTime: totalVisitTime || 0,
      optimizedRoute: optimizedRoute || null,
      status: schedule && schedule.length > 0 ? 'optimized' : 'draft',
    });

    // Link trip to user's savedTrips
    await User.findByIdAndUpdate(req.user._id, {
      $push: { savedTrips: trip._id },
    });

    res.status(201).json({ trip });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/trips/:id
 * Overwrite an existing trip with new optimised data.
 * Only the owning user can update their own trip.
 */
const updateTrip = async (req, res, next) => {
  try {
    const {
      name,
      destinations,
      schedule,
      startTime,
      endTime,
      totalTravelTime,
      totalVisitTime,
      optimizedRoute,
    } = req.body;

    // Build the update payload — only include fields that were sent
    const update = {};
    if (name           !== undefined) update.name           = name;
    if (destinations   !== undefined) update.destinations   = destinations;
    if (schedule       !== undefined) update.schedule       = schedule;
    if (startTime      !== undefined) update.startTime      = startTime;
    if (endTime        !== undefined) update.endTime        = endTime;
    if (totalTravelTime !== undefined) update.totalTravelTime = totalTravelTime;
    if (totalVisitTime  !== undefined) update.totalVisitTime  = totalVisitTime;
    if (optimizedRoute  !== undefined) update.optimizedRoute  = optimizedRoute;

    // Promote status to 'optimized' when a full schedule is provided
    if (schedule && schedule.length > 0) update.status = 'optimized';

    const trip = await Trip.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id }, // ensure ownership
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.' });
    }

    res.json({ trip });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/trips/:id
 */
const deleteTrip = async (req, res, next) => {
  try {
    const trip = await Trip.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { savedTrips: trip._id },
    });

    res.json({ message: 'Trip deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getTrips, getTripById, createTrip, updateTrip, deleteTrip };
