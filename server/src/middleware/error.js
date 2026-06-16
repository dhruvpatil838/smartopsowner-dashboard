export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function notFound(req, res, _next) {
  res.status(404).json({ message: `Not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, _req, res, _next) {
  // Zod validation
  if (err?.issues && Array.isArray(err.issues)) {
    return res.status(400).json({ message: "Validation failed", issues: err.issues });
  }
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ message: err.message || "Server error" });
}
