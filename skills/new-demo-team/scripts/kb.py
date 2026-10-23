"""Knowledge base of the demo teams: what tasks really took, how often they came back, what to expect.

Usage (stdlib only, run with python -I):
  kb.py harvest [--root DIR | --project DIR] [--kb DIR]   read the task files, update tasks.jsonl
  kb.py predict --type T [--guess HOURS] [--kb DIR]        what history says about a task of this type
  kb.py calibrate [--kb DIR]                               per type: size, estimate error, rework and first-pass rate
  kb.py lint --project DIR [--strict]                      task files against the protocol (exit 1 on errors in a
                                                           'Protocol: 2' project): verification, evidence, plan gate, ...

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


SECTION_ALIASES = ("understanding", "plan", "assumptions", "acceptance", "evidence", "review", "result", "scope", "request", "handoff")


def sections_of(lines):
    """'## Name (hint)' headings -> {name: [lines]} (names lowercased, hint dropped)."""
    out, cur = {}, None
    for ln in lines:
        if ln.startswith("## "):
            name = re.split(r"[\s(]", ln[3:].strip().lower(), maxsplit=1)[0]
            cur = name if name in SECTION_ALIASES else None
            if cur:
                out.setdefault(cur, [])
        elif cur is not None:
            out[cur].append(ln)
    return out


def filled(section):
    return any(ln.strip() and not ln.lstrip().startswith("#") for ln in (section or []))


def lint_task(path):
    """Findings for one task file against the protocol: list of (level, code, text)."""
    try:
        with open(path, encoding="utf-8") as f:
            lines = f.read().splitlines()
    except Exception:
        return []
    r = parse_task(path, "")
    if not r:
        return []
    sec = sections_of(lines)
    head = "\n".join(lines[:30])
    status = r["status"]
    raw_status = ""
    for ln in lines[:30]:
        for part in ln.split("|"):
            if ":" in part and part.split(":", 1)[0].strip().lower() in KEYS["status"]:
                raw_status = part.split(":", 1)[1].strip().lower()
                break
        if raw_status:
            break
    out = []
    started_or_later = raw_status.startswith(("in-progress", "in progress", "review", "rework", "done", "виконано", "готово"))
    reviewed_state = raw_status.startswith(("review", "done", "виконано", "готово"))
    is_done = status == "done"
    acc = sec.get("acceptance", [])
    acc_boxes = [ln for ln in acc if re.match(r"^\s*[-*] \[( |x|X)\]", ln)]
    acc_open = [ln for ln in acc_boxes if re.match(r"^\s*[-*] \[ \]", ln)]
    if not r["estimate"] and not is_done:
        out.append(("E", "no-estimate", "no Estimate (hours)"))
    if r["type"] == "other" and not re.search(r"^\s*(type|тип)\s*:", "\n".join(lines[:30]), re.I | re.M):
        out.append(("W", "no-type", "no Type (object, page, process, ...), so history cannot learn from it"))
    if not r["wave"]:
        out.append(("W", "no-wave", "no Wave"))
    if not acc_boxes:
        out.append(("E", "no-acceptance", "Acceptance has no checkable '- [ ]' lines"))
    if reviewed_state and acc_open:
        out.append(("E", "unticked", f"{len(acc_open)} acceptance box(es) not ticked but the task is {raw_status.split(' ')[0]}"))
    if raw_status.startswith("review") and not filled(sec.get("evidence")):
        out.append(("E", "no-evidence", "in review with an empty Evidence section"))
    if is_done and not r["verified"]:
        out.append(("E", "unverified", "done without a 'Verified by' line under Review"))
    if is_done and r["verified"]:
        who = ""
        for ln in sec.get("review", []):
            m = re.search(r"verified by\s*:?\s*([^\s,.;]+)", ln, re.I)
            if m:
                who = m.group(1).lower()
        first = re.sub(r"[^a-z]+", " ", r["performer"].lower()).split()
        if who and first and who == first[0]:
            out.append(("E", "self-verified", f"verified by its own performer ({who})"))
    if r["risk"] == "high" and started_or_later and not re.search(r"plan approved\s*:", "\n".join(lines), re.I):
        out.append(("E", "no-plan-approval", "Risk: high but no 'Plan approved:' line"))
    if r["risk"] == "high" and started_or_later and not filled(sec.get("plan")):
        out.append(("E", "no-plan", "Risk: high but an empty Plan section"))
    if started_or_later and not filled(sec.get("understanding")):
        out.append(("W", "no-understanding", "no Understanding section (read-back) written"))
    if started_or_later and not re.search(r"(started|початок)\s*:\s*\d{4}", head, re.I):
        out.append(("W", "no-started", "no Started time"))
    if reviewed_state and not re.search(r"(finished|завершено)\s*:\s*\d{4}", head, re.I):
        out.append(("W", "no-finished", "no Finished time"))
    if raw_status.startswith("blocked-approval") and not re.search(r"(blocker|блокер)\s*:\s*[^\s|-]", head, re.I):
        out.append(("W", "no-blocker", "blocked-approval without a 'Blocker:' line"))
    if r["reworks"] >= 2 and not is_done:
        out.append(("W", "rework-twice", f"sent back {r['reworks']} times: take it over or re-slice it"))
    return out


def lint(args):
    project = opt(args, "--project")
    if not project:
        print("lint needs --project DIR")
        sys.exit(2)
    state = ""
    try:
        with open(os.path.join(project, "_orchestration", "STATE.md"), encoding="utf-8") as f:
            state = f.read()
    except Exception:
        pass
    strict = "--strict" in args or bool(re.search(r"^\s*protocol\s*:\s*2\b", state, re.I | re.M))
    errors = warnings = 0
    files = sorted(glob.glob(os.path.join(project, "_orchestration", "tasks", "*.md")))
    for tp in files:
        tid = os.path.splitext(os.path.basename(tp))[0]
        for level, code, text in lint_task(tp):
            if level == "E" and not strict:
                level = "W"
            errors += level == "E"
            warnings += level == "W"
            print(f"{'ERROR' if level == 'E' else 'warn '} {tid} [{code}] {text}")
    mode = "protocol 2 (strict)" if strict else "legacy project (findings are warnings; put 'Protocol: 2' in STATE.md to enforce)"
    print(f"{len(files)} task file(s), {errors} error(s), {warnings} warning(s); {mode}")
    sys.exit(1 if errors else 0)


def main():
    args = sys.argv[1:]
    cmd = args[0] if args else ""
    fn = {"harvest": harvest, "predict": predict, "calibrate": calibrate, "lint": lint}.get(cmd)
    if not fn:
        sys.stdout.write(__doc__)
        sys.exit(2)
    fn(args[1:])


if __name__ == "__main__":
    main()
