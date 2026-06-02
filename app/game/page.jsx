'use client';

import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import '../globals.css'

const Map = dynamic(() => import('../../components/Map'), {
  ssr: false,
  loading: () => <p className="loading">Loading map...</p>
});

export default function GamePage() {
  const [location, setLocation] = useState(null);
  const [round, setRound] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [lastScore, setLastScore] = useState(0);
  const [roundOver, setRoundOver] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [userGuess, setUserGuess] = useState(null); // Store guess coordinates and score
  const TOTAL_ROUNDS = 5;

  async function fetchRandomLocation() {
    const { data, error } = await supabase
      .from('locations')
      .select('*, latitude, longitude');
    if (error) console.error(error);
    if (data && data.length > 0) {
      const random = data[Math.floor(Math.random() * data.length)];
      setLocation(random);
    }
  }

  function nextRound(score, guessLat, guessLng) {
    setLastScore(score);
    setTotalScore(prev => prev + score);
    setUserGuess({ lat: guessLat, lng: guessLng, score });
    setRoundOver(true);
  }

  function continueGame() {
    setRoundOver(false);
    setUserGuess(null); // Clear guess for next round
    if (round >= TOTAL_ROUNDS) {
      setGameOver(true);
    } else {
      setRound(prev => prev + 1);
      fetchRandomLocation();
    }
  }

  function resetGame() {
    setRound(1);
    setTotalScore(0);
    setGameOver(false);
    setRoundOver(false);
    setUserGuess(null);
    fetchRandomLocation();
  }

  useEffect(() => {
    fetchRandomLocation();
  }, []);

  if (roundOver) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Round {round} Complete!</h2>
          <p style={{ fontSize: '1.5rem', margin: '0.5rem 0' }}>
            Score: <span className="score-display">{lastScore}</span> / 5000
          </p>
          <p style={{ color: '#9ca3af', marginBottom: '1rem' }}>
            Total: {totalScore} / {round * 5000}
          </p>
          <div className="map-container">
            <Map 
              showAnswer={true} 
              location={location} 
              userGuess={userGuess}  // Pass the guess to Map
            />
          </div>
          <button onClick={continueGame} className="btn btn-primary" style={{ marginTop: '1rem' }}>
            {round >= TOTAL_ROUNDS ? 'See Final Score' : 'Next Round'}
          </button>
        </div>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>Game Over!</h1>
          <p style={{ fontSize: '1.5rem', margin: '1rem 0' }}>
            Total Score: <span className="score-display">{totalScore}</span> / {TOTAL_ROUNDS * 5000}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
            <button onClick={resetGame} className="btn btn-primary">
              Play Again
            </button>
            <Link href="/">
              <button className="btn">Back to Home</button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!location) {
    return <div className="loading">Loading game...</div>;
  }

  return (
    <div style={{ padding: '1rem 0' }}>
      <div className="card">
        <div className="round-header">
          Round {round}/{TOTAL_ROUNDS}
        </div>
        <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>"{location.title}"</p>
        <div className="game-container">
          <img
            src={location.image_url}
            alt={location.title}
            className="game-image"
          />
          <div className="map-container">
            <Map onGuess={nextRound} location={location} />
          </div>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '1rem' }}>
          Click on the map to place your marker, then click Submit. Score is based on distance.
        </p>
      </div>
    </div>
  );
}