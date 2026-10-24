export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function notFound(req, res, next) {
  next(new HttpError(404, `Not found: ${req.method} ${req.path}`));
}

// Every error leaves the API as JSON: { "error": "<message>" }.
export function errorHandler(err, req, res, next) {
  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 500) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
  res.status(status).json({ error: err.message });
}
