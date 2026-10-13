const express = require('express');
const multer = require('multer');
const router = express.Router();
const illustrationController = require('../controllers/illustrationController');
const authenticateJWT = require('../middleware/authMiddleware');

// Configure multer for memory storage (streaming upload prototype)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed.'));
    }
  },
});

// Optional auth helper: decodes token if present, otherwise proceeds without failing
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateJWT(req, res, next);
  }
  next();
}

// Public or optionally authenticated calculation
router.post('/calculate', optionalAuth, illustrationController.calculate);

// Authenticated endpoints
router.post('/save', authenticateJWT, illustrationController.save);
router.get('/', authenticateJWT, illustrationController.getHistory);
router.get('/bulk-jobs/:id', authenticateJWT, illustrationController.getBulkJobStatus);
router.post('/bulk-upload', authenticateJWT, upload.single('file'), illustrationController.bulkUpload);
router.get('/:id/export', authenticateJWT, illustrationController.exportCSV);
router.get('/:id', authenticateJWT, illustrationController.getById);

module.exports = router;

