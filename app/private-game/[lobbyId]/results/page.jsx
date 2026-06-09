"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import "../../../globals.css";

export default function PrivateResultsPage() {
  const { lobbyId } = useParams();
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    async function loadResults() {
      const { data } = await supabase
        .from("private_lobby_players")
        .select("*")
        .eq("lobby_id", lobbyId)
        .order("score", { ascending: false });

      setPlayers(data || []);
    }

    loadResults();
  }, [lobbyId]);

  return (
    <main className="leaderboard-page">
      <div className="page-header">
        <div>
          <h1>Private Lobby Results</h1>
          <p>Final scores for this private game.</p>
        </div>

        <Link href="/" className="btn">Home</Link>
      </div>

      <div className="table-shell">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Score</th>
            </tr>
          </thead>

          <tbody>
            {players.map((player, index) => (
              <tr key={player.id}>
                <td>{index + 1}</td>
                <td>{player.username || player.email}</td>
                <td>{player.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}