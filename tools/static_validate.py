#!/usr/bin/env python3
"""Static validator for the Godot project — runs WITHOUT Godot.

Checks that catch the most common breakage before a headless run:
  - every [autoload] script in project.godot exists
  - main_scene exists
  - every ext_resource script path in .tscn files exists
  - every literal res:// path referenced in .gd files exists
  - every data/*.json parses and has required item fields
  - no obviously-Godot-3 API tokens leaked in

Exit code 0 = all good, 1 = problems (printed). This is the
"STATICALLY VALIDATED" gate; headless run is a separate, stronger gate.

Usage: python3 tools/static_validate.py [path/to/godot/project]
"""
import json
import re
import sys
from pathlib import Path

PROJ = Path(sys.argv[1] if len(sys.argv) > 1 else "godot").resolve()
errors: list[str] = []
checks = 0


def check(cond: bool, label: str) -> None:
    global checks
    checks += 1
    if not cond:
        errors.append(label)


def res_to_path(res: str) -> Path:
    return PROJ / res[len("res://"):]


def main() -> int:
    if not (PROJ / "project.godot").exists():
        print(f"ERROR: no project.godot under {PROJ}")
        return 1

    text = (PROJ / "project.godot").read_text(encoding="utf-8")

    # --- autoloads ---
    in_autoload = False
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("["):
            in_autoload = s == "[autoload]"
            continue
        if in_autoload and "=" in s and "res://" in s:
            m = re.search(r"res://[^\"']+\.gd", s)
            if m:
                p = res_to_path(m.group(0))
                check(p.exists(), f"autoload script missing: {m.group(0)}")

    # --- main scene ---
    m = re.search(r'run/main_scene="(res://[^"]+)"', text)
    if m:
        check(res_to_path(m.group(1)).exists(), f"main_scene missing: {m.group(1)}")
    else:
        errors.append("no run/main_scene in project.godot")

    # --- ext_resource script paths in .tscn ---
    for tscn in PROJ.rglob("*.tscn"):
        for m in re.finditer(r'ext_resource[^\n]*path="(res://[^"]+)"', tscn.read_text(encoding="utf-8")):
            check(res_to_path(m.group(1)).exists(),
                  f"{tscn.relative_to(PROJ)}: ext_resource missing {m.group(1)}")

    # --- literal res:// paths in .gd ---
    g3_tokens = re.compile(r"\b(KinematicBody|Spatial|PoolByteArray|PoolStringArray)\b|\.instance\(\)|yield\(")
    for gd in PROJ.rglob("*.gd"):
        body = gd.read_text(encoding="utf-8")
        for m in re.finditer(r'"(res://[^"]+\.(?:tscn|gd|json|tres|png|svg))"', body):
            check(res_to_path(m.group(1)).exists(),
                  f"{gd.relative_to(PROJ)}: res path missing {m.group(1)}")
        check(not g3_tokens.search(body), f"{gd.relative_to(PROJ)}: Godot-3 API token found")

    # --- data json ---
    items_dir = PROJ / "data" / "items"
    if items_dir.exists():
        found = list(items_dir.glob("*.json"))
        check(len(found) > 0, "no item json files found")
        for j in found:
            try:
                d = json.loads(j.read_text(encoding="utf-8"))
                for field in ("display_name", "category", "stack_size"):
                    check(field in d, f"{j.name}: missing '{field}'")
            except json.JSONDecodeError as e:
                errors.append(f"{j.name}: invalid JSON ({e})")

    print(f"static_validate: {checks} checks, {len(errors)} problem(s)")
    for e in errors:
        print("  PROBLEM:", e)
    print("RESULT:", "PASS" if not errors else "FAIL")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
