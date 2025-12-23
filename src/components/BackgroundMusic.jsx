import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import bgmUrl from '../assets/sounds/Aetheric - Vienne Carol Nights (freetouse.com).mp3';

const BackgroundMusic = () => {
    const location = useLocation();
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        // Logic: Play everywhere EXCEPT '/booth'
        const shouldPlay = location.pathname !== '/booth';

        if (shouldPlay) {
            if (audio.paused) {
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => setIsPlaying(true))
                        .catch(error => {
                            console.log("Autoplay prevented:", error);
                            setIsPlaying(false);
                        });
                }
            }
        } else {
            // If we are in '/booth', pause the music
            audio.pause();
            setIsPlaying(false);
        }
    }, [location.pathname]);

    // Initial volume setup
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = 0.3; // 30% volume
        }
    }, []);

    return (
        <div className="bg-music-control" style={{ position: 'fixed', bottom: '10px', left: '10px', zIndex: 9999 }}>
            <audio ref={audioRef} src={bgmUrl} loop />
            {/* Optional: Small mute button if user wants to stop it manually */}
            {!isPlaying && location.pathname !== '/booth' && (
                <button
                    onClick={() => {
                        audioRef.current?.play();
                        setIsPlaying(true);
                    }}
                    style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: '1px solid white',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '16px'
                    }}
                    title="Play Music"
                >
                    🎵
                </button>
            )}
        </div>
    );
};

export default BackgroundMusic;
