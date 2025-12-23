import { createContext, useState, useRef, useEffect, useCallback } from 'react';
import bgmUrl from '../assets/sounds/Aetheric - Vienne Carol Nights (freetouse.com).mp3';
import clickSoundUrl from '../assets/sounds/click.mp3';
import snapSoundUrl from '../assets/sounds/snap.mp3';
import jingleSoundUrl from '../assets/sounds/jingle.mp3';

export const SoundContext = createContext(null);

export const SoundProvider = ({ children }) => {
    const [isBgmPlaying, setIsBgmPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false); // State for global mute
    const bgmRef = useRef(null);
    const audioContextRef = useRef(null);

    // Initialize BGM
    useEffect(() => {
        bgmRef.current = new Audio(bgmUrl);
        bgmRef.current.loop = true;
        bgmRef.current.volume = 0.3; // Default volume for background music

        return () => {
            if (bgmRef.current) {
                bgmRef.current.pause();
                bgmRef.current = null;
            }
        };
    }, []);

    // Effect to handle Mute for BGM
    useEffect(() => {
        if (bgmRef.current) {
            bgmRef.current.muted = isMuted;
        }
    }, [isMuted]);

    const startBgm = useCallback(() => {
        if (bgmRef.current && bgmRef.current.paused) {
            bgmRef.current.play()
                .then(() => setIsBgmPlaying(true))
                .catch(e => console.log("Audio autoplay failed, waiting for interaction:", e));
        }
    }, []);

    const pauseBgm = useCallback(() => {
        if (bgmRef.current) {
            bgmRef.current.pause();
            setIsBgmPlaying(false);
        }
    }, []);

    const toggleBgm = useCallback(() => {
        if (isBgmPlaying) {
            pauseBgm();
        } else {
            startBgm();
        }
    }, [isBgmPlaying, pauseBgm, startBgm]);

    // Toggle Global Mute
    const toggleMute = useCallback(() => {
        setIsMuted(prev => !prev);
    }, []);

    // Initial user interaction handler
    const handleUserInteraction = useCallback(() => {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
        startBgm();
    }, [startBgm]);

    // --- SFX Logic ---

    const getContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioContextRef.current;
    }, []);

    const playFallback = useCallback((type) => {
        // If muted, do not play fallback
        if (isMuted) return;

        try {
            const ctx = getContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            const now = ctx.currentTime;

            if (type === 'click') {
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'snap') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
                gain.gain.setValueAtTime(1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'jingle') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1000, now);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
                osc.start(now);
                osc.stop(now + 1.5);
            }
        } catch (e) {
            console.warn("Fallback sound failed:", e);
        }
    }, [getContext, isMuted]);

    const playSound = useCallback((url, type, volume = 1.0) => {
        // Ensure AudioContext is ready
        handleUserInteraction();

        // If muted, do not play file sound
        if (isMuted) return;

        try {
            const audio = new Audio(url);
            audio.volume = volume;
            const playPromise = audio.play();

            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    playFallback(type);
                });
            }
        } catch (e) {
            playFallback(type);
        }
    }, [handleUserInteraction, playFallback, isMuted]);

    // Exposed SFX functions
    const playClick = useCallback(() => playSound(clickSoundUrl, 'click', 0.5), [playSound]);
    const playSnap = useCallback(() => playSound(snapSoundUrl, 'snap', 1.0), [playSound]);
    const playJingle = useCallback(() => playSound(jingleSoundUrl, 'jingle', 0.4), [playSound]);

    // Explicit Back and Select sounds (using Click logic for now unless separated later)
    const playBack = useCallback(() => playSound(clickSoundUrl, 'click', 0.5), [playSound]);
    const playSelect = useCallback(() => playSound(clickSoundUrl, 'click', 0.5), [playSound]);


    return (
        <SoundContext.Provider value={{
            isBgmPlaying,
            isMuted,
            startBgm,
            pauseBgm,
            toggleBgm,
            toggleMute,
            playClick,
            playSnap,
            playJingle,
            playBack,
            playSelect
        }}>
            {/* We attach a global listener to document to catch the first interaction */}
            <div onClick={handleUserInteraction} onKeyDown={handleUserInteraction} style={{ display: 'contents' }}>
                {children}
            </div>
        </SoundContext.Provider>
    );
};
