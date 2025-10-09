// src/Tracker.js

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { database } from './firebase';
import { ref, onValue } from 'firebase/database';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const containerStyle = {
  width: '100vw',
  height: '100vh'
};

function Tracker() {
  // Get the session ID from the URL (e.g., /track/12345)
  const { sessionId } = useParams();
  const [currentPosition, setCurrentPosition] = useState(null);

  // Load the Google Maps script
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY
  });

  useEffect(() => {
    // Path to the session data in Firebase
    const sessionRef = ref(database, 'sessions/' + sessionId);

    // Subscribe to data changes
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        console.log("Received new location:", data);
        setCurrentPosition({ lat: data.lat, lng: data.lng });
      }
    });

    // Clean up the subscription when the component unmounts
    return () => {
      unsubscribe();
    };
  }, [sessionId]); // Re-run effect if sessionId changes

  if (!isLoaded) {
    return <div>Loading Map...</div>;
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={currentPosition || { lat: 28.6139, lng: 77.2090 }} // Default to a central location if no data yet
      zoom={currentPosition ? 17 : 10} // Zoom in close if we have a position
    >
      {currentPosition && (
        <Marker position={currentPosition} />
      )}
    </GoogleMap>
  );
}

export default Tracker;