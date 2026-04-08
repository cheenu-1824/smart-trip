const express = require('express');
const { planTrip } = require('../controllers/plannerController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Plan a trip — auth required so we can optionally auto-save
router.post('/plan-trip', protect, planTrip);

module.exports = router;
