
import React, { useState, useEffect } from 'react';
import { GameState, PlayerStats } from './types';
import { INITIAL_PLAYER_STATS } from './constants';
import IntroScreen from './components/IntroScreen';
import MainMenu from './components/MainMenu';
import MapSelection from './components/MapSelection';
import Battlefield from './components/Battlefield';
import { RotateCw } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.INTRO);
  const [playerStats, setPlayerStats] = useState<PlayerStats>(INITIAL_PLAYER_STATS);
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    window.addEventListener('resize', checkOrientation);
    checkOrientation();
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

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
    <div className="w-full h-screen overflow-hidden bg-slate-900 text-white relative">
      {/* Landscape Warning Overlay */}
      {isPortrait && gameState !== GameState.INTRO && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-8 text-center backdrop-blur-xl">
          <div className="bg-indigo-500/20 p-6 rounded-full animate-bounce mb-6">
            <RotateCw size={64} className="text-indigo-400" />
          </div>
          <h2 className="text-3xl font-black header-font italic tracking-tighter mb-2">LANDSCAPE MODE REQUIRED</h2>
          <p className="text-slate-400 font-medium">Please rotate your device to the side to command your Slime Army!</p>
          <div className="mt-8 flex space-x-2">
            <div className="w-12 h-8 border-2 border-indigo-400 rounded-md"></div>
            <div className="w-2 h-8 bg-indigo-400/20 rounded-full"></div>
          </div>
        </div>
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
