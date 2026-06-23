# Fluvient — Product Requirements Document

## 1. Product Overview

Fluvient 是一个面向中文母语用户的英语学习 web app。用户粘贴 YouTube 链接，即可在观看视频的同时看到同步字幕面板，字幕中高亮显示超出用户英语水平的词汇。用户可以点击单词查看释义、保存词汇，并获得 AI 自动生成的学习笔记。

**核心价值**：把 YouTube 的海量英语内容变成结构化的语言学习材料，降低学习摩擦。

---

## 2. Target Users

- **主要用户**：中文母语、有一定英语基础、希望通过真实内容提升英语水平的学习者
- **MVP 范围**：英语视频，中文界面/释义，不考虑变现

---

## 3. Goals & Non-Goals

### Goals (v1)

- 输入 YouTube URL → 视频 + 同步字幕 + AI 学习笔记
- 字幕高亮超出用户 CEFR 级别的词汇
- 点击单词查看定义，保存到个人笔记
- AI 自动生成每个视频的 Key Vocabulary + Key Expressions（含例句和中文翻译）
- 用户账号（懒加载登录，仅在保存内容时触发）
- My Notes 模块：按视频分类的笔记 + 全局词汇列表

### Non-Goals (v1)

- Bilibili 支持
- 闪卡复习系统
- AI Chat 功能（UI 预留，v2 实现）
- 变现/付费功能
- 非英语视频支持
- 微信登录

---

## 4. Core User Flow

```
Landing Page
  └── 输入 YouTube URL → 回车
        └── Video Page
              ├── 左 2/3：YouTube 播放器 + 同步字幕面板
              │     ├── 字幕高亮难词（基于 CEFR + 用户级别）
              │     ├── 点击单词 → Definition Popup → Save to My Notes
              │     └── 选中句子 → Explain（进入 AI Chat）/ Take Notes（保存句子）
              └── 右 1/3：Notes 面板
                    ├── AI Study Notes（Key Vocab + Key Expressions）
                    └── My Saved Items（用户保存的词/短语/句子）
```

---

## 5. Features

### 5.1 Landing Page

- 居中搜索框（shadcn/ui Input 组件）
- 支持粘贴 YouTube URL，回车进入视频页
- 未登录用户可直接使用，仅在保存内容时提示登录

### 5.2 Video Page

**布局**：左 2/3 / 右 1/3，固定比例

**左侧面板**

- YouTube IFrame 播放器（顶部）
- 同步字幕面板（下方，可滚动）
  - 当前播放句自动高亮 + 自动滚动
  - 点击句子 → 视频跳转到对应时间戳
  - 超出用户 CEFR 级别的词汇以视觉方式高亮（stone/emerald 色）
  - 单词交互：点击 → Definition Popup（词 + 中文释义 + 例句）→ Save to My Notes 按钮
  - 句子交互：选中文本 → 浮现 Explain / Take Notes 两个按钮

**右侧面板（Notes）**

- AI Study Notes（自动生成，按视频 ID + 用户级别缓存）
  - Key Vocabulary：词 + 词性 + 中文释义 + 例句 + 例句中文翻译
  - Key Expressions：短语 + 中文释义 + 原视频例句 + 例句中文翻译
- My Saved Items（用户手动保存）
  - 单词、短语、整句，各附时间戳（点击跳回视频）
- Chat 入口（UI 预留，v2 功能）

**视频限制**：最长 90 分钟；仅支持有公开字幕的英语视频

### 5.3 词汇高亮系统

- 使用静态 CEFR 词表（Oxford 5000 或同级）
- 用户选择 CEFR 级别（A1 / A2 / B1 / B2 / C1）
- 高亮该级别以上的词汇，不动态调用 AI

### 5.4 Auth（懒加载）

- 触发时机：保存单词 / 笔记 / 完成视频时
- 方式：Google OAuth（主）+ Email Magic Link（次）
- 服务：Supabase Auth
- 不在进入页面时强制登录

### 5.5 My Notes 模块（Avatar 下拉菜单）

**By Video（默认）**

- 每个视频一张卡片：缩略图 + 标题 + 学习日期 + 已保存词数
- 点击 → 进入该视频的笔记详情页
  - AI Study Notes + My Saved Items 合并展示

**All Vocabulary**

- 所有视频词汇的扁平列表
- 每条：词 + 中文释义 + 例句 + 来源视频 + 时间戳
- 支持按日期 / 字母 / 难度排序 + 搜索

**All Study Notes**

- 每个视频一条，展示 AI 生成的完整 study notes
- 列表形式，最近学习的在前

### 5.6 Avatar 下拉菜单

- Videos：最近学习的视频列表（含缩略图）
- Notes：进入 My Notes 模块
- Settings：用户 CEFR 级别设置
- Sign Out

---

## 6. Technical Architecture

### Stack


| 层               | 技术                                                 |
| --------------- | -------------------------------------------------- |
| Framework       | Next.js（项目已存在）                                     |
| Styling         | Tailwind CSS                                       |
| UI Components   | shadcn/ui                                          |
| Database + Auth | Supabase（500MB 免费，50K MAU）                         |
| 字幕获取            | youtube-transcript npm                             |
| 视频播放            | YouTube IFrame Player API                          |
| AI 生成           | Gemini 2.0 Flash（免费 1500 req/day）via Vercel AI SDK |
| AI 备用           | DeepSeek V3 via OpenRouter                         |
| 词汇高亮            | 静态 CEFR 词表                                         |


### AI 成本控制

- 按 `video_id + user_level` 缓存 AI 生成的 Study Notes
- 同一视频+级别只生成一次，后续用户复用缓存
- Gemini 2.0 Flash 免费额度：1500 req/day，MVP 阶段足够
- 单视频 AI 成本：约 $0.005–$0.01（20 分钟视频）

### 字幕同步

```typescript
// youtube-transcript 返回格式
[{ text: "Hello everyone", offset: 1200, duration: 2400 }, ...]

// 用 YouTube IFrame Player API 轮询
setInterval(() => {
  const currentTime = player.getCurrentTime() * 1000 // ms
  // 找到当前时间对应的字幕句
}, 200)
```

---

## 7. Design & Visual

- **色调**：Tailwind stone 系列为主（stone-50 背景，stone-800 文字）
- **强调色**：emerald-600，仅用于核心 CTA（保存按钮、主操作）
- **风格**：极简，无多余装饰
- **字体**：系统字体栈
- **移动端**：响应式，具体布局开发时决定

---

## 8. Data Model（草稿）

```
users
  id, email, cefr_level, created_at

videos
  id, youtube_id, title, thumbnail_url, duration, language, created_at

user_videos (学习记录)
  id, user_id, video_id, last_watched_at

study_notes (AI 生成，按 video + level 缓存)
  id, video_id, cefr_level, content_json, created_at

saved_items (用户保存的词/句)
  id, user_id, video_id, type (word/phrase/sentence), content, definition, timestamp_ms, created_at
```

---

## 9. Out of Scope (Future Versions)


| 功能                | 版本  |
| ----------------- | --- |
| AI Chat（问视频内容）    | v2  |
| 闪卡复习              | v2  |
| Bilibili 支持       | v2  |
| 用户自带 API Key      | v2  |
| 推荐视频 Landing Page | v2  |
| 移动端 App           | v3  |


