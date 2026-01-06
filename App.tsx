
import React, { useState, useEffect, useRef } from 'react';
import { GameState, PlayerStats } from './types';
import { INITIAL_PLAYER_STATS } from './constants';
import IntroScreen from './components/IntroScreen';
import MainMenu from './components/MainMenu';
import MapSelection from './components/MapSelection';
import Battlefield from './components/Battlefield';
import { RotateCw, Volume2, VolumeX } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.INTRO);
  const [playerStats, setPlayerStats] = useState<PlayerStats>(INITIAL_PLAYER_STATS);
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', checkOrientation);
    checkOrientation();
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Ambient Fantasy Sound Engine
  useEffect(() => {
    if (gameState === GameState.INTRO) return;

    const startAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        masterGainRef.current = audioContextRef.current.createGain();
        masterGainRef.current.connect(audioContextRef.current.destination);
        masterGainRef.current.gain.value = isMuted ? 0 : 0.15;
        
        // Simple ambient pad generator
        const playPad = (freq: number, delay: number) => {
          if (!audioContextRef.current || !masterGainRef.current) return;
          const osc = audioContextRef.current.createOscillator();
          const g = audioContextRef.current.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, audioContextRef.current.currentTime);
          g.gain.setValueAtTime(0, audioContextRef.current.currentTime);
          g.gain.linearRampToValueAtTime(0.3, audioContextRef.current.currentTime + 4);
          g.gain.linearRampToValueAtTime(0, audioContextRef.current.currentTime + 10);
          osc.connect(g);
          g.connect(masterGainRef.current);
          osc.start();
          osc.stop(audioContextRef.current.currentTime + 10);
        };

        const interval = setInterval(() => {
          const notes = [220, 261.63, 329.63, 392]; // Am7 chord
          playPad(notes[Math.floor(Math.random() * notes.length)], 0);
        }, 6000);

        return () => clearInterval(interval);
      }
    };

    window.addEventListener('click', startAudio, { once: true });
    return () => window.removeEventListener('click', startAudio);
  }, [gameState, isMuted]);

  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.setTargetAtTime(isMuted ? 0 : 0.15, audioContextRef.current?.currentTime || 0, 0.1);
    }
  }, [isMuted]);

  const startGame = (level: number) => {
    setSelectedLevel(level);
    setGameState(GameState.BATTLE);
  };

  const handleWin = () => {
    setPlayerStats(prev => ({
      ...prev,
      diamonds: prev.diamonds + 100,
      purpleCrystals: prev.purpleCrystals + 50,
      currentLevel: Math.max(prev.currentLevel, selectedLevel + 1)
    }));
    setGameState(GameState.MAP_SELECTION);
  };

  const handleLose = () => {
    setGameState(GameState.MAP_SELECTION);
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-slate-900 text-white relative font-sans">
      {/* Landscape Warning Overlay */}
      {isPortrait && gameState !== GameState.INTRO && (
        <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-center p-8 text-center backdrop-blur-xl">
          <div className="bg-indigo-500/20 p-6 rounded-full animate-bounce mb-6">
            <RotateCw size={64} className="text-indigo-400" />
          </div>
          <h2 className="text-3xl font-black header-font italic tracking-tighter mb-2 uppercase">LANDSCAPE REQUIRED</h2>
          <p className="text-slate-400 font-medium">Rotate your device to command your Slime Army!</p>
          <div className="mt-8 flex space-x-2">
            <div className="w-12 h-8 border-2 border-indigo-400 rounded-md"></div>
            <div className="w-2 h-8 bg-indigo-400/20 rounded-full"></div>
          </div>
        </div>
      )}

      {/* Audio Toggle Control */}
      {gameState !== GameState.INTRO && (
        <button 
          onClick={() => setIsMuted(!isMuted)}
          className="fixed bottom-4 left-4 z-[200] p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white/60 hover:text-white transition-all shadow-xl active:scale-90"
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      )}

      {gameState === GameState.INTRO && (
        <IntroScreen onComplete={() => setGameState(GameState.LANDING)} />
      )}
      
      {gameState === GameState.LANDING && (
        <MainMenu 
          stats={playerStats} 
          onPlay={() => setGameState(GameState.MAP_SELECTION)} 
        />
      )}

      {gameState === GameState.MAP_SELECTION && (
        <MapSelection 
          stats={playerStats} 
          onBack={() => setGameState(GameState.LANDING)}
          onStartLevel={startGame}
        />
      )}

      {gameState === GameState.BATTLE && (
        <Battlefield 
          level={selectedLevel}
          playerStats={playerStats}
          onWin={handleWin}
          onLose={handleLose}
        />
      )}
    </div>
  );
};

export default App;
