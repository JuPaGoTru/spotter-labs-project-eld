from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .route_service import geocode, get_route, plan_stops
from .hos_calculator import calculate_trip


class PlanTripView(APIView):
    """
    POST /api/trips/plan/
    Body: {
        current_location: str,
        pickup_location: str,
        dropoff_location: str,
        current_cycle_used: float
    }
    """

    def post(self, request):
        data = request.data

        # Validate inputs
        required = ["current_location", "pickup_location", "dropoff_location", "current_cycle_used"]
        for field in required:
            if not data.get(field) and data.get(field) != 0:
                return Response(
                    {"error": f"Missing field: {field}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            current_cycle_used = float(data["current_cycle_used"])
        except (ValueError, TypeError):
            return Response(
                {"error": "current_cycle_used must be a number"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if current_cycle_used < 0 or current_cycle_used > 70:
            return Response(
                {"error": "current_cycle_used must be between 0 and 70"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Step 1: Geocode all three locations
        try:
            current_loc = geocode(data["current_location"])
            pickup_loc = geocode(data["pickup_location"])
            dropoff_loc = geocode(data["dropoff_location"])
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Step 2: Get route segments
        # Current → Pickup → Dropoff
        try:
            seg1 = get_route(current_loc, pickup_loc)   # current to pickup
            seg2 = get_route(pickup_loc, dropoff_loc)   # pickup to dropoff
        except Exception as e:
            return Response(
                {"error": f"Routing failed: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        total_miles = seg1["distance_miles"] + seg2["distance_miles"]
        total_drive_hours_estimated = seg1["duration_hours"] + seg2["duration_hours"]

        # Merge polylines (deduplicate junction point)
        combined_polyline = seg1["polyline"] + seg2["polyline"][1:]

        # Step 3: Calculate HOS schedule
        hos_plan = calculate_trip(
            total_distance_miles=total_miles,
            current_cycle_used=current_cycle_used,
            has_pickup=True,
        )

        # Step 4: Plan stops (markers for map)
        stops = plan_stops(
            origin={**current_loc, "label": "Current Location"},
            waypoints=[{**pickup_loc, "label": "Pickup"}],
            destination={**dropoff_loc, "label": "Dropoff"},
            total_miles=total_miles,
            polyline=combined_polyline,
        )

        # Step 5: Build rest stop markers from HOS plan
        rest_markers = _build_rest_markers(hos_plan["days"], combined_polyline, total_miles)

        return Response({
            "locations": {
                "current": {**current_loc, "input": data["current_location"]},
                "pickup": {**pickup_loc, "input": data["pickup_location"]},
                "dropoff": {**dropoff_loc, "input": data["dropoff_location"]},
            },
            "route": {
                "total_miles": round(total_miles, 1),
                "total_drive_hours_estimated": round(total_drive_hours_estimated, 2),
                "segment1_miles": round(seg1["distance_miles"], 1),
                "segment2_miles": round(seg2["distance_miles"], 1),
                "polyline": combined_polyline,
                "bbox": _merged_bbox(seg1["bbox"], seg2["bbox"]),
            },
            "stops": stops,
            "rest_markers": rest_markers,
            "hos_plan": hos_plan,
            "inputs": {
                "current_cycle_used": current_cycle_used,
            },
        })


def _build_rest_markers(days: list, polyline: list, total_miles: float) -> list:
    """
    Place rest stop markers along the polyline based on cumulative miles.
    """
    markers = []
    for day in days[:-1]:  # no rest marker after last day
        mile_mark = day["miles_total"]
        if mile_mark <= 0 or mile_mark >= total_miles:
            continue
        fraction = mile_mark / total_miles
        idx = int(fraction * (len(polyline) - 1))
        idx = max(0, min(idx, len(polyline) - 1))
        pt = polyline[idx]
        markers.append({
            "lat": pt[0],
            "lng": pt[1],
            "label": f"Day {day['day']} Rest Stop",
            "type": "rest",
            "mile_marker": round(mile_mark, 1),
            "day": day["day"],
        })
    return markers


def _merged_bbox(b1: dict, b2: dict) -> dict:
    return {
        "min_lat": min(b1["min_lat"], b2["min_lat"]),
        "max_lat": max(b1["max_lat"], b2["max_lat"]),
        "min_lng": min(b1["min_lng"], b2["min_lng"]),
        "max_lng": max(b1["max_lng"], b2["max_lng"]),
    }


class GeocodeView(APIView):
    """
    GET /api/trips/geocode/?q=Chicago,IL
    Quick geocode helper for autocomplete / validation.
    """
    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response({"error": "q param required"}, status=400)
        try:
            result = geocode(q)
            return Response(result)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
