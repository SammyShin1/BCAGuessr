'use client';
import { useState, useEffect, useRef } from 'react';

export default function Map({ onGuess, location, showAnswer, userGuess }) {
  const mapRef = useRef(null);
  const guessMarkerRef = useRef(null);
  const answerMarkerRef = useRef(null);
  const lineRef = useRef(null);
  const [tempGuess, setTempGuess] = useState(null);
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

  const calculateScore = (distanceKm) => {
    const distanceMeters = distanceKm * 1000;
    if (distanceMeters <= 5) return 5000;
    const score = Math.round(4999 * Math.exp(-(distanceMeters - 5) / 300));
    return Math.max(0, score);
  };

  const formatDistance = (distance) => {
    if (distance < 1) {
      return `${(distance * 1000).toFixed(0)} meters`;
    }
    return `${distance.toFixed(2)} km`;
  };

  // Initialize map once when location changes
  useEffect(() => {
    if (!location) return;

    const initMap = async () => {
      const L = await import('leaflet');

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const correctLat = location.latitude;
      const correctLng = location.longitude;

      mapRef.current = L.map('map', {
        maxBounds: [
          [40.8990, -74.0380],
          [40.9055, -74.0305],
        ],
        maxBoundsViscosity: 0.75,
        minZoom: 18,
        maxZoom: 22
      }).setView([correctLat, correctLng], 18);
      mapRef.current.getContainer().style.cursor = 'crosshair';

      L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 22,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; <a href="https://www.google.com/maps">Google</a>'
      }).addTo(mapRef.current);

      mapRef.current.on('click', (e) => {
        if (showAnswer || submittedGuess) return;
        const { lat, lng } = e.latlng;
        if (guessMarkerRef.current) mapRef.current.removeLayer(guessMarkerRef.current);
        guessMarkerRef.current = L.marker([lat, lng], { draggable: true })
          .addTo(mapRef.current)
          .bindPopup(`<b>Your Guess (Pending)</b><br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}<br><i>Click Submit to confirm</i>`)
          .openPopup();
        guessMarkerRef.current.on('dragend', function () {
          const pos = this.getLatLng();
          setTempGuess({ lat: pos.lat, lng: pos.lng });
          this.bindPopup(`<b>Your Guess (Pending)</b><br>Lat: ${pos.lat.toFixed(6)}<br>Lng: ${pos.lng.toFixed(6)}<br><i>Click Submit to confirm</i>`).openPopup();
        });
        setTempGuess({ lat, lng });
      });
      setMapReady(true);
    };
    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, [location]);

  // Handle submit
  const handleSubmit = () => {
    if (!tempGuess || !location || submittedGuess) return;
    const correctLat = location.latitude;
    const correctLng = location.longitude;
    const distance = calculateDistance(tempGuess.lat, tempGuess.lng, correctLat, correctLng);
    const calculatedScore = calculateScore(distance);
    setSubmittedGuess(tempGuess);
    setScore(calculatedScore);
    import('leaflet').then((L) => {
      if (guessMarkerRef.current) {
        guessMarkerRef.current.bindPopup(`<b>Your Guess (Submitted)</b><br>Lat: ${tempGuess.lat.toFixed(6)}<br>Lng: ${tempGuess.lng.toFixed(6)}<br>Distance: ${formatDistance(distance)}<br>Score: ${calculatedScore}/5000`).openPopup();
        guessMarkerRef.current.dragging?.disable();
      }
    });
    if (onGuess) onGuess(calculatedScore, tempGuess.lat, tempGuess.lng); // Pass coordinates to parent
  };

  // Handle showing both markers when round ends (showAnswer = true)
  useEffect(() => {
    if (!mapReady || !mapRef.current || !location) return;
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

      if (showAnswer) {
        // Add answer marker
        answerMarkerRef.current = L.marker([correctLat, correctLng])
          .addTo(mapRef.current)
          .bindPopup(`<b>✓ Correct Location</b><br>${location.title}<br>Lat: ${correctLat.toFixed(6)}<br>Lng: ${correctLng.toFixed(6)}`)
          .openPopup();

        // If userGuess is provided from parent, use that
        let guessCoords = userGuess;
        if (!guessCoords && submittedGuess) guessCoords = submittedGuess;

        if (guessCoords) {
          // Add guess marker (recreate it)
          if (guessMarkerRef.current) mapRef.current.removeLayer(guessMarkerRef.current);
          guessMarkerRef.current = L.marker([guessCoords.lat, guessCoords.lng])
            .addTo(mapRef.current)
            .bindPopup(`<b>Your Guess</b><br>Lat: ${guessCoords.lat.toFixed(6)}<br>Lng: ${guessCoords.lng.toFixed(6)}`)
            .openPopup();

          // Draw line
          const latlngs = [[guessCoords.lat, guessCoords.lng], [correctLat, correctLng]];
          lineRef.current = L.polyline(latlngs, { color: '#FFFFFF', weight: 3, opacity: 0.8 }).addTo(mapRef.current);

          // Fit bounds to show both markers
          const bounds = L.latLngBounds([correctLat, correctLng], [guessCoords.lat, guessCoords.lng]);
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        } else {
          mapRef.current.setView([correctLat, correctLng], 18);
        }
      } else {
        // Reset for new round
        setTempGuess(null);
        setSubmittedGuess(null);
        setScore(null);
        if (guessMarkerRef.current) {
          mapRef.current.removeLayer(guessMarkerRef.current);
          guessMarkerRef.current = null;
        }
        mapRef.current.setView([correctLat, correctLng], 18);
      }
    };
    showMarkers();
  }, [showAnswer, location, userGuess, mapReady]); // Now depends on userGuess from parent

  if (!location) return <div className="loading">Loading map...</div>;

  return (
    <div className="map-wrapper">
      <div id="map" className="map-container-leaflet"></div>

      {tempGuess && !submittedGuess && !showAnswer && (
        <div className="guess-info-panel">
          <div className="guess-info-title">Pending Guess</div>
          <div className="guess-info-detail">
            Lat: {tempGuess.lat.toFixed(6)}<br />
            Lng: {tempGuess.lng.toFixed(6)}
          </div>
          <button onClick={handleSubmit} className="btn-submit">Submit Guess</button>
        </div>
      )}

      {submittedGuess && !showAnswer && score !== null && (
        <div className="score-panel">
          <div className="score-title">✓ Guess Submitted!</div>
          <div className="score-detail">Distance: {formatDistance(calculateDistance(submittedGuess.lat, submittedGuess.lng, location.latitude, location.longitude))}</div>
          <div className="score-value">Score: {score} / 5000</div>
          <div className="score-waiting">Waiting for next round...</div>
        </div>
      )}
    </div>
  );
}