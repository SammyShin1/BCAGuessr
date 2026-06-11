import './globals.css'

export default function RootLayout({ children }) {
  return (
    <html lang="en" style={{ margin: 0, padding: 0 }} >
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <link rel="icon" href="/bcaguessr-logo-icon.png" />
      </head>
      <body style={{ margin: 0, padding: 0, boxSizing: 'border-box' }}>{children}</body>
    </ html>
  );
}