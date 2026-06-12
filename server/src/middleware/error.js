export function notFound(req, res, _next) {
  res.status(404).json({ message: `Not found: ${req.originalUrl}` });
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  const payload = { message: err.message || "Server error" };
  if (err.errors) payload.errors = err.errors;
  if (process.env.NODE_ENV !== "production") payload.stack = err.stack;
  res.status(status).json(payload);
}

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
