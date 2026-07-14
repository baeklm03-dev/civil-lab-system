# ระบบทดสอบวัสดุ — มจพ. พระนครเหนือ

ระบบจัดการงานทดสอบวัสดุสำหรับคณะวิศวกรรมโยธา เชื่อมต่อกับ Google Sheets

---

## Tech Stack

| ส่วน     | เทคโนโลยี                    |
|----------|-------------------------------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend  | Node.js + Express              |
| Database | Google Sheets API v4           |
| Auth     | JWT (jsonwebtoken)             |

---

## โครงสร้างโปรเจกต์

```
civil-lab-system/
├── backend/
│   ├── middleware/auth.js        # JWT middleware
│   ├── routes/
│   │   ├── auth.js              # Login / logout
│   │   └── workorders.js        # CRUD ใบงาน + stats
│   ├── services/sheetsService.js # Google Sheets API wrapper
│   ├── server.js                 # Express app
│   ├── .env.example             # ตัวอย่าง environment variables
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/layout/   # Sidebar, MainLayout
│   │   ├── hooks/useAuth.jsx    # Auth context
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   └── WorkOrdersPage.jsx
│   │   ├── services/api.js      # Axios + API calls
│   │   └── App.jsx              # Router + Protected routes
│   └── package.json
└── README.md
```

---

## การติดตั้ง

### 1. ตั้งค่า Google Sheets API

#### 1.1 สร้าง Service Account
1. ไปที่ [Google Cloud Console](https://console.cloud.google.com)
2. สร้าง Project ใหม่ (หรือเลือก Project ที่มีอยู่)
3. เปิดใช้ **Google Sheets API** และ **Google Drive API**
4. ไปที่ IAM & Admin → Service Accounts → Create Service Account
5. ดาวน์โหลด JSON key → เก็บ `client_email` และ `private_key`

#### 1.2 สร้าง Google Sheet หลัก (WorkOrders)
สร้าง Google Sheet ใหม่ และตั้งชื่อ Sheet แรกว่า **WorkOrders**

**row แรก (header) ต้องมี columns ดังนี้:**
```
ref_no | project_name | contractor | sample_type | sample_count | test_age_days | received_date | status | sheet_id | sheet_url | notes | created_by | created_at | compressive_strength | result_status | result_notes
```

Share Sheet นี้กับ Service Account email (ให้สิทธิ์ Editor)

#### 1.3 สร้าง Google Sheet สำหรับ Users
สร้าง Google Sheet ใหม่ ตั้งชื่อ Sheet แรกว่า **Users**

**row แรก (header):**
```
id | username | password_hash | name | role | active
```

**เพิ่ม user ตัวอย่าง** (ใช้ bcrypt hash ของ password):
```
1 | admin | $2a$10$xxx... | ผู้ดูแลระบบ | super_admin | TRUE
```

> สร้าง bcrypt hash ด้วย Node.js:
> ```js
> const bcrypt = require('bcryptjs')
> console.log(await bcrypt.hash('your_password', 10))
> ```

---

### 2. ติดตั้ง Backend

```bash
cd backend
cp .env.example .env
# แก้ไข .env ให้ครบ
npm install
npm run dev
```

Backend จะรันที่ `http://localhost:5000`

### 3. ติดตั้ง Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend จะรันที่ `http://localhost:5173`

---

## Environment Variables (backend/.env)

```env
PORT=5000
NODE_ENV=development

JWT_SECRET=your_very_secret_key_here
JWT_EXPIRES_IN=8h

GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"

USERS_SHEET_ID=1abc...xyz          # ID ของ Sheet ผู้ใช้
WORKORDERS_SHEET_ID=1def...uvw     # ID ของ Sheet ใบงาน
TEMPLATE_SHEET_ID=1ghi...rst       # (optional) Sheet template สำหรับ copy

FRONTEND_URL=http://localhost:5173
```

> **Sheet ID** คือส่วนใน URL ของ Google Sheets:
> `https://docs.google.com/spreadsheets/d/**SHEET_ID_HERE**/edit`

---

## API Endpoints

| Method | Path | คำอธิบาย |
|--------|------|-----------|
| POST | `/api/auth/login` | เข้าสู่ระบบ |
| GET  | `/api/auth/me` | ดูข้อมูล user ปัจจุบัน |
| GET  | `/api/workorders` | รายการใบงานทั้งหมด (query: status, search, page, limit) |
| GET  | `/api/workorders/stats` | สถิติสำหรับ Dashboard |
| GET  | `/api/workorders/:refNo` | ดูรายละเอียดใบงาน |
| POST | `/api/workorders` | สร้างใบงานใหม่ |
| PATCH | `/api/workorders/:refNo/status` | อัปเดตสถานะ |
| PATCH | `/api/workorders/:refNo/result` | บันทึกผลทดสอบ |

---

## REF NO. Format

รูปแบบ: **YYMMDDXX**
- YY = ปี 2 หลัก (เช่น 26 = 2569)
- MM = เดือน 2 หลัก
- DD = วันที่ 2 หลัก
- XX = ลำดับงานของวันนั้น (01, 02, ...)

ตัวอย่าง: `26042901` = งานที่ 1 ของวันที่ 29 เมษายน 2569

---

## Deploy (Cloud)

### Railway (แนะนำ)
1. Push โค้ดไป GitHub
2. สร้าง Project ใน [Railway](https://railway.app)
3. เพิ่ม environment variables
4. Deploy backend และ frontend แยกกัน

### หรือ Render.com
- Backend: Web Service (Node.js)
- Frontend: Static Site (build command: `npm run build`)
