# Codex Chat History Viewer 独立工具需求文档

## 0. 给 Codex 的执行说明

你需要实现一个新的、独立的本地 Web 工具，名称为：

```txt
codex-chat-history-viewer
```

这个工具用于查看、搜索、美化展示 Codex CLI 的本地聊天记录。

请不要把它嵌入现有业务项目。  
请创建一个独立的 Next.js + React + TypeScript 项目。  
请优先实现可运行、可搜索、可查看详情、可直接删除会话、可复制 `codex resume` 命令的完整 MVP。

实现过程中不要依赖云服务，不要上传聊天记录，不要调用第三方 AI 服务。  
所有数据都来自本机 Codex 历史文件。

## 1. 项目目标

实现一个本地运行的 Codex 聊天记录查看器，核心能力如下：

1. 自动查找本机 Codex 聊天记录。
2. 展示 Codex 会话列表。
3. 支持搜索会话标题、会话预览、聊天正文、工作目录、模型名。
4. 点击会话后展示完整聊天内容。
5. 尽量还原 Codex 终端中的展示效果。
6. 对 Markdown、表格、代码块、diff、终端输出做美观渲染。
7. 如果记录中存在思考、分析、reasoning、thinking 等过程，只显示一行提示，不展示完整思考内容。
8. 支持直接删除会话，不做归档。
9. 支持“恢复会话”按钮，该按钮的含义是生成并复制 `codex resume <SESSION_ID>` 命令，用于在终端继续该 Codex 会话。
10. 页面整体要清晰、美观、有层次，不要把所有内容一坨纯文本堆在页面上。

## 2. 技术栈要求

使用：

- Next.js
- React
- TypeScript
- Tailwind CSS
- Node.js API Routes 或 Route Handlers
- `react-markdown`
- `remark-gfm`
- `shiki` 或 `highlight.js`
- `ansi-to-html` 或等价 ANSI 渲染库
- `fuse.js`
- `zod`
- `date-fns`
- `lucide-react`

如果项目初始化时没有包管理器限制，优先使用 `pnpm`。  
如果环境没有 `pnpm`，使用 `npm`。

## 3. 运行方式

项目完成后，应支持：

```bash
pnpm install
pnpm dev
```

或：

```bash
npm install
npm run dev
```

默认只允许本机访问：

```txt
http://localhost:3000
```

不要默认暴露到局域网。

## 4. 数据来源

### 4.1 Codex Home 路径

读取 Codex 本地历史时，按以下优先级确定 Codex Home：

1. 环境变量 `CODEX_HOME`
2. 默认路径 `~/.codex`

实现函数：

```ts
function getCodexHome(): string
```

要求：

- 支持 macOS / Linux / Windows。
- 展开 `~`。
- 如果路径不存在，页面显示空状态，不要报错崩溃。
- 允许用户在页面设置里手动输入 Codex Home 路径。
- 手动路径只保存在浏览器 localStorage，不要写入 Codex 配置文件。

### 4.2 需要扫描的文件

在 Codex Home 下递归扫描 JSONL 文件。

重点扫描：

```txt
$CODEX_HOME/history.jsonl
$CODEX_HOME/sessions/**/*.jsonl
$CODEX_HOME/**/*.jsonl
```

不要假设 Codex 文件结构永远固定。  
解析逻辑必须容错。

### 4.3 不使用归档作为删除机制

不要把删除实现成 `thread/archive`。  
本工具的“删除会话”必须是直接删除本地会话文件，或者从可编辑索引文件中移除该会话对应记录。

删除后不提供“从已删除列表恢复”。  
“恢复会话”不是恢复被删除的会话，而是继续未删除的 Codex 会话，也就是 `codex resume`。

## 5. 内部数据模型

实现统一的数据模型，不要让 UI 直接依赖原始 JSONL 结构。

