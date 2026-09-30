import { useEffect, useState } from 'react'

type Props = {
  src: string | null
  className?: string
  size?: number
}

/** Document glyph used when a tab/site has no favicon. */
export function FaviconFallback({ size = 16 }: { size?: number }): React.JSX.Element {
  return (
    <svg
      className="favicon-fallback-icon"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path
        d="M4.25 2.5h5.1L11.75 5v8.5h-7.5V2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M9.25 2.5V5h2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M6 8h4M6 10.25h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Favicon({ src, className = 'tab-favicon', size = 16 }: Props): React.JSX.Element {
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    setBroken(false)
  }, [src])

  const showImage = Boolean(src) && !broken

  return (
    <span className={`${className}${showImage ? ' has-image' : ''}`} aria-hidden="true">
      {showImage ? (
        <img
          src={src!}
          alt=""
          draggable={false}
          width={size}
          height={size}
          onError={() => setBroken(true)}
        />
      ) : (
        <FaviconFallback size={size} />
      )}
    </span>
  )
}
