"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import "./globals.css";

const ADMIN_EMAILS = new Set([
  "jerche28@bergen.org",
  "samshi28@bergen.org",
  "sambas28@bergen.org",
]);

function getNewGamePath() {
  return `/game?new=${Date.now()}`;
}

function ContinueModal({ onContinue, onNewGame }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-dialog card">
        <h3>Resume Game?</h3>
        <p className="modal-copy">
          You have an unfinished game in progress.
        </p>
        <div className="modal-actions">
          <button onClick={onContinue} className="btn btn-primary">Continue</button>
          <button onClick={onNewGame} className="btn">New Game</button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [user, setUser] = useState(null);

  const getActiveNormalSession = useCallback(async function getActiveNormalSession(userId) {
    const { data } = await supabase
      .from("game_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("mode", "normal")
      .maybeSingle();

    return data || null;
  }, []);

  async function checkAuthOrRedirect() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) { router.push("/login"); return null; }
    if (!data.user.email.endsWith("@bergen.org")) {
      await supabase.auth.signOut();
      router.push("/login");
      return null;
    }
    return data.user;
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setActiveSessionId(null);
  }

  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        setUser(data.user);
        const existingSession = await getActiveNormalSession(data.user.id);
        setActiveSessionId(existingSession?.id || null);
      }
    }
    loadUser();
  }, [getActiveNormalSession]);

  async function handleStartPlaying() {
    const user = await checkAuthOrRedirect();
    if (!user) return;

    const existingSession = await getActiveNormalSession(user.id);

    if (existingSession) {
      setPendingSessionId(existingSession.id);
      setActiveSessionId(existingSession.id);
      setShowModal(true);
    } else {
      setActiveSessionId(null);
      router.push(getNewGamePath());
    }
  }

  async function handleClassicNewGame() {
    const user = await checkAuthOrRedirect();
    if (!user) return;

    const existingSession = await getActiveNormalSession(user.id);
    if (existingSession) {
      await supabase
        .from("game_sessions")
        .update({ status: "complete" })
        .eq("id", existingSession.id);
    }

    setActiveSessionId(null);
    router.push(getNewGamePath());
  }

  async function handleClassicContinue() {
    if (!activeSessionId) return;

    const user = await checkAuthOrRedirect();
    if (!user) return;

    const existingSession = await getActiveNormalSession(user.id);
    if (!existingSession) {
      setActiveSessionId(null);
      return;
    }

    setActiveSessionId(existingSession.id);
    router.push("/game");
  }

  async function handleDailyChallenge() {
    const user = await checkAuthOrRedirect();
    if (!user) return;
    router.push("/daily");
  }

  async function handleSubmitLocation() {
    const user = await checkAuthOrRedirect();
    if (!user) return;
    router.push("/submit");
  }

  async function handleNewGame() {
    if (pendingSessionId) {
      await supabase
        .from("game_sessions")
        .update({ status: "complete" })
        .eq("id", pendingSessionId);
    }
    setShowModal(false);
    setPendingSessionId(null);
    setActiveSessionId(null);
    router.push(getNewGamePath());
  }

  function handleContinue() {
    setShowModal(false);
    setPendingSessionId(null);
    if (pendingSessionId) {
      setActiveSessionId(pendingSessionId);
    }
    router.push("/game");
  }

  return (
    <div>
      {showModal && (
        <ContinueModal
          onContinue={handleContinue}
          onNewGame={handleNewGame}
        />
      )}

      <section className="hero">
        <div className="hero-logo-wrapper">
          <img src="/bcaguessr-logo.png" alt="BCAGuessr logo" className="hero-logo" />
        </div>

        <div className="hero-content">
          <div className="hero-text">
            <h1>BCAGuessr</h1>
            <p className="hero-copy">
              Guess the location of images around BCA and see how well you know the building
            </p>
          </div>

          <div className="home-actions">
            <button onClick={handleStartPlaying} className="btn btn-primary btn-large">
              Start Playing
            </button>
            <button onClick={handleDailyChallenge} className="btn btn-large">
              Daily Challenge
            </button>
            <Link href="/lobby">
              <button className="btn btn-large">
                Private Lobby
              </button>
            </Link>
          </div>

          <div className="user-strip">
            {user ? (
              <>
                <span>
                  Logged in as: {user.email || user.user_metadata?.full_name || "User"}
                </span>
                <button onClick={handleSubmitLocation} className="btn">Submit a Location</button>
                {ADMIN_EMAILS.has(user.email?.toLowerCase()) && (
                  <Link href="/admin">
                    <button className="btn">Admin</button>
                  </Link>
                )}
                <button onClick={handleLogout} className="btn">Log Out</button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <button className="btn">Log In</button>
                </Link>
                <Link href="/signup">
                  <button className="btn">Sign Up</button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 640px) {
          .hero {
            flex-direction: column !important;
            align-items: center !important;
          }
          .hero-logo-wrapper {
            order: -1;
            width: 100%;
            display: flex;
            justify-content: center;
            margin-bottom: 1rem;
          }
          .hero-content {
            width: 100%;
            text-align: center;
            align-items: center;
          }
        }
      `}</style>

      <div className="feature-grid">
        <div className="feature-card">
          <h3>Classic</h3>
          <p>
            5 rounds, 5000 points per round
          </p>
          <div className="feature-actions">
            <button onClick={handleClassicNewGame} className="btn btn-primary">
              New Game
            </button>
            <button onClick={handleClassicContinue} className="btn" disabled={!activeSessionId}>
              Continue
            </button>
          </div>
        </div>

        <div className="feature-card">
          <h3>Daily</h3>
          <p>
            One new location every day
          </p>
          <button onClick={handleDailyChallenge} className="btn">
            Play Now
          </button>
        </div>

        <div className="feature-card">
          <h3>Leaderboard</h3>
          <p>
            View top scores
          </p>
          <Link href="/leaderboard" className="btn">
            View Leaderboard
          </Link>
        </div>

        <div className="feature-card">
          <h3>Submit a Location</h3>
          <p>
            Add your own photos
          </p>
          <button onClick={handleSubmitLocation} className="btn">
            Submit a Location
          </button>
        </div>
      </div>
    </div>
  );
}