```ts
export interface CodexThread {
  id: string
  sessionId?: string
  title: string
  preview: string
  cwd?: string
  model?: string
  createdAt?: number
  updatedAt?: number
  sourceFiles: string[]
  primaryFile?: string
  messageCount: number
  hasThinking: boolean
  hasToolCalls: boolean
  hasTerminalOutput: boolean
  hasCodeChanges: boolean
  hasErrors: boolean
  raw?: unknown
}

export interface CodexMessage {
  id: string
  threadId: string
  role: 'user' | 'assistant' | 'system' | 'tool' | 'terminal' | 'unknown'
  type:
    | 'text'
    | 'markdown'
    | 'code'
    | 'table'
    | 'diff'
    | 'terminal-output'
    | 'tool-call'
    | 'thinking-placeholder'
    | 'error'
    | 'unknown'
  content: string
  command?: string
  language?: string
  createdAt?: number
  metadata?: Record<string, unknown>
  raw?: unknown
}

export interface ParsedCodexHistory {
  threads: CodexThread[]
  messagesByThreadId: Record<string, CodexMessage[]>
  diagnostics: ParseDiagnostic[]
}

export interface ParseDiagnostic {
  file: string
  line?: number
  level: 'info' | 'warning' | 'error'
  message: string
}
```

## 6. JSONL 解析要求

实现一个独立 parser：

```txt
src/lib/codex/parser.ts
```

parser 负责把各种可能的 Codex JSONL 记录转换成统一结构。

### 6.1 容错原则

必须满足：

1. 单行 JSON 解析失败时跳过该行。
2. 某个文件解析失败时跳过该文件。
3. 不要因为一条坏数据导致整个页面不可用。
4. 所有解析失败信息写入 diagnostics。
5. diagnostics 不要包含完整敏感内容。
6. UI 可以显示“部分记录解析失败”，但不要阻塞使用。

### 6.2 字段识别

尽量从原始对象中递归识别：

- thread id
- session id
- message id
- role
- content
- timestamp
- cwd
- model
- command
- stdout
- stderr
- tool call
- diff
- reasoning/thinking/analysis 标记

可能的字段名包括但不限于：

```txt
id
threadId
thread_id
sessionId
session_id
conversationId
conversation_id
role
type
kind
name
text
content
message
messages
items
timestamp
createdAt
updatedAt
cwd
workingDirectory
model
command
cmd
stdout
stderr
output
result
```

不要只依赖一种固定结构。

### 6.3 会话分组

优先按以下顺序分组：

1. `sessionId`
2. `threadId`
3. JSONL 文件路径
4. 解析出的 UUID
5. fallback hash

实现规则：

```ts
function resolveThreadId(raw: unknown, filePath: string): string
```

如果能从文件名或内容中识别 UUID，把它作为候选 sessionId。  
如果无法识别，就用文件路径 hash 生成稳定 id。

### 6.4 标题生成

会话标题按以下优先级生成：

1. 原始数据中的 title/name
2. 第一条用户消息的前 60 个字符
3. preview 字段
4. 当前工作目录 basename
5. `Untitled Codex Session`

标题不能超过两行展示。  
完整标题 hover 时显示。

### 6.5 preview 生成

preview 使用：

1. 第一条用户消息
2. 第一条 assistant 消息
3. 原始 preview 字段
4. 空字符串

preview 在会话列表最多显示三行。

## 7. 内容类型识别

实现：

```txt
src/lib/codex/classify-message.ts
```

### 7.1 Markdown

满足以下任一条件时按 Markdown 渲染：

- 包含 Markdown 标题
- 包含列表
- 包含引用
- 包含 fenced code block
- 包含 Markdown 表格
- 包含链接
- assistant 普通回复

### 7.2 表格

如果内容包含 Markdown 表格：

```md
| Name | Value |
| ---- | ----- |
| A    | 1     |
```

则 Markdown 渲染必须启用 GFM，让它显示为真正 HTML 表格。

表格要求：

- 表头清晰
- 单元格边框轻量
- 支持横向滚动
- 不撑爆页面
- 保留终端表格的语义

### 7.3 代码块

如果包含 fenced code block：

