const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'ไม่มี Token กรุณาเข้าสู่ระบบ' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token หมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }
    return res.status(401).json({ success: false, message: 'Token ไม่ถูกต้อง' });
  }
}

// Middleware สำหรับตรวจสอบ role
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole };
