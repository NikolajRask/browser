type Props = {
  visible: boolean
}

export function WindowControls({ visible }: Props): React.JSX.Element | null {
  if (!visible) return null

  return (
    <div className="window-controls" aria-label="Window controls">
      <button
        type="button"
        className="window-control window-control--close"
        aria-label="Close"
        onClick={() => void window.lockin.closeWindow()}
      >
        <svg viewBox="0 0 12 12" width="8" height="8" aria-hidden="true">
          <path
            d="M3 3l6 6m0-6l-6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <button
        type="button"
        className="window-control window-control--minimize"
        aria-label="Minimize"
        disabled
      >
        <svg viewBox="0 0 12 12" width="8" height="8" aria-hidden="true">
          <path
            d="M2.5 6h7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <button
        type="button"
        className="window-control window-control--fullscreen"
        aria-label="Exit full screen"
        onClick={() => void window.lockin.toggleFullScreen()}
      >
        <svg viewBox="0 0 12 12" width="7" height="7" aria-hidden="true">
          <path
            d="M4.2 2.2H2.2v2M7.8 2.2h2v2M4.2 9.8H2.2v-2M7.8 9.8h2v-2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}
