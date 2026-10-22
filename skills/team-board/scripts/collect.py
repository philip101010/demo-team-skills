"""Collect every project's team roster into one JSON snapshot.

Reads <workspaces>/*/_orchestration/roster.json, the app's session metadata and the
progress files written by roster_step. Prints JSON: {"generatedAt": ms, "projects": [...]}.
"""
import glob, json, os, re, sys, time

WORK = r"C:\Projects\Workspaces"
HOME = os.path.expanduser("~")
META = glob.glob(os.path.join(os.environ.get("APPDATA", ""), "Claude", "claude-code-sessions", "*", "*", "local_*.json"))
PROG = os.path.join(HOME, ".claude", "demo-team-roster")
LIVE_MS = 90_000


def load(p):
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


meta_by_id = {}
for p in META:
    m = load(p)
    if m:
        meta_by_id[os.path.basename(p)[:-5]] = (m, os.path.getmtime(p) * 1000)

now = time.time() * 1000


def member(entry, role, project_dir):
    m, mtime = meta_by_id.get(entry["id"], ({}, 0))
    prog = load(os.path.join(PROG, f"{m.get('cliSessionId', '')}.json")) or {}
    last = m.get("lastActivityAt") or 0
    # The app rewrites a session's metadata file for many reasons, so its mtime says nothing
    # about work. Truth comes from list_sessions (--running); without it, recent activity only.
    working = (entry["id"] in RUNNING) if RUNNING is not None else now - last < LIVE_MS
    summ = m.get("postTurnSummary") or {}
    done, total = prog.get("done"), prog.get("total")
    started = prog.get("startedAt")
    elapsed = int(now - started) if working and started else None
    eta = None
    if working and total and done and elapsed:
        eta = int(elapsed / done * (total - done))
    return {
        "id": entry["id"], "name": entry["name"], "role": role, "cls": entry.get("class", "ranger"),
        "state": "working" if working else "idling",
        "blocked": (not working) and summ.get("status_category") == "blocked",
        "task": prog.get("task") or m.get("title") or "",
        "note": prog.get("note") or "",
        "done": done, "total": total, "elapsedMs": elapsed, "etaMs": eta,
        "lastActivityAt": int(last) or None,
    }

KEYS = {
    "priority": ("priority", "пріоритет"), "status": ("status", "статус"),
    "performer": ("performer", "виконавець"), "depends": ("depends on", "залежить від"),
}


def norm_status(raw):
    r = (raw or "").lower().strip()
    if r.startswith(("done", "виконано", "готово")):
        return "done"
    if r.startswith(("in-progress", "in progress", "working", "в роботі", "виконується")):
        return "working"
    if r.startswith(("paused", "пауза", "blocked", "заблок")):
        return "paused"
    if r.startswith(("pending", "queued", "todo", "new", "prep-done", "в черзі", "очікує")):
        return "queued"
    return "queued" if r else "unknown"


def tasks_of(pdir):
    """Task files tasks/*.md: '# ID: title' plus 'Key: value' header lines (English or Ukrainian keys)."""
    out = []
    for tp in sorted(glob.glob(os.path.join(pdir, "_orchestration", "tasks", "*.md"))):
        try:
            with open(tp, encoding="utf-8") as f:
                lines = [ln.rstrip() for ln in f.read().splitlines()[:14]]
        except Exception:
            continue
        head = next((ln for ln in lines if ln.startswith("# ")), "")
        title = head[2:].strip()
        t = {"id": (title.split(":", 1)[0].strip() if ":" in title else os.path.splitext(os.path.basename(tp))[0])[:22],
             "title": title.split(":", 1)[1].strip() if ":" in title else title,
             "priority": "", "status": "", "performer": "", "depends": ""}
        for ln in lines:
            for part in ln.split("|"):  # several 'Key: value' pairs may share one line
                if ":" not in part:
                    continue
                k, v = part.split(":", 1)
                k = k.strip().lower()
                for name, aliases in KEYS.items():
                    if k in aliases and not t[name]:
                        t[name] = v.strip()
        t["status"] = norm_status(t["status"])
        t["depends"] = "" if t["depends"] in ("-", "0", "none", "немає") else t["depends"].replace("(", ",").split(",")[0].strip()[:40]
        t["performer"] = t["performer"].split(".")[0][:40]
        t["title"] = t["title"][:110]
        out.append(t)
    return out


args = sys.argv[1:]
# --running id1,id2 (or "none"): session ids list_sessions reports as running right now.
RUNNING = None
if "--running" in args:
    raw = args[args.index("--running") + 1]
    RUNNING = set() if raw in ("", "none") else set(raw.split(","))
only = os.path.normcase(os.path.abspath(args[args.index("--project") + 1])) if "--project" in args else None
outdir = args[args.index("--outdir") + 1] if "--outdir" in args else None

projects = []
for rp in sorted(glob.glob(os.path.join(WORK, "*", "_orchestration", "roster.json"))):
    if only and os.path.normcase(os.path.dirname(os.path.dirname(rp))) != only:
        continue
    r = load(rp)
    if not r:
        continue
    pdir = os.path.dirname(os.path.dirname(rp))
    ms = []
    if r.get("orchestrator"):
        ms.append(member(r["orchestrator"], "orchestrator", pdir))
    ms += [member(e, "helper", pdir) for e in r.get("members", [])]
    projects.append({
        "slug": re.sub(r"[^a-z0-9]+", "-", os.path.basename(pdir).lower()).strip("-"),
        "name": os.path.basename(pdir), "members": ms, "tasks": tasks_of(pdir),
        "working": sum(1 for x in ms if x["state"] == "working"),
    })

if outdir:
    # One ready-to-write dashboard document per project (no `watching` field: the board owns it).
    os.makedirs(outdir, exist_ok=True)
    for p in projects:
        doc = dict(p, generatedAt=int(now))
        with open(os.path.join(outdir, f"proj-{p['slug']}.json"), "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False)
        print(p["slug"])
    sys.exit(0 if projects else 3)

sys.stdout.buffer.write(json.dumps({"generatedAt": int(now), "projects": projects}, ensure_ascii=False).encode("utf-8"))
