// คำนวณค่าที่ derive ได้จากข้อมูลดิบ ใช้ร่วมกันระหว่างหน้าบันทึกผลการทดสอบและใบรายงานผล PDF

// พื้นที่หน้าตัดระบุ (nominal area) ของเหล็กเส้นกลม/ข้ออ้อย = พื้นที่วงกลมตามขนาดระบุ (mm) เช่น "DB12", "RB 9"
export function nominalAreaFromSize(sizeStr) {
  const m = String(sizeStr || '').match(/(\d+(\.\d+)?)/)
  if (!m) return null
  const d = parseFloat(m[1])
  if (!d) return null
  return (Math.PI * (d / 2) ** 2) / 100 // mm² -> cm²
}

// stress (MPa) = แรง (kN) x 10 / พื้นที่ (cm²)
export function stressMPa(loadKN, areaCm2) {
  const load = parseFloat(loadKN)
  const area = parseFloat(areaCm2)
  if (isNaN(load) || isNaN(area) || area <= 0) return null
  return (load * 10) / area
}

export function mpaToKsc(mpa) {
  const v = parseFloat(mpa)
  return isNaN(v) ? null : v * 10.197
}

// พื้นที่หน้าตัด + ปริมาตร จาก DIMENSION 1-3 ตามรูปทรงตัวอย่าง (Cylinder/Coring = กลม ใช้ DIM1=เส้นผ่านศูนย์กลาง, DIM2=ความสูง; Cube = สี่เหลี่ยม ใช้ DIM1xDIM2 เป็นหน้าตัด, DIM3=ความสูง)
export function compressionAreaVolume(sampleType, dim1, dim2, dim3) {
  const d1 = parseFloat(dim1)
  const d2 = parseFloat(dim2)
  const d3 = parseFloat(dim3)
  const shape = (sampleType || '').toLowerCase()
  const isRound = shape === 'cylinder' || shape === 'cylinder cap' || shape === 'coring'

  if (isRound) {
    if (isNaN(d1) || d1 <= 0) return { area: null, volume: null }
    const area = (Math.PI * (d1 / 2) ** 2) // d1 = เส้นผ่านศูนย์กลาง (cm)
    const volume = !isNaN(d2) && d2 > 0 ? area * d2 : null // d2 = ความสูง (cm)
    return { area, volume }
  }
  // สี่เหลี่ยม (Cube ฯลฯ)
  if (isNaN(d1) || isNaN(d2) || d1 <= 0 || d2 <= 0) return { area: null, volume: null }
  const area = d1 * d2
  const volume = !isNaN(d3) && d3 > 0 ? area * d3 : null
  return { area, volume }
}

export function densityGcm3(weightKg, volumeCm3) {
  const wt = parseFloat(weightKg)
  const vol = parseFloat(volumeCm3)
  if (isNaN(wt) || isNaN(vol) || vol <= 0) return null
  return (wt * 1000) / vol
}

export const fmt = (v, digits = 2) => (v == null || isNaN(v) ? '' : Number(v).toFixed(digits))
