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
  const [message, setMessage] = useState("");

  async function loadGame() {
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
      setLoading(false);
      return;
    }

    setLobby(lobbyData);

    if (lobbyData.status === "complete") {
      router.push(`/private-game/${lobbyId}/results`);
      return;
    }

    if (lobbyData.status !== "playing") {
      router.push(`/lobby/${lobbyId}`);
      return;
    }

    const locationId = lobbyData.location_ids?.[lobbyData.round - 1];

    if (!locationId) {
      setMessage("No location found for this round.");
      setLoading(false);
      return;
    }

    const { data: locationData, error: locationError } = await supabase
      .from("locations")
      .select("*")
      .eq("id", locationId)
      .single();

    if (locationError || !locationData) {
      setMessage("Could not load location.");
      setLoading(false);
      return;
    }

    setLocation(locationData);

    const { data: playerData } = await supabase
      .from("private_lobby_players")
      .select("*")
      .eq("lobby_id", lobbyId)
      .order("score", { ascending: false });

    setPlayers(playerData || []);

    const { data: existingGuess } = await supabase
      .from("private_lobby_guesses")
      .select("*")
      .eq("lobby_id", lobbyId)
      .eq("user_id", userData.user.id)
      .eq("round", lobbyData.round)
      .maybeSingle();

    if (existingGuess) {
      setRoundOver(true);
      setLastScore(existingGuess.score);
      setUserGuess({
        lat: existingGuess.guess_lat,
        lng: existingGuess.guess_lng,
        score: existingGuess.score,
      });
    } else {
      setRoundOver(false);
      setLastScore(0);
      setUserGuess(null);
    }

    setLoading(false);
  }

  async function handleGuess(score, guessLat, guessLng) {
    if (!user || !lobby || roundOver) return;

    setMessage("");

    const { error: guessError } = await supabase
      .from("private_lobby_guesses")
      .insert({
        lobby_id: lobbyId,
        user_id: user.id,
        round: lobby.round,
        score,
        guess_lat: guessLat,
        guess_lng: guessLng,
      });

    if (guessError) {
      setMessage("You already submitted a guess for this round.");
      return;
    }

    setLastScore(score);
    setUserGuess({ lat: guessLat, lng: guessLng, score });
    setRoundOver(true);

    const { data: allGuesses } = await supabase
      .from("private_lobby_guesses")
      .select("score")
      .eq("lobby_id", lobbyId)
      .eq("user_id", user.id);

    const totalScore = (allGuesses || []).reduce(
      (sum, guess) => sum + guess.score,
      0
    );

    await supabase
      .from("private_lobby_players")
      .update({
        score: totalScore,
        current_round: lobby.round + 1,
        finished: lobby.round >= lobby.total_rounds,
      })
      .eq("lobby_id", lobbyId)
      .eq("user_id", user.id);

    await loadGame();
  }

  async function nextRound() {
    if (!lobby || !user) return;

    const isHost = user.id === lobby.host_id;
    if (!isHost) return;

    const everyoneFinishedRound =
      players.length > 0 &&
      players.every(
        (player) => player.current_round > lobby.round || player.finished
      );

    if (!everyoneFinishedRound) {
      setMessage("Wait for everyone to finish this round first.");
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
    setLastScore(0);
    setUserGuess(null);

    await loadGame();
  }

  useEffect(() => {
    if (!lobbyId) return;

    loadGame();

    const interval = setInterval(() => {
      console.log("polling game...");
      loadGame();
    }, 1500);

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
          event: "*",
          schema: "public",
          table: "private_lobbies",
          filter: `id=eq.${lobbyId}`,
        },
        (payload) => {
          if (payload.new.status === "complete") {
            router.push(`/private-game/${lobbyId}/results`);
            return;
          }

          loadGame();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "private_lobby_guesses",
          filter: `lobby_id=eq.${lobbyId}`,
        },
        () => loadGame()
      )
      .subscribe((status) => {
        console.log("PRIVATE GAME REALTIME STATUS:", status);
      });

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [lobbyId, router]);

  const isHost = user?.id === lobby?.host_id;

  const everyoneFinishedRound =
    players.length > 0 &&
    lobby &&
    players.every(
      (player) => player.current_round > lobby.round || player.finished
    );

  if (loading || !lobby || !location) {
    return <p className="loading">Loading private game...</p>;
  }

  if (roundOver) {
    return (
      <main style={{ padding: "1rem" }}>
        <div className="card">
          <h2>Round {lobby.round} Complete!</h2>

          <p style={{ fontSize: "1.4rem", margin: "1rem 0" }}>
            Your Score:{" "}
            <span className="score-display">{lastScore}</span> / 5000
          </p>

          <div className="map-container">
            <Map showAnswer={true} location={location} userGuess={userGuess} />
          </div>

          <h3 style={{ marginTop: "1rem" }}>Lobby Scores</h3>

          <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.5rem" }}>
            {players.map((player, index) => (
              <div key={player.id} className="card">
                {index + 1}. {player.username || player.email}: {player.score}
                {player.current_round <= lobby.round && !player.finished
                  ? " — guessing..."
                  : " — done"}
              </div>
            ))}
          </div>

          {message && <p className="form-message">{message}</p>}

          {isHost ? (
            <button
              onClick={nextRound}
              className="btn btn-primary"
              style={{ marginTop: "1rem" }}
              disabled={!everyoneFinishedRound}
            >
              {!everyoneFinishedRound
                ? "Waiting for everyone..."
                : lobby.round >= lobby.total_rounds
                ? "Finish Game"
                : "Next Round"}
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "1rem",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <h2>Private Game</h2>
          <p>
            Round {lobby.round}/{lobby.total_rounds}
          </p>
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

        {message && <p className="form-message">{message}</p>}
      </div>
    </main>
  );
}