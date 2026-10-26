#!/usr/bin/env python3
"""
Thin bridge from AndroidBuildMCP's Node/TS process to the uiautomator2 Python
library. Bundled the same way XcodeBuildMCP bundles the AXe binary for iOS
accessibility automation: a small, purpose-built external helper the MCP
server shells out to per call, instead of reimplementing uiautomator2's
on-device HTTP protocol in TypeScript.

One-time setup on the machine running this MCP server (not the phone):
    pip install uiautomator2
    python -m uiautomator2 init

Usage:
    python3 u2_bridge.py <serial> <command> [args...]

Commands: ping, dump_hierarchy, tap x y, long_press x y duration_s,
swipe sx sy ex ey duration_s, drag sx sy ex ey duration_s, screenshot

Always prints exactly one line of JSON to stdout:
    {"ok": true, "data": ...} or {"ok": false, "error": "..."}
so the TypeScript caller can parse the last line without guessing at any
other format. Never partially prints - any failure is caught and reported
through the same JSON envelope, never a raw traceback.
"""
import base64
import json
import sys


def main() -> int:
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "usage: u2_bridge.py <serial> <command> [args...]"}))
        return 1

    serial = sys.argv[1]
    command = sys.argv[2]
    args = sys.argv[3:]

    try:
        import uiautomator2 as u2
    except ImportError:
        print(json.dumps({
            "ok": False,
            "error": "uiautomator2 is not installed in this Python environment. Run: pip install uiautomator2",
        }))
        return 1

    try:
        d = u2.connect(serial)
    except Exception as exc:  # noqa: BLE001 - surface the real connection error
        print(json.dumps({"ok": False, "error": f"could not connect to {serial}: {exc}"}))
        return 1

    try:
        if command == "ping":
            result = {"ok": True, "data": d.info}

        elif command == "dump_hierarchy":
            result = {"ok": True, "data": d.dump_hierarchy()}

        elif command == "tap":
            x, y = float(args[0]), float(args[1])
            d.click(x, y)
            result = {"ok": True, "data": None}

        elif command == "long_press":
            x, y, duration = float(args[0]), float(args[1]), float(args[2])
            d.long_click(x, y, duration)
            result = {"ok": True, "data": None}

        elif command == "swipe":
            sx, sy, ex, ey, duration = (float(a) for a in args[:5])
            d.swipe(sx, sy, ex, ey, duration)
            result = {"ok": True, "data": None}

        elif command == "drag":
            sx, sy, ex, ey, duration = (float(a) for a in args[:5])
            d.drag(sx, sy, ex, ey, duration)
            result = {"ok": True, "data": None}

        elif command == "screenshot":
            raw = d.screenshot(format="raw")
            result = {"ok": True, "data": base64.b64encode(raw).decode("ascii")}

        else:
            result = {"ok": False, "error": f"unknown command: {command}"}

    except Exception as exc:  # noqa: BLE001 - surface the real device-call error
        result = {"ok": False, "error": str(exc)}

    print(json.dumps(result))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
