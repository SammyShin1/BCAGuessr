"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import "./globals.css";

const ADMIN_EMAILS = new Set([
  "jerche28@bergen.org",
  "samshi28@bergen.org",
  "sambas28@bergen.org",
]);

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
  const [user, setUser] = useState(null);

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
  }

  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        setUser(data.user);
      }
    }
    loadUser();
  }, []);

  async function handleStartPlaying() {
    const user = await checkAuthOrRedirect();
    if (!user) return;

    const { data: existingSession } = await supabase
      .from("game_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("mode", "normal")
      .single();

    if (existingSession) {
      setPendingSessionId(existingSession.id);
      setShowModal(true);
    } else {
      router.push("/game");
    }
  }

  async function handleDailyChallenge() {
    const user = await checkAuthOrRedirect();
    if (!user) return;
    router.push("/daily");
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
    router.push("/game");
  }

  function handleContinue() {
    setShowModal(false);
    setPendingSessionId(null);
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
        <div className="hero-content">
          <div className="hero-kicker">Bergen County Academies</div>
          <h1>BCAGuessr</h1>
          <p className="hero-copy">
            Place each photo on the BCA map and see how well you know the building.
          </p>

          <div className="home-actions">
            <button onClick={handleStartPlaying} className="btn btn-primary btn-large">
              Start Playing
            </button>
            <button onClick={handleDailyChallenge} className="btn btn-large">
              Daily Challenge
            </button>
          </div>

          <div className="user-strip">
          {user ? (
            <>
              <span>
                Logged in as: {user.email || user.user_metadata?.full_name || "User"}
              </span>
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

      <div className="feature-grid">
        <div className="feature-card">
          <span className="feature-index">01</span>
          <h3>Classic Game</h3>
          <p>
            5 rounds of location guessing. Score up to 5000 points per round!
          </p>
          <button onClick={handleStartPlaying} className="btn">
            Play Now
          </button>
        </div>

        <div className="feature-card">
          <span className="feature-index">02</span>
          <h3>Daily Challenge</h3>
          <p>
            One new location every day. Compete with yourself!
          </p>
          <button onClick={handleDailyChallenge} className="btn">
            Daily Challenge
          </button>
        </div>

        <div className="feature-card">
          <span className="feature-index">03</span>
          <h3>Leaderboard</h3>
          <p>
            Compete with other players and view top scores.
          </p>
          <Link href="/leaderboard">
            <button className="btn">
              View Leaderboard
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
