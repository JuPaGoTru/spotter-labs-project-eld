import { useState } from 'react'
import styles from './TripForm.module.css'

const EXAMPLES = {
  currentLocation: 'Chicago, IL',
  pickupLocation: 'Dallas, TX',
  dropoffLocation: 'Los Angeles, CA',
  currentCycleUsed: '20',
}

export default function TripForm({ onSubmit, loading }) {
  const [form, setForm] = useState({
    currentLocation: '',
    pickupLocation: '',
    dropoffLocation: '',
    currentCycleUsed: '',
  })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      ...form,
      currentCycleUsed: parseFloat(form.currentCycleUsed) || 0,
    })
  }

  function fillExample() {
    setForm(EXAMPLES)
  }

  const isValid = form.currentLocation && form.pickupLocation &&
    form.dropoffLocation && form.currentCycleUsed !== ''

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>Trip Details</h2>
        <button type="button" className={styles.exampleBtn} onClick={fillExample}>
          Load Example
        </button>
      </div>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.label}>
            <span className={styles.labelIcon}>📍</span>
            Current Location
          </label>
          <input
            className={styles.input}
            name="currentLocation"
            value={form.currentLocation}
            onChange={handleChange}
            placeholder="e.g. Chicago, IL"
            required
            disabled={loading}
          />
        </div>

        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>ROUTE</span>
          <span className={styles.dividerLine} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            <span className={styles.labelIcon}>📦</span>
            Pickup Location
          </label>
          <input
            className={styles.input}
            name="pickupLocation"
            value={form.pickupLocation}
            onChange={handleChange}
            placeholder="e.g. Dallas, TX"
            required
            disabled={loading}
          />
        </div>

        <div className={styles.routeConnector}>
          <div className={styles.connectorLine} />
          <span className={styles.connectorLabel}>Delivery Route</span>
          <div className={styles.connectorLine} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            <span className={styles.labelIcon}>🏁</span>
            Dropoff Location
          </label>
          <input
            className={styles.input}
            name="dropoffLocation"
            value={form.dropoffLocation}
            onChange={handleChange}
            placeholder="e.g. Los Angeles, CA"
            required
            disabled={loading}
          />
        </div>

        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>HOS STATUS</span>
          <span className={styles.dividerLine} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            <span className={styles.labelIcon}>⏱</span>
            Current Cycle Used (Hrs)
            <span className={styles.labelHint}>0 – 70 hrs</span>
          </label>
          <input
            className={styles.input}
            name="currentCycleUsed"
            type="number"
            min="0"
            max="70"
            step="0.5"
            value={form.currentCycleUsed}
            onChange={handleChange}
            placeholder="e.g. 20"
            required
            disabled={loading}
          />
          {form.currentCycleUsed !== '' && (
            <div className={styles.cycleBar}>
              <div
                className={styles.cycleBarFill}
                style={{
                  width: `${Math.min((parseFloat(form.currentCycleUsed) / 70) * 100, 100)}%`,
                  background: parseFloat(form.currentCycleUsed) > 60 ? 'var(--red)' :
                               parseFloat(form.currentCycleUsed) > 40 ? 'var(--yellow)' : 'var(--green)',
                }}
              />
            </div>
          )}
          <div className={styles.cycleLabels}>
            <span>0h</span>
            <span>35h</span>
            <span>70h</span>
          </div>
        </div>
      </div>

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={loading || !isValid}
      >
        {loading ? (
          <>
            <span className={styles.btnSpinner} />
            Planning Route…
          </>
        ) : (
          <>
            <span>⊞</span>
            Calculate ELD Plan
          </>
        )}
      </button>

      <div className={styles.assumptions}>
        <p className={styles.assumptionsTitle}>Assumptions</p>
        <ul className={styles.assumptionsList}>
          <li>Property-carrying driver, 70hr/8-day rule</li>
          <li>Avg speed: 55 mph</li>
          <li>Fueling every 1,000 miles (30 min stop)</li>
          <li>1 hour for pickup & dropoff each</li>
          <li>No adverse driving conditions</li>
        </ul>
      </div>
    </form>
  )
}
