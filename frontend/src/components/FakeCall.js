// src/components/FakeCall.js

import React,{} from 'react';
import './FakeCall.css';
import ringtone from '../assets/ringtone.mp3'; 
import conversation from '../assets/conversation.mp3';
import { Phone, PhoneMissed, PhoneOff } from 'lucide-react'; // For icons (optional)

const ringtoneAudio = new Audio(ringtone);
ringtoneAudio.loop = true;
const conversationAudio = new Audio(conversation);

const FakeCall = ({ callerName = "Maa", onEndCall }) => {
  const [callStatus, setCallStatus] = React.useState('ringing');
  const [callTimer, setCallTimer] = React.useState(0);

  React.useEffect(() => {
    ringtoneAudio.play();

    return () => {
      ringtoneAudio.pause();
      ringtoneAudio.currentTime = 0;
      conversationAudio.pause();
      conversationAudio.currentTime = 0;
    };
  }, []);

  React.useEffect(() => {
    let interval;
    if (callStatus === 'accepted') {
      interval = setInterval(() => {
        setCallTimer(prevTime => prevTime + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const handleAccept = () => {
    ringtoneAudio.pause();
    conversationAudio.play();
    setCallStatus('accepted');
  };

  const handleDecline = () => {
    onEndCall();
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60).toString().padStart(2, '0');
    const seconds = (time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  return (
    <div className="fake-call-overlay">
      <div className="fake-call-screen">
        <img 
          src="https://cdn-icons-png.flaticon.com/512/879/879835.png" 
          alt="Caller" 
          className="caller-pic" 
        />
        <h2 className="caller-name">{callerName}</h2>
        <p className="call-status">
          {callStatus === 'ringing' ? 'Incoming Call...' : formatTime(callTimer)}
        </p>

        <div className="call-actions">
          {callStatus === 'ringing' && (
            <>
              <div className="action-button-container">
                <button className="action-btn decline-btn" onClick={handleDecline}>
                  <PhoneMissed size={32} />
                </button>
                <span>Decline</span>
              </div>
              <div className="action-button-container">
                <button className="action-btn accept-btn" onClick={handleAccept}>
                  <Phone size={32} />
                </button>
                <span>Accept</span>
              </div>
            </>
          )}
          {callStatus === 'accepted' && (
             <div className="action-button-container">
                <button className="action-btn end-call-btn" onClick={handleDecline}>
                  <PhoneOff size={32} />
                </button>
                <span>End Call</span>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FakeCall;