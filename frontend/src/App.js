import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { storage, database } from './firebase'; 
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as databaseRef, set } from "firebase/database"; 
import './App.css';
import FakeCall from './components/FakeCall';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function App() {
  const [showFakeCall, setShowFakeCall] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ message: "Say 'Help Me' to trigger the alert.", type: '' });
  const [isTracking, setIsTracking] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognitionRef = useRef(null);
  const commandTriggeredRef = useRef(false);
  const locationWatchIdRef = useRef(null);

  // --- Fake Call Feature Functions ---
  const triggerFakeCall = () => {
    console.log("Fake call will trigger in 10 seconds...");
    setTimeout(() => {
      setShowFakeCall(true);
    }, 10000);
  };

  const handleEndCall = () => {
    setShowFakeCall(false);
    console.log("Fake call ended.");
  };

  // --- This is the key fix ---
  const captureAndUploadImage = async () => {
    return new Promise((resolve, reject) => {
      if (!videoRef.current || !canvasRef.current) {
        return reject(new Error("Media refs not available"));
      }

      setStatus({ message: 'Capturing evidence...', type: '' });
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      const captureFrame = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
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
      };

      // The webcam stream might take a moment to be ready.
      // We check if it has data. If not, we wait for the 'loadeddata' event.
      if (video.readyState >= 3) { // readyState 3 or 4 means it has data
        captureFrame();
      } else {
        video.onloadeddata = () => {
          captureFrame();
        };
      }
    });
  };

  const stopLocationWatch = () => {
    if (locationWatchIdRef.current) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
    }
    setIsTracking(false);
    setStatus({ message: "Live location sharing stopped.", type: '' });
    setTimeout(() => {
      setStatus({ message: "Say 'Help Me' to trigger the alert.", type: '' });
    }, 3000);
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

  // This useEffect handles webcam start and location cleanup ONCE
  useEffect(() => {
    startWebcam();
    return () => {
      if (locationWatchIdRef.current) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
      }
    };
  }, []);

  // This useEffect ONLY controls the speech recognition lifecycle.
  useEffect(() => {
    if (!SpeechRecognition) return;

    if (isTracking) {
      if (recognitionRef.current) recognitionRef.current.stop();
      return;
    }

    if (!recognitionRef.current) {
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
          handleSOSClick();
        }
      };
      recognition.onerror = (event) => {
        if (event.error !== 'aborted') console.error("Speech recognition error:", event.error);
      };
      recognition.onend = () => {
        try {
          if (!isTracking) recognition.start();
        } catch(e) {/* ignore */}
      };
    }
    
    try {
      recognitionRef.current.start();
    } catch(e) {/* ignore */}

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isTracking, isLoading, handleSOSClick]); 

  return (
    <div className="App">
      <video 
        ref={videoRef} 
        autoPlay 
        muted 
        style={{ 
          position: 'absolute', 
          opacity: 0, 
          width: '1px', 
          height: '1px',
          zIndex: -1 
        }}
      ></video>
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

      {/* Show Fake Call screen when active */}
      {showFakeCall && <FakeCall onEndCall={handleEndCall} />}

      <h1 className="title">SafeHer</h1>
      
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

      <hr style={{width: '80%', margin: '40px 0'}}/>

        {/* Fake Call Button and Text */}
        <p>Click the button below to schedule a fake call in 10 seconds.</p>
        <button 
          onClick={triggerFakeCall} 
          disabled={showFakeCall}
          style={{ padding: '15px 30px', fontSize: '18px', cursor: 'pointer' }}
        >
          Activate Fake Call
        </button>
    </div>
  );
}

export default App;