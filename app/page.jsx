'use client';

import dynamic from 'next/dynamic';

// Dynamically import the map with no SSR
const Map = dynamic(() => import('../components/Map'), {
  ssr: false,
  loading: () => <p>Loading map...</p>
});

export default function Page() {
  return (
    <div>
      <div>Welcome to BCA.</div>
      <Map />
    </div>
  );
}