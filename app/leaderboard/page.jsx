"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";

export default function LeaderboardPage() {
  const [scores, setScores] = useState([]);
  const [filter, setFilter] = useState("all");
  const [mode, setMode] = useState("normal");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function getStartDate() {
      const now = new Date();

      if (filter === "daily") {
        now.setHours(0, 0, 0, 0);
        return now.toISOString();
      }

      if (filter === "weekly") {
        const day = now.getDay();
        const diff = now.getDate() - day;
        now.setDate(diff);
        now.setHours(0, 0, 0, 0);
        return now.toISOString();
      }

      if (filter === "monthly") {
        now.setDate(1);
        now.setHours(0, 0, 0, 0);
        return now.toISOString();
      }

      return null;
    }

    async function fetchLeaderboard() {
      setLoading(true);

      let query = supabase
        .from("leaderboard")
        .select("*")
        .eq("mode", mode)
        .order("score", { ascending: false });

      if (mode === "daily") {
        query = query.order("created_at", { ascending: true });
      }

      query = query.limit(20);

      const startDate = getStartDate();

      if (startDate) {
        query = query.gte("created_at", startDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching leaderboard:", error);
        setScores([]);
      } else {
        setScores(data);
      }

      setLoading(false);
    }

    fetchLeaderboard();
  }, [filter, mode]);

  return (
    <main className="leaderboard-page">
      <div className="page-header">
        <div>
          <h1>Leaderboard</h1>
          <p>Top scores across BCA location challenges.</p>
        </div>
        <Link href="/" className="btn">Home</Link>
      </div>

      <div className="segmented">
        <button
          className={`segment-btn ${mode === "normal" ? "active" : ""}`}
          onClick={() => setMode("normal")}
        >
          Normal Game
        </button>

        <button
          className={`segment-btn ${mode === "daily" ? "active" : ""}`}
          onClick={() => setMode("daily")}
        >
          Daily Challenge
        </button>
      </div>

      <div className="segmented">
        <button
          className={`segment-btn ${filter === "daily" ? "active" : ""}`}
          onClick={() => setFilter("daily")}
        >
          Daily
        </button>

        <button
          className={`segment-btn ${filter === "weekly" ? "active" : ""}`}
          onClick={() => setFilter("weekly")}
        >
          Weekly
        </button>

        <button
          className={`segment-btn ${filter === "monthly" ? "active" : ""}`}
          onClick={() => setFilter("monthly")}
        >
          Monthly
        </button>

        <button
          className={`segment-btn ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All Time
        </button>
      </div>

      <p className="leaderboard-summary">
        <strong>{mode === "normal" ? "Normal Game" : "Daily Challenge"}</strong>{" "}
        · <strong>{filter}</strong>
      </p>

      {loading ? (
        <p className="loading">Loading leaderboard...</p>
      ) : scores.length === 0 ? (
        <p className="empty-state">No scores yet.</p>
      ) : (
        <div className="table-shell">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Score</th>
                <th>Date</th>
                {mode === "daily" && <th>Time</th>}
              </tr>
            </thead>

            <tbody>
              {scores.map((entry, index) => (
                <tr key={entry.id}>
                  <td>{index + 1}</td>
                  <td>{entry.username || entry.email}</td>
                  <td>{entry.score}</td>
                  <td>
                    {new Date(entry.created_at).toLocaleDateString()}
                  </td>
                  {mode === "daily" && (
                    <td>
                      {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
