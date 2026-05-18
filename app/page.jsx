'use client';

import dynamic from 'next/dynamic';
import { supabase } from '../lib/supabase';
import { useEffect } from 'react';

const Map = dynamic(() => import('../components/Map'), {
  ssr: false,
  loading: () => <p>Loading map...</p>
});

export default function Page() {
  useEffect(() => {
    async function testConnection() {
      console.log("SUPABASE TESTING:")
      const { data, error } = await supabase.from('Images').select('*').limit(1)
      console.log('data:', data)
      console.log('error:', error)
    }
    testConnection()
  }, [])

  return (
    <div>
      <div>Welcome to BCA.</div>
      <Map />
    </div>
  );
}