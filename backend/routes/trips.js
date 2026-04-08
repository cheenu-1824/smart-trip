const express = require('express');
const { getTrips, getTripById, createTrip, updateTrip, deleteTrip } = require('../controllers/tripsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All trip routes require authentication
router.use(protect);

router.get('/', getTrips);
router.post('/', createTrip);
router.get('/:id', getTripById);
router.put('/:id', updateTrip);
router.delete('/:id', deleteTrip);

module.exports = router;
