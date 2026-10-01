export const SCREENTIME_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';"
    />
    <title>Time Locked in</title>
    <style>
      :root {
        color-scheme: light;
        --bg-top: #eef6f4;
        --bg-bottom: #f4f6f8;
        --surface: #ffffff;
        --border: #d7dce3;
        --text: #1f2328;
        --text-muted: #5f6b76;
        --hover: #f3f6f8;
        --danger: #d93025;
        --accent: #0f766e;
        --accent-soft: #d8f3ef;
        --font: 'Segoe UI', 'SF Pro Text', system-ui, sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
        color: var(--text);
        font-family: var(--font);
        background:
          radial-gradient(1200px 480px at 12% -10%, var(--bg-top), transparent 60%),
          linear-gradient(180deg, #f7fafb 0%, var(--bg-bottom) 100%);
      }

      body {
        padding: 40px 24px 64px;
      }

      .shell {
        max-width: 880px;
        margin: 0 auto;
      }

      header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 28px;
      }

      .heading {
        min-width: 0;
      }

      h1 {
        margin: 0;
        font-size: 32px;
        font-weight: 650;
        letter-spacing: -0.03em;
      }

      .subtitle {
        margin: 6px 0 0;
        color: var(--text-muted);
        font-size: 14px;
      }

      .clear-btn {
        appearance: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 36px;
        padding: 0 14px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--surface);
        color: var(--text);
        font: inherit;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        flex-shrink: 0;
      }

      .clear-btn:hover:not(:disabled) {
        background: var(--hover);
      }

      .clear-btn:disabled {
        opacity: 0.45;
        cursor: default;
      }

      .hero {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 28px 24px;
        margin-bottom: 20px;
        box-shadow: 0 1px 2px rgba(31, 35, 40, 0.04);
      }

      .hero-label {
        margin: 0;
        font-size: 13px;
        font-weight: 500;
        color: var(--text-muted);
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }

      .hero-total {
        margin: 8px 0 0;
        font-size: 48px;
        font-weight: 650;
        letter-spacing: -0.04em;
        color: var(--accent);
        line-height: 1.1;
      }

      .section {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 20px 20px 16px;
        margin-bottom: 16px;
        box-shadow: 0 1px 2px rgba(31, 35, 40, 0.04);
      }

      .section-title {
        margin: 0 0 16px;
        font-size: 15px;
        font-weight: 600;
      }

      .chart {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        height: 140px;
        padding: 0 4px;
      }

      .chart-col {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        height: 100%;
      }

      .chart-bar-wrap {
        flex: 1;
        width: 100%;
        display: flex;
        align-items: flex-end;
        justify-content: center;
      }

      .chart-bar {
        width: 100%;
        max-width: 40px;
        min-height: 4px;
        border-radius: 8px 8px 4px 4px;
        background: var(--accent-soft);
        transition: height 0.2s ease;
      }

      .chart-bar.has-time {
        background: var(--accent);
      }

      .chart-label {
        font-size: 11px;
        color: var(--text-muted);
        white-space: nowrap;
      }

      .chart-value {
        font-size: 11px;
        font-weight: 500;
        color: var(--text);
        white-space: nowrap;
      }

      .sites {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .site {
        display: grid;
        grid-template-columns: 36px minmax(0, 1fr) auto;
        gap: 12px;
        align-items: center;
        padding: 12px 4px;
        border-top: 1px solid var(--border);
      }

      .site:first-child {
        border-top: 0;
        padding-top: 4px;
      }

      .site-favicon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: var(--accent-soft);
        color: var(--accent);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 650;
      }

      .site-meta {
        min-width: 0;
      }

      .site-host {
        font-size: 14px;
        font-weight: 550;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .site-bar-track {
        margin-top: 6px;
        height: 6px;
        border-radius: 999px;
        background: #eef2f4;
        overflow: hidden;
      }

      .site-bar-fill {
        height: 100%;
        border-radius: inherit;
        background: var(--accent);
      }

      .site-time {
        font-size: 13px;
        color: var(--text-muted);
        white-space: nowrap;
        text-align: right;
      }

      .site-time-main {
        font-size: 13px;
        color: var(--text-muted);
      }

      .site-streak {
        margin-top: 2px;
        font-size: 12px;
        font-weight: 550;
        color: var(--accent);
      }

      .streak-days {
        font-size: 15px;
        font-weight: 650;
        color: var(--accent);
        white-space: nowrap;
      }

      .streak-label {
        margin-top: 2px;
        font-size: 11px;
        color: var(--text-muted);
      }

      .empty {
        padding: 48px 16px;
        text-align: center;
        color: var(--text-muted);
        font-size: 14px;
      }

      .empty.section-empty {
        padding: 24px 8px;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header>
        <div class="heading">
          <h1>Time Locked in</h1>
          <p class="subtitle" id="subtitle">Your browsing screen time</p>
        </div>
        <button type="button" class="clear-btn" id="clear" disabled>Clear data</button>
      </header>
      <div id="content">
        <div class="empty">Loading…</div>
      </div>
    </div>
    <script>
      const content = document.getElementById('content')
      const subtitle = document.getElementById('subtitle')
      const clearBtn = document.getElementById('clear')
      const api = window.lockinScreenTime

      const escapeHtml = (value) =>
        String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;')

      const formatDuration = (ms) => {
        const totalSec = Math.max(0, Math.floor(ms / 1000))
        const hours = Math.floor(totalSec / 3600)
        const minutes = Math.floor((totalSec % 3600) / 60)
        if (hours > 0) {
          return minutes > 0 ? hours + 'h ' + minutes + 'm' : hours + 'h'
        }
        if (minutes > 0) return minutes + 'm'
        if (totalSec > 0) return '<1m'
        return '0m'
      }

      const formatChartValue = (ms) => {
        if (ms <= 0) return ''
        return formatDuration(ms)
      }

      const dayShortLabel = (dayKey) => {
        const parts = dayKey.split('-').map(Number)
        if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return dayKey
        const date = new Date(parts[0], parts[1] - 1, parts[2])
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const that = new Date(date)
        that.setHours(0, 0, 0, 0)
        if (that.getTime() === today.getTime()) return 'Today'
        try {
          return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date)
        } catch {
          return dayKey
        }
      }

      const hostFromOrigin = (origin) => {
        try {
          return new URL(origin).hostname.replace(/^www\\./, '')
        } catch {
          return origin
        }
      }

      const formatStreak = (days) => {
        if (!days || days <= 0) return ''
        return days === 1 ? '1-day streak' : days + '-day streak'
      }

      const hasAnyTime = (summary) => {
        if (summary.todayTotalMs > 0) return true
        return summary.days.some((day) => day.totalMs > 0)
      }

      const render = (summary) => {
        const empty = !hasAnyTime(summary)
        clearBtn.disabled = empty
        subtitle.textContent = empty
          ? 'Your browsing screen time'
          : 'Active time in Lockin today and this week'

        if (empty) {
          content.innerHTML =
            '<div class="empty">No screen time recorded yet. Browse a bit and check back.</div>'
          return
        }

        const maxDay = Math.max(1, ...summary.days.map((day) => day.totalMs))
        const maxOrigin = Math.max(1, ...summary.topOrigins.map((item) => item.ms))
        const streaks = Array.isArray(summary.streaks) ? summary.streaks : []

        const chartHtml =
          '<div class="section">' +
          '<h2 class="section-title">Last 7 days</h2>' +
          '<div class="chart">' +
          summary.days
            .map((day) => {
              const pct = Math.max(4, Math.round((day.totalMs / maxDay) * 100))
              const height = day.totalMs > 0 ? pct : 4
              return (
                '<div class="chart-col">' +
                '<div class="chart-value">' +
                escapeHtml(formatChartValue(day.totalMs)) +
                '</div>' +
                '<div class="chart-bar-wrap">' +
                '<div class="chart-bar' +
                (day.totalMs > 0 ? ' has-time' : '') +
                '" style="height:' +
                height +
                '%"></div>' +
                '</div>' +
                '<div class="chart-label">' +
                escapeHtml(dayShortLabel(day.day)) +
                '</div>' +
                '</div>'
              )
            })
            .join('') +
          '</div></div>'

        const sitesHtml =
          summary.topOrigins.length === 0
            ? '<div class="section"><h2 class="section-title">Top sites today</h2><div class="empty section-empty">No sites yet today</div></div>'
            : '<div class="section">' +
              '<h2 class="section-title">Top sites today</h2>' +
              '<ul class="sites">' +
              summary.topOrigins
                .map((item) => {
                  const host = hostFromOrigin(item.origin)
                  const letter = (host || '?').charAt(0).toUpperCase()
                  const pct = Math.round((item.ms / maxOrigin) * 100)
                  const streakText = formatStreak(item.streakDays)
                  return (
                    '<li class="site">' +
                    '<div class="site-favicon" aria-hidden="true">' +
                    escapeHtml(letter) +
                    '</div>' +
                    '<div class="site-meta">' +
                    '<div class="site-host">' +
                    escapeHtml(host) +
                    '</div>' +
                    '<div class="site-bar-track"><div class="site-bar-fill" style="width:' +
                    pct +
                    '%"></div></div>' +
                    '</div>' +
                    '<div class="site-time">' +
                    '<div class="site-time-main">' +
                    escapeHtml(formatDuration(item.ms)) +
                    '</div>' +
                    (streakText
                      ? '<div class="site-streak">' + escapeHtml(streakText) + '</div>'
                      : '') +
                    '</div>' +
                    '</li>'
                  )
                })
                .join('') +
              '</ul></div>'

        const streaksHtml =
          streaks.length === 0
            ? '<div class="section"><h2 class="section-title">Site streaks</h2><div class="empty section-empty">Visit the same sites on consecutive days to build streaks.</div></div>'
            : '<div class="section">' +
              '<h2 class="section-title">Site streaks</h2>' +
              '<ul class="sites">' +
              streaks
                .map((item) => {
                  const host = hostFromOrigin(item.origin)
                  const letter = (host || '?').charAt(0).toUpperCase()
                  const days = item.streakDays
                  return (
                    '<li class="site">' +
                    '<div class="site-favicon" aria-hidden="true">' +
                    escapeHtml(letter) +
                    '</div>' +
                    '<div class="site-meta">' +
                    '<div class="site-host">' +
                    escapeHtml(host) +
                    '</div>' +
                    '</div>' +
                    '<div class="site-time">' +
                    '<div class="streak-days">' +
                    escapeHtml(String(days)) +
                    '</div>' +
                    '<div class="streak-label">' +
                    escapeHtml(days === 1 ? 'day' : 'days') +
                    '</div>' +
                    '</div>' +
                    '</li>'
                  )
                })
                .join('') +
              '</ul></div>'

        content.innerHTML =
          '<div class="hero">' +
          '<p class="hero-label">Today</p>' +
          '<p class="hero-total">' +
          escapeHtml(formatDuration(summary.todayTotalMs)) +
          '</p>' +
          '</div>' +
          chartHtml +
          streaksHtml +
          sitesHtml
      }

      const refresh = async () => {
        const summary = await api.summary()
        render(summary)
      }

      clearBtn.addEventListener('click', async () => {
        if (clearBtn.disabled) return
        await api.clear()
        await refresh()
      })

      refresh().catch(() => {
        content.innerHTML = '<div class="empty">Could not load screen time</div>'
      })

      setInterval(() => {
        refresh().catch(() => {})
      }, 30000)
    </script>
  </body>
</html>
`
