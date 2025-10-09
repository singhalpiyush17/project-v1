// src/App.js (Final Version with Race Condition Fix)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import './App.css';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ message: "Say 'Help Me' to trigger the alert.", type: '' });
  const [isListening, setIsListening] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognitionRef = useRef(null);
  // --- FIX 1: Add a ref to act as an instant flag ---
  const commandTriggeredRef = useRef(false);

  const handleSOSClick = useCallback(() => {
    // This function is now simpler, the isLoading check is handled by the caller
    if (!navigator.geolocation) {
      setStatus({ message: 'Geolocation is not supported by your browser.', type: 'error' });
      return;
    }

    setIsLoading(true);
    setStatus({ message: 'SOS Triggered! Getting location...', type: '' });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        sendAlert(latitude, longitude);
      },
      () => {
        setStatus({ message: 'Unable to retrieve your location. Please enable location services.', type: 'error' });
        setIsLoading(false);
      }
    );
  }, []); // isLoading is no longer needed here as a dependency

  useEffect(() => {
    startWebcam();

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');
        
        console.log("Transcript:", transcript);

        // --- FIX 2: Use the instant flag to prevent multiple triggers ---
        if (transcript.toLowerCase().includes('help me') && !isLoading && !commandTriggeredRef.current) {
          // Raise the flag immediately
          commandTriggeredRef.current = true; 
          console.log("Help command detected!");
          handleSOSClick();
        }
      };

      recognition.onerror = (event) => {
        // The 'aborted' error is expected when we stop it, so we can ignore it.
        if (event.error !== 'aborted') {
          console.error("Speech recognition error:", event.error);
        }
      };
      
      recognition.onend = () => {
        if (isListening) {
          recognition.start();
        }
      };
      
      recognition.start();
      setIsListening(true);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        setIsListening(false);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [isListening, isLoading, handleSOSClick]); 

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

  const sendAlert = async (latitude, longitude) => {
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
      // This is the change: Reset to the instructional message.
      setTimeout(() => {
        setStatus({ message: "Say 'Help Me' to trigger the alert.", type: '' });
      }, 4000); // Wait 4 seconds before resetting the message
    }
  };

  const captureAndUploadImage = async () => {
    return new Promise((resolve, reject) => {
      if (!videoRef.current || !canvasRef.current) return reject(new Error("Media refs not available"));
  
      setStatus({ message: 'Capturing evidence...', type: '' });
      const video = videoRef.current;
      const canvas = canvasRef.current;
  
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
  
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
  
      canvas.toBlob(async (blob) => {
        if (!blob) return reject(new Error("Canvas to Blob failed."));
        
        try {
          const uniqueFileName = `evidence_${Date.now()}.jpg`;
          const storageRef = ref(storage, `images/${uniqueFileName}`);
          
          console.log("Uploading image to Firebase Storage...");
          await uploadBytes(storageRef, blob);
          const downloadURL = await getDownloadURL(storageRef);
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

  return (
    <div className="App">
      <video ref={videoRef} autoPlay muted style={{ display: 'none' }}></video>
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

      <h1 className="title">Project V1</h1>
      <button 
        className="sos-button" 
        onClick={handleSOSClick}
        disabled={isLoading}
      >
        {isLoading ? '...' : 'SOS'}
      </button>
      <p className={`status-message ${status.type}`}>
        {status.message}
      </p>
    </div>
  );
}

export default App;