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

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDifficultyInfo(difficulty) {
  const value = Number(difficulty);
  if (!Number.isFinite(value)) {
    return { label: 'Difficulty: Unset', className: 'difficulty-unset' };
  }
  if (value <= 2) return { label: `Difficulty: ${value} - Easy`, className: 'difficulty-easy' };
  if (value === 3) return { label: 'Difficulty: 3 - Medium', className: 'difficulty-medium' };
  return { label: `Difficulty: ${value} - Hard`, className: 'difficulty-hard' };
}

function formatFloor(value) {
  const floor = Number(value);
  if (floor === -1) return 'Outside';
  if (floor === 0) return 'Basement';
  if (floor === 1) return 'Floor 1';
  if (floor === 2) return 'Floor 2';
  return 'Unknown';
}

export default function DailyPage() {
  const [location, setLocation] = useState(null);
  const [score, setScore] = useState(null);
  const [hasGuessed, setHasGuessed] = useState(false);
  const [userGuess, setUserGuess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [todayDate, setTodayDate] = useState('');
  const [resetTimeLeft, setResetTimeLeft] = useState('');
  const [message, setMessage] = useState('');

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
      const today = getLocalDateKey();
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
      setHasGuessed(false);
      setScore(null);
      setUserGuess(null);

      // Check if user already guessed today
      const stored = localStorage.getItem('bcaguessr_daily');
      if (stored) {
        const { date, savedScore, savedGuess } = JSON.parse(stored);
        if (date === today) {
          setScore(savedScore);
          setHasGuessed(true);
          setUserGuess(savedGuess || null);
        }
      }
    }
    setLoading(false);
  };

  const saveDailyScore = async (guessScore) => {
    setMessage('');
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      console.warn('Daily score not saved to leaderboard: no logged-in user.');
      setMessage('Score saved locally. Log in to appear on the leaderboard.');
      return;
    }

    const username = userData.user.email?.split('@')[0] || 'Player';
    const email = userData.user.email || null;
    const userId = userData.user.id;

    const { error } = await supabase.from('leaderboard').insert({
      user_id: userId,
      email,
      username,
      score: guessScore,
      mode: 'daily',
      challenge_date: todayDate,
    });

    if (error) {
      console.error('Error saving daily leaderboard score:', error);
      setMessage('Score saved locally, but leaderboard save failed.');
      return;
    }

    setMessage('Score saved to daily leaderboard.');
  };

  const handleGuess = async (guessScore, guessLat, guessLng, guessFloor) => {
    if (!hasGuessed) {
      const savedGuess = { lat: guessLat, lng: guessLng, floor: guessFloor, score: guessScore };
      setScore(guessScore);
      setHasGuessed(true);
      setUserGuess(savedGuess);
      // Save to localStorage
      localStorage.setItem('bcaguessr_daily', JSON.stringify({
        date: todayDate,
        savedScore: guessScore,
        savedGuess,
      }));
      await saveDailyScore(guessScore);
    }
  };

  const getNextResetTime = () => {
    const now = new Date();
    const nextReset = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return nextReset.getTime() - now.getTime();
  };

  const formatTimeLeft = (milliseconds) => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  useEffect(() => {
    queueMicrotask(() => {
      getDailyLocation();
    });
  }, []);

  useEffect(() => {
    const updateResetTime = () => {
      if (todayDate && getLocalDateKey() !== todayDate) {
        getDailyLocation();
        return;
      }
      setResetTimeLeft(formatTimeLeft(getNextResetTime()));
    };

    queueMicrotask(updateResetTime);
    const interval = setInterval(() => {
      updateResetTime();
    }, 1000);
    return () => clearInterval(interval);
  }, [todayDate]);

  if (loading) {
    return <div className="loading">Loading daily challenge...</div>;
  }

  if (!location) {
    return <div className="loading">No locations available. Please check your database.</div>;
  }

  const difficultyInfo = getDifficultyInfo(location.difficulty);

  return (
    <div style={{ padding: '1rem 0' }}>
      <div className="card">
        <div className="daily-header">
          <div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Daily Challenge</h2>
            <p style={{ color: '#9ca3af', marginBottom: '0.5rem' }}>
              {todayDate} • One new location each day
            </p>
          </div>
          <Link href="/" className="btn">Return Home</Link>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.95rem', marginBottom: '1rem' }}>
          Resets in {resetTimeLeft}
        </p>

        <div className="game-container">
          <img
            src={location.image_url}
            className="game-image"
            alt="Daily challenge location"
          />

          <div className="map-container">
            <Map
              onGuess={handleGuess}
              location={location}
              showAnswer={hasGuessed}
              userGuess={userGuess}
            />
          </div>
        </div>

        {hasGuessed && (
          <div className="answer-section">
            <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              Your Score: <span className="score-display">{score}</span> / 5000
            </p>
            <p style={{ color: '#9ca3af' }}>
              {score === 5000 ? 'Perfect! Amazing guess!' : score >= 4000 ? 'Great job!' : score >= 2500 ? 'Good effort!' : 'Try again tomorrow for a better score!'}
            </p>
            <p className="answer-floor">
              Correct floor: <strong>{formatFloor(location.level)}</strong>
            </p>
            <div style={{ marginTop: '1rem' }}>
              <Link href="/game">
                <button className="btn btn-primary">Play Full Game</button>
              </Link>
            </div>
            {message && (
              <p style={{ marginTop: '1rem', color: '#6b7280', fontSize: '0.95rem' }}>
                {message}
              </p>
            )}
          </div>
        )}

        {!hasGuessed && (
          <p className={`difficulty-text ${difficultyInfo.className}`}>
            {difficultyInfo.label}
          </p>
        )}
      </div>
    </div>
  );
}
