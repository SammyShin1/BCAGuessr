'use client';

import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

const Map = dynamic(() => import('../../components/Map'), {
  ssr: false,
  loading: () => <p>Loading map...</p>
});

export default function Page() {
  const [location, setLocation] = useState(null)
  const [round, setRound] = useState(1)
  const [totalScore, setTotalScore] = useState(0)
  const [lastScore, setLastScore] = useState(0)
  const [roundOver, setRoundOver] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const TOTAL_ROUNDS = 5

  // useEffect(() => {
  //   async function testConnection() {
  //     console.log("SUPABASE DEBUG:")
  //     const { data, error } = await supabase.from('locations').select('*')
  //     console.log('data:', data)
  //     console.log('error:', error)
  //   }
  //   testConnection()
  // }, [])

  function nextRound(score) {
    setLastScore(score)
    setTotalScore(prev => prev + score)
    setRoundOver(true)
  }

  function continueGame() {
    setRoundOver(false)
    if (round >= TOTAL_ROUNDS) {
      setGameOver(true)
    } else {
      setRound(prev => prev + 1)
      fetchRandomLocation()
    }
  }

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

  if (roundOver) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#111', color: 'white' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '8px' }}>Round {round} Complete!</h2>
        <p style={{ fontSize: '1.5rem', margin: '8px 0' }}>Score: {lastScore} / 5000</p>
        <p style={{ fontSize: '1rem', color: '#9ca3af', marginBottom: '16px' }}>Total: {totalScore} / {round * 5000}</p>

        <div style={{ width: '100%', height: '400px' }}>
          <Map showAnswer={true} location={location} />
        </div>

        <button onClick={continueGame}
          style={{ marginTop: '16px', marginBottom: '16px', padding: '12px 32px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '999px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>
          {round >= TOTAL_ROUNDS ? 'See Final Score' : 'Next Round'}
        </button>
      </div>
    )
  }

  if (gameOver) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#111', color: 'white' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Game Over!</h1>
        <p style={{ fontSize: '1.5rem', margin: '16px 0' }}>Total Score: {totalScore} / {TOTAL_ROUNDS * 5000}</p>
        <button onClick={() => { setRound(1); setTotalScore(0); setGameOver(false); fetchRandomLocation(); }}
          style={{ padding: '12px 32px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '999px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>
          Play Again
        </button>
      </div>
    )
  }

  return (
    <div>
      <h2>Round {round}/{TOTAL_ROUNDS}</h2>

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
      <Map onGuess={nextRound} location={location} />
    </div>
  );
}