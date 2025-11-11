// Auth routes disabled - backend functionality removed.
// This file remains as a placeholder to avoid runtime errors if mistakenly loaded.
const express = require('express');
const router = express.Router();

router.use((req, res) => {
  res.status(410).json({ success: false, message: 'Auth API removed for static deployment.' });
});

module.exports = router;