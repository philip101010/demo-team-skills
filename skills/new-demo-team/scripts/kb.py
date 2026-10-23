"""Knowledge base of the demo teams: what tasks really took, how often they came back, what to expect.

Usage (stdlib only, run with python -I):
  kb.py harvest [--root DIR | --project DIR] [--kb DIR]   read the task files, update tasks.jsonl
  kb.py predict --type T [--guess HOURS] [--kb DIR]        what history says about a task of this type
  kb.py calibrate [--kb DIR]                               per type: size, estimate error, rework and first-pass rate

The base lives in ~/.claude/demo-team-roster/knowledge/ (tasks.jsonl, and LESSONS.md written by hand).
Task files are read, never changed. Headers are 'Key: value' lines or 'A: x | B: y' on one line,
English or Ukrainian keys; reworks are lines of the '## Review' section such as
'- 2026-10-23 14:05 rework (requirement): reason'.
"""
import glob
import json
import os
import re
import statistics
import sys
import time

KEYS = {
    "status": ("status", "статус"),
    "performer": ("performer", "виконавець"),
    "priority": ("priority", "пріоритет"),
    "wave": ("wave", "хвиля"),
    "estimate": ("estimate", "оцінка"),
    "started": ("started", "початок"),
    "finished": ("finished", "завершено"),
    "type": ("type", "тип"),
    "risk": ("risk", "ризик"),
}
STAMP = re.compile(r"(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})")
REWORK = re.compile(r"^\s*[-*]\s*(?:\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}\s*)?rework(?:\s*\(([\w-]+)\))?", re.I)
CATEGORIES = ("requirement", "acceptance", "dependency", "stand", "tool", "brief", "quality", "other")
DONE = ("done", "виконано", "готово")


def default_kb():
    return os.path.join(os.path.expanduser("~"), ".claude", "demo-team-roster", "knowledge")


def stamp(text):
    m = STAMP.search(text or "")
    if not m:
        return None
    y, mo, d, h, mi = (int(x) for x in m.groups())
    return time.mktime((y, mo, d, h, mi, 0, 0, 0, -1))


def parse_task(path, project):
    try:
        with open(path, encoding="utf-8") as f:
            lines = f.read().splitlines()
    except Exception:
        return None
    head = next((ln for ln in lines if ln.startswith("# ")), "")
    title = head[2:].strip()
    tid = (title.split(":", 1)[0].strip() if ":" in title else os.path.splitext(os.path.basename(path))[0])[:22]
    fields = {}
    for ln in lines[:30]:
        for part in ln.split("|"):
            if ":" not in part:
                continue
            k, v = part.split(":", 1)
            k = k.strip().lower()
            for name, aliases in KEYS.items():
                if k in aliases and name not in fields:
                    fields[name] = v.strip()
    status = fields.get("status", "").lower()
    estimate = None
    try:
        estimate = float(fields.get("estimate", "").replace(",", ".").split()[0])
    except (ValueError, IndexError):
        pass
    started, finished = stamp(fields.get("started")), stamp(fields.get("finished"))
    hours = None
    if started and finished and finished > started:
        hours = round((finished - started) / 3600.0, 2)
    # the '## Review' section: reworks with their category, and who verified
    in_review, reworks, cats, verified = False, 0, {}, False
    boxes_done = boxes_total = 0
    for ln in lines:
        if ln.startswith("## "):
            in_review = ln[3:].strip().lower().startswith("review")
        if in_review:
            m = REWORK.match(ln)
            if m:
                reworks += 1
                c = (m.group(1) or "other").lower()
                c = c if c in CATEGORIES else "other"
                cats[c] = cats.get(c, 0) + 1
            if re.search(r"verified by\s*:?\s*\S", ln, re.I):
                verified = True
        m = re.match(r"^\s*[-*] \[( |x|X)\]", ln)
        if m:
            boxes_total += 1
            boxes_done += 0 if m.group(1) == " " else 1
    return {
        "project": project, "id": tid, "title": title.split(":", 1)[-1].strip()[:110],
        "status": "done" if status.startswith(DONE) else status.split(" ")[0] if status else "",
        "performer": fields.get("performer", "").split(".")[0][:40],
        "type": (fields.get("type") or "other").lower().split()[0],
        "risk": (fields.get("risk") or "").lower().split()[0] if fields.get("risk") else "",
        "wave": fields.get("wave", ""), "estimate": estimate, "actualHours": hours,
        "reworks": reworks, "reworkCategories": cats, "verified": verified,
        "boxes": boxes_total, "boxesDone": boxes_done,
    }


def read_kb(kb):
    path = os.path.join(kb, "tasks.jsonl")
    out = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for ln in f:
                try:
                    r = json.loads(ln)
                    out[(r["project"], r["id"])] = r
                except Exception:
                    continue
    return out


def write_kb(kb, records):
    os.makedirs(kb, exist_ok=True)
    with open(os.path.join(kb, "tasks.jsonl"), "w", encoding="utf-8") as f:
        for key in sorted(records):
            f.write(json.dumps(records[key], ensure_ascii=False) + "\n")


