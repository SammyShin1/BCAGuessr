"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (event) => {
    event.preventDefault();
    setMessage("");

    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedEmail.endsWith("@bergen.org")) {
      setMessage("You must use a @bergen.org email to sign up.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: cleanedEmail,
      password: password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Signup successful!");

    router.push("/game");
  };

  return (
    <main style={{ maxWidth: "400px", margin: "80px auto", padding: "20px" }}>
      <h1>Sign Up</h1>

      <form onSubmit={handleSignup}>
        <label>Email</label>
        <input
          type="email"
          placeholder="yourname@bergen.org"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          style={{
            display: "block",
            width: "100%",
            marginBottom: "12px",
            padding: "8px",
          }}
        />

        <label>Password</label>
        <input
          type="password"
          placeholder="Create a password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          style={{
            display: "block",
            width: "100%",
            marginBottom: "12px",
            padding: "8px",
          }}
        />

        <button type="submit" disabled={loading}>
          {loading ? "Signing up..." : "Sign Up"}
        </button>
      </form>

      {message && <p>{message}</p>}

      <p>
        Already have an account? <a href="/login">Log in</a>
      </p>
    </main>
  );
}