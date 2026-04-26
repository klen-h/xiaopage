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

## 手动更新（回退方案）

如果自动化脚本失败，你仍然可以手动更新：
1.  打开 `src/data/videos.json`。
2.  将你生成的 JSON 数据添加到数组末尾。
3.  重新运行 `npm run build` 和 `npm run deploy` 部署。
