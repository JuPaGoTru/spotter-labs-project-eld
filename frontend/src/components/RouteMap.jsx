import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import styles from './RouteMap.module.css'

// Fix Leaflet default marker icon broken by Vite bundling
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const STOP_COLORS = {
  origin:   '#f5a623',
  pickup:   '#22c55e',
  dropoff:  '#ef4444',
  fuel:     '#3b82f6',
  rest:     '#8b5cf6',
}

const STOP_ICONS = {
  origin:  '📍',
  pickup:  '📦',
  dropoff: '🏁',
  fuel:    '⛽',
  rest:    '🛌',
}

export default function RouteMap({ data }) {
  const mapRef        = useRef(null)
  const mapInstanceRef = useRef(null)
  const layersRef     = useRef([])

  useEffect(() => {
    if (!data || !mapRef.current) return

    // ── Init map once ──────────────────────────────────────────
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, { zoomControl: true })
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { attribution: '© OpenStreetMap contributors, © CARTO', maxZoom: 19 }
      ).addTo(mapInstanceRef.current)
    }

    const map = mapInstanceRef.current

    // ── Remove old layers ─────────────────────────────────────
    layersRef.current.forEach(l => { try { l.remove() } catch {} })
    layersRef.current = []

    // ── Draw route polyline ───────────────────────────────────
    if (data.route?.polyline?.length) {
      const poly = L.polyline(data.route.polyline, {
        color: '#f5a623',
        weight: 5,
        opacity: 0.9,
      }).addTo(map)
      layersRef.current.push(poly)
      map.fitBounds(poly.getBounds(), { padding: [50, 50] })
    }

    // ── Draw stop markers ─────────────────────────────────────
    const allStops = [...(data.stops || []), ...(data.rest_markers || [])]

    allStops.forEach(stop => {
      const color = STOP_COLORS[stop.type] || '#fff'
      const icon  = STOP_ICONS[stop.type]  || '●'

      const marker = L.circleMarker([stop.lat, stop.lng], {
        radius:      stop.type === 'rest' ? 8 : 11,
        fillColor:   color,
        color:       '#000',
        weight:      2,
        fillOpacity: 0.95,
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:monospace;font-size:13px;line-height:1.7;min-width:170px">
            <strong style="color:${color}">${icon} ${stop.label}</strong><br/>
            ${stop.type === 'fuel'
              ? `Mile marker: ~${stop.mile_marker?.toLocaleString()} mi`
              : ''}
            ${stop.type === 'rest'
              ? `After Day ${stop.day} · Mile ${stop.mile_marker?.toFixed(0)}`
              : ''}
            ${['origin','pickup','dropoff'].includes(stop.type)
              ? (stop.display_name || '')
              : ''}
          </div>`,
          { className: 'dark-popup' }
        )

      layersRef.current.push(marker)
    })

    // ── Invalidate size (fixes blank map on first render) ─────
    setTimeout(() => map.invalidateSize(), 100)

  }, [data])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  const route = data?.route
  const hos   = data?.hos_plan

  return (
    <div className={styles.container}>
      <div className={styles.mapHeader}>
        <div className={styles.mapTitle}>
          <span className={styles.mapTitleIcon}>⊞</span>
          Route Overview
        </div>
        <div className={styles.routeStats}>
          {route && (<>
            <Stat val={route.total_miles?.toLocaleString()} label="Total Miles" />
            <Div />
            <Stat val={hos?.total_days}                     label="Trip Days"   />
            <Div />
            <Stat val={`${hos?.total_drive_hours}h`}        label="Drive Time"  />
            <Div />
            <Stat val={`${route.segment1_miles} mi`}        label="To Pickup"   />
            <Div />
            <Stat val={`${route.segment2_miles} mi`}        label="To Dropoff"  />
          </>)}
        </div>
      </div>

      <div ref={mapRef} className={styles.map} />

      <div className={styles.legend}>
        {Object.entries(STOP_ICONS).map(([type, icon]) => (
          <div key={type} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: STOP_COLORS[type] }} />
            <span>{icon} {type.charAt(0).toUpperCase() + type.slice(1)}</span>
          </div>
        ))}
      </div>

      {/* ── Route Instructions panel ── */}
      {data?.stops && (
        <div className={styles.instructions}>
          <div className={styles.instrTitle}>📋 Route Stop Instructions</div>
          <div className={styles.instrList}>
            {data.stops.map((stop, i) => (
              <div key={i} className={styles.instrItem}>
                <span
                  className={styles.instrDot}
                  style={{ background: STOP_COLORS[stop.type] || '#fff' }}
                />
                <div className={styles.instrInfo}>
                  <span className={styles.instrLabel}>
                    {STOP_ICONS[stop.type]} {stop.label}
                  </span>
                  <span className={styles.instrMile}>
                    Mile {stop.mile_marker?.toLocaleString()}
                    {stop.type === 'fuel' ? ' — 30 min fuel stop (on-duty)' : ''}
                    {stop.type === 'pickup' ? ' — 1 hr pickup / loading' : ''}
                    {stop.type === 'dropoff' ? ' — 1 hr dropoff / unloading' : ''}
                    {stop.type === 'origin' ? ' — Trip start' : ''}
                  </span>
                </div>
              </div>
            ))}
            {data.rest_markers?.map((stop, i) => (
              <div key={`rest-${i}`} className={styles.instrItem}>
                <span className={styles.instrDot} style={{ background: STOP_COLORS.rest }} />
                <div className={styles.instrInfo}>
                  <span className={styles.instrLabel}>🛌 {stop.label}</span>
                  <span className={styles.instrMile}>
                    Mile {stop.mile_marker?.toFixed(0)} — 10 hr mandatory rest (off-duty)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const Stat = ({ val, label }) => (
  <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
    <span style={{ fontFamily:'var(--font-mono)', fontSize:16, fontWeight:700, color:'var(--accent)' }}>{val}</span>
    <span style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</span>
  </div>
)
const Div = () => <div style={{ width:1, height:28, background:'var(--border)' }} />
