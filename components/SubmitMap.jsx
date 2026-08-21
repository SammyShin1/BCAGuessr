'use client';

import { useEffect, useRef, useState } from 'react';

const BCA_BOUNDS = [
  [40.8990, -74.0380],
  [40.9055, -74.0305],
];

export default function SubmitMap({ latitude, longitude, editable, onChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let disposed = false;

    async function initMap() {
      if (!containerRef.current || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      const L = await import('leaflet');
      if (disposed) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      mapRef.current = L.map(containerRef.current, {
        maxBounds: BCA_BOUNDS,
        maxBoundsViscosity: 0.75,
        minZoom: 18,
        maxZoom: 22,
      }).setView([latitude, longitude], 19);

      L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 22,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; <a href="https://www.google.com/maps">Google</a>',
      }).addTo(mapRef.current);

      markerRef.current = L.marker([latitude, longitude], { draggable: editable })
        .addTo(mapRef.current)
        .bindPopup('Submission location')
        .openPopup();

      markerRef.current.on('dragend', function () {
        const pos = this.getLatLng();
        onChange?.({ latitude: pos.lat, longitude: pos.lng });
      });

      mapRef.current.on('click', (event) => {
        if (!editable) return;
        const next = { latitude: event.latlng.lat, longitude: event.latlng.lng };
        markerRef.current.setLatLng([next.latitude, next.longitude]).openPopup();
        onChange?.(next);
      });

      setMapReady(true);
    }

    initMap();

    return () => {
      disposed = true;
      setMapReady(false);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
    };
  }, [latitude, longitude, editable, onChange]);

  useEffect(() => {
    if (!markerRef.current || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    markerRef.current.setLatLng([latitude, longitude]);
    if (mapRef.current && mapReady) {
      mapRef.current.setView([latitude, longitude], mapRef.current.getZoom());
    }
  }, [latitude, longitude, mapReady]);

  useEffect(() => {
    if (!markerRef.current) return;
    if (editable) {
      markerRef.current.dragging?.enable();
    } else {
      markerRef.current.dragging?.disable();
    }
  }, [editable]);

  return (
    <div className="submit-map-shell">
      {Number.isFinite(latitude) && Number.isFinite(longitude) ? (
        <>
          <div ref={containerRef} className="submit-map" />
          <div className="submit-map-hint">
            {editable ? 'Click the map or drag the marker to adjust.' : 'Current submission location.'}
          </div>
        </>
      ) : (
        <div className="submit-map-empty">Enter latitude and longitude to show this image on the map.</div>
      )}
    </div>
  );
}