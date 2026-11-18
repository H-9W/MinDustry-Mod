<div align="center">

# MinDustry Mod

**A collection of Mindustry mods** · Supports **PC** and **Android**

![Platform](https://img.shields.io/badge/Platform-PC%20%7C%20Android-2ea44f)
![Mindustry](https://img.shields.io/badge/Mindustry-160%2B-orange)
![Release](https://img.shields.io/badge/Release-v1.0-blue)

[中文](README.md) ｜ [**English**](README.en.md)

</div>

> This repository only contains mod **source code and player documentation**; official installable packages (`.zip` / `.jar`) are published in [Releases](releases).
> Just want to play? Download the package from Releases — you do **not** need to understand any source file in this repository.

---

## Table of Contents

- [Mod Index](#mod-index)
- [General Installation](#general-installation)
- [Repository Files Explained](#repository-files-explained)
- [Directory Convention](#directory-convention)
- [Adding a New Mod](#adding-a-new-mod)
- [Development vs GitHub Release Separation](#development-vs-github-release-separation)

---

## Mod Index

| Mod Name | Internal ID | Description | Version | Platform | Docs |
|---|---|---|---|---|---|
| Custom Panel (自定义面板) | `custom-item-giver` | Floating button for item giving + nine independent speed sliders, pure client-side tool | v1.0 (game 160+) | PC / Android | [中文](mods/custom-item-giver/README.md) ｜ [English](mods/custom-item-giver/README.en.md) |

---

## General Installation

Each mod publishes two package formats in Releases, pick by platform:

- **PC (zip)**: Download the mod's `*.zip` from [Releases](releases). **Do not extract it** — copy the zip as-is to
  `%APPDATA%\Mindustry\mods\`, then enable it in **Settings → Mods** and restart the game.
- **Mobile (jar)**: Download the mod's `*.jar` from [Releases](releases) and copy it to the
  `Mindustry/mods/` folder on your device's internal storage (create the folder if missing; on some devices it lives
  under `Android/...` in the Mindustry data directory), then enable it in the in-game Mods list.

For detailed features, usage steps and troubleshooting, read the README inside each mod's folder (Chinese and English manuals are provided).

---

## Repository Files Explained

New to GitHub? Here is what every file in this repository is:

| File / Directory | What it is |
|---|---|
| `README.md` | The repository home page (Chinese overview) |
| `README.en.md` | This page (English overview) |
| `.gitignore` | Git ignore rules that keep developer-only files out of the repo; players can ignore it |
| `mods/` | Source directory of all mods, one subdirectory per mod |
| `mods/<mod-id>/mod.hjson` | The mod's "ID card": name, version, author and other metadata the game uses to recognize the mod (field names must be English) |
| `mods/<mod-id>/scripts/main.js` | All mod logic in JavaScript source code — players never need to edit it |
| `mods/<mod-id>/README.md` | The mod's Chinese player manual (features, install, usage, troubleshooting) |
| `mods/<mod-id>/README.en.md` | The mod's English player manual |

---

## Directory Convention

```
MinDustry-Mod/
├── README.md                  # Repository overview (Chinese)
├── README.en.md               # Repository overview (English, this file)
├── .gitignore                 # Git ignore rules (excludes developer-only artifacts)
└── mods/
    └── <mod-id>/              # One directory per mod; directory name = the "name" field in mod.hjson
        ├── mod.hjson          # Mod metadata (required by the game; field names must be English)
        ├── scripts/           # Scripts directory (JS mod entry must be scripts/main.js)
        ├── README.md          # Player manual (Chinese)
        └── README.en.md       # Player manual (English)
```

Rules:
- Every mod lives **alone** under `mods/<mod-id>/`; never mix mods.
- Only game-required sources (`mod.hjson`, `scripts/`, etc.) and player docs (both READMEs) go inside.
- The package layout matches the repository: `mod.hjson` and `scripts/` sit at the zip/jar root.

---

## Adding a New Mod

1. **Create directory**: add `mods/<mod-id>/` (lowercase ASCII with hyphens, matching the `name` field in `mod.hjson`).
2. **Add sources**: copy `mod.hjson` and `scripts/` (or `content/`, `bundles/`, etc. as required by the game).
3. **Write manuals**: provide both the Chinese `README.md` and English `README.en.md` (features, dual-platform install, usage, troubleshooting).
4. **Update the index**: add a row to the Mod Index table in both `README.md` and `README.en.md`.
5. **Build packages**: produce the PC `.zip` and the mobile `.jar`.
6. **Publish a Release**: upload both packages under `<mod-id>-<version>.zip` / `.jar`.

---

## Development vs GitHub Release Separation

This repository is a **release mirror**, separate from the local development workspace:

- It contains only each mod's **source code and player documentation**.
- Developer-side validation scripts, build tools, screenshots and local packaging outputs (such as `开发校验/`, `发布/`,
  `.screenshots/`, `__pycache__/`, `*.class`) are **never committed** (already ignored via `.gitignore`).
- Installable packages are not stored in the repository files; they are distributed exclusively through **GitHub Releases**.
