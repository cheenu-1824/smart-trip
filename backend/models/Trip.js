const mongoose = require('mongoose');

// A single destination the user wants to visit
const destinationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  placeId: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  visitDuration: { type: Number, default: 60 }, // minutes
  openingHours: { type: mongoose.Schema.Types.Mixed, default: null },
  address: { type: String, default: '' },
});

// A single stop in the optimized schedule
const scheduleStopSchema = new mongoose.Schema({
  place: destinationSchema,
  arrivalTime: { type: Date },
  departureTime: { type: Date },
  travelTimeFromPrev: { type: Number, default: 0 }, // minutes
  trafficDelay: { type: Number, default: 0 },        // extra minutes due to traffic
  busynessScore: { type: Number, default: 0 },        // 0-10 congestion score
});

const tripSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Trip name is required'],
      trim: true,
    },
    destinations: [destinationSchema],
    schedule: [scheduleStopSchema],    // ordered, optimized schedule
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    totalTravelTime: { type: Number, default: 0 },   // minutes
    totalVisitTime: { type: Number, default: 0 },     // minutes
    optimizedRoute: { type: mongoose.Schema.Types.Mixed, default: null },
    status: {
      type: String,
      enum: ['draft', 'optimized', 'completed'],
      default: 'draft',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trip', tripSchema);
