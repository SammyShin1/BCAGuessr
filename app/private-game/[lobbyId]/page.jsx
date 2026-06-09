"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import "../../globals.css";

const Map = dynamic(() => import("../../../components/Map"), {
  ssr: false,
  loading: () => <p className="loading">Loading map...</p>,
});

export default function PrivateGamePage() {
  const { lobbyId } = useParams();
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [location, setLocation] = useState(null);
  const [players, setPlayers] = useState([]);
  const [roundOver, setRoundOver] = useState(false);
  const [lastScore, setLastScore] = useState(0);
  const [userGuess, setUserGuess] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadGame() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    setUser(userData.user);

    const { data: lobbyData } = await supabase
      .from("private_lobbies")
      .select("*")
      .eq("id", lobbyId)
      .single();

    setLobby(lobbyData);

    if (!lobbyData || lobbyData.status !== "playing") {
      router.push(`/lobby/${lobbyId}`);
      return;
    }

    const locationId = lobbyData.location_ids[lobbyData.round - 1];

    const { data: locationData } = await supabase
      .from("locations")
      .select("*")
      .eq("id", locationId)
      .single();

    setLocation(locationData);

    const { data: playerData } = await supabase
      .from("private_lobby_players")
      .select("*")
      .eq("lobby_id", lobbyId)
      .order("score", { ascending: false });

    setPlayers(playerData || []);
    setLoading(false);
  }

  async function handleGuess(score, guessLat, guessLng) {
    if (!user || !lobby) return;

    setLastScore(score);
    setUserGuess({ lat: guessLat, lng: guessLng, score });
    setRoundOver(true);

    const currentPlayer = players.find((player) => player.user_id === user.id);
    const newScore = (currentPlayer?.score || 0) + score;

    await supabase
      .from("private_lobby_players")
      .update({
        score: newScore,
        current_round: lobby.round + 1,
        finished: lobby.round >= lobby.total_rounds,
      })
      .eq("lobby_id", lobbyId)
      .eq("user_id", user.id);
  }

  async function nextRound() {
    if (!lobby || !user) return;

    const isHost = user.id === lobby.host_id;

    if (!isHost) {
      setRoundOver(false);
      await loadGame();
      return;
    }

    if (lobby.round >= lobby.total_rounds) {
      await supabase
        .from("private_lobbies")
        .update({
          status: "complete",
          updated_at: new Date().toISOString(),
        })
        .eq("id", lobbyId);

      router.push(`/private-game/${lobbyId}/results`);
      return;
    }

    await supabase
      .from("private_lobbies")
      .update({
        round: lobby.round + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lobbyId);

    setRoundOver(false);
    await loadGame();
  }

  useEffect(() => {
    loadGame();

    const channel = supabase
      .channel(`private-game-${lobbyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "private_lobby_players",
          filter: `lobby_id=eq.${lobbyId}`,
        },
        () => loadGame()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "private_lobbies",
          filter: `id=eq.${lobbyId}`,
        },
        () => loadGame()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyId]);

  if (loading || !lobby || !location) {
    return <p className="loading">Loading private game...</p>;
  }

  const isHost = user?.id === lobby.host_id;

  if (roundOver) {
    return (
      <main style={{ padding: "1rem" }}>
        <div className="card">
          <h2>Round {lobby.round} Complete!</h2>

          <p style={{ fontSize: "1.4rem", margin: "1rem 0" }}>
            Your Score: <span className="score-display">{lastScore}</span> / 5000
          </p>

          <div className="map-container">
            <Map
              showAnswer={true}
              location={location}
              userGuess={userGuess}
            />
          </div>

          <h3 style={{ marginTop: "1rem" }}>Leaderboard</h3>

          {players.map((player, index) => (
            <p key={player.id}>
              {index + 1}. {player.username || player.email}: {player.score}
            </p>
          ))}

          {isHost ? (
            <button onClick={nextRound} className="btn btn-primary" style={{ marginTop: "1rem" }}>
              {lobby.round >= lobby.total_rounds ? "Finish Game" : "Next Round"}
            </button>
          ) : (
            <p className="form-message">Waiting for host to continue...</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: "1rem" }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h2>Private Game</h2>
          <p>Round {lobby.round}/{lobby.total_rounds}</p>
        </div>

        <div className="game-container">
          <img
            src={location.image_url}
            className="game-image"
            alt="BCA location challenge"
          />

          <div className="map-container">
            <Map onGuess={handleGuess} location={location} />
          </div>
        </div>
      </div>
    </main>
  );
}