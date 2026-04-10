import { useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook that plays a siren/alert sound from an audio file.
 * 
 * Place your audio file at:  public/sounds/siren.mp3
 * 
 * Supported formats: .mp3, .wav, .ogg, .webm
 * 
 * @param {string} src - Path to the audio file (relative to public/)
 * @returns {{ play: () => void, stop: () => void }}
 */
export default function useSirenSound(src = '/sounds/siren.mp3') {
  const audioRef = useRef(null);
  const isPlayingRef = useRef(false);

  // Lazily create the Audio element
  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio(src);
      audio.loop = true;      // Loop until explicitly stopped
      audio.volume = 0.5;     // Default volume (0.0 – 1.0)
      audio.preload = 'auto';
      audioRef.current = audio;
    }
    return audioRef.current;
  }, [src]);

  const play = useCallback(() => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    try {
      const audio = getAudio();
      audio.currentTime = 0;
      audio.play().catch((err) => {
        console.warn('Siren sound failed to play:', err);
        isPlayingRef.current = false;
      });
    } catch (e) {
      console.warn('Siren sound failed to initialize:', e);
      isPlayingRef.current = false;
    }
  }, [getAudio]);

  const stop = useCallback(() => {
    if (!isPlayingRef.current) return;
    isPlayingRef.current = false;

    try {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    } catch (_) { /* ignore */ }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      if (audioRef.current) {
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [stop]);

  return { play, stop };
}
