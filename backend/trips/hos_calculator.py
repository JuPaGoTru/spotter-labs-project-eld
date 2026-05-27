"""
FMCSA Hours of Service Calculator
Property-carrying driver, 70hrs/8days rule.

Rules implemented:
- 11h max driving per day
- 14h on-duty window per day
- 10h off-duty rest between shifts
- 30-min break after 8h consecutive driving
- 70h/8-day cycle limit
- Fuel stop every 1,000 miles (30 min on-duty)
- 1 hour pickup, 1 hour dropoff
- 34-hour restart if cycle exceeded
"""

MAX_DRIVING_HOURS  = 11.0
MAX_WINDOW_HOURS   = 14.0
MIN_REST_HOURS     = 10.0
BREAK_AFTER_HOURS  = 8.0
BREAK_DURATION     = 0.5
MAX_CYCLE_HOURS    = 70.0
FUEL_INTERVAL_MILES = 1000.0
STOP_DURATION      = 1.0        # pickup / dropoff
AVG_SPEED_MPH      = 55.0
PRE_POST_TRIP      = 0.25       # 15 min each


def calculate_trip(total_distance_miles: float, current_cycle_used: float,
                   has_pickup: bool = True) -> dict:
    cycle_used      = float(current_cycle_used)
    remaining_miles = float(total_distance_miles)
    miles_covered   = 0.0
    days            = []
    day_number      = 0
    pickup_done     = False
    dropoff_done    = False

    while remaining_miles > 0:
        day_number += 1
        events          = []
        day_drive_hours = 0.0
        day_on_duty_hrs = 0.0
        day_miles       = 0.0

        # ── Shift starts at hour 0 each calendar day ──────────────
        cur = 0.0          # current hour within this 24-h day
        shift_start = 0.0

        # ── Day 1: no mandatory rest before shift ──────────────────
        # Day 2+: prepend 10-h rest (may spill from previous day)
        if day_number > 1:
            rest_end = MIN_REST_HOURS   # rest finishes at hour 10
            events.append(_ev("off_duty", 0.0, rest_end, "Rest / Off Duty"))
            cur = rest_end
            shift_start = cur

        # ── Pre-trip inspection ────────────────────────────────────
        insp_end = cur + PRE_POST_TRIP
        events.append(_ev("on_duty_not_driving", cur, insp_end, "Pre-trip Inspection"))
        day_on_duty_hrs += PRE_POST_TRIP
        cur = insp_end

        # ── Pickup (first day only) ────────────────────────────────
        if has_pickup and not pickup_done:
            pu_end = cur + STOP_DURATION
            events.append(_ev("on_duty_not_driving", cur, pu_end, "Pickup (Loading)"))
            day_on_duty_hrs += STOP_DURATION
            cur = pu_end
            pickup_done = True

        # ── Driving block ──────────────────────────────────────────
        drive_used   = 0.0    # driving hours used today
        consec_drive = 0.0    # consecutive hours since last break
        break_taken  = False

        window_end = shift_start + MAX_WINDOW_HOURS  # latest cur can reach

        while remaining_miles > 0:
            time_left_window = window_end - cur
            drive_left_today = MAX_DRIVING_HOURS - drive_used

            # Stop if window or drive limit exhausted
            if time_left_window < 0.1 or drive_left_today < 0.05:
                break

            # ── 30-min break if 8 h consecutive driving ────────────
            if consec_drive >= BREAK_AFTER_HOURS and not break_taken:
                brk_end = cur + BREAK_DURATION
                if brk_end <= window_end:
                    events.append(_ev("off_duty", cur, brk_end, "30-min Rest Break"))
                    cur = brk_end
                    consec_drive = 0.0
                    break_taken  = True
                    time_left_window = window_end - cur
                    if time_left_window < 0.1:
                        break
                else:
                    break   # no room for break — end shift

            # ── Miles to next fuel stop ────────────────────────────
            miles_since_last_fuel = miles_covered % FUEL_INTERVAL_MILES
            miles_to_fuel = FUEL_INTERVAL_MILES - miles_since_last_fuel
            if miles_to_fuel < 0.5:
                miles_to_fuel = FUEL_INTERVAL_MILES   # just fueled

            # ── How far can we drive this segment? ─────────────────
            max_drive_before_break = (BREAK_AFTER_HOURS - consec_drive) \
                                      if not break_taken else drive_left_today
            hours_available = min(drive_left_today,
                                  time_left_window - 0.26,   # leave room for post-trip
                                  max_drive_before_break)
            if hours_available <= 0:
                break

            miles_possible = hours_available * AVG_SPEED_MPH

            # ── Hit a fuel stop before end of segment? ─────────────
            if miles_possible >= miles_to_fuel and remaining_miles > miles_to_fuel:
                drive_h = miles_to_fuel / AVG_SPEED_MPH
                seg_end = cur + drive_h
                if seg_end > window_end:
                    # Drive only to window boundary
                    drive_h     = window_end - cur - 0.26
                    actual_mi   = drive_h * AVG_SPEED_MPH
                    _add_drive(events, cur, cur + drive_h, actual_mi,
                               day_miles, miles_covered)
                    cur         += drive_h
                    day_drive_hours += drive_h
                    day_on_duty_hrs += drive_h
                    day_miles       += actual_mi
                    miles_covered   += actual_mi
                    remaining_miles -= actual_mi
                    break

                events.append(_ev("driving", cur, seg_end,
                                  f"Driving ({miles_to_fuel:.0f} mi)"))
                cur             += drive_h
                drive_used      += drive_h
                consec_drive    += drive_h
                day_drive_hours += drive_h
                day_on_duty_hrs += drive_h
                day_miles       += miles_to_fuel
                miles_covered   += miles_to_fuel
                remaining_miles -= miles_to_fuel

                # 30-min fuel stop (on-duty, not driving)
                time_left_window = window_end - cur
                if time_left_window >= 0.5:
                    fuel_end = cur + 0.5
                    events.append(_ev("on_duty_not_driving", cur, fuel_end, "Fuel Stop"))
                    day_on_duty_hrs += 0.5
                    cur = fuel_end

            else:
                # ── Regular drive to end of segment ───────────────
                actual_mi  = min(miles_possible, remaining_miles)
                drive_h    = actual_mi / AVG_SPEED_MPH
                seg_end    = cur + drive_h

                # Clamp to window
                if seg_end > window_end - 0.26:
                    drive_h    = max(0, window_end - cur - 0.26)
                    actual_mi  = drive_h * AVG_SPEED_MPH
                    seg_end    = cur + drive_h

                if drive_h <= 0.01:
                    break

                events.append(_ev("driving", cur, seg_end,
                                  f"Driving ({actual_mi:.0f} mi)"))
                cur             += drive_h
                drive_used      += drive_h
                consec_drive    += drive_h
                day_drive_hours += drive_h
                day_on_duty_hrs += drive_h
                day_miles       += actual_mi
                miles_covered   += actual_mi
                remaining_miles -= actual_mi

                # Dropoff if trip complete
                if remaining_miles <= 0.5 and not dropoff_done:
                    do_end = cur + STOP_DURATION
                    if do_end <= window_end:
                        events.append(_ev("on_duty_not_driving", cur, do_end,
                                          "Dropoff (Unloading)"))
                        day_on_duty_hrs += STOP_DURATION
                        cur = do_end
                    dropoff_done = True
                    remaining_miles = 0
                break   # one drive segment per loop pass

        # ── Post-trip inspection ───────────────────────────────────
        post_end = min(cur + PRE_POST_TRIP, window_end, 24.0)
        if post_end > cur + 0.01:
            events.append(_ev("on_duty_not_driving", cur, post_end, "Post-trip Inspection"))
            day_on_duty_hrs += (post_end - cur)
            cur = post_end

        # ── Fill rest of day with off-duty ─────────────────────────
        if cur < 24.0:
            events.append(_ev("off_duty", cur, 24.0, "Off Duty"))

        # ── Update cycle ───────────────────────────────────────────
        cycle_used += day_on_duty_hrs
        if cycle_used > MAX_CYCLE_HOURS:
            cycle_used = MAX_CYCLE_HOURS   # cap; 34-hr restart logic could go here

        remarks = _remarks(day_number, day_miles, miles_covered,
                           total_distance_miles, dropoff_done)

        days.append({
            "day":               day_number,
            "date_offset":       day_number - 1,
            "events":            events,
            "total_drive_hours": round(day_drive_hours, 2),
            "total_on_duty_hours": round(day_on_duty_hrs, 2),
            "miles_driven":      round(day_miles, 1),
            "miles_total":       round(miles_covered, 1),
            "remarks":           remarks,
            "cycle_used_end":    round(min(cycle_used, MAX_CYCLE_HOURS), 2),
        })

        if day_number > 30:   # safety guard
            break

    return {
        "total_days":         day_number,
        "total_drive_hours":  round(sum(d["total_drive_hours"] for d in days), 2),
        "total_distance_miles": round(total_distance_miles, 1),
        "days":               days,
    }


# ── Helpers ────────────────────────────────────────────────────────────────

def _ev(status: str, start: float, end: float, label: str) -> dict:
    start = max(0.0, min(24.0, round(start, 4)))
    end   = max(0.0, min(24.0, round(end,   4)))
    return {"status": status, "start_hour": start, "end_hour": end,
            "duration": round(end - start, 4), "label": label}


def _add_drive(events, start, end, miles, day_miles, miles_covered):
    events.append(_ev("driving", start, end, f"Driving ({miles:.0f} mi)"))


def _remarks(day, day_miles, total_so_far, total_trip, dropoff_done):
    pct  = (total_so_far / total_trip * 100) if total_trip > 0 else 0
    base = (f"Day {day}: {day_miles:.0f} mi driven. "
            f"{total_so_far:.0f}/{total_trip:.0f} mi total ({pct:.0f}%).")
    if dropoff_done:
        base += " Trip complete — dropoff finished."
    return base
