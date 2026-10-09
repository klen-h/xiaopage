# AI 视频解析平台 - 自动化数据更新指南

本平台支持通过自动化脚本快速从 Bilibili 视频中提取分析数据。

## 准备工作

1.  **安装必要工具**：
    -   安装 [yt-dlp](https://github.com/yt-dlp/yt-dlp) 用于视频下载。
    -   确保本地有 Node.js 环境。

2.  **配置 API 密钥**：
    -   复制 `.env.example` 为 `.env`。
    -   填入你的 `OPENAI_API_KEY`（用于 Whisper 语音转文字和 LLM 分析）。

3.  **安装依赖**：
    ```bash
    npm install
    ```

## 自动化运行步骤

运行以下命令，替换 `<B站视频链接>` 为你想分析的视频：

```bash
node scripts/analyze-video.js "https://www.bilibili.com/video/BV1xxxxxx"
```

### 脚本工作流程：
1.  **下载音频**：自动提取视频中的音频流。
2.  **语音转文字**：调用 OpenAI Whisper 将音频转录为文本。
3.  **AI 深度分析**：将转录文本发送给 LLM（如 GPT-4o），按照 `AnalysisItem` 格式自动生成标题、总结、核心观点、策略博弈等 JSON 数据。
4.  **自动更新**：分析结果将自动追加到 `src/data/videos.json`，刷新页面即可看到新内容。

## 多 UP 主支持

`scripts/analyze-video.js --check-new` 会依次处理 `TARGETS` 里的所有 UP 主：

| UP 主 | UID | 处理方式 |
| --- | --- | --- |
| 李大霄 | `BILI_UID`（默认 2137589551） | 生成结构化 JSON，写入 `public/data/videos.json`，推送站内分析页链接 |
| 额外 UP 主 | `EXTRA_UPS`（默认 `1039025435,584685158,520819684,290548469`，即 战国时代_姜汁汽水 / 正解局 / 小Lin说 / 冲浪普拉斯） | 只做文字解读，直接推送企微，不入库 |

可用 `node scripts/analyze-video.js --list-targets` 查看当前生效的 UP 主清单。

备用 UID（想加时把 UID 追加到 `EXTRA_UPS` 即可，脚本里已配好显示名）：

| UP 主 | UID |
| --- | --- |
| 烈火眼镜（盘面、基金从业资质，高频） | `485083371` |
| 银行螺丝钉（指数估值/定投） | `20763555` |
| 温义飞今天插旗了吗（财经评论，高频） | `508709785` |
| 史诗级韭菜（经济分析/投资框架，高频） | `322005137` |

相关环境变量：

| 变量 | 说明 |
| --- | --- |
| `EXTRA_UPS` | 额外 UP 主 UID，逗号分隔；留空用默认值，设为 `-` 之类无效值可清空 |
| `EXTRA_UP_MAX_DURATION` | 额外 UP 主视频时长上限（秒），默认 7200（120 分钟） |
| `EXTRA_UP_MAX_PER_RUN` | 每次运行最多处理几个额外 UP 主视频，默认 1（定时器每 30 分钟一次，足够及时） |
| `EXTRA_WECHAT_WEBHOOK` | 可选，额外 UP 主推送到另一个企微群；不配则与李大霄同一个群 |
| `TRANSCRIPT_MAX_CHARS` | 单条转录送给 LLM 的字符上限，默认 80000，超长按头 60% + 尾 40% 截取 |
| `WHISPER_MODEL` | 可选，faster-whisper 模型大小（base/small/medium），默认 base；换模型后记得同步更新 workflow 里的 `whisper-model-base-` 缓存 key |

说明：

- 额外 UP 主的已处理记录写在 `public/data/up_<uid>_state.json`，只保留最近 100 条，避免重复推送。
- 文字解读固定结构和 700 字长度上限，超过企微 4096 字节限制会自动按字节截断并提示「内容过长已截断」。
- 长视频会走 faster-whisper 语音转录（耗时约为视频时长的 0.3~0.7 倍），因此 workflow 超时放宽到 120 分钟，并加了 `concurrency` 串行锁：定时器每 30 分钟触发一次时，同时只会有一个任务在跑，避免重复推送。

本地调试（跳过下载和转录，直接用现成文本测解读）：

```bash
# 只打印解读结果
node scripts/analyze-video.js --text-from-file temp/transcript.txt
# 顺便推送企微（后面跟 BV 号用于生成原视频链接）
node scripts/analyze-video.js --text-from-file temp/transcript.txt --push BV1xxxxxxxx
```

## LLM 配置与故障排查

统一由 `scripts/utils/llm.js` 负责调用（OpenAI 兼容接口），相关环境变量：

| 变量 | 说明 |
| --- | --- |
| `LLM_API_KEY` | 必填 |
| `LLM_BASE_URL` | 选填，默认 `https://token.sensenova.cn/v1`，不要带 `/chat/completions` |
| `LLM_MODEL` | 选填，默认 `deepseek-v4-flash` |
| `LLM_FALLBACK_MODELS` | 选填，逗号分隔的显式备选模型 |
| `LLM_AUTO_FALLBACK` | 设为 `0` 可关闭「模型失效自动切换」 |
| `LLM_NO_JSON_FORMAT` | 设为 `1` 时不发送 `response_format`（部分模型不支持） |

诊断命令（会列出当前厂商可用模型、并做一次真实请求）：

```bash
npm run check-llm
```

常见错误：

- **HTTP 412 `Precondition Failed`（yt-dlp 取流被 B站风控拦截）**：日志里会出现 `⚠️ yt-dlp 下载音频失败` + `↪️ 改用 B站官方接口下载`，脚本会自动走 `api.bilibili.com/x/player/playurl` 直链下载（同样用 `BILI_COOKIE`）作为兜底，无需人工处理。若两级都失败，通常是 `BILI_COOKIE` 过期，重新导出 Cookie 更新 Secret 即可。

- **HTTP 404 `model is not found`**：中转站模型已下线/改名。跑 `npm run check-llm`，把 `LLM_MODEL` 改成列表中的名字即可；脚本本身也会自动切换到可用模型继续跑。
- **HTTP 401 / 403**：`LLM_API_KEY` 过期或余额不足，不会重试，直接报错。
- **HTTP 429**：脚本按 30s / 60s / 90s 退避自动重试。

## 手动更新（回退方案）

如果自动化脚本失败，你仍然可以手动更新：
1.  打开 `src/data/videos.json`。
2.  将你生成的 JSON 数据添加到数组末尾。
3.  重新运行 `npm run build` 和 `npm run deploy` 部署。
