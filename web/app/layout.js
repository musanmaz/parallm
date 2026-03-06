import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <title>Multi-LLM Chat</title>
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
