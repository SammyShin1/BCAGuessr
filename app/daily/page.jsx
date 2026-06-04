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

export default function DailyPage() {
  const [location, setLocation] = useState(null);
  const [score, setScore] = useState(null);
  const [hasGuessed, setHasGuessed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [todayDate, setTodayDate] = useState('');

  // Get daily location based on date
  const getDailyLocation = async () => {
    const { data, error } = await supabase.from('locations').select('*');
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    
    if (data && data.length > 0) {
      // Use date to determine consistent location for all users
      const today = new Date().toISOString().split('T')[0];
      setTodayDate(today);
      
      // Simple hash of today's date to pick a location
      let hash = 0;
      for (let i = 0; i < today.length; i++) {
        hash = ((hash << 5) - hash) + today.charCodeAt(i);
        hash |= 0;
      }
      const dailyIndex = Math.abs(hash) % data.length;
      const dailyLocation = data[dailyIndex];
      setLocation(dailyLocation);
      
      // Check if user already guessed today
      const stored = localStorage.getItem('bcaguessr_daily');
      if (stored) {
        const { date, savedScore } = JSON.parse(stored);
        if (date === today) {
          setScore(savedScore);
          setHasGuessed(true);
        }
      }
    }
    setLoading(false);
  };

  const handleGuess = (guessScore) => {
    if (!hasGuessed) {
      setScore(guessScore);
      setHasGuessed(true);
      // Save to localStorage
      localStorage.setItem('bcaguessr_daily', JSON.stringify({
        date: todayDate,
        savedScore: guessScore
      }));
    }
  };

  useEffect(() => {
    getDailyLocation();
  }, []);

  if (loading) {
    return <div className="loading">Loading daily challenge...</div>;
  }

  if (!location) {
    return <div className="loading">No locations available. Please check your database.</div>;
  }

  return (
    <div style={{ padding: '1rem 0' }}>
      <div className="card">
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Daily Challenge</h2>
        <p style={{ color: '#9ca3af', marginBottom: '1rem' }}>
          {todayDate} • One new location each day
        </p>
        
        <img
          src={location.image_url}
          className="game-image"
        />
        
        <div className="map-container">
          <Map 
            onGuess={handleGuess} 
            location={location}
            showAnswer={hasGuessed}
          />
        </div>
        
        {hasGuessed && (
          <div className="answer-section">
            <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              Your Score: <span className="score-display">{score}</span> / 5000
            </p>
            <p style={{ color: '#9ca3af' }}>
              {score === 5000 ? 'Perfect! Amazing guess!' : score >= 4000 ? 'Great job!' : score >= 2500 ? 'Good effort!' : 'Try again tomorrow for a better score!'}
            </p>
            <div style={{ marginTop: '1rem' }}>
              <Link href="/game">
                <button className="btn btn-primary">Play Full Game</button>
              </Link>
            </div>
          </div>
        )}
        
        {!hasGuessed && (
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '1rem' }}>
            Click on the map to place your guess. You only get one chance today!
          </p>
        )}
      </div>
    </div>
  );
}