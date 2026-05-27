# ELD Trip Planner

Full-stack app for FMCSA Hours of Service planning. Built with Django + React.

## Stack
- **Backend**: Django + Django REST Framework — HOS calculation engine
- **Frontend**: React (Vite) + Leaflet maps + Canvas ELD log sheets
- **Deploy**: Railway (backend) + Vercel (frontend)

## HOS Rules Implemented
- 11h max driving per day
- 14h on-duty window
- 10h mandatory rest between shifts
- 30-min break after 8h consecutive driving
- 70h/8-day cycle limit (property-carrying)
- Fuel stop every 1,000 miles (30 min)
- 1 hour for pickup & dropoff

---

## Local Development

### 1. Clone & setup

```bash
git clone <your-repo-url>
cd eld-trip-planner
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env — add your ORS_API_KEY (get free at openrouteservice.org)

python manage.py migrate
python manage.py runserver
# → http://localhost:8000
```

### 3. Frontend

```bash
cd frontend
npm install

# Create .env.local (optional — defaults to /api proxy → localhost:8000)
cp .env.example .env.local

npm run dev
# → http://localhost:5173
```

### 4. Get a free ORS API key (optional but recommended)
1. Go to https://openrouteservice.org/dev/#/signup
2. Create free account
3. Copy your API key → paste in backend `.env` as `ORS_API_KEY=...`
4. Without the key, the app falls back to OSRM (still works, no key needed)

---

## Deployment

### Backend → Railway.app

1. Push code to GitHub
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Select the `backend/` folder (or set root directory to `backend`)
4. Add environment variables in Railway dashboard:
   ```
   SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(50))">
   DEBUG=False
   ALLOWED_HOSTS=your-app.railway.app
   ORS_API_KEY=your-ors-key
   ```
5. Railway auto-detects Python and runs `nixpacks.toml` build steps
6. Copy your Railway URL: `https://your-app.railway.app`

### Frontend → Vercel

1. Update `frontend/vercel.json` — replace the API rewrite destination with your Railway URL
2. Go to https://vercel.com → New Project → Import from GitHub
3. Set **Root Directory** to `frontend`
4. Add environment variable:
   ```
   VITE_API_URL=https://your-app.railway.app/api
   ```
5. Deploy!

---

## API Reference

### POST /api/trips/plan/

**Request:**
```json
{
  "current_location": "Chicago, IL",
  "pickup_location": "Dallas, TX",
  "dropoff_location": "Los Angeles, CA",
  "current_cycle_used": 20.0
}
```

**Response:**
```json
{
  "locations": { "current": {...}, "pickup": {...}, "dropoff": {...} },
  "route": {
    "total_miles": 1742.3,
    "polyline": [[lat, lng], ...],
    "bbox": {...}
  },
  "stops": [...],
  "rest_markers": [...],
  "hos_plan": {
    "total_days": 3,
    "total_drive_hours": 28.5,
    "days": [
      {
        "day": 1,
        "events": [
          { "status": "on_duty_not_driving", "start_hour": 0, "end_hour": 0.25, "label": "Pre-trip Inspection" },
          { "status": "driving", "start_hour": 0.25, "end_hour": 11.25, "label": "Driving (550 mi)" },
          ...
        ],
        "total_drive_hours": 11.0,
        "miles_driven": 550.0
      }
    ]
  }
}
```

### GET /api/trips/geocode/?q=Chicago,IL

Returns `{ lat, lng, display_name }` for a location string.

---

## Project Structure

```
eld-trip-planner/
├── backend/
│   ├── core/            Django project settings & urls
│   ├── trips/
│   │   ├── hos_calculator.py   ← HOS business logic
│   │   ├── route_service.py    ← ORS/OSRM geocoding & routing
│   │   └── views.py            ← REST API endpoints
│   ├── requirements.txt
│   ├── Procfile         Railway start command
│   └── nixpacks.toml    Railway build config
└── frontend/
    ├── src/
    │   ├── App.jsx              Main layout
    │   ├── components/
    │   │   ├── TripForm.jsx     Input form
    │   │   ├── RouteMap.jsx     Leaflet map
    │   │   ├── EldLogSheet.jsx  Canvas ELD log drawer
    │   │   └── TripSummary.jsx  Sidebar summary
    │   └── api/tripApi.js       Axios client
    ├── vercel.json
    └── vite.config.js
```
