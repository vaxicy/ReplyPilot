#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Package the ReplyPilot Chrome extension into a Chrome Web Store zip.

Conventions (see chrome-store-zip-structure-and-package-script rule):
- The version comes from manifest.json (single source of truth); we never keep
  a second copy.
- manifest.json must sit at the zip ROOT (arcname = path relative to the
  project root).
- The zip ships only the extension body. Store listing assets (store-assets/),
  generator scripts (scripts/), the privacy-policy page (docs/) and dev files
  (.git, .codebuddy, *.zip) are excluded.
- The finished zip is copied to the default output folder (the workspace root),
  which is DERIVED from the project location instead of hard-coded.

Usage:
    python3 scripts/package.py
"""

import json
import os
import re
import shutil
import sys
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir))
MANIFEST = os.path.join(ROOT, "manifest.json")

# Directories that make up the extension itself.
INCLUDE_DIRS = [
    "_locales",
    "background",
    "content",
    "icons",
    "options",
    "popup",
    "services",
    "utils",
]

# Project-root files that ship with the extension.
INCLUDE_ROOT_FILES = ["manifest.json", "LICENSE", "README.md"]

# Root-level images referenced from the extension UI (e.g. the donate QR code
# used by options.html as "../<name>"). Picked up by extension so no non-ASCII
# filename has to be hard-coded here.
ROOT_IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp")

# Workspace root: two levels above the project (…/<workspace>/Chrome Extensions/ReplyPilot).
DEFAULT_OUT = os.path.abspath(os.path.join(ROOT, os.pardir, os.pardir))


def die(msg):
    print("[package] ERROR: %s" % msg, file=sys.stderr)
    raise SystemExit(1)


def collect():
    """Return the list of project-relative paths to put in the zip."""
    files = []

    for rel in INCLUDE_ROOT_FILES:
        if not os.path.exists(os.path.join(ROOT, rel)):
            die("missing required file: %s" % rel)
        files.append(rel)

    for fn in os.listdir(ROOT):
        p = os.path.join(ROOT, fn)
        if os.path.isfile(p) and fn.lower().endswith(ROOT_IMAGE_EXTS):
            files.append(fn)

    for d in INCLUDE_DIRS:
        base = os.path.join(ROOT, d)
        if not os.path.isdir(base):
            die("missing required directory: %s" % d)
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [x for x in dirnames if not x.startswith(".")]
            for fn in filenames:
                if fn.startswith(".") or fn.endswith(".pyc"):
                    continue
                rel = os.path.relpath(os.path.join(dirpath, fn), ROOT)
                files.append(rel.replace("\\", "/"))

    return sorted(set(files))


def manifest_refs(manifest):
    """Every file path the manifest points at (must exist in the package)."""
    refs = []
    for _size, rel in (manifest.get("icons") or {}).items():
        refs.append(rel)
    refs.append((manifest.get("action") or {}).get("default_popup", ""))
    refs.append(manifest.get("options_page", ""))
    refs.append((manifest.get("background") or {}).get("service_worker", ""))
    for cs in manifest.get("content_scripts", []):
        refs.extend(cs.get("js", []))
        refs.extend(cs.get("css", []))
    return [r for r in refs if r]


def check_html_root_refs(included):
    """Each "../<file>" reference in a shipped HTML file must resolve at root."""
    pat = re.compile(r'\.\./([^"\'\s)]+)')
    for rel in included:
        if not rel.endswith(".html"):
            continue
        with open(os.path.join(ROOT, rel), "r", encoding="utf-8") as f:
            for m in pat.finditer(f.read()):
                target = m.group(1)
                if not os.path.exists(os.path.join(ROOT, target)):
                    die("unresolved ../ reference in %s: %s" % (rel, target))


def main():
    with open(MANIFEST, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    assert manifest.get("manifest_version") == 3, "manifest_version must be 3"
    version = manifest["version"]
    zip_name = "ReplyPilot-%s.zip" % version
    release_dir = os.path.join(ROOT, "release")
    os.makedirs(release_dir, exist_ok=True)
    zip_path = os.path.join(release_dir, zip_name)

    # (1) every file the manifest references must exist on disk
    missing = [r for r in manifest_refs(manifest)
               if not os.path.exists(os.path.join(ROOT, r))]
    if missing:
        die("manifest references missing files: %s" % missing)

    files = collect()
    check_html_root_refs(files)

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel in files:
            # arcname = project-relative path => manifest.json stays at the root
            z.write(os.path.join(ROOT, rel), rel)

    # (2) manifest.json is at the zip root, and what is inside the zip is valid
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        assert "manifest.json" in names, "manifest.json is not at the zip root"
        assert not any(n.startswith("ReplyPilot/") for n in names), \
            "files are nested one level too deep (must be at the zip root)"
        inside = json.loads(z.read("manifest.json").decode("utf-8"))
        assert inside.get("version") == version, "version mismatch inside zip"
        assert inside.get("name") == manifest.get("name"), "name mismatch inside zip"

    size_kb = os.path.getsize(zip_path) / 1024.0
    print("[package] wrote release/%s (%d files, %.1f KB)" % (zip_name, len(files), size_kb))

    # (3) copy to the default output folder and make sure it is not a stale leftover
    if not os.path.isdir(DEFAULT_OUT):
        print("[package] default folder not found, skipping copy: %s" % DEFAULT_OUT)
        return
    dst = os.path.join(DEFAULT_OUT, zip_name)
    shutil.copyfile(zip_path, dst)
    with open(zip_path, "rb") as a, open(dst, "rb") as b:
        assert a.read() == b.read(), "copied file is not byte-identical"
    print("[package] copied to %s" % dst)


if __name__ == "__main__":
    main()
