# 参考资料与许可证说明

本项目规则内核与界面为独立编写（TypeScript），未直接复制下列项目的代码；仅参考其规则表述、交互思路与数学依据。查阅时间 2026-10-02/03，实际复用时应记录 commit。

## 参考项目

- 3dgo（2017，OGS 论坛原帖）：任意拓扑下围棋的早期 web 应用，含环面与克莱因瓶；未确认仍有可用部署与源码仓库。
  https://forums.online-go.com/t/3dgo-new-web-app-for-playing-go-on-any-topology/15007
- goplayerjuggler/goVariants（MIT）：ECMAScript 的普通/环面棋盘落子、气、提子与计分；README 明示 ko/superko 未实现——故本项目独立实现 PSK。
  https://github.com/goplayerjuggler/goVariants
- govariantsteam/govariants（AGPL-3.0）：规则与棋盘显示分离的插件化结构参考；本项目不照搬其服务端。
  https://github.com/govariantsteam/govariants
- bernds/q5Go（GPL-2.0）：环面展开视图、周边重复区域与拖动交互参考；本项目独立实现幽灵副本。
  https://github.com/bernds/q5Go
- lightvector/goscorer（MIT）：面积计分与死子标记流程参考；本项目按拓扑图独立实现 flood fill 计分。
  https://github.com/lightvector/goscorer

## 规则与数学依据

- John Tromp, The Logical Rules（Tromp–Taylor 规则的提子、重复局面与面积定义；本项目改为禁自杀并加入终局协商）。
  https://tromp.github.io/go.html
- Open University, Surfaces §3.3（基本方形对边识别得到各曲面的数学依据）。
  https://www.open.edu/openlearn/science-maths-technology/mathematics-statistics/surfaces/content-section-3.3
- Mikael Vejdemo-Johansson, 3d-printing Identification Spaces of the Square, arXiv:1909.05893（基本多边形粘合说明）。
  https://arxiv.org/abs/1909.05893

## 技术与未来增强参考

- KataGo 官方架构文档（说明普通权重包含棋盘位置与 off-board 处理，不能直接用于本环境）。
  https://github.com/lightvector/KataGo/blob/master/docs/NetworkArchitectures.md
- MDN, Using Web Workers（分析后台计算）。
  https://developer.mozilla.org/en-US/docs/Web/API/Web_Worker_API/Using_web_workers
- Vite / Vitest / Playwright 官方文档。
  https://vite.dev/guide/  https://vitest.dev/guide/  https://playwright.dev/docs/intro

## 本项目许可证

代码以 MIT 许可证发布（见 LICENSE，如缺失则由作者补齐）。
第三方依赖的许可证见各自包声明；本文件记录参考关系，不构成法律意见。