````md
```ts
const a = 1
```
````

则使用代码块样式渲染。

代码块要求：

- 语法高亮
- 显示语言名称
- 支持复制
- 保留缩进
- 超长横向滚动
- 超过一定高度后可折叠展开

### 7.4 diff

如果内容包含以下特征之一，按 diff 展示：

```txt
diff --git
+++
---
@@
```

diff 展示要求：

- 新增行、删除行、上下文行视觉区分
- 文件名清晰
- 长 diff 默认折叠
- 支持复制完整 diff
- 保留原始文本

### 7.5 终端输出

如果内容来自：

- command
- shell
- stdout
- stderr
- terminal
- exec output
- tool output

则按终端输出展示。

终端输出要求：

- 等宽字体
- 深色终端块
- 保留换行
- 保留缩进
- 支持 ANSI 颜色
- 支持复制
- 超过 120 行默认折叠
- 可展开完整输出

示例展示：

```txt
$ npm test

> project@1.0.0 test
> vitest

✓ src/a.test.ts
✓ src/b.test.ts

Test Files  2 passed
Tests       12 passed
```

### 7.6 工具调用

工具调用不要直接展示大段裸 JSON。

默认显示摘要：

```txt
工具调用：读取文件 src/App.tsx
```

或：

```txt
工具调用：执行命令 npm test
```

点击展开后再显示详细信息。

如果工具调用结果是 Markdown、表格、代码、diff、终端输出，应继续按对应类型渲染。

### 7.7 思考过程

如果日志中出现以下类型或字段：

```txt
thinking
reasoning
analysis
chain_of_thought
cot
internal_reasoning
```

不要展示完整内容。

只显示一条占位消息：

```txt
Codex 已进行思考/分析，详细过程不展示。
```

要求：

- 不展示完整深度思考内容。
- 不尝试恢复或总结隐藏推理。
- 不把 reasoning 原文放进 DOM。
- 不在浏览器 console 打印 reasoning 原文。
- 同一连续思考片段可以合并成一条占位提示，避免刷屏。

## 8. 页面结构

### 8.1 总体布局

桌面端使用两栏布局：

```txt
┌────────────────────────────────────────────────────────────┐
│ 顶部栏：标题 / 搜索框 / 数据源状态 / 刷新 / 设置             │
├──────────────────┬─────────────────────────────────────────┤
│ 左侧会话列表      │ 右侧会话详情                            │
│                  │                                         │
│ 筛选              │ 消息时间线                               │
│ 会话卡片          │ Markdown / 表格 / 代码 / 终端输出          │
│                  │                                         │
└──────────────────┴─────────────────────────────────────────┘
```

移动端使用单列：

```txt
会话列表页 -> 会话详情页
```

### 8.2 顶部栏

包含：

- 应用名：Codex Chat History
- 搜索框
- 当前 Codex Home 路径
- 数据状态：
  - 已连接本地历史
  - 未找到历史
  - 部分解析失败
- 刷新按钮
- 设置按钮

### 8.3 左侧会话列表

每个会话卡片展示：

- 会话标题
- preview
- 更新时间
- 创建时间
- cwd
- model
- 消息数
- 标签：
  - 有终端输出
  - 有工具调用
  - 有代码修改
  - 有错误
  - 有思考过程
- 操作按钮：
  - 查看
  - 恢复会话
  - 删除

会话卡片不要拥挤。  
当前选中会话要有明显高亮。

### 8.4 右侧会话详情

顶部展示：

- 会话标题
- sessionId
- cwd
- model
- 创建时间
- 更新时间
- 消息数
- sourceFiles
- 按钮：
  - 复制恢复命令
  - 恢复会话
  - 复制整个会话 Markdown
  - 删除会话

下面是消息时间线。

## 9. 搜索与筛选

### 9.1 搜索范围

搜索支持：

- 会话标题
- preview
- 用户消息
- assistant 回复
- 工具调用摘要
- 终端输出
- cwd
- model
- sessionId

