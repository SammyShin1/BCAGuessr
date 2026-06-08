'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.updateUser({
      password: password,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Password updated successfully! You can now log in.')
      setPassword('')
    }

    setLoading(false)
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Update Password</h1>

        <form className="auth-form" onSubmit={handleUpdatePassword}>
          <div className="form-row">
            <label>New password</label>
            <input
              type="password"
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        {message && <p className="form-message">{message}</p>}
      </div>
    </main>
  )
}