def harvest(args):
    kb = opt(args, "--kb") or default_kb()
    root = opt(args, "--root") or r"C:\Projects\Workspaces"
    project = opt(args, "--project")
    dirs = [project] if project else sorted(p for p in glob.glob(os.path.join(root, "*")) if os.path.isdir(p))
    records = read_kb(kb)
    seen = changed = 0
    now = int(time.time())
    for pdir in dirs:
        name = os.path.basename(os.path.normpath(pdir))
        for tp in sorted(glob.glob(os.path.join(pdir, "_orchestration", "tasks", "*.md"))):
            r = parse_task(tp, name)
            if not r:
                continue
            seen += 1
            # only what carries a lesson: finished, or reworked, or estimated and under way
            if r["status"] != "done" and not r["reworks"]:
                records.pop((name, r["id"]), None)
                continue
            old = records.get((name, r["id"]))
            r["harvestedAt"] = (old or {}).get("harvestedAt", now)
            if old is None or {k: v for k, v in old.items() if k != "harvestedAt"} != {k: v for k, v in r.items() if k != "harvestedAt"}:
                r["harvestedAt"] = now
                changed += 1
            records[(name, r["id"])] = r
    write_kb(kb, records)
    done = [r for r in records.values() if r["status"] == "done"]
    timed = [r for r in done if r["estimate"] and r["actualHours"]]
    print(f"read {seen} task files, {len(records)} in the base ({changed} new or changed); {len(done)} done, {len(timed)} with an estimate and real hours")


def opt(args, name):
    return args[args.index(name) + 1] if name in args and args.index(name) + 1 < len(args) else None


def stats_for(records, typ=None):
    rs = [r for r in records.values() if r["status"] == "done" and (typ is None or r["type"] == typ)]
    timed = [r for r in rs if r["estimate"] and r["actualHours"]]
    out = {"n": len(rs), "nTimed": len(timed)}
    if timed:
        ratios = [r["actualHours"] / r["estimate"] for r in timed]
        out["ratio"] = round(statistics.median(ratios), 2)
        out["medianEstimate"] = round(statistics.median(r["estimate"] for r in timed), 2)
        out["medianActual"] = round(statistics.median(r["actualHours"] for r in timed), 2)
    actual = [r["actualHours"] for r in rs if r["actualHours"]]
    if actual:
        out["medianActualAll"] = round(statistics.median(actual), 2)
        out["p80Actual"] = round(sorted(actual)[min(len(actual) - 1, int(len(actual) * 0.8))], 2)
    # first-pass and rework rates only count tasks a reviewer has seen (verified, or sent back):
    # older tasks carry no review data, and counting them would flatter the numbers
    reviewed = [r for r in rs if r["verified"] or r["reworks"]]
    if reviewed:
        out["nReviewed"] = len(reviewed)
        out["firstPass"] = round(sum(1 for r in reviewed if r["reworks"] == 0) / len(reviewed), 2)
        out["reworkAvg"] = round(sum(r["reworks"] for r in reviewed) / len(reviewed), 2)
    return out


def predict(args):
    kb = opt(args, "--kb") or default_kb()
    typ = (opt(args, "--type") or "other").lower()
    guess = opt(args, "--guess")
    records = read_kb(kb)
    s = stats_for(records, typ)
    overall = stats_for(records)
    lines = [f"type {typ}: {s['n']} finished task(s) in the base, {s['nTimed']} with estimate and real hours"]
    base_for = s if s["nTimed"] >= 3 else overall if overall["nTimed"] >= 3 else None
    scope = typ if base_for is s else "all types"
    if base_for and "ratio" in base_for:
        lines.append(f"real hours were {base_for['ratio']}x the estimate (median, {scope}); typical real hours {base_for.get('medianActual')} h, p80 {base_for.get('p80Actual', '-')} h")
        if guess:
            try:
                g = float(guess.replace(",", "."))
                lines.append(f"suggested estimate for a guess of {g} h: {round(g * base_for['ratio'] * 2) / 2} h (source: history, {scope})")
            except ValueError:
                pass
    else:
        lines.append("not enough history yet (needs 3 finished tasks with estimate and real hours): use your own guess and mark the source as guess")
    if "firstPass" in s:
        lines.append(f"first-pass acceptance {int(s['firstPass'] * 100)}%, {s['reworkAvg']} rework(s) per task on average")
    print("\n".join(lines))


def calibrate(args):
    kb = opt(args, "--kb") or default_kb()
    records = read_kb(kb)
    types = sorted({r["type"] for r in records.values() if r["status"] == "done"})
    print("| type | done | timed | real/estimate | typical real h | p80 h | first pass | reworks/task |")
    print("|---|---|---|---|---|---|---|---|")
    for t in [None] + types:
        s = stats_for(records, t)
        if not s["n"]:
            continue
        fp = f"{int(s['firstPass'] * 100)}%" if "firstPass" in s else "-"
        print(f"| {t or 'all'} | {s['n']} | {s['nTimed']} | {s.get('ratio', '-')} | {s.get('medianActual', s.get('medianActualAll', '-'))} | {s.get('p80Actual', '-')} | {fp} | {s.get('reworkAvg', '-')} |")
    causes = {}
    for r in records.values():
        for c, n in r["reworkCategories"].items():
            causes[c] = causes.get(c, 0) + n
    if causes:
        print("\nrework causes: " + ", ".join(f"{c} {n}" for c, n in sorted(causes.items(), key=lambda x: -x[1])))


def main():
    args = sys.argv[1:]
    cmd = args[0] if args else ""
    fn = {"harvest": harvest, "predict": predict, "calibrate": calibrate}.get(cmd)
    if not fn:
        sys.stdout.write(__doc__)
        sys.exit(2)
    fn(args[1:])


if __name__ == "__main__":
    main()