### 9.2 搜索体验

要求：

- 输入时即时搜索。
- 关键词高亮。
- 搜索结果显示命中的消息片段。
- 点击命中片段后跳转到对应消息。
- 目标消息短暂高亮。
- 搜索结果不要让页面卡顿。

### 9.3 筛选项

支持筛选：

- 全部会话
- 当前项目
- 有终端输出
- 有工具调用
- 有代码修改
- 有错误
- 有思考过程

### 9.4 排序

支持：

- 最近更新优先
- 最早更新优先
- 创建时间倒序
- 创建时间正序
- 消息数最多优先

## 10. 删除会话

### 10.1 删除语义

删除会话必须是直接删除，不是归档。

删除后：

- 会话从列表中消失。
- 不进入已删除列表。
- 不提供本工具内的恢复。
- 对应的 `codex resume <SESSION_ID>` 也可能无法继续。
- 页面必须明确提示这是不可恢复操作。

### 10.2 删除实现

实现接口：

```http
DELETE /api/threads/:threadId
```

删除逻辑：

1. 根据 `threadId` 找到对应 `CodexThread`。
2. 找到该会话的 `primaryFile`。
3. 校验文件路径必须位于 `CODEX_HOME` 内。
4. 如果 `primaryFile` 是独立 session JSONL 文件，则直接删除该文件。
5. 如果会话只存在于 `history.jsonl` 这种共享索引文件中，不要删除整个 `history.jsonl`。
6. 对共享 JSONL 文件，应采用原子重写方式移除匹配该 thread/session 的行。
7. 原子重写流程：
   - 读取原文件
   - 过滤出不属于该会话的行
   - 写入临时文件
   - rename 覆盖原文件
8. 删除后刷新内存索引。
9. 删除失败时显示明确错误。

路径安全要求：

- 不允许删除 `CODEX_HOME` 外的文件。
- 不允许删除目录。
- 不允许删除非 JSONL 文件。
- 不允许因为解析错误删除不确定的文件。
- 如果无法定位会话文件，禁用删除按钮并提示“无法定位原始会话文件，不能直接删除”。

### 10.3 删除确认

点击删除按钮后必须弹确认框。

确认文案：

```txt
确认永久删除这个 Codex 会话吗？

此操作会直接删除本地会话记录，不会归档，也不能在本工具中恢复。
如果你还需要继续该会话，请先使用“恢复会话”复制 codex resume 命令。
```

用户必须二次确认。  
推荐要求用户输入会话标题或 sessionId 后才能删除。

### 10.4 删除按钮状态

以下情况删除按钮 disabled：

- 找不到 source file
- source file 不在 CODEX_HOME 下
- source file 不是 JSONL
- 会话 id 不可靠
- 当前 parser 无法确认该文件只属于该会话，且无法安全重写

## 11. 恢复会话按钮

### 11.1 恢复会话的定义

本工具里的“恢复会话”不是恢复已删除会话。  
它的含义是继续某个 Codex CLI 历史会话，也就是生成：

```bash
codex resume <SESSION_ID>
```

如果有 cwd，则生成更完整的命令：

```bash
cd "<cwd>" && codex resume <SESSION_ID>
```

### 11.2 按钮行为

会话列表和会话详情都需要有按钮：

```txt
恢复会话
```

点击后打开一个弹窗，展示：

- sessionId
- cwd
- macOS / Linux 命令
- Windows PowerShell 命令
- 复制按钮

示例：

```bash
cd "/Users/me/project" && codex resume 00000000-0000-0000-0000-000000000000
```

Windows PowerShell 示例：

```powershell
Set-Location -LiteralPath "C:\Users\me\project"; codex resume 00000000-0000-0000-0000-000000000000
```

点击“复制命令”后：

- 复制命令到剪贴板
- 显示 toast：`已复制 codex resume 命令`
- 不要在网页后台偷偷运行 interactive Codex

### 11.3 sessionId 不存在时

如果无法识别 sessionId：

