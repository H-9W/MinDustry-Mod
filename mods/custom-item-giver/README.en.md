# Custom Panel (custom-item-giver)

> **Version**: v1.0 | **Game version**: Mindustry 160+ | **Author**: H

[中文](README.md) ｜ [**English**](README.en.md)

Once in a game, a floating **Custom Panel (自定义面板)** button appears on screen. Tapping it opens a panel with two tabs, **Items** and **Speed**: browse/search any item and deposit it into your core vault; speed up your own buildings and player units by category.
A pure client-side UI tool — it adds no game content and causes no multiplayer version-hash conflicts.

---

## Features

### Floating button (draggable)
- Shows in a screen corner during gameplay (auto-hidden on the main menu and results screens).
- **Press and drag** to move the button anywhere on screen; the position is saved on release and restored next launch.
- A tap (movement ≤ 10 px) opens the panel.

### Items tab
- Search or browse **any item** (including items added by other mods), filtered by display name or internal name; Chinese input works directly (e.g. 「铜」).
- Set a quantity, use the `100 / 1k / 10k / 100k` presets, or give one of everything with a single click.
- Single-column card list per item: icon, name, **have** count (live), `Give`, `+1`.

### Speed tab (nine independent sliders, 0–20×)
- A master **Enable** switch at the top; turning it off instantly restores vanilla speed for all buildings and player units (no map restart needed).
- Nine categories, each with its **own slider** (integer steps 0–20; 0 or 1 = vanilla speed):

  `Conveyors / Mining / Crafting / Power / Turrets / Unit factories / Shields / Repair / Build & break`

- **Push one slider and only that category speeds up.** For example, with only "Mining" raised, conveyors and generators stay at vanilla speed.
- Note: foundries, chemical plants and separators count as "Crafting", not "Mining".
- The tab scrolls vertically and works on phones.
- The status line shows e.g. "Enabled · Conveyors×5, Mining×2… · K of my buildings", where K is the number of your buildings actually receiving the boost.

### Draggable panel
- Grab the panel **title bar** to move the whole window; its position is remembered when you close it.

### Remote request blocking (removes "Connection reset" popups)
- The mod blocks two remote requests made by the game itself (community server list + mod browser remote list), eliminating the repeated "Error (Connection reset)" popups when GitHub is unreachable.
- **Trade-off**: the mod browser then only shows locally installed mods, not the remote list.
- **Toggle**: set `BLOCK_REMOTE_FETCH` to `false` at the top of `scripts/main.js` and repackage if you don't want this behavior.

---

## Installation

