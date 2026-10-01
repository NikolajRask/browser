export const AI_RESIZE_OVERLAY_HTML = `<!doctype html>
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
    </style>
  </head>
  <body>
    <script>
      const api = window.aiSidebarResize
      // Do not check event.buttons — the pointerdown happened in another
      // WebContentsView, so moves here often report buttons === 0.
      const onMove = (event) => {
        if (!api) return
        api.move(event.screenX)
      }
      const onUp = () => {
        if (!api) return
        api.end()
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('mousemove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('mouseup', onUp)
      window.addEventListener('pointercancel', onUp)
      window.addEventListener('blur', onUp)
    </script>
  </body>
</html>
`