const config = require('../config');

// Centralized error handling middleware
function errorHandler(err, req, res, next) {
  const statusCode = err.status || err.statusCode || 500;

  // Log error safely without exposing passwords or keys
  if (config.nodeEnv !== 'test') {
    console.error(`[Error] ${req.method} ${req.url} -> ${statusCode}: ${err.message}`);
  }

  const response = {
    success: false,
    message: err.message || 'An internal server error occurred.',
  };

  if (err.validationErrors) {
    response.errors = err.validationErrors;
  }

  // Include stack trace only in development
  if (config.nodeEnv === 'development' && statusCode === 500) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;

