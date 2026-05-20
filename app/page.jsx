'use client';

import dynamic from 'next/dynamic';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';

const Map = dynamic(() => import('../components/Map'), {
  ssr: false,
  loading: () => <p>Loading map...</p>
});

export default function Page() {
  const [location, setLocation] = useState(null)

  useEffect(() => {
    async function testConnection() {
      console.log("SUPABASE DEBUG:")
      const { data, error } = await supabase.from('locations').select('*')
      console.log('data:', data)
      console.log('error:', error)
    }
    testConnection()
  }, [])

  async function fetchRandomLocation() {
    const { data, error } = await supabase
      .from('locations')
      .select('*')

    if (error) console.error(error)

    const random = data[Math.floor(Math.random() * data.length)]
    setLocation(random)
  }

  useEffect(() => {
    fetchRandomLocation()
  }, [])

  return (
    <div>
      {location ? (
        <div>
          <p>"{location.title}"</p>
          <img
            src={location.image_url}
            alt={location.title}
            style={{ width: '500px', height: '400px', objectFit: 'contain' }}
          />
        </div>
      ) : (
        <p>Loading...</p>
      )}
      <button onClick={fetchRandomLocation}>Next Image</button>
      <Map />
    </div>
  );
}