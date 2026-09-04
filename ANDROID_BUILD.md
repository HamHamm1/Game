# ANDROID_BUILD.md — building & installing the Phase 1 + 1b APK

The project is **Android-first**. This document is the reproducible recipe
to turn the current foundation into a testable debug APK, plus an honest
record of what was and wasn't possible to do inside the development
container.

> Validation ladder (VALIDATION.md): building an APK is **not** `ANDROID
> VERIFIED`. It only becomes verified after the APK runs on a real device
> and passes `godot/ANDROID_VERIFICATION.md`. Until then Phase 2 stays
> **BLOCKED**.

---

## 0. Status in the development container (honest)

Probed and attempted on this machine (Godot 4.3.stable headless):

| Component | State here |
|---|---|
| JDK (keytool) | ✅ JDK 21 present; debug keystore generated (`tools/make_debug_keystore.sh`) |
| Godot 4.3 headless | ✅ present (`tools/godot`) |
| Godot 4.3 export templates | ✅ downloaded + installed (`tools/install_export_templates.sh`) |
| Export preset | ✅ `godot/export_presets.cfg` — loads and is accepted by Godot |
| **Android SDK** (apksigner/zipalign/platform) | ❌ **cannot be installed here** — `dl.google.com` is blocked by the container's egress policy (HTTP 403). |
| **APK build** | ❌ **NOT built.** `--export-debug` stops at exactly one error: *"A valid Android SDK path is required in Editor Settings."* |

So the export **configuration is validated** (preset + templates accepted);
the **only** missing piece is the Android SDK, which requires a machine
whose network can reach Google's SDK repository (or an SDK provided out of
band). **No APK was produced, and none is claimed.**

Reproduce this classification any time:
```bash
tools/validate_android_export.sh
# -> EXPORT CONFIG VALID — preset + templates accepted; Android SDK required (external)
```

---

> **Status: the cloud build WORKS.** GitHub Actions run #2 finished
> `success` and produced the artifact `aletheia-phase1-debug-apk`
> (~24 MB). Use §0b to download + install it on the phone, then run the A–T
> checklist. (Local-container status in §0 is unchanged: no SDK here, so the
> APK is built in CI, not in this container.)

## 0b. Recommended path with NO PC — GitHub Actions cloud build

You do not need a PC or a local Android SDK. The repo includes a cloud build
workflow, **`.github/workflows/android-build.yml`**, that runs on GitHub's
Linux runners (which are *not* behind this container's egress policy, so
they can install the Android SDK). It uses the project's **unchanged**
`godot/export_presets.cfg`.

**Operate entirely from the phone:**

1. Make sure **Actions are enabled** for the repo: GitHub → your repo →
   **Settings → Actions → General → Allow all actions** (one-time; doable in
   a mobile browser).
2. Trigger a build, either:
   - **Automatic:** any push to `claude/rpg-architecture-design-eut455` that
     touches `godot/**` runs it; or
   - **Manual:** GitHub → repo → **Actions** tab → **"Android Debug APK
     (Phase 1 + 1b)"** → **Run workflow** → pick the branch → Run.
3. **Download the APK the reliable way — from Releases, not Artifacts:**
   GitHub → repo → **Releases** → **"Phase 1 + 1b debug APK"** (tag
   `phase1-debug`) → tap **`aletheia-phase1-debug.apk`**. This downloads the
   **raw `.apk`** directly — **no unzip**.
   > ⚠️ Do **not** install the Actions **artifact** (`aletheia-phase1-debug-apk`):
   > GitHub always wraps artifacts in a **ZIP**, and installing that zip (or a
   > partial/corrupted extraction of it) is exactly what causes Android's
   > **"The file has a problem"**. The Release asset avoids this entirely.
4. Open the downloaded `.apk` → allow "install from unknown sources" →
   install. (Optional integrity check: the Release notes list the APK's
   **SHA-256**; a file manager or `RootBeer`-style hash app can confirm your
   download matches.) Then run `godot/ANDROID_VERIFICATION.md`.

