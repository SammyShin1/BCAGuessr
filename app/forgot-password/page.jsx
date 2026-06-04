"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import "../globals.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleResetPassword(event) {
    event.preventDefault();
    setMessage("");

    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedEmail.endsWith("@bergen.org")) {
      setMessage("You must use a @bergen.org email.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(cleanedEmail, {
      redirectTo: "http://localhost:3000/update-password",
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Password reset email sent! Check your Bergen email.");
  }

  return (
    <main style={{ maxWidth: "400px", margin: "80px auto", padding: "20px" }}>
      <h1>Reset Password</h1>

      <form onSubmit={handleResetPassword}>
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

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Reset Email"}
        </button>
      </form>

      {message && <p>{message}</p>}

      <p>
        Remembered your password? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}