const jwt = require('jsonwebtoken');

function authMiddleware({ jwtSecret }) {
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice('Bearer '.length) : null;
    if (!token) return res.status(401).json({ error: 'Missing Authorization token' });
    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded;
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Missing or invalid authentication' });
    if (req.user.role !== role) {
      req.log?.warn?.(
        {
          path: req.path,
          method: req.method,
          userRole: req.user.role,
          userId: req.user.id,
          requiredRole: role,
          reason: 'wrong_role',
        },
        'auth: 403 — role not allowed',
      );
      return res.status(403).json({
        error: 'You are not authorized for this action',
        code: 'FORBIDDEN',
        requiredRole: role,
      });
    }
    return next();
  };
}

function requireAnyRole(roles) {
  const set = new Set(roles);
  const allowed = [...roles];
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Missing or invalid authentication' });
    if (!set.has(req.user.role)) {
      req.log?.warn?.(
        {
          path: req.path,
          method: req.method,
          userRole: req.user.role,
          userId: req.user.id,
          allowedRoles: allowed,
          reason: 'role_not_in_allowed_set',
        },
        'auth: 403 — role not in allowed list',
      );
      return res.status(403).json({
        error: 'You are not authorized for this action',
        code: 'FORBIDDEN',
        allowedRoles: allowed,
      });
    }
    return next();
  };
}

module.exports = { authMiddleware, requireRole, requireAnyRole };

