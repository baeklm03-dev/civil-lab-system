const { validationResult } = require('express-validator');

// รวม error จาก express-validator ให้เป็น response shape เดียวกับที่ทั้งแอปใช้อยู่แล้ว
// ({ success: false, message }) — ส่งข้อความแรกพอ ไม่ต้อง list ทุก field ผิด
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  next();
}

module.exports = { handleValidationErrors };
