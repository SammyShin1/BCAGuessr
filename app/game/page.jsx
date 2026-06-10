'use client';

import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import '../globals.css';

const Map = dynamic(() => import('../../components/Map'), {
  ssr: false,
  loading: () => <p className="loading">Loading map...</p>
});

const TOTAL_ROUNDS = 5;
const ROUND_COMPLETION_STATE_KEY = 'bcaguessr_round_completion';

function LeaveModal({ onStay, onLeave, round }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-dialog card">
        <h3>Leave this game?</h3>
        <p className="modal-copy">
          {round === 1
            ? "You haven't finished round 1 yet. Leaving now will abandon this game."
            : "You have a game already in progress. Returning home will keep your session available to resume later."}
        </p>
        <div className="modal-actions">
          <button onClick={onStay} className="btn btn-primary">Stay</button>
          <button onClick={onLeave} className="btn">Return Home</button>
        </div>
      </div>
    </div>
  );
}

export default function GamePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [location, setLocation] = useState(null);
  const [round, setRound] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [lastScore, setLastScore] = useState(0);
  const [roundOver, setRoundOver] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [userGuess, setUserGuess] = useState(null);
  const [usedLocationIds, setUsedLocationIds] = useState([]);
  const [preloadedLocations, setPreloadedLocations] = useState([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const saveRoundCompletionState = (sessionId, round, totalScore, lastScore, userGuess) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ROUND_COMPLETION_STATE_KEY, JSON.stringify({
      sessionId,
      round,
      totalScore,
      lastScore,
      userGuess,
    }));
  };

  const loadRoundCompletionState = () => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(ROUND_COMPLETION_STATE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const clearRoundCompletionState = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ROUND_COMPLETION_STATE_KEY);
  };

  const handleReturnHome = () => {
    setShowLeaveModal(true);
  };

  const handleLeaveConfirmed = () => {
    setShowLeaveModal(false);
    router.push('/');
  };

  const handleStay = () => {
    setShowLeaveModal(false);
  };

  async function fetchUniqueLocations(count = 5, excludeIds = []) {
    const { data, error } = await supabase.from('locations').select('*');
    if (error) { console.error('fetchUniqueLocations error', error); return [] }
    let candidates = data || [];
    if (excludeIds.length) {
      const excludeSet = new Set(excludeIds);
      candidates = candidates.filter((c) => !excludeSet.has(c.id));
    }

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    return candidates.slice(0, count);
  }

  function preloadImages(locations = []) {
    return Promise.all(locations.map((loc) => new Promise((res) => {
      if (!loc?.image_url) return res();
      const img = new Image();
      img.onload = () => res();
      img.onerror = () => res();
      img.src = loc.image_url;
    })));
  }

  async function createSession(userId, firstLocation) {
    const { data: existing } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) return existing;

    const { data, error } = await supabase
      .from('game_sessions')
      .insert({
        user_id: userId,
        round: 1,
        total_score: 0,
        current_location_id: firstLocation.id,
        location_ids: [firstLocation.id],
        status: 'active',
        mode: 'normal',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: raceWinner } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single();
        return raceWinner;
      }
      console.error('Error creating session:', error);
      return null;
    }
    return data;
  }

  async function updateSession(id, updates) {
    const { error } = await supabase
      .from('game_sessions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) console.error('Error updating session:', error);
  }

  async function saveScore(finalScore, mode = 'normal') {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) { console.error('No logged-in user found:', userError); return; }
    const { error } = await supabase.from('leaderboard').insert({
      user_id: userData.user.id,
      email: userData.user.email,
      username: userData.user.email.split('@')[0],
      score: finalScore,
      mode,
      challenge_date: mode === 'daily' ? new Date().toISOString().split('T')[0] : null,
    });
    if (error) console.error('Error saving score:', error);
  }

  function nextRound(score, guessLat, guessLng) {
    const nextTotal = totalScore + score;
    setLastScore(score);
    setTotalScore(nextTotal);
    setUserGuess({ lat: guessLat, lng: guessLng, score });
    setRoundOver(true);
    saveRoundCompletionState(sessionId, round, nextTotal, score, { lat: guessLat, lng: guessLng, score });
  }

  async function continueGame() {
    clearRoundCompletionState();
    setRoundOver(false);
    const newTotal = totalScore;

    if (!sessionId) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        console.error('Unable to create game session: user not logged in.');
        return;
      }

      const session = await createSession(userData.user.id, location);
      if (!session) return;
      setSessionId(session.id);
    }

    if (round >= TOTAL_ROUNDS) {
      await saveScore(newTotal, 'normal');
      await updateSession(sessionId, { status: 'complete', total_score: newTotal });
      setGameOver(true);
    } else {
      const newRound = round + 1;
      let newLocation = null;
      if (preloadedLocations && preloadedLocations.length >= newRound) {
        newLocation = preloadedLocations[newRound - 1];
      }
      if (!newLocation) {
        console.error('No preloaded location available for round', newRound);
        return;
      }

      const newUsedIds = Array.from(new Set([...usedLocationIds, newLocation.id]));
      setUsedLocationIds(newUsedIds);
      setRound(newRound);
      setTotalScore(newTotal);
      setLocation(newLocation);
      setUserGuess(null);

      await updateSession(sessionId, {
        round: newRound,
        total_score: newTotal,
        current_location_id: newLocation.id,
        location_ids: newUsedIds,
      });
    }
  }

  async function resetGame() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    if (sessionId) {
      await updateSession(sessionId, { status: 'complete' });
    }
    clearRoundCompletionState();

    const preloaded = await fetchUniqueLocations(TOTAL_ROUNDS, []);
    if (!preloaded || preloaded.length === 0) return;
    await preloadImages(preloaded);

    const firstLocation = preloaded[0];
    const session = await createSession(userData.user.id, firstLocation);
    if (!session) return;

    setSessionId(session.id);
    setPreloadedLocations(preloaded);
    setRound(1);
    setTotalScore(0);
    setLastScore(0);
    setGameOver(false);
    setRoundOver(false);
    setUserGuess(null);
    setUsedLocationIds(preloaded.map((p) => p.id));
    setLocation(firstLocation);
  }

  useEffect(() => {
    async function init() {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) { router.push('/login'); return; }
      if (!data.user.email.endsWith('@bergen.org')) {
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      const { data: existingSession, error: sessionError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('user_id', data.user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (sessionError) {
        console.error('Error checking active session:', sessionError);
      }

      if (existingSession) {
        const { data: locationData } = await supabase
          .from('locations')
          .select('*')
          .eq('id', existingSession.current_location_id)
          .single();

        const completionState = loadRoundCompletionState();
        const shouldRestoreCompletion = completionState && completionState.sessionId === existingSession.id && completionState.round === existingSession.round;
        const restoredTotalScore = shouldRestoreCompletion ? completionState.totalScore : existingSession.total_score;

        setSessionId(existingSession.id);
        setRound(existingSession.round);
        setTotalScore(restoredTotalScore);

        const existingIds = existingSession.location_ids || [];
        const needed = Math.max(0, TOTAL_ROUNDS - existingIds.length);
        const extras = await fetchUniqueLocations(needed, existingIds);
        const preloaded = [locationData, ...extras];
        await preloadImages(preloaded);
        setPreloadedLocations(preloaded);
        setUsedLocationIds(preloaded.map((p) => p.id));
        setLocation(locationData);

        if (shouldRestoreCompletion) {
          setRoundOver(true);
          setLastScore(completionState.lastScore || 0);
          setUserGuess(completionState.userGuess || null);
        } else {
          setRoundOver(false);
          setLastScore(0);
          setUserGuess(null);
        }
      } else {

        const preloaded = await fetchUniqueLocations(TOTAL_ROUNDS, []);
        if (!preloaded || preloaded.length === 0) return;
        await preloadImages(preloaded);

        const firstLocation = preloaded[0];
        setSessionId(null);
        setPreloadedLocations(preloaded);
        setUsedLocationIds(preloaded.map((p) => p.id));
        setLocation(firstLocation);
      }

      setCheckingAuth(false);
    }

    init();
  }, [router]);

  const leaveModal = showLeaveModal ? (
    <LeaveModal onStay={handleStay} onLeave={handleLeaveConfirmed} round={round} />
  ) : null;

  if (checkingAuth) {
    return (
      <>
        {leaveModal}
        <div className="loading">Checking login...</div>
      </>
    );
  }

  if (roundOver) {
    return (
      <>
        {leaveModal}
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div className="card" style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Round {round} Complete!</h2>
            <p style={{ fontSize: '1.5rem', margin: '0.5rem 0' }}>
              Score: <span className="score-display">{lastScore}</span> / 5000
            </p>
            <p style={{ color: '#9ca3af', marginBottom: '1rem' }}>
              Total: {totalScore} / {round * 5000}
            </p>
            <div className="game-container">
              <img
                src={location.image_url}
                className="game-image"
                alt="Location clue"
              />
              <div className="map-container">
                <Map
                  showAnswer={true}
                  location={location}
                  userGuess={userGuess}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button onClick={continueGame} className="btn btn-primary">
                {round >= TOTAL_ROUNDS ? 'See Final Score' : 'Next Round'}
              </button>
              <button onClick={handleReturnHome} className="btn">Return Home</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (gameOver) {
    return (
      <>
        {leaveModal}
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>Game Over!</h1>
            <p style={{ fontSize: '1.5rem', margin: '1rem 0' }}>
              Total Score: <span className="score-display">{totalScore}</span> / {TOTAL_ROUNDS * 5000}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
              <button onClick={resetGame} className="btn btn-primary">Play Again</button>
              <Link href="/leaderboard"><button className="btn">View Leaderboard</button></Link>
              <Link href="/"><button className="btn">Back to Home</button></Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!location) {
    return (
      <>
        {leaveModal}
        <div className="loading">Loading game...</div>
      </>
    );
  }

  return (
    <>
      {leaveModal}
      <div style={{ padding: '1rem 0' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div className="round-header">
              Round {round}/{TOTAL_ROUNDS}
            </div>
            <button onClick={handleReturnHome} className="btn">Return Home</button>
          </div>
          <div className="game-container">
            <img
              src={location.image_url}
              className="game-image"
              alt="BCA location challenge"
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
    </>
  );
}
