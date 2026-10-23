"""Run: python -I test_kb.py  (stdlib only; writes only to a temp folder)."""
import contextlib
import io
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kb  # noqa: E402


def task(tid, status, performer, typ, est, start, end, review=""):
    return (
        f"# {tid}: title of {tid}\n"
        f"Status: {status} | Performer: {performer} | Priority: P1\n"
        f"Wave: 2 | Estimate: {est} | Started: {start} | Finished: {end}\n"
        f"Type: {typ} | Risk: low\n"
        "## Acceptance\n- [x] one\n- [x] two\n## Review\n" + review + "\n"
    )


class KbTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = os.path.join(self.tmp.name, "ws")
        self.kb = os.path.join(self.tmp.name, "kb")
        tdir = os.path.join(self.root, "Demo One", "_orchestration", "tasks")
        os.makedirs(tdir)
        specs = [
            ("T-01", "done", "Kei", "object", 1, "2026-10-23 09:00", "2026-10-23 10:30", "- 2026-10-23 11:00 done: Verified by Lancelot"),
            ("T-02", "done", "Kei", "object", 2, "2026-10-23 09:00", "2026-10-23 12:00", "- 2026-10-23 12:10 rework (requirement): missed a column\n- 2026-10-23 13:00 done: Verified by Lancelot"),
            ("T-03", "done", "Galahad", "object", 1, "2026-10-23 09:00", "2026-10-23 10:00", "- 2026-10-23 10:30 done: Verified by Lancelot"),
            ("T-04", "done", "Galahad", "page", 3, "2026-10-23 09:00", "2026-10-23 13:00", "- 2026-10-23 14:00 rework (tool): designer crashed\n- 2026-10-23 15:00 rework (quality): spacing"),
            ("T-05", "in-progress", "Kei", "page", 2, "2026-10-23 09:00", "-", ""),
        ]
        for tid, *rest in specs:
            with open(os.path.join(tdir, f"{tid}.md"), "w", encoding="utf-8") as f:
                f.write(task(tid, *rest))

    def tearDown(self):
        self.tmp.cleanup()

    def run_cmd(self, fn, *args):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            fn(list(args))
        return out.getvalue()

    def test_harvest_keeps_done_and_reworked_only(self):
        text = self.run_cmd(kb.harvest, "--root", self.root, "--kb", self.kb)
        self.assertIn("read 5 task files, 4 in the base", text)
        records = kb.read_kb(self.kb)
        self.assertEqual(records[("Demo One", "T-01")]["actualHours"], 1.5)
        self.assertTrue(records[("Demo One", "T-01")]["verified"])
        self.assertEqual(records[("Demo One", "T-02")]["reworkCategories"], {"requirement": 1})
        self.assertEqual(records[("Demo One", "T-04")]["reworks"], 2)
        self.assertNotIn(("Demo One", "T-05"), records)

    def test_harvest_twice_changes_nothing(self):
        self.run_cmd(kb.harvest, "--root", self.root, "--kb", self.kb)
        text = self.run_cmd(kb.harvest, "--root", self.root, "--kb", self.kb)
        self.assertIn("(0 new or changed)", text)

    def test_predict_needs_history_then_scales_the_guess(self):
        empty = self.run_cmd(kb.predict, "--type", "object", "--guess", "2", "--kb", self.kb)
        self.assertIn("not enough history", empty)
        self.run_cmd(kb.harvest, "--root", self.root, "--kb", self.kb)
        text = self.run_cmd(kb.predict, "--type", "object", "--guess", "2", "--kb", self.kb)
        # real over estimate: 1.5, 1.5, 1.0 -> median 1.5; a guess of 2 h becomes 3 h
        self.assertIn("1.5x the estimate", text)
        self.assertIn("suggested estimate for a guess of 2.0 h: 3.0 h", text)

    def test_calibrate_lists_types_and_rework_causes(self):
        self.run_cmd(kb.harvest, "--root", self.root, "--kb", self.kb)
        text = self.run_cmd(kb.calibrate, "--kb", self.kb)
        self.assertIn("| object | 3 | 3 |", text)
        self.assertIn("| page | 1 | 1 |", text)
        self.assertIn("rework causes:", text)
        self.assertIn("tool 1", text)


if __name__ == "__main__":
    unittest.main()
