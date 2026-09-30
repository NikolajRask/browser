/** Chromium net error codes → user-facing copy. */
const ERROR_COPY: Record<
  number,
  { title: string; summary: (host: string) => string; tips: string[] }
> = {
  [-105]: {
    title: 'This site can’t be reached',
    summary: (host) => `${host}’s server IP address could not be found.`,
    tips: ['Checking the connection', 'Checking the proxy and the firewall']
  },
  [-106]: {
    title: 'No internet',
    summary: () => 'You are offline. Check your network connection and try again.',
    tips: ['Checking the network cables, modem, and router', 'Reconnecting to Wi‑Fi']
  },
  [-102]: {
    title: 'This site can’t be reached',
    summary: (host) => `${host} refused to connect.`,
    tips: ['Checking the connection', 'Checking the proxy and the firewall']
  },
  [-101]: {
    title: 'This site can’t be reached',
    summary: (host) => `The connection was reset while connecting to ${host}.`,
    tips: ['Checking the connection', 'Checking the proxy and the firewall']
  },
  [-100]: {
    title: 'This site can’t be reached',
    summary: (host) => `${host} unexpectedly closed the connection.`,
    tips: ['Checking the connection', 'Trying again in a few moments']
  },
  [-7]: {
    title: 'This site can’t be reached',
    summary: (host) => `${host} took too long to respond.`,
    tips: ['Checking the connection', 'Checking the proxy and the firewall']
  },
  [-21]: {
    title: 'This site can’t be reached',
    summary: () => 'Your network connection changed. Try reloading the page.',
    tips: ['Checking the connection', 'Reconnecting to Wi‑Fi']
  },
  [-118]: {
    title: 'This site can’t be reached',
    summary: (host) => `A connection attempt to ${host} timed out.`,
    tips: ['Checking the connection', 'Checking the proxy and the firewall']
  },
  [-200]: {
    title: 'Your connection is not private',
    summary: (host) =>
      `Attackers might be trying to steal your information from ${host} (for example, passwords, messages, or credit cards).`,
    tips: ['Using a different network', 'Checking the system clock']
  },
  [-201]: {
    title: 'Your connection is not private',
    summary: (host) => `The certificate for ${host} is not valid.`,
    tips: ['Checking that the system clock is correct']
  },
  [-202]: {
    title: 'Your connection is not private',
    summary: (host) => `The certificate for ${host} is not trusted.`,
    tips: ['Checking the connection', 'Contacting the site owner']
  }
}

const FALLBACK_COPY = {
  title: 'This site can’t be reached',
  summary: (host: string) => `Lockin couldn’t load ${host}.`,
  tips: ['Checking the connection', 'Checking the spelling of the address']
}

function hostFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.host || parsed.href
  } catch {
    return url || 'this page'
  }
}

export function errorPageTitle(errorCode: number): string {
  return (ERROR_COPY[errorCode] ?? FALLBACK_COPY).title
}

export function buildErrorPageDataUrl(
  failedUrl: string,
  errorCode: number,
  errorDescription: string
): string {
  const copy = ERROR_COPY[errorCode] ?? FALLBACK_COPY
  const host = hostFromUrl(failedUrl)
  const title = copy.title
  const summary = copy.summary(host)
  const tips = copy.tips
  const codeLabel = errorDescription?.trim() || `Error ${errorCode}`

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';"
    />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg-top: #eef6f4;
        --bg-bottom: #f4f6f8;
        --text: #1f2328;
        --text-muted: #5f6b76;
        --accent: #0f766e;
        --accent-hover: #0d5f59;
        --font: 'Segoe UI', 'SF Pro Text', system-ui, sans-serif;
      }

      * { box-sizing: border-box; }

      html, body {
        margin: 0;
        min-height: 100%;
        color: var(--text);
        font-family: var(--font);
        background:
          radial-gradient(1200px 480px at 12% -10%, var(--bg-top), transparent 60%),
          linear-gradient(180deg, #f7fafb 0%, var(--bg-bottom) 100%);
      }

      body {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
      }

      .card {
        width: min(520px, 100%);
      }

      .icon {
        width: 56px;
        height: 56px;
        margin-bottom: 20px;
        color: var(--text-muted);
      }

      h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 650;
        letter-spacing: -0.03em;
        line-height: 1.2;
      }

      .summary {
        margin: 12px 0 0;
        font-size: 15px;
        line-height: 1.5;
        color: var(--text);
      }

      .tips-label {
        margin: 28px 0 10px;
        font-size: 14px;
        font-weight: 600;
      }

      ul {
        margin: 0;
        padding-left: 1.2em;
        color: var(--text-muted);
        font-size: 14px;
        line-height: 1.7;
      }

      .code {
        margin: 24px 0 0;
        font-size: 12px;
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
      }

      .actions {
        margin-top: 28px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      button {
        appearance: none;
        border: none;
        border-radius: 8px;
        padding: 10px 18px;
        font: inherit;
        font-size: 14px;
        font-weight: 560;
        cursor: pointer;
      }

      .reload {
        background: var(--accent);
        color: #fff;
      }

      .reload:hover {
        background: var(--accent-hover);
      }
    </style>
  </head>
  <body>
    <main class="card">
      <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3.5c-4.7 0-8.5 3.8-8.5 8.5S7.3 20.5 12 20.5s8.5-3.8 8.5-8.5S16.7 3.5 12 3.5Z"
          stroke="currentColor"
          stroke-width="1.6"
        />
        <path
          d="M12 7.5v6"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
        <circle cx="12" cy="16.2" r="1.1" fill="currentColor" />
      </svg>
      <h1>${escapeHtml(title)}</h1>
      <p class="summary">${escapeHtml(summary)}</p>
      <p class="tips-label">Try:</p>
      <ul>
        ${tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}
      </ul>
      <p class="code">${escapeHtml(codeLabel)}</p>
      <div class="actions">
        <button type="button" class="reload" id="reload">Reload</button>
      </div>
    </main>
    <script>
      document.getElementById('reload').addEventListener('click', () => {
        location.href = ${JSON.stringify(failedUrl)}
      })
    </script>
  </body>
</html>`

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
