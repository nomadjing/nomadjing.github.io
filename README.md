# nomad_的个人网站

网站：[nomadjing.github.io](https://nomadjing.github.io)

我是 Jing Wang，南京大学软件学院的研究生。这里记录我在静态分析、程序语言、算法和软件工程研究中的阅读、实验与想法。

## 网站内容

- [首页](https://nomadjing.github.io/)：简介、项目和精选笔记
- [笔记目录](https://nomadjing.github.io/notes/)：按目录浏览已发布笔记
- [标签](https://nomadjing.github.io/tags/)：按主题浏览
- [关于](https://nomadjing.github.io/about/)：更多个人信息

网站使用 TypeScript 构建静态页面，发布到 GitHub Pages 的 `gh-pages` 分支。源码位于 `main` 分支；

**感谢codex的大力支持,本项目没有使用现成的博客框架。**

## 本地查看

需要 Node.js 22。克隆仓库后运行：

```sh
npm ci
npm run dev
```

打开 <http://127.0.0.1:4173>。`dev` 会先执行一次构建并提供本地服务；修改源码或笔记后，重新运行命令才能看到新内容。如果只想生成静态文件，运行 `npm run build`，结果在 `dist/`。

默认从相邻的 `../Nomad` 读取笔记(只是个人为了方便而设置的,不具有通用性)；如果该目录没有可发布笔记，构建会尝试使用仓库内的 `content/`。也可用 `CONTENT_ROOT=/你的/笔记目录 npm run dev` 指定来源。要发布某篇笔记，在 YAML frontmatter 中设置 `publish: true`。

## 发布

在有本地笔记仓库的电脑上运行 `npm run publish`。它会检查笔记目录和已发布笔记、执行类型检查与测试、构建网站，并将 `dist/` 推送到 `gh-pages`。首次发布时，需在 GitHub 仓库的 **Settings → Pages** 中选择从 `gh-pages` 分支的根目录部署。

发布前请检查 `publish: true` 的笔记内容及生成的 `dist/garden-index.json`；其中包含公开笔记文本。已发布内容也可能留在 Git 历史或外部存档中。
