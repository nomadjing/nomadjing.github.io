# nomad_的个人网站

网站：[nomadjing.github.io](https://nomadjing.github.io)

我是 Jing Wang，南京大学软件学院的研究生。这里记录我在静态分析、程序语言、算法和软件工程研究中的阅读、实验与想法。

**感谢codex的大力支持,本项目完全使用codex开发。**

## 网站内容

- [首页](https://nomadjing.github.io/)：简介、项目和精选笔记
- [笔记](https://nomadjing.github.io/notes/)：按目录浏览
- [标签](https://nomadjing.github.io/tags/)：按主题浏览
- [关于](https://nomadjing.github.io/about/)：更多个人信息

网站使用 TypeScript 构建静态页面，发布到 GitHub Pages 的 `gh-pages` 分支。源码位于 `main` 分支；

## 使用方法

在本项目中新建文件夹 `content/`，存放笔记.或者,在site.config.json中设置CONTENT_ROOT为你笔记的目录,就可以直接使用你已有的笔记仓库了。

注意笔记的格式需要为 Markdown，且每篇笔记的开头需要有 YAML frontmatter，只有设置了 `publish: true` 的笔记才会被发布。示例：

```markdown
---
title: "笔记标题"
date: 2024-06-01
tags: ["标签1", "标签2"]
publish: true
---
笔记内容...
```

## 本地浏览

需要 Node.js 22。克隆仓库后运行：

```sh
npm ci
npm run dev
```

打开 <http://127.0.0.1:4173>。`dev` 会先执行一次构建并提供本地服务；修改源码或笔记后，重新运行命令才能看到新内容。

如果只想生成静态文件，运行 `npm run build`，结果在 `dist/`。

## 导航与终端

- 顶部导航提供 Notes、Tags、About 和主题、终端按钮；Notes 按目录浏览，Tags 按主题浏览。
- 面包屑显示 `nomad_ / Notes / 实际目录 / 笔记`，文章 URL 保持原样。
- 文件树中点击目录名进入目录，点击左侧三角展开或折叠。
- 顶部路径左侧的 `‹`：按导航层级返回。文章 → 所在目录 → Notes → 首页；单个标签 → Tags 视图 → 首页。首页不显示返回按钮。
- `Alt + ↑`：同样返回上一级；输入框或可编辑区域内不触发。
- 按反引号键（`` ` ``）打开终端；点击 `>_` 切换开关，`Esc` 或 `exit` 关闭。
- 终端输入 `up`：返回当前页面的上一级，首页提示已在根目录。
- `cd ..`：返回终端当前目录的父目录。笔记页的终端从笔记所在目录开始，因此与 `up` 的起点不同。
- 终端采用统一站点树：`/` 是主页，`/notes` 是笔记入口，`/tags` 是标签入口，`/about` 是关于页。`pwd`、`ls`、`cd`、`tree`、`open` 都使用这套路径。
- 笔记在终端中位于 `/notes/实际目录/笔记`；终端路径与面包屑一致，已有文章 URL 保持不变。
- `home`、`cd /`、`open /` 都返回主页；`notes`、`cd /notes`、`open /notes` 都打开笔记入口。`tags`、`about` 同样对应各自的路径。
- 通过终端导航后，终端保持打开并恢复命令历史、输出；Esc、关闭按钮或 `exit` 主动关闭时清空会话。
- `/tags/某标签` 是笔记链接视图：`ls`、`tree` 显示 `笔记名 -> /notes/实际路径`，`open 笔记名` 跟随链接打开原文；同名笔记可用完整目标路径区分。标签视图不复制笔记。
- 输入 `help` 查看命令，`Tab` 补全命令，`↑` / `↓` 浏览命令历史。
- 阅读笔记时顶部导航固定显示；进度条可点击或拖动定位，支持鼠标和触屏。进度条聚焦后可用方向键、Page Up / Down、Home / End 调整阅读位置。

## 发布

在有本地笔记仓库的电脑上运行 `npm run publish`。它会检查笔记目录和已发布笔记、执行类型检查与测试、构建网站，并将 `dist/` 推送到 `gh-pages`。首次发布时，需在 GitHub 仓库的 **Settings → Pages** 中选择从 `gh-pages` 分支的根目录部署。

发布前请检查 `publish: true` 的笔记内容及生成的 `dist/garden-index.json`；其中包含公开笔记文本。已发布内容也可能留在 Git 历史或外部存档中。
