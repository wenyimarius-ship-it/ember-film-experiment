# Cinema Experiment · What Would You Watch?

一个从当下情境出发的选片实验。答完三个问题，放映室给出一部电影和一句与选择对应的理由。可以确认、复制结果、换片或重新开始。

[进入放映室](https://cinema.mariustang.com/) · [返回 Ember Lab](https://lab.mariustang.com/)

## 推荐如何产生

三题各有三个选择，浏览器把答案和内置片库的情境标签匹配。匹配权重为 4、3、3。后续候选通过风格、地区与年代的轻量调整增加差异，换片只遍历得分为正的候选，耗尽后会提示。推荐理由来自片库里与答案匹配的条目。选片全程在浏览器内存中完成，刷新会回到开场。片库和理由为人工维护，推荐范围由片库决定。

## 运行和测试

原生 HTML、CSS、JavaScript modules，无运行时安装或构建步骤。使用 Python 3 在仓库根目录启动服务，然后访问 [localhost:8000](http://localhost:8000/)。

```sh
python3 -m http.server 8000
```

Node.js 仅用于测试。在根目录依次运行以下命令。

```sh
npm ci
npx playwright install chromium
npm test
npm run test:browser
npm run test:funnel:browser
```

测试覆盖推荐排序、换片和耗尽、返回修改、复制与统计行为。真人选片意愿和完成时间需要单独观测，见 [体验审阅记录](docs/first-visit-review.md)。

## 代码和统计配置

| 路径 | 职责 |
| --- | --- |
| [index.html](index.html) · [js/app.js](js/app.js) | 页面入口、题目流程与结果交互 |
| [js/questions.js](js/questions.js) · [js/films.js](js/films.js) | 情境选项、片库、标签与理由 |
| [js/engine.js](js/engine.js) | 校验、确定性排序与理由生成 |
| [js/analytics.js](js/analytics.js) · [js/analytics-config.js](js/analytics-config.js) | PostHog 手动事件及允许的正式 origin |

统计记录打开、开始与完成节点，以及成功的云端操作；现有漏斗发送器仅发送朋友圈来源（`utm_source=wechat_moments`）的节点事件。结果页新增“准 / 有点偏 / 不准”反馈，不影响推荐排序或任何主操作。`cinema_feedback` 的业务属性只有 `site`、`rating`（`accurate / partial / off`）、`film_id`（公开片库 ID，可对应片名）、`swap_count`（首推为 0）和 `traffic`；另带既有固定聚合标记及关闭用户画像、地理定位的设置。不发送题目答案、恢复码、IP、邮箱、完整页面 URL 或用户输入文本。

反馈仅在配置的正式 origin（自定义域名与默认域名）发送，不限制朋友圈来源；本地及未配置环境即使带 `analytics_test=1` 也不发送反馈。正式 origin 上 `analytics_test=1` 标记 `traffic=test`，其余为 `live`；测试标记在同一标签页会话中保留。同一会话按“影片 ID + 换片次数”仅尝试发送一次，换片后可再次反馈；失败不重试，界面只显示“谢谢你的反馈”，不声称已经入库。存储不可用时降级为页面内去重。推荐本身不依赖统计服务，详见[统计接入说明](docs/analytics-posthog.md)。

## 部署

Vercel 项目 `ember-film-experiment` 对应本仓库 `main`，Production 记录为 READY（`2c610c6`）。[vercel.json](vercel.json) 指定静态根目录作为输出，无安装或构建步骤，并通过 CSP 允许 PostHog 采集端点。项目无需服务器端环境变量。当前核对的是平台记录与源码配置，实际统计入库与用户体验需要单独验收。

## 云端副本

新增主动保存与恢复入口，默认仍在本地使用。恢复码支持换设备取回、更新、删除云端副本；正文进入 Supabase，PostHog 只记录行为。详见 [接入与权限说明](docs/cloud-persistence.md)。
