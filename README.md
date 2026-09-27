# nomad_的个人网站

网站：[nomadjing.github.io](https://nomadjing.github.io)

我是 Jing Wang，南京大学软件学院的研究生。这里记录我在静态分析、程序语言、算法和软件工程研究中的阅读、实验与想法。

**感谢codex的大力支持,本项目完全使用codex开发。**

## 网站内容

- [首页](https://nomadjing.github.io/)：简介、项目和精选笔记
- [笔记目录](https://nomadjing.github.io/notes/)：按目录浏览已发布笔记
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

## 发布

在有本地笔记仓库的电脑上运行 `npm run publish`。它会检查笔记目录和已发布笔记、执行类型检查与测试、构建网站，并将 `dist/` 推送到 `gh-pages`。首次发布时，需在 GitHub 仓库的 **Settings → Pages** 中选择从 `gh-pages` 分支的根目录部署。

发布前请检查 `publish: true` 的笔记内容及生成的 `dist/garden-index.json`；其中包含公开笔记文本。已发布内容也可能留在 Git 历史或外部存档中。
