export const SPLITTER_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"
    />
    <style>
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: transparent;
        cursor: col-resize;
        user-select: none;
      }

      .handle {
        position: absolute;
        inset: 0;
      }

      .bar {
        position: absolute;
        top: 0;
        left: 50%;
        width: 2px;
        height: 100%;
        margin-left: -1px;
        border-radius: 1px;
        background: #c7cbd1;
        pointer-events: none;
        transition:
          background 120ms ease,
          width 120ms ease;
      }

      body:hover .bar,
      body.dragging .bar {
        width: 3px;
        margin-left: -1.5px;
        background: #0f766e;
      }
    </style>
  </head>
  <body>
    <div class="handle"><div class="bar"></div></div>
    <script>
      const api = window.splitResize
      const bar = document.querySelector('.bar')
      let dragging = false
      let pointerId = null
      let pendingScreenX = null
      let rafId = null

      const setBarX = (clientX) => {
        bar.style.left = clientX + 'px'
      }

      const flushMove = () => {
        rafId = null
        if (pendingScreenX == null) return
        const x = pendingScreenX
        pendingScreenX = null
        api.move(x)
      }

      const start = (event) => {
        event.preventDefault()
        dragging = true
        pointerId = event.pointerId
        document.body.classList.add('dragging')
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch (_) {}
        api.start()
      }

      const move = (event) => {
        if (!dragging) return
        if (window.innerWidth > 20) setBarX(event.clientX)
        pendingScreenX = event.screenX
        if (rafId == null) rafId = requestAnimationFrame(flushMove)
      }

      const end = (event) => {
        if (!dragging) return
        if (event && pointerId != null && event.pointerId !== pointerId) return
        dragging = false
        pointerId = null
        document.body.classList.remove('dragging')
        bar.style.left = '50%'
        if (rafId != null) {
          cancelAnimationFrame(rafId)
          rafId = null
        }
        if (pendingScreenX != null) {
          api.move(pendingScreenX)
          pendingScreenX = null
        }
        api.end()
      }

      document.addEventListener('pointerdown', start)
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', end)
      window.addEventListener('pointercancel', end)
      window.addEventListener('blur', () => end())
    </script>
  </body>
</html>
`