- 禁用“恢复会话”按钮
- tooltip 显示：

```txt
无法识别 sessionId，不能生成 codex resume 命令。
```

## 12. 消息展示细节

### 12.1 用户消息

用户消息样式：

- 右侧或明显用户样式
- 背景轻微区分
- 支持 Markdown
- 支持复制

### 12.2 Codex 回复

Codex 回复样式：

- 左侧或主内容卡片
- Markdown 美化渲染
- 表格正常显示
- 代码块高亮
- 支持复制

### 12.3 系统消息

系统消息样式：

- 小号文字
- 灰色
- 默认折叠
- 可展开查看

### 12.4 工具调用消息

工具调用样式：

```txt
工具调用：<摘要>
```

默认折叠。

展开后显示：

- 工具名称
- 参数摘要
- 结果摘要
- 原始 JSON 调试视图

原始 JSON 调试视图默认关闭。

### 12.5 终端输出消息

终端输出样式：

- 黑色或深色背景
- 等宽字体
- 顶部显示命令
- stdout/stderr 区分
- ANSI 颜色渲染
- 支持复制
- 支持展开/收起

### 12.6 错误消息

错误消息样式：

- 警告色
- 显示错误摘要
- 可展开查看详情
- 不要大段裸 JSON 堆出来

## 13. UI 风格要求

整体风格：

- 开发工具风
- 简洁
- 清晰
- 层级明确
- 信息密度适中
- 不花哨
- 不像原始日志堆叠页面

视觉要求：

- 左侧会话列表使用卡片。
- 右侧消息使用时间线或分组卡片。
- 顶部栏固定。
- 会话列表独立滚动。
- 会话详情独立滚动。
- 当前选中会话有高亮。
- 长内容不撑爆页面。
- 表格外层有横向滚动容器。
- 代码块和终端输出有复制按钮。
- 工具调用默认折叠。
- 大段 diff 默认折叠。
- 思考提示使用轻量提示条。

推荐布局尺寸：

```txt
左侧宽度：360px - 440px
右侧：自适应
页面最大宽度：不限
消息内容最大宽度：适合阅读，不要过窄
```

## 14. 组件拆分

建议实现以下组件：

```txt
src/components/app-shell.tsx
src/components/top-bar.tsx
src/components/thread-list.tsx
src/components/thread-card.tsx
src/components/thread-detail.tsx
src/components/message-timeline.tsx
src/components/message-card.tsx
src/components/markdown-renderer.tsx
src/components/code-block.tsx
src/components/diff-block.tsx
src/components/terminal-block.tsx
src/components/tool-call-block.tsx
src/components/thinking-placeholder.tsx
src/components/delete-thread-dialog.tsx
src/components/resume-thread-dialog.tsx
src/components/settings-dialog.tsx
src/components/empty-state.tsx
src/components/error-state.tsx
```

## 15. API 设计

### 15.1 获取会话列表

```http
GET /api/threads
```

Query：

```txt
q?: string
cwd?: string
hasTerminalOutput?: boolean
hasToolCalls?: boolean
hasCodeChanges?: boolean
hasErrors?: boolean
hasThinking?: boolean
sort?: updated_desc | updated_asc | created_desc | created_asc | messages_desc
limit?: number
cursor?: string
```

返回：

```ts
interface ThreadListResponse {
  data: CodexThread[]
  diagnostics: ParseDiagnostic[]
  nextCursor?: string | null
}
```

### 15.2 获取会话详情

```http
GET /api/threads/:threadId
```

返回：

```ts
interface ThreadDetailResponse {
  thread: CodexThread
  messages: CodexMessage[]
  diagnostics: ParseDiagnostic[]
}
```

### 15.3 删除会话

```http
DELETE /api/threads/:threadId
```

Body：

```ts
interface DeleteThreadRequest {
  confirmText: string
}
```

返回：

```ts
interface DeleteThreadResponse {
  success: boolean
  deletedFiles: string[]
  rewrittenFiles: string[]
}
```

### 15.4 获取恢复命令

