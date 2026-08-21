'use client';

import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { recencyWeight, weightedSampleWithoutReplacement } from '../../lib/randomize';
import '../globals.css';

const DynamicMap = dynamic(() => import('../../components/Map'), {
  ssr: false,
  loading: () => <p className="loading">Loading map...</p>
});

const TOTAL_ROUNDS = 5;
const ROUND_COMPLETION_STATE_KEY = 'bcaguessr_round_completion';

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
    router.push('/');
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

    if (candidates.length <= count) {
      // Not enough candidates to meaningfully weight/sample — just shuffle
      // what we have so the small pool doesn't always appear in the same order.
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      return candidates.slice(0, count);
    }

    // Favor more recently added locations, without ever fully excluding older ones.
    const now = Date.now();
    const weights = candidates.map((loc) => recencyWeight(loc.created_at, now));
    return weightedSampleWithoutReplacement(candidates, weights, count);
  }

  async function fetchLocationsByIds(ids = []) {
    const uniqueIds = Array.from(new Set(ids)).filter((id) => id !== null && id !== undefined);
    if (!uniqueIds.length) return [];

    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .in('id', uniqueIds);

    if (error) {
      console.error('fetchLocationsByIds error', error);
      return [];
    }

    const locationById = new Map((data || []).map((item) => [item.id, item]));
    return uniqueIds.map((id) => locationById.get(id)).filter(Boolean);
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

  async function createSession(userId, firstLocation, locationIds = [firstLocation.id]) {
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
        location_ids: locationIds,
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

  function nextRound(score, guessLat, guessLng, guessFloor) {
    const nextTotal = totalScore + score;
    const nextGuess = { lat: guessLat, lng: guessLng, floor: guessFloor, score };
    setLastScore(score);
    setTotalScore(nextTotal);
    setUserGuess(nextGuess);
    setRoundOver(true);
    saveRoundCompletionState(sessionId, round, nextTotal, score, nextGuess);
  }

  async function continueGame() {
    clearRoundCompletionState();
    setRoundOver(false);
    const newTotal = totalScore;
    let activeSessionId = sessionId;

    if (!activeSessionId) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        console.error('Unable to create game session: user not logged in.');
        return;
      }

      const session = await createSession(
        userData.user.id,
        location,
        preloadedLocations.length ? preloadedLocations.map((item) => item.id) : [location.id]
      );
      if (!session) return;
      activeSessionId = session.id;
      setSessionId(activeSessionId);
    }

    if (round >= TOTAL_ROUNDS) {
      await saveScore(newTotal, 'normal');
      await updateSession(activeSessionId, { status: 'complete', total_score: newTotal });
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

      await updateSession(activeSessionId, {
        round: newRound,
        total_score: newTotal,
        current_location_id: newLocation.id,
        location_ids: preloadedLocations.length ? preloadedLocations.map((item) => item.id) : newUsedIds,
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
    const session = await createSession(userData.user.id, firstLocation, preloaded.map((item) => item.id));
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

        const storedIds = existingSession.location_ids || [];
        const idsWithoutCurrent = storedIds.filter((id) => String(id) !== String(existingSession.current_location_id));
        const currentIndex = Math.max(0, Math.min(existingSession.round - 1, idsWithoutCurrent.length));
        const orderedIds = [
          ...idsWithoutCurrent.slice(0, currentIndex),
          existingSession.current_location_id,
          ...idsWithoutCurrent.slice(currentIndex),
        ];
        const orderedStoredLocations = await fetchLocationsByIds(orderedIds);
        const needed = Math.max(0, TOTAL_ROUNDS - orderedStoredLocations.length);
        const extras = await fetchUniqueLocations(needed, orderedIds);
        const preloaded = [...orderedStoredLocations, ...extras];
        const currentLocation = orderedStoredLocations.find((item) => item.id === existingSession.current_location_id) || locationData;

        await preloadImages(preloaded);
        setPreloadedLocations(preloaded);
        setUsedLocationIds(preloaded.map((p) => p.id));
        setLocation(currentLocation);

        if (extras.length > 0) {
          await updateSession(existingSession.id, {
            location_ids: preloaded.map((item) => item.id),
          });
        }

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
        const session = await createSession(data.user.id, firstLocation, preloaded.map((item) => item.id));
        if (!session) return;

        setSessionId(session.id);
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '2rem' }}>Round {round} Complete!</h2>
              <button onClick={handleReturnHome} className="btn">Return Home</button>
            </div>
            <p style={{ fontSize: '1.5rem', margin: '0.5rem 0' }}>
              Score: <span className="score-display">{lastScore}</span> / 5000
            </p>
            <p style={{ color: '#9ca3af', marginBottom: '1rem' }}>
              Total: {totalScore} / {round * 5000}
            </p>
            <p className="answer-floor">
              Correct floor: <strong>{formatFloor(location.level)}</strong>
            </p>
            <div className="game-container">
              <img
                src={location.image_url}
                className="game-image"
                alt="Location clue"
              />
              <div className="map-container">
                <DynamicMap
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

  const difficultyInfo = getDifficultyInfo(location.difficulty);

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
              <DynamicMap onGuess={nextRound} location={location} />
            </div>
          </div>
          <p className={`difficulty-text ${difficultyInfo.className}`}>
            {difficultyInfo.label}
          </p>
        </div>
      </div>
    </>
  );
}