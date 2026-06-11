'use client';
import { useState, useEffect, useRef } from 'react';

const FLOOR_OPTIONS = [
  { value: '-1', label: 'Outside' },
  { value: '0', label: 'Basement' },
  { value: '1', label: 'Floor 1' },
  { value: '2', label: 'Floor 2' },
];

function normalizeFloor(value) {
  if (value === null || value === undefined || value === '') return null;
  const floor = Number(value);
  return Number.isFinite(floor) ? floor : null;
}

function formatFloor(value) {
  const floor = normalizeFloor(value);
  const option = FLOOR_OPTIONS.find((item) => Number(item.value) === floor);
  return option?.label || 'Unknown';
}

export default function Map({ onGuess, location, showAnswer, userGuess }) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const guessMarkerRef = useRef(null);
  const answerMarkerRef = useRef(null);
  const lineRef = useRef(null);
  const clickEnabledRef = useRef(true);
  const showAnswerRef = useRef(showAnswer);
  const submittedGuessRef = useRef(null);
  const [tempGuess, setTempGuess] = useState(null);
  const [floorGuess, setFloorGuess] = useState('');
  const [submittedGuess, setSubmittedGuess] = useState(null);
  const [score, setScore] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateDistanceScore = (distanceKm) => {
    const distanceMeters = distanceKm * 1000;
    if (distanceMeters <= 5) return 4000;
    const d = distanceMeters - 5;
    const score = Math.round(3999 * Math.exp(-(d * d) / 5000));
    return Math.max(0, score);
  };

  const calculateScore = (distanceKm, guessedFloor) => {
    const distanceScore = calculateDistanceScore(distanceKm);
    const floorScore = normalizeFloor(guessedFloor) === normalizeFloor(location?.level) ? 1000 : 0;
    return { totalScore: distanceScore + floorScore, distanceScore, floorScore };
  };

  const formatDistance = (distance) => {
    if (distance < 1) {
      return `${(distance * 1000).toFixed(0)} meters`;
    }
    return `${distance.toFixed(2)} km`;
  };

  // Initialize map once when location changes
  useEffect(() => {
    showAnswerRef.current = showAnswer;
    submittedGuessRef.current = submittedGuess;
  }, [showAnswer, submittedGuess]);

  useEffect(() => {
    if (!location) return;
    let cancelled = false;

    const initMap = async () => {
      const L = await import('leaflet');
      if (cancelled || !mapContainerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const correctLat = location.latitude;
      const correctLng = location.longitude;

      mapRef.current = L.map(mapContainerRef.current, {
        maxBounds: [
          [40.8990, -74.0380],
          [40.9055, -74.0305],
        ],
        maxBoundsViscosity: 0.75,
        minZoom: 18,
        maxZoom: 22,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
      }).setView([correctLat, correctLng], 18);
      mapRef.current.getContainer().style.cursor = 'crosshair';

      L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 22,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; <a href="https://www.google.com/maps">Google</a>'
      }).addTo(mapRef.current);

      mapRef.current.on('click', (e) => {
        if (!clickEnabledRef.current || showAnswerRef.current || submittedGuessRef.current) return;
        const { lat, lng } = e.latlng;
        if (guessMarkerRef.current) mapRef.current.removeLayer(guessMarkerRef.current);
        guessMarkerRef.current = L.marker([lat, lng], { draggable: true })
          .addTo(mapRef.current)
          .bindPopup(`Your Guess`)
          .openPopup();
        guessMarkerRef.current.on('dragend', function () {
          if (!clickEnabledRef.current) return;
          const pos = this.getLatLng();
          setTempGuess({ lat: pos.lat, lng: pos.lng });
          this.bindPopup(`Your Guess`).openPopup();
        });
        setTempGuess({ lat, lng });
      });
      if (!cancelled) setMapReady(true);
    };
    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, [location]);

  // Handle submit
  const handleSubmit = () => {
    if (!tempGuess || floorGuess === '' || !location || submittedGuess) return;
    const correctLat = location.latitude;
    const correctLng = location.longitude;
    const distance = calculateDistance(tempGuess.lat, tempGuess.lng, correctLat, correctLng);
    const scoreBreakdown = calculateScore(distance, floorGuess);
    const submitted = { ...tempGuess, floor: Number(floorGuess) };
    setSubmittedGuess(submitted);
    setScore(scoreBreakdown.totalScore);
    clickEnabledRef.current = false;
    import('leaflet').then(() => {
      if (guessMarkerRef.current) {
        guessMarkerRef.current.bindPopup(`<b>Your Guess (Submitted)</b><br>Floor: ${formatFloor(floorGuess)}<br>Distance: ${formatDistance(distance)}<br>Score: ${scoreBreakdown.totalScore}/5000`).openPopup();
        guessMarkerRef.current.dragging?.disable();
      }
    });
    if (onGuess) onGuess(scoreBreakdown.totalScore, tempGuess.lat, tempGuess.lng, Number(floorGuess));
  };

  // Handle showing both markers when round ends (showAnswer = true)
  useEffect(() => {
    if (!mapReady || !mapRef.current || !location || !showAnswer) return;
    const correctLat = location.latitude;
    const correctLng = location.longitude;

    const showMarkers = async () => {
      const L = await import('leaflet');
      if (answerMarkerRef.current) {
        mapRef.current.removeLayer(answerMarkerRef.current);
        answerMarkerRef.current = null;
      }
      if (lineRef.current) {
        mapRef.current.removeLayer(lineRef.current);
        lineRef.current = null;
      }

      clickEnabledRef.current = false;

      // Add answer marker
      answerMarkerRef.current = L.marker([correctLat, correctLng])
        .addTo(mapRef.current)
        .bindPopup(`<b>Correct Location</b><br>Floor: ${formatFloor(location.level)}`)
        .openPopup();
      answerMarkerRef.current._icon.style.filter = "hue-rotate(-100deg)";

      // If userGuess is provided from parent, use that
      let guessCoords = userGuess;
      if (!guessCoords && submittedGuess) guessCoords = submittedGuess;

      if (guessCoords) {
        // Add guess marker (recreate it)
        if (guessMarkerRef.current) mapRef.current.removeLayer(guessMarkerRef.current);
        guessMarkerRef.current = L.marker([guessCoords.lat, guessCoords.lng], { draggable: false })
          .addTo(mapRef.current)
          .bindPopup(`<b>Your Guess</b>${guessCoords.floor !== undefined ? `<br>Floor: ${formatFloor(guessCoords.floor)}` : ''}`)
          .openPopup();

        // Draw line
        const latlngs = [[guessCoords.lat, guessCoords.lng], [correctLat, correctLng]];
        lineRef.current = L.polyline(latlngs, { color: '#FFFFFF', weight: 3, opacity: 0.8 }).addTo(mapRef.current);

        // Fit bounds to show both markers
        const bounds = L.latLngBounds([correctLat, correctLng], [guessCoords.lat, guessCoords.lng]);
        if (mapRef.current._panes && mapRef.current._panes.mapPane) {
          mapRef.current.fitBounds(bounds, { padding: [50, 50], animate: false });
        }
      } else {
        mapRef.current.setView([correctLat, correctLng], 18);
      }
    };
    showMarkers();
  }, [showAnswer, location, userGuess, mapReady]); // Now depends on userGuess

  if (!location) return <div className="loading">Loading map...</div>;

  return (
    <div className="map-wrapper">
      <div ref={mapContainerRef} className="map-container-leaflet" />

      {tempGuess && !submittedGuess && !showAnswer && (
        <div className="guess-info-panel">
          <div className="guess-info-title">Pending Guess</div>
          <div className="guess-info-detail">
            <label className="floor-guess-field" htmlFor="floor-guess">
              <span>Floor</span>
              <select
                id="floor-guess"
                value={floorGuess}
                onChange={(event) => setFloorGuess(event.target.value)}
                required
              >
                <option value="">Choose floor</option>
                {FLOOR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
          <button onClick={handleSubmit} className="btn-submit" disabled={floorGuess === ''}>Submit Guess</button>
        </div>
      )}

      {submittedGuess && !showAnswer && score !== null && (
        <div className="score-panel">
          <div className="score-title">✓ Guess Submitted!</div>
          <div className="score-detail">Distance: {formatDistance(calculateDistance(submittedGuess.lat, submittedGuess.lng, location.latitude, location.longitude))}</div>
          <div className="score-detail">Correct floor: {formatFloor(location.level)}</div>
          <div className="score-value">Score: {score} / 5000</div>
          <div className="score-waiting">Waiting for next round...</div>
        </div>
      )}
    </div>
  );
}