```http
GET /api/threads/:threadId/resume-command
```

返回：

```ts
interface ResumeCommandResponse {
  canResume: boolean
  sessionId?: string
  cwd?: string
  posixCommand?: string
  powershellCommand?: string
  reason?: string
}
```

### 15.5 重新扫描

```http
POST /api/rescan
```

返回：

```ts
interface RescanResponse {
  success: boolean
  scannedFiles: number
  parsedLines: number
  failedLines: number
  threadCount: number
}
```

### 15.6 获取配置

```http
GET /api/config
```

返回：

```ts
interface ConfigResponse {
  codexHome: string
  exists: boolean
}
```

## 16. 索引与缓存

实现一个本地扫描服务：

```txt
src/lib/codex/history-store.ts
```

职责：

- 扫描 JSONL 文件
- 调用 parser
- 生成 thread index
- 生成 message index
- 支持搜索
- 支持删除后刷新

可以使用内存缓存，但必须支持手动刷新。

缓存要求：

- 首次打开页面自动扫描。
- 点击刷新按钮重新扫描。
- 删除会话后重新扫描。
- CODEX_HOME 修改后重新扫描。
- 不要把完整聊天记录写入浏览器 localStorage。

## 17. 安全与隐私

Codex 历史可能包含敏感信息。必须实现基本保护。

### 17.1 本地访问限制

默认只允许 localhost 请求。

如果请求 Host 不是以下之一，拒绝：

```txt
localhost
127.0.0.1
::1
```

除非环境变量明确允许：

```txt
ALLOW_REMOTE_ACCESS=1
```

### 17.2 敏感信息脱敏

默认对明显敏感内容做脱敏展示。

需要识别：

- OpenAI API Key
- GitHub token
- Bearer token
- AWS Access Key
- 私钥
- 数据库连接串
- `.env` 风格密钥

示例：

```txt
sk-********************************
ghp_********************************
Bearer ********************************
```

要求：

- UI 默认显示脱敏结果。
- 复制消息时默认复制脱敏结果。
- 设置里可以提供“显示原文”开关，但默认关闭。
- 不要在 console 打印原始敏感内容。

### 17.3 删除安全

删除是破坏性操作，因此：

- 必须二次确认。
- 必须校验路径。
- 必须拒绝删除 CODEX_HOME 外文件。
- 必须拒绝删除目录。
- 必须拒绝删除不确定归属的文件。
- 删除失败时不要继续执行后续删除。

## 18. 空状态与错误状态

### 18.1 没有找到 Codex Home

显示：

```txt
没有找到 Codex 历史目录。

请确认：
1. Codex 是否已经运行过；
2. CODEX_HOME 是否正确；
3. 默认路径 ~/.codex 是否存在。
```

提供按钮：

```txt
设置 Codex Home
```

### 18.2 没有聊天记录

显示：

```txt
没有找到 Codex 聊天记录。

你可以先运行一次 Codex CLI，然后点击刷新。
```

### 18.3 部分解析失败

显示轻量提示：

```txt
部分历史记录解析失败，已跳过异常记录。
```

点击可展开 diagnostics，但不要显示敏感原文。

### 18.4 删除失败

显示：

```txt
删除失败：<原因>
```

常见原因：

- 无法定位会话文件
- 文件不在 CODEX_HOME 内
- 文件不是 JSONL
- 权限不足
- 文件已不存在
- 该文件归属不确定，拒绝删除

### 18.5 恢复会话不可用

显示：

```txt
无法生成 codex resume 命令，因为没有识别到 sessionId。
```

## 19. 可复制内容

页面至少支持复制：

- 单条消息
- 代码块
- 终端输出
- diff
- 工具调用结果
- 整个会话 Markdown
- `codex resume` 命令

复制按钮要有明确 toast。

## 20. 会话导出

实现“复制整个会话 Markdown”功能。

导出格式示例：

~~~md
# <会话标题>

