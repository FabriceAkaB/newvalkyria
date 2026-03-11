declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: Record<string, string> }) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(name: string, props?: Record<string, string>) {
  if (typeof window === "undefined") {
    return;
  }

  window.plausible?.(name, props ? { props } : undefined);

  if (window.gtag) {
    window.gtag("event", name, props ?? {});
  }
}
