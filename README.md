# Emoji Face AR — iPhone 表情派对

一个使用 p5.js 与 MediaPipe Face Landmarker 制作的浏览器 Emoji AR 实验。朋友用 iPhone Safari 打开 HTTPS 链接并允许前置摄像头后，即可用眨眼和张嘴发射 Emoji。

在线体验：<https://lanzy1029.github.io/arProcessing/>

## v2.0.0

v2 将体验改成了更接近 iOS 相机的直接入口：

- 页面打开后立即准备前置摄像头和本地人脸模型，不再显示宣传式 Landing Page。
- 摄像头或模型尚未准备好时，使用毛玻璃状态层遮挡画面。
- 删除“转头”提示，明显展示“眨眨眼”和“张大嘴巴”两种动作。
- 粒子改为原生 Emoji：默认眨眼发射 `💗 ❤️ 💕`，张嘴喷出 `💩`。
- 眨眼可切换爱心、闪耀、派对；张嘴可切换搞怪、彩虹、火焰。
- 选择保存在当前浏览器中，不需要账号，也不会上传。
- UI 改为浅色、圆角、毛玻璃和系统字体组成的 iOS 风格。

## 体验方式

1. 用 iPhone Safari 打开 GitHub Pages 链接。
2. 首次访问时允许 Safari 使用摄像头。
3. 将脸放入画面，眨眼或张大嘴巴触发 Emoji。
4. 在底部面板中选择喜欢的眨眼和张嘴效果。

Safari 若要求用户操作或之前拒绝过权限，页面会显示“再试一次”。不需要安装 App，不需要账号。

## 本地运行

需要 Node.js 24 或更高版本。

```bash
npm install
npm run dev
```

电脑浏览器可打开终端显示的本地地址。摄像头在非 `localhost` 环境中要求 HTTPS，因此 iPhone 真机请优先使用 GitHub Pages 链接。

可用地址参数：

- `?debug=1`：显示特征点、帧率、识别耗时和表情数据。
- `?demo=1&debug=1`：不调用摄像头，使用模拟人脸数据自动运行 Emoji 动画。
- `?demo=empty&debug=1`：不调用摄像头，检查未检测到人脸的引导状态。

## 检查与构建

```bash
npm test
npm run build
npm run preview
```

测试覆盖前摄镜像、横竖屏裁切、平滑算法、张嘴/眨眼阈值与冷却，以及 Emoji 预设回退。构建检查会确认生产包包含人脸模型和 MediaPipe WASM 文件。

## 免费发布到 GitHub Pages

仓库中的 `.github/workflows/pages.yml` 会在每次更新 `main` 后自动执行测试、构建并发布到 GitHub Pages。

## iPhone 建议

- 优先使用 iPhone 12 或更新机型以及较新的 iOS Safari。
- 首次打开需要下载本地视觉模型，请保持网络连接。
- 如果拒绝过权限，在 Safari 地址栏的网站设置中重新允许“摄像头”。
- 若相机被其他 App 占用，关闭相机或视频会议 App 后重试。
- 页面会优先使用 GPU；不可用时自动退回 CPU，并限制识别频率和 Emoji 数量。

## 隐私与技术边界

- 没有后端、数据库、登录、广告或分析代码。
- 摄像头视频不会通过网络发送。
- 模型推理发生在浏览器本地。
- Emoji 选项只保存在当前浏览器的 `localStorage` 中。
- 这是基于摄像头的人脸 AR，不依赖 iPhone Safari 尚未正式支持的 WebXR `immersive-ar`。

## 技术栈

- p5.js `2.3.1`
- MediaPipe Tasks Vision `0.10.35`
- Vite `8.1.0`
- GitHub Pages / GitHub Actions

## License

项目代码使用 MIT License。第三方依赖及人脸模型保留各自原始许可证，详见 `THIRD_PARTY_NOTICES.md`。
