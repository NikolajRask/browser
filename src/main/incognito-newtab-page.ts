export const INCOGNITO_NEWTAB_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';"
    />
    <title>New Incognito Tab</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #2b2d31;
        --bg-elevated: #35383e;
        --border: #4a4e56;
        --text: #e8eaed;
        --text-muted: #9aa0a6;
        --accent: #8ab4f8;
        --accent-soft: rgba(138, 180, 248, 0.14);
        --font: 'Segoe UI', 'SF Pro Text', system-ui, sans-serif;
        --display: 'Segoe UI Semibold', 'SF Pro Display', 'Segoe UI', system-ui, sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
        height: 100%;
        color: var(--text);
        font-family: var(--font);
        background:
          radial-gradient(900px 480px at 50% -12%, #3a3d44, transparent 60%),
          linear-gradient(180deg, #32353b 0%, var(--bg) 100%);
      }

      body {
        display: grid;
        place-items: center;
        padding: 48px 24px;
      }

      .stage {
        width: min(560px, 100%);
        text-align: center;
        animation: rise 420ms ease-out both;
      }

      @keyframes rise {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .icon {
        display: grid;
        place-items: center;
        width: 72px;
        height: 72px;
        margin: 0 auto;
        border-radius: 50%;
        background: var(--bg-elevated);
        color: var(--text);
        box-shadow: inset 0 0 0 1px var(--border);
        animation: rise 420ms ease-out 40ms both;
      }

      .title {
        margin: 22px 0 0;
        font-family: var(--display);
        font-size: clamp(28px, 5vw, 36px);
        font-weight: 650;
        letter-spacing: -0.035em;
        line-height: 1.1;
      }

      .tagline {
        margin: 12px 0 0;
        color: var(--text-muted);
        font-size: 15px;
        letter-spacing: -0.01em;
        line-height: 1.45;
        animation: rise 420ms ease-out 80ms both;
      }

      form {
        margin-top: 32px;
        animation: rise 420ms ease-out 140ms both;
      }

      .search {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 14px 16px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--bg-elevated);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
        transition:
          border-color 160ms ease,
          box-shadow 160ms ease;
      }

      .search:focus-within {
        border-color: #6b8fc9;
        box-shadow: 0 0 0 3px var(--accent-soft);
      }

      .search svg {
        flex-shrink: 0;
        color: #9aa0a6;
      }

      .search input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: none;
        background: transparent;
        color: var(--text);
        font: inherit;
        font-size: 15px;
      }

      .search input::placeholder {
        color: #80868b;
      }

      .facts {
        margin: 36px 0 0;
        padding: 0;
        list-style: none;
        text-align: left;
        display: grid;
        gap: 14px;
        animation: rise 420ms ease-out 200ms both;
      }

      .facts li {
        display: grid;
        grid-template-columns: 22px 1fr;
        gap: 12px;
        align-items: start;
        color: var(--text-muted);
        font-size: 13px;
        line-height: 1.45;
      }

      .facts li strong {
        color: var(--text);
        font-weight: 600;
      }

      .facts svg {
        margin-top: 2px;
        color: var(--accent);
      }
    </style>
  </head>
  <body>
    <main class="stage">
      <div class="icon" aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 2.2c1.6 0 2.9 1.1 3.2 2.6h.9c.7 0 1.2.6 1.1 1.3l-.4 2.2c-.3 1.5-1.6 2.6-3.1 2.6H6.3c-1.5 0-2.8-1.1-3.1-2.6L2.8 6.1c-.1-.7.4-1.3 1.1-1.3h.9C5.1 3.3 6.4 2.2 8 2.2Z"
            fill="currentColor"
          />
          <circle cx="5.6" cy="7.4" r="1.15" fill="#2b2d31" />
          <circle cx="10.4" cy="7.4" r="1.15" fill="#2b2d31" />
          <path
            d="M4.2 12.2c1.1.9 2.4 1.4 3.8 1.4s2.7-.5 3.8-1.4"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <h1 class="title">You've gone Incognito</h1>
      <p class="tagline">
        This tab won't leave a trail on this device. Lockin still won't save history,
        cookies, or passwords from pages you open here.
      </p>
      <form id="search-form" autocomplete="off">
        <label class="search">
          <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
            <circle
              cx="7"
              cy="7"
              r="4.4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M10.4 10.4 13.2 13.2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
          <input
            id="query"
            type="search"
            name="q"
            placeholder="Search Google or enter address"
            spellcheck="false"
            enterkeyhint="go"
          />
        </label>
      </form>
      <ul class="facts">
        <li>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3.5 8.2 6.2 11l6.3-6.4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span><strong>Not saved:</strong> browsing history, cookies, site data, or form info from this tab.</span>
        </li>
        <li>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="5.4" stroke="currentColor" stroke-width="1.4" />
            <path d="M8 5.2v3.1l2 1.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span><strong>Still visible to:</strong> websites you visit, your school or employer, and your internet provider.</span>
        </li>
        <li>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M4.5 2.5h7a1 1 0 0 1 1 1v10.2L8 11.3l-4.5 2.4V3.5a1 1 0 0 1 1-1Z"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linejoin="round"
            />
          </svg>
          <span><strong>Bookmarks still work</strong> if you save something on purpose.</span>
        </li>
      </ul>
    </main>
    <script>
      const form = document.getElementById('search-form')
      const input = document.getElementById('query')
      const api = window.lockinNewTab

      form.addEventListener('submit', (event) => {
        event.preventDefault()
        const value = input.value.trim()
        if (!value || !api) return
        void api.go(value)
      })
    </script>
  </body>
</html>
`
