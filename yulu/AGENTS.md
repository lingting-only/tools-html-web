# AGENTS.md

## 项目概览
毛主席语录每日一思 - 移动端网页应用，每日随机抽取一条经典语录及当代解读。

## 技术栈
- 原生 HTML/CSS/JavaScript（无框架依赖）
- Python http.server 作为静态文件服务器
- localStorage 进行数据持久化

## 文件结构
- `index.html` - 唯一页面，包含所有 HTML、CSS、JS 代码
- `styles/` - 样式目录（当前未使用，样式内联在 index.html 中）
- `.coze` - 项目配置文件

## 核心功能
1. **50条语录库** - 含原文和当代解读，存储在 JS 数组 `QUOTES` 中
2. **每日抽卡** - 基于本地日期，每天可多次抽取（重抽会覆盖当日记录）
3. **localStorage 持久化** - `mao_quotes_today`（今日记录）、`mao_quotes_history`（历史记录）
4. **记录本页面** - 时间轴风格展示历史抽卡记录
5. **3D翻转动画** - CSS transform + perspective 实现卡片翻转效果
6. **粒子背景** - Canvas 绘制红/金色粒子漂浮效果，页面隐藏时暂停以节省性能

## 设计规范
- 详见 `DESIGN.md`
- 主色：中国红 #C41A1A、旧纸米黄 #F4EBD9、描金 #D4A24C
- 字体：楷体（语录）、思源宋体（解读）、思源黑体（标题）

## 注意事项
- 语录解读中的引号使用 `「」` 而非 `""`，避免与 JS 字符串定界符冲突
- 移动端适配：viewport meta + 响应式 CSS
- 字体使用 Google Fonts CN 域名（fonts.googleapis.cn）
