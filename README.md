# codex-chat-history-viewer

本地 Codex 聊天记录查看器（Next.js + TypeScript）。

## 启动

```bash
npm install
npm run dev
```

## 配置

- 默认读取 `CODEX_HOME`，否则使用 `~/.codex`。
- 数据仅本地读取，不上传。
- 删除是直接删除，不是归档。
- 恢复会话是复制 `codex resume <SESSION_ID>` 命令。
