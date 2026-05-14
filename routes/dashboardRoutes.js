const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');


const {
  getEmployeeStatus,
  getWeaknessStats,
  getAlertStats
} = require('../controllers/dashboardController');

router.get('/employees', auth, getEmployeeStatus);
router.get('/weakness', auth, getWeaknessStats);
router.get('/alerts', auth, getAlertStats);

module.exports = router;