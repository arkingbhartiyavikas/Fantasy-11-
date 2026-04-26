import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Clock, Users, ArrowLeft, Home, User, Wallet, Bell, PlayCircle, Shield, Plus, Minus, Info, Receipt, Settings, MessageSquare, Copy, PlusCircle, Edit2, ArrowDownToLine, ArrowDownLeft, ArrowRight, Check, X, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { auth, googleProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, db } from './lib/firebase';
import { doc, onSnapshot, setDoc, collection, query, where, getDoc, getDocs, updateDoc, writeBatch } from 'firebase/firestore';

// --- Types ---
type Role = 'WK' | 'BAT' | 'AR' | 'BOWL';
type ViewType = 'HOME' | 'MATCH' | 'CREATE_TEAM' | 'TEAM_PREVIEW' | 'SELECT_CAPTAIN' | 'MY_MATCHES' | 'WALLET' | 'REWARD' | 'CHAT' | 'NOTIFICATIONS' | 'PROFILE' | 'ADMIN' | 'CONTEST_DETAILS' | 'KYC' | 'WITHDRAW';

interface BankAccount {
  id: string;
  userId?: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
}

interface WithdrawRequest {
  id: string;
  userId?: string;
  amount: number;
  bankAccountId: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  timestamp: string;
}

interface Contest {
  id: string;
  type: 'Mega' | 'H2H';
  name: string;
  prizeText: string;
  entryFee: number;
  spots: number;
  firstPrize?: string;
  winPercentage?: number;
  maxTeams?: number;
  payouts?: { rank: string, amount: string }[];
}

interface Match {
  id: string;
  series: string;
  team1: { name: string; shortFrame: string; color: string };
  team2: { name: string; shortFrame: string; color: string };
  time: string;
  matchDateISO?: string;
  totalPrize: string;
  status: 'Upcoming' | 'Live' | 'Completed';
  lineupStatus?: 'OUT' | 'NOT_OUT';
}

interface DepositRequest {
  id: string;
  userId?: string;
  userName?: string;
  amount: number;
  method: string;
  utr: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  timestamp: string;
}

interface Player {
  id: string;
  name: string;
  team: string; // matches team1/team2 shortFrame
  role: Role;
  credits: number;
  points: number;
  selPercent: number;
}

// --- Mock Data ---
const DEFAULT_MATCHES: Match[] = [
  {
    id: 'm1',
    series: 'TATA IPL 2026',
    team1: { name: 'Chennai', shortFrame: 'CHE', color: 'bg-yellow-500' },
    team2: { name: 'Mumbai', shortFrame: 'MUM', color: 'bg-app-accent' },
    time: '2h 15m',
    totalPrize: '₹55 Crores',
    status: 'Upcoming'
  },
  {
    id: 'm2',
    series: 'TATA IPL 2026',
    team1: { name: 'Bengaluru', shortFrame: 'BEN', color: 'bg-app-accent' },
    team2: { name: 'Kolkata', shortFrame: 'KOL', color: 'bg-purple-800' },
    time: 'Tomorrow, 7:30 PM',
    totalPrize: '₹40 Crores',
    status: 'Upcoming'
  }
];

// Using MOCK_PLAYERS as default, state is managed in app
export const MOCK_PLAYERS: Player[] = [
  // Wicket Keepers
  { id: 'p1', name: 'M Dhoni', team: 'CHE', role: 'WK', credits: 8.5, points: 210, selPercent: 82 },
  { id: 'p2', name: 'I Kishan', team: 'MUM', role: 'WK', credits: 8.0, points: 195, selPercent: 65 },
  // Batsmen
  { id: 'p3', name: 'R Sharma', team: 'MUM', role: 'BAT', credits: 9.0, points: 340, selPercent: 88 },
  { id: 'p4', name: 'S Yadav', team: 'MUM', role: 'BAT', credits: 9.0, points: 410, selPercent: 91 },
  { id: 'p5', name: 'R Gaikwad', team: 'CHE', role: 'BAT', credits: 8.5, points: 280, selPercent: 70 },
  { id: 'p6', name: 'S Dube', team: 'CHE', role: 'BAT', credits: 8.0, points: 265, selPercent: 60 },
  { id: 'p7', name: 'T Varma', team: 'MUM', role: 'BAT', credits: 7.5, points: 220, selPercent: 45 },
  // All Rounders
  { id: 'p8', name: 'H Pandya', team: 'MUM', role: 'AR', credits: 9.0, points: 310, selPercent: 85 },
  { id: 'p9', name: 'R Jadeja', team: 'CHE', role: 'AR', credits: 9.0, points: 300, selPercent: 80 },
  { id: 'p10', name: 'M Ali', team: 'CHE', role: 'AR', credits: 8.5, points: 210, selPercent: 55 },
  // Bowlers
  { id: 'p11', name: 'J Bumrah', team: 'MUM', role: 'BOWL', credits: 9.5, points: 420, selPercent: 95 },
  { id: 'p12', name: 'M Pathirana', team: 'CHE', role: 'BOWL', credits: 8.5, points: 350, selPercent: 78 },
  { id: 'p13', name: 'P Chawla', team: 'MUM', role: 'BOWL', credits: 8.0, points: 230, selPercent: 40 },
  { id: 'p14', name: 'D Chahar', team: 'CHE', role: 'BOWL', credits: 8.0, points: 190, selPercent: 35 },
  { id: 'p15', name: 'G Coetzee', team: 'MUM', role: 'BOWL', credits: 8.0, points: 240, selPercent: 50 },
];

const DEFAULT_CONTESTS: Contest[] = [
  { 
    id: 'c1', type: 'Mega', name: 'Mega Contest', prizeText: '₹45.60 Lakhs', entryFee: 19, spots: 300000, 
    firstPrize: '₹8 L', winPercentage: 48, maxTeams: 20,
    payouts: [
      { rank: '# 1', amount: '₹8 Lakhs' },
      { rank: '# 2', amount: '₹3.40 Lakhs' },
      { rank: '# 3', amount: '₹1.40 Lakhs' },
      { rank: '# 4', amount: '₹50,000' },
      { rank: '# 5', amount: '₹25,000' },
      { rank: '# 6 - 10', amount: '₹3,000' },
      { rank: '# 11 - 30', amount: '₹700' },
      { rank: '# 31 - 80', amount: '₹500' },
      { rank: '# 81 - 150', amount: '₹400' },
      { rank: '# 151 - 230', amount: '₹300' },
      { rank: '# 231 - 317', amount: '₹200' },
      { rank: '# 318 - 422', amount: '₹150' },
      { rank: '# 423 - 622', amount: '₹100' },
      { rank: '# 623 - 920', amount: '₹80' },
      { rank: '# 921 - 8,920', amount: '₹40' },
      { rank: '# 8,921 - 1,440,000', amount: '₹20' },
    ]
  },
  { 
    id: 'c2', type: 'Mega', name: 'Mega Contest', prizeText: '₹12 Lakhs', entryFee: 5, spots: 300000, 
    firstPrize: '₹2.10 L', winPercentage: 48, maxTeams: 20,
    payouts: [
      { rank: '# 1', amount: '₹2.10 Lakhs' },
      { rank: '# 2', amount: '₹40,000' },
      { rank: '# 3 - 5', amount: '₹10,000' },
      { rank: '# 6 - 20', amount: '₹1,000' },
      { rank: '# 21 - 100', amount: '₹500' },
      { rank: '# 101 - 144,000', amount: '₹5' },
    ]
  },
  { id: 'c3', type: 'H2H', name: 'Head to Head', prizeText: '₹35', entryFee: 19, spots: 2, firstPrize: '₹35', winPercentage: 50, maxTeams: 1 },
];

const AdminMatchEditCard: React.FC<{ match: Match, onUpdate: (m: Match) => void, onDelete: () => void, onStatusChange: (status: 'Upcoming' | 'Live' | 'Completed') => void, onLineupToggle: () => void }> = ({ match, onUpdate, onDelete, onStatusChange, onLineupToggle }) => {
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today); dayAfter.setDate(dayAfter.getDate() + 2);
  
  const formatDateISO = (d: Date) => d.toISOString().split('T')[0];

  // Try to parse existing Iso string if any, otherwise fallback to today's date
  let initialDate = formatDateISO(today);
  let initialTime = '20:00';
  
  if (match.matchDateISO) {
     const splitDate = match.matchDateISO.split('T');
     if (splitDate.length > 1) {
         initialDate = splitDate[0];
         initialTime = splitDate[1].substring(0, 5); // get HH:mm
     }
  }

  const [editDate, setEditDate] = useState<string>(initialDate);
  const [editTime, setEditTime] = useState<string>(initialTime);

  const handleUpdate = () => {
      let [hourString, minuteString] = editTime.split(':');
      let hour = parseInt(hourString);
      let ampm = hour >= 12 ? 'PM' : 'AM';
      if (hour > 12) hour -= 12;
      if (hour === 0) hour = 12;
      
      let dayStr = '';
      if (editDate === formatDateISO(today)) dayStr = 'Today';
      else if (editDate === formatDateISO(tomorrow)) dayStr = 'Tomorrow';
      else dayStr = new Date(editDate).toLocaleDateString('en-US', { weekday: 'long' });

      const displayTime = `${dayStr} ${hour}:${minuteString} ${ampm}`;
      const isoTime = `${editDate}T${editTime}:00`;

      onUpdate({
         ...match,
         time: displayTime,
         matchDateISO: isoTime
      });
      alert('Time Updated Successfully!');
  };

  return (
    <div className="bg-app-card border border-app-border rounded p-3 flex flex-col gap-2">
      <div className="flex justify-between items-center border-b border-app-border pb-2">
        <div className="font-bold text-app-text text-sm">{match.team1.shortFrame} vs {match.team2.shortFrame}</div>
        <div className={`text-[10px] font-bold px-2 py-0.5 rounded ${match.status === 'Upcoming' ? 'bg-blue-100 text-blue-700' : match.status === 'Live' ? 'bg-red-100 text-app-accent animate-pulse' : 'bg-app-card-hover text-app-text-muted'}`}>{match.status}</div>
      </div>
      
      <div className="flex gap-2 items-end mt-1">
         <div className="flex-1">
            <label className="text-[10px] text-app-text-muted uppercase font-bold">Match Date</label>
            <select 
              value={editDate} 
              onChange={(e) => setEditDate(e.target.value)} 
              className="w-full mt-1 border border-app-border-hover bg-app-card-hover text-app-text rounded px-2 py-1 text-xs outline-none"
            >
              <option value={formatDateISO(today)}>Today ({formatDateISO(today)})</option>
              <option value={formatDateISO(tomorrow)}>Tomorrow ({formatDateISO(tomorrow)})</option>
              <option value={formatDateISO(dayAfter)}>Day After ({formatDateISO(dayAfter)})</option>
            </select>
         </div>
         <div className="flex-[0.8]">
            <label className="text-[10px] text-app-text-muted uppercase font-bold">Time</label>
            <input 
              type="time" 
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className="w-full mt-1 border border-app-border-hover bg-app-card-hover text-app-text rounded px-2 py-1 text-xs outline-none"
            />
         </div>
         <div className="flex-[0.6]">
            <button 
               onClick={handleUpdate}
               className="w-full bg-slate-700 text-app-text border border-slate-600 rounded text-xs font-bold py-1.5 active:scale-95"
            >
               Update
            </button>
         </div>
      </div>
      
      <div className="flex gap-2 text-xs font-semibold mt-1">
        <button 
          disabled={match.status === 'Upcoming'} 
          onClick={() => onStatusChange('Upcoming')} 
          className={`flex-1 py-1.5 rounded border ${match.status === 'Upcoming' ? 'bg-blue-900/40 text-blue-400 border-blue-900' : 'bg-app-card-inner text-app-text-muted border-app-border hover:bg-app-bg'}`}>Upcoming</button>
        
        <button 
          disabled={match.status === 'Live'} 
          onClick={() => onStatusChange('Live')} 
          className={`flex-1 py-1.5 rounded border ${match.status === 'Live' ? 'bg-red-900/40 text-red-400 border-red-900' : 'bg-app-card-inner text-app-text-muted border-app-border hover:bg-app-bg'}`}>Go Live</button>
        
        <button 
          disabled={match.status === 'Completed'} 
          onClick={() => onStatusChange('Completed')} 
          className={`flex-1 py-1.5 rounded border ${match.status === 'Completed' ? 'bg-slate-700 text-app-text border-slate-600' : 'bg-app-card-inner text-app-text-muted border-app-border hover:bg-app-bg'}`}>Complete</button>
      </div>
      <div className="mt-1">
         <button onClick={onDelete} className="text-app-accent font-semibold text-[10px] uppercase w-full p-1 opacity-70 hover:opacity-100">Delete Match</button>
      </div>
      <div className="flex gap-2 text-xs font-semibold mt-1 border-t border-app-border pt-2">
         <button 
           onClick={onLineupToggle} 
           className={`flex-1 py-1.5 rounded border shadow-sm ${match.lineupStatus === 'OUT' ? 'bg-green-600 text-app-text border-green-700' : 'bg-app-accent text-app-text border-red-700'}`}
         >
           {match.lineupStatus === 'OUT' ? 'Lineups OUT (Click to make Red)' : 'Lineups NOT OUT (Click to make Green)'}
         </button>
      </div>
    </div>
  );
};

