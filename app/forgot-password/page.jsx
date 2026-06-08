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
      redirectTo: `${window.location.origin}/update-password`,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Password reset email sent! Check your Bergen email.");
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Reset Password</h1>

        <form className="auth-form" onSubmit={handleResetPassword}>
          <div className="form-row">
            <label>Email</label>
            <input
              type="email"
              placeholder="yourname@bergen.org"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Email"}
          </button>
        </form>

        {message && <p className="form-message">{message}</p>}

        <p className="form-links">
          Remembered your password? <Link href="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
