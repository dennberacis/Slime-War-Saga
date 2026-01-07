import React, { useState, useEffect } from 'react';
import { PlayerStats } from '../types';
import { 
  Settings, 
  ShoppingBag, 
  Trophy, 
  User, 
  LayoutDashboard, 
  Crown, 
  Star, 
  TrendingUp,
  Boxes,
  Zap,
  Gamepad2,
  ShieldCheck,
  Banknote,
  ArrowRightLeft,
  X,
  Download,
  Gift
} from 'lucide-react';

interface MainMenuProps {
  stats: PlayerStats;
  onPlay: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ stats, onPlay }) => {
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsStandalone(true);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  return (
    <div className="h-full w-full bg-[#020617] flex flex-col relative overflow-hidden landscape:flex safe-area-inset">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#0f172a]/40 to-transparent"></div>
        <img 
          src="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=1920" 
          className="w-full h-full object-cover opacity-15 mix-blend-screen scale-105"
          alt="Battlefield"
        />
        <div className="absolute inset-0 opacity-30">
           <DancingSlime color="bg-sky-400" top="60%" left="8%" delay="0s" scale="scale-100" />
           <DancingSlime color="bg-purple-400" top="55%" left="88%" delay="0.5s" scale="scale-75" />
           <DancingSlime color="bg-emerald-400" top="72%" left="42%" delay="1s" scale="scale-110" />
        </div>
      </div>

      {/* Top HUD */}
      <div className="relative z-30 pt-4 px-6 md:pt-6 md:px-10 flex justify-between items-start">
        <div className="flex items-center space-x-3 bg-black/60 backdrop-blur-2xl p-2 rounded-2xl border border-white/10 shadow-xl hover:border-sky-500/40 transition-all cursor-pointer group active:scale-95">
          <div className="relative">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-sky-600 to-indigo-600 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg group-hover:scale-105 transition-transform">
              <User className="w-full h-full p-2 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-yellow-500 rounded-full p-0.5 md:p-1 border-2 border-slate-900">
              <Crown size={12} className="text-slate-900" />
            </div>
          </div>
          <div className="pr-2 hidden sm:block">
            <div className="flex items-center space-x-2">
              <span className="font-black text-white header-font text-[10px] md:text-sm uppercase tracking-wider">{stats.username}</span>
              <span className="bg-sky-500 px-1.5 py-0.5 rounded text-[7px] md:text-[8px] font-black text-white">LVL {stats.currentLevel}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Star size={8} className="text-yellow-400 fill-yellow-400" />
              <p className="text-[8px] md:text-[9px] font-bold text-sky-400 uppercase tracking-widest">{stats.rank}</p>
            </div>
          </div>
        </div>

        <div className="flex space-x-2 md:space-x-4">
          <WalletItem icon="💎" value={stats.diamonds} label="Blue Gems" color="text-sky-300" glow="text-sky-400" />
          <WalletItem icon="🔮" value={stats.purpleCrystals} label="PHP Gems" color="text-purple-400" glow="text-purple-500" />
          <button className="p-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-white/10 transition-all active:scale-90 group shadow-lg">
            <Settings size={20} className="text-white/60 group-hover:rotate-90 transition-transform" />
          </button>
        </div>
      </div>

      {/* Hero Center Section */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6 -mt-2">
        {/* PWA Install Promo */}
        {deferredPrompt && !isStandalone && (
          <div className="mb-6 animate-float">
            <button 
              onClick={handleInstallClick}
              className="bg-sky-500/20 backdrop-blur-xl border border-sky-400/50 rounded-full px-6 py-2.5 flex items-center space-x-3 group hover:bg-sky-500/40 transition-all shadow-lg active:scale-95"
            >
              <Gift className="text-yellow-400 animate-pulse" size={18} />
              <span className="text-[10px] md:text-xs font-black text-white uppercase tracking-widest">
                Install App to Claim <span className="text-sky-400">100 Gems Bonus!</span>
              </span>
              <Download size={14} className="text-white/60 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        )}

        <div className="text-center mb-6 md:mb-8 animate-float">
          <h1 className="text-5xl md:text-8xl font-black text-white header-font tracking-tighter italic drop-shadow-[0_0_20px_rgba(56,189,248,0.5)]">
            SLIME WAR
          </h1>
          <div className="flex items-center justify-center space-x-4 md:space-x-8 -mt-2">
            <div className="h-0.5 w-12 md:w-32 bg-gradient-to-r from-transparent via-sky-400 to-transparent"></div>
            <span className="text-sky-400 font-black uppercase tracking-[0.4em] md:tracking-[0.8em] text-sm md:text-xl">SAGA</span>
            <div className="h-0.5 w-12 md:w-32 bg-gradient-to-l from-transparent via-sky-400 to-transparent"></div>
          </div>
        </div>

        <div className="flex flex-row items-stretch space-x-4 md:space-x-8 h-20 md:h-32">
          <button 
            onClick={() => setShowModeSelector(true)}
            className="group relative flex flex-col items-center justify-center px-8 md:px-16 bg-gradient-to-b from-sky-400 to-indigo-600 rounded-[28px] md:rounded-[40px] border-b-[6px] md:border-b-[10px] border-indigo-950 transform transition-all hover:scale-105 active:scale-95 shadow-2xl"
          >
            <div className="absolute -inset-2 bg-sky-500 rounded-[40px] blur-2xl opacity-0 group-hover:opacity-30 transition-opacity"></div>
            <Gamepad2 size={24} className="md:size-10 text-white mb-0.5 md:mb-1 group-hover:rotate-12 transition-transform drop-shadow-lg" />
            <span className="text-xl md:text-4xl font-black text-white header-font tracking-wide italic uppercase drop-shadow-md">PLAY SAGA</span>
            <div className="absolute -top-3 -right-2 px-3 py-1 bg-rose-500 rounded-lg border-2 border-indigo-950 shadow-lg -rotate-6">
              <span className="text-[7px] md:text-[10px] font-black text-white uppercase italic tracking-wider">OFFLINE</span>
            </div>
          </button>
          
          <button 
            onClick={() => setShowModeSelector(true)}
            className="group relative flex flex-col items-center justify-center px-8 md:px-16 bg-gradient-to-b from-purple-500 to-indigo-700 rounded-[28px] md:rounded-[40px] border-b-[6px] md:border-b-[10px] border-indigo-950 transform transition-all hover:scale-105 active:scale-95 shadow-2xl"
          >
            <div className="absolute -inset-2 bg-purple-500 rounded-[40px] blur-2xl opacity-0 group-hover:opacity-30 transition-opacity"></div>
            <Zap size={24} className="md:size-10 text-white mb-0.5 md:mb-1 group-hover:rotate-12 transition-transform drop-shadow-lg" />
            <span className="text-xl md:text-4xl font-black text-white header-font tracking-wide italic uppercase drop-shadow-md">CONQUEST</span>
            <div className="absolute -top-3 -right-2 px-3 py-1 bg-emerald-500 rounded-lg border-2 border-indigo-950 shadow-lg rotate-6">
              <span className="text-[7px] md:text-[10px] font-black text-white uppercase italic tracking-wider">ONLINE</span>
            </div>
          </button>
        </div>
      </div>

      {/* Grid Menu */}
      <div className="relative z-30 px-6 pb-6 md:pb-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-4 md:grid-cols-7 gap-3 md:gap-6">
          <MenuButton icon={<LayoutDashboard />} label="DECK" color="bg-indigo-600" />
          <MenuButton icon={<Boxes />} label="COLLECTION" color="bg-purple-600" />
          <MenuButton icon={<ShoppingBag />} label="SHOP" color="bg-rose-600" />
          <MenuButton icon={<Trophy />} label="MISSION" color="bg-amber-600" />
          <MenuButton icon={<Star />} label="RANK" color="bg-sky-600" />
          <MenuButton 
            icon={<Banknote />} 
            label="WITHDRAW" 
            color="bg-emerald-600" 
            onClick={() => setShowWithdrawModal(true)} 
          />
          {deferredPrompt && !isStandalone ? (
            <MenuButton icon={<Download />} label="INSTALL" color="bg-sky-500 animate-pulse" onClick={handleInstallClick} />
          ) : (
            <MenuButton icon={<ShieldCheck />} label="SECURE" color="bg-slate-700" />
          )}
        </div>
      </div>

      {/* Modals */}
      {showModeSelector && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setShowModeSelector(false)}></div>
          <div className="relative w-full max-w-3xl bg-slate-900 border-2 border-white/10 rounded-[32px] md:rounded-[48px] p-6 md:p-12 shadow-2xl flex flex-col items-center">
            <h2 className="text-3xl md:text-6xl font-black text-white header-font tracking-tighter italic mb-8 md:mb-12">CHOOSE YOUR PATH</h2>
            <div className="grid grid-cols-2 gap-4 md:gap-12 w-full">
              <ModeCard 
                icon={<ShieldCheck size={48} />}
                title="CAMPAIGN"
                desc="Solo Adventure. Boss every 10 levels. Earn Blue Gems to build your army."
                color="bg-sky-600"
                onClick={() => { setShowModeSelector(false); onPlay(); }}
              />
              <ModeCard 
                icon={<TrendingUp size={48} />}
                title="CONQUEST"
                desc="Global PvP Rankings. Earn Purple Gems (PHP) and become the Slime Sovereign."
                color="bg-purple-600"
                badge="P2E LIVE"
                onClick={() => { setShowModeSelector(false); onPlay(); }}
              />
            </div>
            <button onClick={() => setShowModeSelector(false)} className="mt-8 md:mt-12 text-white/40 font-black uppercase text-xs tracking-[0.4em] hover:text-white transition-colors">Cancel Selection</button>
          </div>
        </div>
      )}

      {showWithdrawModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-lg" onClick={() => setShowWithdrawModal(false)}></div>
          <div className="relative w-full max-w-md bg-slate-900 border-2 border-purple-500/30 rounded-[32px] p-8 shadow-2xl flex flex-col items-center">
            <button onClick={() => setShowWithdrawModal(false)} className="absolute top-4 right-4 p-2 text-white/20 hover:text-white transition-colors"><X size={24} /></button>
            <div className="p-4 bg-purple-500 rounded-2xl mb-6 shadow-lg shadow-purple-500/20"><Banknote size={48} className="text-white" /></div>
            <h2 className="text-3xl font-black text-white header-font tracking-tight mb-2">WITHDRAW PHP</h2>
            <p className="text-white/40 text-center text-xs uppercase tracking-widest mb-8">Convert Purple Gems to Philippine Peso</p>
            <div className="w-full space-y-4">
              <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Available Balance</span>
                  <span className="text-2xl font-black text-purple-400 header-font italic">🔮 {stats.purpleCrystals.toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Est. Value</span>
                  <span className="block text-xl font-black text-emerald-400 header-font italic">₱{(stats.purpleCrystals / 100).toFixed(2)}</span>
                </div>
              </div>
              <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl flex items-center space-x-4">
                <ArrowRightLeft size={20} className="text-indigo-400 shrink-0" />
                <p className="text-[10px] text-indigo-300 font-bold uppercase leading-relaxed tracking-wider">Conversion Rate: 10,000 Gems = ₱100.00. Min withdrawal: 5,000 Gems.</p>
              </div>
              <button 
                className="w-full py-5 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl border-b-4 border-emerald-900 shadow-xl active:scale-95 transition-all text-white font-black header-font tracking-[0.2em] italic disabled:opacity-50 disabled:grayscale"
                disabled={stats.purpleCrystals < 5000}
              >
                REQUEST PAYOUT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Ticker */}
      <div className="relative z-20 h-10 bg-black/90 backdrop-blur-3xl flex items-center px-8 border-t border-white/5">
        <div className="flex items-center space-x-12 animate-marquee whitespace-nowrap">
           <TickerItem icon="🔮" text="10,000 Purple Gems = 100 PHP" color="text-purple-400" />
           <TickerItem icon="🛡️" text="Region 4 Frontier Boss Defeated by 'SlimeLord'!" />
           <TickerItem icon="🏆" text="Rank 1 'AzureMage' earned ₱2,500 this week!" color="text-emerald-400" />
           <TickerItem icon="💰" text="Cash out anytime with the new Withdrawal Portal!" color="text-sky-400" />
        </div>
      </div>
    </div>
  );
};

const WalletItem: React.FC<{ icon: string; value: number; label: string; color: string; glow: string }> = ({ icon, value, label, color, glow }) => (
  <div className="flex flex-col items-end bg-black/50 backdrop-blur-2xl px-3 md:px-5 py-1.5 md:py-2.5 rounded-2xl border border-white/10 min-w-[90px] md:min-w-[160px] shadow-lg group hover:scale-105 hover:border-white/20 transition-all">
    <div className="flex items-center space-x-1.5 md:space-x-3">
      <span className={`text-base md:text-2xl animate-sparkle ${glow}`}>{icon}</span>
      <span className={`text-base md:text-2xl font-black header-font italic ${color} animate-gem-glow`}>{value.toLocaleString()}</span>
    </div>
    <div className="hidden md:block text-right">
      <span className="block text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">{label}</span>
    </div>
  </div>
);

const MenuButton: React.FC<{ icon: React.ReactNode; label: string; color: string; onClick?: () => void }> = ({ icon, label, color, onClick }) => (
  <button 
    onClick={onClick}
    className="group flex flex-col items-center justify-center p-3 md:p-6 rounded-2xl md:rounded-[32px] bg-slate-900/40 border border-white/5 hover:bg-slate-800/80 hover:border-white/20 hover:-translate-y-2 transition-all active:scale-95 shadow-xl"
  >
    <div className={`p-2.5 md:p-5 rounded-xl md:rounded-2xl mb-2 text-white ${color} shadow-lg shadow-black/40 transition-transform group-hover:scale-110 group-hover:rotate-3`}>
      {React.cloneElement(icon as React.ReactElement, { size: window.innerWidth < 768 ? 24 : 36 })}
    </div>
    <span className="text-[10px] md:text-[14px] font-black text-white uppercase tracking-wider header-font leading-tight text-center w-full">{label}</span>
  </button>
);

const ModeCard: React.FC<{ icon: React.ReactNode; title: string; desc: string; color: string; badge?: string; onClick: () => void }> = ({ icon, title, desc, color, badge, onClick }) => (
  <button 
    onClick={onClick}
    className="group relative bg-slate-800/40 border border-white/10 p-6 md:p-12 rounded-[32px] md:rounded-[48px] hover:bg-slate-800/80 hover:border-sky-500/30 transition-all flex flex-col items-center text-center active:scale-95 shadow-2xl"
  >
    {badge && <div className="absolute -top-4 md:-top-6 -right-2 md:-right-4 bg-emerald-500 text-white font-black text-[8px] md:text-[12px] px-3 md:px-5 py-1.5 md:py-2 rounded-full border-2 md:border-4 border-slate-950 shadow-xl animate-pulse">{badge}</div>}
    <div className={`p-4 md:p-8 rounded-2xl md:rounded-3xl mb-4 md:mb-8 text-white ${color} shadow-2xl group-hover:scale-110 transition-transform`}>{icon}</div>
    <h3 className="text-xl md:text-4xl font-black text-white header-font tracking-widest mb-2 md:mb-4 italic uppercase">{title}</h3>
    <p className="text-[9px] md:text-sm text-white/50 font-medium leading-relaxed uppercase tracking-wider">{desc}</p>
    <div className={`absolute bottom-4 inset-x-8 h-1 rounded-full ${color} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
  </button>
);

const DancingSlime: React.FC<{ color: string; top: string; left: string; delay: string; scale: string }> = ({ color, top, left, delay, scale }) => (
  <div 
    className={`absolute w-12 h-10 md:w-16 md:h-14 ${color} rounded-t-full rounded-b-2xl animate-squish ${scale} blur-[0.5px]`}
    style={{ top, left, animationDelay: delay }}
  >
    <div className="flex justify-center space-x-1.5 md:space-x-2 mt-2 md:mt-3 opacity-50">
      <div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-slate-900 rounded-full"></div>
      <div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-slate-900 rounded-full"></div>
    </div>
  </div>
);

const TickerItem: React.FC<{ icon: string; text: string; color?: string }> = ({ icon, text, color = "text-white/40" }) => (
  <div className="flex items-center space-x-2">
    <span className="text-sm md:text-base">{icon}</span>
    <span className={`text-[9px] md:text-[11px] font-black uppercase tracking-[0.3em] ${color}`}>{text}</span>
  </div>
);

export default MainMenu;