'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import '../globals.css';

const AdminLocationMap = dynamic(() => import('../../components/AdminLocationMap'), {
  ssr: false,
  loading: () => <p className="loading">Loading map...</p>,
});

const ADMIN_EMAILS = new Set([
  'jerche28@bergen.org',
  'samshi28@bergen.org',
  'sambas28@bergen.org',
]);

const DIFFICULTY_OPTIONS = [
  { value: '', label: 'Unset' },
  { value: '1', label: '1 - Easy' },
  { value: '2', label: '2' },
  { value: '3', label: '3 - Medium' },
  { value: '4', label: '4' },
  { value: '5', label: '5 - Hard' },
];

function normalizeLocation(location) {
  return {
    ...location,
    difficulty: location?.difficulty ?? '',
    level: location?.level ?? '',
  };
}

function normalizeSubmission(submission) {
  return {
    ...submission,
    difficulty: submission?.difficulty ?? '',
    level: submission?.level ?? '',
  };
}

function formatCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(6) : 'Not set';
}

function formatDateTime(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

export default function AdminPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState(null);

  const [view, setView] = useState('locations'); // 'locations' | 'submissions'

  // Locations tab state
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [locations, setLocations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [readjustMode, setReadjustMode] = useState(false);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // Submissions tab state
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [submissionDraft, setSubmissionDraft] = useState(null);
  const [submissionReadjustMode, setSubmissionReadjustMode] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [submissionSaving, setSubmissionSaving] = useState(false);

  const filteredLocations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return locations;
    return locations.filter((location) => {
      const haystack = [
        location.id,
        location.image_url,
        location.difficulty,
        location.level,
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [locations, query]);

  useEffect(() => {
    async function checkAuth() {
      const { data, error } = await supabase.auth.getUser();
      const email = data?.user?.email?.toLowerCase() || '';

      if (error || !data?.user) {
        router.push('/login');
        return;
      }

      if (!ADMIN_EMAILS.has(email)) {
        router.push('/');
        return;
      }

      setUserEmail(email);
      setUserId(data.user.id);
      setCheckingAuth(false);
    }

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (checkingAuth) return;

    async function loadLocations() {
      setLoadingLocations(true);
      setMessage('');

      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        setMessage(`Could not load locations: ${error.message}`);
        setLoadingLocations(false);
        return;
      }

      const normalized = (data || []).map(normalizeLocation);
      setLocations(normalized);
      if (normalized.length > 0) {
        setSelectedId(normalized[0].id);
        setDraft(normalized[0]);
      }
      setLoadingLocations(false);
    }

    loadLocations();
  }, [checkingAuth]);

  const loadSubmissions = useCallback(async () => {
    setLoadingSubmissions(true);
    setSubmissionMessage('');

    const { data, error } = await supabase
      .from('location_submissions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      setSubmissionMessage(`Could not load submissions: ${error.message}`);
      setLoadingSubmissions(false);
      return;
    }

    const normalized = (data || []).map(normalizeSubmission);
    setSubmissions(normalized);
    if (normalized.length > 0) {
      setSelectedSubmissionId(normalized[0].id);
      setSubmissionDraft(normalized[0]);
    } else {
      setSelectedSubmissionId(null);
      setSubmissionDraft(null);
    }
    setSubmissionReadjustMode(false);
    setLoadingSubmissions(false);
  }, []);

  useEffect(() => {
    if (checkingAuth) return;
    loadSubmissions();
  }, [checkingAuth, loadSubmissions]);

  async function loadLocationsQuietly() {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('id', { ascending: true });
    if (error) return;
    setLocations((data || []).map(normalizeLocation));
  }

  const handleDraftChange = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleMapChange = useCallback((nextCoords) => {
    setDraft((current) => ({
      ...current,
      latitude: nextCoords.latitude,
      longitude: nextCoords.longitude,
    }));
  }, []);

  const handleSave = async () => {
    if (!draft) return;

    const difficulty = draft.difficulty === '' ? null : Number(draft.difficulty);
    const level = draft.level === '' ? null : Number(draft.level);
    const latitude = Number(draft.latitude);
    const longitude = Number(draft.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setMessage('Latitude and longitude must be valid numbers.');
      return;
    }

    if (draft.difficulty !== '' && (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)) {
      setMessage('Difficulty must be between 1 and 5.');
      return;
    }

    if (draft.level !== '' && !Number.isFinite(level)) {
      setMessage('Level must be a number.');
      return;
    }

    setSaving(true);
    setMessage('');

    const updates = {
      difficulty,
      level,
      latitude,
      longitude,
    };

    const { error } = await supabase
      .from('locations')
      .update(updates)
      .eq('id', draft.id);

    setSaving(false);

    if (error) {
      setMessage(`Save failed: ${error.message}`);
      return;
    }

    const saved = normalizeLocation({
      ...draft,
      ...updates,
    });
    setLocations((current) => current.map((location) => (
      location.id === saved.id ? saved : location
    )));
    setDraft(saved);
    setReadjustMode(false);
    setMessage('Saved.');
  };

  const selectSubmission = (submission) => {
    const normalized = normalizeSubmission(submission);
    setSelectedSubmissionId(normalized.id);
    setSubmissionDraft(normalized);
    setSubmissionReadjustMode(false);
    setSubmissionMessage('');
  };

  const removeSubmissionFromQueue = (id) => {
    setSubmissions((current) => {
      const next = current.filter((submission) => submission.id !== id);
      if (next.length > 0) {
        setSelectedSubmissionId(next[0].id);
        setSubmissionDraft(next[0]);
      } else {
        setSelectedSubmissionId(null);
        setSubmissionDraft(null);
      }
      return next;
    });
    setSubmissionReadjustMode(false);
  };

  const handleSubmissionDraftChange = (field, value) => {
    setSubmissionDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSubmissionMapChange = useCallback((nextCoords) => {
    setSubmissionDraft((current) => ({
      ...current,
      latitude: nextCoords.latitude,
      longitude: nextCoords.longitude,
    }));
  }, []);

  const validateSubmissionDraft = () => {
    if (!submissionDraft) return null;

    const latitude = Number(submissionDraft.latitude);
    const longitude = Number(submissionDraft.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setSubmissionMessage('Latitude and longitude must be valid numbers.');
      return null;
    }

    const difficulty = submissionDraft.difficulty === '' ? null : Number(submissionDraft.difficulty);
    if (submissionDraft.difficulty !== '' && (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)) {
      setSubmissionMessage('Difficulty must be between 1 and 5.');
      return null;
    }

    const level = submissionDraft.level === '' ? null : Number(submissionDraft.level);
    if (submissionDraft.level !== '' && !Number.isFinite(level)) {
      setSubmissionMessage('Level must be a number.');
      return null;
    }

    return { latitude, longitude, difficulty, level };
  };

  const handleApproveSubmission = async () => {
    const validated = validateSubmissionDraft();
    if (!validated) return;

    setSubmissionSaving(true);
    setSubmissionMessage('');

    // Publish into the live locations table first.
    const { error: insertError } = await supabase.from('locations').insert({
      image_url: submissionDraft.image_url,
      difficulty: validated.difficulty,
      level: validated.level,
      latitude: validated.latitude,
      longitude: validated.longitude,
    });

    if (insertError) {
      setSubmissionSaving(false);
      setSubmissionMessage(`Approve failed: ${insertError.message}`);
      return;
    }

    // Then mark the submission reviewed, keeping any edits the admin made.
    const { error: updateError } = await supabase
      .from('location_submissions')
      .update({
        status: 'approved',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        difficulty: validated.difficulty,
        level: validated.level,
        latitude: validated.latitude,
        longitude: validated.longitude,
      })
      .eq('id', submissionDraft.id);

    setSubmissionSaving(false);

    if (updateError) {
      setSubmissionMessage(`Added to the map, but the submission record failed to update: ${updateError.message}`);
    }

    removeSubmissionFromQueue(submissionDraft.id);
    loadLocationsQuietly();
  };

  const handleRejectSubmission = async () => {
    if (!submissionDraft) return;

    setSubmissionSaving(true);
    setSubmissionMessage('');

    const { error } = await supabase
      .from('location_submissions')
      .update({
        status: 'rejected',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submissionDraft.id);

    setSubmissionSaving(false);

    if (error) {
      setSubmissionMessage(`Reject failed: ${error.message}`);
      return;
    }

    removeSubmissionFromQueue(submissionDraft.id);
  };

  if (checkingAuth) {
    return <div className="loading">Checking admin access...</div>;
  }

  return (
    <main className="admin-page">
      <div className="admin-topbar">
        <div>
          <h1>Admin</h1>
          <p>Signed in as {userEmail}</p>
        </div>
        <Link href="/" className="btn">Home</Link>
      </div>

      <div className="segmented">
        <button
          className={`segment-btn ${view === 'locations' ? 'active' : ''}`}
          type="button"
          onClick={() => setView('locations')}
        >
          Locations
        </button>
        <button
          className={`segment-btn ${view === 'submissions' ? 'active' : ''}`}
          type="button"
          onClick={() => setView('submissions')}
        >
          Submissions {submissions.length > 0 ? `(${submissions.length})` : ''}
        </button>
      </div>

      {view === 'locations' && (
        loadingLocations ? (
          <div className="loading">Loading locations...</div>
        ) : !draft ? (
          <p className="empty-state">No locations found.</p>
        ) : (
          <div className="admin-layout">
            <aside className="admin-sidebar">
              <label className="admin-label" htmlFor="location-search">Images</label>
              <input
                id="location-search"
                className="admin-input"
                type="search"
                placeholder="Search image or id"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />

              <div className="admin-location-list">
                {filteredLocations.map((location) => (
                  <button
                    key={location.id}
                    className={`admin-location-row ${location.id === selectedId ? 'active' : ''}`}
                    type="button"
                    onClick={() => {
                      const nextLocation = normalizeLocation(location);
                      setSelectedId(nextLocation.id);
                      setDraft(nextLocation);
                      setReadjustMode(false);
                      setMessage('');
                    }}
                  >
                    <img src={location.image_url} alt="" />
                    <span>
                      <strong>Image {location.id}</strong>
                      <small>
                        Floor {location.level || 'unset'} · Difficulty {location.difficulty || 'unset'}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="admin-detail">
              <div className="admin-image-panel">
                <img src={draft.image_url} alt={`Location ${draft.id}`} />
              </div>

              <div className="admin-editor-panel">
                <div className="admin-editor-header">
                  <div>
                    <h2>Image {draft.id}</h2>
                    <p>
                      Lat {formatCoordinate(draft.latitude)} · Lng {formatCoordinate(draft.longitude)}
                    </p>
                  </div>
                  <button
                    className={`btn ${readjustMode ? 'btn-primary' : ''}`}
                    type="button"
                    onClick={() => setReadjustMode((current) => !current)}
                  >
                    {readjustMode ? 'Done Readjusting' : 'Readjust Location'}
                  </button>
                </div>

                <div className="admin-form-grid">
                  <label className="admin-field">
                    <span>Difficulty</span>
                    <select
                      className="admin-input"
                      value={draft.difficulty}
                      onChange={(event) => handleDraftChange('difficulty', event.target.value)}
                    >
                      {DIFFICULTY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="admin-field">
                    <span>Level / Floor</span>
                    <input
                      className="admin-input"
                      type="number"
                      inputMode="numeric"
                      step="1"
                      placeholder="Example: 2"
                      value={draft.level}
                      onChange={(event) => handleDraftChange('level', event.target.value)}
                    />
                  </label>

                  <label className="admin-field">
                    <span>Latitude</span>
                    <input
                      className="admin-input"
                      type="number"
                      step="0.000001"
                      value={draft.latitude ?? ''}
                      onChange={(event) => handleDraftChange('latitude', event.target.value)}
                    />
                  </label>

                  <label className="admin-field">
                    <span>Longitude</span>
                    <input
                      className="admin-input"
                      type="number"
                      step="0.000001"
                      value={draft.longitude ?? ''}
                      onChange={(event) => handleDraftChange('longitude', event.target.value)}
                    />
                  </label>
                </div>

                <AdminLocationMap
                  latitude={Number(draft.latitude)}
                  longitude={Number(draft.longitude)}
                  editable={readjustMode}
                  onChange={handleMapChange}
                />

                <div className="admin-actions">
                  <button className="btn btn-primary" type="button" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Image'}
                  </button>
                  {message && <p className="admin-message">{message}</p>}
                </div>
              </div>
            </section>
          </div>
        )
      )}

      {view === 'submissions' && (
        loadingSubmissions ? (
          <div className="loading">Loading submissions...</div>
        ) : !submissionDraft ? (
          <p className="empty-state">No pending submissions. Nice and tidy.</p>
        ) : (
          <div className="admin-layout">
            <aside className="admin-sidebar">
              <label className="admin-label">Pending ({submissions.length})</label>
              <div className="admin-location-list">
                {submissions.map((submission) => (
                  <button
                    key={submission.id}
                    className={`admin-location-row ${submission.id === selectedSubmissionId ? 'active' : ''}`}
                    type="button"
                    onClick={() => selectSubmission(submission)}
                  >
                    <img src={submission.image_url} alt="" />
                    <span>
                      <strong>Submission {submission.id}</strong>
                      <small>{formatDateTime(submission.created_at)}</small>
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="admin-detail">
              <div className="admin-image-panel">
                <img src={submissionDraft.image_url} alt={`Submission ${submissionDraft.id}`} />
              </div>

              <div className="admin-editor-panel">
                <div className="admin-editor-header">
                  <div>
                    <h2>Submission {submissionDraft.id}</h2>
                    <p>
                      Submitted {formatDateTime(submissionDraft.created_at)} · Lat {formatCoordinate(submissionDraft.latitude)} · Lng {formatCoordinate(submissionDraft.longitude)}
                    </p>
                  </div>
                  <button
                    className={`btn ${submissionReadjustMode ? 'btn-primary' : ''}`}
                    type="button"
                    onClick={() => setSubmissionReadjustMode((current) => !current)}
                  >
                    {submissionReadjustMode ? 'Done Readjusting' : 'Readjust Location'}
                  </button>
                </div>

                <div className="admin-form-grid">
                  <label className="admin-field">
                    <span>Difficulty</span>
                    <select
                      className="admin-input"
                      value={submissionDraft.difficulty}
                      onChange={(event) => handleSubmissionDraftChange('difficulty', event.target.value)}
                    >
                      {DIFFICULTY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="admin-field">
                    <span>Level / Floor</span>
                    <input
                      className="admin-input"
                      type="number"
                      inputMode="numeric"
                      step="1"
                      placeholder="Example: 2"
                      value={submissionDraft.level}
                      onChange={(event) => handleSubmissionDraftChange('level', event.target.value)}
                    />
                  </label>

                  <label className="admin-field">
                    <span>Latitude</span>
                    <input
                      className="admin-input"
                      type="number"
                      step="0.000001"
                      value={submissionDraft.latitude ?? ''}
                      onChange={(event) => handleSubmissionDraftChange('latitude', event.target.value)}
                    />
                  </label>

                  <label className="admin-field">
                    <span>Longitude</span>
                    <input
                      className="admin-input"
                      type="number"
                      step="0.000001"
                      value={submissionDraft.longitude ?? ''}
                      onChange={(event) => handleSubmissionDraftChange('longitude', event.target.value)}
                    />
                  </label>
                </div>

                <AdminLocationMap
                  latitude={Number(submissionDraft.latitude)}
                  longitude={Number(submissionDraft.longitude)}
                  editable={submissionReadjustMode}
                  onChange={handleSubmissionMapChange}
                />

                <div className="admin-actions">
                  <button className="btn btn-primary" type="button" onClick={handleApproveSubmission} disabled={submissionSaving}>
                    {submissionSaving ? 'Working...' : 'Approve & Publish'}
                  </button>
                  <button className="btn" type="button" onClick={handleRejectSubmission} disabled={submissionSaving}>
                    Reject
                  </button>
                  {submissionMessage && <p className="admin-message">{submissionMessage}</p>}
                </div>
              </div>
            </section>
          </div>
        )
      )}
    </main>
  );
}