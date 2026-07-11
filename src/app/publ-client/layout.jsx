import { PublClientBootstrap } from '../../features/publClient/PublClientBootstrap.jsx';
import { resolvePublPappClientConfigResult } from '../../server/publPapp/clientConfig.js';

export default function PublClientLayout({ children }) {
  const clientConfigResult = resolvePublPappClientConfigResult();

  return (
    <PublClientBootstrap
      clientConfig={clientConfigResult.ok ? clientConfigResult.config : null}
      clientConfigError={clientConfigResult.ok ? '' : clientConfigResult.message}
    >
      {children}
    </PublClientBootstrap>
  );
}
