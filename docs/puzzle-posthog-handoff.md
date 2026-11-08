# Puzzle任务唯一接入指令（复用Cinema的PostHog项目）

只做Preview测试，不更新正式站。复用Cinema统计分支的js/funnel.js、js/posthog-transport.js、js/analytics.js和js/analytics-config.js；按Puzzle实际框架导入，配置仅把site改为puzzle，apiHost和公开projectToken与Cinema相同，liveEnabled=false。不要加载额外PostHog SDK或启用自动采集、自动页面浏览、录屏、identify。

在首页真实显示后调用trackFunnel('open')，真正开始操作时调用trackFunnel('start')，完成结果真实显示后调用trackFunnel('complete')。函数内部的cinema_前缀只是本地映射，最终事件统一为funnel_open/funnel_start/funnel_complete，业务site=puzzle，不需要再建项目或新事件。不要传答案/拼图内容/结果文字/用户信息。

CSP的connect-src只增加https://us.i.posthog.com；不要放开*。新会话在实际Puzzle Preview加?utm_source=wechat_moments&analytics_test=1。完成流程后检查后台site=puzzle/source=wechat_moments/traffic=test，每个节点增量1；刷新及重试不多计。接口返回成功仍需在后台确认入库。

后台使用三个事件的Total event count而不是Unique users/按身份关联的Funnels；完成÷打开=C/A，完成÷开始=C/B。交付从Vercel部署记录读取的真实Preview链接和提交SHA；不给猜测链接、不提前更新正式站。