- Session ID: <sessionId>
- CWD: <cwd>
- Model: <model>
- Created: <createdAt>
- Updated: <updatedAt>

---

## User

<用户消息>

## Codex

<Codex 回复>

## Terminal

```txt
<终端输出>
```

## Thinking

Codex 已进行思考/分析，详细过程不展示。
~~~

导出时同样不要包含完整 thinking/reasoning 原文。

## 21. 测试要求

至少添加以下测试：

```txt
src/lib/codex/parser.test.ts
src/lib/codex/classify-message.test.ts
src/lib/codex/delete-thread.test.ts
src/lib/codex/resume-command.test.ts
```

测试场景：

1. 能解析普通用户消息。
2. 能解析 assistant Markdown。
3. 能识别 Markdown 表格。
4. 能识别代码块。
5. 能识别 diff。
6. 能识别 stdout/stderr 终端输出。
7. 能把 thinking/reasoning 转成占位提示。
8. JSONL 单行解析失败不会影响其他行。
9. 删除时拒绝 CODEX_HOME 外路径。
10. 删除时拒绝删除目录。
11. 删除独立 session JSONL 文件成功。
12. 共享 `history.jsonl` 只能原子重写，不能整个删除。
13. 有 sessionId 时能生成 `codex resume` 命令。
14. 没有 sessionId 时禁用恢复命令。

## 22. 推荐目录结构

```txt
codex-chat-history-viewer/
  package.json
  next.config.ts
  tsconfig.json
  tailwind.config.ts
  postcss.config.js
  src/
    app/
      page.tsx
      layout.tsx
      globals.css
      api/
        threads/
          route.ts
          [threadId]/
            route.ts
            resume-command/
              route.ts
        rescan/
          route.ts
        config/
          route.ts
    components/
      app-shell.tsx
      top-bar.tsx
      thread-list.tsx
      thread-card.tsx
      thread-detail.tsx
      message-timeline.tsx
      message-card.tsx
      markdown-renderer.tsx
      code-block.tsx
      diff-block.tsx
      terminal-block.tsx
      tool-call-block.tsx
      thinking-placeholder.tsx
      delete-thread-dialog.tsx
      resume-thread-dialog.tsx
      settings-dialog.tsx
      empty-state.tsx
      error-state.tsx
    lib/
      codex/
        config.ts
        scanner.ts
        parser.ts
        classify-message.ts
        history-store.ts
        delete-thread.ts
        resume-command.ts
        redact.ts
        types.ts
      utils/
        path.ts
        shell-escape.ts
        time.ts
        cn.ts
```

## 23. 实现顺序

请按以下顺序实现。

### Step 1：初始化项目

创建 Next.js + TypeScript + Tailwind 项目。  
安装所需依赖。  
实现基础页面和布局。

### Step 2：实现 Codex Home 检测

实现：

```ts
getCodexHome()
```

并在页面顶部显示当前 Codex Home 状态。

### Step 3：实现 JSONL 扫描

递归扫描 Codex Home 下 JSONL 文件。  
记录文件数量、行数、失败行数。

### Step 4：实现 parser

把原始 JSONL 转成 `CodexThread` 和 `CodexMessage`。

### Step 5：实现会话列表

展示会话卡片。  
支持排序、筛选、搜索。

### Step 6：实现会话详情

展示消息时间线。  
支持 Markdown、表格、代码块、diff、终端输出、工具调用折叠、thinking 占位提示。

### Step 7：实现恢复会话按钮

实现 `codex resume` 命令生成和复制弹窗。

### Step 8：实现直接删除会话

实现删除接口和删除确认弹窗。  
确保不是归档。  
确保路径安全。

### Step 9：实现脱敏

对敏感内容做默认脱敏。  
确保 console 不输出完整敏感内容。

### Step 10：实现测试

补充 parser、分类、删除、resume command 测试。

### Step 11：完善 README

README 至少说明：

- 如何安装
- 如何启动
- 如何配置 CODEX_HOME
- 删除是直接删除，不是归档
- 恢复会话是 `codex resume`
- 数据只在本地读取，不上传

