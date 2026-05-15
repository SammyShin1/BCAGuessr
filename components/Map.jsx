// components/Map.jsx
'use client';
import './Map.css';
import { useState, useEffect, useRef } from 'react';

export default function Map() {
	const mapRef = useRef(null);
	const markerRef = useRef(null); // Store current marker
	const [clickPosition, setClickPosition] = useState(null);

	const PREDEFINED_POINT = {
		lat: 40.90214044934155,
		lng: -74.03417229652406,
		name: "Bergen County Academies"
	};

	const calculateDistance = (lat1, lng1, lat2, lng2) => {
		const R = 6371; // Earth's radius in kilometers
		const dLat = (lat2 - lat1) * Math.PI / 180;
		const dLng = (lng2 - lng1) * Math.PI / 180;
		const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
			Math.sin(dLng / 2) * Math.sin(dLng / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		const distance = R * c;
		return distance;
	};

	const formatDistance = (distance) => {
		if (distance < 1) {
			return `${(distance * 1000).toFixed(0)} meters`;
		}
		return `${distance.toFixed(2)} km`;
	};

	useEffect(() => {
		// Dynamically import Leaflet JS only when needed
		import('leaflet').then((L) => {
			// Check if map already exists
			if (!mapRef.current) {
				// Initialize the map
				mapRef.current = L.map('map').setView([40.90214044934155, -74.03417229652406], 18);

				// Add tile layer
				L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
					maxZoom: 22,
					subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
					attribution: '&copy; <a href="https://www.google.com/maps">Google</a>'
				}).addTo(mapRef.current);

				const predefinedMarker = L.marker([PREDEFINED_POINT.lat, PREDEFINED_POINT.lng])
					.addTo(mapRef.current)
					.bindPopup(`<b>${PREDEFINED_POINT.name}</b><br>This is where I do all my training.`)
					.openPopup();
				// Handle map clicks
				mapRef.current.on('click', (e) => {
					const { lat, lng } = e.latlng;

					// Remove existing marker if it exists
					if (markerRef.current) {
						mapRef.current.removeLayer(markerRef.current);
					}

					// Create new marker
					markerRef.current = L.marker([lat, lng])
						.addTo(mapRef.current)
						.bindPopup(`
						<b>Clicked Location</b><br>
						Lat: ${lat.toFixed(6)}<br>
						Lng: ${lng.toFixed(6)}
						`)
						.openPopup();

					// Calculate distance to predefined point
					const distance = calculateDistance(
						lat, lng,
						PREDEFINED_POINT.lat, PREDEFINED_POINT.lng
					);

					// Log to console
					console.log(`Clicked location: [${lat.toFixed(6)}, ${lng.toFixed(6)}]`);
					console.log(`Distance to ${PREDEFINED_POINT.name || 'predefined point'}: ${formatDistance(distance)}`);
					console.log(`(${distance.toFixed(3)} km)`);

					// Update state (optional, if you want to display on screen)
					setClickPosition({ lat, lng, distance });
				});
			}
		});

		// Cleanup
		return () => {
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
			}
		};
	}, []);

	return <div id="map"></div>;
}

// logging movement
// mapRef.current.on('moveend', function() {
//   const center = mapRef.current.getCenter();
//   const zoom = mapRef.current.getZoom();
//   console.log('Map position changed:');
//   console.log(`Latitude: ${center.lat}`);
//   console.log(`Longitude: ${center.lng}`);
//   console.log(`Zoom level: ${zoom}`);
//   console.log('---');
// });