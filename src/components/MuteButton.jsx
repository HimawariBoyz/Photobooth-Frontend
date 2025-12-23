import React from 'react';
import useSound from '../hooks/useSound';

function MuteButton() {
    const { isMuted, toggleMute, playClick } = useSound();

    const handleClick = () => {
        playClick(); // This will only play if not muted (logic in context)
        toggleMute();
    };

    return (
        <button
            onClick={handleClick}
            className="mute-btn"
            title={isMuted ? "Unmute Sound" : "Mute Sound"}
            style={{
                position: 'fixed',
                bottom: '20px',
                left: '20px',
                zIndex: 9999,
                background: 'rgba(255, 255, 255, 0.9)',
                border: 'none',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                transition: 'transform 0.2s ease, background 0.2s ease'
            }}
        >
            {isMuted ? (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                    <path d="M9 9v6a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
            ) : (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#D42426" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
            )}
        </button>
    );
}

export default MuteButton;
