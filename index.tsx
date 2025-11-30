import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getCurrentWindow } from '@tauri-apps/api/window';
import App from './App';
import { QuickCapture } from './components/quick-capture';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    },
  },
});

function Root() {
  const [windowLabel, setWindowLabel] = useState<string | null>(null);

  useEffect(() => {
    const window = getCurrentWindow();
    setWindowLabel(window.label);
  }, []);

  if (windowLabel === null) {
    return null;
  }

  if (windowLabel === 'quick-capture') {
    return <QuickCapture />;
  }

  return <App />;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  </React.StrictMode>
);