export default function AdminWorkorderTemplatesPage() {
  return (
    <div className="p-6">
      <div>
        <h1 className="text-base font-medium text-gray-800">จัดการใบงาน</h1>
        <p className="text-xs text-gray-400 mt-0.5">อัปโหลดไฟล์ Excel เพื่อกำหนดรูปแบบ Sheet ใบรับงานของแต่ละประเภทการทดสอบ</p>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 min-h-96">
        <i className="ti ti-tools text-4xl text-gray-200" />
        <p className="text-gray-400 text-sm">จัดการใบงานยังไม่พร้อมใช้งาน</p>
      </div>
    </div>
  )
}
