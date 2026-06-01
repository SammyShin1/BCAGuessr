'use client';
import './Map.css';
import { useState, useEffect, useRef } from 'react';

export default function Map({ onGuess, location, showAnswer }) {
	const mapRef = useRef(null);
	const markerRef = useRef(null);
	const [clickPosition, setClickPosition] = useState(null);

	const PREDEFINED_POINT = {
		lat: 40.90214044934155,
		lng: -74.03417229652406,
		name: "Bergen County Academies"
	};

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
		const distanceMeters = distanceKm * 1000
		if (distanceMeters <= 2) return 5000
		const score = Math.round(4999 * Math.exp(-(distanceMeters - 2) / 100))
		return Math.max(0, score)
	}

	const formatDistance = (distance) => {
		if (distance < 1) {
			return `${(distance * 1000).toFixed(0)} meters`;
		}
		return `${distance.toFixed(2)} km`;
	};

	useEffect(() => {
		import('leaflet').then((L) => {
			if (!mapRef.current) {
				// Initialize the map
				mapRef.current = L.map('map', {
					maxBounds: [
						[40.899799, -74.036694],  // Southwest: [lat, lng]
						[40.903955, -74.029924]   // Northeast: [lat, lng]
					],
					minZoom: 18,
					maxZoom: 22,
					maxBoundsViscosity: 1.0
				}).setView([PREDEFINED_POINT.lat, PREDEFINED_POINT.lng], 19); // Start at zoom 19

				L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
					maxBounds: [
						[40.899799, 40.903955],
						[-74.036694, -74.029924]
					],
					minZoom: 18,
					maxZoom: 22,
					maxBoundsViscosity: 1.0,
					subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
					attribution: '&copy; <a href="https://www.google.com/maps">Google</a>'
				}).addTo(mapRef.current);

				mapRef.current.on('click', (e) => {
					const { lat, lng } = e.latlng;

					if (markerRef.current) {
						mapRef.current.removeLayer(markerRef.current);
					}

					markerRef.current = L.marker([lat, lng])
						.addTo(mapRef.current)
						.bindPopup(`<b>Your Guess</b><br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}`)
						.openPopup();

					const distance = calculateDistance(lat, lng, PREDEFINED_POINT.lat, PREDEFINED_POINT.lng);
					const score = calculateScore(distance)
					setClickPosition({ lat, lng, distance, score })
				});
			}
		});

		return () => {
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
			}
		};
	}, []);

	return <div id="map"></div>;
}