const ContestDetailsView = ({
  activeMatch,
  contest,
  savedTeams,
  onBack,
  onJoin,
  balance,
  onAddCash,
  winningPercentage,
  appPlayers,
  onParticipantClick
}: {
  activeMatch: Match;
  contest: Contest;
  savedTeams: any[];
  onBack: () => void;
  onJoin: () => void;
  balance: number;
  onAddCash: () => void;
  winningPercentage: number;
  appPlayers: Player[];
  onParticipantClick?: (team: any) => void;
}) => {
  const [activeTab, setActiveTab] = useState<'WINNINGS' | 'LEADERBOARD'>('WINNINGS');
  
  const contestTeams = savedTeams.filter(t => t.match?.id === activeMatch.id && t.contestName === contest.name);
  
  // Real-time calculation based on joined teams
  const currentCollected = contestTeams.length * contest.entryFee;
  const totalPrizePool = currentCollected * (winningPercentage / 100);

  // Compute dynamic points 
  const teamsWithPoints = contestTeams.map(t => {
     const computedPoints = (t.players || []).reduce((acc: number, player: Player) => {
        const livePlayer = appPlayers.find(p => p.id === player.id) || player;
        let mult = 1;
        if (livePlayer.id === t.captain) mult = 2;
        else if (livePlayer.id === t.viceCaptain) mult = 1.5;
        return acc + (livePlayer.points * mult);
     }, 0);
     return { ...t, points: computedPoints };
  });

  const getPayouts = () => {
    if (contest.payouts && contest.payouts.length > 0) {
      return contest.payouts;
    }

    const payouts = [];
    if (contestTeams.length > 0) {
      if (contestTeams.length === 1) {
         payouts.push({ rank: '1', amount: totalPrizePool });
      } else if (contestTeams.length === 2) {
         payouts.push({ rank: '1', amount: totalPrizePool * 0.7 });
         payouts.push({ rank: '2', amount: totalPrizePool * 0.3 });
      } else if (contestTeams.length <= 5) {
         payouts.push({ rank: '1', amount: totalPrizePool * 0.5 });
         payouts.push({ rank: '2', amount: totalPrizePool * 0.3 });
         payouts.push({ rank: '3', amount: totalPrizePool * 0.2 });
      } else {
         payouts.push({ rank: '1', amount: totalPrizePool * 0.4 });
         payouts.push({ rank: '2', amount: totalPrizePool * 0.25 });
         payouts.push({ rank: '3', amount: totalPrizePool * 0.15 });
         payouts.push({ rank: '4 - 5', amount: totalPrizePool * 0.1 });
      }
    }
    return payouts;
  };

  const payouts = getPayouts();

  // Sort teams by points (if available) for Leaderboard
  const sortedTeams = [...teamsWithPoints].sort((a, b) => (b.points || 0) - (a.points || 0));

  return (
    <div className="flex flex-col h-full bg-app-bg">
      <header className="bg-app-bg text-app-text border-b border-app-border p-4 shadow-md z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="p-1 -ml-1 active:bg-app-card/10 rounded-full transition-colors"><ArrowLeft size={24} /></button>
          <div className="font-bold text-sm">Contest Details</div>
          <button onClick={onAddCash} className="flex items-center gap-1 bg-app-card/20 px-2 py-0.5 rounded text-xs">
            <Wallet size={12} /> ₹{balance}
          </button>
        </div>
        <div className="text-center font-bold text-sm mb-1">
          {activeMatch.team1.shortFrame} vs {activeMatch.team2.shortFrame}
        </div>
      </header>

      <div className="bg-app-card p-4 shadow-sm z-10 w-full relative">
        <div className="flex justify-between items-start mb-2">
           <div>
             <p className="text-xs text-app-text-muted font-semibold uppercase">Prize Pool</p>
             <p className="text-xl font-black text-app-text">
               {currentCollected > 0 ? `₹${totalPrizePool.toFixed(2)}` : contest.prizeText}
             </p>
           </div>
           <div className="text-right">
             <p className="text-xs text-app-text-muted font-semibold uppercase">Spots Left</p>
             <p className="text-sm font-bold text-app-text">{Math.max(0, contest.spots - contestTeams.length)}</p>
           </div>
        </div>
        <div className="bg-app-bg h-1.5 rounded-full mb-2 overflow-hidden">
          <div className="bg-app-accent h-full" style={{ width: `${Math.min(100, (contestTeams.length / contest.spots) * 100)}%` }}></div>
        </div>
        <div className="flex justify-between text-xs text-app-text-muted">
          <span>{contestTeams.length} joined</span>
          <span>{contest.spots} total spots</span>
        </div>
        <button 
           onClick={onJoin}
           disabled={activeMatch.status !== 'Upcoming'}
           className={`w-full mt-4 py-2 rounded font-bold text-sm text-app-text transition-transform ${activeMatch.status !== 'Upcoming' ? 'bg-slate-400' : 'bg-green-600 hover:bg-green-700 active:scale-[0.98]'}`}
        >
          {activeMatch.status !== 'Upcoming' ? 'Match Started' : `Join ₹${contest.entryFee}`}
        </button>
      </div>

      <div className="flex bg-app-card mt-2 shadow-sm border-b border-app-border">
         <button onClick={() => setActiveTab('WINNINGS')} className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'WINNINGS' ? 'border-app-accent text-app-accent' : 'border-transparent text-app-text-muted'}`}>Winnings</button>
         <button onClick={() => setActiveTab('LEADERBOARD')} className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'LEADERBOARD' ? 'border-app-accent text-app-accent' : 'border-transparent text-app-text-muted'}`}>Leaderboard</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-20">
        {activeTab === 'WINNINGS' ? (
           <div className="space-y-4">
              {(!contest.payouts || contest.payouts.length === 0) && (
                <div className="bg-blue-50 border border-blue-100 text-blue-800 text-xs p-3 rounded-lg text-center font-medium shadow-sm">
                  <b>Dynamic Prize Pool:</b> Users receive {winningPercentage}% of total entry fees collected. The remaining {100 - winningPercentage}% is kept as platform fee. As more teams join, the winning amounts automatically increase!
                </div>
              )}
              <div className="bg-app-card rounded-lg border border-app-border overflow-hidden">
                 <div className="flex justify-between px-4 py-2 text-xs font-bold text-app-text-muted bg-app-card-inner border-b border-app-border">
                    <span>Rank</span>
                    <span>Winnings</span>
                 </div>
                 {payouts.length > 0 ? payouts.map((p, i) => (
                    <div key={i} className="flex justify-between px-4 py-3 border-b border-app-border last:border-0 items-center">
                       <span className="font-bold text-app-text text-sm">{typeof p.rank === 'string' && p.rank.startsWith('#') ? '' : '#'}{p.rank}</span>
                       <span className="font-bold text-app-text">{typeof p.amount === 'number' ? `₹${p.amount.toFixed(2)}` : p.amount}</span>
                    </div>
                 )) : (
                    <div className="p-8 text-center text-app-text-muted text-sm">
                       No one has joined yet. Be the first!
                    </div>
                 )}
              </div>
           </div>
        ) : (
           <div className="bg-app-card rounded-lg border border-app-border overflow-hidden">
               <div className="flex justify-between px-4 py-2 text-xs font-bold text-app-text-muted bg-app-card-inner border-b border-app-border">
                  <span className="w-12 text-center text-app-text-muted">Rank</span>
                  <span className="flex-1">User</span>
                  <span className="text-right">Points</span>
               </div>
               {sortedTeams.length > 0 ? sortedTeams.map((t, i) => (
                  <div 
                     key={i} 
                     onClick={() => onParticipantClick && onParticipantClick(t)}
                     className={`flex justify-between px-4 py-3 border-b border-app-border last:border-0 items-center cursor-pointer hover:bg-app-card-hover/50 transition-colors ${t.userId === appPlayers[0]?.id /* hackish for current user */ ? 'bg-app-card' : ''}`}
                  >
                     <div className="w-12 text-center font-bold text-app-text-muted pr-2">
                        #{t.rank || (i + 1)}
                     </div>
                     <div className="flex items-center gap-2 flex-1">
                        <div className="w-8 h-8 rounded-full bg-app-card-hover flex items-center justify-center text-app-text-muted font-bold text-xs uppercase">
                           {(t.userName || t.userId || '?').substring(0,2)}
                        </div>
                        <div className="flex flex-col">
                           <span className="font-semibold text-app-text text-sm">{t.userName || t.userId || 'Guest Player'}</span>
                           {t.amountWon > 0 && <span className="text-[10px] text-green-500 font-bold tracking-tight">WON ₹{t.amountWon}</span>}
                        </div>
                     </div>
                     <span className="font-bold text-app-text text-right">{t.points || 0}</span>
                  </div>
               )) : (
                  <div className="p-8 text-center text-app-text-muted text-sm">
                     Empty Leaderboard
                  </div>
               )}
           </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [appPlayers, setAppPlayers] = useState<Player[]>(() => {
    const saved = localStorage.getItem('dreamApp_players');
    return saved ? JSON.parse(saved) : MOCK_PLAYERS;
  });

  useEffect(() => {
    localStorage.setItem('dreamApp_players', JSON.stringify(appPlayers));
  }, [appPlayers]);

  const [themeMode, setThemeMode] = useState<'Dark' | 'Light'>(() => localStorage.getItem('dreamApp_themeMode') as any || 'Dark');
  const [themeColor, setThemeColor] = useState<'Red' | 'Blue' | 'Green'>(() => localStorage.getItem('dreamApp_themeColor') as any || 'Blue');

  useEffect(() => {
    localStorage.setItem('dreamApp_themeMode', themeMode);
    localStorage.setItem('dreamApp_themeColor', themeColor);
  }, [themeMode, themeColor]);

  const [view, setView] = useState<ViewType>('HOME');
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [selectedContest, setSelectedContest] = useState<{fee: number; name: string} | null>(null);
  const [activeContestDetails, setActiveContestDetails] = useState<Contest | null>(null);
  
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [authInput, setAuthInput] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [winningPercentage, setWinningPercentage] = useState<number>(() => {
    const saved = localStorage.getItem('dreamApp_winningRate');
    return saved ? parseInt(saved) : 60;
  });

  useEffect(() => {
    localStorage.setItem('dreamApp_winningRate', winningPercentage.toString());
  }, [winningPercentage]);

  // Real App States with Local Storage persistence
  const [user, setUser] = useState<{email: string, id: string, name: string} | null>(() => {
    const saved = localStorage.getItem('dreamApp_user');
    return saved ? JSON.parse(saved) : null;
  });

  const isAdmin = user?.email === 'arkingbhartiyavikas@gmail.com';

  const [kycRequests, setKycRequests] = useState<any[]>([]);



  const [userStats, setUserStats] = useState<{profits: number, wins: number}>({ profits: 0, wins: 0 });
  const [userStatsLoaded, setUserStatsLoaded] = useState<string | null>(null);

  const [claimedLevels, setClaimedLevels] = useState<number[]>([]);
  const [claimedLevelsLoaded, setClaimedLevelsLoaded] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      if (userStatsLoaded !== user.id) {
        const saved = localStorage.getItem(`dreamApp_userStats_${user.id}`);
        setUserStats(saved ? JSON.parse(saved) : { profits: 0, wins: 0 });
        setUserStatsLoaded(user.id);
      } else {
        localStorage.setItem(`dreamApp_userStats_${user.id}`, JSON.stringify(userStats));
      }
    } else {
      if (userStatsLoaded !== null) {
        setUserStats({ profits: 0, wins: 0 });
        setUserStatsLoaded(null);
      }
    }
  }, [userStats, user?.id, userStatsLoaded]);

  useEffect(() => {
    if (user?.id) {
      if (claimedLevelsLoaded !== user.id) {
        const saved = localStorage.getItem(`dreamApp_claimedLevels_${user.id}`);
        setClaimedLevels(saved ? JSON.parse(saved) : []);
        setClaimedLevelsLoaded(user.id);
      } else {
        localStorage.setItem(`dreamApp_claimedLevels_${user.id}`, JSON.stringify(claimedLevels));
      }
    } else {
      if (claimedLevelsLoaded !== null) {
        setClaimedLevels([]);
        setClaimedLevelsLoaded(null);
      }
    }
  }, [claimedLevels, user?.id, claimedLevelsLoaded]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (sessionStorage.getItem('isSigningUp') === 'true') {
          sessionStorage.removeItem('isSigningUp');
          await firebaseSignOut(auth);
          return;
        }
        let numericId = localStorage.getItem(`dreamApp_numericId_${firebaseUser.uid}`);
        if (!numericId) {
            numericId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
            localStorage.setItem(`dreamApp_numericId_${firebaseUser.uid}`, numericId);
        }

        localStorage.setItem('dreamApp_hasSignedUp', 'true');
        setUser({
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'Fantasy Player',
          id: numericId
        });
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);
  const [wallet, setWallet] = useState<{deposit: number, winning: number, bonus: number}>({ deposit: 0, winning: 0, bonus: 0 });
  const [walletLoadedUser, setWalletLoadedUser] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
        setWallet({ deposit: 0, winning: 0, bonus: 0 });
        return;
    }

    let isSubscribed = true;
    
    // Listen to user's wallet
    const unsubWallet = onSnapshot(doc(db, 'wallets', user.id), (docS) => {
        if (docS.exists()) {
             setWallet(docS.data() as any);
        } else {
             // Create initial wallet if doesn't exist
             const init = { deposit: 0, winning: 0, bonus: 24 };
             setDoc(doc(db, 'wallets', user.id), init);
             if (isSubscribed) setWallet(init);
        }
    });

    // Listen to deposits
    const depQuery = isAdmin 
      ? collection(db, 'deposits')
      : query(collection(db, 'deposits'), where('userId', '==', user.id));
    const unsubDep = onSnapshot(depQuery, (snap) => {
        if (isSubscribed) setDepositRequests(snap.docs.map(d => d.data() as DepositRequest));
    });

    // Listen to withdrawals
    const wdQuery = isAdmin
      ? collection(db, 'withdrawals')
      : query(collection(db, 'withdrawals'), where('userId', '==', user.id));
    const unsubWd = onSnapshot(wdQuery, (snap) => {
        if (isSubscribed) setWithdrawRequests(snap.docs.map(d => d.data() as WithdrawRequest));
    });

    // Listen to KYC
    const kycQuery = isAdmin
      ? collection(db, 'kyc')
      : query(collection(db, 'kyc'), where('userId', '==', user.id));
    const unsubKyc = onSnapshot(kycQuery, (snap) => {
        if (isSubscribed) setKycRequests(snap.docs.map(d => d.data() as any));
    });

    // Listen to Bank Accounts
    const bankQuery = isAdmin
      ? collection(db, 'bankAccounts')
      : query(collection(db, 'bankAccounts'), where('userId', '==', user.id));
    const unsubBank = onSnapshot(bankQuery, (snap) => {
        if (isSubscribed) setBankAccounts(snap.docs.map(d => d.data() as BankAccount));
    });

    return () => { 
        isSubscribed = false;
        unsubWallet(); 
        unsubDep(); 
        unsubWd(); 
        unsubKyc(); 
        unsubBank();
    };
  }, [user?.id, isAdmin]);

  // Hook to save local wallet edits to DB (e.g. from playing contests)
  useEffect(() => {
     if (user?.id && wallet.deposit !== undefined) {
         // But wait, if onSnapshot is updating wallet, it will trigger this. 
         // setDoc will overwrite without issue, but might cause loops?
         // Actually, if we only setDoc when the values differ from the DB, we can prevent loops.
         // Let's just use updateDoc so we don't spam.
     }
  }, [wallet, user?.id]);

  const updateWallet = (updater: any) => {
     setWallet((prev: any) => {
         const next = typeof updater === 'function' ? updater(prev) : updater;
         if (user?.id) setDoc(doc(db, 'wallets', user.id), next);
         return next;
     });
  };

  const balance = wallet.deposit + wallet.winning + wallet.bonus;

  const setBalance = (updater: number | ((prev: number) => number)) => {
    updateWallet((prev: {deposit: number, winning: number, bonus: number}) => {
      const currentTotal = prev.deposit + prev.winning + prev.bonus;
      let newTotal = typeof updater === 'function' ? updater(currentTotal) : updater;
      // Safety bounds to prevent NaN
      if (isNaN(newTotal) || !isFinite(newTotal)) newTotal = 0;
      const diff = newTotal - currentTotal;
      if (diff > 0) return { ...prev, deposit: prev.deposit + diff };
      let rem = -diff;
      let bon = prev.bonus;
      if (rem > 0 && bon > 0) { const d = Math.min(rem, bon); bon -= d; rem -= d; }
      let dep = prev.deposit;
      if (rem > 0 && dep > 0) { const d = Math.min(rem, dep); dep -= d; rem -= d; }
      let win = prev.winning;
      if (rem > 0 && win > 0) { const d = Math.min(rem, win); win -= d; rem -= d; }
      return { deposit: Math.max(0, dep), winning: win, bonus: bon };
    });
  };
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [withdrawAccountId, setWithdrawAccountId] = useState<string>('');
  const [showAddBankMode, setShowAddBankMode] = useState<boolean>(false);
  const [newBankAccount, setNewBankAccount] = useState({ name: '', accNo: '', ifsc: '' });
  
  const renderWithdraw = () => {
    const userBanks = bankAccounts.filter(b => b.userId === user?.id);

    if (showAddBankMode) {
      return (
        <div className="flex flex-col h-full bg-[#0B1221] text-white">
          <header className="p-4 flex items-center gap-4">
            <button onClick={() => setShowAddBankMode(false)} className="text-gray-400"><ArrowLeft /></button>
            <h1 className="text-xl font-bold flex-1 text-center">Add Bank Account</h1>
            <button onClick={() => setShowAddBankMode(false)} className="text-gray-400"><X /></button>
          </header>
          
          <div className="p-4 space-y-6">
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Account Holder Name</label>
              <input 
                type="text" 
                placeholder="Please enter your Account Holder Name"
                className="w-full bg-[#1A2536] text-white p-4 rounded-xl border border-transparent focus:border-green-500 focus:outline-none"
                value={newBankAccount.name}
                onChange={e => setNewBankAccount({...newBankAccount, name: e.target.value})}
              />
            </div>
            
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Bank Account Number</label>
              <input 
                type="text" 
                placeholder="Please enter your Bank Account Number"
                className="w-full bg-[#1A2536] text-white p-4 rounded-xl border border-transparent focus:border-green-500 focus:outline-none"
                value={newBankAccount.accNo}
                onChange={e => setNewBankAccount({...newBankAccount, accNo: e.target.value})}
              />
            </div>
            
            <div>
              <label className="text-gray-400 text-sm mb-2 block">IFSC Code</label>
              <input 
                type="text" 
                placeholder="Please enter your IFSC Code"
                className="w-full bg-[#1A2536] text-white p-4 rounded-xl border border-transparent focus:border-green-500 focus:outline-none uppercase"
                value={newBankAccount.ifsc}
                onChange={e => setNewBankAccount({...newBankAccount, ifsc: e.target.value.toUpperCase()})}
              />
            </div>

            <button 
              onClick={() => {
                if (!newBankAccount.name || !newBankAccount.accNo || !newBankAccount.ifsc) {
                  alert("Please fill all details");
                  return;
                }
                const newAcc: BankAccount = {
                  id: 'bank_' + Date.now(),
                  userId: user?.id,
                  accountHolderName: newBankAccount.name,
                  accountNumber: newBankAccount.accNo,
                  ifscCode: newBankAccount.ifsc
                };
                setDoc(doc(db, 'bankAccounts', newAcc.id), newAcc).then(() => {
                   setWithdrawAccountId(newAcc.id);
                   setShowAddBankMode(false);
                   setNewBankAccount({ name: '', accNo: '', ifsc: '' });
                   alert("Bank Account Added Successfully!");
                });
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl mt-4"
            >
              Add Bank Account
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-[#0B1221] text-white">
        <header className="p-4 flex items-center justify-between">
          <button onClick={() => setView('WALLET')} className="text-gray-400"><ArrowLeft /></button>
          <h1 className="text-xl font-bold">Withdraw</h1>
          <div className="flex gap-4 text-gray-400">
            <MessageSquare size={20} />
            <Receipt size={20} />
          </div>
        </header>

        <div className="p-4 flex-1 overflow-y-auto pb-20">
          <p className="text-gray-400 text-sm mb-2">Withdrawal Currency</p>
          <div className="bg-[#152e23] border border-green-800/50 rounded-xl overflow-hidden mb-6">
            <div className="flex justify-between items-center p-4 border-b border-green-800/30">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-white">
                    <div className="text-[10px]">🇮🇳</div>
                </div>
                <span className="font-bold">INR</span>
              </div>
              <ChevronDown size={20} className="text-gray-400" />
            </div>
            <div className="flex p-4 text-center divide-x divide-green-800/30">
              <div className="flex-1">
                <div className="text-2xl font-bold">₹{balance.toLocaleString('en-IN', {maximumFractionDigits:0})}</div>
                <div className="text-xs text-gray-400 mt-1">Balance</div>
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold">₹{wallet.winning.toLocaleString('en-IN', {maximumFractionDigits:0})}</div>
                <div className="text-xs text-gray-400 mt-1">Withdrawable</div>
              </div>
            </div>
          </div>

          <p className="text-gray-400 text-sm mb-3">Withdrawal Amount</p>
          <div className="bg-[#1A2536] rounded-xl flex items-center px-4 py-2 border border-app-border mb-4">
             <span className="text-xl font-bold text-gray-400 mr-2">₹</span>
             <input
                type="number"
                value={withdrawAmount || ''}
                onChange={(e) => setWithdrawAmount(parseInt(e.target.value) || 0)}
                placeholder="0"
                className="bg-transparent text-xl font-bold w-full focus:outline-none"
             />
          </div>
          
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[110, 200, 500, 1000, 2000, 5000, 10000, 20000, 35000].map(amt => (
              <button 
                key={amt} 
                onClick={() => setWithdrawAmount(amt)}
                className={`py-3 rounded-lg font-bold text-sm transition-colors ${withdrawAmount === amt ? 'bg-green-600/20 text-green-500 border border-green-600/50' : 'bg-[#1A2536] text-gray-400 border border-transparent'}`}
              >
                ₹{amt}
              </button>
            ))}
          </div>

          <p className="text-gray-400 text-sm mb-3">Recipient Bank Card</p>
          {userBanks.length === 0 ? (
            <button 
              onClick={() => setShowAddBankMode(true)}
              className="w-full bg-[#1A2536] text-white py-6 rounded-xl flex justify-center items-center gap-2 hover:bg-[#1E2E44] transition-colors"
            >
              <div className="bg-gray-600/50 rounded-full p-1">
                 <Plus size={20} />
              </div>
              Add Bank Card
            </button>
          ) : (
            <div className="space-y-3 mb-4">
              {userBanks.map(bank => (
                <div 
                  key={bank.id}
                  onClick={() => setWithdrawAccountId(bank.id)}
                  className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer ${withdrawAccountId === bank.id ? 'bg-green-600/10 border-green-500' : 'bg-[#1A2536] border-transparent'}`}
                >
                  <div>
                    <p className="font-bold text-sm text-white">{bank.accountHolderName}</p>
                    <p className="text-xs text-gray-400 mt-1">{bank.accountNumber.substring(0, 4)}XXXXXXX (IFSC: {bank.ifscCode})</p>
                  </div>
                  {withdrawAccountId === bank.id && (
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <Check size={14} className="text-[#0B1221]" />
                    </div>
                  )}
                </div>
              ))}
              <button 
                onClick={() => setShowAddBankMode(true)}
                className="text-app-accent font-bold text-sm mt-2 flex items-center gap-1"
              >
                 <Plus size={16}/> Add another bank account
              </button>
            </div>
          )}

          <button 
            onClick={() => {
              if (withdrawAmount < 110) {
                alert("Minimum withdrawal is ₹110");
                return;
              }
              if (withdrawAmount > wallet.winning) {
                alert("Insufficient withdrawable balance (winnings)");
                return;
              }
              if (!withdrawAccountId) {
                alert("Please select a bank account");
                return;
              }

              const newReq: WithdrawRequest = {
                id: 'wd_' + Date.now(),
                userId: user?.id,
                amount: withdrawAmount,
                bankAccountId: withdrawAccountId,
                status: 'Pending',
                timestamp: new Date().toLocaleTimeString()
              };

              setDoc(doc(db, 'withdrawals', newReq.id), newReq).then(() => {
                 updateWallet(prev => ({ ...prev, winning: prev.winning - withdrawAmount }));
                 alert("Withdrawal request submitted! Admin will process it soon.");
                 setWithdrawAmount(0);
                 setView('WALLET');
              });
            }}
            disabled={withdrawAmount < 110 || !withdrawAccountId}
            className={`w-full py-4 rounded-xl font-bold mt-4 text-center ${withdrawAmount >= 110 && withdrawAccountId ? 'bg-app-accent text-white hover:bg-red-600 shadow-[0_0_15px_rgba(255,59,92,0.3)]' : 'bg-[#10232A] text-gray-500 cursor-not-allowed'}`}
          >
            Withdrawal
          </button>
        </div>
      </div>
    );
  };

  const [withdrawRequests, setWithdrawRequests] = useState<WithdrawRequest[]>([]);





  const [savedTeams, setSavedTeams] = useState<any[]>(() => {
    const saved = localStorage.getItem('dreamApp_teams');
    if (saved) {
        let parsed = JSON.parse(saved);
        parsed = parsed.map((t: any) => {
            if (t.userId === 'admin_bot' && t.userName?.startsWith('BOOT')) {
                const BOT_NAMES = ['Rahul', 'Amit', 'Rohit', 'Virat', 'Mahi', 'Suresh', 'Dinesh', 'Sachin', 'Kapil', 'Virender', 'Ravi', 'Ramesh', 'Sanjay', 'Vicky', 'Raju'];
                t.userName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + Math.floor(Math.random() * 9999).toString();
                t.teamId = `T${Math.floor(Math.random() * 8999) + 1000}`;
            }
            return t;
        });
        return parsed;
    }
    return [];
  });
  const [appContests, setAppContests] = useState<Contest[]>(() => {
    const saved = localStorage.getItem('dreamApp_contests');
    return saved ? JSON.parse(saved) : DEFAULT_CONTESTS;
  });
  const [appMatches, setAppMatches] = useState<Match[]>(() => {
    const saved = localStorage.getItem('dreamApp_matches');
    return saved ? JSON.parse(saved) : DEFAULT_MATCHES;
  });

  useEffect(() => {
    if (user) localStorage.setItem('dreamApp_user', JSON.stringify(user));
    else localStorage.removeItem('dreamApp_user');
  }, [user]);



  useEffect(() => {
    localStorage.setItem('dreamApp_teams', JSON.stringify(savedTeams));
  }, [savedTeams]);



  useEffect(() => {
    localStorage.setItem('dreamApp_contests', JSON.stringify(appContests));
  }, [appContests]);

  useEffect(() => {
    localStorage.setItem('dreamApp_matches', JSON.stringify(appMatches));
  }, [appMatches]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'gameData', 'main_state'), (snapshot) => {
        if (snapshot.exists()) {
             const data = snapshot.data();
             if (data.matches && Array.isArray(data.matches)) setAppMatches(data.matches);
             if (data.contests && Array.isArray(data.contests)) setAppContests(data.contests);
             if (data.players && Array.isArray(data.players)) setAppPlayers(data.players);
             if (data.adminTeams && Array.isArray(data.adminTeams)) {
                  setSavedTeams(prev => {
                      const userTeams = prev.filter(t => t.userId !== 'admin_bot' && t.userId !== 'admin_bot_boot');
                      const newTeams = [...userTeams, ...data.adminTeams];
                      
                      // Remove local duplicates just in case (unique ID validation)
                      const seen = new Set();
                      const finalTeams = newTeams.filter(t => {
                          if (seen.has(t.id)) return false;
                          seen.add(t.id);
                          return true;
                      });
                      
                      return finalTeams;
                  });
             }
        }
    });
    return () => unsub();
  }, []);

  const distributePrizes = (matchId: string) => {
    let anyWonInfo = "";
    
    setSavedTeams(currentTeams => {
        const updatedTeams = [...currentTeams];
        const matchTeams = updatedTeams.filter(t => t.match?.id === matchId && !t.prizeDistributed);
        if(matchTeams.length === 0) return currentTeams;

        const contestNames = Array.from(new Set(matchTeams.map(t => t.contestName)));
        
        let localBalanceUpdate = 0;
        let localWinCount = 0;
        
        contestNames.forEach(cName => {
            const contestTeams = matchTeams.filter(t => t.contestName === cName);
            const contest = appContests.find(c => c.name === cName) || DEFAULT_CONTESTS[0];
            
            const currentCollected = contestTeams.length * contest.entryFee;
            const totalPrizePool = currentCollected * (winningPercentage / 100);

            // calculate points
            const teamsWithPoints = contestTeams.map(t => {
                const computedPoints = (t.players || []).reduce((acc: number, player: Player) => {
                    const livePlayer = appPlayers.find(p => p.id === player.id) || player;
                    let mult = 1;
                    if (livePlayer.id === t.captain) mult = 2;
                    else if (livePlayer.id === t.viceCaptain) mult = 1.5;
                    return acc + (livePlayer.points * mult);
                }, 0);
                return { ...t, points: computedPoints, _ref: t };
            });

            // sort by points
            const sortedTeams = [...teamsWithPoints].sort((a, b) => (b.points || 0) - (a.points || 0));

            // Generate payouts
            let payouts = contest.payouts && contest.payouts.length > 0 ? [...contest.payouts] : [];
            if (payouts.length === 0 && contestTeams.length > 0) {
               if (contestTeams.length === 1) {
                  payouts.push({ rank: '1', amount: totalPrizePool });
               } else if (contestTeams.length === 2) {
                  payouts.push({ rank: '1', amount: totalPrizePool * 0.7 });
                  payouts.push({ rank: '2', amount: totalPrizePool * 0.3 });
               } else if (contestTeams.length <= 5) {
                  payouts.push({ rank: '1', amount: totalPrizePool * 0.5 });
                  payouts.push({ rank: '2', amount: totalPrizePool * 0.3 });
                  payouts.push({ rank: '3', amount: totalPrizePool * 0.2 });
               } else {
                  payouts.push({ rank: '1', amount: totalPrizePool * 0.4 });
                  payouts.push({ rank: '2', amount: totalPrizePool * 0.25 });
                  payouts.push({ rank: '3', amount: totalPrizePool * 0.15 });
                  payouts.push({ rank: '4 - 5', amount: totalPrizePool * 0.1 });
               }
            }

            sortedTeams.forEach((t, index) => {
                const rank = index + 1;
                const payoutStr = payouts.find(p => {
                    const r = p.rank.toString().replace('#', '').trim();
                    if(r.includes('-')) {
                        const [start, end] = r.split('-').map(Number);
                        return rank >= start && rank <= end;
                    }
                    return parseInt(r) === rank;
                });

                if (payoutStr) {
                   let amt = typeof payoutStr.amount === 'number' ? payoutStr.amount : parseFloat(payoutStr.amount.toString().replace(/[^0-9.]/g, ''));
                   if (amt) {
                       if (t.userId === user?.id) {
                           localBalanceUpdate += amt;
                           localWinCount++;
                           anyWonInfo += `\n- Team ${t.teamId} in ${cName}: Won ₹${amt.toFixed(2)}`;
                       } else {
                           const key = `dreamApp_wallet_v3_${t.userId}`;
                           const saved = localStorage.getItem(key);
                           const curr = saved ? JSON.parse(saved) : { deposit: 0, winning: 0, bonus: 0 };
                           curr.winning += amt;
                           localStorage.setItem(key, JSON.stringify(curr));
                       }
                       
                       t._ref.prizeDistributed = true;
                       t._ref.amountWon = amt;
                       t._ref.rank = rank;
                   }
                } else {
                   t._ref.prizeDistributed = true;
                   t._ref.amountWon = 0;
                   t._ref.rank = rank;
                }
            });
        });
        
        if (localBalanceUpdate > 0 && user?.id) {
           updateWallet(prev => ({ ...prev, winning: prev.winning + localBalanceUpdate }));
           setUserStats(prev => ({...prev, profits: prev.profits + localBalanceUpdate, wins: prev.wins + localWinCount}));
           setTimeout(() => {
               alert(`🎉 Match Completed! Prizes have been distributed.\n\nYou won a total of ₹${localBalanceUpdate.toFixed(2)} distributed to your wallet!\n${anyWonInfo}`);
           }, 500);
        } else {
           setTimeout(() => {
               alert(`Match Completed! Prizes distributed to all participants.`);
           }, 500);
        }
        
        return updatedTeams;
    });
  };


  
  // Team Creation State
  const [team, setTeam] = useState<Player[]>([]);
  const [activeRole, setActiveRole] = useState<Role>('WK');
  const [captain, setCaptain] = useState<string | null>(null);
  const [viceCaptain, setViceCaptain] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<'CREATE_TEAM' | 'MY_MATCHES' | 'CONTEST_DETAILS'>('CREATE_TEAM');
  const [previewTeamInfo, setPreviewTeamInfo] = useState<{name: string, points?: number} | null>(null);
  const [adminCustomAmount, setAdminCustomAmount] = useState<string>('');
  
  // Admin Contest Creation State
  const [adminContestType, setAdminContestType] = useState<'Mega' | 'H2H'>('Mega');
  const [adminContestName, setAdminContestName] = useState<string>('');
  const [adminContestPrize, setAdminContestPrize] = useState<string>('');
  const [adminContestEntry, setAdminContestEntry] = useState<string>('');
  const [adminContestSpots, setAdminContestSpots] = useState<string>('5000000');
  
  // Admin Match Creation State
  const [adminMatchT1, setAdminMatchT1] = useState<string>('');
  const [adminMatchT2, setAdminMatchT2] = useState<string>('');
  
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today); dayAfter.setDate(dayAfter.getDate() + 2);
  
  const formatDateISO = (d: Date) => d.toISOString().split('T')[0];
  const [adminMatchDate, setAdminMatchDate] = useState<string>(formatDateISO(today));
  const [adminMatchTimeValue, setAdminMatchTimeValue] = useState<string>('20:00'); // 8 PM default

  const [adminMatchTime, setAdminMatchTime] = useState<string>('');
  const [adminMatchPrize, setAdminMatchPrize] = useState<string>('');
  const [showManageMatches, setShowManageMatches] = useState<boolean>(false);
  const [showManageContests, setShowManageContests] = useState<boolean>(false);
  const [showManageUserTeams, setShowManageUserTeams] = useState<boolean>(false);
  const [adminTeamEditMatchId, setAdminTeamEditMatchId] = useState<string | null>(null);
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');
  const [matchTab, setMatchTab] = useState<'Contests' | 'My Teams'>('Contests');
  const [showManagePlayers, setShowManagePlayers] = useState<boolean>(false);
  const [adminExpandedPlayerId, setAdminExpandedPlayerId] = useState<string | null>(null);
  const [adminLiveMatchId, setAdminLiveMatchId] = useState<string | null>(null);
  const [isAdminBotEditMode, setIsAdminBotEditMode] = useState<string | null>(null);
  const [expandedBotsContest, setExpandedBotsContest] = useState<string | null>(null);
  const [myMatchesTab, setMyMatchesTab] = useState<'Upcoming' | 'Live' | 'Completed'>('Upcoming');

  // Payment & Edit State
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('100');
  const [paymentMethod, setPaymentMethod] = useState<'Google Pay' | 'PhonePe' | 'Paytm' | ''>('');
  const [paymentUtr, setPaymentUtr] = useState<string>('');
  const [editingSavedTeamIndex, setEditingSavedTeamIndex] = useState<number | null>(null);
  const [editReturnView, setEditReturnView] = useState<'ADMIN' | 'MY_MATCHES'>('ADMIN');

  const [showManageDeposits, setShowManageDeposits] = useState<boolean>(false);
  const [showManageWithdrawals, setShowManageWithdrawals] = useState<boolean>(false);
  const [showManageKYC, setShowManageKYC] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const [aadharInput, setAadharInput] = useState('');
  const [panInput, setPanInput] = useState('');

  const creditsUsed = team.reduce((sum, p) => sum + p.credits, 0);
  const creditsLeft = 100 - creditsUsed;

  const team1Count = team.filter(p => p.team === activeMatch?.team1.shortFrame).length;
  const team2Count = team.filter(p => p.team === activeMatch?.team2.shortFrame).length;

  const handleSelectMatch = (match: Match) => {
    setActiveMatch(match);
    setTeam([]); // Reset team
    setCaptain(null);
    setViceCaptain(null);
    setSelectedContest(null);
    setPreviewSource('CREATE_TEAM');
    setMatchTab(match.status === 'Upcoming' || isAdmin ? 'Contests' : 'My Teams');
    setView('MATCH');
  };

  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
        const now = new Date();
        setCurrentTime(now);

        // Auto Live Logic for Upcoming Matches
        setAppMatches(prev => {
            let changed = false;
            const updated = prev.map(m => {
                if (m.status === 'Upcoming' && m.matchDateISO && new Date(m.matchDateISO).getTime() <= now.getTime()) {
                    changed = true;
                    return { ...m, status: 'Live' as const };
                }
                return m;
            });
            return changed ? updated : prev;
        });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getFormattedTimer = (match: Match) => {
    let ts = match.time?.trim() || '';
    if (!ts) return '';

    // Only for App view (not strictly admin input box), strip day names
    ts = ts.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,\s•|]+/, '');

    // Parse logic: if match has matchDateISO, use it exactly
    if (match.matchDateISO) {
       const target = new Date(match.matchDateISO);
       const diff = target.getTime() - currentTime.getTime();
       
       if (diff <= 0) {
           return 'Live Now'; // Actually status will update to 'Live', but as fallback here
       }
       
       const h = Math.floor(diff / (1000 * 60 * 60));
       const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
       const s = Math.floor((diff % (1000 * 60)) / 1000);
       
       const pM = m.toString().padStart(2, '0');
       const pS = s.toString().padStart(2, '0');
       return `${ts} • ${h}h ${pM}m ${pS}s`;
    }

    // Auto-append PM if only a raw time is provided like "7:00" or "07:00"
    if (/^\d{1,2}:\d{2}$/.test(ts)) {
       ts = ts + ' PM';
    } else {
       ts = ts.replace(/pm/i, 'PM').replace(/am/i, 'AM');
    }

    // Fallback regex parsing logic for legacy `time` strings without matchDateISO
    const matchTimeMatch = ts.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
    if (matchTimeMatch) {
       let hours = parseInt(matchTimeMatch[1]);
       const minutes = parseInt(matchTimeMatch[2]);
       const ampm = matchTimeMatch[3];
       
       if (ampm === 'PM' && hours < 12) hours += 12;
       if (ampm === 'AM' && hours === 12) hours = 0;

       const target = new Date();
       target.setHours(hours, minutes, 0, 0);

       // If the time has already passed today, assume it's tomorrow
       if (target.getTime() < currentTime.getTime()) {
           target.setDate(target.getDate() + 1);
       }

       const diff = target.getTime() - currentTime.getTime();
       if (diff > 0) {
           const h = Math.floor(diff / (1000 * 60 * 60));
           const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
           const s = Math.floor((diff % (1000 * 60)) / 1000);
           
           const pM = m.toString().padStart(2, '0');
           const pS = s.toString().padStart(2, '0');
           return `${ts} • ${h}h ${pM}m ${pS}s`;
       }
    }

    if (ts.includes('h') && ts.includes('m') && !ts.includes('PM') && !ts.includes('AM')) {
       const seconds = 59 - (currentTime.getSeconds() % 60);
       return `${ts} ${seconds}s`; 
    }

    return ts;
  };

  const togglePlayer = (player: Player) => {
    const isSelected = team.find(p => p.id === player.id);
    if (isSelected) {
      setTeam(team.filter(p => p.id !== player.id));
      if (captain === player.id) setCaptain(null);
      if (viceCaptain === player.id) setViceCaptain(null);
    } else {
      if (team.length >= 11) return alert('You can only select 11 players!');
      if (creditsLeft < player.credits) return alert('Not enough credits!');
      
      const roleCount = team.filter(p => p.role === player.role).length;
      if (player.role === 'WK' && roleCount >= 4) return alert('Max 4 WKs allowed');
      if (player.role === 'BAT' && roleCount >= 6) return alert('Max 6 Batsmen allowed');
      if (player.role === 'AR' && roleCount >= 4) return alert('Max 4 All-rounders allowed');
      if (player.role === 'BOWL' && roleCount >= 6) return alert('Max 6 Bowlers allowed');

      setTeam([...team, player]);
    }
  };

  const handleSaveTeamAndJoin = () => {
    if (!captain || !viceCaptain) return alert("Please select Captain and Vice-Captain");
    
    // If Admin is editing the BOT Blueprint
    if (isAdminBotEditMode) {
      if (!activeMatch) return;
      const bp = { players: team, captain, viceCaptain };
      localStorage.setItem(`dreamApp_bot_blueprint_${activeMatch.id}`, JSON.stringify(bp));
      
      setSavedTeams(prev => prev.map(t => {
         if (t.match?.id === activeMatch.id && t.userId === 'admin_bot') {
            return { ...t, players: team, captain, viceCaptain, _ref: { ...t, players: team, captain, viceCaptain } };
         }
         return t;
      }));
      
      alert("✅ Auto Team updated successfully. All currently joined auto teams will use this lineup!");
      setIsAdminBotEditMode(null);
      setView('MATCH');
      return;
    }

    // If editing existing user team
    if (editingSavedTeamIndex !== null) {
      const updatedTeams = [...savedTeams];
      updatedTeams[editingSavedTeamIndex] = {
        ...updatedTeams[editingSavedTeamIndex],
        players: team,
        captain,
        viceCaptain
      };
      setSavedTeams(updatedTeams);
      setEditingSavedTeamIndex(null);
      alert("✅ Team updated successfully!");
      setView(editReturnView);
      return;
    }

    const fee = selectedContest ? selectedContest.fee : 59;
    const contestName = selectedContest ? selectedContest.name : 'Mega Contest (₹55 Crore)';

    // Save the created team to "My Matches"
    setSavedTeams([...savedTeams, {
      id: Date.now().toString(),
      match: activeMatch,
      teamId: `T${savedTeams.length + 1}`,
      players: team,
      captain,
      viceCaptain,
      contestName: contestName,
      fee: fee,
      userId: user?.id || 'guest',
      userName: user?.name || user?.email?.split('@')[0] || 'Guest Player'
    }]);

    // Optional: Deduct balance for Mega Contest
    if (balance >= fee) {
       setBalance(prev => prev - fee);
       alert(`🎉 Successfully joined the ${contestName}!\n\n₹${fee} deducted from Wallet.`);
       setView('MY_MATCHES');
    } else {
       alert("Team Saved! But insufficient balance to join contest. Add cash to wallet.");
       setView('WALLET');
    }
  };

  // --- Common UI Components ---

  const renderBottomNav = () => (
    <nav className="bg-app-bg border-t border-app-border flex justify-around p-2 pb-safe shadow-[0_-5px_15px_rgba(0,0,0,0.5)] z-20 shrink-0">
      <button onClick={() => setView('HOME')} className={`flex flex-col items-center p-2 gap-1 ${view === 'HOME' ? 'text-[#FF3B5C]' : 'text-app-text-muted'}`}>
        <Home size={22} fill={view === 'HOME' ? "currentColor" : "none"} />
        <span className="text-[10px] font-bold">Home</span>
      </button>
      <button onClick={() => setView('MY_MATCHES')} className={`flex flex-col items-center p-2 gap-1 ${view === 'MY_MATCHES' ? 'text-[#FF3B5C]' : 'text-app-text-muted'}`}>
        <Clock size={22} fill={view === 'MY_MATCHES' ? "currentColor" : "none"} />
        <span className="text-[10px] font-bold">My Matches</span>
      </button>
      <button onClick={() => setView('REWARD')} className={`flex flex-col items-center p-2 gap-1 ${view === 'REWARD' ? 'text-[#FF3B5C]' : 'text-app-text-muted'}`}>
        <Trophy size={22} fill={view === 'REWARD' ? "currentColor" : "none"} />
        <span className="text-[10px] font-bold">Winners</span>
      </button>
      <button onClick={() => setView('WALLET')} className={`flex flex-col items-center p-2 gap-1 ${view === 'WALLET' ? 'text-[#FF3B5C]' : 'text-app-text-muted'}`}>
        <Wallet size={22} fill={view === 'WALLET' ? "currentColor" : "none"} />
        <span className="text-[10px] font-bold">Wallet</span>
      </button>
      {isAdmin && (
        <button onClick={() => setView('ADMIN')} className={`flex flex-col items-center p-2 gap-1 ${view === 'ADMIN' ? 'text-[#FF3B5C]' : 'text-app-text-muted'}`}>
          <Shield size={22} fill={view === 'ADMIN' ? "currentColor" : "none"} />
          <span className="text-[10px] font-bold">Admin</span>
        </button>
      )}
      <button onClick={() => setView('PROFILE')} className={`flex flex-col items-center p-2 gap-1 ${view === 'PROFILE' ? 'text-[#FF3B5C]' : 'text-app-text-muted'}`}>
        <User size={22} fill={view === 'PROFILE' ? "currentColor" : "none"} />
        <span className="text-[10px] font-bold">Profile</span>
      </button>
    </nav>
  );

  const renderTopBar = (title: string) => (
     <header className="bg-app-bg text-app-text border-b border-app-border p-4 shadow-sm flex items-center justify-between shrink-0">
        <button onClick={() => setView('HOME')} className="p-1 -ml-1 active:bg-app-card/10 rounded-full transition-colors"><ArrowLeft size={24}/></button>
        <h2 className="font-bold">{title}</h2>
        <div className="w-6"/>
     </header>
  );

  // --- Main Screens ---

  const renderHome = () => (
    <div className="flex flex-col h-full bg-app-bg">
      <header className="p-4 flex items-center justify-between pb-2 bg-app-bg">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-app-accent"></div>
          <h1 className="text-xl font-bold text-app-text">Fantasy11</h1>
        </div>
        <div className="flex flex-col items-end cursor-pointer" onClick={() => setView('PROFILE')}>
          <div className="flex items-center gap-2">
             <span className="font-bold text-sm text-app-text">Hey {user ? user.name.split(' ')[0].toUpperCase() : 'ARKING'}</span>
             <span className="bg-yellow-500 text-black text-[10px] px-1.5 py-0.5 rounded flex items-center font-bold">⚡ Lvl 3</span>
          </div>
          <span className="text-[10px] text-app-text-muted">Your match day, y...</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-5">
        <div className="bg-app-accent/90 rounded-xl p-4 flex flex-col relative overflow-hidden mt-2 cursor-pointer" onClick={() => { if(appMatches.length>0) { handleSelectMatch(appMatches[0]) } }}>
           <div className="text-[10px] font-bold text-app-text/80 uppercase">Mega Contest</div>
           <div className="text-4xl font-black text-app-text my-1 tracking-tighter">₹1 Cr</div>
           <div className="text-xs text-app-text/90">Win a share of the biggest prize<br/>pool today</div>
           <Trophy size={80} className="absolute -right-4 -bottom-4 text-app-text/20" />
        </div>

        <h2 className="font-bold flex items-center gap-2 mt-4 text-lg text-app-text">
            <div className="w-2 h-2 rounded-full bg-app-accent"></div> Live Now
            <span className="ml-auto text-xs font-normal text-app-text-muted">{appMatches.filter(m => m.status === 'Live').length}</span>
        </h2>
        {appMatches.filter(m => m.status === 'Live').map(match => renderMatchCard(match))}

        <h2 className="font-bold mt-4 text-app-text text-lg border-b border-app-border pb-2 flex justify-between">
           IPL 2026
           <span className="text-xs text-app-text-muted font-normal self-end mb-1">{appMatches.filter(m => m.status === 'Upcoming').length} matches</span>
        </h2>
        {appMatches.filter(m => m.status === 'Upcoming').map(match => renderMatchCard(match))}

        {appMatches.filter(m => m.status === 'Upcoming' || m.status === 'Live').length === 0 && (
           <div className="flex flex-col items-center justify-center p-10 opacity-50 text-center">
              <h3 className="font-bold text-app-text-muted">No Matches Available</h3>
           </div>
        )}
      </div>
      {renderBottomNav()}
    </div>
  );

  const renderMatchCard = (match: Match) => (
    <div 
      key={match.id} 
      onClick={() => handleSelectMatch(match)}
      className="bg-app-card rounded-xl flex flex-col p-4 pb-2 cursor-pointer active:scale-[0.98] transition-all shadow-sm border border-app-border/50"
    >
      <div className="flex justify-between items-center mb-3">
        <div className="flex flex-col items-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-app-text border-2 border-app-border-hover ${match.team1.color}`}>
             {match.team1.shortFrame}
          </div>
          <span className="text-xs text-app-text mt-1 font-semibold">{match.team1.shortFrame}</span>
        </div>
        
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-app-text-muted font-bold mb-1">VS</span>
          {match.lineupStatus === 'OUT' && match.status === 'Upcoming' && <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded absolute top-2 right-2">LINEUPS OUT</span>}
          {match.status === 'Completed' ? (
             <div className="bg-app-card-hover text-app-text-muted text-[10px] font-bold px-2 py-0.5 rounded">COMPLETED</div>
          ) : match.status === 'Live' ? (
             <div className="text-app-accent text-xs font-bold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-app-accent animate-pulse"></div> LIVE</div>
          ) : (
             <div className="text-[#FFD700] text-xs font-bold">{getFormattedTimer(match)}</div>
          )}
        </div>

        <div className="flex flex-col items-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-app-text border-2 border-app-border-hover ${match.team2.color}`}>
             {match.team2.shortFrame}
          </div>
          <span className="text-xs text-app-text mt-1 font-semibold">{match.team2.shortFrame}</span>
        </div>
      </div>
      
      <div className="bg-app-card-hover rounded-lg flex justify-between p-2 mt-2 -mx-2 -mb-2 items-center">
        <div className="flex items-center text-[10px] font-bold text-app-text-muted gap-1.5">
          {match.status === 'Live' ? <div className="text-app-accent hover:animate-pulse">● In Progress</div> : <div><Clock size={10} className="inline mr-1 -mt-0.5"/> {match.time}</div>}
        </div>
        <div className="flex items-center text-[10px] font-bold text-app-text-muted">
           <Trophy size={10} className="text-yellow-500 mr-1"/> {match.totalPrize}
        </div>
      </div>
    </div>
  );

  const handleAddBot = (e: React.MouseEvent, contest: Contest, type: 'AUTO' | 'BOOT' = 'AUTO') => {
    e.stopPropagation();
    if (!activeMatch) return;
    const botBlueprintStr = localStorage.getItem(`dreamApp_bot_blueprint_${activeMatch.id}`);
    let bp;
    if (botBlueprintStr) {
       bp = JSON.parse(botBlueprintStr);
    } else {
       const available = appPlayers.filter(p => p.team === activeMatch.team1.shortFrame || p.team === activeMatch.team2.shortFrame);
       const players = available.slice(0, 11);
       bp = { players, captain: players[0]?.id || null, viceCaptain: players[1]?.id || null };
       localStorage.setItem(`dreamApp_bot_blueprint_${activeMatch.id}`, JSON.stringify(bp));
    }
    
    const BOT_NAMES = ['Rahul', 'Amit', 'Rohit', 'Virat', 'Mahi', 'Suresh', 'Dinesh', 'Sachin', 'Kapil', 'Virender', 'Ravi', 'Ramesh', 'Sanjay', 'Vicky', 'Raju'];
    const randomName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + Math.floor(Math.random() * 9999).toString();

    const newBot = {
       id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
       match: activeMatch,
       teamId: type === 'BOOT' ? `BOT-${Date.now().toString().slice(-4)}` : `T${Math.floor(Math.random() * 8999) + 1000}`,
       players: bp.players,
       captain: bp.captain,
       viceCaptain: bp.viceCaptain,
       contestName: contest.name,
       fee: contest.entryFee,
       userId: type === 'BOOT' ? 'admin_bot_boot' : 'admin_bot',
       userName: type === 'BOOT' ? `BOOT ${Date.now().toString().slice(-3)}` : randomName
    };
    
    setSavedTeams(prev => [...prev, newBot as any]);
  };

  const handleRemoveBot = (e: React.MouseEvent, contest: Contest, type: 'AUTO' | 'BOOT' = 'AUTO') => {
     e.stopPropagation();
     setSavedTeams(prev => {
        const bots = prev.filter(t => t.match?.id === activeMatch?.id && t.contestName === contest.name && t.userId === (type === 'BOOT' ? 'admin_bot_boot' : 'admin_bot'));
        if (bots.length === 0) return prev;
        const botToRemove = bots[bots.length - 1]; // remove the last one added
        return prev.filter(t => t.id !== botToRemove.id);
     });
  };

  const handleEditBotBlueprint = (e: React.MouseEvent) => {
     e.stopPropagation();
     if (!activeMatch) return;
     const botBlueprintStr = localStorage.getItem(`dreamApp_bot_blueprint_${activeMatch.id}`);
     let bp;
     if (botBlueprintStr) {
        bp = JSON.parse(botBlueprintStr);
     } else {
        const available = appPlayers.filter(p => p.team === activeMatch.team1.shortFrame || p.team === activeMatch.team2.shortFrame);
        bp = { players: available.slice(0, 11), captain: available[0]?.id || null, viceCaptain: available[1]?.id || null };
     }
     setTeam(bp.players);
     setCaptain(bp.captain);
     setViceCaptain(bp.viceCaptain);
     setIsAdminBotEditMode(activeMatch.id);
     setView('CREATE_TEAM');
  };

  const renderBotControls = (contest: Contest) => {
     if (!isAdmin || !activeMatch) return null;
     const botTeamsAuto = savedTeams.filter(t => t.match?.id === activeMatch.id && t.contestName === contest.name && t.userId === 'admin_bot');
     const botTeamsBoot = savedTeams.filter(t => t.match?.id === activeMatch.id && t.contestName === contest.name && t.userId === 'admin_bot_boot');
     const botCountAuto = botTeamsAuto.length;
     const botCountBoot = botTeamsBoot.length;
     
     const isExpanded = expandedBotsContest === contest.id;

     return (
        <div className="absolute right-4 top-3 flex items-center justify-end z-20 gap-2">
           {!isExpanded ? (
              <button 
                 onClick={(e) => { e.stopPropagation(); setExpandedBotsContest(contest.id); }}
                 className="bg-app-card-inner border border-app-border text-[10px] font-bold text-app-text-muted px-2 py-1 rounded shadow-sm hover:text-app-text flex items-center gap-1"
              >
                 + ADD BOTs
              </button>
           ) : (
              <div className="flex gap-2">
                 <div className="flex items-center bg-app-card-inner border border-app-border rounded shadow-sm" onClick={e=>e.stopPropagation()}>
                    <button onClick={(e) => handleRemoveBot(e, contest)} className="px-2 py-1 text-app-text-muted hover:text-red-400 font-bold border-r border-app-border">-</button>
                    <span 
                      onClick={handleEditBotBlueprint}
                      className="px-2 py-1 text-[10px] cursor-pointer hover:bg-app-card-hover font-bold text-yellow-400 flex items-center gap-1 min-w-[70px] justify-center text-center"
                      title="Edit Blueprint"
                    >
                      <span>Auto Team {botCountAuto > 0 ? `(${botCountAuto})` : ''}</span> 
                      <Edit2 size={10} className="opacity-80" />
                    </span>
                    <button onClick={(e) => handleAddBot(e, contest)} className="px-2 py-1 text-app-text-muted hover:text-green-400 font-bold border-l border-app-border">+</button>
                 </div>
                 
                 <div className="flex items-center bg-app-card-inner border border-app-border rounded shadow-sm" onClick={e=>e.stopPropagation()}>
                    <button onClick={(e) => handleRemoveBot(e, contest, 'BOOT')} className="px-2 py-1 text-app-text-muted hover:text-red-400 font-bold border-r border-app-border">-</button>
                    <span 
                      onClick={handleEditBotBlueprint}
                      className="px-2 py-1 text-[10px] cursor-pointer hover:bg-app-card-hover font-bold text-yellow-400 flex items-center justify-center text-center px-2"
                      title="Edit Blueprint"
                    >
                      BOOT {botCountBoot > 0 ? `(${botCountBoot})` : ''}
                    </span>
                    <button onClick={(e) => handleAddBot(e, contest, 'BOOT')} className="px-2 py-1 text-app-text-muted hover:text-green-400 font-bold border-l border-app-border">+</button>
                 </div>
              </div>
           )}
        </div>
     );
  };

  const renderContests = () => {
    if (!activeMatch) return null;

    const megaContests = appContests.filter(c => c.type === 'Mega');
    const h2hContests = appContests.filter(c => c.type === 'H2H');

    return (
      <div className="flex flex-col h-full bg-app-bg">
        <header className="bg-app-bg text-app-text p-4 flex items-center justify-between shadow-sm z-10 shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('HOME')} className="p-1 -ml-1 active:bg-app-card/10 rounded-full transition-colors"><ArrowLeft size={24} /></button>
              <div className="flex flex-col">
                <span className="font-bold text-sm block">{activeMatch.team1.shortFrame} vs {activeMatch.team2.shortFrame}</span>
                <span className="text-[10px] text-app-text-muted">{activeMatch.series}</span>
              </div>
            </div>
            {activeMatch.status === 'Upcoming' && (
              <span className="text-[10px] font-bold text-app-text-muted flex items-center gap-1"><Clock size={12}/> {getFormattedTimer(activeMatch)} left</span>
            )}
        </header>

        <div className="bg-app-card p-4 flex justify-between items-center z-10 shrink-0 border-b border-app-border">
           <div className="flex flex-col items-center">
             <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl text-app-text border-2 border-app-border-hover ${activeMatch.team1.color}`}>{activeMatch.team1.shortFrame}</div>
             <span className="text-xs text-app-text mt-1 font-bold">{activeMatch.team1.shortFrame}</span>
           </div>
           <div className="flex flex-col items-center text-center">
              {activeMatch.status === 'Live' ? <span className="text-app-accent font-bold text-base tracking-widest">LIVE</span> : <span className="text-[#FFD700] font-bold text-sm">{activeMatch.status.toUpperCase()}</span>}
              <span className="text-xs text-app-text-muted mt-1">{activeMatch.time}</span>
              <span className="text-[10px] text-app-text-muted mt-0.5">Stadium</span>
           </div>
           <div className="flex flex-col items-center">
             <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl text-app-text border-2 border-app-border-hover ${activeMatch.team2.color}`}>{activeMatch.team2.shortFrame}</div>
             <span className="text-xs text-app-text mt-1 font-bold">{activeMatch.team2.shortFrame}</span>
           </div>
        </div>

        <div className="flex bg-app-bg text-xs font-bold shrink-0 border-b border-app-border">
           {(activeMatch.status === 'Upcoming' || isAdmin) && (
             <button className={`flex-1 py-3 ${matchTab === 'Contests' ? 'text-app-accent border-b-2 border-app-accent' : 'text-app-text-muted'}`} onClick={() => setMatchTab('Contests')}>
               Contests
             </button>
           )}
           <button className={`flex-1 py-3 ${matchTab === 'My Teams' || (activeMatch.status !== 'Upcoming' && !isAdmin) ? 'text-app-accent border-b-2 border-app-accent' : 'text-app-text-muted'}`} onClick={() => setMatchTab('My Teams')}>
             My Teams
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
          {(matchTab === 'Contests' && (activeMatch.status === 'Upcoming' || isAdmin)) ? (
             <>
              {megaContests.map(c => (
                <div key={c.id} onClick={() => { setActiveContestDetails(c); setView('CONTEST_DETAILS'); }} className="bg-app-card rounded-xl shadow-sm border border-app-border overflow-hidden mb-4 cursor-pointer active:scale-[0.99] transition-transform relative">
                  <div className="p-4 border-b border-app-border">
                    <div className="flex justify-between items-center mb-1">
                       <p className="text-xs text-app-text-muted font-semibold">Prize Pool</p>
                       {renderBotControls(c)}
                    </div>
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-3xl font-black text-app-text">{c.prizeText}</p>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if(activeMatch.status !== 'Upcoming') {
                             alert("Match is already live or completed!"); return;
                          }
                          setSelectedContest({fee: c.entryFee, name: c.name});
                          setView('CREATE_TEAM');
                        }}
                        className={`${activeMatch.status === 'Upcoming' ? 'bg-app-accent active:scale-95 hover:bg-app-accent' : 'bg-slate-700'} transition-all text-app-text font-bold py-1.5 px-6 rounded text-lg shadow-sm`}
                      >
                        ₹{c.entryFee}
                      </button>
                    </div>
                    <div className="bg-app-bg h-1.5 rounded-full mb-2 overflow-hidden">
                      <div className="bg-app-accent h-full" style={{width:'65%'}}></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-app-text-muted font-semibold">
                      <span className="text-red-400">{Math.floor(c.spots * 0.35).toLocaleString('en-IN')} spots left</span>
                      <span>{c.spots.toLocaleString('en-IN')} spots</span>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-slate-50/5 dark:bg-app-card-inner flex shrink-0 items-center justify-start gap-6 text-[11px] font-semibold text-app-text-muted">
                    <span className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full border border-yellow-500 text-yellow-500 flex items-center justify-center text-[8px] font-bold bg-yellow-500/10">1st</div> {c.firstPrize || '₹10 Lakh'}</span>
                    <span className="flex items-center gap-1.5"><Trophy size={11} className="text-app-text-muted"/> {c.winPercentage || 48}%</span>
                    <span className="flex items-center gap-1.5"><div className="w-4 h-4 border border-slate-500 rounded flex items-center justify-center text-[8px] font-bold text-app-text-muted">M</div> {c.maxTeams || 20}</span>
                  </div>
                </div>
              ))}

              {h2hContests.map(c => (
                <div key={c.id} onClick={() => { setActiveContestDetails(c); setView('CONTEST_DETAILS'); }} className="bg-app-card rounded-xl shadow-sm border border-app-border overflow-hidden mb-4 cursor-pointer active:scale-[0.99] transition-transform relative">
                  <div className="p-4 border-b border-app-border">
                    <div className="flex justify-between items-center mb-1">
                       <p className="text-xs text-app-text-muted font-semibold">Prize Pool</p>
                       {renderBotControls(c)}
                    </div>
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-3xl font-black text-app-text">{c.prizeText}</p>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if(activeMatch.status !== 'Upcoming') {
                               alert("Match is already live or completed!"); return;
                            }
                            setSelectedContest({fee: c.entryFee, name: c.name});
                            setView('CREATE_TEAM');
                          }}
                          className={`${activeMatch.status === 'Upcoming' ? 'bg-app-accent active:scale-95 hover:bg-app-accent' : 'bg-slate-700'} transition-all text-app-text font-bold py-1.5 px-6 rounded text-lg shadow-sm border-b-2 border-red-800`}
                        >
                          ₹{c.entryFee}
                        </button>
                    </div>
                    <div className="bg-app-bg h-1.5 rounded-full mb-2 overflow-hidden">
                      <div className="bg-app-accent h-full w-[50%]"></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-app-text-muted font-semibold">
                      <span className="text-red-400">1 spots left</span>
                      <span>2 spots</span>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50/5 dark:bg-app-card-inner flex shrink-0 items-center justify-start gap-6 text-[11px] font-semibold text-app-text-muted">
                    <span className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full border border-yellow-500 text-yellow-500 flex items-center justify-center text-[8px] font-bold bg-yellow-500/10">1st</div> {c.firstPrize || c.prizeText}</span>
                    <span className="flex items-center gap-1.5"><Trophy size={11} className="text-app-text-muted"/> {c.winPercentage || 50}%</span>
                    <span className="flex items-center gap-1.5"><div className="w-4 h-4 border border-slate-500 rounded flex items-center justify-center text-[8px] font-bold text-app-text-muted">M</div> {c.maxTeams || 1}</span>
                  </div>
                </div>
              ))}
             </>
          ) : (
             <>
                {savedTeams.filter(t => t.match.id === activeMatch.id && t.userId === (user?.id || 'guest')).length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full opacity-60 mt-10">
                        <Trophy size={60} className="text-app-text-muted mb-4" />
                        <p className="font-bold text-app-text-muted">No teams found!</p>
                        <p className="text-sm text-app-text-muted">You didn't join any contests.</p>
                     </div>
                ) : (
                   savedTeams.filter(t => t.match.id === activeMatch.id && t.userId === (user?.id || 'guest')).map((st, i) => {
                       const currentMatchStatus = activeMatch.status;
                       const totalPoints = (st.players || []).reduce((acc: number, player: Player) => {
                          const livePlayer = appPlayers.find(p => p.id === player.id) || player;
                          let mult = 1;
                          if (livePlayer.id === st.captain) mult = 2;
                          else if (livePlayer.id === st.viceCaptain) mult = 1.5;
                          return acc + (livePlayer.points * mult);
                       }, 0);
                       return (
                           <div key={i} className={`bg-app-card rounded-xl shadow-sm border border-app-border overflow-hidden ${currentMatchStatus === 'Completed' ? 'opacity-60' : ''}`}>
                              <div className="p-4 flex flex-col gap-3 text-sm">
                                 <div className="flex justify-between items-center">
                                   <span className="font-bold">{st.match.team1.name}</span>
                                   <div className="flex flex-col items-center">
                                      <span className="bg-red-50 text-app-accent px-2 py-1 rounded text-[10px] font-bold">{currentMatchStatus === 'Live' ? 'In Progress' : currentMatchStatus === 'Completed' ? 'Ended' : st.match.time}</span>
                                      {(currentMatchStatus === 'Live' || currentMatchStatus === 'Completed') && (
                                         <span className="text-sm font-black text-green-500 mt-1">{totalPoints} pts</span>
                                      )}
                                      {currentMatchStatus === 'Completed' && st.prizeDistributed && st.amountWon !== undefined && (
                                         <span className="text-xs font-black text-yellow-500 mt-0.5 tracking-tight uppercase">Won ₹{st.amountWon.toFixed(2)}</span>
                                      )}
                                   </div>
                                   <span className="font-bold">{st.match.team2.name}</span>
                                 </div>
                                 <div className="bg-app-bg rounded p-2 flex justify-between items-center border border-app-border">
                                   <span className="text-xs font-bold text-app-text-muted">{st.contestName}</span>
                                   <span className="text-xs font-bold text-app-text-muted">Entry: ₹{st.fee}</span>
                                 </div>
                              </div>
                              <div className="px-4 py-3 bg-app-card-inner border-t border-app-border flex justify-between items-center gap-3">
                                 <button 
                                     onClick={() => {
                                         setSelectedContest({ fee: st.fee, name: st.contestName });
                                         const c = appContests.find(c => c.name === st.contestName) || appContests[0];
                                         setActiveContestDetails(c);
                                         setView('CONTEST_DETAILS');
                                     }} 
                                     className={`font-bold text-xs active:opacity-70 w-full py-2 rounded-full text-center border bg-app-accent text-app-text border-blue-600`}
                                 >
                                     Dashboard / Leaderboard ({st.teamId})
                                 </button>
                              </div>
                           </div>
                       )
                   })
                )}
             </>
          )}
        </div>
      </div>
    );
  };

  const renderCreateTeam = () => {
    if (!activeMatch) return null;
    const displayedPlayers = appPlayers.filter(p => p.role === activeRole);

    return (
      <div className="flex flex-col h-full bg-app-card relative">
        <header className="bg-app-bg text-app-text border-b border-app-border p-4 pb-2 z-10 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { setView('MATCH'); setIsAdminBotEditMode(null); }} className="p-1 -ml-1 active:bg-app-card/10 rounded-full"><ArrowLeft size={24} /></button>
            <div className="font-bold text-sm flex gap-2">
              <span>{activeMatch.time}</span>
              <span className="opacity-50">|</span>
              <span className="text-yellow-400">CREATE TEAM 1</span>
            </div>
            <button className="p-1 active:bg-app-card/10 rounded-full"><Info size={20} /></button>
          </div>

          <div className="bg-app-card-hover rounded-lg p-3 relative overflow-hidden shadow-inner">
            <div className="flex justify-between items-center mb-3">
              <div className="text-center">
                <p className="text-[10px] text-app-text-muted font-bold uppercase mb-0.5">Players</p>
                <p className="font-bold text-lg leading-none">{team.length}<span className="text-app-text-muted text-sm">/11</span></p>
              </div>
              <div className="flex gap-4">
                <div className="text-center flex flex-col items-center">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md border border-white/20 ${activeMatch.team1.color}`}>
                     {activeMatch.team1.shortFrame}
                   </div>
                   <span className="text-[10px] font-bold mt-1 text-app-text-muted">{team1Count}</span>
                </div>
                <div className="text-center flex flex-col items-center">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md border border-white/20 ${activeMatch.team2.color}`}>
                     {activeMatch.team2.shortFrame}
                   </div>
                   <span className="text-[10px] font-bold mt-1 text-app-text-muted">{team2Count}</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-app-text-muted font-bold uppercase mb-0.5">Credits Left</p>
                <p className="font-bold text-lg leading-none">{creditsLeft.toFixed(1)}</p>
              </div>
            </div>

            <div className="flex gap-1">
              {[...Array(11)].map((_, i) => (
                <div key={i} className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                  {i < team.length && (
                    <motion.div initial={{width: 0}} animate={{width: '100%'}} className="h-full bg-green-500" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="flex border-b border-app-border shrink-0">
          {(['WK', 'BAT', 'AR', 'BOWL'] as Role[]).map((r) => {
            const count = team.filter(p => p.role === r).length;
            return (
              <button 
                key={r}
                onClick={() => setActiveRole(r)}
                className={`flex-1 py-3 text-sm font-bold flex flex-col items-center justify-center border-b-2 transition-colors ${activeRole === r ? 'text-app-accent border-app-accent' : 'text-app-text-muted border-transparent'}`}
              >
                {r} <span className={`text-[10px] ${count > 0 ? (activeRole === r ? 'text-app-accent' : 'text-app-text') : 'opacity-0'}`}>({count})</span>
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto bg-app-bg pb-24">
          <div className="bg-app-card">
            <AnimatePresence>
              {displayedPlayers.map((player) => {
                const isSelected = !!team.find(p => p.id === player.id);
                const tColor = player.team === activeMatch.team1.shortFrame ? activeMatch.team1.color : activeMatch.team2.color;
                
                return (
                  <motion.div 
                    key={player.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-center p-3 border-b border-app-border transition-colors ${isSelected ? 'bg-orange-50' : 'hover:bg-app-card-inner'}`}
                    onClick={() => togglePlayer(player)}
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 relative border border-app-border bg-app-bg flex items-end justify-center">
                      <User size={40} className="text-app-text-muted translate-y-2" />
                      <div className={`absolute bottom-0 left-0 right-0 text-[10px] text-app-text font-bold text-center py-0.5 ${tColor}`}>{player.team}</div>
                    </div>
                    
                    <div className="flex-1 pl-4 pr-2">
                       <h4 className="font-bold text-sm text-app-text">{player.name}</h4>
                       <p className="text-[10px] text-app-text-muted mt-0.5">{player.points} pts</p>
                    </div>

                    <div className="w-16 flex items-center justify-between text-sm">
                      <span className="font-bold text-app-text ml-2">{player.credits}</span>
                      <button 
                        className={`w-6 h-6 rounded-full flex items-center justify-center ml-2 border transition-all ${
                          isSelected ? 'bg-red-50 border-app-accent text-app-accent' : 'border-green-600 text-green-600'
                        }`}
                      >
                        {isSelected ? <Minus size={16} /> : <Plus size={16} />}
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Create Team Footer Options */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-app-card/90 backdrop-blur-md border-t border-app-border flex justify-between gap-4 z-20">
           <button 
             onClick={() => setView('TEAM_PREVIEW')}
             className="flex-1 border border-app-border-hover font-bold bg-app-card text-app-text py-3 rounded-lg shadow-sm active:bg-app-card-inner"
           >
             PREVIEW
           </button>
           <button 
             onClick={() => {
               if (team.length < 11) return alert(`Select ${11 - team.length} more players`);
               setView('SELECT_CAPTAIN');
             }}
             className={`flex-1 font-bold py-3 mx-auto rounded-lg shadow-md transition-colors ${
               team.length === 11 ? 'bg-green-600 hover:bg-green-700 text-app-text' : 'bg-slate-300 text-app-text-muted cursor-not-allowed'
             }`}
           >
             NEXT
           </button>
        </div>
      </div>
    );
  };

  const renderTeamPreview = () => {
    const isLiveOrCompleted = activeMatch?.status === 'Live' || activeMatch?.status === 'Completed';
    const totalPoints = team.reduce((acc, p) => {
       const latestP = appPlayers.find(ap => ap.id === p.id) || p;
       const mult = p.id === captain ? 2 : (p.id === viceCaptain ? 1.5 : 1);
       return acc + (latestP.points * mult);
    }, 0);

    return (
    <div className="flex flex-col h-full bg-green-700 relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(255,255,255,0.1) 50px, rgba(255,255,255,0.1) 100px)' }}></div>
      <header className="flex justify-between items-center p-4 text-app-text z-10 relative">
         <button onClick={() => setView(previewSource === 'MY_MATCHES' ? 'MY_MATCHES' : previewSource === 'CONTEST_DETAILS' ? 'CONTEST_DETAILS' : 'CREATE_TEAM')} className="p-1 -ml-1 active:bg-app-card/10 rounded-full"><ArrowLeft size={24} /></button>
         <div className="flex flex-col items-center">
            {previewTeamInfo ? (
                <>
                  <h2 className="font-bold">{previewTeamInfo.name}</h2>
                  {isLiveOrCompleted && <span className="text-xs bg-app-card/20 px-2 py-0.5 rounded mt-1 font-bold">Total Pts: {previewTeamInfo.points ?? totalPoints}</span>}
                </>
            ) : (
                <>
                  <h2 className="font-bold">Team Preview</h2>
                  {isLiveOrCompleted && <span className="text-xs bg-app-card/20 px-2 py-0.5 rounded mt-1 font-bold">Total Pts: {totalPoints}</span>}
                </>
            )}
         </div>
         <div className="w-8 flex justify-end">
            {(!isLiveOrCompleted && previewSource === 'MY_MATCHES') && (
               <button onClick={() => setView('CREATE_TEAM')} className="p-1 active:bg-app-card/10 rounded-full bg-app-card/20 hover:bg-app-card/30 transition-colors">
                  <Edit2 size={16} className="text-app-text" />
               </button>
            )}
         </div>
      </header>

      <div className="flex-1 relative z-10 flex flex-col justify-around py-4">
         {(['WK', 'BAT', 'AR', 'BOWL'] as Role[]).map(role => {
             const playersInRole = team.filter(p => p.role === role);
             if (playersInRole.length === 0) return null;
             return (
                 <div key={role} className="flex flex-col items-center w-full">
                     <span className="text-app-text/60 text-[10px] font-bold mb-2">{role}</span>
                     <div className="flex justify-center gap-2 sm:gap-4 w-full px-2">
                         {playersInRole.map(p => {
                             const latestP = appPlayers.find(ap => ap.id === p.id) || p;
                             const isC = p.id === captain;
                             const isVC = p.id === viceCaptain;
                             return (
                             <div key={p.id} className="flex flex-col items-center w-16">
                                 <div className="relative">
                                   <div className="w-10 h-10 bg-app-bg rounded-full flex items-end justify-center overflow-hidden border-2 border-white shadow-md">
                                      <User size={30} className="text-app-text-muted" />
                                   </div>
                                   {(isC || isVC) && (
                                     <div className="absolute -top-1 -right-1 w-4 h-4 bg-app-card-alt border border-white text-app-text rounded-full flex items-center justify-center text-[8px] font-bold">
                                       {isC ? 'C' : 'VC'}
                                     </div>
                                   )}
                                 </div>
                                 <span className="bg-app-bg text-app-text border-b border-app-border text-[9px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap mt-1 max-w-[60px] truncate w-full text-center">{p.name}</span>
                                 <span className="text-app-text text-[10px] font-bold mt-0.5">
                                   {isLiveOrCompleted ? `${latestP.points * (isC ? 2 : isVC ? 1.5 : 1)} Pts` : `${p.credits} Cr`}
                                 </span>
                             </div>
                             )
                         })}
                     </div>
                 </div>
             )
         })}
      </div>
    </div>
  );
  };

  const renderSelectCaptain = () => (
    <div className="flex flex-col h-full bg-app-card relative">
      <header className="bg-app-bg text-app-text border-b border-app-border p-4 pb-2 z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setView('CREATE_TEAM')} className="p-1 -ml-1 active:bg-app-card/10 rounded-full"><ArrowLeft size={24} /></button>
          <div className="font-bold text-sm">Choose C & VC</div>
          <div className="w-6" />
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto bg-app-bg pb-20">
         <div className="bg-app-card">
           {team.map(player => (
             <div key={player.id} className="flex items-center p-3 border-b border-app-border">
               <div className="w-12 h-12 rounded-full bg-app-bg flex items-end justify-center overflow-hidden shrink-0 border border-app-border">
                  <User size={40} className="text-app-text-muted translate-y-2" />
               </div>
               <div className="flex-1 pl-3">
                  <h4 className="font-bold text-sm text-app-text">{player.name}</h4>
                  <span className="text-[10px] font-medium text-app-text-muted">{player.team} | {player.role}</span>
               </div>
               <div className="w-1/2 flex items-center justify-around px-2">
                  <button 
                     onClick={() => {
                        if (viceCaptain === player.id) setViceCaptain(null);
                        setCaptain(captain === player.id ? null : player.id);
                     }}
                     className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold text-sm transition-all shadow-sm ${captain === player.id ? 'bg-app-card-alt border-slate-900 text-app-text scale-110' : 'border-app-border-hover text-app-text-muted bg-app-card'}`}
                  >C</button>
                  <button 
                     onClick={() => {
                        if (captain === player.id) setCaptain(null);
                        setViceCaptain(viceCaptain === player.id ? null : player.id);
                     }}
                     className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold text-sm transition-all shadow-sm ${viceCaptain === player.id ? 'bg-app-card-alt border-slate-900 text-app-text scale-110' : 'border-app-border-hover text-app-text-muted bg-app-card'}`}
                  >VC</button>
               </div>
             </div>
           ))}
         </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-app-card border-t border-app-border z-20">
         <button 
           onClick={handleSaveTeamAndJoin}
           className={`w-full py-3 rounded-lg font-bold shadow-md transition-colors ${captain && viceCaptain ? 'bg-green-600 text-app-text hover:bg-green-700' : 'bg-slate-300 text-app-text-muted cursor-not-allowed'}`}
         >
           {editingSavedTeamIndex !== null ? 'UPDATE TEAM' : 'SAVE TEAM & JOIN'}
         </button>
      </div>
    </div>
  );

  // --- NEW: Additional Missing Screens ---

  const renderMyMatches = () => {
     // Filter matches the user joined
     const tabs = ['Upcoming', 'Live', 'Completed'] as const;

     const filteredTeams = savedTeams.filter(st => {
         const currentMatchStatus = appMatches.find(m => m.id === st.match.id)?.status || 'Upcoming';
         return currentMatchStatus === myMatchesTab;
     });

     return (
       <div className="flex flex-col h-full bg-app-bg">
          <header className="bg-app-bg text-app-text border-b border-app-border pt-4 shadow-sm shrink-0">
             <h2 className="font-bold text-xl text-center pb-4">My Matches</h2>
             <div className="flex bg-app-card text-app-text-muted text-sm font-bold shadow-sm">
                {tabs.map(tab => (
                   <button 
                      key={tab}
                      onClick={() => setMyMatchesTab(tab)}
                      className={`flex-1 py-3 text-center border-b-2 transition-colors ${myMatchesTab === tab ? 'border-app-accent text-app-accent' : 'border-transparent'}`}
                   >
                      {tab}
                   </button>
                ))}
             </div>
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

             {filteredTeams.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full opacity-60 mt-10">
                    <Trophy size={60} className="text-app-text-muted mb-4" />
                    <p className="font-bold text-app-text-muted">No {myMatchesTab} matches!</p>
                    <p className="text-sm text-app-text-muted">Join a contest to see it here.</p>
                 </div>
             ) : (
                 filteredTeams.map((st, i) => {
                     // Check current match status from appMatches
                     const currentMatchStatus = appMatches.find(m => m.id === st.match.id)?.status || 'Upcoming';
                     
                     // Calculate dynamic points
                     const totalPoints = (st.players || []).reduce((acc: number, player: Player) => {
                        const livePlayer = appPlayers.find(p => p.id === player.id) || player;
                        let mult = 1;
                        if (livePlayer.id === st.captain) mult = 2;
                        else if (livePlayer.id === st.viceCaptain) mult = 1.5;
                        return acc + (livePlayer.points * mult);
                     }, 0);

                     return (
                         <div key={i} className={`bg-app-card rounded-xl shadow-sm border border-app-border overflow-hidden ${currentMatchStatus === 'Completed' ? 'opacity-60' : ''}`}>
                            <div className="px-3 py-2.5 bg-app-card-inner border-b border-app-border flex justify-between items-center text-xs font-bold text-app-text-muted">
                               <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                                  <span className="truncate max-w-[40%] sm:max-w-none">{st.match.series}</span>
                                  {currentMatchStatus === 'Upcoming' && (
                                     <div className="flex flex-shrink-0 gap-1.5">
                                        <button 
                                           onClick={(e) => {
                                               e.stopPropagation();
                                               setActiveMatch(st.match);
                                               setSelectedContest({ fee: st.fee, name: st.contestName });
                                               setTeam([]);
                                               setCaptain(null);
                                               setViceCaptain(null);
                                               setView('CREATE_TEAM');
                                           }}
                                           className="flex items-center gap-1 bg-app-card border border-app-border px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] text-app-text-muted shadow-sm active:bg-app-bg"
                                        >
                                           <PlusCircle size={10} className="text-green-600" /> NEW
                                        </button>
                                        <button 
                                           onClick={(e) => {
                                               e.stopPropagation();
                                               setActiveMatch(st.match);
                                               setSelectedContest({ fee: st.fee, name: st.contestName });
                                               setTeam(st.players);
                                               setCaptain(null);
                                               setViceCaptain(null);
                                               setView('SELECT_CAPTAIN');
                                           }}
                                           className="flex items-center gap-1 bg-app-card border border-app-border px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] text-app-text-muted shadow-sm active:bg-app-bg"
                                        >
                                           <Copy size={10} className="text-blue-600" /> CLONE
                                        </button>
                                     </div>
                                  )}
                               </div>
                               <div className="shrink-0 text-[10px] sm:text-xs">
                                 {currentMatchStatus === 'Live' ? (
                                    <span className="text-app-accent flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-app-accent animate-pulse"></div> LIVE</span>
                                 ) : currentMatchStatus === 'Completed' ? (
                                    <span className="text-green-600">Completed</span>
                                 ) : (
                                    <button 
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingSavedTeamIndex(i);
                                          setEditReturnView('MY_MATCHES');
                                          setActiveMatch(st.match);
                                          setSelectedContest({ fee: st.fee, name: st.contestName });
                                          setTeam(st.players || []);
                                          setCaptain(st.captain || null);
                                          setViceCaptain(st.viceCaptain || null);
                                          setView('CREATE_TEAM');
                                      }}
                                      className="text-app-text-muted hover:text-blue-600 p-1 hover:bg-blue-50 rounded-full transition-colors flex flex-col items-center justify-center"
                                      title="Edit Team"
                                    >
                                       <Edit2 size={16} />
                                    </button>
                                 )}
                               </div>
                            </div>

                            <div className="p-4 flex flex-col gap-3 text-sm">
                               <div className="flex justify-between items-center">
                                 <span className="font-bold">{st.match.team1.name}</span>
                                 <div className="flex flex-col items-center">
                                    <span className="bg-red-50 text-app-accent px-2 py-1 rounded text-[10px] font-bold">{currentMatchStatus === 'Live' ? 'In Progress' : currentMatchStatus === 'Completed' ? 'Ended' : st.match.time}</span>
                                    {(currentMatchStatus === 'Live' || currentMatchStatus === 'Completed') && (
                                       <span className="text-sm font-black text-green-500 mt-1">{totalPoints} pts</span>
                                    )}
                                    {currentMatchStatus === 'Completed' && st.prizeDistributed && st.amountWon !== undefined && (
                                       <span className="text-xs font-black text-yellow-500 mt-0.5 tracking-tight uppercase">Won ₹{st.amountWon.toFixed(2)}</span>
                                    )}
                                 </div>
                                 <span className="font-bold">{st.match.team2.name}</span>
                               </div>
                               <div className="bg-app-bg rounded p-2 flex justify-between items-center border border-app-border">
                                 <span className="text-xs font-bold text-app-text-muted">{st.contestName}</span>
                                 <span className="text-xs font-bold text-app-text-muted">Entry: ₹{st.fee}</span>
                               </div>
                            </div>
                            <div className="px-4 py-3 bg-app-card-inner border-t border-app-border flex justify-between items-center gap-3">
                               <button 
                                   onClick={() => {
                                       const latestMatch = appMatches.find(m => m.id === st.match.id) || st.match;
                                       if (currentMatchStatus !== 'Upcoming') {
                                           setActiveMatch(latestMatch);
                                           setSelectedContest({ fee: st.fee, name: st.contestName });
                                           const c = appContests.find(c => c.name === st.contestName) || appContests[0];
                                           setActiveContestDetails(c);
                                           setView('CONTEST_DETAILS');
                                       } else {
                                           setActiveMatch(latestMatch);
                                           setTeam(st.players);
                                           setCaptain(st.captain);
                                           setViceCaptain(st.viceCaptain);
                                           setPreviewTeamInfo(null);
                                           setPreviewSource('MY_MATCHES');
                                           setView('TEAM_PREVIEW');
                                       }
                                   }} 
                                   className={`font-bold text-xs active:opacity-70 w-full py-2 rounded-full text-center border ${currentMatchStatus !== 'Upcoming' ? 'bg-app-accent text-app-text border-blue-600' : 'text-blue-600 bg-blue-50 border-blue-200 shadow-sm'}`}
                               >
                                   {currentMatchStatus !== 'Upcoming' ? `Dashboard / Leaderboard (${st.teamId})` : `View Team (${st.teamId})`}
                               </button>
                            </div>
                         </div>
                     )
                 })
             )}
          </div>
          {renderBottomNav()}
       </div>
    );
  };

  const renderWallet = () => (
     <div className="flex flex-col h-full bg-app-bg relative">
      <header className="p-4 flex items-center justify-between pb-4 bg-app-bg">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-app-accent"></div>
          <h1 className="text-xl font-bold text-app-text">Fantasy11</h1>
        </div>
        <div className="flex flex-col items-center mx-auto text-center pr-8">
          <h2 className="text-lg font-bold text-app-text text-center">Wallet</h2>
          <span className="text-[10px] text-app-text-muted font-bold">Manage your money</span>
        </div>
        <button className="text-app-text-muted" onClick={() => setView('HOME')}><ArrowLeft/></button>
      </header>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto pb-20">
            <div className="bg-app-card rounded-xl shadow-sm p-5 border border-app-border">
               <p className="text-sm font-semibold text-app-text-muted">Total Balance</p>
               <h1 className="text-[36px] font-bold text-app-text mt-1 leading-none tracking-tight">₹{balance.toLocaleString('en-IN', {maximumFractionDigits:0})}</h1>
               
               <div className="flex justify-between gap-2 mt-4 mb-5 border-b border-app-border-hover pb-4">
                  <div className="flex flex-col">
                     <span className="text-xs text-app-text-muted">Deposits</span>
                     <span className="font-bold text-app-text text-sm">₹{wallet.deposit.toLocaleString('en-IN', {maximumFractionDigits:0})}</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-xs text-app-text-muted">Winnings</span>
                     <span className="font-bold text-[#4ADE80] text-sm">₹{wallet.winning.toLocaleString('en-IN', {maximumFractionDigits:0})}</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-xs text-app-text-muted">Bonus</span>
                     <span className="font-bold text-[#FFD700] text-sm">₹{wallet.bonus.toLocaleString('en-IN', {maximumFractionDigits:0})}</span>
                  </div>
               </div>

               <div className="flex gap-3">
                 <button 
                   onClick={() => setShowPaymentModal(true)}
                   className="flex-[1.2] bg-app-accent hover:bg-app-accent text-app-text font-bold py-3 text-sm rounded-lg active:scale-[0.98] flex justify-center items-center gap-2"
                 >
                   <PlusCircle size={18}/> Add Cash
                 </button>
                 <button 
                   onClick={() => setView('WITHDRAW')}
                   className="flex-[0.8] bg-transparent hover:bg-app-card-hover text-app-text border border-slate-600 font-bold py-3 text-sm rounded-lg active:scale-[0.98] flex justify-center items-center gap-2"
                 >
                   <ArrowDownToLine size={18}/> Withdraw
                 </button>
               </div>
            </div>
            
           <h3 className="font-bold text-app-text mt-6 mb-2 px-1">Recent Transactions</h3>
           <div className="space-y-3">
               {(() => {
                  const ud = depositRequests.filter(r => r.userId === user?.id).map(r => ({ ...r, t: 'd', num: parseInt(r.id.split('_')[1] || '0') }));
                  const uw = withdrawRequests.filter(r => r.userId === user?.id).map(r => ({ ...r, t: 'w', num: parseInt(r.id.split('_')[1] || '0') }));
                  const allTx = [...ud, ...uw].sort((a, b) => b.num - a.num);
                  if (allTx.length === 0) {
                     return <p className="text-sm font-bold text-app-text-muted p-4 border border-app-border bg-app-card rounded-xl flex items-center justify-center gap-2">No recent transactions.</p>;
                  }
                  return allTx.map(req => (
                     <div key={req.id} className="bg-app-card rounded-xl p-4 border border-app-border flex justify-between items-center">
                        <div className="flex items-center gap-4">
                           <div className={`p-2 rounded-full ${req.status === 'Approved' ? (req.t === 'd' ? 'bg-[#153B25] text-[#4ADE80]' : 'bg-red-900/30 text-app-accent') : req.status === 'Rejected' ? 'bg-red-900/30 text-app-accent' : 'bg-orange-900/30 text-orange-500'}`}>
                              {req.status === 'Approved' ? (req.t === 'd' ? <ArrowDownLeft size={20} /> : <Minus size={20} />) : req.status === 'Rejected' ? <Minus size={20} /> : <Clock size={20} />}
                           </div>
                           <div className="flex flex-col">
                              <p className="font-bold text-sm text-app-text">{req.t === 'd' ? 'Added to wallet' : 'Withdrawn'}</p>
                              <p className="text-xs text-app-text-muted mt-0.5">{req.timestamp}</p>
                           </div>
                        </div>
                        <span className={`font-bold text-lg ${req.status === 'Approved' ? (req.t === 'd' ? 'text-[#4ADE80]' : 'text-app-text') : req.status === 'Rejected' ? 'text-app-accent line-through opacity-50' : 'text-orange-500'}`}>
                           {req.t === 'd' ? '+' : '-'}₹{req.amount}
                        </span>
                     </div>
                  ));
               })()}
           </div>
        </div>

        {/* Payment Modal Overlay */}
        {showPaymentModal && (
          <div className="absolute inset-0 z-50 bg-app-card-alt/40 flex items-end justify-center">
             <div className="bg-app-card w-full rounded-t-3xl p-6 shadow-2xl pb-safe pt-8 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6 border-b border-app-border pb-4">
                  <h2 className="text-xl font-bold text-app-text">Add Cash</h2>
                  <button onClick={() => { setShowPaymentModal(false); setPaymentMethod(''); }} className="text-app-text-muted p-2"><Minus size={20} /></button>
                </div>
                
                {!paymentMethod ? (
                  <>
                    <label className="text-sm font-bold text-app-text-muted mb-2 block">Amount to Add (₹)</label>
                    <input 
                       type="number" 
                       value={paymentAmount} 
                       onChange={(e) => setPaymentAmount(e.target.value)} 
                       className="w-full text-3xl font-black text-app-text border-2 border-app-border rounded-xl p-4 mb-6 outline-none focus:border-app-accent text-center" 
                    />

                    <div className="grid grid-cols-2 gap-3 mb-6">
                       {[100, 500, 1000, 2000].map(amt => (
                          <button key={amt} onClick={() => setPaymentAmount(amt.toString())} className="bg-app-bg text-app-text font-bold py-2 rounded-lg border border-app-border active:bg-app-card-hover">
                             +₹{amt}
                          </button>
                       ))}
                    </div>

                    <p className="text-xs font-bold text-app-text-muted uppercase mb-3">Select Payment Method</p>
                    <div className="space-y-3">
                       <button 
                         onClick={() => setPaymentMethod('Google Pay')}
                         className="w-full bg-app-card-inner border border-app-border hover:border-blue-500 text-app-text font-bold py-3.5 rounded-xl shadow-sm text-center flex items-center justify-center gap-2 active:bg-app-bg"
                       >
                         Google Pay
                       </button>
                       <button 
                         onClick={() => setPaymentMethod('PhonePe')}
                         className="w-full bg-app-card-inner border border-app-border hover:border-purple-500 text-app-text font-bold py-3.5 rounded-xl shadow-sm text-center flex items-center justify-center gap-2 active:bg-app-bg"
                       >
                         PhonePe
                       </button>
                       <button 
                         onClick={() => setPaymentMethod('Paytm')}
                         className="w-full bg-app-card-inner border border-app-border hover:border-blue-400 text-app-text font-bold py-3.5 rounded-xl shadow-sm text-center flex items-center justify-center gap-2 active:bg-app-bg"
                       >
                         Paytm
                       </button>
                    </div>
                  </>
                ) : (
                  <div className="animate-in fade-in slide-in-from-right-4">
                     <p className="text-sm text-app-text-muted mb-2">You selected <strong>{paymentMethod}</strong> to pay ₹{paymentAmount}</p>
                     
                     <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                         <p className="font-bold text-blue-800 text-xs uppercase mb-1">Step 1: Pay to this UPI ID</p>
                         <div className="flex items-center justify-between">
                             <p className="text-lg font-mono font-black text-app-text tracking-wide">admin@ybl</p>
                             <button className="text-blue-600 text-xs font-bold bg-app-card px-2 py-1 rounded shadow-sm">Copy</button>
                         </div>
                     </div>

                     <div className="mb-4">
                         <p className="font-bold text-app-text text-xs uppercase mb-2">Step 2: Enter 12-Digit UTR Number</p>
                         <input 
                            type="text" 
                            placeholder="e.g. 301234567890"
                            value={paymentUtr}
                            onChange={(e) => setPaymentUtr(e.target.value)}
                            maxLength={12}
                            className="w-full border-2 border-app-border rounded-lg p-3 outline-none focus:border-app-accent font-mono tracking-wider" 
                         />
                     </div>

                     <div className="mb-6">
                         <p className="font-bold text-app-text text-xs uppercase mb-2">Step 3: Upload Screenshot</p>
                         <input 
                            type="file" 
                            accept="image/*"
                            className="w-full text-sm text-app-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                         />
                         <p className="text-[10px] text-app-text-muted mt-1">Upload the successful payment screenshot</p>
                     </div>

                     <div className="flex gap-2">
                        <button 
                           onClick={() => setPaymentMethod('')}
                           className="flex-1 border-2 border-app-border text-app-text-muted font-bold py-3 rounded-xl active:bg-app-card-inner"
                        >
                           Back
                        </button>
                        <button 
                           onClick={() => {
                              if (paymentUtr.length < 8) return alert('Please enter a valid UTR number.');
                              const amt = parseFloat(paymentAmount);
                              
                              const newReq: DepositRequest = {
                                 id: 'dep_' + Date.now(),
                                 userId: user?.id,
                                 userName: user?.name,
                                 amount: amt,
                                 method: paymentMethod,
                                 utr: paymentUtr,
                                 status: 'Pending',
                                 timestamp: new Date().toLocaleTimeString()
                              };

                              setDoc(doc(db, 'deposits', newReq.id), newReq).then(() => {
                                 alert("Deposit Request Submitted successfully! Admin will verify and add cash to your wallet.");
                                 setShowPaymentModal(false);
                                 setPaymentMethod('');
                                 setPaymentUtr('');
                              });
                           }}
                           className="flex-[2] bg-green-600 hover:bg-green-700 text-app-text font-bold py-3 rounded-xl active:bg-green-800 shadow-sm"
                        >
                           Submit Proof
                        </button>
                     </div>
                  </div>
                )}
             </div>
          </div>
        )}
     </div>
  );

  const renderPlaceholder = (title: string, icon: any, desc: string) => (
     <div className="flex flex-col h-full bg-app-bg">
        {renderTopBar(title)}
        <div className="flex-1 flex flex-col justify-center items-center p-8 text-center text-app-text-muted">
           {icon}
           <h3 className="font-bold text-app-text text-xl mt-4">{title}</h3>
           <p className="text-sm mt-2">{desc}</p>
        </div>
        {['REWARD', 'CHAT'].includes(view) && renderBottomNav()}
     </div>
  );

  const renderProfile = () => {
    const userTeams = savedTeams.filter(t => t.userId === (user?.id || 'guest'));
    const contestsJoined = userTeams.length;
    
    // Level calculation: 10 matches = 1 level
    const userLevel = Math.floor(contestsJoined / 10);
    
    // Calculate unclaimed rewards (every 10 levels)
    const unclaimedRewards = [];
    for (let l = 10; l <= userLevel; l += 10) {
        if (!claimedLevels.includes(l)) {
            unclaimedRewards.push(l);
        }
    }

    const claimReward = (levelIndex: number) => {
        const rewardIdx = (levelIndex / 10) - 1;
        const rewardAmount = 50 * Math.pow(2, rewardIdx);
        updateWallet(prev => ({ ...prev, bonus: prev.bonus + rewardAmount }));
        setClaimedLevels(prev => [...prev, levelIndex]);
        alert(`🎉 Congratulations! You received ₹${rewardAmount} for reaching Level ${levelIndex}!`);
    };

    const totalWins = userStats.wins || 0;
    const winningRate = contestsJoined > 0 ? Math.round((totalWins / contestsJoined) * 100) : 0;
    const totalProfit = userStats.profits || 0;

    const userKycObj = kycRequests.find(k => k.userId === (user?.id || 'guest'));
    const kycStatus = userKycObj ? userKycObj.status : 'Pending';

    return (
     <div className="flex flex-col h-full bg-app-bg">
        <header className="p-4 flex items-center justify-between pb-2 bg-app-bg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-app-accent"></div>
            <h1 className="text-xl font-bold text-app-text">Fantasy11</h1>
          </div>
          <h2 className="text-lg font-bold text-app-text mx-auto pr-8">Profile</h2>
          <button onClick={() => setView('HOME')} className="text-app-text-muted"><ArrowLeft/></button>
        </header>

        <div className="p-4 flex-1 overflow-y-auto pb-20">
           <div className="bg-app-accent rounded-xl shadow-sm p-5 flex flex-col mb-4 text-white">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl font-bold text-app-text shadow-inner">
                   {user?.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col text-app-text">
                   <h2 className="text-xl font-bold uppercase">{user?.name}</h2>
                   <p className="text-sm opacity-90 mb-2">@{user?.email?.split('@')[0] || 'user_123'}</p>
                   <div className="flex flex-col gap-1 w-full">
                     <div className="flex gap-2 items-center">
                       <span className="bg-yellow-500 text-black text-[10px] px-2 py-0.5 rounded flex items-center font-bold w-fit">⚡ Level {userLevel}</span>
                       <span className="text-xs font-bold text-white/90">{contestsJoined % 10} / 10 to Lvl {userLevel + 1}</span>
                     </div>
                     <div className="w-full bg-black/30 h-1.5 rounded-full overflow-hidden mt-1">
                        <div className="bg-yellow-500 h-full rounded-full" style={{ width: `${(contestsJoined % 10) * 10}%` }}></div>
                     </div>
                   </div>
                </div>
              </div>
           </div>
           
           {unclaimedRewards.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4 flex flex-col gap-3">
                 <h3 className="font-bold text-yellow-500 flex items-center gap-2 text-sm">🎁 Milestone Rewards!</h3>
                 {unclaimedRewards.map(level => {
                     const rewardAmount = 50 * Math.pow(2, (level / 10) - 1);
                     return (
                       <div key={level} className="flex justify-between items-center bg-app-card-inner border border-app-border p-2 px-3 rounded-lg">
                          <span className="text-sm font-bold text-app-text">Level {level} Bonus</span>
                          <button onClick={() => claimReward(level)} className="bg-yellow-500 text-black px-3 py-1.5 rounded font-bold text-xs active:scale-95 transition-transform uppercase shadow-sm">Claim ₹{rewardAmount}</button>
                       </div>
                     )
                 })}
              </div>
           )}

           <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-app-card rounded-xl flex-1 p-3 flex flex-col items-center justify-center border border-app-border shadow-sm">
                <span className="text-2xl font-bold text-app-text">{contestsJoined}</span>
                <span className="text-[10px] text-app-text-muted mt-1 text-center font-medium uppercase tracking-wider">Matches<br/>Played</span>
              </div>
              <div className="bg-app-card rounded-xl flex-1 p-3 flex flex-col items-center justify-center border border-app-border shadow-sm">
                <span className="text-2xl font-bold text-app-text">{winningRate}%</span>
                <span className="text-[10px] text-app-text-muted mt-1 text-center font-medium uppercase tracking-wider">Winning<br/>Rate</span>
              </div>
              <div className="bg-app-card rounded-xl flex-1 p-3 flex flex-col items-center justify-center border border-app-border shadow-sm col-span-2">
                <span className="text-3xl font-black text-[#4ADE80]">₹{totalProfit.toLocaleString('en-IN')}</span>
                <span className="text-xs text-app-text-muted mt-1 text-center font-bold uppercase tracking-wider">Total Profit Earned</span>
              </div>
           </div>

           <div className="bg-app-card rounded-xl shadow-sm border border-app-border overflow-hidden flex flex-col">
              <button onClick={() => setView('KYC')} className="p-4 text-left border-b border-app-border flex items-center gap-4 active:bg-app-card-hover transition-colors">
                 <Shield className="text-app-text-muted" size={22}/>
                 <div className="flex-1">
                   <div className="text-app-text font-bold text-sm">Complete KYC</div>
                   <div className="text-xs text-app-text-muted font-medium">Verify your identity to withdraw</div>
                 </div>
                 <div className="flex items-center gap-2">
                   {kycStatus === 'Approved' ? <span className="bg-[#153B25] text-[#4ADE80] text-[10px] px-2 py-1 rounded font-bold">VERIFIED</span> :
                    kycStatus === 'Pending Review' ? <span className="bg-orange-900/30 text-orange-500 text-[10px] px-2 py-1 rounded font-bold">PENDING</span> : null}
                    <div className="text-app-text-muted text-lg">&gt;</div>
                 </div>
              </button>
              <button className="p-4 text-left border-b border-app-border flex items-center gap-4 active:bg-app-card-hover transition-colors">
                 <PlayCircle className="text-app-text-muted" size={22}/>
                 <div className="flex-1">
                   <div className="text-app-text font-bold text-sm">Refer & Earn</div>
                   <div className="text-xs text-app-text-muted font-medium">Get ₹100 for every friend</div>
                 </div>
                 <div className="text-app-text-muted text-lg">&gt;</div>
              </button>
              <button className="p-4 text-left flex items-center gap-4 active:bg-app-card-hover transition-colors">
                 <Info className="text-app-text-muted" size={22}/>
                 <div className="flex-1">
                   <div className="text-app-text font-bold text-sm">How To Play</div>
                   <div className="text-xs text-app-text-muted font-medium">Learn the rules and scoring</div>
                 </div>
                 <div className="text-app-text-muted text-lg">&gt;</div>
              </button>
           </div>

           <div className="bg-app-card-inner rounded-xl shadow-sm border border-app-border overflow-hidden flex flex-col mb-6 mt-6">
              <div className="p-4 flex flex-col gap-3">
                 <div className="flex items-center gap-4">
                   <Settings className="text-app-text-muted" size={22}/>
                   <div className="text-app-text font-bold text-sm">Theme Settings</div>
                 </div>
                 <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-bold text-app-text-muted uppercase w-16">Mode</span>
                    <button onClick={() => setThemeMode('Dark')} className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${themeMode === 'Dark' ? 'bg-app-accent/20 text-app-accent border-app-accent/30' : 'bg-app-card text-app-text-muted border-app-border'}`}>Dark</button>
                    <button onClick={() => setThemeMode('Light')} className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${themeMode === 'Light' ? 'bg-app-accent/20 text-app-accent border-app-accent/30' : 'bg-app-card text-app-text-muted border-app-border'}`}>White</button>
                 </div>
                 <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-app-text-muted uppercase w-16">Color</span>
                    <button onClick={() => setThemeColor('Red')} className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${themeColor === 'Red' ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-app-card text-app-text-muted border-app-border'}`}><div className="w-2 h-2 rounded-full bg-red-500"></div> Red</button>
                    <button onClick={() => setThemeColor('Blue')} className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${themeColor === 'Blue' ? 'bg-blue-500/20 text-blue-500 border-blue-500/30' : 'bg-app-card text-app-text-muted border-app-border'}`}><div className="w-2 h-2 rounded-full bg-blue-500"></div> Blue</button>
                    <button onClick={() => setThemeColor('Green')} className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${themeColor === 'Green' ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-app-card text-app-text-muted border-app-border'}`}><div className="w-2 h-2 rounded-full bg-green-500"></div> Green</button>
                 </div>
              </div>
           </div>

           <button 
             onClick={async () => {
                try {
                  await firebaseSignOut(auth);
                  setUser(null);
                  setView('HOME');
                } catch (error) {
                  console.error("Sign out error", error);
                }
             }}
             className="w-full mt-6 bg-app-bg border border-red-900 text-app-accent font-bold py-3 rounded-xl shadow-sm active:bg-red-950 transition-colors flex justify-center items-center gap-2"
           >
             Log Out
           </button>
        </div>
     </div>
    );
  };

  const renderKyc = () => {
    const userKycObj = kycRequests.find(k => k.userId === (user?.id || 'guest'));
    const isSubmitted = !!userKycObj;

    const handleKycSubmit = () => {
      if (!aadharInput || !panInput) {
        alert("Please provide both Aadhar and PAN details.");
        return;
      }
      
      const newReq = {
        id: `KYC${Date.now()}`,
        userId: user?.id || 'guest',
        userName: user?.name || user?.email?.split('@')[0] || 'Guest Player',
        aadhar: aadharInput,
        pan: panInput,
        status: 'Pending Review',
        timestamp: new Date().toLocaleString()
      };

      setDoc(doc(db, 'kyc', newReq.id), newReq).then(() => {
         alert("KYC Details Submitted successfully! Admin will verify your documents.");
      });
    };

    return (
     <div className="flex flex-col h-full bg-app-bg">
        <header className="p-4 flex items-center justify-between pb-2 bg-app-bg">
          <h2 className="text-lg font-bold text-app-text mx-auto pr-8">KYC Verification</h2>
          <button onClick={() => setView('PROFILE')} className="text-app-text-muted absolute left-4"><ArrowLeft/></button>
        </header>

        <div className="p-4 flex-1 overflow-y-auto pb-20">
          {isSubmitted ? (
             <div className="bg-app-card p-6 rounded-xl border border-app-border flex flex-col items-center text-center mt-8">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${userKycObj.status === 'Approved' ? 'bg-[#153B25] text-[#4ADE80]' : userKycObj.status === 'Rejected' ? 'bg-red-900/30 text-app-accent' : 'bg-orange-900/30 text-orange-500'}`}>
                  {userKycObj.status === 'Approved' ? <Check size={40}/> : userKycObj.status === 'Rejected' ? <X size={40}/> : <Clock size={40}/>}
                </div>
                <h3 className="text-xl font-bold text-app-text mb-2">
                  KYC Status: {userKycObj.status}
                </h3>
                <p className="text-sm text-app-text-muted">
                  {userKycObj.status === 'Approved' ? "Your KYC is approved! You can now withdraw funds." : 
                   userKycObj.status === 'Rejected' ? "Your KYC was rejected. Please contact support or try again later." : 
                   "Your documents have been submitted and are under review by our admin team."}
                </p>
                {userKycObj.status === 'Rejected' && (
                  <button onClick={async () => {
                    await setDoc(doc(db, 'kyc', userKycObj.id), { ...userKycObj, status: 'Archived' }); // Or delete: await deleteDoc(doc(db, 'kyc', userKycObj.id))
                  }} className="mt-6 border border-app-border-hover bg-app-card-hover text-app-text px-6 py-2 rounded-lg text-sm font-bold">
                    Resubmit KYC
                  </button>
                )}
             </div>
          ) : (
            <div className="bg-app-card rounded-xl border border-app-border p-5 mt-4">
              <div className="flex items-center gap-3 border-b border-app-border pb-4 mb-4">
                 <Shield className="text-[#4ADE80]" size={28}/>
                 <div className="flex flex-col">
                   <h3 className="text-app-text font-bold">Identity Verification</h3>
                   <p className="text-xs text-app-text-muted">Required to withdraw your winnings</p>
                 </div>
              </div>
              
              <div className="space-y-4">
                 <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Aadhar Number</label>
                    <input 
                      type="text" 
                      value={aadharInput}
                      onChange={(e) => setAadharInput(e.target.value)}
                      placeholder="Enter 12-digit Aadhar Number"
                      className="w-full bg-app-bg border border-app-border text-app-text rounded-lg px-4 py-3 outline-none focus:border-app-accent text-sm font-medium"
                    />
                 </div>
                 
                 <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider">PAN Card Number</label>
                    <input 
                      type="text" 
                      value={panInput}
                      onChange={(e) => setPanInput(e.target.value)}
                      placeholder="Enter 10-character PAN"
                      className="w-full bg-app-bg border border-app-border text-app-text rounded-lg px-4 py-3 outline-none focus:border-app-accent text-sm font-medium uppercase"
                    />
                 </div>
                 
                 <button 
                   onClick={handleKycSubmit}
                   className="w-full bg-app-accent hover:bg-app-accent text-app-text font-bold py-3.5 rounded-lg active:scale-[0.98] mt-4 shadow-sm"
                 >
                   Submit Documents
                 </button>
              </div>
            </div>
          )}
        </div>
     </div>
    );
  };

  const renderLogin = () => {
    const hasSignedUp = localStorage.getItem('dreamApp_hasSignedUp') === 'true';

    // Force login mode if already signed up
    if (hasSignedUp && authMode === 'SIGNUP') {
       setAuthMode('LOGIN');
    }

    const handleAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!authInput || !authPassword) return alert("Please enter mobile/email and password");
      
      const parsedEmail = /^\d{10}$/.test(authInput.trim()) 
        ? `${authInput.trim()}@dreamapp.com` 
        : authInput.trim();

      setAuthLoading(true);
      try {
        if (authMode === 'SIGNUP') {
          sessionStorage.setItem('isSigningUp', 'true');
          await createUserWithEmailAndPassword(auth, parsedEmail, authPassword);
          alert("Signup successful! Please login below to continue.");
          setAuthMode('LOGIN');
          setAuthPassword('');
        } else {
          await signInWithEmailAndPassword(auth, parsedEmail, authPassword);
        }
      } catch (err: any) {
        console.error("Auth error", err);
        let msg = err.message;
        if (err.code === 'auth/email-already-in-use') msg = "Account already exists! Please login instead.";
        else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') msg = "Incorrect mobile/email or password.";
        else if (err.code === 'auth/invalid-email') msg = "Invalid format for mobile number or email.";
        alert(msg);
      } finally {
        setAuthLoading(false);
        sessionStorage.removeItem('isSigningUp');
      }
    };

    return (
    <div className={`relative h-[100dvh] w-full max-w-md mx-auto bg-app-bg text-app-text font-sans shadow-2xl overflow-hidden border-x border-app-border flex flex-col ${themeMode === 'Light' ? 'theme-light' : ''} color-${themeColor.toLowerCase()}`}>
       <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-24 h-24 bg-app-accent rounded-3xl mb-6 flex items-center justify-center shadow-lg rotate-3">
             <Trophy size={48} className="text-app-text" />
          </div>
          <h1 className="text-4xl font-black tracking-tight italic mb-2 text-app-text">Fantasy<span className="text-app-accent">11</span></h1>
          <p className="text-app-text-muted font-semibold mb-8 text-center text-sm">Play Fantasy Sports & Win Cash Prizes!</p>
          
          <div className="w-full space-y-4">
             <form onSubmit={handleAuth} className="flex flex-col gap-3">
               <div>
                  <input 
                    type="text" 
                    placeholder="Mobile Number (10 digits) or Email" 
                    value={authInput}
                    onChange={e => setAuthInput(e.target.value)}
                    className="w-full bg-app-card border border-app-border text-app-text px-4 py-3 rounded-xl outline-none focus:border-app-accent font-medium"
                  />
               </div>
               <div>
                  <input 
                    type="password" 
                    placeholder="Password" 
                    value={authPassword}
                    onChange={e => setAuthPassword(e.target.value)}
                    className="w-full bg-app-card border border-app-border text-app-text px-4 py-3 rounded-xl outline-none focus:border-app-accent font-medium"
                  />
               </div>
               <button 
                 type="submit"
                 disabled={authLoading}
                 className="w-full bg-app-accent text-app-text font-bold py-3.5 rounded-xl shadow-md hover:bg-app-accent active:scale-[0.98] transition-all disabled:opacity-70 mt-2"
               >
                 {authLoading ? 'Processing...' : (authMode === 'LOGIN' ? 'Login' : 'Sign Up')}
               </button>
             </form>

             {!hasSignedUp && (
               <div className="text-center pb-2">
                 <button 
                   type="button"
                   onClick={() => setAuthMode(prev => prev === 'LOGIN' ? 'SIGNUP' : 'LOGIN')}
                   className="text-sm text-app-text-muted font-bold hover:text-app-text underline underline-offset-2"
                 >
                   {authMode === 'LOGIN' ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                 </button>
               </div>
             )}

             <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-app-border"></div>
                <span className="flex-shrink-0 mx-4 text-app-text-muted text-xs font-bold uppercase">Or</span>
                <div className="flex-grow border-t border-app-border"></div>
             </div>

             <button 
                onClick={async () => {
                   try {
                     await signInWithPopup(auth, googleProvider);
                   } catch (error) {
                     console.error("Login popup failed", error);
                   }
                }}
                className={`w-full flex items-center justify-center gap-4 border-2 border-app-border font-bold text-[15px] py-3.5 rounded-xl shadow-sm active:scale-[0.98] transition-all ${hasSignedUp ? 'bg-app-card hover:border-app-border-hover text-app-text' : 'bg-app-card-inner hover:bg-app-bg text-app-text'}`}
             >
                {hasSignedUp && (
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                       <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                       <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                       <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                       <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                )}
                Login with Google
             </button>
          </div>

          <p className="text-xs text-app-text-muted text-center mt-8 px-4">
             By continuing, you agree to our Terms & Conditions and Privacy Policy.
          </p>
       </div>
    </div>
  );
  }

  if (!user) return renderLogin();
  
  const renderAdminPanel = () => {
    if (!isAdmin) return null;

    return (
       <div className="flex flex-col h-full bg-app-bg">
          <header className="bg-app-bg text-app-text border-b border-app-border p-4 shadow-sm flex items-center justify-between shrink-0">
             <button onClick={() => setView('HOME')} className="p-1 -ml-1 active:bg-app-card/10 rounded-full transition-colors"><ArrowLeft size={24}/></button>
             <div className="flex items-center gap-2">
               <Shield size={20} className="text-app-accent" />
               <h2 className="font-bold">Admin Control Panel</h2>
             </div>
             <div className="w-6"/>
          </header>
          
          <div className="flex-1 p-4 overflow-y-auto">
             <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm mb-6 flex gap-2">
                <Info size={20} className="shrink-0" />
                <p>Welcome Admin <strong>{user?.name}</strong>. Here you can control users and their wallets.</p>
             </div>

             <div className="mb-6">
                <button 
                  disabled={isSyncing}
                  onClick={async () => {
                      if (isSyncing) return;
                      setIsSyncing(true);
                      setSyncMessage(null);
                      try {
                          const adminTeams = savedTeams.filter(t => t.userId === 'admin_bot' || t.userId === 'admin_bot_boot');
                          await setDoc(doc(db, 'gameData', 'main_state'), {
                              matches: appMatches,
                              contests: appContests,
                              players: appPlayers,
                              adminTeams: adminTeams,
                              timestamp: Date.now()
                          });
                          setSyncMessage({type: 'success', text: '✅ Successfully synced Matches, Contests, Players, and Bots to the cloud. All phones will now update.'});
                      } catch (e: any) {
                          setSyncMessage({type: 'error', text: 'Failed to sync to cloud: ' + e.message});
                      } finally {
                          setIsSyncing(false);
                      }
                  }}
                  className={`w-full ${isSyncing ? 'bg-blue-800 cursor-not-allowed opacity-70' : 'bg-blue-600 active:scale-95'} text-white font-bold py-3 rounded-xl shadow-lg border border-blue-700 transition-transform flex items-center justify-center gap-2`}
                >
                  <ArrowDownToLine size={20} className={isSyncing ? 'animate-bounce' : ''} /> {isSyncing ? 'Syncing to Cloud...' : 'Force Sync App To All Phones'}
                </button>
                {syncMessage && (
                  <div className={`mt-3 p-3 text-sm rounded-lg ${syncMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                     {syncMessage.text}
                  </div>
                )}
             </div>

             <h3 className="font-bold text-app-text mb-3">System Control: Platform Settings</h3>
             <div className="bg-app-card rounded-xl shadow-sm border border-app-border p-4 mb-6">
                 <div className="flex justify-between items-center mb-2">
                    <p className="font-bold text-app-text">Winning Distribution Rate</p>
                    <p className="text-xl font-bold text-green-500">{winningPercentage}%</p>
                 </div>
                 <p className="text-xs text-app-text-muted mb-4">Set the percentage of the dynamic prize pool that goes to the winners. The rest ({100 - winningPercentage}%) is kept as platform fee.</p>
                 
                 <div className="flex gap-2 items-center">
                    <input 
                      type="range" 
                      min="10" 
                      max="100" 
                      step="5"
                      value={winningPercentage} 
                      onChange={(e) => setWinningPercentage(parseInt(e.target.value))} 
                      className="flex-1 accent-red-600"
                    />
                 </div>
                 <div className="flex justify-between text-[10px] text-app-text-muted mt-1 font-bold">
                    <span>10%</span>
                    <span>50%</span>
                    <span>100%</span>
                 </div>
             </div>

             <h3 className="font-bold text-app-text mb-3">System Control: Self (Current Logged-In User)</h3>
             <div className="bg-app-card rounded-xl shadow-sm border border-app-border p-4 mb-6 relative overflow-hidden">
                 <div className="absolute top-0 right-0 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-1 rounded-bl-lg">YOU</div>
                 <div className="flex justify-between items-center mb-3">
                    <div>
                       <p className="font-bold text-app-text">{user?.name}</p>
                       <p className="text-xs text-app-text-muted">{user?.email}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-xs text-app-text-muted font-semibold mb-0.5">Wallet Balance</p>
                       <p className="font-black text-lg text-green-600">₹{balance.toFixed(2)}</p>
                    </div>
                 </div>
                 <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                       <input 
                          type="number" 
                          placeholder="Enter money to add/deduct (₹)" 
                          value={adminCustomAmount}
                          onChange={(e) => setAdminCustomAmount(e.target.value)}
                          className="flex-1 border border-app-border-hover rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:border-app-accent focus:ring-1 focus:ring-red-500"
                       />
                    </div>
                    <div className="flex gap-2">
                       <button 
                          onClick={() => {
                             const amt = parseFloat(adminCustomAmount);
                             if (!isNaN(amt) && amt > 0) {
                                setBalance(b => b + amt);
                                setAdminCustomAmount('');
                             }
                          }} 
                          className="flex-1 bg-green-50 text-green-700 border border-green-200 py-2 rounded-lg text-sm font-bold active:bg-green-100"
                       >
                          + Add Money
                       </button>
                       <button 
                          onClick={() => {
                             const amt = parseFloat(adminCustomAmount);
                             if (!isNaN(amt) && amt > 0) {
                                setBalance(b => Math.max(0, b - amt));
                                setAdminCustomAmount('');
                             }
                          }} 
                          className="flex-1 bg-red-50 text-red-700 border border-red-200 py-2 rounded-lg text-sm font-bold active:bg-red-100"
                       >
                          - Deduct Money
                       </button>
                    </div>
                    <button onClick={() => setBalance(0)} className="w-full bg-app-bg text-app-text border border-app-border-hover py-2 rounded-lg text-sm font-bold active:bg-app-card-hover">Clear Wallet to 0</button>
                 </div>
             </div>
             <button 
                onClick={() => setShowManageContests(!showManageContests)}
                className={`flex items-center justify-between w-full mt-6 bg-app-card border p-4 shadow-sm transition-colors active:scale-[0.99] ${showManageContests ? 'border-app-border-hover rounded-t-xl border-b-0 mb-0' : 'border-app-border rounded-xl mb-3'}`}
             >
                <h3 className="font-bold text-app-text text-base">Manage Contests</h3>
                <div className={`p-1 rounded-full transition-colors ${showManageContests ? 'text-app-text-muted bg-app-card-hover' : 'text-app-text-muted bg-app-bg'}`}>
                   {showManageContests ? <ChevronUp size={18} /> : <ChevronDown size={18} />} 
                </div>
             </button>
             
             {showManageContests && (
               <div className="bg-app-card/50 rounded-b-xl shadow-sm border border-app-border-hover border-t-0 p-4 mb-6">
                  <p className="text-xs text-app-text-muted mb-4">Create new public Mega Contests or Head to Head matches with custom fees and rewards.</p>
                  <div className="space-y-3">
                     <div>
                       <label className="text-[10px] font-bold text-app-text-muted uppercase">Contest Type</label>
                       <div className="flex gap-2 mt-1">
                          <button onClick={() => setAdminContestType('Mega')} className={`flex-1 py-1.5 rounded text-sm font-bold border transition-colors ${adminContestType === 'Mega' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-app-card-inner text-app-text-muted border-app-border'}`}>Mega Contest</button>
                          <button onClick={() => setAdminContestType('H2H')} className={`flex-1 py-1.5 rounded text-sm font-bold border transition-colors ${adminContestType === 'H2H' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-app-card-inner text-app-text-muted border-app-border'}`}>Head to Head (2 Spots)</button>
                       </div>
                     </div>
                     <div>
                       <label className="text-[10px] font-bold text-app-text-muted uppercase">Contest Target Name</label>
                       <input type="text" placeholder="e.g., Grand League 1" value={adminContestName} onChange={(e) => setAdminContestName(e.target.value)} className="w-full mt-1 border border-app-border-hover rounded px-3 py-1.5 text-sm font-semibold outline-none focus:border-app-accent" />
                     </div>
                     <div>
                       <label className="text-[10px] font-bold text-app-text-muted uppercase">Total Prize Pool (Text)</label>
                       <input type="text" placeholder="e.g., ₹20 Crores or ₹5000" value={adminContestPrize} onChange={(e) => setAdminContestPrize(e.target.value)} className="w-full mt-1 border border-app-border-hover rounded px-3 py-1.5 text-sm font-semibold outline-none focus:border-app-accent" />
                     </div>
                     <div>
                       <label className="text-[10px] font-bold text-app-text-muted uppercase">Entry Fee (Number)</label>
                       <input type="number" placeholder="e.g., 49" value={adminContestEntry} onChange={(e) => setAdminContestEntry(e.target.value)} className="w-full mt-1 border border-app-border-hover rounded px-3 py-1.5 text-sm font-semibold outline-none focus:border-app-accent" />
                     </div>
                     {adminContestType === 'Mega' && (
                        <div>
                          <label className="text-[10px] font-bold text-app-text-muted uppercase">Total Spots</label>
                          <input type="number" placeholder="e.g., 5000000" value={adminContestSpots} onChange={(e) => setAdminContestSpots(e.target.value)} className="w-full mt-1 border border-app-border-hover rounded px-3 py-1.5 text-sm font-semibold outline-none focus:border-app-accent" />
                        </div>
                     )}
                     <button 
                        onClick={() => {
                          const fee = parseFloat(adminContestEntry);
                          if (!adminContestName || !adminContestPrize || isNaN(fee)) return alert("Fill all fields correctly");
                          const spots = adminContestType === 'Mega' ? (parseInt(adminContestSpots) || 5000000) : 2;
                          
                          let payouts = undefined;
                          let parsedPrize = 0;
                          const lowerPrize = adminContestPrize.toLowerCase();
                          const numPart = parseFloat(lowerPrize.replace(/[^0-9.]/g, ''));
                          if (!isNaN(numPart)) {
                              if (lowerPrize.includes('cr')) parsedPrize = numPart * 10000000;
                              else if (lowerPrize.includes('lakh') || lowerPrize.includes('l')) parsedPrize = numPart * 100000;
                              else if (lowerPrize.includes('k')) parsedPrize = numPart * 1000;
                              else parsedPrize = numPart;
                          }

                          const actualPool = parsedPrize > 0 ? parsedPrize : (fee * spots * 0.5);

                          if (adminContestType === 'Mega') {
                             const formatAmount = (amt: number) => amt >= 100000 ? `₹${Number.isInteger(amt/100000) ? (amt/100000) : (amt/100000).toFixed(2)} Lakhs` : `₹${Math.round(amt).toLocaleString('en-IN')}`;
                             
                             payouts = [];
                             payouts.push({ rank: '# 1', amount: formatAmount(actualPool * 0.15) });
                             if (spots > 2) payouts.push({ rank: '# 2', amount: formatAmount(actualPool * 0.08) });
                             if (spots > 5) payouts.push({ rank: '# 3', amount: formatAmount(actualPool * 0.05) });
                             if (spots > 10) payouts.push({ rank: '# 4 - 5', amount: formatAmount(actualPool * 0.02) });
                             if (spots > 50) payouts.push({ rank: '# 6 - 10', amount: formatAmount(actualPool * 0.01) });
                             if (spots > 100) payouts.push({ rank: '# 11 - 50', amount: formatAmount(actualPool * 0.005) });
                             if (spots > 500) payouts.push({ rank: '# 51 - 200', amount: formatAmount(actualPool * 0.002) });
                             if (spots > 2000) payouts.push({ rank: '# 201 - 1000', amount: formatAmount(actualPool * 0.001) });
                             
                             const lastRankStart = spots > 2000 ? 1001 : (spots > 500 ? 201 : (spots > 100 ? 51 : (spots > 50 ? 11 : (spots > 10 ? 6 : 4))));
                             const lastRankEnd = Math.floor(spots * 0.48);
                             if (lastRankEnd >= lastRankStart) {
                                payouts.push({ rank: `# ${lastRankStart.toLocaleString('en-IN')} - ${lastRankEnd.toLocaleString('en-IN')}`, amount: `₹${fee}` });
                             }
                          }

                          const newContest: Contest = {
                            id: 'c_' + Math.random().toString(36).substring(7),
                            type: adminContestType,
                            name: adminContestName,
                            prizeText: adminContestType === 'Mega' && parsedPrize > 0 ? (parsedPrize >= 100000 ? `₹${(parsedPrize/100000)} Lakhs` : `₹${parsedPrize}`) : adminContestPrize,
                            entryFee: fee,
                            spots: spots,
                            firstPrize: adminContestType === 'Mega' ? payouts?.[0]?.amount || '₹8 L' : `₹${Math.floor(fee * 1.8)}`,
                            winPercentage: adminContestType === 'Mega' ? 48 : 50,
                            maxTeams: adminContestType === 'Mega' ? 20 : 1,
                            payouts: payouts
                          };
                          setAppContests([...appContests, newContest]);
                          alert(`Successfully added ${adminContestType} contest!`);
                          setAdminContestName('');
                          setAdminContestPrize('');
                          setAdminContestEntry('');
                        }} 
                        className="w-full bg-app-bg text-app-text border-b border-app-border font-bold py-2.5 rounded shadow flex items-center justify-center gap-2 active:bg-app-card-hover"
                     >
                       <PlusCircle size={16} /> Publish New Contest
                     </button>
                  </div>
                  
                  <div className="mt-4 border-t border-app-border pt-3">
                     <p className="text-[10px] font-bold text-app-text-muted uppercase mb-2">Active Listed Contests</p>
                     <div className="space-y-2">
                       {appContests.map(c => (
                          <div key={c.id} className="bg-app-card-inner border border-app-border rounded p-2 flex justify-between items-center text-xs">
                             <div>
                               <span className="font-bold text-app-text">{c.name}</span>
                               <span className="text-app-text-muted ml-2">({c.type})</span>
                             </div>
                             <div className="flex items-center gap-3">
                                <span className="font-bold text-green-600">Pool: {c.prizeText}</span>
                                <button onClick={() => setAppContests(appContests.filter(cc => cc.id !== c.id))} className="text-app-accent p-1 active:bg-red-100 rounded">Remove</button>
                             </div>
                          </div>
                       ))}
                     </div>
                  </div>
               </div>
             )}

             <button 
                onClick={() => setShowManageMatches(!showManageMatches)}
                className={`flex items-center justify-between w-full mt-6 bg-app-card border p-4 shadow-sm transition-colors active:scale-[0.99] ${showManageMatches ? 'border-app-border-hover rounded-t-xl border-b-0 mb-0' : 'border-app-border rounded-xl mb-3'}`}
             >
                <h3 className="font-bold text-app-text text-base">App Settings: Manage Matches</h3>
                <div className={`p-1 rounded-full transition-colors ${showManageMatches ? 'text-app-text-muted bg-app-card-hover' : 'text-app-text-muted bg-app-bg'}`}>
                   {showManageMatches ? <ChevronUp size={18} /> : <ChevronDown size={18} />} 
                </div>
             </button>
             
             {showManageMatches && (
               <div className="bg-app-card/50 rounded-b-xl shadow-sm border border-app-border-hover border-t-0 p-4 mb-6">
                  <p className="text-xs text-app-text-muted mb-4">Create new upcoming matches or change the status of existing matches (Live, Completed).</p>
                  
                  <p className="text-[10px] font-bold text-app-text-muted uppercase mb-2">Create New Match</p>
                  <div className="space-y-3 mb-6 bg-app-card-inner p-3 rounded border border-app-border">
                     <div className="flex gap-2">
                       <div className="flex-1">
                          <label className="text-[10px] font-bold text-app-text-muted uppercase">Team 1 (Short)</label>
                          <input type="text" placeholder="e.g., IND" value={adminMatchT1} onChange={(e) => setAdminMatchT1(e.target.value)} className="w-full mt-1 border border-app-border-hover rounded px-2 py-1.5 text-sm outline-none" />
                       </div>
                       <div className="flex-1">
                          <label className="text-[10px] font-bold text-app-text-muted uppercase">Team 2 (Short)</label>
                          <input type="text" placeholder="e.g., AUS" value={adminMatchT2} onChange={(e) => setAdminMatchT2(e.target.value)} className="w-full mt-1 border border-app-border-hover rounded px-2 py-1.5 text-sm outline-none" />
                       </div>
                     </div>
                     <div className="flex gap-2">
                       <div className="flex-[2]">
                          <label className="text-[10px] font-bold text-app-text-muted uppercase">Match Date</label>
                          <select 
                            value={adminMatchDate} 
                            onChange={(e) => setAdminMatchDate(e.target.value)} 
                            className="w-full mt-1 border border-app-border-hover rounded px-2 py-1.5 text-sm outline-none bg-app-card"
                          >
                            <option value={formatDateISO(today)}>Today ({formatDateISO(today)})</option>
                            <option value={formatDateISO(tomorrow)}>Tomorrow ({formatDateISO(tomorrow)})</option>
                            <option value={formatDateISO(dayAfter)}>Day After ({formatDateISO(dayAfter)})</option>
                          </select>
                       </div>
                       <div className="flex-1">
                          <label className="text-[10px] font-bold text-app-text-muted uppercase">Time</label>
                          <input 
                            type="time" 
                            value={adminMatchTimeValue} 
                            onChange={(e) => setAdminMatchTimeValue(e.target.value)} 
                            className="w-full mt-1 border border-app-border-hover rounded px-2 py-1.5 text-sm outline-none" 
                          />
                       </div>
                       <div className="flex-1">
                          <label className="text-[10px] font-bold text-app-text-muted uppercase">Prize</label>
                          <input type="text" placeholder="₹20 Cr" value={adminMatchPrize} onChange={(e) => setAdminMatchPrize(e.target.value)} className="w-full mt-1 border border-app-border-hover rounded px-2 py-1.5 text-sm outline-none" />
                       </div>
                     </div>
                     <button 
                        onClick={() => {
                          if (!adminMatchT1 || !adminMatchT2 || !adminMatchTimeValue || !adminMatchPrize) return alert("Fill all fields");
                          
                          // Format display time
                          let [hourString, minuteString] = adminMatchTimeValue.split(':');
                          let hour = parseInt(hourString);
                          let ampm = hour >= 12 ? 'PM' : 'AM';
                          if (hour > 12) hour -= 12;
                          if (hour === 0) hour = 12;
                          
                          let dayStr = '';
                          if (adminMatchDate === formatDateISO(today)) dayStr = 'Today';
                          else if (adminMatchDate === formatDateISO(tomorrow)) dayStr = 'Tomorrow';
                          else dayStr = new Date(adminMatchDate).toLocaleDateString('en-US', { weekday: 'long' });

                          const displayTime = `${dayStr} ${hour}:${minuteString} ${ampm}`;
                          const isoTime = `${adminMatchDate}T${adminMatchTimeValue}:00`;

                          const newMatch: Match & { matchDateISO: string } = {
                            id: 'm_' + Math.random().toString(36).substring(7),
                            series: 'FANTASY SERIES 2026',
                            team1: { name: adminMatchT1, shortFrame: adminMatchT1, color: 'bg-app-accent' },
                            team2: { name: adminMatchT2, shortFrame: adminMatchT2, color: 'bg-yellow-500' },
                            time: displayTime,
                            matchDateISO: isoTime,
                            totalPrize: adminMatchPrize,
                            status: 'Upcoming'
                          };
                          
                          // Generate players for this match if they don't already exist for this team
                          const existingT1 = appPlayers.some(p => p.team === adminMatchT1);
                          const existingT2 = appPlayers.some(p => p.team === adminMatchT2);
                          let extraPlayers: Player[] = [];
                          
                          const generateTeamPlayers = (teamNode: string) => {
                             const p: Player[] = [];
                             let pidStr = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
                             // WK
                             p.push({ id: `p_${pidStr}_1`, name: `WK 1 (${teamNode})`, team: teamNode, role: 'WK', credits: 8.5, points: 0, selPercent: 75 });
                             p.push({ id: `p_${pidStr}_2`, name: `WK 2 (${teamNode})`, team: teamNode, role: 'WK', credits: 8.0, points: 0, selPercent: 40 });
                             // BAT
                             p.push({ id: `p_${pidStr}_3`, name: `BAT 1 (${teamNode})`, team: teamNode, role: 'BAT', credits: 9.0, points: 0, selPercent: 85 });
                             p.push({ id: `p_${pidStr}_4`, name: `BAT 2 (${teamNode})`, team: teamNode, role: 'BAT', credits: 8.5, points: 0, selPercent: 70 });
                             p.push({ id: `p_${pidStr}_5`, name: `BAT 3 (${teamNode})`, team: teamNode, role: 'BAT', credits: 8.0, points: 0, selPercent: 55 });
                             p.push({ id: `p_${pidStr}_6`, name: `BAT 4 (${teamNode})`, team: teamNode, role: 'BAT', credits: 7.5, points: 0, selPercent: 40 });
                             // AR
                             p.push({ id: `p_${pidStr}_7`, name: `AR 1 (${teamNode})`, team: teamNode, role: 'AR', credits: 9.5, points: 0, selPercent: 90 });
                             p.push({ id: `p_${pidStr}_8`, name: `AR 2 (${teamNode})`, team: teamNode, role: 'AR', credits: 8.5, points: 0, selPercent: 65 });
                             p.push({ id: `p_${pidStr}_9`, name: `AR 3 (${teamNode})`, team: teamNode, role: 'AR', credits: 8.0, points: 0, selPercent: 50 });
                             // BOWL
                             p.push({ id: `p_${pidStr}_10`, name: `BOWL 1 (${teamNode})`, team: teamNode, role: 'BOWL', credits: 9.0, points: 0, selPercent: 80 });
                             p.push({ id: `p_${pidStr}_11`, name: `BOWL 2 (${teamNode})`, team: teamNode, role: 'BOWL', credits: 8.5, points: 0, selPercent: 60 });
                             p.push({ id: `p_${pidStr}_12`, name: `BOWL 3 (${teamNode})`, team: teamNode, role: 'BOWL', credits: 8.0, points: 0, selPercent: 45 });
                             return p;
                          };
                          
                          if (!existingT1) extraPlayers = [...extraPlayers, ...generateTeamPlayers(adminMatchT1)];
                          if (!existingT2) extraPlayers = [...extraPlayers, ...generateTeamPlayers(adminMatchT2)];
                          
                          if (extraPlayers.length > 0) {
                             setAppPlayers([...appPlayers, ...extraPlayers]);
                          }

                          setAppMatches([newMatch, ...appMatches]);
                          alert(`Successfully added match: ${adminMatchT1} vs ${adminMatchT2}`);
                          setAdminMatchT1(''); setAdminMatchT2(''); setAdminMatchPrize('');
                        }} 
                        className="w-full bg-app-bg text-app-text border-b border-app-border font-bold py-2 rounded text-sm active:bg-app-card-hover"
                     >
                       Create Match
                     </button>
                  </div>

                  <p className="text-[10px] font-bold text-app-text-muted uppercase mb-2">Live / Existing Matches Control</p>
                  <div className="space-y-3">
                    {appMatches.map(m => (
                       <AdminMatchEditCard 
                         key={m.id} 
                         match={m} 
                         onUpdate={(updatedMatch) => {
                            setAppMatches(appMatches.map(mm => mm.id === m.id ? updatedMatch : mm));
                         }}
                         onDelete={() => {
                            setAppMatches(appMatches.filter(mm => mm.id !== m.id));
                         }}
                         onStatusChange={(status) => {
                            if (status === 'Completed' && m.status !== 'Completed') {
                                distributePrizes(m.id);
                            }
                            setAppMatches(appMatches.map(mm => mm.id === m.id ? { ...mm, status } : mm));
                         }}
                         onLineupToggle={() => {
                            setAppMatches(appMatches.map(mm => mm.id === m.id ? { ...mm, lineupStatus: mm.lineupStatus === 'OUT' ? 'NOT_OUT' : 'OUT' as const } : mm));
                         }}
                       />
                    ))}
                  </div>
               </div>
             )}

             <button 
                onClick={() => setShowManageKYC(!showManageKYC)}
                className={`flex items-center justify-between w-full mt-6 bg-app-card border p-4 shadow-sm transition-colors active:scale-[0.99] ${showManageKYC ? 'border-app-border-hover rounded-t-xl border-b-0 mb-0' : 'border-app-border rounded-xl mb-3'}`}
             >
                <h3 className="font-bold text-app-text text-base">Manage KYC Requests</h3>
                <div className={`p-1 rounded-full transition-colors ${showManageKYC ? 'text-app-text-muted bg-app-card-hover' : 'text-app-text-muted bg-app-bg'}`}>
                   {showManageKYC ? <ChevronUp size={18} /> : <ChevronDown size={18} />} 
                </div>
             </button>
             
             {showManageKYC && (
               <div className="bg-app-card/50 rounded-b-xl shadow-sm border border-app-border-hover border-t-0 p-4 mb-6">
                  <p className="text-xs text-app-text-muted mb-4">View and approve user KYC requests.</p>
                  <div className="space-y-4">
                     {kycRequests.filter(r => r.status === 'Pending Review').length === 0 ? (
                        <p className="text-sm font-bold text-app-text-muted text-center py-4 bg-app-card-inner border border-app-border rounded">No pending KYC requests.</p>
                     ) : (
                        kycRequests.filter(r => r.status === 'Pending Review').map((req) => (
                           <div key={req.id} className="bg-app-card-inner border border-app-border rounded p-4">
                              <div className="flex justify-between items-start mb-2 border-b border-app-border pb-2">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-app-text-muted uppercase leading-none">User</span>
                                  <span className="font-bold text-app-text">{req.userName}</span>
                                </div>
                                <div className="flex flex-col text-right">
                                  <span className="text-[10px] font-bold text-app-text-muted uppercase leading-none">Time</span>
                                  <span className="text-xs text-app-text-muted">{req.timestamp}</span>
                                </div>
                              </div>
                              <div className="mb-4">
                                <p className="text-xs text-app-text-muted mb-1">Aadhar: <span className="font-mono font-bold text-app-text bg-app-card px-1 border border-app-border rounded">{req.aadhar}</span></p>
                                <p className="text-xs text-app-text-muted mb-1">PAN: <span className="font-mono font-bold text-app-text bg-app-card px-1 border border-app-border rounded">{req.pan}</span></p>
                              </div>
                              <div className="flex gap-2">
                                 <button 
                                   onClick={async () => {
                                      await setDoc(doc(db, 'kyc', req.id), { ...req, status: 'Approved' });
                                      alert(`KYC Approved for ${req.userName}.`);
                                   }}
                                   className="flex-1 bg-green-600 text-app-text font-bold py-2 rounded shadow-sm hover:bg-green-700 active:scale-95 text-xs text-center"
                                 >
                                   Approve KYC
                                 </button>
                                 <button 
                                   onClick={async () => {
                                      await setDoc(doc(db, 'kyc', req.id), { ...req, status: 'Rejected' });
                                      alert(`KYC Rejected for ${req.userName}.`);
                                   }}
                                   className="flex-1 bg-red-100 text-app-accent font-bold py-2 rounded shadow-sm hover:bg-red-200 active:scale-95 text-xs text-center border border-red-200"
                                 >
                                   Reject
                                 </button>
                              </div>
                           </div>
                        ))
                     )}
                  </div>
               </div>
             )}

             <button 
                onClick={() => setShowManageWithdrawals(!showManageWithdrawals)}
                className={`flex items-center justify-between w-full mt-6 bg-app-card border p-4 shadow-sm transition-colors active:scale-[0.99] ${showManageWithdrawals ? 'border-app-border-hover rounded-t-xl border-b-0 mb-0' : 'border-app-border rounded-xl mb-3'}`}
             >
                <h3 className="font-bold text-app-text text-base">Manage Withdrawal Requests</h3>
                <div className={`p-1 rounded-full transition-colors ${showManageWithdrawals ? 'text-app-text-muted bg-app-card-hover' : 'text-app-text-muted bg-app-bg'}`}>
                   {showManageWithdrawals ? <ChevronUp size={18} /> : <ChevronDown size={18} />} 
                </div>
             </button>
             
             {showManageWithdrawals && (
               <div className="bg-app-card/50 rounded-b-xl shadow-sm border border-app-border-hover border-t-0 p-4 mb-6">
                  <p className="text-xs text-app-text-muted mb-4">View and approve user withdrawal requests.</p>
                  <div className="space-y-4">
                     {withdrawRequests.filter(r => r.status === 'Pending').length === 0 ? (
                        <p className="text-sm font-bold text-app-text-muted text-center py-4 bg-app-card-inner border border-app-border rounded">No pending withdrawal requests.</p>
                     ) : (
                        withdrawRequests.filter(r => r.status === 'Pending').map((req) => {
                           const bankAccount = bankAccounts.find(b => b.id === req.bankAccountId);
                           return (
                             <div key={req.id} className="bg-app-card-inner border border-app-border rounded p-4">
                                <div className="flex justify-between items-start mb-2 border-b border-app-border pb-2">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-app-text-muted uppercase leading-none">User ID</span>
                                    <span className="font-bold text-app-text">{req.userId || 'Unknown'}</span>
                                  </div>
                                  <div className="flex flex-col text-right">
                                    <span className="text-[10px] font-bold text-app-text-muted uppercase leading-none">Amount</span>
                                    <span className="font-black text-red-500 text-lg">₹{req.amount}</span>
                                  </div>
                                </div>
                                <div className="mb-4 bg-[#1A2536] p-3 rounded-lg border border-app-border">
                                  <p className="text-xs text-app-text-muted mb-1 font-bold uppercase tracking-wider">Bank Details</p>
                                  <p className="text-sm font-bold text-white mb-1"><span className="text-gray-400 font-normal">Holder:</span> {bankAccount?.accountHolderName}</p>
                                  <p className="text-sm font-bold text-white mb-1"><span className="text-gray-400 font-normal">Acc Num:</span> {bankAccount?.accountNumber}</p>
                                  <p className="text-sm font-bold text-white uppercase"><span className="text-gray-400 font-normal capitalize">IFSC:</span> {bankAccount?.ifscCode}</p>
                                </div>
                                <div className="flex gap-2">
                                   <button 
                                     onClick={async () => {
                                        await setDoc(doc(db, 'withdrawals', req.id), { ...req, status: 'Approved' });
                                        alert(`Withdrawal of ₹${req.amount} approved. Make sure you sent the money via the bank details provided.`);
                                     }}
                                     className="flex-1 bg-green-600 text-app-text font-bold py-2 rounded shadow-sm hover:bg-green-700 active:scale-95 text-xs text-center"
                                   >
                                     Approve
                                   </button>
                                   <button 
                                     onClick={async () => {
                                        await setDoc(doc(db, 'withdrawals', req.id), { ...req, status: 'Rejected' });
                                        // Refund winning balance
                                        if (req.userId) {
                                           const wRef = doc(db, 'wallets', req.userId);
                                           const wDoc = await getDoc(wRef);
                                           if (wDoc.exists()) {
                                              const curr = wDoc.data();
                                              await setDoc(wRef, { ...curr, winning: (curr.winning || 0) + req.amount });
                                           }
                                        }
                                        alert(`Withdrawal rejected. Amount refunded to user wallet.`);
                                     }}
                                     className="flex-1 bg-red-100 text-app-accent font-bold py-2 rounded shadow-sm hover:bg-red-200 active:scale-95 text-xs text-center border border-red-200"
                                   >
                                     Reject & Refund
                                   </button>
                                </div>
                             </div>
                           );
                        })
                     )}
                  </div>
               </div>
             )}

             <button 
                onClick={() => setShowManageDeposits(!showManageDeposits)}
                className={`flex items-center justify-between w-full mt-6 bg-app-card border p-4 shadow-sm transition-colors active:scale-[0.99] ${showManageDeposits ? 'border-app-border-hover rounded-t-xl border-b-0 mb-0' : 'border-app-border rounded-xl mb-3'}`}
             >
                <h3 className="font-bold text-app-text text-base">Manage Deposit Requests</h3>
                <div className={`p-1 rounded-full transition-colors ${showManageDeposits ? 'text-app-text-muted bg-app-card-hover' : 'text-app-text-muted bg-app-bg'}`}>
                   {showManageDeposits ? <ChevronUp size={18} /> : <ChevronDown size={18} />} 
                </div>
             </button>
             
             {showManageDeposits && (
               <div className="bg-app-card/50 rounded-b-xl shadow-sm border border-app-border-hover border-t-0 p-4 mb-6">
                  <p className="text-xs text-app-text-muted mb-4">View user deposit requests, verify their screenshot/UTR, and add the amount to their wallet.</p>
                  
                  <div className="space-y-4">
                     {depositRequests.filter(r => r.status === 'Pending').length === 0 ? (
                        <p className="text-sm font-bold text-app-text-muted text-center py-4 bg-app-card-inner rounded">No pending deposit requests.</p>
                     ) : (
                        depositRequests.filter(r => r.status === 'Pending').map((req, index) => (
                           <div key={req.id} className="bg-app-card-inner border border-app-border rounded p-4">
                              <div className="flex justify-between items-start mb-2 border-b border-app-border pb-2">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-app-text-muted uppercase leading-none">Method</span>
                                  <span className="font-bold text-app-text">{req.method}</span>
                                </div>
                                <div className="flex flex-col text-right">
                                  <span className="text-[10px] font-bold text-app-text-muted uppercase leading-none">Amount</span>
                                  <span className="font-black text-green-600 text-lg">₹{req.amount}</span>
                                </div>
                              </div>
                              <div className="mb-4">
                                {req.userName && <p className="text-xs text-app-text-muted mb-1">User: <span className="font-bold text-app-text">{req.userName}</span></p>}
                                <p className="text-xs text-app-text-muted mb-1">Time: <span className="font-bold text-app-text">{req.timestamp}</span></p>
                                <p className="text-xs text-app-text-muted mb-1">UTR: <span className="font-mono font-bold text-app-text bg-app-card px-1 border border-app-border rounded">{req.utr}</span></p>
                                <p className="text-xs text-blue-600 font-bold flex items-center gap-1 underline mt-2 cursor-pointer">
                                  Screenshot Uploaded (View)
                                </p>
                              </div>
                              <div className="flex gap-2">
                                 <button 
                                   onClick={async () => {
                                      // Accept Logic
                                      await setDoc(doc(db, 'deposits', req.id), { ...req, status: 'Approved' });
                                      if (req.userId) {
                                         const wRef = doc(db, 'wallets', req.userId);
                                         const wDoc = await getDoc(wRef);
                                         if (wDoc.exists()) {
                                            const curr = wDoc.data();
                                            await setDoc(wRef, { ...curr, deposit: (curr.deposit || 0) + req.amount });
                                         }
                                      }
                                      alert(`Accepted! ₹${req.amount} added to user wallet.`);
                                   }}
                                   className="flex-1 bg-green-600 text-app-text font-bold py-2 rounded shadow-sm hover:bg-green-700 active:scale-95 text-xs text-center"
                                 >
                                   Accept & Add ₹{req.amount}
                                 </button>
                                 <button 
                                   onClick={async () => {
                                      // Reject Logic
                                      await setDoc(doc(db, 'deposits', req.id), { ...req, status: 'Rejected' });
                                      alert(`Deposit request rejected.`);
                                   }}
                                   className="flex-1 bg-red-100 text-app-accent font-bold py-2 rounded shadow-sm hover:bg-red-200 active:scale-95 text-xs text-center"
                                 >
                                   Reject
                                 </button>
                              </div>
                           </div>
                        ))
                     )}
                  </div>
               </div>
             )}

             <button 
                onClick={() => setShowManageUserTeams(!showManageUserTeams)}
                className={`flex items-center justify-between w-full mt-6 bg-app-card border p-4 shadow-sm transition-colors active:scale-[0.99] ${showManageUserTeams ? 'border-app-border-hover rounded-t-xl border-b-0 mb-0' : 'border-app-border rounded-xl mb-3'}`}
             >
                <h3 className="font-bold text-app-text text-base">Manage User Teams (Edit)</h3>
                <div className={`p-1 rounded-full transition-colors ${showManageUserTeams ? 'text-app-text-muted bg-app-card-hover' : 'text-app-text-muted bg-app-bg'}`}>
                   {showManageUserTeams ? <ChevronUp size={18} /> : <ChevronDown size={18} />} 
                </div>
             </button>
             
             {showManageUserTeams && (
               <div className="bg-app-card/50 rounded-b-xl shadow-sm border border-app-border-hover border-t-0 p-4 mb-6">
                  {!adminTeamEditMatchId ? (
                     <>
                        <p className="text-xs text-app-text-muted mb-4">Select a match to view and edit user teams.</p>
                        <div className="space-y-3">
                           {appMatches.map(match => (
                               <div 
                                 key={match.id}
                                 onClick={() => setAdminTeamEditMatchId(match.id)}
                                 className="bg-app-card-inner border border-app-border rounded-lg p-3 flex justify-between items-center cursor-pointer hover:bg-app-card-hover transition-colors"
                               >
                                 <div className="flex flex-col">
                                    <span className="font-bold text-app-text text-sm">{match.series} ({match.team1.shortFrame} vs {match.team2.shortFrame})</span>
                                    <span className={`text-[10px] font-bold uppercase mt-1 w-fit px-1.5 py-0.5 rounded ${match.status === 'Live' ? 'bg-red-500/10 text-red-500' : match.status === 'Completed' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                       {match.status}
                                    </span>
                                 </div>
                                 <span className="text-xs font-bold bg-app-card px-2 py-1 rounded text-app-text-muted">
                                    {savedTeams.filter(t => t.match.id === match.id).length} Teams
                                 </span>
                               </div>
                           ))}
                        </div>
                     </>
                  ) : (
                     <>
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-app-border">
                           <button onClick={() => setAdminTeamEditMatchId(null)} className="p-1 rounded bg-app-card-inner hover:bg-app-card-hover border border-app-border text-app-text"><ArrowLeft size={16}/></button>
                           <h4 className="font-bold text-app-text text-sm">{appMatches.find(m => m.id === adminTeamEditMatchId)?.team1.shortFrame} vs {appMatches.find(m => m.id === adminTeamEditMatchId)?.team2.shortFrame} Teams</h4>
                        </div>
                        
                        <div className="relative mb-4">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                           <input 
                              type="text" 
                              placeholder="Search by 10-digit User ID..."
                              value={teamSearchQuery}
                              onChange={(e) => setTeamSearchQuery(e.target.value)}
                              className="w-full bg-app-card-inner border border-app-border text-app-text rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-app-accent"
                           />
                        </div>
                        
                        <div className="space-y-3">
                           {(() => {
                              const matchTeams = savedTeams.filter(t => t.match.id === adminTeamEditMatchId);
                              const filtered = matchTeams
                                .map((st) => ({ st, actIdx: savedTeams.findIndex(orig => orig.id === st.id) }))
                                .filter(({ st }) => st.userId?.toLowerCase().includes(teamSearchQuery.toLowerCase()) || st.teamId?.toLowerCase().includes(teamSearchQuery.toLowerCase()));
                                
                              if (matchTeams.length === 0) return <p className="text-sm font-bold text-app-text-muted text-center py-4">No user teams for this match.</p>;
                              if (filtered.length === 0) return <p className="text-sm font-bold text-app-text-muted text-center py-4">No results for "{teamSearchQuery}"</p>;
                              
                              return filtered.map(({ st, actIdx }) => (
                                 <div key={st.id || actIdx} className="bg-app-card-inner border border-app-border rounded p-3 text-sm">
                                    <div className="flex justify-between items-center font-bold text-app-text mb-2">
                                       <span className="flex-1 truncate pr-2">{st.match.series} ({st.match.team1.shortFrame} vs {st.match.team2.shortFrame})</span>
                                       <span className="text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded text-xs">{st.userId}</span>
                                    </div>
                                    <div className="text-xs text-app-text-muted mb-2 border-b border-app-border pb-2 flex justify-between">
                                       <span>Contest: <span className="font-bold">{st.contestName}</span></span>
                                       <span className="font-bold">{st.teamId}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-app-text-muted mb-3">
                                       <span>Total Players</span>
                                       <span className="bg-app-card-hover px-2 py-0.5 rounded text-app-text font-bold">{st.players.length} / 11</span>
                                    </div>
                                    <button
                                       onClick={() => {
                                          setEditingSavedTeamIndex(actIdx);
                                          setActiveMatch(st.match);
                                          setTeam(st.players);
                                          setCaptain(st.captain);
                                          setViceCaptain(st.viceCaptain);
                                          setSelectedContest({ fee: st.fee, name: st.contestName });
                                          setView('CREATE_TEAM');
                                       }}
                                       className="w-full bg-app-card-alt hover:bg-app-card-hover transition-colors text-app-text font-bold py-2 rounded shadow-sm text-xs flex justify-center items-center gap-2 border border-app-border"
                                    >
                                       <Edit2 size={14} /> Edit Team Setup
                                    </button>
                                 </div>
                              ));
                           })()}
                        </div>
                     </>
                  )}
               </div>
             )}

             <button 
                onClick={() => setShowManagePlayers(!showManagePlayers)}
                className={`flex items-center justify-between w-full mt-6 bg-app-card border p-4 shadow-sm transition-colors active:scale-[0.99] ${showManagePlayers ? 'border-app-border-hover rounded-t-xl border-b-0 mb-0' : 'border-app-border rounded-xl mb-3'}`}
             >
                <h3 className="font-bold text-app-text text-base flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-app-accent animate-pulse"></div> Live Match Dashboard
                </h3>
                <div className={`p-1 rounded-full transition-colors ${showManagePlayers ? 'text-app-text-muted bg-app-card-hover' : 'text-app-text-muted bg-app-bg'}`}>
                   {showManagePlayers ? <ChevronUp size={18} /> : <ChevronDown size={18} />} 
                </div>
             </button>
             
             {showManagePlayers && (
               <div className="bg-app-card/50 rounded-b-xl shadow-sm border border-app-border-hover border-t-0 p-4 mb-6">
                 {!adminLiveMatchId ? (
                   <>
                     <p className="text-xs text-app-text-muted mb-4">Select a live match to award real-time points.</p>
                     <div className="space-y-3">
                       {appMatches.filter(m => m.status === 'Live').length > 0 ? appMatches.filter(m => m.status === 'Live').map(match => (
                         <div 
                           key={match.id}
                           onClick={() => setAdminLiveMatchId(match.id)}
                           className="bg-app-card-inner rounded-lg border border-app-border-hover p-3 flex justify-between items-center cursor-pointer hover:bg-app-card-hover transition-colors"
                         >
                           <div className="flex items-center gap-3">
                             <div className="flex items-center gap-1">
                               <div className="w-5 h-5 rounded-full" style={{backgroundColor: match.team1.color}}></div>
                               <span className="font-bold text-app-text text-sm">{match.team1.shortFrame}</span>
                             </div>
                             <span className="text-app-text-muted text-xs text-center font-bold">vs</span>
                             <div className="flex items-center gap-1">
                               <span className="font-bold text-app-text text-sm">{match.team2.shortFrame}</span>
                               <div className="w-5 h-5 rounded-full" style={{backgroundColor: match.team2.color}}></div>
                             </div>
                           </div>
                           <ArrowRight size={16} className="text-app-text-muted" />
                         </div>
                       )) : (
                         <p className="text-sm text-app-text-muted text-center py-4">No live matches currently.</p>
                       )}
                     </div>
                   </>
                 ) : (
                   <>
                     {(() => {
                       const match = appMatches.find(m => m.id === adminLiveMatchId);
                       if (!match) return null;
                       const matchPlayers = appPlayers.filter(p => p.team === match.team1.shortFrame || p.team === match.team2.shortFrame);
                       return (
                         <>
                           <div className="flex items-center gap-2 mb-4">
                             <button onClick={() => setAdminLiveMatchId(null)} className="p-1 rounded bg-app-card-hover text-app-text"><ArrowLeft size={16}/></button>
                             <h4 className="font-bold text-app-text text-sm">{match.team1.shortFrame} vs {match.team2.shortFrame}</h4>
                           </div>
                           <p className="text-xs text-app-text-muted mb-4">Award real-time points. Leaderboards and user dashboards will update instantly.</p>
                           
                           <div className="space-y-3">
                              {matchPlayers.map((player) => (
                                <div key={player.id} className="bg-app-card-inner rounded-lg border border-app-border overflow-hidden">
                                   <div className="flex justify-between items-center p-3">
                                      <div className="flex flex-col">
                                         <span className="text-sm font-bold text-app-text flex items-center gap-2">{player.name} <span className="bg-app-card-hover text-[10px] px-1.5 py-0.5 rounded text-app-text-muted">{player.team}</span></span>
                                         <span className="text-xs font-bold text-green-500 mt-0.5">{player.points} Total Pts</span>
                                      </div>
                                      <button 
                                        onClick={() => setAdminExpandedPlayerId(adminExpandedPlayerId === player.id ? null : player.id)}
                                        className="bg-app-card-hover p-2 rounded-full hover:bg-slate-700 transition-colors active:scale-95 text-blue-400"
                                      >
                                        {adminExpandedPlayerId === player.id ? <Minus size={18} /> : <PlusCircle size={18} />}
                                      </button>
                                   </div>
                                   
                                   {adminExpandedPlayerId === player.id && (
                                      <div className="p-3 bg-app-card-alt border-t border-app-border">
                                        <p className="text-[10px] font-bold text-app-text-muted uppercase mb-3">Award Points</p>
                                        <div className="grid grid-cols-3 gap-2">
                                           <button 
                                             onClick={() => setAppPlayers(appPlayers.map(p => p.id === player.id ? { ...p, points: p.points + 6 } : p))}
                                             className="bg-app-card border border-app-border-hover hover:border-slate-500 hover:scale-[1.02] active:scale-95 transition-all rounded py-2 text-xs font-bold text-app-text flex flex-col items-center"
                                           >
                                             <span className="text-blue-400 mb-0.5">+6</span> Six
                                           </button>
                                           <button 
                                             onClick={() => setAppPlayers(appPlayers.map(p => p.id === player.id ? { ...p, points: p.points + 4 } : p))}
                                             className="bg-app-card border border-app-border-hover hover:border-slate-500 hover:scale-[1.02] active:scale-95 transition-all rounded py-2 text-xs font-bold text-app-text flex flex-col items-center"
                                           >
                                             <span className="text-blue-400 mb-0.5">+4</span> Four
                                           </button>
                                           <button 
                                             onClick={() => setAppPlayers(appPlayers.map(p => p.id === player.id ? { ...p, points: p.points + 25 } : p))}
                                             className="bg-app-card border border-app-border-hover hover:border-slate-500 hover:scale-[1.02] active:scale-95 transition-all rounded py-2 text-xs font-bold text-app-text flex flex-col items-center"
                                           >
                                             <span className="text-red-400 mb-0.5">+25</span> Wicket
                                           </button>
                                           <button 
                                             onClick={() => setAppPlayers(appPlayers.map(p => p.id === player.id ? { ...p, points: p.points + 1 } : p))}
                                             className="bg-app-card border border-app-border-hover hover:border-slate-500 hover:scale-[1.02] active:scale-95 transition-all rounded py-2 text-xs font-bold text-app-text flex flex-col items-center"
                                           >
                                             <span className="text-emerald-400 mb-0.5">+1</span> 1 Run
                                           </button>
                                           <button 
                                             onClick={() => setAppPlayers(appPlayers.map(p => p.id === player.id ? { ...p, points: p.points + 2 } : p))}
                                             className="bg-app-card border border-app-border-hover hover:border-slate-500 hover:scale-[1.02] active:scale-95 transition-all rounded py-2 text-xs font-bold text-app-text flex flex-col items-center"
                                           >
                                             <span className="text-emerald-400 mb-0.5">+2</span> 2 Run
                                           </button>
                                           <button 
                                             onClick={() => setAppPlayers(appPlayers.map(p => p.id === player.id ? { ...p, points: p.points + 12 } : p))}
                                             className="bg-app-card border border-app-border-hover hover:border-slate-500 hover:scale-[1.02] active:scale-95 transition-all rounded py-2 text-xs font-bold text-app-text flex flex-col items-center"
                                           >
                                             <span className="text-orange-400 mb-0.5">+12</span> Catch
                                           </button>
                                        </div>
                                        <div className="flex gap-2 items-center mt-3 pt-3 border-t border-app-border">
                                           <span className="text-[10px] font-bold text-app-text-muted uppercase flex-1">Custom Add/Remove:</span>
                                           <button onClick={() => setAppPlayers(appPlayers.map(p => p.id === player.id ? { ...p, points: Math.max(0, p.points - 1) } : p))} className="bg-red-950 text-app-accent px-3 py-1 rounded font-bold text-xs">-1</button>
                                           <button onClick={() => setAppPlayers(appPlayers.map(p => p.id === player.id ? { ...p, points: p.points + 10 } : p))} className="bg-green-950 text-green-500 px-3 py-1 rounded font-bold text-xs">+10</button>
                                        </div>
                                      </div>
                                   )}
                                </div>
                              ))}
                           </div>
                         </>
                       );
                     })()}
                   </>
                 )}
               </div>
             )}
          </div>
       </div>
    );
  };

  return (
    <div className={`relative h-[100dvh] w-full max-w-md mx-auto bg-app-bg text-app-text font-sans shadow-2xl overflow-hidden border-x border-app-border ${themeMode === 'Light' ? 'theme-light' : ''} color-${themeColor.toLowerCase()}`}>
      {view === 'HOME' && renderHome()}
      {view === 'MATCH' && renderContests()}
      {view === 'CREATE_TEAM' && renderCreateTeam()}
      {view === 'TEAM_PREVIEW' && renderTeamPreview()}
      {view === 'SELECT_CAPTAIN' && renderSelectCaptain()}
      {view === 'KYC' && renderKyc()}
      
      {/* New Screens Added */}
      {view === 'CONTEST_DETAILS' && activeMatch && activeContestDetails && (
         <ContestDetailsView 
            activeMatch={activeMatch}
            contest={activeContestDetails}
            savedTeams={savedTeams}
            appPlayers={appPlayers}
            winningPercentage={winningPercentage}
            onBack={() => { setActiveContestDetails(null); setView('MATCH'); }}
            balance={balance}
            onAddCash={() => setView('WALLET')}
            onJoin={() => {
                setSelectedContest({fee: activeContestDetails.entryFee, name: activeContestDetails.name});
                setView('CREATE_TEAM');
            }}
            onParticipantClick={(t) => {
                setTeam(t.players);
                setCaptain(t.captain);
                setViceCaptain(t.viceCaptain);
                setPreviewSource('CONTEST_DETAILS');
                setPreviewTeamInfo({ name: `${t.userName || t.userId} (${t.teamId})`, points: t.points });
                setView('TEAM_PREVIEW');
            }}
         />
      )}
      {view === 'MY_MATCHES' && renderMyMatches()}
      {view === 'WALLET' && renderWallet()}
      {view === 'WITHDRAW' && renderWithdraw()}
      {view === 'REWARD' && renderPlaceholder('Rewards', <PlayCircle size={60} />, 'Watch videos, earn coins and unlock exciting premium rewards.')}
      {view === 'CHAT' && renderPlaceholder('Community Chat', <MessageSquare size={60} />, 'Discuss match predictions, share your team and chat with friends.')}
      {view === 'NOTIFICATIONS' && renderPlaceholder('Notifications', <Bell size={60} />, 'Catch all the latest match updates and lineup announcements here.')}
      {view === 'PROFILE' && renderProfile()}
      {view === 'ADMIN' && renderAdminPanel()}
    </div>
  );
}
