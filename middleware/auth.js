const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET || 'taskmanager_jwt_secret_fallback';
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
