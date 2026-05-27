"""
OpenRouteService API integration.
Free tier: 2,000 requests/day, no credit card needed.
Sign up at https://openrouteservice.org/
"""
import requests
from django.conf import settings


ORS_BASE = "https://api.openrouteservice.org"


def geocode(address: str) -> dict:
    """
    Convert address string to {lat, lng, display_name}.
    Returns None if not found.
    """
    api_key = settings.ORS_API_KEY

    # Try ORS geocoding first if key available
    if api_key:
        try:
            url = f"{ORS_BASE}/geocode/search"
            resp = requests.get(url, params={
                "api_key": api_key,
                "text": address,
                "size": 1,
            }, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            features = data.get("features", [])
            if features:
                coords = features[0]["geometry"]["coordinates"]
                props = features[0]["properties"]
                return {
                    "lat": coords[1],
                    "lng": coords[0],
                    "display_name": props.get("label", address),
                }
        except Exception:
            pass

    # Fallback: Nominatim (OpenStreetMap) — no key needed
    try:
        url = "https://nominatim.openstreetmap.org/search"
        resp = requests.get(url, params={
            "q": address,
            "format": "json",
            "limit": 1,
        }, headers={"User-Agent": "ELDTripPlanner/1.0"}, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if data:
            return {
                "lat": float(data[0]["lat"]),
                "lng": float(data[0]["lon"]),
                "display_name": data[0].get("display_name", address),
            }
    except Exception as e:
        raise ValueError(f"Geocoding failed for '{address}': {e}")

    raise ValueError(f"Could not geocode address: '{address}'")


def get_route(origin: dict, destination: dict) -> dict:
    """
    Get driving route between two {lat, lng} points.
    Returns {distance_miles, duration_hours, polyline, bbox}.
    polyline is a list of [lat, lng] pairs.
    """
    api_key = settings.ORS_API_KEY

    if api_key:
        try:
            return _ors_route(origin, destination, api_key)
        except Exception:
            pass

    # Fallback: OSRM (completely free, no key)
    return _osrm_route(origin, destination)


def _ors_route(origin: dict, destination: dict, api_key: str) -> dict:
    url = f"{ORS_BASE}/v2/directions/driving-car"
    body = {
        "coordinates": [
            [origin["lng"], origin["lat"]],
            [destination["lng"], destination["lat"]],
        ],
        "format": "geojson",
    }
    resp = requests.post(url, json=body, headers={
        "Authorization": api_key,
        "Content-Type": "application/json",
    }, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    feature = data["features"][0]
    summary = feature["properties"]["summary"]
    coords = feature["geometry"]["coordinates"]  # [lng, lat] pairs

    distance_meters = summary["distance"]
    duration_seconds = summary["duration"]

    polyline = [[c[1], c[0]] for c in coords]

    return {
        "distance_miles": round(distance_meters * 0.000621371, 2),
        "duration_hours": round(duration_seconds / 3600, 2),
        "polyline": _simplify_polyline(polyline, max_points=200),
        "bbox": _calc_bbox(polyline),
    }


def _osrm_route(origin: dict, destination: dict) -> dict:
    """OSRM public demo server — fallback when no ORS key."""
    url = (
        f"http://router.project-osrm.org/route/v1/driving/"
        f"{origin['lng']},{origin['lat']};"
        f"{destination['lng']},{destination['lat']}"
        f"?overview=full&geometries=geojson"
    )
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    route = data["routes"][0]
    coords = route["geometry"]["coordinates"]  # [lng, lat]
    polyline = [[c[1], c[0]] for c in coords]

    return {
        "distance_miles": round(route["distance"] * 0.000621371, 2),
        "duration_hours": round(route["duration"] / 3600, 2),
        "polyline": _simplify_polyline(polyline, max_points=200),
        "bbox": _calc_bbox(polyline),
    }


def _simplify_polyline(points: list, max_points: int = 200) -> list:
    """Simple stride-based downsampling to keep response size reasonable."""
    if len(points) <= max_points:
        return points
    step = len(points) // max_points
    simplified = points[::step]
    if simplified[-1] != points[-1]:
        simplified.append(points[-1])
    return simplified


def _calc_bbox(polyline: list) -> dict:
    lats = [p[0] for p in polyline]
    lngs = [p[1] for p in polyline]
    return {
        "min_lat": min(lats), "max_lat": max(lats),
        "min_lng": min(lngs), "max_lng": max(lngs),
    }


def plan_stops(
    origin: dict,
    waypoints: list,
    destination: dict,
    total_miles: float,
    polyline: list = None,
) -> list:
    """
    Build a list of map stop markers along the route.
    Fuel stops are interpolated along the actual polyline.
    """
    stops = []
    stops.append({**origin, "label": "Current Location", "type": "origin", "mile_marker": 0})

    if len(waypoints) > 0:
        stops.append({**waypoints[0], "type": "pickup", "mile_marker": _estimate_miles(origin, waypoints[0])})

    fuel_mile = 1000
    while fuel_mile < total_miles:
        pt = _point_at_mile(polyline, fuel_mile, total_miles) if polyline else              _linear_interp(origin, destination, fuel_mile, total_miles)
        stops.append({
            "lat": pt[0], "lng": pt[1],
            "label": f"Fuel Stop (~{fuel_mile:,} mi)",
            "type": "fuel",
            "mile_marker": fuel_mile,
        })
        fuel_mile += 1000

    stops.append({**destination, "label": "Dropoff", "type": "dropoff", "mile_marker": total_miles})
    return stops


def _point_at_mile(polyline: list, target_mile: float, total_miles: float) -> tuple:
    """Walk the polyline accumulating haversine distance to find exact point at target_mile."""
    if not polyline or len(polyline) < 2:
        return (polyline[0][0], polyline[0][1]) if polyline else (0, 0)

    cum = [0.0]
    for i in range(1, len(polyline)):
        cum.append(cum[-1] + _haversine(polyline[i-1], polyline[i]))

    actual_total = cum[-1]
    if actual_total == 0:
        return (polyline[0][0], polyline[0][1])

    scaled = (target_mile / total_miles) * actual_total

    for i in range(1, len(cum)):
        if cum[i] >= scaled:
            seg_len = cum[i] - cum[i-1]
            if seg_len == 0:
                return (polyline[i][0], polyline[i][1])
            t = (scaled - cum[i-1]) / seg_len
            lat = polyline[i-1][0] + t * (polyline[i][0] - polyline[i-1][0])
            lng = polyline[i-1][1] + t * (polyline[i][1] - polyline[i-1][1])
            return (lat, lng)

    return (polyline[-1][0], polyline[-1][1])


def _haversine(p1: list, p2: list) -> float:
    """Haversine distance in miles between two [lat, lng] points."""
    import math
    R = 3958.8
    lat1, lon1 = math.radians(p1[0]), math.radians(p1[1])
    lat2, lon2 = math.radians(p2[0]), math.radians(p2[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def _linear_interp(origin, destination, mile, total_miles):
    f = mile / total_miles
    return (
        origin["lat"] + f * (destination["lat"] - origin["lat"]),
        origin["lng"] + f * (destination["lng"] - origin["lng"]),
    )


def _estimate_miles(p1: dict, p2: dict) -> float:
    import math
    dlat = abs(p2["lat"] - p1["lat"])
    dlng = abs(p2["lng"] - p1["lng"])
    return round(math.sqrt(dlat**2 + dlng**2) * 69, 1)
