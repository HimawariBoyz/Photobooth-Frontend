import { useContext } from 'react';
import { SoundContext } from '../contexts/SoundContext';

const useSound = () => {
    const context = useContext(SoundContext);

    if (context === null) {
        throw new Error('useSound must be used within a SoundProvider');
    }

    return context;
};

export default useSound;
