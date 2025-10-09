import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { storage, database } from './firebase'; 
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as databaseRef, set } from "firebase/database"; 
import './App.css';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ message: "Say 'Help Me' to trigger the alert.", type: '' });
  const [isListening, setIsListening] = useState(true); 
  const [isTracking, setIsTracking] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognitionRef = useRef(null);
  const commandTriggeredRef = useRef(false);
  const locationWatchIdRef = useRef(null);

  const stopLocationWatch = () => {
    if (locationWatchIdRef.current) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
      setIsTracking(false);
      setStatus({ message: "Live location sharing stopped.", type: '' });
      setTimeout(() => {
        setStatus({ message: "Say 'Help Me' to trigger the alert.", type: '' });
      }, 3000);
    }
  };

  const sendAlert = useCallback(async (latitude, longitude) => {
    try {
      await captureAndUploadImage();
      setStatus({ message: 'Location found! Sending alert...', type: '' });
      const backendUrl = 'http://localhost:5000/api/sos';
      await axios.post(backendUrl, { latitude, longitude });
      setStatus({ message: 'SOS Alert Sent Successfully!', type: 'success' });
    } catch (error) {
      console.error('Error in SOS process:', error);
      setStatus({ message: 'An error occurred during the SOS process.', type: 'error' });
    } finally {
      setIsLoading(false);
      commandTriggeredRef.current = false;
    }
  }, []);

  const handleSOSClick = useCallback(() => {
    if (isLoading) return;
    if (!navigator.geolocation) {
      setStatus({ message: 'Geolocation is not supported.', type: 'error' });
      return;
    }
    setIsLoading(true);
    setStatus({ message: 'SOS Triggered! Getting location...', type: '' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        sendAlert(latitude, longitude);
        const sessionId = Date.now();
        setIsTracking(true); 
        locationWatchIdRef.current = navigator.geolocation.watchPosition(
          (newPosition) => {
            console.log("Updating location...");
            const { latitude, longitude } = newPosition.coords;
            set(databaseRef(database, 'sessions/' + sessionId), {
              lat: latitude,
              lng: longitude,
              timestamp: Date.now()
            });
          },
          (error) => console.error("Error watching position:", error),
          { enableHighAccuracy: true }
        );
      },
      () => {
        setStatus({ message: 'Unable to retrieve location.', type: 'error' });
        setIsLoading(false);
      }
    );
  }, [isLoading, sendAlert]);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing webcam/microphone:", err);
      setStatus({ message: 'Camera/Mic access denied. Features will not work.', type: 'error' });
    }
  };

  const captureAndUploadImage = async () => {
    return new Promise((resolve, reject) => {
      if (!videoRef.current || !canvasRef.current) return reject(new Error("Media refs not available"));
      setStatus({ message: 'Capturing evidence...', type: '' });
      const video = videoRef.current; const canvas = canvasRef.current;
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        if (!blob) return reject(new Error("Canvas to Blob failed."));
        try {
          const uniqueFileName = `evidence_${Date.now()}.jpg`;
          const sRef = storageRef(storage, `images/${uniqueFileName}`);
          console.log("Uploading image to Firebase Storage...");
          await uploadBytes(sRef, blob);
          const downloadURL = await getDownloadURL(sRef);
          console.log("File available at", downloadURL);
          setStatus({ message: 'Evidence captured and uploaded!', type: 'success' });
          resolve();
        } catch (error) {
          console.error("Error uploading to Firebase:", error);
          setStatus({ message: 'Failed to upload evidence.', type: 'error' });
          reject(error);
        }
      }, 'image/jpeg');
    });
  };

  useEffect(() => {
    startWebcam();
    if (isListening && SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results).map(result => result[0]).map(result => result.transcript).join('');
        console.log("Transcript:", transcript);
        if (transcript.toLowerCase().includes('help me') && !isLoading && !commandTriggeredRef.current) {
          commandTriggeredRef.current = true;
          console.log("Help command detected!");
          handleSOSClick();
        }
      };
      recognition.onerror = (event) => {
        if (event.error !== 'aborted') console.error("Speech recognition error:", event.error);
      };
      recognition.onend = () => {
        if (isListening) recognition.start();
      };
      recognition.start();
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening, isLoading, handleSOSClick]);

  useEffect(() => {
    return () => {
      if (locationWatchIdRef.current) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
      }
    };
  }, []);

  return (
    <div className="App">
      <video ref={videoRef} autoPlay muted style={{ display: 'none' }}></video>
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
      <h1 className="title">Project V1</h1>
      
      {!isTracking ? (
        <button 
          className="sos-button" 
          onClick={handleSOSClick}
          disabled={isLoading}
        >
          {isLoading ? '...' : 'SOS'}
        </button>
      ) : (
        <button 
          className="reset-button stop-button"
          onClick={stopLocationWatch}
        >
          Stop Sharing
        </button>
      )}

      <p className={`status-message ${status.type}`}>
        {status.message}
      </p>
    </div>
  );
}

export default App;