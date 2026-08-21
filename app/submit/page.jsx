'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import '../globals.css';

const AdminLocationMap = dynamic(() => import('../../components/AdminLocationMap'), {
  ssr: false,
  loading: () => <p className="loading">Loading map...</p>,
});

// Storage bucket that holds user-submitted photos. Create this bucket in
// Supabase Storage (public read) if it doesn't exist yet — see
// supabase/submission_setup.sql for suggested policies.
const SUBMISSIONS_BUCKET = 'location-submissions';

const DIFFICULTY_OPTIONS = [
  { value: '', label: 'Unset' },
  { value: '1', label: '1 - Easy' },
  { value: '2', label: '2' },
  { value: '3', label: '3 - Medium' },
  { value: '4', label: '4' },
  { value: '5', label: '5 - Hard' },
];

const FLOOR_OPTIONS = [
  { value: '', label: 'Unset' },
  { value: '-1', label: 'Outside' },
  { value: '0', label: 'Basement' },
  { value: '1', label: 'Floor 1' },
  { value: '2', label: 'Floor 2' },
];

// Fallback map center, used until we can average existing location coords.
const DEFAULT_CENTER = { latitude: 40.9295, longitude: -74.0454 };

function statusLabel(status) {
  if (status === 'approved') return { text: 'Approved', className: 'status-approved' };
  if (status === 'rejected') return { text: 'Rejected', className: 'status-rejected' };
  return { text: 'Pending review', className: 'status-pending' };
}

export default function SubmitPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState(null);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [difficulty, setDifficulty] = useState('');
  const [level, setLevel] = useState('');
  const [coords, setCoords] = useState(DEFAULT_CENTER);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const [mySubmissions, setMySubmissions] = useState([]);
  const [loadingMine, setLoadingMine] = useState(true);

  useEffect(() => {
    async function init() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        router.push('/login');
        return;
      }
      if (!data.user.email.endsWith('@bergen.org')) {
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }
      setUserId(data.user.id);
      setCheckingAuth(false);

      // Center the map on the average of existing locations, if any exist,
      // so new submissions start out roughly in the right neighborhood.
      const { data: existing } = await supabase.from('locations').select('latitude, longitude');
      if (existing && existing.length > 0) {
        const total = existing.reduce((acc, loc) => ({
          latitude: acc.latitude + (Number(loc.latitude) || 0),
          longitude: acc.longitude + (Number(loc.longitude) || 0),
        }), { latitude: 0, longitude: 0 });
        setCoords({
          latitude: total.latitude / existing.length,
          longitude: total.longitude / existing.length,
        });
      }
    }
    init();
  }, [router]);

  const loadMySubmissions = useCallback(async (uid) => {
    if (!uid) return;
    setLoadingMine(true);
    const { data, error } = await supabase
      .from('location_submissions')
      .select('*')
      .eq('submitted_by', uid)
      .order('created_at', { ascending: false });
    if (!error) setMySubmissions(data || []);
    setLoadingMine(false);
  }, []);

  useEffect(() => {
    if (!userId) return;
    queueMicrotask(() => {
      loadMySubmissions(userId);
    });
  }, [userId, loadMySubmissions]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleMapChange = useCallback((nextCoords) => {
    setCoords(nextCoords);
  }, []);

  const resetForm = () => {
    setImageFile(null);
    setImagePreview(null);
    setDifficulty('');
    setLevel('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    if (!imageFile) {
      setMessage('Please choose a photo first.');
      return;
    }

    if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
      setMessage('Please pin a location on the map.');
      return;
    }

    setSubmitting(true);

    const fileExt = imageFile.name.split('.').pop() || 'jpg';
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(SUBMISSIONS_BUCKET)
      .upload(path, imageFile, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      setSubmitting(false);
      setMessage(`Upload failed: ${uploadError.message}`);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from(SUBMISSIONS_BUCKET).getPublicUrl(path);
    const imageUrl = publicUrlData?.publicUrl;

    const { error: insertError } = await supabase.from('location_submissions').insert({
      image_url: imageUrl,
      difficulty: difficulty === '' ? null : Number(difficulty),
      level: level === '' ? null : Number(level),
      latitude: coords.latitude,
      longitude: coords.longitude,
      submitted_by: userId,
      status: 'pending',
    });

    setSubmitting(false);

    if (insertError) {
      setMessage(`Could not save your submission: ${insertError.message}`);
      return;
    }

    setMessage('Submitted! An admin will review it soon.');
    resetForm();
    loadMySubmissions(userId);
  };

  if (checkingAuth) {
    return <div className="loading">Checking login...</div>;
  }

  return (
    <main className="submit-page">
      <div className="admin-topbar">
        <div>
          <h1>Submit a Location</h1>
          <p>Add a photo and pin where it was taken. An admin reviews every submission before it appears in the game.</p>
        </div>
        <Link href="/" className="btn">Home</Link>
      </div>

      <div className="submit-layout">
        <section className="submit-form-panel">
          <form onSubmit={handleSubmit}>
            <label className="admin-label" htmlFor="submission-photo">Photo</label>
            <label
              htmlFor="submission-photo"
              className={`dropzone ${imagePreview ? 'has-image' : ''}`}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Selected preview" />
              ) : (
                <span>Click to choose a photo</span>
              )}
            </label>
            <input
              id="submission-photo"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <div className="submit-field-grid">
              <label className="admin-field">
                <span>Difficulty</span>
                <select
                  className="admin-input"
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value)}
                >
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Floor</span>
                <select
                  className="admin-input"
                  value={level}
                  onChange={(event) => setLevel(event.target.value)}
                >
                  {FLOOR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="admin-label">Pin the location</label>
            <AdminLocationMap
              latitude={coords.latitude}
              longitude={coords.longitude}
              editable
              onChange={handleMapChange}
            />

            <div className="admin-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit for Review'}
              </button>
              {message && <p className="admin-message">{message}</p>}
            </div>
          </form>
        </section>

        <section className="submit-mysubs-panel">
          <h2>Your Submissions</h2>
          {loadingMine ? (
            <p className="loading">Loading...</p>
          ) : mySubmissions.length === 0 ? (
            <p className="empty-state">You haven&apos;t submitted anything yet.</p>
          ) : (
            <div className="my-submissions-list">
              {mySubmissions.map((submission) => {
                const status = statusLabel(submission.status);
                return (
                  <div key={submission.id} className="my-submission-row">
                    <img src={submission.image_url} alt="" />
                    <span>
                      Submitted {new Date(submission.created_at).toLocaleDateString()}
                    </span>
                    <span className={`status-badge ${status.className}`}>{status.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
