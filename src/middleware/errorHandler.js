/**
 * Global Error Handler Middleware
 */

function globalErrorHandler(err, _req, res, _next) {
  console.error('[ERROR]', err.stack || err.message || err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error.';

  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again.'
      : message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

function notFoundHandler(_req, res) {
  res.status(404).json({
    error: 'Endpoint not found. Check the API documentation.',
    code: 'NOT_FOUND',
  });
}

module.exports = { globalErrorHandler, notFoundHandler };
