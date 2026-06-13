"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const PAGE_SIZE = 20;
const FETCH_BATCH_SIZE = 1000;

function getStartDate(filter) {
  const now = new Date();

  if (filter === "daily") {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }

  if (filter === "weekly") {
    now.setDate(now.getDate() - now.getDay());
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

function getUserKey(entry) {
  return entry.user_id || entry.email?.toLowerCase() || entry.username?.toLowerCase();
}

function keepHighestScores(entries) {
  const bestByUser = new Map();

  for (const entry of entries) {
    const userKey = getUserKey(entry);
    if (!userKey) continue;

    const currentBest = bestByUser.get(userKey);
    const isHigherScore = !currentBest || entry.score > currentBest.score;
    const isEarlierTiedScore =
      currentBest &&
      entry.score === currentBest.score &&
      new Date(entry.created_at) < new Date(currentBest.created_at);

    if (isHigherScore || isEarlierTiedScore) {
      bestByUser.set(userKey, entry);
    }
  }

  return [...bestByUser.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(a.created_at) - new Date(b.created_at);
  });
}

export default function LeaderboardPage() {
  const [scores, setScores] = useState([]);
  const [filter, setFilter] = useState("all");
  const [mode, setMode] = useState("normal");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function fetchLeaderboard() {
      setLoading(true);
      const effectiveFilter = mode === "daily" ? "daily" : filter;
      const startDate = getStartDate(effectiveFilter);
      const allScores = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("leaderboard")
          .select("id, user_id, username, email, score, mode, created_at")
          .eq("mode", mode)
          .order("score", { ascending: false })
          .order("created_at", { ascending: true })
          .range(from, from + FETCH_BATCH_SIZE - 1);

        if (startDate) {
          query = query.gte("created_at", startDate);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error fetching leaderboard:", error);
          if (!ignore) setScores([]);
          break;
        }

        allScores.push(...data);
        hasMore = data.length === FETCH_BATCH_SIZE;
        from += FETCH_BATCH_SIZE;
      }

      if (!ignore) {
        setScores(keepHighestScores(allScores));
        setLoading(false);
      }
    }

    fetchLeaderboard();

    return () => {
      ignore = true;
    };
  }, [filter, mode]);

  const filteredScores = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return scores;

    return scores.filter((entry) =>
      (entry.username || entry.email || "")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [scores, search]);

  const totalPages = Math.max(1, Math.ceil(filteredScores.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleScores = filteredScores.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function resetPage() {
    setPage(1);
    setPageInput("1");
  }

  function goToPage(nextPage) {
    const validPage = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(validPage);
    setPageInput(String(validPage));
  }

  function handlePageSubmit(event) {
    event.preventDefault();
    const requestedPage = Number.parseInt(pageInput, 10);
    goToPage(Number.isNaN(requestedPage) ? currentPage : requestedPage);
  }

  return (
    <main className="leaderboard-page">
      <div className="page-header">
        <div>
          <h1>Leaderboard</h1>
          <p>Each player&apos;s highest-scoring game.</p>
        </div>
        <Link href="/" className="btn">Return Home</Link>
      </div>

      <div className="segmented">
        <button
          className={`segment-btn ${mode === "normal" ? "active" : ""}`}
          onClick={() => {
            setMode("normal");
            resetPage();
          }}
        >
          Normal Game
        </button>

        <button
          className={`segment-btn ${mode === "daily" ? "active" : ""}`}
          onClick={() => {
            setMode("daily");
            setFilter("daily");
            resetPage();
          }}
        >
          Daily Challenge
        </button>
      </div>

      {mode === "normal" && (
        <div className="segmented">
          {["daily", "weekly", "monthly", "all"].map((timeFilter) => (
            <button
              key={timeFilter}
              className={`segment-btn ${filter === timeFilter ? "active" : ""}`}
              onClick={() => {
                setFilter(timeFilter);
                resetPage();
              }}
            >
              {timeFilter === "all"
                ? "All Time"
                : `${timeFilter[0].toUpperCase()}${timeFilter.slice(1)}`}
            </button>
          ))}
        </div>
      )}

      <div className="leaderboard-toolbar">
        <p className="leaderboard-summary">
          <strong>{mode === "normal" ? "Normal Game" : "Daily Challenge"}</strong>
          {mode === "normal" && <> · <strong>{filter}</strong></>}
          {!loading && <> · {filteredScores.length} player{filteredScores.length === 1 ? "" : "s"}</>}
        </p>

        <label className="leaderboard-search">
          <span className="sr-only">Search player names</span>
          <input
            type="search"
            placeholder="Search players..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
          />
        </label>
      </div>

      {loading ? (
        <p className="loading">Loading leaderboard...</p>
      ) : visibleScores.length === 0 ? (
        <p className="empty-state">
          {search ? "No players match that search." : "No scores yet."}
        </p>
      ) : (
        <>
          <div className="table-shell">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Best Score</th>
                  <th>Date</th>
                  {mode === "daily" && <th>Time</th>}
                </tr>
              </thead>

              <tbody>
                {visibleScores.map((entry, index) => (
                  <tr key={getUserKey(entry)}>
                    <td>{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                    <td>{entry.username || entry.email}</td>
                    <td>{entry.score}</td>
                    <td>{new Date(entry.created_at).toLocaleDateString()}</td>
                    {mode === "daily" && (
                      <td>
                        {new Date(entry.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav className="leaderboard-pagination" aria-label="Leaderboard pages">
            <button
              className="btn"
              disabled={currentPage === 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              Back
            </button>

            <form className="page-jump" onSubmit={handlePageSubmit}>
              <label htmlFor="leaderboard-page-input">Page</label>
              <input
                id="leaderboard-page-input"
                type="number"
                min="1"
                max={totalPages}
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                onBlur={() => {
                  if (!pageInput) setPageInput(String(currentPage));
                }}
              />
              <span>of {totalPages}</span>
              <button className="btn" type="submit">Go</button>
            </form>

            <button
              className="btn"
              disabled={currentPage === totalPages}
              onClick={() => goToPage(currentPage + 1)}
            >
              Forward
            </button>
          </nav>
        </>
      )}
    </main>
  );
}
