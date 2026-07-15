import { useEffect, useRef, useState } from 'react'
import { workorderAPI } from '../services/api'

export default function WorkOrderSelector({ value, onSelect, placeholder = 'ค้นหา REF NO., โครงการ, ผู้รับเหมา...' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    const onClickOutside = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    setLoading(true)
    const t = setTimeout(() => {
      workorderAPI.getAll({ search: query, limit: 10 })
        .then(({ data }) => setResults(data.data || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const handleSelect = (order) => {
    onSelect(order)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="relative">
        <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={value ? `${value.ref_no} — ${value.project_name || ''}` : placeholder}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 bg-white"
        />
      </div>
      {open && query.trim() && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-3 text-xs text-gray-400 flex items-center gap-2">
              <i className="ti ti-loader-2 animate-spin" /> กำลังค้นหา...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-xs text-gray-400">ไม่พบใบงาน</div>
          ) : (
            results.map((o) => (
              <button
                key={o.ref_no}
                onClick={() => handleSelect(o)}
                className="w-full text-left px-4 py-2.5 hover:bg-orange-50 border-b border-gray-50 last:border-0"
              >
                <p className="text-sm font-medium text-orange-500">{o.ref_no}</p>
                <p className="text-xs text-gray-500 truncate">{o.project_name || '—'} {o.contractor ? `· ${o.contractor}` : ''}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
