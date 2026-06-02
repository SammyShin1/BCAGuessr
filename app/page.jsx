"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import "./globals.css";

export default function HomePage() {
  const router = useRouter();

  async function handleStartPlaying() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      router.push("/login");
      return;
    }

    if (!data.user.email.endsWith("@bergen.org")) {
      await supabase.auth.signOut();
      router.push("/login");
      return;
    }

    router.push("/game");
  }

  async function handleDailyChallenge() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      router.push("/login");
      return;
    }

    if (!data.user.email.endsWith("@bergen.org")) {
      await supabase.auth.signOut();
      router.push("/login");
      return;
    }

    router.push("/daily");
  }

  return (
    <div>
      <div className="hero">
        <h1>BCAGuessr</h1>
        <p style={{ fontSize: "1.25rem", color: "#9ca3af", marginBottom: "2rem" }}>
          Test your geography knowledge! Guess locations based on images.
        </p>

        <button onClick={handleStartPlaying} className="btn btn-primary btn-large">
          Start Playing
        </button>

        <div style={{ marginTop: "1rem", display: "flex", gap: "1rem", justifyContent: "center" }}>
          <Link href="/login">
            <button className="btn">Log In</button>
          </Link>

          <Link href="/signup">
            <button className="btn">Sign Up</button>
          </Link>
        </div>
      </div>

      <div className="feature-grid">
        <div className="feature-card">
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🌍</div>
          <h3>Classic Game</h3>
          <p style={{ color: "#9ca3af" }}>
            5 rounds of location guessing. Score up to 5000 points per round!
          </p>

          <button onClick={handleStartPlaying} className="btn" style={{ marginTop: "1rem" }}>
            Play Now
          </button>
        </div>

        <div className="feature-card">
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⭐</div>
          <h3>Daily Challenge</h3>
          <p style={{ color: "#9ca3af" }}>
            One new location every day. Compete with yourself!
          </p>

          <button onClick={handleDailyChallenge} className="btn" style={{ marginTop: "1rem" }}>
            Daily Challenge
          </button>
        </div>

        <div className="feature-card">
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏆</div>
          <h3>Leaderboard</h3>
          <p style={{ color: "#9ca3af" }}>
            Compete with other players and view top scores.
          </p>

          <Link href="/leaderboard">
            <button className="btn" style={{ marginTop: "1rem" }}>
              View Leaderboard
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}