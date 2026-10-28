# Reliable Android UI actions

- `tap_text` resolves text/content descriptions from Android accessibility hierarchy first; Tesseract is not required. Ambiguous matches fail safely.
- `snapshot_ui` retries transient hierarchy capture failures up to three times with short increasing delays and jitter.
- `clear_and_type_text` focuses a field by text or coordinates, sends Ctrl+A using Android `input keycombination`, deletes the selection and types replacement text. Some vendor builds may not support keycombination; unsupported commands fail explicitly. Use IME/clipboard workflows for non-Latin text and emoji.
- `is_keyboard_visible` reads `dumpsys input_method`; it may return `visible: null` when the Android/vendor build does not expose a recognized field. Keyboard auto-hide is not implicit because dismissing it can shift layout; refresh the hierarchy and re-resolve targets afterwards.
- `launch_app_device` accepts either `package` or `packageId` to launch an already-installed app without a local APK. A specific `activity` is optional; otherwise the launcher intent is used.
