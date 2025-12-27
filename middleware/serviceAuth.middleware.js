module.exports = function serviceAuth(req, res, next) {
  const expected = process.env.SERVICE_TOKEN;
  if (!expected) {
    console.warn('SERVICE_TOKEN not set; service auth is bypassed');
    return next();
  }

  const token = req.get('X-Service-Token');
  if (!token || token !== expected) {
    return res.status(401).json({ code: 'error', message: 'Unauthorized' });
  }

  next();
};