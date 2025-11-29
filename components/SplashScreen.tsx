interface SplashScreenProps {
  isVisible: boolean
  appName?: string
  accentColor?: string
}

export function SplashScreen({
  isVisible,
  appName = 'Lazuli',
  accentColor
}: SplashScreenProps) {
  if (!isVisible) return null

  const brandColor = accentColor || 'var(--accent-color)'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-500"
      style={{ opacity: isVisible ? 1 : 0 }}
    >
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: `linear-gradient(to bottom right, ${brandColor}4D, ${brandColor}1A)`,
              border: `1px solid ${brandColor}33`,
              boxShadow: `0 0 20px -10px ${brandColor}26`
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-8 h-8"
              stroke={brandColor}
              strokeWidth="1.5"
            >
              <path
                d="M12 3L4 7v10l8 4 8-4V7l-8-4z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 12l8-4M12 12v9M12 12L4 8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-2xl font-medium text-textMain tracking-wide">
            {appName.toLowerCase()}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: brandColor, animationDelay: '0ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: brandColor, animationDelay: '150ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: brandColor, animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  )
}
