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
    fetchLeaderboard();
  }, [filter, mode]);

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
      .order("score", { ascending: false })
      .limit(20);

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

  return (
    <main style={{ maxWidth: "900px", margin: "40px auto", padding: "20px" }}>
      <h1>Leaderboard</h1>

      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
        <button onClick={() => setMode("normal")}>
          Normal Game
        </button>

        <button onClick={() => setMode("daily")}>
          Daily Challenge
        </button>
      </div>

      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
        <button onClick={() => setFilter("daily")}>
          Daily
        </button>

        <button onClick={() => setFilter("weekly")}>
          Weekly
        </button>

        <button onClick={() => setFilter("monthly")}>
          Monthly
        </button>

        <button onClick={() => setFilter("all")}>
          All Time
        </button>
      </div>

      <p>
        Showing:{" "}
        <strong>{mode === "normal" ? "Normal Game" : "Daily Challenge"}</strong>{" "}
        — <strong>{filter}</strong>
      </p>

      {loading ? (
        <p>Loading leaderboard...</p>
      ) : scores.length === 0 ? (
        <p>No scores yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>
                Rank
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>
                Player
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>
                Score
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "8px" }}>
                Date
              </th>
            </tr>
          </thead>

          <tbody>
            {scores.map((entry, index) => (
              <tr key={entry.id}>
                <td style={{ padding: "8px" }}>{index + 1}</td>
                <td style={{ padding: "8px" }}>{entry.username || entry.email}</td>
                <td style={{ padding: "8px" }}>{entry.score}</td>
                <td style={{ padding: "8px" }}>
                  {new Date(entry.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ marginTop: "2rem" }}>
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}