-- PostHog project 719464: Cinema / WeChat Moments / live only.
-- Total event counts, not unique users. Last 30 days; adjust timestamp range as needed.
SELECT
    countIf(event = 'funnel_open') AS opens,
    countIf(event = 'funnel_start') AS starts,
    countIf(event = 'funnel_complete') AS completes,
    round(100.0 * countIf(event = 'funnel_complete') / nullIf(countIf(event = 'funnel_open'), 0), 2) AS complete_per_open_pct,
    round(100.0 * countIf(event = 'funnel_complete') / nullIf(countIf(event = 'funnel_start'), 0), 2) AS complete_per_start_pct
FROM events
WHERE properties.site = 'cinema'
    AND properties.source = 'wechat_moments'
    AND properties.traffic = 'live'
    AND event IN ('funnel_open', 'funnel_start', 'funnel_complete')
    AND timestamp >= now() - INTERVAL 30 DAY
