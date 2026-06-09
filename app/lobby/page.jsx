"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import "../globals.css";

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function LobbyPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function getUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      router.push("/login");
      return null;
    }

    if (!data.user.email.endsWith("@bergen.org")) {
      await supabase.auth.signOut();
      router.push("/login");
      return null;
    }

    return data.user;
  }

  async function createLobby() {
    setLoading(true);
    setMessage("");

    const user = await getUser();
    if (!user) return;

    const code = generateCode();

    const { data: lobby, error: lobbyError } = await supabase
      .from("private_lobbies")
      .insert({
        code,
        host_id: user.id,
      })
      .select()
      .single();

    if (lobbyError) {
      setMessage(lobbyError.message);
      setLoading(false);
      return;
    }

    await supabase.from("private_lobby_players").insert({
      lobby_id: lobby.id,
      user_id: user.id,
      email: user.email,
      username: user.email.split("@")[0],
    });

    router.push(`/lobby/${lobby.id}`);
  }

  async function joinLobby(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const user = await getUser();
    if (!user) return;

    const cleanedCode = joinCode.trim().toUpperCase();

    const { data: lobby, error: lobbyError } = await supabase
      .from("private_lobbies")
      .select("*")
      .eq("code", cleanedCode)
      .single();

    if (lobbyError || !lobby) {
      setMessage("Lobby not found.");
      setLoading(false);
      return;
    }

    if (lobby.status !== "waiting") {
      setMessage("This lobby has already started.");
      setLoading(false);
      return;
    }

    const { error: playerError } = await supabase
      .from("private_lobby_players")
      .upsert({
        lobby_id: lobby.id,
        user_id: user.id,
        email: user.email,
        username: user.email.split("@")[0],
      }, {
        onConflict: "lobby_id,user_id",
      });

    if (playerError) {
      setMessage(playerError.message);
      setLoading(false);
      return;
    }

    router.push(`/lobby/${lobby.id}`);
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Private Lobby</h1>

        <button onClick={createLobby} className="btn btn-primary" disabled={loading}>
          Create Lobby
        </button>

        <form className="auth-form" onSubmit={joinLobby} style={{ marginTop: "1rem" }}>
          <div className="form-row">
            <label>Join with code</label>
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="ABC123"
              required
            />
          </div>

          <button className="btn" type="submit" disabled={loading}>
            Join Lobby
          </button>
        </form>

        {message && <p className="form-message">{message}</p>}
      </div>
    </main>
  );
}