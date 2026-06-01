import Link from 'next/link';
import './globals.css'

export default function HomePage() {
  return (
    <div>
      <div className="hero">
        <h1>BCAGuessr</h1>
        <p style={{ fontSize: '1.25rem', color: '#9ca3af', marginBottom: '2rem' }}>
          Test your geography knowledge! Guess locations based on images.
        </p>
        <Link href="/game">
          <button className="btn btn-primary btn-large">Start Playing</button>
        </Link>
      </div>

      <div className="feature-grid">
        <div className="feature-card">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌍</div>
          <h3>Classic Game</h3>
          <p style={{ color: '#9ca3af' }}>5 rounds of location guessing. Score up to 5000 points per round!</p>
          <Link href="/game">
            <button className="btn" style={{ marginTop: '1rem' }}>Play Now</button>
          </Link>
        </div>

        <div className="feature-card">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⭐</div>
          <h3>Daily Challenge</h3>
          <p style={{ color: '#9ca3af' }}>One new location every day. Compete with yourself!</p>
          <Link href="/daily">
            <button className="btn" style={{ marginTop: '1rem' }}>Daily Challenge</button>
          </Link>
        </div>

        <div className="feature-card">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏆</div>
          <h3>Leaderboard</h3>
          <p style={{ color: '#9ca3af' }}>Coming soon! Compete with players worldwide.</p>
          <button className="btn" style={{ marginTop: '1rem', opacity: 0.5 }} disabled>
            Coming Soon
          </button>
        </div>
      </div>
    </div>
  );
}