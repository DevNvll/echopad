interface SplashScreenProps {
  isVisible: boolean;
}

export function SplashScreen({ isVisible }: SplashScreenProps) {
  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-500"
      style={{ opacity: isVisible ? 1 : 0 }}
    >
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand/30 to-brand/10 border border-brand/20 flex items-center justify-center shadow-glow">
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              className="w-8 h-8 text-brand"
              stroke="currentColor" 
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
            lazuli
          </span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <span 
            className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"
            style={{ animationDelay: '0ms' }}
          />
          <span 
            className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"
            style={{ animationDelay: '150ms' }}
          />
          <span 
            className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}

