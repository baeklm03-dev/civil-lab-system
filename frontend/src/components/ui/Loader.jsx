// 3D cube loading spinner — ใช้แทน loading state แบบเต็มหน้า/เต็มส่วน
export default function Loader({ label, fullScreen }) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="loader-spinner">
        <div /><div /><div /><div /><div /><div />
      </div>
      {label && <span className="text-sm text-gray-400">{label}</span>}
    </div>
  )

  if (fullScreen) {
    return <div className="min-h-screen flex items-center justify-center">{content}</div>
  }

  return <div className="flex items-center justify-center h-full min-h-96">{content}</div>
}
