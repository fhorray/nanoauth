/** @jsxImportSource react */
import type { FC, PropsWithChildren, ReactNode } from 'react';

export const Layout: FC<PropsWithChildren<{ title: string; data?: any }>> = ({
  title,
  children,
  data,
}) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title + ' | NANOAUTH'}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/global.css" />
        {/* Bootstrap data for hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__INITIAL_DATA__ = ${JSON.stringify(data || {})};`,
          }}
        />
      </head>
      <body>
        <div id="root">{children}</div>
        <script type="module" src="/client.js"></script>
      </body>
    </html>
  );
};
