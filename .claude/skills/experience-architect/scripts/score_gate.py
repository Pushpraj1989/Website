#!/usr/bin/env python3
"""Calculate the Experience Architect UX gate from a JSON rating file."""
import json
import sys
from pathlib import Path

WEIGHTS = {
    "task_success": 15,
    "accessibility": 15,
    "usability": 10,
    "cognitive_clarity": 10,
    "information_architecture": 8,
    "interaction_quality": 8,
    "error_recovery": 7,
    "cultural_local": 6,
    "visual_craft": 6,
    "content_clarity": 5,
    "responsive": 4,
    "design_system": 3,
    "trust_ethics": 3,
}


def main(path: str) -> int:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    ratings = data.get("ratings", {})
    missing = [k for k in WEIGHTS if k not in ratings]
    if missing:
        raise SystemExit(f"Missing ratings: {', '.join(missing)}")

    bad = {k: v for k, v in ratings.items() if k in WEIGHTS and not (0 <= float(v) <= 5)}
    if bad:
        raise SystemExit(f"Ratings must be 0..5: {bad}")

    points = {k: WEIGHTS[k] * float(ratings[k]) / 5 for k in WEIGHTS}
    total = round(sum(points.values()), 2)
    hard_stops = data.get("hard_stops", [])
    open_s1 = int(data.get("open_s1", 0))

    task = points["task_success"]
    a11y = points["accessibility"]

    if hard_stops or open_s1 > 0 or total < 75:
        verdict = "FAIL"
    elif total >= 85 and task >= 12 and a11y >= 12:
        verdict = "PASS"
    else:
        verdict = "CONDITIONAL"

    output = {
        "score": total,
        "verdict": verdict,
        "hard_stops": hard_stops,
        "open_s1": open_s1,
        "points": {k: round(v, 2) for k, v in points.items()},
    }
    print(json.dumps(output, indent=2))
    return 0 if verdict == "PASS" else 2


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: score_gate.py review-score.json")
    raise SystemExit(main(sys.argv[1]))
