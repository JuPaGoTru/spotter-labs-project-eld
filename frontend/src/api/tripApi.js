import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

export async function planTrip({ currentLocation, pickupLocation, dropoffLocation, currentCycleUsed }) {
  const resp = await api.post('/trips/plan/', {
    current_location: currentLocation,
    pickup_location: pickupLocation,
    dropoff_location: dropoffLocation,
    current_cycle_used: currentCycleUsed,
  })
  return resp.data
}

export default api
