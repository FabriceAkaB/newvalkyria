import Script from "next/script";

import { env } from "@/lib/env";

export function AnalyticsScripts() {
  return (
    <>
      {env.plausibleDomain ? (
        <Script
          defer
          data-domain={env.plausibleDomain}
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      ) : null}
      {env.gaId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${env.gaId}`} strategy="afterInteractive" />
          <Script id="ga-script" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${env.gaId}');`}
          </Script>
        </>
      ) : null}
    </>
  );
}
