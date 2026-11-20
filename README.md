<div align="center">

# MinDustry Mod（像素工厂模组）

**像素工厂（Mindustry）模组合集** · 支持 **PC** 与 **Android** 双平台

![Platform](https://img.shields.io/badge/Platform-PC%20%7C%20Android-2ea44f)
![Mindustry](https://img.shields.io/badge/Mindustry-160%2B-orange)
![Release](https://img.shields.io/badge/Release-v1.0-blue)

[**中文**](README.md) ｜ [English](README.en.md)

</div>

> 本仓库只收录各模组的**源码与玩家文档**；正式安装包（`.zip` / `.jar`）统一发布在 [Releases](releases)。
> 想直接玩？只需要去 Releases 下载安装包，**不需要**看懂仓库里任何源码文件。

---

## 目录

- [模组目录](#模组目录)
- [通用安装指引](#通用安装指引)
- [仓库文件说明](#仓库文件说明)
- [目录规范](#目录规范)
- [新增模组流程](#新增模组流程)
- [开发版与 GitHub 版分离](#开发版与-github-版分离)

---

## 模组目录

| 模组名 | 内部 ID | 简介 | 版本 | 平台 | 文档 |
|---|---|---|---|---|---|
| 自定义面板 | `custom-item-giver` | 悬浮按钮取物 + 九类独立滑条自定义加速，纯客户端工具 | v1.0（游戏 160+） | PC / Android | [中文](mods/custom-item-giver/README.md) ｜ [English](mods/custom-item-giver/README.en.md) |

---

## 通用安装指引

每个模组的 Releases 安装包提供两种格式，按平台选用：

- **PC 端（zip）**：从 [Releases](releases) 下载对应模组的 `*.zip`，**不解压**直接复制到
  `%APPDATA%\Mindustry\mods\`，游戏内 **设置 → Mods** 启用后重启游戏。
- **移动端（jar）**：从 [Releases](releases) 下载对应模组的 `*.jar`，复制到手机内部存储的
  `Mindustry/mods/` 目录（不存在则手动新建；部分设备位于 `Android/...` 下的 Mindustry 数据目录），
  游戏内 Mods 列表启用。

各模组的具体功能、使用步骤与故障排查，请看对应模组目录下的 README（每个模组都提供中 / 英两份手册）。

---

## 仓库文件说明

不熟悉 GitHub 的同学可以对照下表认识仓库里的每个文件：

| 文件 / 目录 | 是什么（中文说明） |
|---|---|
| `README.md` | 仓库主页（你正在看的这份），介绍整个仓库 |
| `README.en.md` | 本主页的英文完整对应版 |
| `.gitignore` | Git 忽略规则，防止开发者本地文件混入仓库，玩家可无视 |
| `mods/` | 所有模组的源码目录，每个模组一个子目录 |
| `mods/<模组ID>/mod.hjson` | 模组的"身份证"：名称、版本、作者等元数据，游戏靠它识别模组（字段名必须为英文） |
| `mods/<模组ID>/scripts/main.js` | 模组的全部功能逻辑（JavaScript 源代码），玩家无需修改 |
| `mods/<模组ID>/README.md` | 该模组的中文玩家手册（功能、安装、用法、排错） |
| `mods/<模组ID>/README.en.md` | 该模组的英文玩家手册 |

---

## 目录规范

```
MinDustry-Mod/
├── README.md                  # 仓库总览与目录表（中文，本文件）
├── README.en.md               # 仓库总览（英文版）
├── .gitignore                 # Git 忽略规则（屏蔽开发者本地产物）
└── mods/
    └── <模组ID>/              # 每个模组独立一个目录，目录名 = mod.hjson 里的 name
        ├── mod.hjson          # 模组元数据（游戏硬性要求，字段名必须英文）
        ├── scripts/           # 脚本目录（JS 模组入口必须是 scripts/main.js）
        ├── README.md          # 面向玩家的中文手册
        └── README.en.md       # 面向玩家的英文手册
```

要求：
- 每个模组**独立**放在 `mods/<模组ID>/` 下，互不混放；
- 目录内只放游戏加载所需源码（`mod.hjson`、`scripts/` 等）与玩家文档（中英两份 README）；
- 安装包内的目录结构与仓库一致：zip/jar 根级直接是 `mod.hjson` 与 `scripts/`。

---

## 新增模组流程

1. **建目录**：在 `mods/` 下新建 `<模组ID>/`（小写连字符 ASCII，与 `mod.hjson` 的 `name` 一致）。
2. **放源码**：复制 `mod.hjson` 与 `scripts/`（或 `content/`、`bundles/` 等游戏要求的目录）。
3. **写手册**：编写该模组的中、英两份玩家文档（`README.md` 与 `README.en.md`：功能、双平台安装、使用步骤、故障排查）。
4. **更新目录表**：在本文件与 `README.en.md` 的「模组目录」表中各加一行。
5. **打安装包**：分别打出 PC 用 `.zip` 与移动端用 `.jar`。
6. **发 Release**：在 GitHub Releases 中发布两个安装包，命名 `<模组ID>-<版本>.zip` / `.jar`。

---

## 开发版与 GitHub 版分离

本仓库是**发布镜像**，与本地开发工作区分离：

- 仓库只包含各模组的**源码与玩家文档**。
- 开发侧的校验脚本、构建工具、截图、本地打包产物（如 `.screenshots/`、`__pycache__/`、
  `*.class` 等）**一律不进仓库**（已在 `.gitignore` 中忽略）。
- 正式安装包不存放在仓库文件里，统一通过 **GitHub Releases** 分发。
