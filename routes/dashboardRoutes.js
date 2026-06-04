const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');


const {
  getEmployeeStatus,
  getWeaknessStats,
  getAlertStats,
  getMyLearningStats
} = require('../controllers/dashboardController');

router.get('/employees', auth, getEmployeeStatus);
router.get('/weakness', auth, getWeaknessStats);
router.get('/alerts', auth, getAlertStats);
router.get('/learning-stats', auth, getMyLearningStats);

module.exports = router;