# dsh-dual-peak

> ⚠️ **已轉移**：本專案已整合並改名為 **[dsh-ollama-tools](https://github.com/valkytie/dsh-ollama-tools)**。
> 新插件包除了原本的雙供應商峰谷對照，還加入了 **Ollama 餘額/用量查詢** 與 **切到 Ollama 模型時自動提醒輸出精簡到 64K 以內**。
> 請改用 `dsh plugin --profile web add github:valkytie/dsh-ollama-tools` 安裝，本 repo 不再維護。

DeepSeek Harness (DSH) 插件：**雙供應商峰谷對照**。

左下角懸浮膠囊同時顯示 **DeepSeek 官方 API** 與 **Ollama Cloud** 兩邊的尖峰/離峰狀態，並直接建議「現在該用哪個供應商」，讓你在兩邊峰谷時段互補時自動選最便宜的一方。

## 為什麼需要

DeepSeek-V4 系列自 2026-08-16 起實施峰谷計價，兩家供應商的尖峰時段**剛好互補**（台灣時間）：

| 供應商 | 尖峰時段（週一至五） | 離峰 |
|---|---|---|
| DeepSeek 官方 API | 09:00–12:00、14:00–18:00 | 其餘時間（週末全日） |
| Ollama Cloud | 20:00–02:00(+1) | 其餘時間（週末全日） |

兩邊每 token 單價相同（離峰 $0.22/$0.66、尖峰 ×2），所以**白天用 Ollama Cloud、晚上用 DeepSeek 官方**最省。

## 功能

- 左下角懸浮膠囊：`DS 峰 · OL 谷` 即時狀態，每 30 秒自動更新
- 點開顯示兩家各自的狀態、倒數計時（Xh Ym 後轉峰/谷）、價格倍率
- 直接建議當前最便宜的供應商
- 時區可設定（預設 Asia/Taipei），持久化到 DSH `settings.yaml`
- 使用 DSH 設計 token（`--dsw-*`），自動配合深色/淺色主題
- 可拖曳移動

## 安裝

```bash
dsh plugin --profile web add github:valkytie/dsh-dual-peak
```

安裝後**重啟 DeepSeek Harness**（`dsh web`）生效。

## 設定

在膠囊「設定」面板改時區，或直接編輯 `~/.dsh/settings.yaml`：

```yaml
dsbal-dualpeak:
  timezone: Asia/Taipei   # 可選，留空 = 本機時間
```

峰谷時段為內建固定值（依 DeepSeek / Ollama 官方公告），不提供修改——若官方調整時段，更新插件即可。

## 卸載

```bash
dsh plugin --profile web rm dsh-dual-peak
# 重啟 DSH
```

## 目錄結構

```
package.json        # dsh.bundle.patch → cordis.patch.yml；dsh.client → client 半端
cordis.patch.yml    # 插入插件行的 bundle patch
lib/index.js        # Host 半端（設定讀寫 / RPC 路由）
lib/client.js       # Client 半端（懸浮窗 UI）
```

## 授權

MIT
