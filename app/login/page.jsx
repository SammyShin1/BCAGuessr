"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setMessage("");

    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedEmail.endsWith("@bergen.org")) {
      setMessage("You must use a @bergen.org email to log in.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanedEmail,
      password: password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    console.log("Logged in user:", data.user);

    router.push("/");
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Log In</h1>

        <form className="auth-form" onSubmit={handleLogin}>
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

          <div className="form-row">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        {message && <p className="form-message">{message}</p>}

        <div className="form-links">
          <p>
            Need an account? <a href="/signup">Sign up</a>
          </p>

          <p>
            Forgot your password? <a href="/forgot-password">Reset it here</a>
          </p>
        </div>
      </div>
    </main>
  );
}
