import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { EnvError, getEnv } from '@/app/env';

async function bootstrap() {
  const root = document.getElementById('root');
  if (!root) throw new Error('Missing #root element');

  let env;
  try {
    env = getEnv();
  } catch (error) {
    if (error instanceof EnvError) {
      const pre = document.createElement('pre');
      pre.setAttribute('role', 'alert');
      pre.style.whiteSpace = 'pre-wrap';
      pre.textContent = error.message;
      root.replaceChildren(pre);
    }
    throw error;
  }

  if (env.enableApiMocking) {
    const { worker } = await import('@/mocks/browser');
    await worker.start({ onUnhandledFrame: 'bypass' });
  }

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
