# Particle Veil — iPhone 粒子面具 AR

一个使用 p5.js 与 MediaPipe Face Landmarker 制作的浏览器 AR 实验。朋友用 iPhone Safari 打开 HTTPS 链接、允许前置摄像头后，即可看到贴合脸部的动态粒子面具。

分享链接已包含专属的 `1200 × 630` 粒子面具预览图。

在线体验：<https://lanzy1029.github.io/arProcessing/>

## 体验方式

1. 用 iPhone Safari 打开项目的 GitHub Pages 链接。
2. 点击“开始 AR”。
3. 允许 Safari 使用摄像头。
4. 将脸移入画面：张嘴会增强嘴部粒子喷发，眨眼会触发眼周脉冲。

不需要安装 App，不需要账号。摄像头画面只在当前设备中参与实时计算，不会录制或上传。

## 本地运行

需要 Node.js 24 或更高版本。

```bash
npm install
npm run dev
```

电脑浏览器可打开终端显示的本地地址。摄像头在非 `localhost` 环境中要求 HTTPS，因此 iPhone 真机请优先使用 GitHub Pages 链接。

可用地址参数：

- `?debug=1`：显示特征点、帧率、识别耗时和表情数据。
- `?demo=1&debug=1`：不调用摄像头，使用模拟人脸数据检查粒子动画。
- `?demo=empty&debug=1`：不调用摄像头，检查未检测到人脸时的引导状态。

## 检查与构建

```bash
npm test
npm run build
npm run preview
```

构建检查会确认生产包包含人脸模型和 MediaPipe WASM 文件，避免部署后才发现资源缺失。

## 免费发布到 GitHub Pages

仓库已包含 `.github/workflows/pages.yml`。创建公开 GitHub 仓库后：

1. 将默认分支命名为 `main` 并推送代码。
2. 在 GitHub 仓库的 **Settings → Pages** 中，将 Source 设为 **GitHub Actions**。
3. 等待 `Deploy to GitHub Pages` 工作流完成。
4. 分享 `https://lanzy1029.github.io/arProcessing/`。

后续每次推送到 `main` 都会先运行测试和构建，再自动更新网页。

## iPhone 建议

- 优先使用 iPhone 12 或更新机型以及较新的 iOS Safari。
- 首次打开需要下载约数 MB 的本地视觉模型，请保持网络连接。
- 如果拒绝过权限，在 Safari 地址栏的网站设置中重新允许“摄像头”。
- 若相机被其他 App 占用，关闭相机或视频会议 App 后重试。
- 页面会优先使用 GPU；不可用时自动退回 CPU，并限制识别频率和粒子数量。

## 隐私与技术边界

- 没有后端、数据库、登录、广告或分析代码。
- 摄像头视频不会通过网络发送。
- 模型推理发生在浏览器本地。
- 这是基于摄像头的人脸 AR，不依赖 iPhone Safari 尚未正式支持的 WebXR `immersive-ar`。

## 技术栈

- p5.js `2.3.1`
- MediaPipe Tasks Vision `0.10.35`
- Vite `8.1.0`
- GitHub Pages / GitHub Actions

## License

项目代码使用 MIT License。第三方依赖及人脸模型保留各自原始许可证，详见 `THIRD_PARTY_NOTICES.md`。
