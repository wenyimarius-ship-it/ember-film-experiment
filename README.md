# Cinema Experiment

**What Would You Watch?** — Ember Lab 的私人放映室电影发现实验。

开场 → 三个情境（每次一题，点选自动前进）→ 一部电影与一句有依据的理由 → 就看这部或换一部。不是人格测评；不使用 AI、评分、登录、数据库或 API。所有选择只保存在当前页面内存中，刷新后清空。无分析脚本、远程字体、海报或第三方运行时请求。

## 本地运行

这是原生 HTML / CSS / JavaScript 静态站点，无需安装依赖或构建：

```sh
cd ember-film-experiment
python3 -m http.server 8000
```

在浏览器打开本地服务。请通过 HTTP 访问；ES modules 不支持直接双击 `index.html` 的 `file://` 方式。支持现代 Chrome、Safari、Firefox 和 Edge。

## 操作

- 点击选项立即显示反馈，短暂反馈后自动进入下一题；重复点击不会跳过下一题。
- A/B/C 或 1/2/3 直接选择并继续；左右方向键仅移动焦点，Enter / Space 激活选项。
- Tab / Shift+Tab 移动焦点，Space / Enter 激活按钮；Escape 返回上一题或开场。
- “上一题”和结果页的选择摘要可修改答案，其他答案会保留。
- “重新体验”清空全部选择，回到开场。
- “就看这部”显示“今晚就看这部。”，随后可复制片名与理由；剪贴板失败时提供提示与手动复制文本框。
- “换一部”保留答案，依序展示有匹配依据且未展示过的候选。候选耗尽时停止并提示修改选择，不循环。
- 支持 `prefers-reduced-motion`，手机端紧凑单片结果。
- 固定返回入口：[Ember Lab](https://lab.mariustang.com/)。本项目不修改该站点。

## 文件

```text
index.html          页面骨架、站点导航
styles.css          响应式排版、原创抽象电影卡片、减少动态效果
js/questions.js     三个情境和选项
js/films.js         16 部真实电影及本地编辑标签
js/engine.js        纯函数推荐与理由匹配
js/app.js           页面状态、交互、键盘与剪贴板
favicon.svg         原创站点图标
vercel.json         静态部署与安全响应头
tests/             推荐算法及 Chromium 端到端测试
```

## 推荐规则

三个维度分别为“面对失败的行动”“叙事推进”“期待的结局”，每部影片各维度有一个编辑标签。与答案精确相等时，分别加 **4 / 3 / 3** 分，否则不加分。分数仅用于内部匹配，不是电影评分或概率。

保留原 `recommend()` 的三部排序接口；新 `candidates()` 以同一算法继续排序全部影片，筛除零匹配候选。页面首轮仅展示第一部，“换一部”依次取后续候选。每轮对已经选中过的相同风格、地区、年代，各减 0.3 分，最多减 0.9 分。因此多样性只调整同分候选，永远不会越过整分的匹配优势。年代按十年分组。相同调整分按原始匹配分、固定英文 ID 排序，不使用随机数、时间或浏览历史；相同输入得到相同结果。

理由只显示影片标签与实际答案相同的维度，附上对应选项和具体情节层面的解释。未命中的维度不会被描述为命中；折叠的补充依据中标注回应了几个选择；首轮一句话引用最高权重的实际命中偏好及原有影片依据。27 种答案组合均验证能返回三部不同影片，每部至少命中一个维度。

### 电影资料与编辑约定

本地数据包含 Whiplash (2014)、The Social Network (2010)、Kill Bill: Vol. 1 (2003)、Manchester by the Sea (2016)、La La Land (2016)、Interstellar (2014)、Arrival (2016)、The Prestige (2006)、The Truman Show (1998)、The Grand Budapest Hotel (2014)、Little Women (2019)、Everything Everywhere All at Once (2022)、Parasite (2019)、Spirited Away (2001)、In the Mood for Love (2000)、Oldboy (2003)。

片名和年份指上述具体电影版本（如 2003 年韩国版 Oldboy，2019 年 Little Women）。简介、叙事标签和推荐理由为本项目编辑文本，属于对影片的解读，不代表权威分类。地区标签用于片单多样性，是简化的创作语境分类，不是完整合拍国信息；“欧洲”用于跨欧洲语境的 The Grand Budapest Hotel。片单不提供观看平台或年龄分级承诺，部分电影包含暴力、创伤或沉重主题。

所有视觉卡片由 CSS 几何图形和文字原创生成，无电影海报、剧照或受许可约束的字体素材。

## 测试

算法测试仅需 Node.js 20+，**无需安装包**：

```sh
npm test
```

端到端测试使用开发依赖 Playwright，不会被浏览器页面加载：

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

若机器已有 Chromium，可设置 `CHROMIUM_PATH=/usr/bin/chromium`。Linux 缺少浏览器系统依赖时，按 Playwright 官方说明安装。环境中的 npm 缓存目录不可写时，可使用 `npm ci --cache /tmp/cinema-npm-cache`。

- 算法：59 项测试，含全部 27 种组合、结果唯一性、确定性、4/3/3 权重、解释对应关系、无效输入与多样性；另以原提交快照验证全部 27 种组合前三名完全一致、电影和题目文件字节不变、后续候选有限且有依据。
- 浏览器：真实 DOM 操作遍历 27 种组合；遍历每组答案的所有换片候选与耗尽状态；验证返回、修改、重开、键盘、确认、复制成功与失败、异步复制期间换片、固定 Ember Lab 链接、无外部运行时请求及无脚本错误。
- 布局：320、375、390、768、1440 像素宽度，开场、每题和结果页无横向溢出；验证减少动态效果。截图输出至忽略的 `test-results/`。

测试自动启动临时本地静态服务并在结束后关闭服务和浏览器。

## Vercel 部署

本轮仅开发分支 / Draft PR 供 Preview 试玩；不合并 main，不修改生产部署、域名或其他项目。下面记录既有静态配置，不表示本轮执行了上线。

| 设置 | 值 |
| --- | --- |
| Git repository | `wenyimarius-ship-it/ember-film-experiment` |
| Production branch | `main` |
| Framework Preset | **Other** |
| Root Directory | 仓库根目录 |
| Install Command | 留空 / 无需安装 |
| Build Command | 留空 / 无需构建 |
| Output Directory | `.`（项目根目录） |
| Environment variables | 无 |

`vercel.json` 已声明以上静态设置。无需 `npm install` 即可提供页面；`package.json` 仅用于本地测试。不要将 Output Directory 设为 `public` 或 `dist`。没有 SPA 路由，全部流程在首页内完成，刷新回到开场。

上线后检查：首页资源正常、三题可完成、单部电影及理由显示、换片和候选耗尽提示正确、复制提示正常、返回入口为 `https://lab.mariustang.com/`。推送代码与实际 Vercel 部署是不同步骤；仓库交付本身不表示已获得线上 URL。

## 首轮改造验收

见 [代码核查与验收记录](docs/first-visit-review.md)。自动化通过不代表真人完成率、90 秒目标或观看意愿已通过；必须另请 3 名陌生访客真机试玩，记录耗时、理由复述和第一部观看意愿。
