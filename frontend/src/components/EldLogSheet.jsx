import { useEffect, useRef } from 'react'
import styles from './EldLogSheet.module.css'

// Status row indices (matching the official form order)
const STATUS_ROWS = [
  { key: 'off_duty',          label: '1. Off Duty',              color: '#64748b' },
  { key: 'sleeper_berth',     label: '2. Sleeper Berth',         color: '#8b5cf6' },
  { key: 'driving',           label: '3. Driving',               color: '#22c55e' },
  { key: 'on_duty_not_driving', label: '4. On Duty (Not Driving)', color: '#f59e0b' },
]

// Canvas layout constants
const C = {
  W: 900,
  H: 620,
  // Grid area
  GRID_X: 90,
  GRID_Y: 240,
  GRID_W: 790,
  GRID_H: 160,  // total for all 4 rows
  ROW_H: 40,    // height per status row
  // Colors
  BG: '#ffffff',
  HEADER_BG: '#1a1a2e',
  GRID_BG: '#f8f9fa',
  GRID_LINE: '#cccccc',
  TEXT: '#1a1a2e',
  TEXT_LIGHT: '#666666',
  ACCENT: '#f5a623',
}

export default function EldLogSheet({ day, dayIndex, locations, routeInfo }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!day || !canvasRef.current) return
    drawLog(canvasRef.current, day, dayIndex, locations, routeInfo)
  }, [day, dayIndex, locations, routeInfo])

  function downloadLog() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `eld-log-day-${day.day}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  // Compute totals per status for the recap section
  const totals = {}
  STATUS_ROWS.forEach(r => { totals[r.key] = 0 })
  day.events.forEach(ev => {
    if (totals[ev.status] !== undefined) {
      totals[ev.status] += ev.duration
    }
  })

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.dayBadge}>Day {day.day}</div>
        <div className={styles.headerInfo}>
          <span>{day.miles_driven?.toFixed(0)} miles driven today</span>
          <span className={styles.dot}>·</span>
          <span>{day.total_drive_hours}h drive</span>
          <span className={styles.dot}>·</span>
          <span>{day.total_on_duty_hours}h on-duty</span>
        </div>
        <button className={styles.downloadBtn} onClick={downloadLog}>
          ↓ Download PNG
        </button>
      </div>

      <div className={styles.canvasWrapper}>
        <canvas
          ref={canvasRef}
          width={C.W}
          height={C.H}
          className={styles.canvas}
        />
      </div>

      {/* Events timeline below canvas */}
      <div className={styles.eventsTable}>
        <div className={styles.eventsTitle}>Duty Status Events</div>
        <div className={styles.events}>
          {day.events.map((ev, i) => {
            const row = STATUS_ROWS.find(r => r.key === ev.status)
            return (
              <div key={i} className={styles.event}>
                <span
                  className={styles.eventDot}
                  style={{ background: row?.color }}
                />
                <span className={styles.eventTime}>
                  {formatHour(ev.start_hour)} – {formatHour(ev.end_hour)}
                </span>
                <span className={styles.eventLabel}>{ev.label}</span>
                <span className={styles.eventDur}>{(ev.duration * 60).toFixed(0)} min</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recap totals */}
      <div className={styles.recap}>
        <div className={styles.recapTitle}>Daily Recap</div>
        <div className={styles.recapGrid}>
          {STATUS_ROWS.map(row => (
            <div key={row.key} className={styles.recapItem}>
              <span
                className={styles.recapColor}
                style={{ background: row.color }}
              />
              <div className={styles.recapInfo}>
                <span className={styles.recapLabel}>{row.label}</span>
                <span className={styles.recapVal}>{totals[row.key].toFixed(2)}h</span>
              </div>
            </div>
          ))}
          <div className={styles.recapItem}>
            <span className={styles.recapColor} style={{ background: '#e8edf5' }} />
            <div className={styles.recapInfo}>
              <span className={styles.recapLabel}>Cycle Used (end of day)</span>
              <span className={styles.recapVal}>{day.cycle_used_end}h / 70h</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Canvas drawing ─────────────────────────────────── */

function drawLog(canvas, day, dayIndex, locations, routeInfo) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, C.W, C.H)

  // White background
  ctx.fillStyle = C.BG
  ctx.fillRect(0, 0, C.W, C.H)

  drawHeader(ctx, day, dayIndex, locations, routeInfo)
  drawGrid(ctx, day)
  drawRemarks(ctx, day)
  drawRecap(ctx, day)
}

function drawHeader(ctx, day, dayIndex, locations, routeInfo) {
  // ── Top bar ────────────────────────────────────────────────
  ctx.fillStyle = C.HEADER_BG
  ctx.fillRect(0, 0, C.W, 36)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 14px Space Mono, monospace'
  ctx.fillText("Driver's Daily Log", 12, 23)
  ctx.font = '11px Space Mono, monospace'
  ctx.fillStyle = '#f5a623'
  ctx.fillText('(24 hours)  Property Carrier — 70hr/8-day Rule', 220, 23)
  ctx.fillStyle = '#aaaaaa'
  ctx.font = '10px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('Original — File at home terminal', C.W - 12, 15)
  ctx.fillText('Duplicate — Driver retains for 8 days', C.W - 12, 27)
  ctx.textAlign = 'left'

  // ── Date / Day row ─────────────────────────────────────────
  const tripDate = new Date()
  tripDate.setDate(tripDate.getDate() + dayIndex)
  const month = String(tripDate.getMonth() + 1).padStart(2, '0')
  const dday  = String(tripDate.getDate()).padStart(2, '0')
  const year  = tripDate.getFullYear()

  ctx.fillStyle = C.TEXT
  ctx.font = '11px sans-serif'
  ctx.fillText(`${month}`, 140, 52); ctx.fillText('(month)', 130, 62)
  ctx.fillText(`${dday}`,  210, 52); ctx.fillText('(day)',   205, 62)
  ctx.fillText(`${year}`,  270, 52); ctx.fillText('(year)',  265, 62)
  // underlines
  ;[[125,155],[195,235],[255,310]].forEach(([x1,x2]) => {
    ctx.beginPath(); ctx.strokeStyle='#999'; ctx.lineWidth=0.5
    ctx.moveTo(x1,54); ctx.lineTo(x2,54); ctx.stroke()
  })

  ctx.font = 'bold 11px sans-serif'
  ctx.fillText('From:', 12, 80)
  ctx.font = '11px sans-serif'
  const fromName = locations?.current?.display_name?.split(',').slice(0,2).join(',') || '—'
  ctx.fillText(fromName, 55, 80)

  ctx.font = 'bold 11px sans-serif'
  ctx.fillText('To:', 460, 80)
  ctx.font = '11px sans-serif'
  const toName = locations?.dropoff?.display_name?.split(',').slice(0,2).join(',') || '—'
  ctx.fillText(toName, 485, 80)

  // ── Mileage boxes ──────────────────────────────────────────
  ;[
    [12,  90, 155, 40, 'Total Miles Driving Today', day.miles_driven?.toFixed(0) || '0'],
    [175, 90, 155, 40, 'Total Mileage Today',       day.miles_total?.toFixed(0)  || '0'],
  ].forEach(([x, y, w, h, label, val]) => {
    roundRect(ctx, x, y, w, h, 3)
    ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = C.TEXT
    ctx.font = 'bold 9px sans-serif'
    ctx.fillText(label, x + 4, y + 13)
    ctx.font = 'bold 18px Space Mono, monospace'
    ctx.fillStyle = C.ACCENT
    ctx.fillText(val, x + 10, y + 32)
  })

  // ── Carrier / Truck info (right column) ───────────────────
  const rightX = 340
  const fields = [
    ['Name of Carrier or Carriers:', '(Your Carrier Name Here)',    rightX, 98],
    ['Main Office Address:',          '(Main Office Address Here)', rightX, 116],
    ['Home Terminal Address:',        '(Home Terminal Address)',    rightX, 134],
  ]
  fields.forEach(([label, val, x, y]) => {
    ctx.fillStyle = C.TEXT
    ctx.font = 'bold 9px sans-serif'
    ctx.fillText(label, x, y)
    ctx.font = '10px sans-serif'
    ctx.fillStyle = '#555'
    ctx.fillText(val, x + ctx.measureText(label).width + 6, y)
  })

  // Truck/Trailer
  ctx.fillStyle = C.TEXT
  ctx.font = 'bold 9px sans-serif'
  ctx.fillText('Truck/Tractor & Trailer Numbers or License Plate(s)/State (show each unit):', 12, 148)
  ctx.font = '10px sans-serif'; ctx.fillStyle = '#555'
  ctx.fillText('(Unit Numbers Here)', 12, 160)

  // ── Shipping Documents section ─────────────────────────────
  const sdY = 170
  ctx.fillStyle = '#f5f5f5'
  ctx.fillRect(C.GRID_X, sdY, C.GRID_W, 52)
  ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 0.5
  ctx.strokeRect(C.GRID_X, sdY, C.GRID_W, 52)

  ctx.fillStyle = C.TEXT
  ctx.font = 'bold 9px sans-serif'
  ctx.fillText('Shipping Documents:', C.GRID_X + 6, sdY + 12)
  ctx.font = '9px sans-serif'; ctx.fillStyle = '#555'
  ctx.fillText('(Bill of Lading / Manifest Numbers Here)', C.GRID_X + 6, sdY + 24)

  ctx.fillStyle = C.TEXT
  ctx.font = 'bold 9px sans-serif'
  ctx.fillText('DVL or Manifest No.:', C.GRID_X + 280, sdY + 12)
  ctx.font = '9px sans-serif'; ctx.fillStyle = '#555'
  ctx.fillText('________________', C.GRID_X + 390, sdY + 12)

  ctx.fillStyle = C.TEXT
  ctx.font = 'bold 9px sans-serif'
  ctx.fillText('Shipper & Commodity:', C.GRID_X + 280, sdY + 26)
  ctx.font = '9px sans-serif'; ctx.fillStyle = '#555'
  ctx.fillText('(Commodity Description Here)', C.GRID_X + 390, sdY + 26)

  ctx.font = '8px sans-serif'; ctx.fillStyle = '#888'
  ctx.fillText(
    'Enter name of place you reported and where released from work and when and where each change of duty occurred.',
    C.GRID_X + 6, sdY + 40
  )
  ctx.fillText('Use time standard of home terminal.', C.GRID_X + 6, sdY + 50)
}

function drawGrid(ctx, day) {
  const { GRID_X, GRID_Y, GRID_W, GRID_H, ROW_H } = C

  // Background
  ctx.fillStyle = C.GRID_BG
  ctx.fillRect(GRID_X, GRID_Y, GRID_W, GRID_H)

  // Hour lines (24 hours + midnight)
  const hourW = GRID_W / 24

  // Draw hour columns
  for (let h = 0; h <= 24; h++) {
    const x = GRID_X + h * hourW
    ctx.beginPath()
    ctx.strokeStyle = h % 6 === 0 ? '#888888' : C.GRID_LINE
    ctx.lineWidth = h % 6 === 0 ? 1.5 : 0.5
    ctx.moveTo(x, GRID_Y - 20)
    ctx.lineTo(x, GRID_Y + GRID_H)
    ctx.stroke()

    // Half-hour tick
    if (h < 24) {
      const xHalf = x + hourW / 2
      ctx.beginPath()
      ctx.strokeStyle = '#dddddd'
      ctx.lineWidth = 0.5
      ctx.moveTo(xHalf, GRID_Y)
      ctx.lineTo(xHalf, GRID_Y + GRID_H)
      ctx.stroke()
    }
  }

  // Hour labels above grid
  ctx.fillStyle = C.TEXT
  ctx.font = '9px Space Mono, monospace'
  ctx.textAlign = 'center'

  const hourLabels = ['Mid-\nnight', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'Noon',
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'Mid-\nnight']

  hourLabels.forEach((label, h) => {
    const x = GRID_X + h * hourW
    if (label.includes('\n')) {
      const parts = label.split('\n')
      ctx.fillText(parts[0], x, GRID_Y - 12)
      ctx.fillText(parts[1], x, GRID_Y - 3)
    } else {
      ctx.fillText(label, x, GRID_Y - 6)
    }
  })

  // "Total Hours" header
  ctx.textAlign = 'left'
  ctx.font = 'bold 9px sans-serif'
  ctx.fillText('Total\nHours', GRID_X + GRID_W + 4, GRID_Y - 8)

  // Row separators and labels
  STATUS_ROWS.forEach((row, rowIdx) => {
    const rowY = GRID_Y + rowIdx * ROW_H

    // Row background (alternating)
    ctx.fillStyle = rowIdx % 2 === 0 ? '#f8f9fa' : '#f0f2f5'
    ctx.fillRect(GRID_X, rowY, GRID_W, ROW_H)

    // Row border
    ctx.beginPath()
    ctx.strokeStyle = '#bbbbbb'
    ctx.lineWidth = 1
    ctx.moveTo(GRID_X, rowY)
    ctx.lineTo(GRID_X + GRID_W, rowY)
    ctx.stroke()

    // Row label (left)
    ctx.fillStyle = C.TEXT
    ctx.font = 'bold 9px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(row.label, GRID_X - 4, rowY + ROW_H / 2 + 3)

    // Draw duty-status segments for this row
    const rowEvents = day.events.filter(ev => ev.status === row.key)
    rowEvents.forEach(ev => {
      const x = GRID_X + (ev.start_hour / 24) * GRID_W
      const w = ((ev.end_hour - ev.start_hour) / 24) * GRID_W
      if (w <= 0) return

      // Filled bar
      ctx.fillStyle = row.color + 'cc'  // semi-transparent
      ctx.fillRect(x, rowY + 4, w, ROW_H - 8)

      // Solid top border line (the "graph" line)
      ctx.beginPath()
      ctx.strokeStyle = row.color
      ctx.lineWidth = 3
      ctx.moveTo(x, rowY + 4)
      ctx.lineTo(x + w, rowY + 4)
      ctx.stroke()

      // Vertical tick marks at start/end
      ctx.beginPath()
      ctx.strokeStyle = row.color
      ctx.lineWidth = 2
      ctx.moveTo(x, rowY + 2)
      ctx.lineTo(x, rowY + ROW_H - 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x + w, rowY + 2)
      ctx.lineTo(x + w, rowY + ROW_H - 2)
      ctx.stroke()
    })

    // Total hours for this row
    const totalH = rowEvents.reduce((sum, ev) => sum + ev.duration, 0)
    ctx.fillStyle = C.TEXT
    ctx.textAlign = 'left'
    ctx.font = 'bold 10px Space Mono, monospace'
    ctx.fillText(totalH.toFixed(1), GRID_X + GRID_W + 4, rowY + ROW_H / 2 + 4)
  })

  // Bottom border
  ctx.beginPath()
  ctx.strokeStyle = '#888888'
  ctx.lineWidth = 1.5
  ctx.moveTo(GRID_X, GRID_Y + GRID_H)
  ctx.lineTo(GRID_X + GRID_W, GRID_Y + GRID_H)
  ctx.stroke()

  ctx.textAlign = 'left'
}

function drawRemarks(ctx, day) {
  const y = C.GRID_Y + C.GRID_H + 16

  ctx.fillStyle = C.TEXT
  ctx.font = 'bold 11px sans-serif'
  ctx.fillText('Remarks:', C.GRID_X, y)

  // Underline
  ctx.beginPath(); ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 0.5
  ctx.moveTo(C.GRID_X, y + 4); ctx.lineTo(C.GRID_X + C.GRID_W, y + 4); ctx.stroke()

  ctx.font = '11px sans-serif'; ctx.fillStyle = '#333333'
  const maxW = C.GRID_W - 10
  const words = day.remarks.split(' ')
  let line = '', lineY = y + 18
  words.forEach(word => {
    const test = line + (line ? ' ' : '') + word
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, C.GRID_X, lineY); line = word; lineY += 15
    } else { line = test }
  })
  if (line) ctx.fillText(line, C.GRID_X, lineY)

  // Second underline
  ctx.beginPath(); ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 0.5
  ctx.moveTo(C.GRID_X, y + 34); ctx.lineTo(C.GRID_X + C.GRID_W, y + 34); ctx.stroke()
}

function drawRecap(ctx, day) {
  const recapY = C.H - 90
  ctx.fillStyle = '#f0f2f5'
  ctx.fillRect(C.GRID_X, recapY, C.GRID_W, 80)
  ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 1
  ctx.strokeRect(C.GRID_X, recapY, C.GRID_W, 80)

  // Title
  ctx.fillStyle = C.TEXT; ctx.font = 'bold 10px sans-serif'
  ctx.fillText('Recap — Complete at end of day:', C.GRID_X + 8, recapY + 14)
  ctx.font = '9px sans-serif'
  ctx.fillText('70 Hour / 8 Day Driver', C.GRID_X + 8, recapY + 26)

  // Divider
  ctx.beginPath(); ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 0.5
  ctx.moveTo(C.GRID_X + 8, recapY + 30); ctx.lineTo(C.GRID_X + C.GRID_W - 8, recapY + 30); ctx.stroke()

  const onDutyTotal = day.events
    .filter(ev => ev.status === 'driving' || ev.status === 'on_duty_not_driving')
    .reduce((s, ev) => s + ev.duration, 0)
  const avail = Math.max(0, 70 - day.cycle_used_end)

  // Three columns
  const cols = [
    { label: 'A. On Duty Hours Today',         val: `${onDutyTotal.toFixed(2)}h`,        x: C.GRID_X + 8 },
    { label: 'B. Total Hours Last 8 Days',      val: `${day.cycle_used_end}h / 70h`,      x: C.GRID_X + 280 },
    { label: 'C. Hours Available Tomorrow',     val: `${avail.toFixed(2)}h`,              x: C.GRID_X + 560 },
  ]
  cols.forEach(({ label, val, x }) => {
    ctx.fillStyle = '#666'; ctx.font = '9px sans-serif'
    ctx.fillText(label, x, recapY + 46)
    ctx.fillStyle = C.ACCENT; ctx.font = 'bold 14px Space Mono, monospace'
    ctx.fillText(val, x, recapY + 64)
  })

  // Note about 34hr restart
  ctx.fillStyle = '#888'; ctx.font = '8px sans-serif'
  ctx.fillText('*If you took 34 consecutive hours off duty, you have 70 hrs available', C.GRID_X + 8, recapY + 76)
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function formatHour(h) {
  if (h === 0 || h === 24) return '12:00 AM'
  if (h === 12) return '12:00 PM'
  const hour = Math.floor(h)
  const min = Math.round((h - hour) * 60)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayH = hour > 12 ? hour - 12 : hour
  return `${displayH}:${min.toString().padStart(2, '0')} ${ampm}`
}