### PC (zip)
1. Download `custom-item-giver-1.0.zip` from this repository's **Releases** page.
2. **Do not extract** the zip. Copy it as-is to `%APPDATA%\Mindustry\mods\`
   (i.e. `C:\Users\<you>\AppData\Roaming\Mindustry\mods\`; create the folder if missing).
3. Start the game, go to **Settings → Mods**, find "Custom Panel (自定义面板)" and switch it on.
4. **Restart the game** when prompted.

### Mobile (jar)
1. Download `custom-item-giver-1.0.jar` from **Releases**.
2. Using a file manager, copy the jar to `Mindustry/mods/` on internal storage:
   - create the folder if it does not exist;
   - on some devices the data directory lives under `Android/...` — use wherever your existing Mindustry folder is.
3. Start the game, enable "Custom Panel (自定义面板)" in **Settings → Mods**, restart when prompted.

---

## Usage

1. Enter any map (survival, sandbox or campaign).
2. Tap the Custom Panel button to open it; press and drag the button to reposition it.
3. Switch between the **Items** and **Speed** tabs at the top — switching never loses your quantities, search text or slider values.
4. Items tab: search or browse → set a quantity → tap `Give` or `+1`; the core vault counter at the top-left updates immediately.
5. Speed tab: enable the master switch → push the sliders you need.
6. Close with ×; both button and window positions are saved.

---

## Behavior details

- **Where items go**: into the **first core** of your team (the total shown at the top-left). Written directly, ignoring core capacity — this is a tool-style grant. With no core (blank/editor maps), items go to the held slot of your current unit, which holds one item type at a time with a capacity limit; overflow is dropped by the game.
- **Singleplayer / host only**: item giving and speed-up work in singleplayer (including maps where you are the host). As a multiplayer client you'll see "items are managed by the server" — client-side changes would be overwritten by the server. By design, not a bug.
- **Liquid pipes and payload conveyors cannot be sped up**: the vanilla engine itself ignores `timeScale` for them. An engine limitation, also stated in the Speed tab.
- **Only your team**: enemy building speeds and the next-wave timer stay vanilla.
- **Overdrive projectors respected**: the boost uses the engine's own `applyBoost` (maximum only) — a projector offering a higher boost wins.
- **Turning it off restores instantly**: unchecking the switch or pulling a slider back to 0/1 makes buildings decay to vanilla speed on the next frame; no leftover boost.
- **Boost also raises power/fuel consumption** — the same vanilla overdrive trade-off (higher tiers drill harder and draw more), not an extra penalty from this mod.
- **Build & break slider** affects your player units' build/mine speed, not buildings; it resets at 0, when the switch is off, or when you switch units.
- **Positions** are stored in the game's `settings.bin` (keys `cig-btn-x` / `cig-btn-y` / `cig-win-x` / `cig-win-y`); delete those keys to reset. After resolution/window changes, an off-screen button is auto-clamped back into view.

---

## Troubleshooting

**Installed but no button in game?**
- Check **Settings → Mods** that the switch for "Custom Panel" is **on**, then restart the game. Dropping a mod in the folder ≠ enabling it.
- Confirm your game version: this mod requires **Mindustry 160 or newer**.
- On PC, make sure the zip sits in `%APPDATA%\Mindustry\mods\` **unextracted**.

**"Mod failed to load" / mod auto-disabled?**
- Mindustry auto-disables a mod whose script throws an exception. Fix: Settings → Mods → re-enable the switch → restart.

**Still getting "Error (Connection reset)" popups?**
- Make sure the mod is enabled (the blocking logic lives in the mod). If you set `BLOCK_REMOTE_FETCH` to `false`, remote requests — and the popups — return.

**"Items are managed by the server" when tapping Give?**
- You are a client in a multiplayer game. Only singleplayer or hosting yourself allows giving and boosting; see Behavior details.

**Sliders do nothing?**
- Check the master Enable switch; steps 0 and 1 both equal vanilla speed.
- Liquid pipes and payload conveyors are unsupported by the engine.
- If the status line shows "0 of my buildings", this map has no buildings of that category.

---

## Mod Files Explained

What each file in this directory is (players only need the Releases packages — you do **not** need to touch any file below):

| File | What it is |
|---|---|
| `mod.hjson` | The mod's "ID card": display name, version, author and other metadata the game uses to recognize and load the mod (field names must be English) |
| `scripts/main.js` | All mod logic in JavaScript source; the only setting you may ever edit is the `BLOCK_REMOTE_FETCH` switch at the top |
| `README.md` | This manual (Chinese) |
| `README.en.md` | This manual (English) |

---

## Version info

| Item | Value |
|---|---|
| Display name | 自定义面板 (Custom Panel) |
| Internal ID | custom-item-giver |
| Version | v1.0 |
| Minimum game version | 160 |
| Author | H |
| Type | Pure client-side UI tool (`hidden: true`, registers no content, no multiplayer version-hash conflict) |

**v1.0 highlights**: rewritten draggable button (long-press follow, position memory); single-column item cards with live "have" counts; nine independent 0–20× speed sliders; draggable panel title bar; text layout tuned to measured glyph widths with ellipsis and mobile narrow-screen support; remote-request blocking to kill the Connection reset popups (toggleable via `BLOCK_REMOTE_FETCH`).