## 24. 视觉验收标准

完成后页面应满足：

1. 不是纯文本日志页面。
2. 左侧会话列表清晰。
3. 右侧聊天详情清晰。
4. 用户消息、Codex 回复、工具调用、终端输出有明显区分。
5. Markdown 表格显示为真正表格。
6. 代码块有高亮和复制按钮。
7. 终端输出保留格式。
8. diff 有新增/删除视觉区分。
9. 工具调用默认折叠。
10. thinking 只显示一行提示。
11. 长内容不会撑爆页面。
12. 搜索结果可读。
13. 删除按钮危险但清晰。
14. 恢复会话按钮能生成正确命令。

## 25. 功能验收标准

### 25.1 基础功能

- 页面可以启动。
- 能自动发现 Codex Home。
- 能扫描 JSONL 历史文件。
- 能展示会话列表。
- 能点击查看会话详情。
- 能搜索会话和消息。
- 能刷新历史。
- 能复制消息内容。
- 能复制整个会话 Markdown。

### 25.2 展示功能

- Markdown 正常渲染。
- Markdown 表格正常渲染。
- 代码块正常高亮。
- diff 正常展示。
- 终端输出保留格式。
- ANSI 颜色可解析。
- 工具调用不是裸 JSON 堆叠。
- thinking/reasoning 不展示完整内容，只显示占位行。

### 25.3 删除功能

- 删除会话前有二次确认。
- 删除是直接删除，不是归档。
- 删除后会话从列表消失。
- 删除无法定位文件时按钮禁用。
- 删除 CODEX_HOME 外文件会被拒绝。
- 删除共享 `history.jsonl` 时不会删除整个文件。
- 删除失败有错误提示。

### 25.4 恢复会话功能

- 有 sessionId 的会话显示“恢复会话”按钮。
- 点击后显示 `codex resume <SESSION_ID>` 命令。
- 如果有 cwd，命令包含 cd 到 cwd 的逻辑。
- 支持复制 macOS/Linux 命令。
- 支持复制 Windows PowerShell 命令。
- 没有 sessionId 时按钮禁用，并说明原因。

### 25.5 安全功能

- 不上传聊天记录。
- 默认只允许 localhost 访问。
- 默认脱敏明显密钥。
- 不在 console 打印完整敏感内容。
- 不展示完整 thinking/reasoning 原文。

## 26. 文案规范

### 删除按钮

```txt
删除
```

### 恢复会话按钮

```txt
恢复会话
```

### 恢复会话弹窗标题

```txt
使用 Codex CLI 恢复会话
```

### 恢复会话说明

```txt
复制下面的命令到终端运行，即可继续这个 Codex 会话。
```

### 删除确认标题

```txt
永久删除 Codex 会话
```

### 删除确认说明

```txt
此操作会直接删除本地会话记录，不会归档，也不能在本工具中恢复。
```

### 思考占位文案

```txt
Codex 已进行思考/分析，详细过程不展示。
```

### 解析失败提示

```txt
部分历史记录解析失败，已跳过异常记录。
```

## 27. 重要边界

1. 不实现归档。
2. 不实现已删除列表。
3. 不实现删除后的恢复。
4. 不展示完整思考链路。
5. 不上传数据。
6. 不依赖云服务。
7. 不要求 app-server。
8. 不要在网页后台运行 interactive `codex resume`。
9. 恢复会话按钮只生成并复制命令。
10. 直接删除必须谨慎、安全、有确认。

## 28. 最终交付物

完成后交付：

1. 可运行的 Next.js 独立项目。
2. Codex 历史扫描能力。
3. 会话列表页面。
4. 会话详情页面。
5. 搜索与筛选。
6. Markdown / 表格 / 代码 / diff / 终端输出美化渲染。
7. thinking 占位提示。
8. 直接删除会话。
9. `codex resume` 恢复会话命令按钮。
10. 安全脱敏。
11. 测试。
12. README。

请开始实现。
