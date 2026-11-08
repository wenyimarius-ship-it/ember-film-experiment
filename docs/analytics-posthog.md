# Cinema / Puzzle：共用PostHog项目，正式发布候选（待预览去重验收）

## 当前状态

接入现有项目 `https://us.i.posthog.com`；公开Project API key位于 `js/analytics-config.js`，不是Personal API key。发布候选启用live配置，但只有精确正式origin `https://ember-film-experiment.vercel.app` 能发送live；Preview只能发送明确标记的test。发送端只接受source=wechat_moments；direct和other仅在本地保存归因，不发送。此分支尚未合并main。没有改套餐、启用新服务或升级，也不合并main、不发布正式站。

Cloudflare/D1方案暂停，相关本地草稿保留在仓库外，不包含在本分支提交。PostHog SDK不加载：没有autocapture、自动$pageview、录屏、identify、Cookie或个人档案调用。通过显式HTTP capture只发3个事件。

| 事件 | 真实触发时机 |
| --- | --- |
| funnel_open | 首页内容显示后 |
| funnel_start | 点击开始选后 |
| funnel_complete | 推荐结果内容首次显示后 |

业务属性仅site=cinema/puzzle、source=wechat_moments/direct/other、traffic=test/live。不发答案、影片结果、档案、评分、日期、短评、当前URL、referrer或浏览器指纹。请求credentials=omit及referrerPolicy=no-referrer。协议使用固定distinct_id=ember-funnel-aggregate，非用户/设备/会话标识；$process_person_profile=false、$geoip_disable=true。不根据IP推断地区；基础设施仍处理普通网络连接。

**后台使用Total event count，不使用Unique users，也不用按distinct_id关联的Funnels。** 固定的协议ID不代表真实用户；每节点客户端按会话去重后，总事件次数才是本需求的会话节点数。

## 会话与来源

会话口径为同标签页sessionStorage生命周期，首次来源固定；刷新、换片、改选、重新体验不清空节点标记。新标签页/关闭后重新打开通常是新会话；浏览器复制标签页可能继承存储。这不是独立人数。存储不可用时降级页面内去重，不能保证跨刷新去重。

首次URL含utm_source=wechat_moments则保留wechat_moments；其他非空UTM统一other，避免发送任意个人内容。测试链接含analytics_test=1，在会话中固定traffic=test，刷新去掉参数也保持测试分类。切换正式/测试必须新会话。

去重标记在发送前保存；被拦截、离线或失败不自动重试，可能漏计但不会因页面重复渲染反复发送。不声称网络故障下仍能保证后台恰好一次。

## 测试链接与验收

在**真实Preview URL**后添加：`?utm_source=wechat_moments&analytics_test=1`。不要使用正式域名替代Preview。链接须从Vercel对应提交的部署记录读取，不猜分支域名。

在新的隐私窗口/空sessionStorage打开测试链接：打开→开始选→完成三个选择→显示推荐，再换片、改选、刷新。后台筛选site=cinema、source=wechat_moments、traffic=test和本次操作时间段，3个事件各应增加1，其后操作不增加。核验网络capture成功不等于事件已在后台可查。

本地已通过68项测试；真实Chromium使用拦截的PostHogHTTP响应验证3次发送、字段白名单、换片/改选/刷新去重与测试来源保留。这不是实际PostHog入库，也不是已部署Preview证据。原电影选择流程的27组浏览器回归另行运行。

## 在哪里看数字

登录 `https://us.posthog.com/` 选择共用项目，进入Activity/Explore的事件列表（界面名称以项目实际版本为准），搜索funnel_open/funnel_start/funnel_complete，检查业务属性及时间段。

建立Trends Insight，三条series分别为：A=funnel_open、B=funnel_start、C=funnel_complete，聚合均选Total count；全局过滤source=wechat_moments、traffic=test，site=cinema或puzzle，也可按site分组。

正式采集经确认后，使用相同筛选但traffic=live；完成÷打开为C/A，完成÷开始为C/B，设置百分比格式（如显示数字则公式100*C/A、100*C/B）。分母为0时不解读比例。先看同一日期范围的总计比率，不平均每日百分比。

仅有公开Project key可以写入，不能读取/配置后台。后台不可读时由项目管理员确认实际入库和Insight配置，不索取Personal API key。

## 发布边界

正式发布候选保持Preview不产生live，带analytics_test=1产生test。用户已条件授权发布，但真实换片/改选/刷新去重尚未全部验收，因此目前不合并main；验收满足后方可更新正式站。不能把“推送分支”当作已取得可访问Preview；不能把公开Project token当作后台读权限。

正式报表SQL见 `docs/cinema-wechat-report.sql`，仅筛选cinema/wechat_moments/live，因此排除所有测试记录；需有后台读取权限的管理员创建并保存Insight，不把本地SQL文件声称为已存在的后台报表。项目级Discard client IP data已由用户截图确认启用，新的Cinema测试事件未显示真实IP；旧事件不会因此自动清除。
