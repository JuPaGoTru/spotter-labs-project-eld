import styles from './TripSummary.module.css'

const STATUS_COLORS = {
  off_duty: '#64748b',
  sleeper_berth: '#8b5cf6',
  driving: '#22c55e',
  on_duty_not_driving: '#f59e0b',
}

export default function TripSummary({ data, activeDay, onSelectDay }) {
  const { route, hos_plan, locations, stops } = data
  const days = hos_plan?.days || []

  return (
    <div className={styles.container}>
      {/* Route summary */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Trip Summary</div>

        <div className={styles.locationFlow}>
          <div className={styles.locItem}>
            <span className={styles.locDot} style={{ background: '#f5a623' }} />
            <div>
              <div className={styles.locType}>Current Location</div>
              <div className={styles.locName}>{locations?.current?.display_name?.split(',').slice(0, 2).join(',')}</div>
            </div>
          </div>
          <div className={styles.locLine} />
          <div className={styles.locItem}>
            <span className={styles.locDot} style={{ background: '#22c55e' }} />
            <div>
              <div className={styles.locType}>Pickup</div>
              <div className={styles.locName}>{locations?.pickup?.display_name?.split(',').slice(0, 2).join(',')}</div>
            </div>
          </div>
          <div className={styles.locLine} />
          <div className={styles.locItem}>
            <span className={styles.locDot} style={{ background: '#ef4444' }} />
            <div>
              <div className={styles.locType}>Dropoff</div>
              <div className={styles.locName}>{locations?.dropoff?.display_name?.split(',').slice(0, 2).join(',')}</div>
            </div>
          </div>
        </div>

        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span className={styles.statVal}>{route?.total_miles?.toLocaleString()}</span>
            <span className={styles.statLabel}>Total Miles</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statVal}>{hos_plan?.total_days}</span>
            <span className={styles.statLabel}>Days</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statVal}>{hos_plan?.total_drive_hours}h</span>
            <span className={styles.statLabel}>Drive Time</span>
          </div>
        </div>
      </div>

      {/* Fuel stops */}
      {stops?.filter(s => s.type === 'fuel').length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Fuel Stops</div>
          {stops.filter(s => s.type === 'fuel').map((s, i) => (
            <div key={i} className={styles.fuelStop}>
              <span className={styles.fuelIcon}>⛽</span>
              <span className={styles.fuelLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Day-by-day breakdown */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Daily Breakdown</div>
        {days.map((day, i) => (
          <div
            key={i}
            className={`${styles.dayRow} ${activeDay === i ? styles.dayRowActive : ''}`}
            onClick={() => onSelectDay(i)}
          >
            <div className={styles.dayHeader}>
              <span className={styles.dayNum}>Day {day.day}</span>
              <span className={styles.dayMiles}>{day.miles_driven?.toFixed(0)} mi</span>
            </div>

            {/* Mini timeline */}
            <div className={styles.miniTimeline}>
              {day.events.map((ev, j) => {
                const widthPct = (ev.duration / 24) * 100
                return (
                  <div
                    key={j}
                    className={styles.miniSegment}
                    style={{
                      width: `${widthPct}%`,
                      background: STATUS_COLORS[ev.status] || '#444',
                    }}
                    title={`${ev.label} (${ev.duration.toFixed(2)}h)`}
                  />
                )
              })}
            </div>

            <div className={styles.dayStats}>
              <span>🚛 {day.total_drive_hours}h drive</span>
              <span>💤 {day.events.filter(e => e.status === 'off_duty' || e.status === 'sleeper_berth').reduce((s, e) => s + e.duration, 0).toFixed(1)}h rest</span>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Status Legend</div>
        <div className={styles.legend}>
          {[
            ['off_duty', '1. Off Duty'],
            ['sleeper_berth', '2. Sleeper Berth'],
            ['driving', '3. Driving'],
            ['on_duty_not_driving', '4. On Duty (Not Driving)'],
          ].map(([key, label]) => (
            <div key={key} className={styles.legendItem}>
              <span
                className={styles.legendColor}
                style={{ background: STATUS_COLORS[key] }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
