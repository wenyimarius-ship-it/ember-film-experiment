# Cinema / Puzzle：PostHog 手动统计

## 发送机制与范围

使用现有 `https://us.i.posthog.com/capture/` 与 `js/analytics-config.js` 中的公开 Project API key，不加载 PostHog SDK。没有 autocapture、自动 pageview、录屏、identify、Cookie 或个人档案调用。事件复用 `js/posthog-transport.js` 的显式 HTTP capture；`js/analytics.js` 决定环境和会话流量，`js/funnel.js` 保存会话去重标记。推荐排序不读取任何反馈。

配置的正式 origin 为 `https://cinema.mariustang.com` 与 `https://ember-film-experiment.vercel.app`，必须精确匹配且 `liveEnabled=true`。

| 事件 | 触发时机 | 发送范围 | 业务属性 |
| --- | --- | --- | --- |
| `funnel_open` | 首页显示 | 原有朋友圈来源规则 | `site`、`source`、`traffic` |
| `funnel_start` | 点击开始选 | 同上 | 同上 |
| `funnel_complete` | 首次显示推荐结果 | 同上 | 同上 |
| `cinema_feedback` | 主动点击“准 / 有点偏 / 不准” | 仅配置的正式 origin；不限朋友圈来源 | `site`、`rating`、`film_id`、`swap_count`、`traffic` |

现有漏斗发送器只接受 `source=wechat_moments`；`direct` 和 `other` 仅保留本地归因。漏斗的 live 需要正式 origin；既有 `analytics_test=1` 测试机制也允许在 Preview 发送漏斗 test 事件。**新增反馈更严格：本地和未配置环境即使带测试参数也不发送 `cinema_feedback`。** 在这些环境中仍可点击反馈，界面只感谢用户。

成功的 `cloud_save`、`cloud_restore`、`cloud_delete` 继续沿用已有云端客户端机制，此次未修改；业务属性为 `site`、`traffic`，不含正文或恢复码，详见 [云端保存说明](cloud-persistence.md)。

## 反馈属性白名单

`cinema_feedback` 的业务属性严格为：

| 属性 | 允许值 / 含义 |
| --- | --- |
| `site` | 固定为 `cinema` |
| `rating` | `accurate`（准）、`partial`（有点偏）、`off`（不准） |
| `film_id` | 公开内置片库的 ID，可对应推荐片名；不传片名自由文本 |
| `swap_count` | 当前候选位置，首推为 0，每次成功换片加 1；耗尽点击不增加 |
| `traffic` | `test` 或 `live`，由分析模块决定，事件输入不能覆盖 |

另带原有协议属性：`distinct_id=ember-funnel-aggregate`（固定非个人标记）、`$process_person_profile=false`、`$geoip_disable=true`。反馈不附加 `source`。发送器显式挑选字段，丢弃其他输入；片库以外的 ID、未知评分、非法换片次数及非 Cinema 站点的反馈均不发送。

不发送三个问题的答案、恢复码、IP 字段、邮箱、完整页面 URL、referrer、用户输入文本或浏览器指纹。请求设置 `credentials=omit`、`referrerPolicy=no-referrer`、`keepalive=true`。基础设施仍处理普通网络连接，不能把“没有 IP 事件属性”解释为网络连接不经过 IP。

## 会话、测试流量与去重

会话口径为同标签页 `sessionStorage` 生命周期；浏览器复制标签页可能继承存储，不代表独立人数。漏斗来源首次固定：`utm_source=wechat_moments` 保留该值，其他非空来源统一为 `other`，缺省为 `direct`，避免发送任意来源文本。

`analytics_test=1` 优先标记 `traffic=test`，即使此标签页先前是 live；测试标记在刷新或去掉参数后仍保留，避免测试回流 live。要验证 live，请使用新的隐私上下文 / 标签页会话。反馈始终还需通过正式 origin 检查；测试参数不会绕过该限制。

漏斗每节点每会话只尝试发送一次。反馈按“`film_id` + `swap_count`”去重：片库 ID 对应片名，首推计 0；重新渲染、确认、复制、返回修改、重新体验、刷新后遇到相同组合不会重复发送或解锁。换片出现新的组合可再次反馈。存储不可用时降级为页面内 Map，不能保证跨刷新去重。

去重标记先保存，再尝试发送；被拦截、离线或失败不自动重试，可能漏计。点击后立即锁定三个按钮，仅显示“谢谢你的反馈”，不声称已记录或已入库。没有文字留言、不上传答题状态、不依赖后端写入成功，不阻塞确认、换片、复制或修改选择。

## 本地验证与上线验收

运行 `npm test`、`npm run test:browser`、`npm run test:funnel:browser`。测试覆盖属性白名单与禁传字段、会话去重、换片后反馈、存储及传输故障；浏览器覆盖 375 / 1440px 可见性、44px 触控目标、键盘、锁定/重置、无点击布局跳动、减少动态效果、正式 origin 与 test/live 判定。正式 origin 在本地测试中通过配置夹具模拟，所有 capture 被浏览器拦截，不写真实 PostHog。

本地请求构造及模拟响应成功不证明 PostHog 实际入库。上线后，由有权限的管理员在 PostHog Activity / Explore 搜索 `cinema_feedback`，核对 `site=cinema`、`traffic=test`、评分、影片 ID 和换片次数；正式 origin 上用新会话加 `?analytics_test=1` 进行手工反馈，再换片、重复点击、确认及刷新，检查每个组合最多一条。真实 Preview 不应产生反馈事件。

后台使用 **Total event count**，不用 Unique users，也不按固定 distinct_id 关联个人漏斗。反馈准确度可按 `rating` 与 `film_id` 分组，正式报表过滤 `traffic=live`。既有漏斗报表见 `cinema-wechat-report.sql`，保持朋友圈筛选与原口径。公开 Project API key 只能用于写入，不具备后台读取权限；不索取 Personal API key。

此功能分支不合并、不发布生产，不调整 Vercel、DNS、套餐或后端。分享元信息前置 PR #5 已单独获准合并；该授权不表示结果反馈功能也已上线。
