#!/usr/bin/env python3
"""Evidence-bounded audit verdict for Experience Architect v1.1.0."""
import json, sys
from pathlib import Path

WEIGHTS={"task_success":15,"accessibility":15,"usability":10,"cognitive_clarity":10,"information_architecture":8,"interaction_quality":8,"error_recovery":7,"cultural_local":6,"visual_craft":6,"content_clarity":5,"responsive":4,"design_system":3,"trust_ethics":3}

def main(path):
    d=json.loads(Path(path).read_text(encoding="utf-8"))
    r=d.get("ratings",{})
    missing=[k for k in WEIGHTS if k not in r]
    if missing: raise SystemExit("Missing ratings: "+", ".join(missing))
    pts={k:WEIGHTS[k]*float(r[k])/5 for k in WEIGHTS}
    score=round(sum(pts.values()),2)
    level=d.get("audit_level","DESIGN_REVIEW")
    hard=d.get("hard_stops",[])
    s1=int(d.get("open_s1",0))
    unknown=d.get("mandatory_unknowns",[])
    cov=d.get("critical_journey_coverage_percent",0)
    e3=bool(d.get("all_critical_journeys_e3",False))
    e4=bool(d.get("critical_accessibility_e4",False))
    if hard or s1 or score < 75:
        verdict="FAIL"
    elif level=="RELEASE_AUDIT" and (cov < 100 or not e3 or not e4 or unknown):
        verdict="FAIL"
    elif score>=85 and pts["task_success"]>=12 and pts["accessibility"]>=12:
        verdict="RELEASE_PASS" if level=="RELEASE_AUDIT" else "DESIGN_PASS"
    else:
        verdict="CONDITIONAL"
    print(json.dumps({"score":score,"verdict":verdict,"audit_level":level,"hard_stops":hard,"open_s1":s1,"mandatory_unknowns":unknown,"critical_journey_coverage_percent":cov,"points":{k:round(v,2) for k,v in pts.items()}},indent=2))
    return 0 if verdict in {"RELEASE_PASS","DESIGN_PASS"} else 2

if __name__=="__main__":
    if len(sys.argv)!=2: raise SystemExit("Usage: audit_gate.py audit-score.json")
    raise SystemExit(main(sys.argv[1]))
