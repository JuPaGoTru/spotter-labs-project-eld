import { useState } from 'react'
import TripForm from './components/TripForm'
import RouteMap from './components/RouteMap'
import EldLogSheet from './components/EldLogSheet'
import TripSummary from './components/TripSummary'
import { planTrip } from './api/tripApi'
import styles from './App.module.css'

export default function App() {
  const [tripData, setTripData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeDay, setActiveDay] = useState(0)

  async function handleSubmit(formValues) {
    setLoading(true)
    setError(null)
    setTripData(null)
    setActiveDay(0)
    try {
      const data = await planTrip(formValues)
      setTripData(data)
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'An error occurred'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>⊞</span>
            <span className={styles.logoText}>ELD<span className={styles.logoAccent}>Trip</span></span>
          </div>
          <div className={styles.headerSub}>
            FMCSA Hours of Service Planner — 70hr/8-day Property Carrier
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.sidebar}>
          <TripForm onSubmit={handleSubmit} loading={loading} />

          {error && (
            <div className={styles.errorBox}>
              <span className={styles.errorIcon}>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className={styles.loadingBox}>
              <div className={styles.spinner} />
              <span>Calculating route & HOS schedule…</span>
            </div>
          )}

          {tripData && (
            <TripSummary
              data={tripData}
              activeDay={activeDay}
              onSelectDay={setActiveDay}
            />
          )}
        </div>

        <div className={styles.content}>
          {!tripData && !loading && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🚛</div>
              <h2>Enter trip details to get started</h2>
              <p>The planner will calculate your route, HOS-compliant rest stops, and generate daily ELD log sheets automatically.</p>
              <div className={styles.rulesGrid}>
                {[
                  ['11h', 'Max driving per day'],
                  ['14h', 'On-duty window'],
                  ['10h', 'Required rest'],
                  ['30m', 'Break after 8h drive'],
                  ['70h', '8-day cycle limit'],
                  ['1000mi', 'Fueling interval'],
                ].map(([val, label]) => (
                  <div key={val} className={styles.ruleCard}>
                    <span className={styles.ruleVal}>{val}</span>
                    <span className={styles.ruleLabel}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tripData && (
            <div className={styles.results}>
              <RouteMap data={tripData} />

              <div className={styles.logsSection}>
                <div className={styles.logsSectionHeader}>
                  <h2 className={styles.logsTitle}>Daily ELD Log Sheets</h2>
                  <div className={styles.dayTabs}>
                    {tripData.hos_plan.days.map((day, i) => (
                      <button
                        key={i}
                        className={`${styles.dayTab} ${activeDay === i ? styles.dayTabActive : ''}`}
                        onClick={() => setActiveDay(i)}
                      >
                        Day {day.day}
                      </button>
                    ))}
                  </div>
                </div>

                {tripData.hos_plan.days.map((day, i) => (
                  <div key={i} style={{ display: activeDay === i ? 'block' : 'none' }}>
                    <EldLogSheet
                      day={day}
                      dayIndex={i}
                      locations={tripData.locations}
                      routeInfo={tripData.route}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
