"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import "../../globals.css";

export default function LobbyRoomPage() {
  const { lobbyId } = useParams();
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [players, setPlayers] = useState([]);
  const [message, setMessage] = useState("");

  async function loadLobby() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    setUser(userData.user);

    const { data: lobbyData, error: lobbyError } = await supabase
      .from("private_lobbies")
      .select("*")
      .eq("id", lobbyId)
      .single();

    if (lobbyError || !lobbyData) {
      setMessage("Lobby not found.");
      return;
    }

    setLobby(lobbyData);

    const { data: playerData } = await supabase
      .from("private_lobby_players")
      .select("*")
      .eq("lobby_id", lobbyId)
      .order("joined_at", { ascending: true });

    setPlayers(playerData || []);

    if (lobbyData.status === "playing") {
      router.push(`/private-game/${lobbyId}`);
    }

    if (lobbyData.status === "complete") {
      router.push(`/private-game/${lobbyId}/results`);
    }
  }

  async function startGame() {
    const { data: locations, error } = await supabase
      .from("locations")
      .select("*");

    if (error || !locations || locations.length === 0) {
      setMessage("No locations found.");
      return;
    }

    const shuffled = [...locations].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 5);
    const firstLocation = selected[0];

    const { error: updateError } = await supabase
      .from("private_lobbies")
      .update({
        status: "playing",
        round: 1,
        total_rounds: 5,
        current_location_id: firstLocation.id,
        location_ids: selected.map((location) => location.id),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lobbyId);

    if (updateError) {
      setMessage(updateError.message);
      return;
    }

    router.push(`/private-game/${lobbyId}`);
  }

  useEffect(() => {
    if (!lobbyId) return;

    queueMicrotask(() => {
      loadLobby();
    });

    const interval = setInterval(() => {
      console.log("polling lobby...");
      loadLobby();
    }, 1500);

    const channel = supabase
      .channel(`lobby-room-${lobbyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "private_lobby_players",
          filter: `lobby_id=eq.${lobbyId}`,
        },
        () => loadLobby()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "private_lobbies",
          filter: `id=eq.${lobbyId}`,
        },
        () => loadLobby()
      )
      .subscribe((status) => {
        console.log("LOBBY REALTIME STATUS:", status);
      });

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [lobbyId, router]);

  if (!lobby) {
    return <p className="loading">Loading lobby...</p>;
  }

  const isHost = user?.id === lobby.host_id;

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Private Lobby</h1>

        <p className="form-message">
          Lobby Code: <strong>{lobby.code}</strong>
        </p>

        <h3 style={{ marginTop: "1rem" }}>Players</h3>

        <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.5rem" }}>
          {players.map((player) => (
            <div key={player.id} className="card">
              {player.username || player.email}
              {player.user_id === lobby.host_id ? " 👑" : ""}
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            onClick={startGame}
            className="btn btn-primary"
            style={{ marginTop: "1rem" }}
          >
            Start Game
          </button>
        ) : (
          <p className="form-message">Waiting for the host to start...</p>
        )}

        {message && <p className="form-message">{message}</p>}
      </div>
    </main>
  );
}
