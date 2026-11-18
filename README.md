# MinDustry Mod（像素工厂模组）

存放多个 Mindustry（像素工厂）模组的合集仓库，模组均支持 **PC 与 Android** 双平台。
本仓库只收录各模组的**源码与玩家文档**；正式安装包统一发布在 **Releases**。

---

## 模组目录

| 模组名 | 内部 ID | 简介 | 版本 | 平台 | 文档 |
|---|---|---|---|---|---|
| 自定义面板 | `custom-item-giver` | 悬浮按钮取物 + 九类独立滑条自定义加速，纯客户端工具 | v1.0（游戏 160+） | PC / Android | [mods/custom-item-giver/README.md](mods/custom-item-giver/README.md) |

---

## 通用安装指引

每个模组的 Releases 安装包提供两种格式，按平台选用：

- **PC 端（zip）**：从 [Releases](releases) 下载对应模组的 `*.zip`，**不解压**直接复制到
  `%APPDATA%\Mindustry\mods\`，游戏内 **设置 → Mods** 启用后重启游戏。
- **移动端（jar）**：从 [Releases](releases) 下载对应模组的 `*.jar`，复制到手机内部存储的
  `Mindustry/mods/` 目录（不存在则手动新建；部分设备位于 `Android/...` 下的 Mindustry 数据目录），
  游戏内 Mods 列表启用。

各模组的具体功能、使用步骤与故障排查，请看对应模组目录下的 README。

---

## 目录规范

```
github-repo/
├── README.md                  本文件（仓库总览与目录表）
└── mods/
    └── <模组ID>/              每个模组独立一个目录，目录名 = mod.hjson 里的 name
        ├── mod.hjson          模组元数据（游戏硬性要求，字段名必须英文）
        ├── scripts/           脚本目录（JS 模组入口必须是 scripts/main.js）
        └── README.md          面向玩家的中文手册
```

要求：
- 每个模组**独立**放在 `mods/<模组ID>/` 下，互不混放；
- 目录内只放游戏加载所需源码（`mod.hjson`、`scripts/` 等）与玩家文档（`README.md`）；
- 安装包内的目录结构与仓库一致：zip/jar 根级直接是 `mod.hjson` 与 `scripts/`。

---

## 新增模组流程

1. **建目录**：在 `mods/` 下新建 `<模组ID>/`（小写连字符 ASCII，与 `mod.hjson` 的 `name` 一致）。
2. **放源码**：复制 `mod.hjson` 与 `scripts/`（或 `content/`、`bundles/` 等游戏要求的目录）。
3. **写手册**：编写该模组的中文 `README.md`（功能、双平台安装、使用步骤、故障排查）。
4. **更新目录表**：在本文件「模组目录」表中加一行。
5. **打安装包**：分别打出 PC 用 `.zip` 与移动端用 `.jar`。
6. **发 Release**：在 GitHub Releases 中发布两个安装包，命名 `<模组ID>-<版本>.zip` / `.jar`。

---

## 开发版与 GitHub 版分离说明

本仓库是**发布镜像**，与本地开发工作区分离：

- 仓库只包含各模组的**源码与玩家文档**。
- 开发侧的校验脚本、构建工具、截图、本地打包产物（如 `开发校验/`、`发布/`、`.screenshots/`、
  `__pycache__/`、`*.class` 等）**一律不进仓库**（已在 `.gitignore` 中忽略）。
- 正式安装包不存放在仓库文件里，统一通过 **GitHub Releases** 分发。
