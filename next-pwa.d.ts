declare module 'next-pwa' {
  import { NextConfig } from 'next';

  interface PWAConfig {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    skipWaiting?: boolean;
    scope?: string;
    sw?: string;
    runtimeCaching?: any[];
    buildExcludes?: (string | RegExp)[];
    publicExcludes?: string[];
    cacheOnFrontEndNav?: boolean;
    cacheStartUrl?: boolean;
    dynamicStartUrl?: boolean;
    reloadOnOnline?: boolean;
    fallbacks?: Record<string, string>;
  }

  function withPWA(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;

  export default withPWA;
}