What the workflow does (all validated locally except the SDK install, which
only GitHub's runners can do): installs JDK 17 + Android SDK
(`platform-tools`, `build-tools;34.0.0`, `platforms;android-34`), downloads
Godot 4.3 headless + export templates, generates a debug keystore, points
Godot at the SDK + keystore via `editor_settings-4.3.tres`, imports the
project headlessly, runs the `Android` preset, and uploads the APK.

> If a build fails, open the failed step's log (or the run **Summary**) and
> paste it back — the fix is in the workflow, not the game.

---

## 1. Prerequisites (on a machine that CAN reach the Android SDK)

1. **Godot 4.3** (editor or headless binary). `tools/fetch_godot.sh` gets
   the Linux headless binary; on your phone/PC use the matching 4.3 build.
2. **Godot 4.3 export templates** — `tools/install_export_templates.sh`
   (after downloading the `.tpz`, link in that script), or in the editor:
   *Editor → Manage Export Templates → Download*.
3. **JDK 17** recommended for Android (JDK 21 works for the non-gradle path
   used here; a *custom/gradle* build prefers 17).
4. **Android SDK** with:
   - `platform-tools` (adb)
   - `build-tools;34.0.0` (apksigner, zipalign)
   - `platforms;android-34`
   - (only for a **custom/gradle** build) the Android **NDK** + `cmdline-tools`.
   Install via `sdkmanager` from the command-line tools, e.g.:
   ```bash
   sdkmanager "platform-tools" "build-tools;34.0.0" "platforms;android-34"
   ```
5. **A debug keystore** — `tools/make_debug_keystore.sh` creates one at
   `tools/android/debug.keystore` (alias `androiddebugkey`, password
   `android`). Debug keystores are not secret; a **release** keystore is and
   must never be committed.

---

## 2. Point Godot at the SDK + keystore (one-time)

Headless export reads these from Godot's **editor settings** (not the
project). Either open the editor once and set them under *Editor Settings →
Export → Android* (`Android Sdk Path`, `Debug Keystore`, `Debug Keystore
User`, `Debug Keystore Pass`), or write them into the editor settings file
so a headless machine can export unattended:

`~/.config/godot/editor_settings-4.3.tres` (paths are examples):
```
export/android/android_sdk_path = "/path/to/Android/Sdk"
export/android/debug_keystore = "/abs/path/to/tools/android/debug.keystore"
export/android/debug_keystore_user = "androiddebugkey"
export/android/debug_keystore_pass = "android"
```
(If `$ANDROID_HOME`/`$ANDROID_SDK_ROOT` is set, recent Godot can pick the
SDK up from there.)

---

## 3. Build the APK (headless, reproducible)

From the repo root, with the SDK configured:
```bash
GODOT=tools/godot   # or your 4.3 binary
mkdir -p godot/build
"$GODOT" --headless --path godot --export-debug "Android" build/aletheia-phase1-debug.apk
```
Output: `godot/build/aletheia-phase1-debug.apk` (arm64-v8a, non-gradle,
signed with the debug keystore).

**AAB** (Play Store bundle) instead: set the preset's
`gradle_build/export_format` to AAB and enable a custom/gradle build
(needs the NDK), then export to `...phase1-debug.aab`. For side-loading a
test build, the **APK is what you want**.

`tools/validate_android_export.sh` runs this same export and reports
`APK BUILT` on success.

---

## 4. Install & run on the phone

- **From a PC with adb:** `adb install -r godot/build/aletheia-phase1-debug.apk`
- **Directly on the phone (no PC):** copy the `.apk` to the device (cloud
  drive, cable, or build it on-device with a Godot Android editor), then
  open it in a file manager and allow "install from unknown sources".

Then run the verification checklist: **`godot/ANDROID_VERIFICATION.md`**
(items A–T). Only when that passes is anything marked `ANDROID VERIFIED`.

---

## 5. The export preset (what `export_presets.cfg` encodes)

- **Name:** `Android` · **arch:** `arm64-v8a` only (covers modern mid-range
  phones; enable `armeabi-v7a` for older 32-bit devices — larger APK).
- **Build:** non-gradle (uses the prebuilt template APK; no NDK needed) —
  keeps the build simple and reproducible. Switch to gradle only when a
  plugin/NDK need arises (e.g. later phases).
- **Package:** `com.aletheia.phase1`, version `0.1.0-phase1` (code 1).
- **Screen:** immersive mode on; all size buckets supported (mobile-first,
  MOBILE_FIRST.md §4).
- **Permissions:** none requested (Phase 1 is fully offline — no `INTERNET`).
  When the Phase 3 LLM dialogue lands (DIALOGUE_DESIGN.md), add the
  `internet` permission then, not before.
- **Renderer:** the project uses the **Mobile** renderer on Android
  (`project.godot` `rendering_method.mobile="mobile"`).

Do not hand-edit the package name / signing for a public release without a
proper release keystore and review — this preset is for **debug test
builds only**.

---

## 6. Troubleshooting

- *"A valid Android SDK path is required"* → the SDK isn't configured;
  set it per §2. (This is the exact error seen in the container.)
- *"Android build template not installed"* / template errors → run
  `tools/install_export_templates.sh` (or download templates in the editor).
- *apksigner/zipalign not found* → install `build-tools;34.0.0`.
- *Gradle/JDK errors* → only relevant to custom/gradle builds; the default
  non-gradle path here does not need Gradle.
