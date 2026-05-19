import React, { useState, useEffect, useMemo, useCallback, useRef, Component } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Cropper from 'react-easy-crop';
import { Trophy, Clock, Users, ArrowLeft, Home, User, Wallet, Bell, PlayCircle, Shield, Plus, Minus, Info, Receipt, Settings, MessageSquare, Copy, PlusCircle, Edit2, ArrowDownToLine, ArrowDownLeft, ArrowRight, Check, X, ChevronUp, ChevronDown, Search, ChevronLeft, ChevronRight, Trash2, Download, BarChart2, Image as ImageIcon, ZoomIn, RefreshCw, AlertCircle } from 'lucide-react';
import { auth, googleProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, RecaptchaVerifier, signInWithPhoneNumber } from './lib/firebase';
import { supabase } from './lib/supabase';
import { db, doc, onSnapshot, setDoc, collection, query, where, getDoc, getDocs, updateDoc, writeBatch, increment, deleteDoc } from './lib/supabase-firestore';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
      return '';
  }

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  return canvas.toDataURL('image/jpeg', 0.8);
}

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
  userNumericId?: string;
  amount: number;
  bankAccountId: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  timestamp: string;
}

interface Contest {
  id: string;
  type: string;
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
  team1: { name: string; shortFrame: string; color: string; flagUrl?: string; flagFit?: 'cover' | 'contain' };
  team2: { name: string; shortFrame: string; color: string; flagUrl?: string; flagFit?: 'cover' | 'contain' };
  time: string;
  matchDateISO?: string;
  totalPrize: string;
  status: 'Upcoming' | 'Live' | 'Completed';
  lineupStatus?: 'OUT' | 'NOT_OUT';
}

interface DepositRequest {
  id: string;
  userId?: string;
  userNumericId?: string;
  userName?: string;
  amount: number;
  method: string;
  utr: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  timestamp: string;
}

// Triple-Sync Helper (sync to Redis, Supabase, Firestore)
export const syncWalletToBackend = async (dbInstance: any, userId: string, data: any) => {
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: 'wallets', id: userId, data })
    });
    if (!res.ok) throw new Error('API Sync Failed');
  } catch (err) {
    console.warn("Triple-sync request failed, updating firestore directly:", err);
    await setDoc(doc(dbInstance, 'wallets', userId), data, { merge: true });
  }
};

interface Player {
  id: string;
  name: string;
  team: string; // matches team1/team2 shortFrame
  role: Role;
  credits: number;
  points: number;
  selPercent: number;
  isPlaying?: boolean;
}

// --- Mock Data ---
const DEFAULT_MATCHES: Match[] = [];

// Using MOCK_PLAYERS as default, state is managed in app
export const MOCK_PLAYERS: Player[] = [
  // --- INDIA (IND) ---
  { id: 'ind_1', name: 'Virat Kohli', team: 'IND', role: 'BAT', credits: 9.5, points: 0, selPercent: 95 },
  { id: 'ind_2', name: 'Rohit Sharma', team: 'IND', role: 'BAT', credits: 9.0, points: 0, selPercent: 90 },
  { id: 'ind_3', name: 'Shubman Gill', team: 'IND', role: 'BAT', credits: 8.5, points: 0, selPercent: 80 },
  { id: 'ind_4', name: 'Suryakumar Yadav', team: 'IND', role: 'BAT', credits: 9.0, points: 0, selPercent: 88 },
  { id: 'ind_5', name: 'Yashasvi Jaiswal', team: 'IND', role: 'BAT', credits: 8.5, points: 0, selPercent: 75 },
  { id: 'ind_6', name: 'Rishabh Pant', team: 'IND', role: 'WK', credits: 8.5, points: 0, selPercent: 82 },
  { id: 'ind_7', name: 'KL Rahul', team: 'IND', role: 'WK', credits: 8.5, points: 0, selPercent: 70 },
  { id: 'ind_8', name: 'Sanju Samson', team: 'IND', role: 'WK', credits: 8.0, points: 0, selPercent: 55 },
  { id: 'ind_9', name: 'Hardik Pandya', team: 'IND', role: 'AR', credits: 9.0, points: 0, selPercent: 85 },
  { id: 'ind_10', name: 'Ravindra Jadeja', team: 'IND', role: 'AR', credits: 9.0, points: 0, selPercent: 80 },
  { id: 'ind_11', name: 'Axar Patel', team: 'IND', role: 'AR', credits: 8.5, points: 0, selPercent: 65 },
  { id: 'ind_12', name: 'Shivam Dube', team: 'IND', role: 'AR', credits: 8.0, points: 0, selPercent: 60 },
  { id: 'ind_13', name: 'Jasprit Bumrah', team: 'IND', role: 'BOWL', credits: 9.5, points: 0, selPercent: 92 },
  { id: 'ind_14', name: 'Mohammed Siraj', team: 'IND', role: 'BOWL', credits: 8.5, points: 0, selPercent: 70 },
  { id: 'ind_15', name: 'Kuldeep Yadav', team: 'IND', role: 'BOWL', credits: 8.5, points: 0, selPercent: 78 },
  { id: 'ind_16', name: 'Arshdeep Singh', team: 'IND', role: 'BOWL', credits: 8.5, points: 0, selPercent: 72 },
  { id: 'ind_17', name: 'Mohammed Shami', team: 'IND', role: 'BOWL', credits: 8.5, points: 0, selPercent: 65 },
  { id: 'ind_18', name: 'Yuzvendra Chahal', team: 'IND', role: 'BOWL', credits: 8.0, points: 0, selPercent: 50 },

  // --- CSK (Chennai Super Kings) ---
  { id: 'csk_1', name: 'MS Dhoni', team: 'CSK', role: 'WK', credits: 8.5, points: 0, selPercent: 85 },
  { id: 'csk_2', name: 'Ruturaj Gaikwad', team: 'CSK', role: 'BAT', credits: 9.0, points: 0, selPercent: 90 },
  { id: 'csk_3', name: 'Rachin Ravindra', team: 'CSK', role: 'BAT', credits: 8.5, points: 0, selPercent: 78 },
  { id: 'csk_4', name: 'Shivam Dube', team: 'CSK', role: 'AR', credits: 8.5, points: 0, selPercent: 82 },
  { id: 'csk_5', name: 'Ravindra Jadeja', team: 'CSK', role: 'AR', credits: 9.0, points: 0, selPercent: 88 },
  { id: 'csk_6', name: 'Daryl Mitchell', team: 'CSK', role: 'BAT', credits: 8.5, points: 0, selPercent: 70 },
  { id: 'csk_7', name: 'Matheesha Pathirana', team: 'CSK', role: 'BOWL', credits: 9.0, points: 0, selPercent: 80 },
  { id: 'csk_8', name: 'Tushar Deshpande', team: 'CSK', role: 'BOWL', credits: 8.0, points: 0, selPercent: 65 },
  { id: 'csk_9', name: 'Deepak Chahar', team: 'CSK', role: 'BOWL', credits: 8.5, points: 0, selPercent: 60 },
  { id: 'csk_10', name: 'Shardul Thakur', team: 'CSK', role: 'BOWL', credits: 8.5, points: 0, selPercent: 55 },
  { id: 'csk_11', name: 'Ajinkya Rahane', team: 'CSK', role: 'BAT', credits: 8.0, points: 0, selPercent: 50 },
  { id: 'csk_12', name: 'Moeen Ali', team: 'CSK', role: 'AR', credits: 8.5, points: 0, selPercent: 45 },

  // --- MI (Mumbai Indians) ---
  { id: 'mi_1', name: 'Rohit Sharma', team: 'MI', role: 'BAT', credits: 9.0, points: 0, selPercent: 92 },
  { id: 'mi_2', name: 'Hardik Pandya', team: 'MI', role: 'AR', credits: 9.0, points: 0, selPercent: 88 },
  { id: 'mi_3', name: 'Suryakumar Yadav', team: 'MI', role: 'BAT', credits: 9.5, points: 0, selPercent: 95 },
  { id: 'mi_4', name: 'Ishan Kishan', team: 'MI', role: 'WK', credits: 8.5, points: 0, selPercent: 80 },
  { id: 'mi_5', name: 'Jasprit Bumrah', team: 'MI', role: 'BOWL', credits: 9.5, points: 0, selPercent: 98 },
  { id: 'mi_6', name: 'Tilak Varma', team: 'MI', role: 'BAT', credits: 8.5, points: 0, selPercent: 75 },
  { id: 'mi_7', name: 'Tim David', team: 'MI', role: 'BAT', credits: 8.5, points: 0, selPercent: 70 },
  { id: 'mi_8', name: 'Gerald Coetzee', team: 'MI', role: 'BOWL', credits: 8.5, points: 0, selPercent: 65 },
  { id: 'mi_9', name: 'Piyush Chawla', team: 'MI', role: 'BOWL', credits: 8.0, points: 0, selPercent: 55 },
  { id: 'mi_10', name: 'Mohammad Nabi', team: 'MI', role: 'AR', credits: 8.0, points: 0, selPercent: 40 },
  { id: 'mi_11', name: 'Nuwan Thushara', team: 'MI', role: 'BOWL', credits: 8.0, points: 0, selPercent: 35 },

  // --- RCB (Royal Challengers Bangalore) ---
  { id: 'rcb_1', name: 'Virat Kohli', team: 'RCB', role: 'BAT', credits: 10.0, points: 0, selPercent: 99 },
  { id: 'rcb_2', name: 'Faf du Plessis', team: 'RCB', role: 'BAT', credits: 9.0, points: 0, selPercent: 85 },
  { id: 'rcb_3', name: 'Glenn Maxwell', team: 'RCB', role: 'AR', credits: 9.0, points: 0, selPercent: 80 },
  { id: 'rcb_4', name: 'Rajat Patidar', team: 'RCB', role: 'BAT', credits: 8.5, points: 0, selPercent: 60 },
  { id: 'rcb_5', name: 'Dinesh Karthik', team: 'RCB', role: 'WK', credits: 8.5, points: 0, selPercent: 70 },
  { id: 'rcb_6', name: 'Cameron Green', team: 'RCB', role: 'AR', credits: 9.0, points: 0, selPercent: 75 },
  { id: 'rcb_7', name: 'Will Jacks', team: 'RCB', role: 'AR', credits: 8.5, points: 0, selPercent: 65 },
  { id: 'rcb_8', name: 'Mohammed Siraj', team: 'RCB', role: 'BOWL', credits: 9.0, points: 0, selPercent: 80 },
  { id: 'rcb_9', name: 'Yash Dayal', team: 'RCB', role: 'BOWL', credits: 8.0, points: 0, selPercent: 50 },
  { id: 'rcb_10', name: 'Karn Sharma', team: 'RCB', role: 'BOWL', credits: 8.0, points: 0, selPercent: 40 },
  { id: 'rcb_11', name: 'Swapnil Singh', team: 'RCB', role: 'AR', credits: 7.5, points: 0, selPercent: 30 },

  // --- KKR (Kolkata Knight Riders) ---
  { id: 'kkr_1', name: 'Shreyas Iyer', team: 'KKR', role: 'BAT', credits: 9.0, points: 0, selPercent: 80 },
  { id: 'kkr_2', name: 'Sunil Narine', team: 'KKR', role: 'AR', credits: 9.5, points: 0, selPercent: 95 },
  { id: 'kkr_3', name: 'Andre Russell', team: 'KKR', role: 'AR', credits: 9.5, points: 0, selPercent: 92 },
  { id: 'kkr_4', name: 'Phil Salt', team: 'KKR', role: 'WK', credits: 9.0, points: 0, selPercent: 88 },
  { id: 'kkr_5', name: 'Rinku Singh', team: 'KKR', role: 'BAT', credits: 8.5, points: 0, selPercent: 75 },
  { id: 'kkr_6', name: 'Venkatesh Iyer', team: 'KKR', role: 'BAT', credits: 8.5, points: 0, selPercent: 70 },
  { id: 'kkr_7', name: 'Mitchell Starc', team: 'KKR', role: 'BOWL', credits: 9.5, points: 0, selPercent: 82 },
  { id: 'kkr_8', name: 'Varun Chakaravarthy', team: 'KKR', role: 'BOWL', credits: 9.0, points: 0, selPercent: 85 },
  { id: 'kkr_9', name: 'Harshit Rana', team: 'KKR', role: 'BOWL', credits: 8.5, points: 0, selPercent: 70 },
  { id: 'kkr_10', name: 'Vaibhav Arora', team: 'KKR', role: 'BOWL', credits: 8.0, points: 0, selPercent: 50 },
  { id: 'kkr_11', name: 'Ramandeep Singh', team: 'KKR', role: 'AR', credits: 7.5, points: 0, selPercent: 40 },

  // --- SRH (Sunrisers Hyderabad) ---
  { id: 'srh_1', name: 'Pat Cummins', team: 'SRH', role: 'BOWL', credits: 9.5, points: 0, selPercent: 90 },
  { id: 'srh_2', name: 'Travis Head', team: 'SRH', role: 'BAT', credits: 9.5, points: 0, selPercent: 95 },
  { id: 'srh_3', name: 'Abhishek Sharma', team: 'SRH', role: 'BAT', credits: 9.0, points: 0, selPercent: 92 },
  { id: 'srh_4', name: 'Heinrich Klaasen', team: 'SRH', role: 'WK', credits: 9.5, points: 0, selPercent: 94 },
  { id: 'srh_5', name: 'Aiden Markram', team: 'SRH', role: 'BAT', credits: 8.5, points: 0, selPercent: 65 },
  { id: 'srh_6', name: 'Nitish Reddy', team: 'SRH', role: 'AR', credits: 8.5, points: 0, selPercent: 75 },
  { id: 'srh_7', name: 'Bhuvneshwar Kumar', team: 'SRH', role: 'BOWL', credits: 8.5, points: 0, selPercent: 70 },
  { id: 'srh_8', name: 'T Natarajan', team: 'SRH', role: 'BOWL', credits: 9.0, points: 0, selPercent: 85 },
  { id: 'srh_9', name: 'Mayank Markande', team: 'SRH', role: 'BOWL', credits: 8.0, points: 0, selPercent: 40 },
  { id: 'srh_10', name: 'Shahbaz Ahmed', team: 'SRH', role: 'AR', credits: 8.0, points: 0, selPercent: 50 },
  { id: 'srh_11', name: 'Jaydev Unadkat', team: 'SRH', role: 'BOWL', credits: 8.0, points: 0, selPercent: 35 },

  // --- RR (Rajasthan Royals) ---
  { id: 'rr_1', name: 'Sanju Samson', team: 'RR', role: 'WK', credits: 9.0, points: 0, selPercent: 88 },
  { id: 'rr_2', name: 'Jos Buttler', team: 'RR', role: 'WK', credits: 9.5, points: 0, selPercent: 92 },
  { id: 'rr_3', name: 'Yashasvi Jaiswal', team: 'RR', role: 'BAT', credits: 9.0, points: 0, selPercent: 85 },
  { id: 'rr_4', name: 'Riyan Parag', team: 'RR', role: 'BAT', credits: 9.0, points: 0, selPercent: 90 },
  { id: 'rr_5', name: 'Shimron Hetmyer', team: 'RR', role: 'BAT', credits: 8.5, points: 0, selPercent: 60 },
  { id: 'rr_6', name: 'Dhruv Jurel', team: 'RR', role: 'WK', credits: 8.0, points: 0, selPercent: 55 },
  { id: 'rr_7', name: 'R Ashwin', team: 'RR', role: 'AR', credits: 8.5, points: 0, selPercent: 70 },
  { id: 'rr_8', name: 'Trent Boult', team: 'RR', role: 'BOWL', credits: 9.5, points: 0, selPercent: 88 },
  { id: 'rr_9', name: 'Yuzvendra Chahal', team: 'RR', role: 'BOWL', credits: 9.0, points: 0, selPercent: 85 },
  { id: 'rr_10', name: 'Sandeep Sharma', team: 'RR', role: 'BOWL', credits: 8.5, points: 0, selPercent: 75 },
  { id: 'rr_11', name: 'Avesh Khan', team: 'RR', role: 'BOWL', credits: 8.5, points: 0, selPercent: 65 },

  // --- GT (Gujarat Titans) ---
  { id: 'gt_1', name: 'Shubman Gill', team: 'GT', role: 'BAT', credits: 9.5, points: 0, selPercent: 92 },
  { id: 'gt_2', name: 'Sai Sudharsan', team: 'GT', role: 'BAT', credits: 9.0, points: 0, selPercent: 85 },
  { id: 'gt_3', name: 'David Miller', team: 'GT', role: 'BAT', credits: 8.5, points: 0, selPercent: 75 },
  { id: 'gt_4', name: 'Rashid Khan', team: 'GT', role: 'AR', credits: 9.5, points: 0, selPercent: 95 },
  { id: 'gt_5', name: 'Rahul Tewatia', team: 'GT', role: 'AR', credits: 8.5, points: 0, selPercent: 70 },
  { id: 'gt_6', name: 'Mohit Sharma', team: 'GT', role: 'BOWL', credits: 8.5, points: 0, selPercent: 80 },
  { id: 'gt_7', name: 'Noor Ahmad', team: 'GT', role: 'BOWL', credits: 8.5, points: 0, selPercent: 65 },
  { id: 'gt_8', name: 'Umesh Yadav', team: 'GT', role: 'BOWL', credits: 8.5, points: 0, selPercent: 55 },
  { id: 'gt_9', name: 'W Saha', team: 'GT', role: 'WK', credits: 8.0, points: 0, selPercent: 45 },
  { id: 'gt_10', name: 'Vijay Shankar', team: 'GT', role: 'AR', credits: 8.0, points: 0, selPercent: 35 },

  // --- DC (Delhi Capitals) ---
  { id: 'dc_1', name: 'Rishabh Pant', team: 'DC', role: 'WK', credits: 9.5, points: 0, selPercent: 94 },
  { id: 'dc_2', name: 'David Warner', team: 'DC', role: 'BAT', credits: 9.0, points: 0, selPercent: 80 },
  { id: 'dc_3', name: 'Prithvi Shaw', team: 'DC', role: 'BAT', credits: 8.5, points: 0, selPercent: 60 },
  { id: 'dc_4', name: 'J Fraser-McGurk', team: 'DC', role: 'BAT', credits: 9.0, points: 0, selPercent: 88 },
  { id: 'dc_5', name: 'Axar Patel', team: 'DC', role: 'AR', credits: 9.0, points: 0, selPercent: 85 },
  { id: 'dc_6', name: 'Kuldeep Yadav', team: 'DC', role: 'BOWL', credits: 9.0, points: 0, selPercent: 90 },
  { id: 'dc_7', name: 'Khaleel Ahmed', team: 'DC', role: 'BOWL', credits: 8.5, points: 0, selPercent: 75 },
  { id: 'dc_8', name: 'Mukesh Kumar', team: 'DC', role: 'BOWL', credits: 8.5, points: 0, selPercent: 70 },
  { id: 'dc_9', name: 'Tristan Stubbs', team: 'DC', role: 'BAT', credits: 8.5, points: 0, selPercent: 78 },
  { id: 'dc_10', name: 'Ishant Sharma', team: 'DC', role: 'BOWL', credits: 8.0, points: 0, selPercent: 45 },

  // --- LSG (Lucknow Super Giants) ---
  { id: 'lsg_1', name: 'KL Rahul', team: 'LSG', role: 'WK', credits: 9.0, points: 0, selPercent: 88 },
  { id: 'lsg_2', name: 'Quinton de Kock', team: 'LSG', role: 'WK', credits: 9.0, points: 0, selPercent: 85 },
  { id: 'lsg_3', name: 'Nicholas Pooran', team: 'LSG', role: 'BAT', credits: 9.0, points: 0, selPercent: 92 },
  { id: 'lsg_4', name: 'Marcus Stoinis', team: 'LSG', role: 'AR', credits: 9.0, points: 0, selPercent: 88 },
  { id: 'lsg_5', name: 'Krunal Pandya', team: 'LSG', role: 'AR', credits: 8.5, points: 0, selPercent: 75 },
  { id: 'lsg_6', name: 'Ravi Bishnoi', team: 'LSG', role: 'BOWL', credits: 8.5, points: 0, selPercent: 80 },
  { id: 'lsg_7', name: 'Naveen-ul-Haq', team: 'LSG', role: 'BOWL', credits: 8.5, points: 0, selPercent: 70 },
  { id: 'lsg_8', name: 'Yash Thakur', team: 'LSG', role: 'BOWL', credits: 8.0, points: 0, selPercent: 60 },
  { id: 'lsg_9', name: 'Ayush Badoni', team: 'LSG', role: 'BAT', credits: 8.0, points: 0, selPercent: 55 },
  { id: 'lsg_10', name: 'Amit Mishra', team: 'LSG', role: 'BOWL', credits: 7.5, points: 0, selPercent: 30 },

  // --- PBKS (Punjab Kings) ---
  { id: 'pbks_1', name: 'Shikhar Dhawan', team: 'PBKS', role: 'BAT', credits: 9.0, points: 0, selPercent: 75 },
  { id: 'pbks_2', name: 'Jonny Bairstow', team: 'PBKS', role: 'WK', credits: 9.0, points: 0, selPercent: 80 },
  { id: 'pbks_3', name: 'Sam Curran', team: 'PBKS', role: 'AR', credits: 9.0, points: 0, selPercent: 88 },
  { id: 'pbks_4', name: 'Liam Livingstone', team: 'PBKS', role: 'AR', credits: 9.0, points: 0, selPercent: 82 },
  { id: 'pbks_5', name: 'Shashank Singh', team: 'PBKS', role: 'BAT', credits: 8.5, points: 0, selPercent: 78 },
  { id: 'pbks_6', name: 'Ashutosh Sharma', team: 'PBKS', role: 'BAT', credits: 8.0, points: 0, selPercent: 65 },
  { id: 'pbks_7', name: 'Harshal Patel', team: 'PBKS', role: 'BOWL', credits: 9.0, points: 0, selPercent: 85 },
  { id: 'pbks_8', name: 'Arshdeep Singh', team: 'PBKS', role: 'BOWL', credits: 9.0, points: 0, selPercent: 88 },
  { id: 'pbks_9', name: 'Kagiso Rabada', team: 'PBKS', role: 'BOWL', credits: 9.0, points: 0, selPercent: 82 },
  { id: 'pbks_10', name: 'Rahul Chahar', team: 'PBKS', role: 'BOWL', credits: 8.0, points: 0, selPercent: 45 },
  { id: 'pbks_11', name: 'Jitesh Sharma', team: 'PBKS', role: 'WK', credits: 8.5, points: 0, selPercent: 60 }
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
      if (!editTime || !editTime.includes(':')) return;
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
    <div className="bg-black/60 border border-slate-700 hover:border-[#e5c158]/30 rounded-xl p-4 flex flex-col gap-3 transition-colors">
      <div className="flex justify-between items-center border-b border-[#e5c158]/20 pb-3">
        <div className="font-bold text-slate-200 text-sm">{match?.team1?.shortFrame} vs {match?.team2?.shortFrame}</div>
        <div className={`text-[10px] font-black tracking-widest uppercase px-2 py-1 rounded-sm border ${match.status === 'Upcoming' ? 'bg-blue-900/30 text-blue-400 border-blue-500/30' : match.status === 'Live' ? 'bg-red-900/40 text-red-400 border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.4)] animate-pulse' : 'bg-green-900/30 text-green-400 border-green-500/30'}`}>{match.status}</div>
      </div>
      
      <div className="flex gap-2 items-end mt-1">
         <div className="flex-1">
            <label className="text-[10px] text-[#e5c158]/70 uppercase font-black tracking-widest pl-0.5">Match Date</label>
            <select 
              value={editDate} 
              onChange={(e) => setEditDate(e.target.value)} 
              className="w-full mt-1.5 bg-black text-slate-200 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-yellow-500 transition-colors"
            >
              <option value={formatDateISO(today)}>Today ({formatDateISO(today)})</option>
              <option value={formatDateISO(tomorrow)}>Tomorrow ({formatDateISO(tomorrow)})</option>
              <option value={formatDateISO(dayAfter)}>Day After ({formatDateISO(dayAfter)})</option>
            </select>
         </div>
         <div className="flex-[0.8]">
            <label className="text-[10px] text-[#e5c158]/70 uppercase font-black tracking-widest pl-0.5">Time</label>
            <input 
              type="time" 
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className="w-full mt-1.5 bg-black text-slate-200 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-yellow-500 transition-colors"
            />
         </div>
         <div className="flex-[0.6]">
            <button 
               onClick={handleUpdate}
               className="w-full bg-[#e5c158]/20 hover:bg-yellow-500/30 text-[#e5c158] border border-[#e5c158]/50 rounded-lg text-xs font-bold py-2 active:scale-95 transition-all text-shadow"
            >
               Update
            </button>
         </div>
      </div>
      
      <div className="flex gap-2 text-xs font-bold mt-2">
        <button 
          disabled={match.status === 'Upcoming'} 
          onClick={() => onStatusChange('Upcoming')} 
          className={`flex-1 py-2 rounded-lg border transition-colors ${match.status === 'Upcoming' ? 'bg-blue-900/30 text-blue-400 border-blue-500/50' : 'bg-black/50 text-slate-400 border-slate-700 hover:border-slate-500'}`}>Upcoming</button>
        
        <button 
          disabled={match.status === 'Live'} 
          onClick={() => onStatusChange('Live')} 
          className={`flex-1 py-2 rounded-lg border transition-colors ${match.status === 'Live' ? 'bg-red-900/40 text-red-400 border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.2)]' : 'bg-black/50 text-slate-400 border-slate-700 hover:border-slate-500'}`}>Go Live</button>
        
        <button 
          disabled={match.status === 'Completed'} 
          onClick={() => onStatusChange('Completed')} 
          className={`flex-1 py-2 rounded-lg border transition-colors ${match.status === 'Completed' ? 'bg-green-900/40 text-green-400 border-green-500/50 shadow-[0_0_8px_rgba(34,197,94,0.2)]' : 'bg-black/50 text-slate-400 border-slate-700 hover:border-slate-500'}`}>Complete</button>
      </div>
      <div className="mt-2 text-center">
         <button onClick={onDelete} className="text-red-500/80 hover:text-red-400 font-bold text-[10px] uppercase tracking-widest w-full py-1.5 transition-colors">Delete Match</button>
      </div>
      <div className="mt-1 border-t border-slate-700 pt-3 flex gap-2 text-xs font-bold">
         <button 
           onClick={onLineupToggle} 
           className={`flex-1 py-2.5 rounded-lg border transition-all uppercase tracking-widest text-[10px] ${match.lineupStatus === 'OUT' ? 'bg-green-500/20 text-green-400 border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]'}`}
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
  onParticipantClick,
  currentUser,
  isAdmin,
  onMakeBotsWin,
  instanceId
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
  currentUser?: any;
  isAdmin?: boolean;
  onMakeBotsWin?: () => void;
  instanceId?: number | null;
}) => {
  const [activeTab, setActiveTab] = useState<'WINNINGS' | 'LEADERBOARD'>('WINNINGS');
  
  const contestTeams = useMemo(() => {
     let filtered = savedTeams.filter(t => t.match?.id === activeMatch?.id && t.contestName === contest.name);
     if (instanceId != null) {
        filtered = filtered.filter(t => typeof t.instanceId === 'number' ? t.instanceId === instanceId : true);
     }
     return filtered;
  }, [savedTeams, activeMatch?.id, contest.name, instanceId]);
  
  // Real-time calculation based on joined teams
  const currentCollected = contestTeams.length * contest.entryFee;
  const totalPrizePool = currentCollected * (winningPercentage / 100);

  // Compute points efficiently (avoiding 1M loop iterations per render for bots)
  const sortedTeams = useMemo(() => {
     // Pre-compute points stringified match since bots share a limited set of variations.
     const memoizedBotPoints: {[key: string]: number} = {};
     
     const teamsWithPoints = contestTeams.map(t => {
        let computedPoints = 0;
        const botKey = (t.userId === 'admin_bot' || t.userId === 'admin_bot_boot') ? `${t.match?.id}_${t.botVariationId || 'old'}_${t.isWinnerBot ? 'win' : 'norm'}` : null;
        
        if (botKey && memoizedBotPoints[botKey] !== undefined) {
           computedPoints = memoizedBotPoints[botKey];
        } else {
           computedPoints = (t.players || []).reduce((acc: number, player: Player) => {
              const livePlayer = appPlayers.find(p => p.id === player.id) || player;
              let mult = 1;
              if (livePlayer.id === t.captain) mult = 2;
              else if (livePlayer.id === t.viceCaptain) mult = 1.5;
              return acc + (livePlayer.points * mult);
           }, 0);
           
           if (t.isWinnerBot) computedPoints += 100000;
           
           if (botKey) memoizedBotPoints[botKey] = computedPoints;
        }
        return { ...t, points: t.points ?? computedPoints };
     });

     // Sort teams by points (if available) for Leaderboard only once
     const sorted = teamsWithPoints.sort((a, b) => (b.points || 0) - (a.points || 0));
     
     // Calculate Dense Ranking: 1, 1, 2, 2, 3...
     let currentRank = 0;
     let lastPoints = -1;
     return sorted.map((team) => {
        const p = team.points || 0;
        if (p !== lastPoints) {
           currentRank++;
           lastPoints = p;
        }
        return { ...team, rank: currentRank };
     });
  }, [contestTeams, appPlayers]);

  const getPayouts = () => {
    if (contest.payouts && contest.payouts.length > 0) {
      return contest.payouts;
    }

    if (contest.type !== 'Mega') {
       return [{ rank: '1', amount: contest.firstPrize || contest.prizeText }];
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
          {activeMatch?.team1?.shortFrame} vs {activeMatch?.team2?.shortFrame}
        </div>
      </header>

      <div className="bg-app-card p-4 shadow-sm z-10 w-full relative">
        <div className="flex justify-between items-start mb-2">
           <div>
             <p className="text-xs text-app-text-muted font-semibold uppercase">Prize Pool</p>
             <p className="text-xl font-black text-app-text">
               {currentCollected > 0 && contest.type === 'Mega' ? `₹${totalPrizePool.toFixed(2)}` : contest.prizeText}
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
        {(isAdmin && activeMatch?.status !== 'Upcoming') ? (
            <button 
               onClick={onMakeBotsWin}
               className="w-full mt-4 py-2 rounded font-bold text-sm text-white transition-transform bg-[#f0b90b] shadow-[0_0_10px_rgba(240,185,11,0.5)] hover:bg-[#dca809] active:scale-[0.98]"
            >
              Set Bots as Winners
            </button>
        ) : (
            <button 
               onClick={onJoin}
               disabled={activeMatch?.status !== 'Upcoming'}
               className={`w-full mt-4 py-2 rounded font-bold text-sm text-white transition-transform ${activeMatch?.status !== 'Upcoming' ? 'bg-slate-400' : 'bg-green-600 hover:bg-green-700 active:scale-[0.98]'}`}
            >
              {activeMatch?.status !== 'Upcoming' ? 'Match Started' : `Join ₹${contest.entryFee}`}
            </button>
        )}
      </div>

      <div className="flex bg-[#ffe2e2] text-[#c94b4b] mt-2 shadow-sm border-b border-[#ffe2e2]/50">
         <button onClick={() => setActiveTab('WINNINGS')} className={`flex-1 py-3 text-sm font-bold text-center border-b-[3px] transition-colors ${activeTab === 'WINNINGS' ? 'border-[#c94b4b] text-[#c94b4b]' : 'border-transparent text-[#c94b4b]/60'}`}>Winning Breakup</button>
         <button onClick={() => setActiveTab('LEADERBOARD')} className={`flex-1 py-3 text-sm font-bold text-center border-b-[3px] transition-colors ${activeTab === 'LEADERBOARD' ? 'border-[#c94b4b] text-[#c94b4b]' : 'border-transparent text-[#c94b4b]/60'}`}>Leaderboard</button>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 bg-app-bg text-app-text">
        {activeTab === 'WINNINGS' ? (
           <div className="space-y-4 p-4">
              {(!contest.payouts || contest.payouts.length === 0) && contest.type === 'Mega' && (
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
           <div className="flex flex-col bg-white dark:bg-app-bg">
               <div className="flex justify-between items-center px-4 py-3 bg-white dark:bg-app-card border-b border-rose-100 dark:border-app-border text-xs font-bold text-[#b8a8a8] dark:text-app-text-muted">
                  <div className="flex items-center gap-1.5 cursor-pointer">
                     <BarChart2 size={16} className="text-[#c94b4b]" />
                     <span>Compare Teams</span>
                  </div>
                  <div className="flex items-center gap-1.5 cursor-pointer text-black dark:text-white">
                     <Download size={14} className="text-[#c94b4b] stroke-[3]" />
                     <span className="font-semibold text-[13px]">Download</span>
                  </div>
               </div>
               <div className="flex justify-between items-center px-4 py-2 text-xs font-bold text-[#b8a8a8] bg-[#ffeaea] dark:bg-app-card-inner border-b border-[#ffe2e2] dark:border-app-border">
                  <span className="flex-1 text-[13px] font-medium text-[#a09090] dark:text-app-text-muted">All Teams({sortedTeams.length})</span>
                  <div className="flex gap-4 w-32 justify-end">
                     <span className="w-12 text-center text-[13px] font-medium text-[#a09090] dark:text-app-text-muted">Points</span>
                     <span className="w-12 text-right text-[13px] font-medium text-[#a09090] dark:text-app-text-muted">#Rank</span>
                  </div>
               </div>
               
               <div className="flex flex-col bg-white dark:bg-app-card relative before:absolute before:inset-0 before:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiAvPgo8Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMSIgZmlsbD0iI2Y1ZjVmNSIgLz4KPC9zdmc+')] dark:before:opacity-5 before:opacity-100 before:bg-repeat before:pointer-events-none">
               {sortedTeams.length > 0 ? (
                  <>
                     {sortedTeams.slice(0, 100).map((t, i) => {
                        const isCurrentUser = currentUser && t.userId === currentUser.id;
                        return (
                        <div 
                           key={i} 
                           onClick={() => onParticipantClick && onParticipantClick(t)}
                           className={`flex justify-between px-4 py-3.5 border-b border-gray-200 dark:border-app-border items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-app-card-hover/50 transition-colors z-10 ${
                              isCurrentUser 
                                ? 'bg-gradient-to-r from-yellow-100/90 via-yellow-50/80 to-transparent dark:from-[#e5c158]/20 dark:to-[#e5c158]/5' 
                                : 'bg-transparent'
                           }`}
                        >
                           <div className="flex items-center gap-4 flex-1">
                              <div className="w-10 h-10 rounded-full bg-slate-400 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-[0_2px_5px_rgba(0,0,0,0.1)]">
                                 <User size={26} className="text-white dark:text-slate-400 translate-y-1.5" />
                              </div>
                              <div className="flex flex-col">
                                 <span className="font-medium text-black dark:text-app-text text-[15px] whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">{t.userName ? `${t.userName}(${t.teamId})` : t.userId ? `${t.userId}(${t.teamId})` : 'Guest Player'}</span>
                                 {t.amountWon > 0 && <span className="text-[10px] text-green-600 dark:text-green-500 font-bold tracking-tight">WON ₹{t.amountWon}</span>}
                              </div>
                           </div>
                           <div className="flex gap-4 w-32 justify-end items-center">
                              <span className="w-12 text-center text-sm text-[#7a7a7a] font-normal">{t.points || 0}</span>
                              <span className="w-12 text-right font-medium text-black dark:text-app-text text-[15px]">{t.rank || (i + 1)}</span>
                           </div>
                        </div>
                        );
                     })}
                     {sortedTeams.length > 100 && (
                        <div className="text-center py-6 text-app-text-muted text-xs font-bold border-t border-app-border z-10 relative">
                           Showing top 100 of {sortedTeams.length.toLocaleString('en-IN')} teams
                        </div>
                     )}
                  </>
               ) : (
                  <div className="p-8 text-center text-app-text-muted text-sm z-10 relative">
                     Empty Leaderboard
                  </div>
               )}
               </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [authInitialized, setAuthInitialized] = useState(false);
  const [user, setUser] = useState<{email: string, id: string, name: string, numericId?: string} | null>(() => {
    const saved = localStorage.getItem('dreamApp_user');
    try { return saved ? JSON.parse(saved) : null; } catch(e) { return null; }
  });

  const isAdmin = user?.email === 'arkingbhartiyavikas@gmail.com';

  const [firestoreQuotaExceeded, setFirestoreQuotaExceeded] = useState(false); // Deprecated
  const [hasDismissedQuota, setHasDismissedQuota] = useState(false);

  const handleFsError = (e: any, operation?: string, path?: string) => {
     console.error(`Supabase wrapper Error [${operation || 'unknown'} @ ${path || 'unknown'}]:`, e);
  };

  useEffect(() => {
    // quota exceeded flag no longer needed since we are on Supabase
  }, []);

  const [appPlayers, setAppPlayers] = useState<Player[]>(() => {
    const saved = localStorage.getItem('dreamApp_players');
    try { 
      const p = JSON.parse(saved); 
      if (!Array.isArray(p) || p.length < 50) return MOCK_PLAYERS;
      // Auto-migrate old team codes
      return p.map(player => {
         const mapping: {[key: string]: string} = {
            'CHE': 'CSK', 'MUM': 'MI', 'BEN': 'RCB', 'KOL': 'KKR',
            'HYD': 'SRH', 'RAJ': 'RR', 'GUJ': 'GT', 'DEL': 'DC',
            'LUC': 'LSG', 'PUN': 'PBKS'
         };
         if (player.team && mapping[player.team]) {
            return { ...player, team: mapping[player.team] };
         }
         return player;
      });
    } catch(e) { return  MOCK_PLAYERS; }
  });

  const [isFirstPlayersLoad, setIsFirstPlayersLoad] = useState(true);

  const lastCloudPlayers = React.useRef<string>('');

  useEffect(() => {
    const currentStr = JSON.stringify(appPlayers);
    localStorage.setItem('dreamApp_players', currentStr);
    // Auto-sync disabled to prevent main_state 1MB errors. 
    // Admin should use "Update Apps & Player" button for cloud sync.
  }, [appPlayers, isAdmin, isFirstPlayersLoad]);

  const [themeMode, setThemeMode] = useState<'Dark' | 'Light'>(() => localStorage.getItem('dreamApp_themeMode') as any || 'Dark');
  const [themeColor, setThemeColor] = useState<'Red' | 'Blue' | 'Green'>(() => localStorage.getItem('dreamApp_themeColor') as any || 'Blue');

  useEffect(() => {
    localStorage.setItem('dreamApp_themeMode', themeMode);
    localStorage.setItem('dreamApp_themeColor', themeColor);
    
    const isLight = themeMode === 'Light';
    const root = document.documentElement;
    root.style.setProperty('--app-bg', isLight ? '#f8fafc' : '#0B1221');
    root.style.setProperty('--app-card', isLight ? '#ffffff' : '#1E293B');
    root.style.setProperty('--app-card-inner', isLight ? '#f1f5f9' : '#151E32');
    root.style.setProperty('--app-card-alt', isLight ? '#e2e8f0' : '#0f172a');
    root.style.setProperty('--app-card-hover', isLight ? '#e2e8f0' : '#1e293b');
    root.style.setProperty('--app-text', isLight ? '#0f172a' : '#ffffff');
    root.style.setProperty('--app-text-muted', isLight ? '#64748b' : '#94a3b8');
    root.style.setProperty('--app-border', isLight ? '#e2e8f0' : '#1e293b');
    root.style.setProperty('--app-border-hover', isLight ? '#cbd5e1' : '#334155');
    root.style.setProperty('--app-accent', themeColor === 'Red' ? '#dc2626' : themeColor === 'Green' ? '#16a34a' : '#2563eb');
  }, [themeMode, themeColor]);

  const [view, setView] = useState<ViewType>('HOME');
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [liveScore, setLiveScore] = useState<string | null>(null);
  const [selectedContest, setSelectedContest] = useState<{fee: number; name: string, id?: string, spots?: number} | null>(null);
  const [activeContestDetails, setActiveContestDetails] = useState<Contest | null>(null);
  const [activeContestInstanceId, setActiveContestInstanceId] = useState<number | null>(null);
  
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP' | 'OTP'>('SIGNUP');
  const [authInput, setAuthInput] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authMobile, setAuthMobile] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [sentOtp, setSentOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [tempFirebaseUser, setTempFirebaseUser] = useState<any>(null);
  const [showPhonePermissionDialog, setShowPhonePermissionDialog] = useState(false);
  const [phonePermissionGranted, setPhonePermissionGranted] = useState(() => localStorage.getItem('dreamApp_phonePermission') === 'true');

  const [winningPercentage, setWinningPercentage] = useState<number>(() => {
    const saved = localStorage.getItem('dreamApp_winningRate');
    return saved ? parseInt(saved) : 60;
  });

  useEffect(() => {
    localStorage.setItem('dreamApp_winningRate', winningPercentage.toString());
  }, [winningPercentage]);

  const [kycRequests, setKycRequests] = useState<any[]>([]);

  const [claimedLevels, setClaimedLevels] = useState<number[]>([]);
  const [claimedLevelsLoaded, setClaimedLevelsLoaded] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      if (claimedLevelsLoaded !== user.id) {
        const saved = localStorage.getItem(`dreamApp_claimedLevels_${user.id}`);
        try {
            const parsed = saved ? JSON.parse(saved) : [];
            setClaimedLevels(Array.isArray(parsed) ? parsed : []);
        } catch(e) {
            setClaimedLevels([]);
        }
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
    // Check for Supabase OAuth errors in URL
    const hash = window.location.hash;
    if (hash && hash.includes('error_description=')) {
      const params = new URLSearchParams(hash.substring(1));
      const errorDesc = params.get('error_description');
      if (errorDesc) {
        alert("Login failed: " + decodeURIComponent(errorDesc).replace(/\+/g, ' '));
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
    
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
       if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
         setAuthInitialized(true);
         const supaUser = session.user;
         
         let numericId = localStorage.getItem(`dreamApp_numericId_${supaUser.id}`) || '';
         if (!numericId) {
             numericId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
             localStorage.setItem(`dreamApp_numericId_${supaUser.id}`, numericId);
         }
         let fullName = supaUser.user_metadata?.full_name || 'Fantasy Player';
         
         localStorage.setItem('dreamApp_hasSignedUp', 'true');
         const newUser = {
           email: supaUser.email || '',
           name: fullName,
           id: supaUser.id,
           numericId: numericId
         };
         
         // Set user immediately so UI updates instantly!
         localStorage.setItem('dreamApp_user', JSON.stringify(newUser));
         setUser(newUser);

         // Sync to Firestore in background without awaiting
         (async () => {
             try {
                 const userDocRef = doc(db, 'users', supaUser.id);
                 const userDoc = await getDoc(userDocRef);
                 if (userDoc.exists()) {
                     const data = userDoc.data();
                     const existingNumericId = data.numericId;
                     
                     if (existingNumericId && existingNumericId !== numericId) {
                        numericId = existingNumericId;
                        localStorage.setItem(`dreamApp_numericId_${supaUser.id}`, existingNumericId);
                        setUser(prev => prev ? {...prev, numericId: existingNumericId, name: data.name || prev.name} : prev);
                     }
                     
                     if (!data.numericId) {
                         await setDoc(userDocRef, { numericId }, { merge: true });
                     }
                 } else {
                     await setDoc(userDocRef, {
                         name: fullName,
                         numericId: numericId,
                         email: supaUser.email || ''
                     });
                 }
             } catch (e) {
                 handleFsError(e, 'fetch_profile', supaUser.id);
             }
         })();
       } else if (event === 'SIGNED_OUT') {
         setUser(null);
       }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthInitialized(true);
      if (firebaseUser) {
        if (sessionStorage.getItem('isSigningUp') === 'true') {
          // Do nothing, let handleAuth complete the setup and sign out
          return;
        }
        
        if (sessionStorage.getItem('isPendingOtp') === 'true') {
           // Wait until OTP is verified. Store the UID temporarily if needed, but do not set 'user'.
           return;
        }
        
        let numericId = localStorage.getItem(`dreamApp_numericId_${firebaseUser.uid}`) || '';
        let fullName = firebaseUser.displayName || 'Fantasy Player';
        
        try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                const data = userDoc.data();
                numericId = data.numericId || numericId || '';
                fullName = data.name || fullName;
                
                // If it existed in local storage but not DB, it's migrating now, but let's just make sure DB is updated
                if (!data.numericId) {
                    if (!numericId) {
                        numericId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
                    }
                    await setDoc(userDocRef, { numericId }, { merge: true });
                }
            } else {
                if (!numericId) {
                    numericId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
                }
                await setDoc(userDocRef, {
                    name: fullName,
                    numericId: numericId,
                    email: firebaseUser.email || ''
                });
            }
        } catch (e) {
            handleFsError(e, 'fetch_profile', firebaseUser.uid);
            if (!numericId) {
                numericId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
            }
        }

        if (numericId) {
            localStorage.setItem(`dreamApp_numericId_${firebaseUser.uid}`, numericId);
        }

        localStorage.setItem('dreamApp_hasSignedUp', 'true');
        const newUser = {
          email: firebaseUser.email || '',
          name: fullName,
          id: firebaseUser.uid,
          numericId: numericId
        };
        localStorage.setItem('dreamApp_user', JSON.stringify(newUser));
        setUser(newUser);
      } else {
        if (!supabase) {
           setUser(null);
        }
      }
    });
    return () => unsubscribe();
  }, []);
  const [wallet, setWallet] = useState<{deposit: number, winning: number, bonus: number, blocked?: boolean, profits?: number, wins?: number}>({ deposit: 0, winning: 0, bonus: 0, profits: 0, wins: 0 });
  const [walletLoadedUser, setWalletLoadedUser] = useState<string | null>(null);

  useEffect(() => {
    if (firestoreQuotaExceeded) return;
    if (!user?.id) {
        setWallet({ deposit: 0, winning: 0, bonus: 0, profits: 0, wins: 0 });
        return;
    }

    let isSubscribed = true;
    
    // Listen to user's wallet
    const unsubWallet = onSnapshot(doc(db, 'wallets', user.id), (docS) => {
        if (docS.exists()) {
             setWallet(docS.data() as any);
        } else {
             // Create initial wallet if doesn't exist
             const init = { deposit: 0, winning: 24, bonus: 100, profits: 0, wins: 0 };
             setDoc(doc(db, 'wallets', user.id), init);
             if (isSubscribed) setWallet(init);
        }
    }, (e) => handleFsError(e, 'listen_wallet', user.id));

    // Listen to deposits
    const depQuery = isAdmin 
      ? collection(db, 'deposits')
      : query(collection(db, 'deposits'), where('userId', '==', user.id));
    const unsubDep = onSnapshot(depQuery, (snap) => {
        if (isSubscribed) setDepositRequests(snap.docs.map(d => d.data() as DepositRequest));
    }, (e) => handleFsError(e, 'listen_deposits'));

    // Listen to withdrawals
    const wdQuery = isAdmin
      ? collection(db, 'withdrawals')
      : query(collection(db, 'withdrawals'), where('userId', '==', user.id));
    const unsubWd = onSnapshot(wdQuery, (snap) => {
        if (isSubscribed) setWithdrawRequests(snap.docs.map(d => d.data() as WithdrawRequest));
    }, (e) => handleFsError(e, 'listen_withdrawals'));

    // Listen to KYC
    const kycQuery = isAdmin
      ? collection(db, 'kyc')
      : query(collection(db, 'kyc'), where('userId', '==', user.id));
    const unsubKyc = onSnapshot(kycQuery, (snap) => {
        if (isSubscribed) setKycRequests(snap.docs.map(d => d.data() as any));
    }, (e) => handleFsError(e, 'listen_kyc'));

    // Listen to Bank Accounts
    const bankQuery = isAdmin
      ? collection(db, 'bankAccounts')
      : query(collection(db, 'bankAccounts'), where('userId', '==', user.id));
    const unsubBank = onSnapshot(bankQuery, (snap) => {
        if (isSubscribed) setBankAccounts(snap.docs.map(d => d.data() as BankAccount));
    }, (e) => handleFsError(e, 'listen_banks'));

    // Optimization: Standard users only listen to their own teams.
    // Admin should NOT listen to the entire userTeams collection in real-time as it kills quota.
    const teamsQuery = query(collection(db, 'userTeams'), where('userId', '==', user.id));

    const unsubUserTeams = onSnapshot(teamsQuery, (snap) => {
        if (!isSubscribed) return;
        const uTeams = snap.docs.map(d => d.data() as any);
        setSavedTeams(prev => {
            const newTeams = [...prev];
            const idMap = new Map(newTeams.map((t, i) => [t.id, i]));
            uTeams.forEach(ut => {
                if (idMap.has(ut.id)) {
                    newTeams[idMap.get(ut.id)!] = ut;
                } else {
                    newTeams.push(ut);
                    idMap.set(ut.id, newTeams.length - 1);
                }
            });
            return newTeams;
        });
    }, (e) => handleFsError(e, 'listen_teams', 'userTeams'));

    let unsubAdminUsers = () => {};
    let unsubAdminUserMeta = () => {};
    if (isAdmin && view === 'ADMIN' && !firestoreQuotaExceeded) {
        let metaDocs: Record<string, any> = {};
        let walletDocs: Record<string, any> = {};
        const updateList = () => {
             // Create a set of all unique UIDs from both users and wallets
             const allUids = new Set([...Object.keys(metaDocs), ...Object.keys(walletDocs)]);
             
             const list = Array.from(allUids).map(k => {
                  // If k is a numeric ID (10 digits), it's likely an orphaned wallet doc
                  // from an older version. We should try to find which UID it belongs to.
                  let data = { 
                      id: k,
                      ...walletDocs[k],
                      ...(metaDocs[k] || {})
                  };
                  
                  // If this is a numeric ID wallet, we might want to flag it or merge it
                  // But for now, let's just make sure the list is clean.
                  // Prefer entries that have metadata (names, etc)
                  return data;
             }).filter(u => {
                 // Hide numeric ID wallets if we have a real UID user for them
                 if (/^\d{10}$/.test(u.id)) {
                     const realUser = Object.values(metaDocs).find((m: any) => m.numericId === u.id);
                     if (realUser) return false; // Skip this numeric entry, it will be merged into the UID one
                 }
                 return true;
             }).map(u => {
                 // For real UID users, if they have a numeric ID, try to pull data from that numeric wallet if the UID wallet is empty
                 if (u.numericId && (!u.deposit && !u.winning && !u.bonus)) {
                     const legacyWallet = walletDocs[u.numericId];
                     if (legacyWallet) {
                         return { ...u, ...legacyWallet };
                     }
                 }
                 return u;
             });
             setAdminUserList(list);
        };
        const fetchAdminData = async () => {
          try {
            const [wSnap, uSnap] = await Promise.all([
               getDocs(collection(db, 'wallets')),
               getDocs(collection(db, 'users'))
            ]);
            wSnap.docs.forEach(d => { walletDocs[d.id] = d.data(); });
            uSnap.docs.forEach(d => { metaDocs[d.id] = d.data(); });
            if (isSubscribed) updateList();
          } catch (e: any) {
             handleFsError(e, 'admin_fetch');
          }
        };
        fetchAdminData();
    }

    return () => { 
        isSubscribed = false;
        unsubWallet(); 
        unsubDep(); 
        unsubWd(); 
        unsubKyc(); 
        unsubBank();
        unsubUserTeams();
        unsubAdminUsers();
        unsubAdminUserMeta();
    };
  }, [user?.id, isAdmin, firestoreQuotaExceeded, view]);

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
         // Perform DB sync OUTSIDE the setter to avoid repeated calls and side-effects in render cycle
         setTimeout(() => {
             if (user?.id) {
                // Call our standard backend triple-sync
                fetch('/api/sync', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    collection: 'wallets',
                    id: user.id,
                    data: next
                  })
                }).catch(e => {
                  console.error("Triple-sync error:", e);
                  // Optional fallback
                  setDoc(doc(db, 'wallets', user.id), next, { merge: true }).catch(err => {
                    handleFsError(err, 'sync_wallet_local', user.id);
                  });
                });
             }
         }, 10);
         return next;
     });
  };

  const balance = (wallet.deposit || 0) + (wallet.winning || 0) + (wallet.bonus || 0);

  const setBalance = (updater: number | ((prev: number) => number)) => {
    updateWallet((prev: any) => {
      const currentTotal = (prev.deposit || 0) + (prev.winning || 0) + (prev.bonus || 0);
      let newTotal = typeof updater === 'function' ? updater(currentTotal) : updater;
      // Safety bounds to prevent NaN
      if (isNaN(newTotal) || !isFinite(newTotal)) newTotal = 0;
      const diff = newTotal - currentTotal;
      if (diff > 0) return { ...prev, deposit: (prev.deposit || 0) + diff };
      let rem = -diff;
      let bon = prev.bonus || 0;
      if (rem > 0 && bon > 0) { const d = Math.min(rem, bon); bon -= d; rem -= d; }
      let dep = prev.deposit || 0;
      if (rem > 0 && dep > 0) { const d = Math.min(rem, dep); dep -= d; rem -= d; }
      let win = prev.winning || 0;
      if (rem > 0 && win > 0) { const d = Math.min(rem, win); win -= d; rem -= d; }
      return { ...prev, deposit: Math.max(0, dep), winning: win, bonus: bon };
    });
  };
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [adminUPI, setAdminUPI] = useState<string>('');
  const [adminUpiQR, setAdminUpiQR] = useState<string>('');

  useEffect(() => {
     if (firestoreQuotaExceeded) return;
     const unsubSettings = onSnapshot(doc(db, 'gameData', 'settings'), (docS) => {
         if (docS.exists()) {
             const data = docS.data();
             if (data.adminUPI) setAdminUPI(data.adminUPI);
             if (data.adminUpiQR) setAdminUpiQR(data.adminUpiQR);
         }
     }, (e) => handleFsError(e, 'listen_settings'));
     return () => unsubSettings();
  }, [firestoreQuotaExceeded]);

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
                <div className="text-2xl font-bold">₹{Number(wallet.winning || 0).toLocaleString('en-IN', {maximumFractionDigits:0})}</div>
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
                    <p className="text-xs text-gray-400 mt-1">{String(bank.accountNumber).substring(0, 4)}XXXXXXX (IFSC: {bank.ifscCode})</p>
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
                userNumericId: user?.numericId,
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
  const [adminUserList, setAdminUserList] = useState<any[]>([]);





  const [savedTeams, setSavedTeams] = useState<any[]>(() => {
    const saved = localStorage.getItem('dreamApp_teams');
    if (saved) {
        let parsed;
        try { parsed = JSON.parse(saved); if (!Array.isArray(parsed)) parsed = []; } catch(e) { parsed = []; }
        
        const expanded: any[] = [];
        const BOT_NAMES = ['Rahul', 'Amit', 'Rohit', 'Virat', 'Mahi', 'Suresh', 'Dinesh', 'Sachin', 'Kapil', 'Virender', 'Ravi', 'Ramesh', 'Sanjay', 'Vicky', 'Raju'];
        
        parsed.forEach((t: any) => {
            if (t.isBulkBot) {
               for(let i=0; i<t.bulkCount; i++) {
                   expanded.push({
                      ...t,
                      id: Date.now().toString() + Math.random().toString(36).substring(2, 5) + i,
                      teamId: t.userId === 'admin_bot_boot' ? `BOT-${Date.now().toString().slice(-4)}${i}` : `T${Math.floor(Math.random() * 8999) + 1000}`,
                      userName: t.userId === 'admin_bot_boot' ? `BOOT ${Date.now().toString().slice(-3)}${i}` : BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + Math.floor(Math.random() * 9999).toString(),
                      isBulkBot: undefined,
                      bulkCount: undefined
                   });
               }
            } else {
               if (t.userId === 'admin_bot' && t.userName?.startsWith('BOOT')) {
                   t.userName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + Math.floor(Math.random() * 9999).toString();
                   t.teamId = `T${Math.floor(Math.random() * 8999) + 1000}`;
               }
               expanded.push(t);
            }
        });
        return expanded;
    }
    return [];
  });
  const [appContests, setAppContests] = useState<Contest[]>(() => {
    const saved = localStorage.getItem('dreamApp_contests');
    try { const p = JSON.parse(saved); return Array.isArray(p) ? p :  DEFAULT_CONTESTS; } catch(e) { return  DEFAULT_CONTESTS; }
  });
  const [appMatches, setAppMatches] = useState<Match[]>(() => {
    const saved = localStorage.getItem('dreamApp_matches');
    try { 
        const p = JSON.parse(saved); 
        if (Array.isArray(p)) {
            // Filter out old mock matches so they disappear from existing clients
            return p.filter(m => !['m1', 'm2', 'm3'].includes(m.id));
        }
        return DEFAULT_MATCHES; 
    } catch(e) { 
        return DEFAULT_MATCHES; 
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('dreamApp_user', JSON.stringify(user));
    } else if (authInitialized) {
      localStorage.removeItem('dreamApp_user');
    }
  }, [user, authInitialized]);



  useEffect(() => {
    try {
      const botsToCount: {[key: string]: any} = {};
      const normalTeams: any[] = [];
      
      savedTeams.forEach(t => {
         if (t.userId === 'admin_bot' || t.userId === 'admin_bot_boot') {
             const key = `${t.match?.id}_${t.contestName}_${t.userId}`;
             if (!botsToCount[key]) {
                 botsToCount[key] = { ...t, isBulkBot: true, bulkCount: 0 };
                 delete botsToCount[key].id;
                 delete botsToCount[key].userName;
             }
             botsToCount[key].bulkCount++;
         } else {
             normalTeams.push(t);
         }
      });
      const dataToSave = [...normalTeams, ...Object.values(botsToCount)];
      localStorage.setItem('dreamApp_teams', JSON.stringify(dataToSave));
    } catch (e) {
      console.error("Storage limit reached for teams!", e);
      if (savedTeams.length > 2000) alert("Too many BOTs! Device storage is full. Please remove some bots.");
    }
  }, [savedTeams]);



  useEffect(() => {
    localStorage.setItem('dreamApp_contests', JSON.stringify(appContests));
  }, [appContests]);

  useEffect(() => {
    localStorage.setItem('dreamApp_matches', JSON.stringify(appMatches));
  }, [appMatches]);

  const lastLoadTs = useRef(0);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (firestoreQuotaExceeded) return;

    const loadCategoryInChunks = async (key: string) => {
      if (firestoreQuotaExceeded) return null;
      try {
        const metaDoc = await getDoc(doc(db, 'gameData', `${key}_meta`));
        if (metaDoc.exists()) {
          const { count } = metaDoc.data();
          if (count === 0) return [];
          
          const promises = [];
          for (let i = 0; i < count; i++) {
            promises.push(getDoc(doc(db, 'gameData', `${key}_chunk_${i}`)));
          }
          const chunkDocs = await Promise.all(promises);
          return chunkDocs.flatMap(d => d.exists() ? d.data().data : []);
        }
      } catch (e: any) { 
        handleFsError(e, `load_${key}`);
      }
      return null;
    };

    const unsubSyncMeta = onSnapshot(doc(db, 'gameData', 'sync_meta'), async (snap) => {
      if (!snap.exists()) return;
      const metaData = snap.data();
      const stype = metaData.type || 'all';
      const curTs = metaData.lastUpdate || 0;
      
      // Critical optimization: ignore updates we already have
      if (!isInitialLoad.current && curTs <= lastLoadTs.current) return;
      lastLoadTs.current = curTs;
      isInitialLoad.current = false;
      
      const reloadBots = async () => {
          const adminTeamsData = await loadCategoryInChunks('adminTeams');
          if (adminTeamsData) {
              setSavedTeams(prev => {
                const userTeams = prev.filter(t => t.userId !== 'admin_bot' && t.userId !== 'admin_bot_boot');
                const newTeams = [...userTeams, ...adminTeamsData];
                return Array.from(new Map(newTeams.map(item => [item.id, item])).values());
              });
          }
      };

      if (stype === 'bots') {
          await reloadBots();
          return;
      }

      try {
        const [matchesData, contestsData, playersData, adminTeamsData] = await Promise.all([
            loadCategoryInChunks('matches'),
            loadCategoryInChunks('contests'),
            loadCategoryInChunks('players'),
            loadCategoryInChunks('adminTeams')
        ]);

        if (matchesData && matchesData.length > 0) setAppMatches(matchesData);
        if (contestsData && contestsData.length > 0) setAppContests(contestsData);
        
        if (playersData) {
            const dataStr = JSON.stringify(playersData);
            setAppPlayers(prev => {
                if (JSON.stringify(prev) !== dataStr) {
                    lastCloudPlayers.current = dataStr;
                    return playersData;
                }
                return prev;
            });
        }
        if (adminTeamsData) {
            setSavedTeams(prev => {
              const userTeams = prev.filter(t => t.userId !== 'admin_bot' && t.userId !== 'admin_bot_boot');
              const newTeams = [...userTeams, ...adminTeamsData];
              const uniqueTeams = Array.from(new Map(newTeams.map(item => [item.id, item])).values());
              return uniqueTeams;
            });
        }
      } catch (e: any) {
         if (e.message?.includes('quota')) {
            console.error("Sync blocked by Quota limits.");
         }
      }
    }, (error) => {
       if (error.message?.includes('quota')) {
          console.warn("Real-time sync paused: Quota limit reached.");
       }
    });

    const unsubBanners = onSnapshot(doc(db, 'gameData', 'banners'), (snap) => {
      if (snap.exists()) {
        const data = snap.data().data;
        if (Array.isArray(data)) setAppBanners(data);
      }
    }, (e) => handleFsError(e, 'listen_banners'));

    // Fallback for older data structure or backward compatibility
    const unsubMain = onSnapshot(doc(db, 'gameData', 'main_state'), (snapshot) => {
        if (snapshot.exists()) {
             const data = snapshot.data();
             // Only fallback for players/banners if chunked sync not ready
             if (!lastCloudPlayers.current && data.players && Array.isArray(data.players)) {
                 setAppPlayers(data.players);
             }
        }
    }, (e) => handleFsError(e, 'listen_main_fallback'));

    // Listen to real-time points updates from admin
    const unsubPoints = onSnapshot(doc(db, 'gameData', 'live_player_points'), (snapshot) => {
        if (snapshot.exists()) {
             const livePts = snapshot.data();
             if (livePts) {
                 setAppPlayers(prev => {
                     let changed = false;
                     const newPlayers = prev.map(p => {
                         if (livePts[p.id] !== undefined && p.points !== livePts[p.id]) {
                             changed = true;
                             return { ...p, points: livePts[p.id] };
                         }
                         return p;
                     });
                     return changed ? newPlayers : prev;
                 });
             }
        }
    }, (e) => handleFsError(e, 'listen_live_points'));

    return () => {
      unsubSyncMeta();
      unsubBanners();
      unsubMain();
      unsubPoints();
    };
  }, [firestoreQuotaExceeded]);

  const distributePrizes = async (matchId: string) => {
    if (firestoreQuotaExceeded) {
       console.error("Cannot distribute prizes: Firestore quota exceeded.");
       return;
    }
    let anyWonInfo = "";
    
    // Calculate off the latest state directly. Since it's a synchronous map to build the batch, it's fine.
    setSavedTeams(currentTeams => {
        const updatedTeams = [...currentTeams];
        const matchTeams = updatedTeams.filter(t => t.match?.id === matchId && !t.prizeDistributed);
        if(matchTeams.length === 0) return currentTeams;

        const contestNames = Array.from(new Set(matchTeams.map(t => t.contestName)));
        
        let localBalanceUpdate = 0;
        let localWinCount = 0;
        let platformProfit = 0;
        
        const batch = writeBatch(db);
        let batchCount = 0;
        
        contestNames.forEach(cName => {
            const contestTeams = matchTeams.filter(t => t.contestName === cName);
            const contest = appContests.find(c => c.name === cName) || DEFAULT_CONTESTS[0];
            
            const currentCollected = contestTeams.length * contest.entryFee;
            const totalPrizePool = currentCollected * (winningPercentage / 100);
            
            let contestProfit = currentCollected;

            // calculate points with memoization logic for bots
            const memoizedBotPoints: {[key: string]: number} = {};
            const teamsWithPoints = contestTeams.map(t => {
                let computedPoints = 0;
                const botKey = t.userId === 'admin_bot' || t.userId === 'admin_bot_boot' ? t.match?.id : null;
                
                if (botKey && memoizedBotPoints[botKey] !== undefined) {
                   computedPoints = memoizedBotPoints[botKey];
                } else {
                   computedPoints = (t.players || []).reduce((acc: number, player: Player) => {
                      const livePlayer = appPlayers.find(p => p.id === player.id) || player;
                      let mult = 1;
                      if (livePlayer.id === t.captain) mult = 2;
                      else if (livePlayer.id === t.viceCaptain) mult = 1.5;
                      return acc + (livePlayer.points * mult);
                   }, 0);
                   if (botKey) memoizedBotPoints[botKey] = computedPoints;
                }
                return { ...t, points: computedPoints, _ref: t };
            });

            // sort by points
            const sortedTeams = [...teamsWithPoints].sort((a, b) => (b.points || 0) - (a.points || 0));

            // Generate payouts
            let payouts = contest.payouts && contest.payouts.length > 0 ? [...contest.payouts] : [];
            if (payouts.length === 0 && contestTeams.length > 0) {
               if (contest.type !== 'Mega') {
                  payouts = [{ rank: '1', amount: contest.firstPrize || contest.prizeText }];
               } else {
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
            }

            let currentRank = 0;
            let lastPoints = -1;
            sortedTeams.forEach((t) => {
                const p = t.points || 0;
                if (p !== lastPoints) {
                    currentRank++;
                    lastPoints = p;
                }
                const rank = currentRank;
                let amt = 0;
                const payoutStr = payouts.find(p => {
                    const r = p.rank.toString().replace('#', '').trim();
                    if(r.includes('-')) {
                        const [start, end] = r.split('-').map(Number);
                        return rank >= start && rank <= end;
                    }
                    return parseInt(r) === rank;
                });

                if (payoutStr) {
                   amt = typeof payoutStr.amount === 'number' ? payoutStr.amount : parseFloat(payoutStr.amount.toString().replace(/[^0-9.]/g, ''));
                   if (amt) {
                       if (t.userId === user?.id) {
                           localBalanceUpdate += amt;
                           localWinCount++;
                           anyWonInfo += `\n- Team ${t.teamId} in ${cName}: Won ₹${amt.toFixed(2)}`;
                           contestProfit -= amt;
                       } else if (t.userId === 'admin_bot' || t.userId === 'admin_bot_boot') {
                           // Bot won. Prize money stays with platform
                       } else {
                           contestProfit -= amt;
                       }
                   } else { amt = 0; }
                }

                t._ref.prizeDistributed = true;
                t._ref.amountWon = amt;
                t._ref.rank = rank;
                
                if (t.userId && t.userId !== 'admin_bot' && t.userId !== 'admin_bot_boot' && t.userId !== 'guest') {
                   // Add to firestore batch
                   const teamRef = doc(db, 'userTeams', t.id);
                   batch.set(teamRef, { prizeDistributed: true, amountWon: amt, rank: rank }, { merge: true });
                   batchCount++;
                   if (amt > 0) {
                       const wRef = doc(db, 'wallets', t.userId);
                       batch.set(wRef, { winning: increment(amt) }, { merge: true });
                       batchCount++;
                   }
                }
            });
            platformProfit += contestProfit;
        });

        // Async commit the batch after updating state
        if (batchCount > 0) {
            batch.commit().catch(e => console.error("Error distributing prizes to DB:", e));
        }
        
        if (isAdmin && user?.id) {
            localBalanceUpdate += platformProfit;
            if (platformProfit > 0) {
               anyWonInfo += `\n\n💰 Bot & Platform Profit: ₹${platformProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
            }
        }
        
        if (localBalanceUpdate > 0 && user?.id) {
           updateWallet((prev: any) => ({ ...prev, winning: prev.winning + localBalanceUpdate, profits: (prev.profits || 0) + localBalanceUpdate, wins: (prev.wins || 0) + localWinCount }));
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
  const [adminContestType, setAdminContestType] = useState<'Mega' | 'H2H' | 'H2H_3' | 'H2H_4' | 'H2H_5'>('Mega');
  const [adminTab, setAdminTab] = useState<'DASHBOARD' | 'MATCHES' | 'CONTESTS' | 'USERS' | 'SETTINGS' | 'TEAMS' | 'BANNERS' | 'ENTRY FEES' | 'FINANCIALS'>('DASHBOARD');
  const [showDashboardUsers, setShowDashboardUsers] = useState<boolean>(false);
  const [adminContestName, setAdminContestName] = useState<string>('');
  const [adminContestPrize, setAdminContestPrize] = useState<string>('');
  const [adminContestEntry, setAdminContestEntry] = useState<string>('');
  const [adminContestSpots, setAdminContestSpots] = useState<string>('5000000');
  const [adminPlatformMargin, setAdminPlatformMargin] = useState<string>('20');
  const [adminWinnersPercent, setAdminWinnersPercent] = useState<string>('48');
  const [adminFirstPrizePercent, setAdminFirstPrizePercent] = useState<string>('15');
  const [adminContestAutoPayouts, setAdminContestAutoPayouts] = useState<boolean>(true);
  const [adminCustomPayouts, setAdminCustomPayouts] = useState<{rankFrom: string, rankTo: string, amount: string}[]>([{rankFrom: '1', rankTo: '1', amount: ''}]);
  const [adminAutoFillRemaining, setAdminAutoFillRemaining] = useState<boolean>(true);
  
  // Admin Match Creation State
  const [adminMatchT1, setAdminMatchT1] = useState<string>('');
  const [adminMatchT2, setAdminMatchT2] = useState<string>('');
  
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today); dayAfter.setDate(dayAfter.getDate() + 2);
  
  const formatDateISO = (d: Date) => d.toISOString().split('T')[0];
  const [adminMatchDate, setAdminMatchDate] = useState<string>(formatDateISO(today));
  const [adminMatchTimeValue, setAdminMatchTimeValue] = useState<string>('20:00'); // 8 PM default

  // Custom Match Creation State
  const [showCustomMatch, setShowCustomMatch] = useState<boolean>(false);
  const [showMatchList, setShowMatchList] = useState<boolean>(false);
  const [matchListSeries, setMatchListSeries] = useState<string>('IPL');
  const [matchListT1Name, setMatchListT1Name] = useState<string>('');
  const [matchListT1Code, setMatchListT1Code] = useState<string>('');
  const [matchListT2Name, setMatchListT2Name] = useState<string>('');
  const [matchListT2Code, setMatchListT2Code] = useState<string>('');
  const [matchListPlayers, setMatchListPlayers] = useState<any[]>([]);
  const [mlPlayerName, setMlPlayerName] = useState<string>('');
  const [mlPlayerRole, setMlPlayerRole] = useState<string>('BAT');
  const [mlPlayerTeam, setMlPlayerTeam] = useState<number>(1);
  const [mlPlayerCredits, setMlPlayerCredits] = useState<number>(8.5);
  const [showPlayerScoring, setShowPlayerScoring] = useState<boolean>(false);
  const [adminScoringLiveMatchId, setAdminScoringLiveMatchId] = useState<string | null>(null);
  const [playerScoringSearch, setPlayerScoringSearch] = useState<string>('');
  const [updateSuccessIds, setUpdateSuccessIds] = useState<Record<string, boolean>>({});
  const [playerAdjustments, setPlayerAdjustments] = useState<{[key: string]: { adjustment: number, manual: number, reason: string}}>({});
  
  const [selectedKycRequest, setSelectedKycRequest] = useState<any>(null);
  const [customSeries, setCustomSeries] = useState<string>('ICC T20 WORLD CUP 2026');
  const [customTeam1Name, setCustomTeam1Name] = useState<string>('India');
  const [customTeam1Code, setCustomTeam1Code] = useState<string>('IND');
  const [customTeam2Name, setCustomTeam2Name] = useState<string>('Pakistan');
  const [customTeam2Code, setCustomTeam2Code] = useState<string>('PAK');
  const defaultT1Players = [
    { name: 'Virat Kohli', role: 'BAT' },
    { name: 'Rohit Sharma', role: 'BAT' },
    { name: 'Rishabh Pant', role: 'WK' },
    { name: 'KL Rahul', role: 'BAT' },
    { name: 'Hardik Pandya', role: 'AR' },
    { name: 'Ravindra Jadeja', role: 'AR' },
    { name: 'Jasprit Bumrah', role: 'BOWL' },
    { name: 'Mohammed Siraj', role: 'BOWL' },
    { name: 'Kuldeep Yadav', role: 'BOWL' },
    { name: 'Suryakumar Yadav', role: 'BAT' },
    { name: 'Axar Patel', role: 'AR' },
  ];
  const defaultT2Players = [
    { name: 'Babar Azam', role: 'BAT' },
    { name: 'Mohammad Rizwan', role: 'WK' },
    { name: 'Fakhar Zaman', role: 'BAT' },
    { name: 'Shaheen Afridi', role: 'BOWL' },
    { name: 'Shadab Khan', role: 'AR' },
    { name: 'Haris Rauf', role: 'BOWL' },
    { name: 'Iftikhar Ahmed', role: 'BAT' },
    { name: 'Mohammad Nawaz', role: 'AR' },
    { name: 'Naseem Shah', role: 'BOWL' },
    { name: 'Imam-ul-Haq', role: 'BAT' },
    { name: 'Hasan Ali', role: 'BOWL' }
  ];

  const [customTeam1Players, setCustomTeam1Players] = useState<{name: string, role: string}[]>(defaultT1Players);
  const [customTeam2Players, setCustomTeam2Players] = useState<{name: string, role: string}[]>(defaultT2Players);

  const [editModeT1, setEditModeT1] = useState(false);
  const [editModeT2, setEditModeT2] = useState(false);
  const [showAddPlayerT1, setShowAddPlayerT1] = useState(false);
  const [showAddPlayerT2, setShowAddPlayerT2] = useState(false);
  const [newPlayerNameT1, setNewPlayerNameT1] = useState('');
  const [newPlayerRoleT1, setNewPlayerRoleT1] = useState('BAT');
  const [newPlayerNameT2, setNewPlayerNameT2] = useState('');
  const [newPlayerRoleT2, setNewPlayerRoleT2] = useState('BAT');

  const [customMatchDate, setCustomMatchDate] = useState<string>(formatDateISO(today));
  const [customMatchTime, setCustomMatchTime] = useState<string>('19:30');
  const [customMatchPrize, setCustomMatchPrize] = useState<string>('₹50 Cr');


  const [adminMatchTime, setAdminMatchTime] = useState<string>('');
  const [adminMatchPrize, setAdminMatchPrize] = useState<string>('');
  const [showManageMatches, setShowManageMatches] = useState<boolean>(false);
  const [showManageContests, setShowManageContests] = useState<boolean>(false);
  const [showManageUserTeams, setShowManageUserTeams] = useState<boolean>(false);
  const [showApiSync, setShowApiSync] = useState<boolean>(false);
  const [apiMatches, setApiMatches] = useState<any[]>([]);
  const [isFetchingApi, setIsFetchingApi] = useState<boolean>(false);
  const [adminTeamEditMatchId, setAdminTeamEditMatchId] = useState<string | null>(null);
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');
  const [matchTab, setMatchTab] = useState<'Contests' | 'My Contests' | 'My Teams'>('Contests');
  const [showManagePlayers, setShowManagePlayers] = useState<boolean>(false);
  const [adminExpandedPlayerId, setAdminExpandedPlayerId] = useState<string | null>(null);
  const [adminLiveMatchId, setAdminLiveMatchId] = useState<string | null>(null);
  const [adminUpcomingLineupMatchId, setAdminUpcomingLineupMatchId] = useState<string | null>(null);
  const [showManageLineups, setShowManageLineups] = useState<boolean>(false);
  const [isAdminBotEditMode, setIsAdminBotEditMode] = useState<string | null>(null);
  const [botInputAuto, setBotInputAuto] = useState<{ [contestId: string]: string }>({});
  const [botInputBoot, setBotInputBoot] = useState<{ [contestId: string]: string }>({});

  const [expandedBotsContest, setExpandedBotsContest] = useState<string | null>(null);
  const [myMatchesTab, setMyMatchesTab] = useState<'Upcoming' | 'Live' | 'Completed'>('Upcoming');

  // Payment & Edit State
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showAdminQuickAdd, setShowAdminQuickAdd] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('100');
  const [paymentMethod, setPaymentMethod] = useState<'Google Pay' | 'PhonePe' | 'Paytm' | ''>('');
  const [paymentUtr, setPaymentUtr] = useState<string>('');
  const [isScanningPayment, setIsScanningPayment] = useState<boolean>(false);
  const [editingSavedTeamIndex, setEditingSavedTeamIndex] = useState<number | null>(null);
  const [editReturnView, setEditReturnView] = useState<'ADMIN' | 'MY_MATCHES'>('ADMIN');

  const [showManageDeposits, setShowManageDeposits] = useState<boolean>(false);
  const [showManageWithdrawals, setShowManageWithdrawals] = useState<boolean>(false);
  const [showManageKYC, setShowManageKYC] = useState<boolean>(false);
  
  const [showManageUsers, setShowManageUsers] = useState<boolean>(false);
  const [searchUserId, setSearchUserId] = useState<string>('');
  const [adminProfileModalUser, setAdminProfileModalUser] = useState<any | null>(null);

  // Real-time listener for the user being edited in the admin modal
  useEffect(() => {
    if (!adminProfileModalUser || !adminProfileModalUser.id || firestoreQuotaExceeded) return;
    
    // Subscribe to the wallet of the user being edited to ensure real-time balance updates
    const unsub = onSnapshot(doc(db, 'wallets', adminProfileModalUser.id), (docS) => {
      if (docS.exists()) {
        const walletData = docS.data();
        // Use functional update to avoid stale state issues
        setAdminProfileModalUser(prev => prev && prev.id === adminProfileModalUser.id ? { ...prev, ...walletData } : prev);
      }
    }, (e) => handleFsError(e, 'listen_modal_wallet', adminProfileModalUser.id));
    
    return () => unsub();
  }, [adminProfileModalUser?.id, firestoreQuotaExceeded]);
  const [walletSaveStatus, setWalletSaveStatus] = useState<{[key: string]: 'idle' | 'saving' | 'success'}>({});
  const [isSearchingUser, setIsSearchingUser] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // Teams Management State
  const [appFormats, setAppFormats] = useState<string[]>(() => {
      const saved = localStorage.getItem('dreamApp_formats');
      try { const p = JSON.parse(saved); return Array.isArray(p) ? p :  ['T20', 'ODI', 'Test', 'IPL']; } catch(e) { return  ['T20', 'ODI', 'Test', 'IPL']; }
  });
  useEffect(() => {
    localStorage.setItem('dreamApp_formats', JSON.stringify(appFormats));
  }, [appFormats]);

  const [appTeamsList, setAppTeamsList] = useState<{id: string, name: string, shortName: string, color: string, format: string, flagUrl?: string, flagFit?: 'cover' | 'contain'}[]>(() => {
      const saved = localStorage.getItem('dreamApp_teamsList');
      try { const p = JSON.parse(saved); return Array.isArray(p) ? p :  [
         // --- IPL TEAMS ---
         { id: 'it1', name: 'Chennai Super Kings', shortName: 'CSK', color: 'bg-yellow-500', format: 'IPL' },
         { id: 'it2', name: 'Mumbai Indians', shortName: 'MI', color: 'bg-blue-600', format: 'IPL' },
         { id: 'it3', name: 'Royal Challengers Bangalore', shortName: 'RCB', color: 'bg-red-600', format: 'IPL' },
         { id: 'it4', name: 'Kolkata Knight Riders', shortName: 'KKR', color: 'bg-purple-800', format: 'IPL' },
         { id: 'it5', name: 'Sunrisers Hyderabad', shortName: 'SRH', color: 'bg-orange-500', format: 'IPL' },
         { id: 'it6', name: 'Rajasthan Royals', shortName: 'RR', color: 'bg-pink-600', format: 'IPL' },
         { id: 'it7', name: 'Gujarat Titans', shortName: 'GT', color: 'bg-slate-800', format: 'IPL' },
         { id: 'it8', name: 'Delhi Capitals', shortName: 'DC', color: 'bg-blue-800', format: 'IPL' },
         { id: 'it9', name: 'Lucknow Super Giants', shortName: 'LSG', color: 'bg-blue-400', format: 'IPL' },
         { id: 'it10', name: 'Punjab Kings', shortName: 'PBKS', color: 'bg-red-500', format: 'IPL' },
         
         // --- T20 INTERNATIONAL ---
         { id: 't1', name: 'India', shortName: 'IND', color: 'bg-blue-600', format: 'T20' },
         { id: 't2', name: 'Pakistan', shortName: 'PAK', color: 'bg-green-600', format: 'T20' },
         { id: 't3', name: 'England', shortName: 'ENG', color: 'bg-red-600', format: 'T20' },
         { id: 't4', name: 'Australia', shortName: 'AUS', color: 'bg-yellow-500', format: 'T20' },
         { id: 't5', name: 'New Zealand', shortName: 'NZ', color: 'bg-slate-800', format: 'T20' },
         { id: 't6', name: 'West Indies', shortName: 'WI', color: 'bg-[#7B1346]', format: 'T20' }
      ]; } catch(e) { return  [
         { id: 'it1', name: 'Chennai Super Kings', shortName: 'CSK', color: 'bg-yellow-500', format: 'IPL' },
         { id: 'it2', name: 'Mumbai Indians', shortName: 'MI', color: 'bg-blue-600', format: 'IPL' },
         { id: 'it3', name: 'Royal Challengers Bangalore', shortName: 'RCB', color: 'bg-red-600', format: 'IPL' },
         { id: 'it4', name: 'Kolkata Knight Riders', shortName: 'KKR', color: 'bg-purple-800', format: 'IPL' },
         { id: 'it5', name: 'Sunrisers Hyderabad', shortName: 'SRH', color: 'bg-orange-500', format: 'IPL' },
         { id: 'it6', name: 'Rajasthan Royals', shortName: 'RR', color: 'bg-pink-600', format: 'IPL' },
         { id: 'it7', name: 'Gujarat Titans', shortName: 'GT', color: 'bg-slate-800', format: 'IPL' },
         { id: 'it8', name: 'Delhi Capitals', shortName: 'DC', color: 'bg-blue-800', format: 'IPL' },
         { id: 'it9', name: 'Lucknow Super Giants', shortName: 'LSG', color: 'bg-blue-400', format: 'IPL' },
         { id: 'it10', name: 'Punjab Kings', shortName: 'PBKS', color: 'bg-red-500', format: 'IPL' },
         { id: 't1', name: 'India', shortName: 'IND', color: 'bg-blue-600', format: 'T20' },
         { id: 't2', name: 'Pakistan', shortName: 'PAK', color: 'bg-green-600', format: 'T20' },
         { id: 't3', name: 'England', shortName: 'ENG', color: 'bg-red-600', format: 'T20' },
         { id: 't4', name: 'Australia', shortName: 'AUS', color: 'bg-yellow-500', format: 'T20' },
         { id: 't5', name: 'New Zealand', shortName: 'NZ', color: 'bg-slate-800', format: 'T20' },
         { id: 't6', name: 'West Indies', shortName: 'WI', color: 'bg-[#7B1346]', format: 'T20' }
      ]; }
  });
  useEffect(() => {
    localStorage.setItem('dreamApp_teamsList', JSON.stringify(appTeamsList));
  }, [appTeamsList]);

  const [appBanners, setAppBanners] = useState<{id: string, imageUrl: string, linkUrl?: string}[]>(() => {
    const saved = localStorage.getItem('dreamApp_banners');
    try { const p = JSON.parse(saved); return Array.isArray(p) ? p :  [
       { id: 'b1', imageUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200&auto=format&fit=crop', linkUrl: '' }
    ]; } catch(e) { return  [
       { id: 'b1', imageUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200&auto=format&fit=crop', linkUrl: '' }
    ]; }
  });
  useEffect(() => {
    localStorage.setItem('dreamApp_banners', JSON.stringify(appBanners));
  }, [appBanners]);

  const [selectedFormat, setSelectedFormat] = useState<string>('T20');
  const [showAddFormatModal, setShowAddFormatModal] = useState(false);
  const [newFormatName, setNewFormatName] = useState('');
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamShort, setNewTeamShort] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('bg-blue-600');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [showTeamAddPlayerModal, setShowTeamAddPlayerModal] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerRole, setNewPlayerRole] = useState<'BAT' | 'BOWL' | 'AR' | 'WK'>('BAT');
  const [newPlayerCredits, setNewPlayerCredits] = useState('9.0');
  const [newPlayerTeamShort, setNewPlayerTeamShort] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [adminTeamPlayerRoleFilter, setAdminTeamPlayerRoleFilter] = useState<'ALL' | 'BAT' | 'BOWL' | 'AR' | 'WK'>('ALL');
  const [selectedTeamsForMatch, setSelectedTeamsForMatch] = useState<{id: string, name: string, shortName: string, color: string, format: string}[]>([]);
  const [showCreateMatchFromTeamsModal, setShowCreateMatchFromTeamsModal] = useState(false);
  const [newMatchTimeForm, setNewMatchTimeForm] = useState('');
  const [showAddFlagModal, setShowAddFlagModal] = useState<string | null>(null);
  const [newFlagUrl, setNewFlagUrl] = useState('');
  const [newFlagFit, setNewFlagFit] = useState<'cover' | 'contain'>('cover');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const [aadharInput, setAadharInput] = useState('');
  const [panInput, setPanInput] = useState('');

  const creditsUsed = team.reduce((sum, p) => sum + p.credits, 0);
  const creditsLeft = 100 - creditsUsed;

  const team1Count = team.filter(p => p.team === activeMatch?.team1?.shortFrame).length;
  const team2Count = team.filter(p => p.team === activeMatch?.team2?.shortFrame).length;

  const handleSelectMatch = (match: Match) => {
    setActiveMatch(match);
    setTeam([]); // Reset team
    setCaptain(null);
    setViceCaptain(null);
    setSelectedContest(null);
    setPreviewSource('CREATE_TEAM');
    setMatchTab(match.status === 'Upcoming' || isAdmin ? 'Contests' : 'My Contests');
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

  useEffect(() => {
     let intervalId: any;
     if (activeMatch && activeMatch?.status === 'Live') {
         const fetchLiveScore = async () => {
              try {
                 const rawId = activeMatch?.id.replace("api_", "");
                 if (!rawId || rawId === "undefined") return;

                 const res = await fetch("/api/cricket/match_info?id=" + rawId);
                 if (!res.ok) return;
                 const data = await res.json();
                 if (data && data.status === "success" && data.data) {
                     const matchInfo = data.data;
                     const liveScores = matchInfo.score || [];
                     if (liveScores.length > 0) {
                         const scoreStrings = liveScores.map((s: any) => `${s.inning}: ${s.r}/${s.w} (${s.o} ov)`).join(" | ");
                         setLiveScore(scoreStrings);
                     } else if (matchInfo.status) {
                         setLiveScore(matchInfo.status);
                     }
                 }
              } catch (e) {
                  if (!(e instanceof TypeError && e.message === "Failed to fetch")) {
                      console.error("Live Score Fetch Error:", e);
                  }
              }
          };
         fetchLiveScore();
         intervalId = setInterval(fetchLiveScore, 30000); // 30 sec polling
     } else {
         setLiveScore(null); // Reset when not live
     }
     
     return () => {
         if (intervalId) clearInterval(intervalId);
     }
  }, [activeMatch]);

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

      const sameTeamCount = team.filter(p => p.team === player.team).length;
      if (sameTeamCount >= 7) return alert(`You can select maximum 7 players from ${player.team}`);

      setTeam([...team, player]);
    }
  };

  const handleSaveTeamAndJoin = () => {
    if (!captain || !viceCaptain) return alert("Please select Captain and Vice-Captain");
    
    // If Admin is editing the BOT Blueprint
    if (isAdminBotEditMode) {
      if (!activeMatch) return;
      const bp = { players: team, captain, viceCaptain };
      localStorage.setItem(`dreamApp_bot_blueprint_${activeMatch?.id}`, JSON.stringify(bp));
      
      setSavedTeams(prev => {
         const newTeams = prev.map(t => {
            if (t.match?.id === activeMatch?.id && t.userId === 'admin_bot') {
               return { ...t, players: team, captain, viceCaptain, _ref: { ...t, players: team, captain, viceCaptain } };
            }
            return t;
         });
         // Cloud sync is now manual via the Update button for better performance
         return newTeams;
      });
      
      alert("✅ Auto Team updated successfully. All currently joined auto teams will use this lineup!");
      setIsAdminBotEditMode(null);
      setView('MATCH');
      return;
    }

    // If editing existing user team
    if (editingSavedTeamIndex !== null) {
      const updatedTeams = [...savedTeams];
      const editedTeamMeta = {
        ...updatedTeams[editingSavedTeamIndex],
        players: team.map(p => ({ id: p.id, name: p.name, role: p.role, team: p.team, credits: p.credits })),
        captain,
        viceCaptain,
        updatedAt: Date.now()
      };
      updatedTeams[editingSavedTeamIndex] = editedTeamMeta;
      setSavedTeams(updatedTeams);
      if (editedTeamMeta.userId && editedTeamMeta.userId !== 'guest') {
         const userTeamPath = `userTeams/${editedTeamMeta.id}`;
         setDoc(doc(db, 'userTeams', editedTeamMeta.id), editedTeamMeta, { merge: true }).catch(e => handleFsError(e, 'update_user_team', userTeamPath));
      }
      setEditingSavedTeamIndex(null);
      alert("✅ Team updated successfully!");
      setView(editReturnView);
      return;
    }

    const fee = selectedContest ? selectedContest.fee : 59;
    const contestName = selectedContest ? selectedContest.name : 'Mega Contest (₹55 Crore)';

    const teamIdStr = `T${savedTeams.length + 1}`;
    const newId = Date.now().toString();
    const contestDef = appContests?.find(c => c.name === contestName) || (DEFAULT_CONTESTS && DEFAULT_CONTESTS[0]) || { spots: 2, name: 'Contest', fee: 59 };
    const instanceSpots = (contestDef && contestDef.spots > 0) ? contestDef.spots : 2;
    const sameContestTeams = (savedTeams || []).filter(t => t.match?.id === activeMatch?.id && t.contestName === contestName);

    const userTeamsInSameContest = sameContestTeams.filter(t => t.userId === (user?.id || 'guest'));
    if (contestDef && contestDef.maxTeams && userTeamsInSameContest.length >= contestDef.maxTeams) {
        alert(`You can only join this contest a maximum of ${contestDef.maxTeams} times.`);
        return;
    }

    const instanceId = Math.floor(sameContestTeams.length / instanceSpots);
    
    const liteMatch = activeMatch ? { id: activeMatch.id, series: activeMatch.series, team1: activeMatch.team1, team2: activeMatch.team2, status: activeMatch.status } : null;

    const newTeamMeta = {
      id: newId,
      match: liteMatch,
      teamId: teamIdStr,
      players: team.map(p => ({ id: p.id, name: p.name, role: p.role, team: p.team, credits: p.credits })),
      captain,
      viceCaptain,
      contestName: contestName,
      fee: fee,
      userId: user?.id || 'guest',
      userNumericId: user?.numericId,
      userName: user?.name || String(user?.email || '').split('@')[0] || 'Guest Player',
      prizeDistributed: false,
      instanceId: instanceId,
      createdAt: Date.now()
    };

    // Save the created team to "My Matches"
    setSavedTeams(prev => {
       const userTeams = prev.filter(t => t.userId === (user?.id || 'guest'));
       let newState = [...prev];
       
       // If user has 10 or more teams, delete the oldest one(s) of this user
       if (userTeams.length >= 10) {
          // Sort user teams by creation time (ascending)
          const sortedUserTeams = [...userTeams].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
          // Delete teams until we have 9 left (so we can add the 10th)
          const teamsToDelete = sortedUserTeams.slice(0, userTeams.length - 9);
          const idsToDelete = teamsToDelete.map(t => t.id);
          
          newState = newState.filter(t => !idsToDelete.includes(t.id));
          
          // Also optionally delete from cloud for consistency
          if (user?.id) {
             idsToDelete.forEach(id => {
                deleteDoc(doc(db, 'userTeams', id)).catch(e => console.error("Could not delete old team", e));
             });
          }
       }
       return [...newState, newTeamMeta];
    });
    
    if (user?.id) {
       const userTeamPath = `userTeams/${newId}`;
       setDoc(doc(db, 'userTeams', newId), newTeamMeta).catch(e => handleFsError(e, 'save_user_team', userTeamPath));
    }

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
      <header className="p-4 flex items-center justify-between pb-2 bg-app-bg relative">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-app-accent"></div>
          <h1 className="text-xl font-bold text-app-text">Fantasy11</h1>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('PROFILE')}>
             <span className="font-bold text-sm text-app-text">Hey {user ? String(user.name || user.email || '').split(' ')[0].split('@')[0].toUpperCase() : 'ARKING'}</span>
             <span className="bg-yellow-500 text-black text-[10px] px-1.5 py-0.5 rounded flex items-center font-bold">⚡ Lvl 3</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
             <button onClick={() => setShowAdminQuickAdd(true)} className="bg-green-500/20 text-green-500 border border-green-500/50 px-2 py-0.5 rounded text-[10px] uppercase font-black transition-colors hover:bg-green-500/30 flex items-center gap-1">
                <Plus size={10} strokeWidth={4} /> Wallet
             </button>
             <button onClick={() => setView('WALLET')} className="flex items-center gap-1 bg-app-card/80 border border-app-border px-2 py-0.5 rounded text-[10px] font-bold text-app-text transition-colors hover:bg-app-card-hover">
                <Wallet size={10} />
                ₹{balance.toLocaleString('en-IN', {maximumFractionDigits:0})}
             </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-0 pb-20 space-y-5 pt-2">
        {appBanners.filter(b => b.imageUrl).length > 0 ? (
           <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-3 px-4 pb-1">
              {appBanners.filter(b => b.imageUrl).map(banner => (
                 <div key={banner.id} className="min-w-[88%] sm:min-w-[80%] h-40 rounded-2xl overflow-hidden snap-center shrink-0 relative shadow-[0_4px_15px_rgba(0,0,0,0.3)]">
                    <img src={banner.imageUrl} alt="Banner" className="w-full h-full object-cover" />
                 </div>
              ))}
           </div>
        ) : (
           <div className="mx-4 bg-app-accent/90 rounded-xl p-4 flex flex-col relative overflow-hidden mt-2 cursor-pointer" onClick={() => { if(appMatches.length>0) { handleSelectMatch(appMatches[0]) } }}>
              <div className="text-[10px] font-bold text-app-text/80 uppercase">Mega Contest</div>
              <div className="text-4xl font-black text-app-text my-1 tracking-tighter">₹1 Cr</div>
              <div className="text-xs text-app-text/90">Win a share of the biggest prize<br/>pool today</div>
              <Trophy size={80} className="absolute -right-4 -bottom-4 text-app-text/20" />
           </div>
        )}

        <div className="px-4">
           {appMatches.filter(m => m.status === 'Live').length > 0 && (
               <>
                   <h2 className="font-bold flex items-center gap-2 mt-2 text-lg text-app-text">
                       <div className="w-2 h-2 rounded-full bg-app-accent"></div> Live Now
                       <span className="ml-auto text-xs font-normal text-app-text-muted">{appMatches.filter(m => m.status === 'Live').length}</span>
                   </h2>
                   {appMatches.filter(m => m.status === 'Live').map(match => renderMatchCard(match))}
               </>
           )}

           {appMatches.filter(m => m.status === 'Upcoming').length > 0 && (
               <>
                   <h2 className="font-bold mt-4 text-app-text text-lg border-b border-app-border pb-2 flex justify-between">
                       IPL 2026
                       <span className="text-xs text-app-text-muted font-normal self-end mb-1">{appMatches.filter(m => m.status === 'Upcoming').length} matches</span>
                   </h2>
                   {appMatches.filter(m => m.status === 'Upcoming').map(match => renderMatchCard(match))}
               </>
           )}

           {appMatches.filter(m => m.status === 'Upcoming' || m.status === 'Live').length === 0 && (
               <div className="flex flex-col items-center justify-center p-10 opacity-50 text-center">
                  <h3 className="font-bold text-app-text-muted">No Matches Available</h3>
               </div>
           )}
        </div>
      </div>
      {renderBottomNav()}
    </div>
  );

  const renderMatchCard = (match: Match) => (
    <div 
      key={match.id} 
      onClick={() => handleSelectMatch(match)}
      className="bg-app-card rounded-xl relative flex flex-col p-4 pb-2 cursor-pointer active:scale-[0.98] transition-all shadow-sm border border-app-border/50"
    >
      <div className="flex justify-between items-center mb-3">
        <div className="flex flex-col items-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-app-text border-2 border-app-border-hover overflow-hidden shadow-inner ${match?.team1?.color?.startsWith('bg-') ? match.team1.color : ''}`} style={!match?.team1?.color?.startsWith('bg-') ? {backgroundColor: match?.team1?.color} : {}}>
             {match?.team1?.flagUrl ? (
                 <img src={match?.team1?.flagUrl} alt={match?.team1?.shortFrame} className={`w-full h-full ${match?.team1?.flagFit === 'contain' ? 'object-contain' : 'object-cover'}`} />
             ) : (
                 match?.team1?.shortFrame
             )}
          </div>
          <span className="text-xs text-app-text mt-1 font-semibold">{match?.team1?.shortFrame}</span>
        </div>
        
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-app-text-muted font-bold mb-0.5">VS</span>
          {match.lineupStatus === 'OUT' && match.status === 'Upcoming' && <span className="text-[8px] bg-green-500/20 text-green-500 border border-green-500/30 font-bold px-1.5 py-0.5 rounded-sm mb-1 uppercase tracking-wider">LINEUPS OUT</span>}
          {match.status === 'Completed' ? (
             <div className="bg-app-card-hover text-app-text-muted text-[10px] font-bold px-2 py-0.5 rounded">COMPLETED</div>
          ) : match.status === 'Live' ? (
             <div className="text-app-accent text-xs font-bold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-app-accent animate-pulse"></div> LIVE</div>
          ) : (
             <div className="text-[#FFD700] text-xs font-bold">{getFormattedTimer(match)}</div>
          )}
        </div>

        <div className="flex flex-col items-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-app-text border-2 border-app-border-hover overflow-hidden shadow-inner ${match?.team2?.color?.startsWith('bg-') ? match.team2.color : ''}`} style={!match?.team2?.color?.startsWith('bg-') ? {backgroundColor: match?.team2?.color} : {}}>
             {match?.team2?.flagUrl ? (
                 <img src={match?.team2?.flagUrl} alt={match?.team2?.shortFrame} className={`w-full h-full ${match?.team2?.flagFit === 'contain' ? 'object-contain' : 'object-cover'}`} />
             ) : (
                 match?.team2?.shortFrame
             )}
          </div>
          <span className="text-xs text-app-text mt-1 font-semibold">{match?.team2?.shortFrame}</span>
        </div>
      </div>
      
      <div className="bg-app-card-hover rounded-lg flex justify-between p-2 mt-2 -mx-2 -mb-2 items-center">
        <div className="flex items-center text-[10px] font-bold text-app-text-muted gap-1.5">
          {match.status === 'Live' ? <div className="text-app-accent hover:animate-pulse">● In Progress</div> : <div><Clock size={10} className="inline mr-1 -mt-0.5"/> {match.time}</div>}
        </div>
        <div className="flex items-center text-[10px] font-bold text-app-text-muted">
           <Trophy size={10} className="text-[#e5c158] mr-1"/> {match.totalPrize}
        </div>
      </div>
    </div>
  );

  const handleAddBot = (e: React.MouseEvent, contest: Contest, type: 'AUTO' | 'BOOT' = 'AUTO', amount: number = 1) => {
    e.stopPropagation();
    if (!activeMatch) return;
    
    // Generate pool of valid random variations to give illusion of uniqueness while keeping performance high
    const availablePlayers = appPlayers.filter(p => p.team === activeMatch?.team1?.shortFrame || p.team === activeMatch?.team2?.shortFrame);
    const variations = [];
    
    for (let v = 0; v < 100; v++) {
       const shuffled = [...availablePlayers].sort(() => 0.5 - Math.random());
       const selected = [];
       const rolesNeeded = ['WK', 'BAT', 'AR', 'BOWL'];
       for (const role of rolesNeeded) {
           const p = shuffled.find(pl => pl.role === role);
           if (p) {
              selected.push(p);
              shuffled.splice(shuffled.indexOf(p), 1);
           }
       }
       while(selected.length < 11 && shuffled.length > 0) {
           selected.push(shuffled.pop());
       }
       const capOptions = [...selected].sort(() => 0.5 - Math.random());
       variations.push({
           players: selected,
           captain: capOptions[0]?.id || null,
           viceCaptain: capOptions[1]?.id || null,
           vId: v.toString()
       });
    }
    
    const BOT_NAMES = ['Rahul', 'Amit', 'Rohit', 'Virat', 'Mahi', 'Suresh', 'Dinesh', 'Sachin', 'Kapil', 'Virender', 'Ravi', 'Ramesh', 'Sanjay', 'Vicky', 'Raju', 'Ajay', 'Vijay', 'Sumit', 'Karan', 'Arjun', 'Pooja', 'Neha', 'Priya', 'Anjali', 'Kavita'];
    
    let safeAmount = Math.max(1, isNaN(amount) ? 1 : amount);
    if (safeAmount > 10000) safeAmount = 10000; // Limit to 10k as requested
    
    if (savedTeams.length + safeAmount > 1000000) {
       alert("Maximum limit of 1 Million teams reached! Clean up old matches.");
       return;
    }
    
    // Minimal match payload
    const liteMatch = { id: activeMatch?.id };
    
    const sameContestTeams = savedTeams.filter(t => t.match?.id === activeMatch?.id && t.contestName === contest.name);
    const instanceSpots = contest.spots > 0 ? contest.spots : 2;
    let baseCount = sameContestTeams.length;

    const newBots = [];
    const timestamp = Date.now();
    for(let i=0; i<safeAmount; i++) {
        const randomName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + Math.floor(Math.random() * 999).toString();
        const bp = variations[Math.floor(Math.random() * variations.length)];
        const currentInstanceId = Math.floor(baseCount / instanceSpots);
        baseCount++;
        
        newBots.push({
           id: `bot_${timestamp}_${i}_${Math.random().toString(36).substring(2, 5)}`,
           match: liteMatch,
           teamId: type === 'BOOT' ? `BOT-${timestamp.toString().slice(-4)}${i}` : `T${Math.floor(Math.random() * 89999) + 10000}`,
           players: bp.players.map((p: any) => ({ id: p.id })), // Only store IDs to save memory/payload
           captain: bp.captain,
           viceCaptain: bp.viceCaptain,
           contestName: contest.name,
           fee: contest.entryFee,
           userId: type === 'BOOT' ? 'admin_bot_boot' : 'admin_bot',
           userName: type === 'BOOT' ? `BOOT ${timestamp.toString().slice(-3)}${i}` : randomName,
           instanceId: currentInstanceId
        });
    }
    
    setSavedTeams(prev => [...prev, ...newBots]);
  };

  const handleRemoveBot = (e: React.MouseEvent, contest: Contest, type: 'AUTO' | 'BOOT' = 'AUTO', amount: number = 1) => {
     e.stopPropagation();
     setSavedTeams(prev => {
        const bots = prev.filter(t => t.match?.id === activeMatch?.id && t.contestName === contest.name && t.userId === (type === 'BOOT' ? 'admin_bot_boot' : 'admin_bot'));
        if (bots.length === 0) return prev;
        const botsToRemove = bots.slice(-amount).map(b => b.id); // remove the last 'amount' added
        const newTeams = prev.filter(t => !botsToRemove.includes(t.id));
        const adminTeams = newTeams.filter(t => t.userId === 'admin_bot' || t.userId === 'admin_bot_boot');
        // Bot sync is manual via Update button
        return newTeams;
     });
  };

  const renderBotControls = (contest: Contest) => {
     if (!isAdmin || !activeMatch) return null;
     const botTeamsAuto = savedTeams.filter(t => t.match?.id === activeMatch?.id && t.contestName === contest.name && t.userId === 'admin_bot');
     const botTeamsBoot = savedTeams.filter(t => t.match?.id === activeMatch?.id && t.contestName === contest.name && t.userId === 'admin_bot_boot');
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
                 <div className="flex flex-col items-center bg-app-card-inner border border-app-border rounded shadow-sm p-1" onClick={e=>e.stopPropagation()}>
                    <div className="text-[9px] font-bold text-[#f0b90b] flex items-center gap-1 justify-center text-center px-1 rounded pb-1">
                      <span>Auto Team {botCountAuto > 0 ? `(${botCountAuto.toLocaleString('en-IN')})` : ''}</span> 
                    </div>
                    <div className="flex items-center mt-1 gap-0.5">
                       <input 
                         type="number" 
                         className="w-12 h-5 text-center text-[10px] bg-black border border-app-border rounded-l outline-none text-white font-bold placeholder-slate-600 focus:border-[#f0b90b]"
                         placeholder="Qty"
                         value={botInputAuto[contest.id] || ''}
                         onChange={(e) => setBotInputAuto({...botInputAuto, [contest.id]: e.target.value})}
                       />
                       <button 
                         onClick={(e) => {
                           const qty = parseInt(botInputAuto[contest.id]);
                           if (qty > 0) {
                              handleAddBot(e, contest, 'AUTO', Math.min(qty, 10000));
                              setBotInputAuto({...botInputAuto, [contest.id]: ''});
                           }
                         }} 
                         className="h-5 px-1 bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white font-bold text-[10px] transition-colors"
                       >
                         Add
                       </button>
                       <button 
                         onClick={(e) => {
                           const qty = parseInt(botInputAuto[contest.id]);
                           if (qty > 0) {
                              handleRemoveBot(e, contest, 'AUTO', qty);
                              setBotInputAuto({...botInputAuto, [contest.id]: ''});
                           }
                         }} 
                         className="h-5 px-1 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white font-bold text-[10px] transition-colors border-r border-white/5"
                       >
                         Rem
                       </button>
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           handleSyncBotsOnly();
                         }} 
                         disabled={isSyncing}
                         className={`h-5 px-1 ${isSyncing ? 'bg-slate-800 text-slate-500 animate-pulse' : 'bg-[#e5c158]/20 text-[#e5c158] hover:bg-[#e5c158] hover:text-black'} flex items-center gap-1 rounded-r font-bold text-[10px] transition-colors active:scale-95`}
                       >
                         {isSyncing ? <RefreshCw size={8} className="animate-spin" /> : null}
                         Update
                       </button>
                    </div>
                 </div>
              </div>
           )}
        </div>
     );
  };

  const renderContests = () => {
    if (!activeMatch) return null;

    const megaContests = appContests.filter(c => c.type === 'Mega');
    const h2hContests = appContests.filter(c => c.type === 'H2H' || c.type === '3 Spots' || c.type === '4 Spots' || c.type === '5 Spots');

    const userTeamsInMatch = savedTeams.filter(t => t.match?.id === activeMatch?.id && t.userId === (user?.id || 'guest'));
    const myTeamsCount = userTeamsInMatch.length;
    
    // Calculate unique contests joined by user
    const distinctMyContests: { contestName: string, instanceId: number }[] = [];
    userTeamsInMatch.forEach(t => {
       const iId = t.instanceId || 0;
       if (!distinctMyContests.find(existing => existing.contestName === t.contestName && existing.instanceId === iId)) {
          distinctMyContests.push({ contestName: t.contestName, instanceId: iId });
       }
    });
    const myContestsCount = distinctMyContests.length;

    return (
      <div className="flex flex-col h-full bg-app-bg">
        <header className="bg-app-bg text-app-text p-4 flex items-center justify-between shadow-sm z-10 shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('HOME')} className="p-1 -ml-1 active:bg-app-card/10 rounded-full transition-colors"><ArrowLeft size={24} /></button>
              <div className="flex flex-col">
                <span className="font-bold text-sm block">{activeMatch?.team1?.shortFrame} vs {activeMatch?.team2?.shortFrame}</span>
                <span className="text-[10px] text-app-text-muted">{activeMatch.series}</span>
              </div>
            </div>
            {activeMatch?.status === 'Upcoming' && (
              <span className="text-[10px] font-bold text-app-text-muted flex items-center gap-1"><Clock size={12}/> {getFormattedTimer(activeMatch)} left</span>
            )}
        </header>

        <div className="bg-app-card p-4 flex justify-between items-center z-10 shrink-0 border-b border-app-border">
           <div className="flex flex-col items-center">
             <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl text-app-text border-2 border-app-border-hover relative overflow-hidden shrinkage-0 ${activeMatch?.team1?.color}`}>
                {activeMatch?.team1?.flagUrl ? <img src={activeMatch?.team1?.flagUrl} alt={activeMatch?.team1?.shortFrame} className={`w-full h-full ${activeMatch?.team1?.flagFit === 'contain' ? 'object-contain' : 'object-cover'}`} /> : activeMatch?.team1?.shortFrame}
             </div>
             <span className="text-xs text-app-text mt-1 font-bold">{activeMatch?.team1?.shortFrame}</span>
           </div>
           <div className="flex flex-col items-center text-center px-2">
              {activeMatch?.status === 'Live' ? (
                  <div className="flex flex-col items-center">
                     <span className="text-app-accent font-bold text-base tracking-widest flex items-center gap-1 mb-1"><div className="w-2 h-2 rounded-full bg-app-accent animate-pulse"></div>LIVE</span>
                     {liveScore && <span className="text-yellow-400 font-black text-xs text-center border-t border-app-border-hover pt-1 mt-1 break-words">{liveScore}</span>}
                  </div>
              ) : <span className="text-[#FFD700] font-bold text-sm block">{String(activeMatch?.status || '').toUpperCase()}</span>}
              <span className="text-[10px] text-app-text-muted mt-1">{activeMatch.time}</span>
              <span className="text-[10px] text-app-text-muted mt-0.5">Stadium</span>
           </div>
           <div className="flex flex-col items-center">
             <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl text-app-text border-2 border-app-border-hover relative overflow-hidden shrinkage-0 ${activeMatch?.team2?.color}`}>
                {activeMatch?.team2?.flagUrl ? <img src={activeMatch?.team2?.flagUrl} alt={activeMatch?.team2?.shortFrame} className={`w-full h-full ${activeMatch?.team2?.flagFit === 'contain' ? 'object-contain' : 'object-cover'}`} /> : activeMatch?.team2?.shortFrame}
             </div>
             <span className="text-xs text-app-text mt-1 font-bold">{activeMatch?.team2?.shortFrame}</span>
           </div>
        </div>

        <div className="flex bg-app-bg text-xs font-bold shrink-0 border-b border-app-border">
           {(activeMatch?.status === 'Upcoming' || isAdmin) && (
             <button className={`flex-1 py-3 ${matchTab === 'Contests' ? 'text-app-accent border-b-2 border-app-accent' : 'text-app-text-muted'}`} onClick={() => setMatchTab('Contests')}>
               Contests
             </button>
           )}
           <button className={`flex-1 py-3 ${matchTab === 'My Contests' ? 'text-app-accent border-b-2 border-app-accent' : 'text-app-text-muted'}`} onClick={() => setMatchTab('My Contests')}>
             {`My Contests (${myContestsCount})`}
           </button>
           <button className={`flex-1 py-3 ${matchTab === 'My Teams' || (activeMatch?.status !== 'Upcoming' && !isAdmin && matchTab !== 'My Contests') ? 'text-app-accent border-b-2 border-app-accent' : 'text-app-text-muted'}`} onClick={() => setMatchTab('My Teams')}>
             {`My Teams (${myTeamsCount})`}
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
          {(matchTab === 'Contests' && (activeMatch?.status === 'Upcoming' || isAdmin)) && (
             <>
              {megaContests.map(c => {
                const totalTeamsCount = savedTeams.filter(t => t.match?.id === activeMatch?.id && t.contestName === c.name).length;
                const spotsLeft = Math.max(0, c.spots - totalTeamsCount);
                const fillPercent = Math.min(100, (totalTeamsCount / c.spots) * 100);
                
                return (
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
                          if(activeMatch?.status !== 'Upcoming') {
                             alert("Match is already live or completed!"); return;
                          }
                          setActiveContestDetails(c);
                          setSelectedContest({fee: c.entryFee, name: c.name, id: c.id, spots: c.spots});
                          setView('CREATE_TEAM');
                        }}
                        className={`${activeMatch?.status === 'Upcoming' ? 'bg-green-600 active:scale-95 hover:bg-green-700' : 'bg-slate-700'} transition-all text-white font-bold py-1.5 px-6 rounded text-lg shadow-sm`}
                      >
                        ₹{c.entryFee}
                      </button>
                    </div>
                    <div className="bg-app-bg h-1.5 rounded-full mb-2 overflow-hidden">
                      <div className="bg-app-accent h-full" style={{width:`${fillPercent}%`}}></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-app-text-muted font-semibold">
                      <span className="text-red-400">{Number(spotsLeft || 0).toLocaleString('en-IN')} spots left</span>
                      <span>{Number(c.spots || 0).toLocaleString('en-IN')} spots</span>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-slate-50/5 dark:bg-app-card-inner flex shrink-0 items-center justify-start gap-6 text-[11px] font-semibold text-app-text-muted">
                    <span className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full border border-yellow-500 text-[#e5c158] flex items-center justify-center text-[8px] font-bold bg-[#e5c158]/10">1st</div> {c.firstPrize || '₹10 Lakh'}</span>
                    <span className="flex items-center gap-1.5"><Trophy size={11} className="text-app-text-muted"/> {c.winPercentage || 48}%</span>
                    <span className="flex items-center gap-1.5"><div className="w-4 h-4 border border-slate-500 rounded flex items-center justify-center text-[8px] font-bold text-app-text-muted">M</div> {c.maxTeams || 20}</span>
                  </div>
                </div>
              )})}

              {h2hContests.map(c => {
                const totalTeamsCount = savedTeams.filter(t => t.match?.id === activeMatch?.id && t.contestName === c.name).length;
                const cspots = c.spots > 0 ? c.spots : 2;
                const teamsInCurrentInstance = totalTeamsCount % cspots;
                const spotsLeft = cspots - teamsInCurrentInstance;
                const fillPercent = (teamsInCurrentInstance / cspots) * 100;
                
                return (
                <div key={c.id} onClick={() => { setActiveContestInstanceId(Math.floor(totalTeamsCount / cspots)); setActiveContestDetails(c); setView('CONTEST_DETAILS'); }} className="bg-app-card rounded-xl shadow-sm border border-app-border overflow-hidden mb-4 cursor-pointer active:scale-[0.99] transition-transform relative">
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
                            if(activeMatch?.status !== 'Upcoming') {
                               alert("Match is already live or completed!"); return;
                            }
                            setActiveContestDetails(c);
                            setActiveContestInstanceId(Math.floor(totalTeamsCount / cspots));
                            setSelectedContest({fee: c.entryFee, name: c.name, id: c.id, spots: c.spots});
                            setView('CREATE_TEAM');
                          }}
                          className={`${activeMatch?.status === 'Upcoming' ? 'bg-green-600 active:scale-95 hover:bg-green-700' : 'bg-slate-700'} transition-all text-white font-bold py-1.5 px-6 rounded text-lg shadow-sm border-b-2 border-green-800`}
                        >
                          ₹{c.entryFee}
                        </button>
                    </div>
                    <div className="bg-app-bg h-1.5 rounded-full mb-2 overflow-hidden">
                      <div className="bg-app-accent h-full" style={{width: `${fillPercent}%`}}></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-app-text-muted font-semibold">
                      <span className="text-red-400">{spotsLeft} spots left</span>
                      <span>{cspots} spots</span>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50/5 dark:bg-app-card-inner flex shrink-0 items-center justify-start gap-6 text-[11px] font-semibold text-app-text-muted">
                    <span className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full border border-yellow-500 text-[#e5c158] flex items-center justify-center text-[8px] font-bold bg-[#e5c158]/10">1st</div> {c.firstPrize || c.prizeText}</span>
                    <span className="flex items-center gap-1.5"><Trophy size={11} className="text-app-text-muted"/> {c.winPercentage || 50}%</span>
                    <span className="flex items-center gap-1.5"><div className="w-4 h-4 border border-slate-500 rounded flex items-center justify-center text-[8px] font-bold text-app-text-muted">M</div> {c.maxTeams || 1}</span>
                  </div>
                </div>
              )})}
             </>
          )}

          {matchTab === 'My Contests' && (
             <>
                {distinctMyContests.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full opacity-60 mt-10">
                        <Trophy size={60} className="text-app-text-muted mb-4" />
                        <p className="font-bold text-app-text-muted">No contests joined!</p>
                        <p className="text-sm text-app-text-muted">Join a contest to see it here.</p>
                     </div>
                ) : (
                    distinctMyContests.map((dc, i) => {
                        const c = appContests.find(cc => cc.name === dc.contestName);
                        if (!c) return null;
                        const totalTeamsCount = savedTeams.filter(t => t.match?.id === activeMatch?.id && t.contestName === c.name).length;
                        const cspots = c.spots > 0 ? c.spots : 2;
                        
                        let spotsLeft = 0;
                        let fillPercent = 0;
                        
                        if (c.type === 'Mega') {
                            spotsLeft = Math.max(0, c.spots - totalTeamsCount);
                            fillPercent = Math.min(100, (totalTeamsCount / c.spots) * 100);
                        } else {
                            // Find all teams in this specific instance
                            const teamsInThisInstance = savedTeams.filter(t => t.match?.id === activeMatch?.id && t.contestName === c.name && t.instanceId === dc.instanceId).length;
                            spotsLeft = cspots - teamsInThisInstance;
                            fillPercent = (teamsInThisInstance / cspots) * 100;
                        }
                        
                        return (
                         <div key={i} onClick={() => { setActiveContestInstanceId(dc.instanceId); setActiveContestDetails(c); setView('CONTEST_DETAILS'); }} className="bg-app-card rounded-xl shadow-sm border border-app-border overflow-hidden mb-4 cursor-pointer active:scale-[0.99] transition-transform relative">
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
                                     if(activeMatch?.status !== 'Upcoming') {
                                        alert("Match is already live or completed!"); return;
                                     }
                                     setActiveContestDetails(c);
                                     setActiveContestInstanceId(dc.instanceId);
                                     setSelectedContest({fee: c.entryFee, name: c.name, id: c.id, spots: c.spots});
                                     setView('CREATE_TEAM');
                                   }}
                                   className={`${activeMatch?.status === 'Upcoming' ? 'bg-green-600 active:scale-95 hover:bg-green-700' : 'bg-slate-700'} transition-all text-white font-bold py-1.5 px-6 rounded text-lg shadow-sm border-b-2 border-green-800`}
                                 >
                                   ₹{c.entryFee}
                                 </button>
                             </div>
                             <div className="bg-app-bg h-1.5 rounded-full mb-2 overflow-hidden">
                               <div className="bg-app-accent h-full" style={{width: `${fillPercent}%`}}></div>
                             </div>
                             <div className="flex justify-between text-[10px] text-app-text-muted font-semibold">
                               <span className="text-red-400">{spotsLeft} spots left</span>
                               <span>{c.type === 'Mega' ? c.spots : cspots} spots</span>
                             </div>
                           </div>
                           <div className="p-3 bg-slate-50/5 dark:bg-app-card-inner flex shrink-0 items-center justify-start gap-6 text-[11px] font-semibold text-app-text-muted">
                             <span className="flex items-center gap-1.5"><div className="w-4 h-4 rounded-full border border-yellow-500 text-[#e5c158] flex items-center justify-center text-[8px] font-bold bg-[#e5c158]/10">1st</div> {c.firstPrize || c.prizeText}</span>
                             <span className="flex items-center gap-1.5"><Trophy size={11} className="text-app-text-muted"/> {c.winPercentage || (c.type === 'Mega' ? 48 : 50)}%</span>
                             <span className="flex items-center gap-1.5"><div className="w-4 h-4 border border-slate-500 rounded flex items-center justify-center text-[8px] font-bold text-app-text-muted">M</div> {c.maxTeams || (c.type === 'Mega' ? 20 : 1)}</span>
                           </div>
                         </div>
                        )
                    })
                )}
             </>
          )}

          {matchTab === 'My Teams' && (
             <>
                {savedTeams.filter(t => t.match?.id === activeMatch?.id && t.userId === (user?.id || 'guest')).length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full opacity-60 mt-10">
                        <Trophy size={60} className="text-app-text-muted mb-4" />
                        <p className="font-bold text-app-text-muted">No teams found!</p>
                        <p className="text-sm text-app-text-muted">You didn't join any contests.</p>
                     </div>
                ) : (
                   savedTeams.filter(t => t.match?.id === activeMatch?.id && t.userId === (user?.id || 'guest')).map((st, i) => {
                       const currentMatchStatus = activeMatch?.status;
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
                                   <span className="font-bold">{st.match?.team1?.name}</span>
                                   <div className="flex flex-col items-center">
                                      <span className="bg-red-50 text-app-accent px-2 py-1 rounded text-[10px] font-bold">{currentMatchStatus === 'Live' ? 'In Progress' : currentMatchStatus === 'Completed' ? 'Ended' : st.match?.time}</span>
                                      {(currentMatchStatus === 'Live' || currentMatchStatus === 'Completed') && (
                                         <span className="text-sm font-black text-green-500 mt-1">{totalPoints} pts</span>
                                      )}
                                      {currentMatchStatus === 'Completed' && st.prizeDistributed && st.amountWon !== undefined && (
                                         <span className="text-xs font-black text-[#e5c158] mt-0.5 tracking-tight uppercase">Won ₹{Number(st.amountWon || 0).toFixed(2)}</span>
                                      )}
                                   </div>
                                   <span className="font-bold">{st.match?.team2?.name}</span>
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
                                         setActiveContestInstanceId(st.instanceId);
                                         setActiveContestDetails(c);
                                         setView('CONTEST_DETAILS');
                                     }} 
                                     className={`font-bold text-xs active:opacity-70 w-full py-2 rounded-full text-center border bg-app-accent text-white border-blue-600`}
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
    const liveTeams = [activeMatch?.team1?.shortFrame, activeMatch?.team2?.shortFrame];
    const displayedPlayers = appPlayers.filter(p => p.role === activeRole && liveTeams.includes(p.team));

    return (
      <div className="flex flex-col h-full bg-app-card relative">
        <header className="bg-app-bg text-app-text border-b border-app-border p-4 pb-2 z-10 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { setView('MATCH'); setIsAdminBotEditMode(null); }} className="p-1 -ml-1 active:bg-app-card/10 rounded-full"><ArrowLeft size={24} /></button>
            <div className="font-bold text-sm flex gap-2">
              <span>{activeMatch.time}</span>
              <span className="opacity-50">|</span>
              <span className="text-[#f0b90b]">CREATE TEAM 1</span>
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
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md border border-white/20 relative overflow-hidden shrinkage-0 ${activeMatch?.team1?.color?.startsWith('bg-') ? activeMatch.team1.color : ''}`} style={!activeMatch?.team1?.color?.startsWith('bg-') ? {backgroundColor: activeMatch?.team1?.color} : {}}>
                     {activeMatch?.team1?.flagUrl ? <img src={activeMatch?.team1?.flagUrl} alt={activeMatch?.team1?.shortFrame} className={`w-full h-full ${activeMatch?.team1?.flagFit === 'contain' ? 'object-contain' : 'object-cover'}`} /> : activeMatch?.team1?.shortFrame}
                   </div>
                   <span className="text-[10px] font-bold mt-1 text-app-text-muted">{team1Count}</span>
                </div>
                <div className="text-center flex flex-col items-center">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md border border-white/20 relative overflow-hidden shrinkage-0 ${activeMatch?.team2?.color?.startsWith('bg-') ? activeMatch.team2.color : ''}`} style={!activeMatch?.team2?.color?.startsWith('bg-') ? {backgroundColor: activeMatch?.team2?.color} : {}}>
                     {activeMatch?.team2?.flagUrl ? <img src={activeMatch?.team2?.flagUrl} alt={activeMatch?.team2?.shortFrame} className={`w-full h-full ${activeMatch?.team2?.flagFit === 'contain' ? 'object-contain' : 'object-cover'}`} /> : activeMatch?.team2?.shortFrame}
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
                const tColor = player.team === activeMatch?.team1?.shortFrame ? activeMatch?.team1?.color : activeMatch?.team2?.color;
                
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
                       <div className="flex items-center gap-2 mt-0.5">
                           <p className="text-[10px] text-app-text-muted font-bold">{player.points} pts</p>
                           {player.isPlaying === true && <span className="flex items-center gap-1.5 text-[10px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded-sm ml-1"><Check size={10} strokeWidth={4} /> Playing</span>}
                           {player.isPlaying === false && <span className="flex items-center gap-1.5 text-[10px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded-sm ml-1"><div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div> Not Playing</span>}
                       </div>
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
               const wkCount = team.filter(p => p.role === 'WK').length;
               const batCount = team.filter(p => p.role === 'BAT').length;
               const arCount = team.filter(p => p.role === 'AR').length;
               const bowlCount = team.filter(p => p.role === 'BOWL').length;
               
               if (wkCount < 1) return alert("Select at least 1 Wicket Keeper (WK)");
               if (batCount < 1) return alert("Select at least 1 Batsman (BAT)");
               if (arCount < 1) return alert("Select at least 1 All-Rounder (AR)");
               if (bowlCount < 1) return alert("Select at least 1 Bowler (BOWL)");
               
               const team1Short = activeMatch?.team1?.shortFrame;
               const team2Short = activeMatch?.team2?.shortFrame;
               const team1Count = team.filter(p => p.team === team1Short).length;
               const team2Count = team.filter(p => p.team === team2Short).length;
               
               if (team1Count > 7) return alert(`You can select maximum 7 players from ${team1Short}`);
               if (team2Count > 7) return alert(`You can select maximum 7 players from ${team2Short}`);
               
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
    const totalPoints = (team || []).reduce((acc, p) => {
       if (!p) return acc;
       const latestP = appPlayers.find(ap => ap.id === p.id) || p;
       const mult = p.id === captain ? 2 : (p.id === viceCaptain ? 1.5 : 1);
       const pts = Number(latestP.points || 0);
       return acc + (pts * mult);
    }, 0);

    return (
    <div className="flex flex-col h-full bg-[#3f9e4d] relative overflow-hidden font-sans">
      
      {/* Top Black Header */}
      <header className="flex items-center px-4 py-3 bg-[#13151c] text-white z-20 relative border-b border-[#701516]/50">
         <button onClick={() => setView(previewSource === 'MY_MATCHES' ? 'MY_MATCHES' : previewSource === 'CONTEST_DETAILS' ? 'CONTEST_DETAILS' : 'CREATE_TEAM')} className="w-6 h-6 flex items-center justify-center bg-white text-black rounded-full mr-3 shrink-0">
            <X size={16} className="font-bold border-2 border-transparent" strokeWidth={3} />
         </button>
         <h2 className="font-medium flex-1 text-lg leading-none truncate">{previewTeamInfo ? previewTeamInfo.name : 'Team Preview'}</h2>
         {(!isLiveOrCompleted && previewSource === 'MY_MATCHES') && (
            <button onClick={() => setView('CREATE_TEAM')} className="p-1.5 active:bg-white/10 rounded-full bg-white/5 hover:bg-white/10 transition-colors shrink-0">
               <Edit2 size={16} className="text-white" />
            </button>
         )}
      </header>

      {/* Dark Red Sub Header */}
      <div className="bg-[#701516] px-4 py-3 flex justify-between items-center text-white z-20 relative">
         <div className="flex flex-col items-start w-1/3">
            <span className="text-[10px] text-white/80 uppercase tracking-wide">Players</span>
            <span className="text-sm font-semibold tracking-wide">{team.length} / 11</span>
         </div>
         <div className="flex items-center justify-center gap-3 w-1/3">
            <div className="px-2.5 py-0.5 border border-white/40 rounded-3xl text-[10px] font-bold bg-transparent text-white truncate max-w-[40px]">{activeMatch?.team1?.shortFrame}</div>
            <span className="text-sm font-bold whitespace-nowrap">{team1Count} : {team2Count}</span>
            <div className="px-2.5 py-0.5 border border-white/40 rounded-3xl text-[10px] font-bold bg-[#13151c] text-white truncate max-w-[40px]">{activeMatch?.team2?.shortFrame}</div>
         </div>
         <div className="flex flex-col items-end w-1/3">
            {isLiveOrCompleted ? (
               <>
                  <span className="text-[10px] text-white/80 uppercase tracking-wide">Total Points</span>
                  <span className="text-sm font-bold">{previewTeamInfo?.points ?? totalPoints}</span>
               </>
            ) : (
               <>
                  <span className="text-[10px] text-white/80 uppercase tracking-wide">Credits Left</span>
                  <span className="text-sm font-bold">{creditsLeft}</span>
               </>
            )}
         </div>
      </div>

      {/* Grass Background & Pitch Lines */}
      <div className="absolute inset-x-0 bottom-0 top-[100px] z-0 overflow-hidden bg-[#2d8a39]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 20px, transparent 20px, transparent 40px)' }}>
          <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 20px, transparent 20px, transparent 40px)' }}></div>
          {/* Oval pitch line */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] sm:w-[120%] h-[92%] border-[1.5px] border-white/20 rounded-[50%]"></div>
          {/* Inner circle / pitch area */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80px] h-[100px] border-[1.5px] border-white/20 rounded-md">
             <div className="absolute top-0 left-0 w-full h-[30px] border-b-[1.5px] border-white/20"></div>
             <div className="absolute bottom-0 left-0 w-full h-[30px] border-t-[1.5px] border-white/20"></div>
          </div>
          {/* DABA FANTASY WATERMARK */}
          <div className="absolute top-[65%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 text-white/30 font-black text-xl tracking-widest pointer-events-none w-max">
             <Shield size={24} className="opacity-80" />
             DABA FANTASY
          </div>
      </div>

      {/* Players Area */}
      <div className="flex-1 relative z-10 flex flex-col justify-around py-4">
         {(['WK', 'BAT', 'AR', 'BOWL'] as Role[]).map(role => {
             const playersInRole = team.filter(p => p.role === role);
             if (playersInRole.length === 0) return null;
             return (
                 <div key={role} className="flex flex-col items-center w-full">
                     <div className="bg-[#5d1012]/0 text-white/90 text-[10px] px-2 py-0.5 rounded-full mb-3 tracking-wider font-semibold border-none bg-black/10">
                        {role === 'WK' ? 'WICKET KEEPER' : role === 'BAT' ? 'BATSMAN' : role === 'AR' ? 'ALL ROUNDERS' : 'BOWLERS'}
                     </div>
                     <div className="flex justify-center gap-2 sm:gap-6 w-full px-2">
                         {playersInRole.map(p => {
                             if (!p) return null;
                             const latestP = appPlayers.find(ap => ap.id === p.id) || p;
                             const isC = p.id === captain;
                             const isVC = p.id === viceCaptain;
                             const pName = p.name || 'Player';
                             const pPoints = Number(latestP.points || 0);
                             return (
                             <div key={p.id} className="flex flex-col items-center cursor-pointer relative group">
                                 <div className="relative mb-1">
                                   <div className="w-[50px] h-[55px] flex items-end justify-center overflow-visible drop-shadow-lg">
                                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${pName.replace(/ /g, '')}&backgroundColor=transparent`} alt={pName} className="w-[60px] h-[60px] object-cover" />
                                   </div>
                                   {(isC || isVC) && (
                                     <div className={`absolute top-0 -left-2 w-[18px] h-[18px] border border-white text-white rounded-full flex items-center justify-center text-[9px] font-bold shadow-md z-10 ${isC ? 'bg-[#d32f2f]' : 'bg-transparent text-white'}`}>
                                       {isC ? 'C' : 'VC'}
                                     </div>
                                   )}
                                 </div>
                                 <div className="bg-black text-white text-[10px] font-medium px-2 py-0.5 rounded shadow-md whitespace-nowrap w-[70px] text-center truncate relative z-10">{pName}</div>
                                 <span className="text-white text-[10px] mt-1 font-semibold drop-shadow-sm">
                                   {isLiveOrCompleted ? `${(pPoints * (isC ? 2 : isVC ? 1.5 : 1)).toFixed(1)} Pt.` : `${p.credits || 0} Cr`}
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
           {team && (team || []).map(player => (
               <div key={player.id} className="flex items-center p-3 border-b border-app-border">
               <div className="w-12 h-12 rounded-full bg-app-bg flex items-end justify-center overflow-hidden shrink-0 border border-app-border">
                  <User size={40} className="text-app-text-muted translate-y-2" />
               </div>
               <div className="flex-1 pl-3">
                  <h4 className="font-bold text-sm text-app-text">{player.name}</h4>
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] font-medium text-app-text-muted">{player.team} | {player.role}</span>
                     {player.isPlaying === true && <span className="flex items-center gap-1.5 text-[10px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded-sm"><Check size={8} strokeWidth={4} /> Playing</span>}
                     {player.isPlaying === false && <span className="flex items-center gap-1.5 text-[10px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded-sm"><div className="w-1 h-1 bg-red-500 rounded-full"></div> Not Playing</span>}
                  </div>
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

     const myUserId = user?.id || 'guest';
     const filteredTeams = savedTeams.filter(st => {
         if (st.userId !== myUserId) return false;
         const matchFromApp = appMatches.find(m => m.id === st.match?.id);
         if (!matchFromApp) return false; // Hide if match was deleted
         const currentMatchStatus = matchFromApp.status;
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
                     const currentMatchFromApp = appMatches.find(m => m.id === st.match?.id);
                     const currentMatchStatus = currentMatchFromApp?.status || 'Completed';
                     
                     // Calculate dynamic points
                     const totalPoints = (st.players || []).reduce((acc: number, player: Player) => {
                        const livePlayer = appPlayers.find(p => p.id === player.id) || player;
                        let mult = 1;
                        if (livePlayer.id === st.captain) mult = 2;
                        else if (livePlayer.id === st.viceCaptain) mult = 1.5;
                        const pts = Number(livePlayer.points || 0);
                        return acc + (pts * mult);
                     }, 0);

                     return (
                         <div key={i} className={`bg-app-card rounded-xl shadow-sm border border-app-border overflow-hidden ${currentMatchStatus === 'Completed' ? 'opacity-60' : ''}`}>
                            <div className="px-3 py-2.5 bg-app-card-inner border-b border-app-border flex justify-between items-center text-xs font-bold text-app-text-muted">
                               <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                                  <span className="truncate max-w-[40%] sm:max-w-none">{st.match?.series}</span>
                                  {currentMatchStatus === 'Upcoming' && (
                                     <div className="flex flex-shrink-0 gap-1.5">
                                        <button 
                                           onClick={(e) => {
                                               e.stopPropagation();
                                               setActiveMatch(st.match);
                                               const cMatch = appContests.find(cc => cc.name === st.contestName);
                                               if (cMatch) setActiveContestDetails(cMatch);
                                               setActiveContestInstanceId(st.instanceId);
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
                                               const cMatch = appContests.find(cc => cc.name === st.contestName);
                                               if (cMatch) setActiveContestDetails(cMatch);
                                               setActiveContestInstanceId(st.instanceId);
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
                                          const realIndex = savedTeams.findIndex(orig => orig.id === st.id);
                                          setEditingSavedTeamIndex(realIndex);
                                          setEditReturnView('MY_MATCHES');
                                          setActiveMatch(st.match);
                                          const cMatch = appContests.find(cc => cc.name === st.contestName);
                                          if (cMatch) setActiveContestDetails(cMatch);
                                          setActiveContestInstanceId(st.instanceId);
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
                               <div className="flex justify-between items-center text-center">
                                 <div className="flex flex-col items-center gap-1 w-20">
                                   <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm overflow-hidden shadow-inner border border-app-border bg-app-bg ${st.match?.team1?.color?.startsWith('bg-') ? st.match.team1.color : ''}`} style={!st.match?.team1?.color?.startsWith('bg-') ? {backgroundColor: st.match?.team1?.color} : {}}>
                                      {st.match?.team1?.flagUrl ? <img src={st.match?.team1?.flagUrl} className={`w-full h-full ${st.match?.team1?.flagFit === 'contain' ? 'object-contain' : 'object-cover'}`} /> : st.match?.team1?.shortFrame}
                                   </div>
                                   <span className="font-bold text-xs truncate w-full">{st.match?.team1?.shortFrame}</span>
                                 </div>
                                 <div className="flex flex-col items-center flex-1">
                                    <span className="bg-red-50 text-app-accent px-2 py-1 rounded text-[10px] font-bold">{currentMatchStatus === 'Live' ? 'In Progress' : currentMatchStatus === 'Completed' ? 'Ended' : st.match?.time}</span>
                                    {(currentMatchStatus === 'Live' || currentMatchStatus === 'Completed') && (
                                       <span className="text-sm font-black text-green-500 mt-1">{totalPoints} pts</span>
                                    )}
                                    {currentMatchStatus === 'Completed' && st.prizeDistributed && st.amountWon !== undefined && (
                                       <span className="text-xs font-black text-[#e5c158] mt-0.5 tracking-tight uppercase">Won ₹{Number(st.amountWon || 0).toFixed(2)}</span>
                                    )}
                                 </div>
                                 <div className="flex flex-col items-center gap-1 w-20">
                                   <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm overflow-hidden shadow-inner border border-app-border bg-app-bg ${st.match?.team2?.color?.startsWith('bg-') ? st.match.team2.color : ''}`} style={!st.match?.team2?.color?.startsWith('bg-') ? {backgroundColor: st.match?.team2?.color} : {}}>
                                      {st.match?.team2?.flagUrl ? <img src={st.match?.team2?.flagUrl} className={`w-full h-full ${st.match?.team2?.flagFit === 'contain' ? 'object-contain' : 'object-cover'}`} /> : st.match?.team2?.shortFrame}
                                   </div>
                                   <span className="font-bold text-xs truncate w-full">{st.match?.team2?.shortFrame}</span>
                                 </div>
                               </div>
                               <div className="bg-app-bg rounded p-2 flex justify-between items-center border border-app-border">
                                 <span className="text-xs font-bold text-app-text-muted">{st.contestName}</span>
                                 <span className="text-xs font-bold text-app-text-muted">Entry: ₹{st.fee}</span>
                               </div>
                            </div>
                            <div className="px-4 py-3 bg-app-card-inner border-t border-app-border flex justify-between items-center gap-3">
                               <button 
                                   onClick={() => {
                                       const latestMatch = appMatches.find(m => m.id === st.match?.id) || st.match;
                                       if (currentMatchStatus !== 'Upcoming') {
                                           setActiveMatch(latestMatch);
                                           setSelectedContest({ fee: st.fee, name: st.contestName });
                                           const c = appContests.find(c => c.name === st.contestName) || appContests[0];
                                           setActiveContestInstanceId(st.instanceId);
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
                                   className={`font-bold text-xs active:opacity-70 w-full py-2 rounded-full text-center border ${currentMatchStatus !== 'Upcoming' ? 'bg-app-accent text-white border-blue-600' : 'text-blue-600 bg-blue-50 border-blue-200 shadow-sm'}`}
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
                     <span className="font-bold text-app-text text-sm">₹{Number(wallet.deposit || 0).toLocaleString('en-IN', {maximumFractionDigits:0})}</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-xs text-app-text-muted">Winnings</span>
                     <span className="font-bold text-[#4ADE80] text-sm">₹{Number(wallet.winning || 0).toLocaleString('en-IN', {maximumFractionDigits:0})}</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-xs text-app-text-muted">Bonus</span>
                     <span className="font-bold text-[#FFD700] text-sm">₹{Number(wallet.bonus || 0).toLocaleString('en-IN', {maximumFractionDigits:0})}</span>
                  </div>
               </div>

               <div className="flex gap-3">
                 <button 
                   onClick={() => setShowPaymentModal(true)}
                   className="flex-[1.2] bg-app-accent hover:bg-app-accent text-white font-bold py-3 text-sm rounded-lg active:scale-[0.98] flex justify-center items-center gap-2"
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
                              {req.status === 'Approved' ? <Check size={20} /> : req.status === 'Rejected' ? <X size={20} /> : <Clock size={20} />}
                           </div>
                           <div className="flex flex-col">
                              <p className="font-bold text-sm text-app-text">
                                  {req.status === 'Rejected' ? 'Payment Failed' : req.status === 'Pending' ? `Pending ${req.t === 'd' ? 'Deposit' : 'Withdrawal'}` : (req.t === 'd' ? 'Added to wallet' : 'Withdrawn')}
                              </p>
                              <p className="text-xs text-app-text-muted mt-0.5">{req.timestamp}</p>
                           </div>
                        </div>
                        <span className={`font-bold text-lg ${req.status === 'Approved' ? (req.t === 'd' ? 'text-[#4ADE80]' : 'text-app-text') : req.status === 'Rejected' ? 'text-app-accent opacity-80' : 'text-orange-500'}`}>
                           {req.status === 'Rejected' ? 'Failed' : `${req.t === 'd' ? '+' : '-'}₹${req.amount}`}
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
                         <div className="flex flex-col items-center justify-center gap-2 mb-2">
                             {adminUpiQR && <img src={adminUpiQR} referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.src = 'https://placehold.co/150x150?text=Invalid+Image+URL'; }} alt="UPI QR Code" className="w-[150px] h-[150px] object-cover rounded-xl border-2 border-blue-500 shadow-sm" />}
                         </div>
                         <div className="flex items-center justify-between">
                             <p className="text-lg font-mono font-black text-app-text tracking-wide">{adminUPI || 'admin@ybl'}</p>
                             <button className="text-blue-600 text-xs font-bold bg-app-card px-2 py-1 rounded shadow-sm" onClick={() => navigator.clipboard.writeText(adminUPI || 'admin@ybl')}>Copy</button>
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
                           disabled={isScanningPayment}
                           className={`flex-1 border-2 border-app-border text-app-text-muted font-bold py-3 rounded-xl active:bg-app-card-inner ${isScanningPayment ? 'opacity-50' : ''}`}
                        >
                           Back
                        </button>
                        <button 
                           disabled={isScanningPayment}
                           onClick={() => {
                              if (paymentUtr.length < 8) return alert('Please enter a valid UTR number.');
                              const amt = parseFloat(paymentAmount);
                              
                              setIsScanningPayment(true);
                              
                              const newReq: DepositRequest = {
                                 id: 'dep_' + Date.now(),
                                 userId: user?.id,
                                 userNumericId: user?.numericId,
                                 userName: user?.name,
                                 amount: amt,
                                 method: paymentMethod,
                                 utr: paymentUtr,
                                 status: 'Pending',
                                 timestamp: new Date().toLocaleTimeString()
                              };

                              setDoc(doc(db, 'deposits', newReq.id), newReq).then(() => {
                                 setIsScanningPayment(false);
                                 alert("Deposit submitted successfully!");
                                 setShowPaymentModal(false);
                                 setPaymentMethod('');
                                 setPaymentUtr('');
                              });
                           }}
                           className={`flex-[2] ${isScanningPayment ? 'bg-green-500' : 'bg-green-600 hover:bg-green-700'} text-app-text font-bold py-3 rounded-xl active:bg-green-800 shadow-sm transition-all flex justify-center items-center gap-2`}
                        >
                           {isScanningPayment ? <><Check size={20}/> Submitted</> : 'Submit Proof'}
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

    const totalWins = wallet?.wins || 0;
    const winningRate = contestsJoined > 0 ? Math.round((totalWins / contestsJoined) * 100) : 0;
    const totalProfit = wallet?.profits || 0;

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
                   {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col text-app-text">
                   <h2 className="text-xl font-bold uppercase">{user?.name || 'User'}</h2>
                   <p className="text-sm opacity-90 mb-2 font-mono">ID: {user?.numericId || 'Loading...'}</p>
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
              <div className="bg-[#e5c158]/10 border border-[#e5c158]/30 rounded-xl p-4 mb-4 flex flex-col gap-3">
                 <h3 className="font-bold text-[#e5c158] flex items-center gap-2 text-sm">🎁 Milestone Rewards!</h3>
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
              <div className="bg-app-card rounded-xl flex-1 p-4 flex flex-col items-center justify-center border border-app-border shadow-sm col-span-2">
                <span className="text-xs text-app-text-muted mb-2 text-center font-bold uppercase tracking-wider">Total Profit Earned</span>
                <span className="text-3xl font-black text-[#4ADE80]">₹{Number(totalProfit || 0).toLocaleString('en-IN')}</span>
              </div>
           </div>

           <div className="bg-app-card rounded-xl shadow-sm border border-app-border overflow-hidden mb-6">
              <div className="p-3 border-b border-app-border bg-app-card-inner">
                 <h3 className="font-bold text-sm text-app-text flex items-center gap-2">My Wallet</h3>
              </div>
              <div className="grid grid-cols-3 divide-x divide-app-border">
                 <div className="p-3 flex flex-col items-center justify-center hover:bg-app-card-hover transition-colors">
                    <span className="text-app-text-muted text-[10px] font-bold uppercase tracking-wider mb-1">Deposit</span>
                    <span className="font-bold text-blue-400">₹{Number(wallet.deposit || 0).toLocaleString('en-IN', {maximumFractionDigits:0})}</span>
                 </div>
                 <div className="p-3 flex flex-col items-center justify-center hover:bg-app-card-hover transition-colors">
                    <span className="text-app-text-muted text-[10px] font-bold uppercase tracking-wider mb-1">Winnings</span>
                    <span className="font-bold text-green-400">₹{Number(wallet.winning || 0).toLocaleString('en-IN', {maximumFractionDigits:0})}</span>
                 </div>
                 <div className="p-3 flex flex-col items-center justify-center hover:bg-app-card-hover transition-colors">
                    <span className="text-app-text-muted text-[10px] font-bold uppercase tracking-wider mb-1">Bonus</span>
                    <span className="font-bold text-[#e5c158]">₹{Number(wallet.bonus || 0).toLocaleString('en-IN', {maximumFractionDigits:0})}</span>
                 </div>
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

           {isAdmin && (
               <button 
                 onClick={() => setView('ADMIN')}
                 className="w-full mt-6 bg-[#e5c158]/20 border border-[#e5c158]/50 text-[#e5c158] font-bold py-3 rounded-xl shadow-sm active:scale-95 transition-all flex justify-center items-center gap-2 uppercase tracking-wide"
               >
                 <Shield size={18} /> Admin Panel
               </button>
           )}

           <button 
             onClick={async () => {
                try {
                  if (supabase) await supabase.auth.signOut();
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
        userNumericId: user?.numericId,
        userName: user?.name || String(user?.email || '').split('@')[0] || 'Guest Player',
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
                   className="w-full bg-app-accent hover:bg-app-accent text-white font-bold py-3.5 rounded-lg active:scale-[0.98] mt-4 shadow-sm"
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

    const handleAuth = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      
      const hasPermission = localStorage.getItem('dreamApp_phonePermission') === 'true';
      if (!hasPermission && authMode !== 'OTP') {
         setShowPhonePermissionDialog(true);
         return;
      }
      
      if (authMode === 'OTP') {
        if (!enteredOtp) return alert("Please enter the OTP.");
        
        setAuthLoading(true);
        try {
           if ((window as any).confirmationResult) {
              await (window as any).confirmationResult.confirm(enteredOtp);
              // Successfully verified via Firebase
           } else {
              if (enteredOtp !== sentOtp) {
                 setAuthLoading(false);
                 return alert("Invalid OTP entered. Please try again.");
              }
           }
        } catch(e) {
           console.error("OTP Verification failed", e);
           setAuthLoading(false);
           return alert("Invalid OTP or verification expired.");
        }
        
        sessionStorage.removeItem('isPendingOtp');
               
        // Complete the login sequence successfully
        let numericId = localStorage.getItem(`dreamApp_numericId_${tempFirebaseUser.uid}`) || '';
        let fullName = tempFirebaseUser.displayName || 'Fantasy Player';
        
        const userDocRef = doc(db, 'users', tempFirebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
           const data = userDoc.data();
           numericId = data.numericId || numericId;
           fullName = data.name || fullName;
        }
        
        if (numericId) {
            localStorage.setItem(`dreamApp_numericId_${tempFirebaseUser.uid}`, numericId);
        }
        
        localStorage.setItem('dreamApp_hasSignedUp', 'true');
        const newUser = {
          email: tempFirebaseUser.email || '',
          name: fullName,
          id: tempFirebaseUser.uid,
          numericId: numericId
        };
        localStorage.setItem('dreamApp_user', JSON.stringify(newUser));
        setUser(newUser);
        setTempFirebaseUser(null);
        return;
      }
      
      if (authMode === 'SIGNUP') {
        if (!authFullName || !authMobile || !authPassword) {
          return alert("Please fill all fields: Name, Mobile and Password");
        }
        if (!/^\d{10}$/.test(authMobile.trim())) {
          return alert("Please enter a valid 10-digit mobile number");
        }
      } else if (authMode === 'LOGIN') {
        if (!authInput || !authPassword) return alert("Please enter mobile number and password");
      }

      setAuthLoading(true);
      try {
        if (authMode === 'SIGNUP') {
          // 1. Check if mobile already exists in Firestore
          const usersRef = collection(db, 'users');
          const mobileQuery = query(usersRef, where('mobile', '==', authMobile.trim()));
          const mobileSnap = await getDocs(mobileQuery);
          
          if (!mobileSnap.empty) {
            setAuthLoading(false);
            return alert("This mobile number is already registered! Please login.");
          }

          sessionStorage.setItem('isSigningUp', 'true');
          const pseudoEmail = `${authMobile.trim()}@dreamapp.com`;
          
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: pseudoEmail,
            password: authPassword,
            options: {
              data: {
                full_name: authFullName.trim(),
                mobile: authMobile.trim()
              }
            }
          });
          
          if (signUpError) throw signUpError;
          const user = signUpData.user;
          const numericId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
          
          if (user) {
            await setDoc(doc(db, 'users', user.id), {
               name: authFullName.trim(),
               mobile: authMobile.trim(),
               email: pseudoEmail,
               numericId: numericId,
               createdAt: new Date().toISOString(),
               balance: 0,
               winnings: 0,
               bonus: 100, // Welcome bonus
               isBot: false
            });
          }
          
          sessionStorage.removeItem('isSigningUp');
          localStorage.setItem('dreamApp_hasSignedUp', 'true');
          if (supabase) await supabase.auth.signOut();
          
          alert("Signup successful! Now please login to your account.");
          setAuthMode('LOGIN');
          setAuthPassword('');
          setAuthFullName('');
          setAuthMobile('');
        } else if (authMode === 'LOGIN') {
          let loginEmail = authInput.trim();
          
          // If input is mobile number, find corresponding email or use pseudo
          if (/^\d{10}$/.test(loginEmail)) {
            // First check if user exists with standard format
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('mobile', '==', loginEmail));
            const snap = await getDocs(q);
            
            if (snap.empty) {
              setAuthLoading(false);
              return alert("No account found with this mobile number.");
            }
            loginEmail = snap.docs[0].data().email || `${loginEmail}@dreamapp.com`;
          }
          
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password: authPassword
          });
          
          if (signInError) throw signInError;
          // onAuthStateChange in useEffect will catch this and log the user in!
        }
      } catch (err: any) {
        handleFsError(err, 'auth_action');
        console.error("Auth error", err);
        let msg = err.message;
        if (err.code === 'auth/email-already-in-use') msg = "Mobile number already registered! Please login.";
        else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') msg = "Incorrect mobile number or password.";
        else if (err.code === 'auth/invalid-email') msg = "Invalid format.";
        else if (err.code === 'auth/network-request-failed') msg = "Network error. Please check your internet connection.";
        alert(msg);
      } finally {
        setAuthLoading(false);
        sessionStorage.removeItem('isSigningUp');
      }
    };

    return (
    <div className={`relative h-[100dvh] w-full max-w-md mx-auto bg-app-bg text-app-text font-sans shadow-2xl overflow-hidden border-x border-app-border flex flex-col ${themeMode === 'Light' ? 'theme-light' : ''} color-${themeColor.toLowerCase()}`}>
       <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
          <div className="w-20 h-20 bg-app-accent rounded-2xl mb-6 flex items-center justify-center shadow-lg rotate-3 shrink-0">
             <Trophy size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight italic mb-1 text-app-text">Fantasy<span className="text-app-accent">11</span></h1>
          <p className="text-app-text-muted font-bold mb-8 text-center text-[10px] uppercase tracking-widest leading-none">Play Fantasy Sports & Win Cash Prizes!</p>
          
          <div className="w-full">
             <form onSubmit={handleAuth} className="flex flex-col gap-3.5">
               {authMode === 'OTP' ? (
                 <>
                   <p className="text-sm font-bold text-center text-app-text mb-4">Enter the 6-digit OTP sent to your mobile number.</p>
                   <div className="space-y-3.5">
                      <div className="relative">
                        <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" />
                        <input 
                          type="text" 
                          placeholder="Enter 6-digit OTP" 
                          maxLength={6}
                          value={enteredOtp}
                          onChange={e => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-app-card border border-app-border text-app-text pl-12 pr-4 py-3.5 rounded-xl outline-none focus:border-app-accent font-bold text-sm transition-all tracking-[0.5em] text-center"
                        />
                      </div>
                   </div>
                 </>
               ) : authMode === 'SIGNUP' ? (
                 <>
                   <div className="space-y-3.5">
                      <div className="relative">
                        <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" />
                        <input 
                          type="text" 
                          placeholder="First & Last Name" 
                          value={authFullName}
                          onChange={e => setAuthFullName(e.target.value)}
                          className="w-full bg-app-card border border-app-border text-app-text pl-12 pr-4 py-3.5 rounded-xl outline-none focus:border-app-accent font-bold text-sm transition-all"
                        />
                      </div>
                      <div className="relative">
                        <PlayCircle size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" />
                        <input 
                          type="tel" 
                          placeholder="Mobile Number (10 digits)" 
                          maxLength={10}
                          value={authMobile}
                          onChange={e => setAuthMobile(e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-app-card border border-app-border text-app-text pl-12 pr-4 py-3.5 rounded-xl outline-none focus:border-app-accent font-bold text-sm transition-all"
                        />
                      </div>
                      <div className="relative">
                        <Settings size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" />
                        <input 
                          type="password" 
                          placeholder="Create Password" 
                          value={authPassword}
                          onChange={e => setAuthPassword(e.target.value)}
                          className="w-full bg-app-card border border-app-border text-app-text pl-12 pr-4 py-3.5 rounded-xl outline-none focus:border-app-accent font-bold text-sm transition-all"
                        />
                      </div>
                   </div>
                 </>
               ) : (
                 <>
                   <div className="space-y-3.5">
                      <div className="relative">
                        <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" />
                        <input 
                          type="tel" 
                          placeholder="Mobile Number" 
                          value={authInput}
                          onChange={e => setAuthInput(e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-app-card border border-app-border text-app-text pl-12 pr-4 py-3.5 rounded-xl outline-none focus:border-app-accent font-bold text-sm transition-all"
                        />
                      </div>
                      <div className="relative">
                        <Settings size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" />
                        <input 
                          type="password" 
                          placeholder="Password" 
                          value={authPassword}
                          onChange={e => setAuthPassword(e.target.value)}
                          className="w-full bg-app-card border border-app-border text-app-text pl-12 pr-4 py-3.5 rounded-xl outline-none focus:border-app-accent font-bold text-sm transition-all"
                        />
                      </div>
                   </div>
                 </>
               )}
               
               <button 
                 type="submit"
                 disabled={authLoading}
                 className="w-full bg-app-accent text-white font-black py-4 rounded-xl shadow-lg shadow-app-accent/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 mt-2 uppercase tracking-widest text-sm"
               >
                 {authLoading ? 'Authenticating...' : (authMode === 'OTP' ? 'Verify OTP' : (authMode === 'LOGIN' ? 'Login' : 'Create Account'))}
               </button>
             </form>
             <div id="recaptcha-container"></div>

             {authMode !== 'OTP' && (
               <div className="text-center mt-6">
                 <button 
                   type="button"
                   onClick={() => {
                     setAuthMode(prev => prev === 'LOGIN' ? 'SIGNUP' : 'LOGIN');
                     setAuthError('');
                   }}
                   className="group text-xs text-app-text-muted font-bold transition-all"
                 >
                   {authMode === 'LOGIN' ? (
                      <>New here? <span className="text-app-accent group-hover:underline ml-1">Create an account</span></>
                   ) : (
                      <>Already have an account? <span className="text-app-accent group-hover:underline ml-1">Login now</span></>
                   )}
                 </button>
               </div>
             )}

             <div className="relative flex items-center py-6">
                <div className="flex-grow border-t border-app-border"></div>
                <span className="flex-shrink-0 mx-4 text-app-text-muted text-[10px] font-black uppercase tracking-widest">OR</span>
                <div className="flex-grow border-t border-app-border"></div>
             </div>

             <button 
                onClick={async () => {
                   try {
                     setAuthLoading(true);
                     if (!supabase) {
                       console.error("Supabase is missing!", { supabaseUrl: process.env.SUPABASE_URL });
                       alert("Supabase integration is under configuration... please try again shortly!");
                       return;
                     }
                     console.log("Using Supabase for Google login...");
                     const { data, error } = await supabase.auth.signInWithOAuth({
                       provider: 'google',
                       options: {
                         redirectTo: window.location.origin
                       }
                     });
                     if (error) throw error;
                   } catch (error) {
                     console.error("Supabase Google login failed", error);
                     alert("Google login failed. Please try again.");
                   } finally {
                     setAuthLoading(false);
                   }
                }}
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-3 bg-app-card border border-app-border font-bold text-sm py-3.5 rounded-xl shadow-sm hover:border-app-accent/50 active:scale-95 transition-all disabled:opacity-50"
             >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                   <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                   <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                   <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                   <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-app-text">Continue with Google</span>
             </button>
          </div>

          <p className="text-[10px] text-app-text-muted text-center mt-12 px-6 leading-relaxed">
             By joining, you agree to our <span className="text-app-text font-bold">Terms of Service</span> and <span className="text-app-text font-bold">Privacy Policy</span>. Responsible gaming only.
          </p>
       </div>
       
       {showPhonePermissionDialog && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-app-card rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-app-border animate-in fade-in zoom-in duration-200">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                 <Shield size={32} className="text-blue-500" />
              </div>
              <h3 className="text-xl font-black text-center text-app-text mb-2 tracking-tight">Phone Access Required</h3>
              <p className="text-sm text-center text-app-text-muted mb-6 leading-relaxed">
                 Fantasy11 needs permission to access your phone state and SMS to securely send and verify your OTP for login.
              </p>
              
              <div className="flex gap-3">
                 <button 
                   onClick={() => setShowPhonePermissionDialog(false)}
                   className="flex-1 py-3 bg-app-card-inner text-app-text rounded-xl font-bold border border-app-border hover:bg-app-bg"
                 >
                   Deny
                 </button>
                 <button 
                   onClick={() => {
                     setPhonePermissionGranted(true);
                     localStorage.setItem('dreamApp_phonePermission', 'true');
                     setShowPhonePermissionDialog(false);
                     // Need a tiny delay for state to sync before handleAuth checks phonePermissionGranted
                     setTimeout(() => {
                        handleAuth();
                     }, 100);
                   }}
                   className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 active:scale-95"
                 >
                   Allow
                 </button>
              </div>
           </div>
         </div>
       )}
    </div>
    );
  };

  if (!user) return renderLogin();
  
  const syncBotsOnlyToCloud = async () => {
    if (!isAdmin) return;
    try {
      const ts = Date.now();
      const adminTeams = savedTeams.filter(t => t.userId === 'admin_bot' || t.userId === 'admin_bot_boot');

      const saveChunks = async (key: string, data: any[], itemsPerChunk = 1000) => {
          const CHUNK_SIZE = itemsPerChunk; 
          const chunks = [];
          for (let i = 0; i < data.length; i += CHUNK_SIZE) {
              chunks.push(data.slice(i, i + CHUNK_SIZE));
          }
          const metaRef = doc(db, 'gameData', `${key}_meta`);
          const metaSnap = await getDoc(metaRef);
          if (metaSnap.exists()) {
              const prevCount = metaSnap.data().count || 0;
              if (prevCount > chunks.length) {
                  const deletePromises = [];
                  for (let i = chunks.length; i < prevCount; i++) {
                      deletePromises.push(deleteDoc(doc(db, 'gameData', `${key}_chunk_${i}`)).catch(() => {}));
                  }
                  await Promise.all(deletePromises);
              }
          }
          await setDoc(metaRef, { count: chunks.length, timestamp: ts, total: data.length });
          
          const BATCH_SIZE = 5;
          for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
              const batch = chunks.slice(i, i + BATCH_SIZE).map((chunk, idx) => 
                  setDoc(doc(db, 'gameData', `${key}_chunk_${i + idx}`), { data: JSON.parse(JSON.stringify(chunk)), timestamp: ts })
              );
              await Promise.all(batch);
          }
      };

      // bots have lightweight payload, so 800-1000 per chunk is very safe and efficient
      await saveChunks('adminTeams', adminTeams, 800);
      lastLoadTs.current = ts; // Update local TS to avoid self-reload
      await setDoc(doc(db, 'gameData', 'sync_meta'), { lastUpdate: ts, type: 'bots' });
      console.log("Cloud sync successful (Bots Only)");
    } catch (e: any) {
      console.error("Cloud bot sync failed:", e);
      if (e.message?.includes('quota')) {
         throw new Error("Firestore free limit reached for today. Please wait for quota to reset.");
      }
      throw e;
    }
  };

  const handleSyncBotsOnly = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      await syncBotsOnlyToCloud();
      setSyncMessage({type: 'success', text: '✅ Bot update successful!'});
    } catch (e: any) {
      console.error(e);
      alert("❌ Bot Update Failed: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncActiveDataToCloud = async () => {
    if (!isAdmin) return;
    try {
      const ts = Date.now();
      // Keep all matches and contests to avoid data loss.
      // Chunks will handle the payload size issue.
      const allMatches = [...appMatches];
      const allContests = [...appContests];
      const adminTeams = savedTeams.filter(t => t.userId === 'admin_bot' || t.userId === 'admin_bot_boot');

      const saveChunks = async (key: string, data: any[], itemsPerChunk = 500) => {
          const CHUNK_SIZE = itemsPerChunk; 
          const chunks = [];
          for (let i = 0; i < data.length; i += CHUNK_SIZE) {
              chunks.push(data.slice(i, i + CHUNK_SIZE));
          }
          const metaRef = doc(db, 'gameData', `${key}_meta`);
          const metaSnap = await getDoc(metaRef);
          if (metaSnap.exists()) {
              const prevCount = metaSnap.data().count || 0;
              if (prevCount > chunks.length) {
                  const deletePromises = [];
                  for (let i = chunks.length; i < prevCount; i++) {
                      deletePromises.push(deleteDoc(doc(db, 'gameData', `${key}_chunk_${i}`)).catch(() => {}));
                  }
                  await Promise.all(deletePromises);
              }
          }
          await setDoc(metaRef, { count: chunks.length, timestamp: ts, total: data.length });
          
          // Speed up writes by using small parallel batches (10 at a time)
          const BATCH_SIZE = 5;
          for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
              const batch = chunks.slice(i, i + BATCH_SIZE).map((chunk, idx) => 
                  setDoc(doc(db, 'gameData', `${key}_chunk_${i + idx}`), { data: JSON.parse(JSON.stringify(chunk)), timestamp: ts })
              );
              await Promise.all(batch);
          }
      };

      await Promise.all([
          saveChunks('matches', allMatches, 200), 
          saveChunks('contests', allContests, 200), 
          setDoc(doc(db, 'gameData', 'banners'), { data: JSON.parse(JSON.stringify(appBanners)), timestamp: ts }),
          saveChunks('players', appPlayers, 1000), 
          saveChunks('adminTeams', adminTeams, 800)
      ]);
      lastLoadTs.current = ts;
      await setDoc(doc(db, 'gameData', 'sync_meta'), { lastUpdate: ts });
      console.log("Cloud sync successful (All Data)");
    } catch (e) {
      console.error("Cloud sync failed:", e);
      throw e;
    }
  };

  const handleSyncToCloud = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      await syncActiveDataToCloud();
      alert(`✅ Update Successful!\n- All Matches, Contests & Price Pools synced.\n- Data split into small chunks to prevent size errors.\n- Everything is now up to date for all players.`);
      setSyncMessage({type: 'success', text: '✅ Successfully synced all data to cloud.'});
    } catch (e: any) {
      console.error(e);
      let errorMsg = e.message;
      if (errorMsg.includes('payload size exceeds the limit')) {
        errorMsg = "Data size issue. Automated cleaning of old data recommended. (डेटा बहुत बड़ा है, पुराना डेटा ऑटोमैटिक डिलीट करने की सलाह दी जाती है)";
      }
      alert("❌ Sync Failed: " + errorMsg);
      setSyncMessage({type: 'error', text: 'Failed to sync: ' + errorMsg});
    } finally {
      setIsSyncing(false);
    }
  };

  const renderAdminPanel = () => {
    if (!isAdmin) return null;

    const userActivityData = [
      { name: 'Jan', active: 300, new: 150 },
      { name: 'Feb', active: 450, new: 200 },
      { name: 'Mar', active: 900, new: 300 },
      { name: 'Apr', active: 600, new: 250 },
      { name: 'May', active: 800, new: 280 },
      { name: 'Jun', active: 650, new: 220 },
      { name: 'Jul', active: 1000, new: 400 },
    ];

    const matchStatusData = [
      { name: 'Jan', cricket: 40, other: 24 },
      { name: 'Feb', cricket: 70, other: 45 },
      { name: 'Mar', cricket: 90, other: 50 },
      { name: 'Apr', cricket: 65, other: 40 },
      { name: 'May', cricket: 85, other: 55 },
      { name: 'Jun', cricket: 110, other: 60 },
      { name: 'Jul', cricket: 60, other: 30 },
      { name: 'Aug', cricket: 95, other: 75 },
    ];

    const finData1 = [ {v:10}, {v:25}, {v:15}, {v:40}, {v:30}, {v:50} ];
    const finData2 = [ {v:20}, {v:10}, {v:30}, {v:15}, {v:45}, {v:25} ];
    const finData3 = [ {v:15}, {v:30}, {v:20}, {v:45}, {v:35}, {v:60} ];


    return (
       <div className="flex flex-col h-full bg-[#090b10] text-slate-200 font-sans">
          <header className="bg-[#13151c] border-b border-[#e5c158]/20 p-4 shrink-0 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-[#e5c158]/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
             <div className="flex items-center justify-between relative z-10">
                 <div className="flex items-center gap-3">
                    <h2 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-[#e5c158] to-[#f0b90b] uppercase tracking-widest text-lg drop-shadow-[0_0_12px_rgba(229,193,88,0.4)]">VIP</h2>
                 </div>
                 <div className="flex items-center gap-2">
                    <button onClick={() => setShowDashboardUsers(true)} className="w-9 h-9 rounded-xl bg-[#e5c158]/10 border border-[#e5c158]/30 flex items-center justify-center text-[#e5c158] overflow-hidden shadow-[0_0_10px_rgba(229,193,88,0.2)] hover:bg-[#e5c158]/20 transition-colors cursor-pointer">
                       <User size={18} />
                    </button>
                    <button onClick={() => setView('HOME')} className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 transition-all">
                       <Home size={18} />
                    </button>
                 </div>
             </div>
             
             <div className="flex gap-1 mt-6 overflow-x-auto no-scrollbar relative z-10">
                 {(['DASHBOARD', 'TEAMS', 'USERS', 'CONTESTS', 'MATCHES', 'FINANCIALS', 'BANNERS', 'SETTINGS', 'ENTRY FEES'] as const).map(tab => (
                    <button 
                      key={tab}
                      onClick={() => setAdminTab(tab)}
                      className={`px-4 py-2.5 rounded-lg text-[10.5px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${adminTab === tab ? 'bg-gradient-to-r from-[#f0b90b] to-[#e5c158] text-black shadow-[0_0_15px_rgba(240,185,11,0.3)]' : 'text-slate-400 hover:bg-white/5 border border-transparent'}`}
                    >
                       {tab}
                    </button>
                 ))}
             </div>
          </header>
          
          <div className="flex-1 p-4 overflow-y-auto bg-[#090b10]">
{adminTab === 'DASHBOARD' && (<>
<div className="space-y-6">
<div className="mb-6">
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl mb-6">
                    <p className="text-xs text-yellow-200 font-medium leading-relaxed">
                        <span className="font-bold text-yellow-400">ADMIN TIP:</span> Use the <span className="font-black text-green-400 uppercase">"Update Apps & Player"</span> button in the top header to instantly sync matches, contests, and teams to all players' devices.
                    </p>
                </div>
                {syncMessage && (
                  <div className={`mt-3 p-3 text-sm rounded-lg ${syncMessage.type === 'success' ? 'bg-green-900/50 text-green-400 border border-green-500/50' : 'bg-red-900/50 text-red-400 border border-red-500/50'}`}>
                     {syncMessage.text}
                  </div>
                )}
             </div>

             
</div>


<div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
    {/* Left Column (Real-time User Activity & Financial Overview) */}
    <div className="lg:col-span-5 flex flex-col gap-5">
        {/* Real-time User Activity */}
        <div className="bg-[#13151c] rounded-2xl border border-[#e5c158]/20 p-5 shadow-lg flex-1">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-200 tracking-wide">Real-time User Activity</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="p-2 -m-2 rounded transition-colors">
                     <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Total Users</p>
                    <p className="text-lg xl:text-xl font-bold text-slate-200 flex items-center gap-1">{adminUserList.length} <User size={14} className="text-[#e5c158]"/></p>
                </div>
                <div>
                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">New Signups</p>
                    <p className="text-lg xl:text-xl font-bold text-slate-200 flex items-center gap-1">{adminUserList.length} <ChevronUp size={14} className="text-green-500"/></p>
                </div>
                <div>
                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Total Entries</p>
                    <p className="text-lg xl:text-xl font-bold text-slate-200 flex items-center gap-1">{appContests.length + 3200} <ChevronDown size={14} className="text-red-500"/></p>
                </div>
            </div>
            
            <div className="h-[200px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={userActivityData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} padding={{ left: 10, right: 10 }} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#13151c', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="active" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorActive)" />
                    <Area type="monotone" dataKey="new" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorNew)" />
                  </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Financial Overview */}
        <div className="bg-[#13151c] rounded-2xl border border-[#e5c158]/20 p-5 shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-200 tracking-wide">Financial Overview</h3>
                <button onClick={() => setAdminTab('FINANCIALS')} className="px-3 py-1 rounded bg-[#090b10] border border-slate-700 text-xs text-slate-400 flex items-center gap-1 hover:border-[#e5c158]/50 transition-colors">View Finance <ChevronDown size={12} /></button>
            </div>
            {(() => {
                let totalRev = 0;
                depositRequests.forEach(d => {
                    if (d.status === 'Approved') totalRev += parseFloat(d.amount?.toString() || '0');
                });
            
                let totalPay = 0;
                withdrawRequests.forEach(w => {
                    if (w.status === 'Approved') totalPay += parseFloat(w.amount?.toString() || '0');
                });
            
                let margin = 0;
                if (totalRev > 0) {
                    margin = ((totalRev - totalPay) / totalRev) * 100;
                }
                
                const formatFinance = (val: number) => {
                    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
                    if (val >= 1000) return `₹${(val / 1000).toFixed(2)} K`;
                    return `₹${val.toFixed(0)}`;
                };

                return (
                    <div className="grid grid-cols-3 gap-2 xl:gap-4">
                        <div>
                           <p className="text-slate-400 text-[9px] xl:text-[10px] uppercase font-bold tracking-wider mb-1">Total Revenue</p>
                           <p className="text-base xl:text-lg font-black text-slate-200 mb-3">{formatFinance(totalRev)}</p>
                           <div className="h-[40px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                 <LineChart data={finData1}>
                                    <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                 </LineChart>
                              </ResponsiveContainer>
                           </div>
                        </div>
                        <div>
                           <p className="text-slate-400 text-[9px] xl:text-[10px] uppercase font-bold tracking-wider mb-1">Payouts</p>
                           <p className="text-base xl:text-lg font-black text-slate-200 mb-3 flex items-center gap-1">{formatFinance(totalPay)} {totalPay > 0 ? <ChevronUp size={12} className="text-red-500"/> : null}</p>
                           <div className="h-[40px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                 <LineChart data={finData2}>
                                    <Line type="monotone" dataKey="v" stroke="#eab308" strokeWidth={2} dot={false} />
                                 </LineChart>
                              </ResponsiveContainer>
                           </div>
                        </div>
                        <div>
                           <p className="text-slate-400 text-[9px] xl:text-[10px] uppercase font-bold tracking-wider mb-1">Profit Margin</p>
                           <p className="text-base xl:text-lg font-black text-slate-200 mb-3 flex items-center gap-1">{margin.toFixed(2)}% {margin > 0 ? <span className="text-[9px] text-green-500 ml-1">▲</span> : <span className="text-[9px] text-red-500 ml-1">▼</span>}</p>
                           <div className="h-[40px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                 <LineChart data={finData3}>
                                    <Line type="monotone" dataKey="v" stroke="#22c55e" strokeWidth={2} dot={false} />
                                 </LineChart>
                              </ResponsiveContainer>
                           </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    </div>

    {/* Middle Column (Match Status) */}
    <div className="lg:col-span-4 bg-[#13151c] rounded-2xl border border-[#e5c158]/20 p-5 shadow-lg flex flex-col">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-200 tracking-wide">Match Status</h3>
            <button onClick={() => setAdminTab('MATCHES')} className="px-3 py-1 rounded bg-[#090b10] border border-slate-700 text-xs text-slate-400 flex items-center gap-1 hover:border-[#e5c158]/50 transition-colors">Go to Matches <ChevronDown size={12} /></button>
        </div>
        
        <div className="flex items-center justify-between mb-6">
           <div className="flex flex-col items-center gap-2 cursor-pointer bg-[#e5c158]/10 border border-[#e5c158]/30 px-3 py-2 rounded-xl">
               <Trophy size={18} className="text-[#e5c158]" />
               <span className="text-[10px] xl:text-xs text-[#e5c158] font-bold">Cricket</span>
           </div>
           <div className="flex flex-col items-center gap-2 cursor-pointer hover:bg-slate-800 px-3 py-2 rounded-xl transition-all">
               <PlayCircle size={18} className="text-slate-400" />
               <span className="text-[10px] xl:text-xs text-slate-400 font-bold">Football</span>
           </div>
           <div className="flex flex-col items-center gap-2 cursor-pointer hover:bg-slate-800 px-3 py-2 rounded-xl transition-all">
               <Users size={18} className="text-slate-400" />
               <span className="text-[10px] xl:text-xs text-slate-400 font-bold">Kabaddi</span>
           </div>
           <div className="flex flex-col items-center gap-2 cursor-pointer hover:bg-slate-800 px-3 py-2 rounded-xl transition-all">
               <PlayCircle size={18} className="text-slate-400" />
               <span className="text-[10px] xl:text-xs text-slate-400 font-bold">Sports</span>
           </div>
        </div>

        <div className="h-[160px] xl:h-[180px] w-full mb-6">
           <ResponsiveContainer width="100%" height="100%">
               <BarChart data={matchStatusData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                   <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                   <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                   <RechartsTooltip cursor={{fill: '#1e293b'}} contentStyle={{ backgroundColor: '#13151c', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
                   <Bar dataKey="cricket" stackId="a" fill="#06b6d4" barSize={10} radius={[0, 0, 4, 4]} />
                   <Bar dataKey="other" stackId="a" fill="#3b82f6" barSize={10} radius={[4, 4, 0, 0]} />
               </BarChart>
           </ResponsiveContainer>
        </div>

        <div className="flex-1">
           <p className="text-[10px] xl:text-xs text-[#e5c158] font-bold uppercase tracking-widest mb-3 border-b border-slate-800 pb-2">Upcoming Matches</p>
           
           {appMatches.filter(m => m.status === 'Upcoming').slice(0, 2).map((m, i) => (
<div key={i} className="flex items-center justify-between bg-[#090b10] border border-slate-800 rounded-xl p-2 xl:p-3 mb-3">
              <div className="flex gap-2 xl:gap-3 items-center">
                 <div className="flex gap-1 items-center">
                    <div className="w-5 h-5 xl:w-6 xl:h-6 rounded-full overflow-hidden">
                        <img src={m?.team1?.flagUrl} alt="t1" className="w-full h-full object-cover" />
                    </div>
                     <span className="text-[8px] xl:text-[10px] text-slate-400">VS</span>
                    <div className="w-5 h-5 xl:w-6 xl:h-6 rounded-full overflow-hidden">
                        <img src={m?.team2?.flagUrl} alt="t2" className="w-full h-full object-cover" />
                    </div>
                 </div>
                 <div>
                    <p className="text-[10px] xl:text-xs font-bold text-slate-200">{m.seriesName}</p>
                    <p className="text-[8px] xl:text-[10px] text-slate-500">{m.time}</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-[8px] xl:text-[10px] text-slate-500">Status</p>
                 <p className="text-[#e5c158] font-bold text-xs xl:text-sm">Upcoming</p>
              </div>
           </div>
           ))}

           <p className="text-[10px] xl:text-xs text-[#e5c158] font-bold uppercase tracking-widest mb-3 border-b border-slate-800 pb-2">Ongoing Matches</p>
           {appMatches.filter(m => m.status === 'Live' || m.status === 'Completed').slice(0, 2).map((m, i) => (
<div key={i} className="flex items-center justify-between bg-[#090b10] border border-slate-800 rounded-xl p-2 xl:p-3 mb-3">
              <div className="flex gap-2 xl:gap-3 items-center">
                 <div className="flex gap-1 items-center">
                    <div className="w-5 h-5 xl:w-6 xl:h-6 rounded-full overflow-hidden">
                        <img src={m?.team1?.flagUrl} alt="t1" className="w-full h-full object-cover" />
                    </div>
                     <span className="text-[8px] xl:text-[10px] text-slate-400">VS</span>
                    <div className="w-5 h-5 xl:w-6 xl:h-6 rounded-full overflow-hidden">
                        <img src={m?.team2?.flagUrl} alt="t2" className="w-full h-full object-cover" />
                    </div>
                 </div>
                 <div>
                    <p className="text-[10px] xl:text-xs font-bold text-slate-200">{m.seriesName}</p>
                    <p className="text-[8px] xl:text-[10px] text-slate-500">{m.time}</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-[8px] xl:text-[10px] text-slate-500">Status</p>
                 <p className="text-[#e5c158] font-bold text-xs xl:text-sm">{m.status}</p>
              </div>
           </div>
           ))}
        </div>
    </div>

    {/* Right Column (Top Users & Tickets) */}
    <div className="lg:col-span-3 flex flex-col gap-5">
        {/* Top Users */}
        <div className="bg-[#13151c] rounded-2xl border border-[#e5c158]/20 p-5 shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-200 tracking-wide">Top Users</h3>
                <button onClick={() => setAdminTab('USERS')} className="text-slate-400 hover:text-white transition-colors text-xs font-bold">View All</button>
            </div>
            <div className="space-y-3">
                {[...adminUserList]
                  .sort((a, b) => (b.winning || 0) - (a.winning || 0))
                  .slice(0, 4)
                  .map((tu, i) => (
                    <div key={tu.id} className={"flex items-center justify-between p-2 rounded-xl border transition-all " + (i === 0 ? 'bg-[#e5c158]/5 border-[#e5c158]/30 shadow-[0_0_10px_rgba(229,193,88,0.1)]' : 'border-slate-800 bg-[#090b10] hover:bg-slate-800')}>
                       <div className="flex items-center gap-2 xl:gap-3 overflow-hidden flex-1 mr-2">
                          <span className="text-slate-500 font-mono text-xs w-3 xl:w-4">{i+1}.</span>
                          <div onClick={() => {
                              setAdminProfileModalUser(tu);
                          }} className="w-8 h-8 xl:w-10 xl:h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shrink-0 cursor-pointer hover:scale-105 transition-transform" title="Open Profile">
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${tu.id}`} alt="avatar" className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                              <p className="text-[10px] xl:text-xs font-bold text-slate-200 leading-tight truncate">{tu.name || (tu.email && String(tu.email).split('@')[0]) || 'User'}</p>
                              <div className="flex gap-2 items-center mt-1">
                                  <p className="text-[8px] xl:text-[9px] text-slate-500 truncate font-mono">{String(tu.id).substring(0, 8)}...</p>
                              </div>
                          </div>
                       </div>
                       <span className="text-[#e5c158] font-bold text-xs xl:text-sm shrink-0 pl-2">₹{Number(tu.winning || 0).toLocaleString()}</span>
                    </div>
                ))}
                {adminUserList.length === 0 && <p className="text-xs text-slate-500 text-center py-4">No users found.</p>}
            </div>
        </div>

        {/* Recent Support Tickets */}
        <div className="bg-[#13151c] rounded-2xl border border-[#e5c158]/20 p-5 shadow-lg flex-1">
            <h3 className="text-lg font-bold text-slate-200 tracking-wide mb-6">Recent Support Tickets</h3>
            <div className="space-y-4">
                {[1, 2, 4].map(i => (
                    <div key={i} className="border-b border-slate-800 pb-3 last:border-0 last:pb-0 cursor-pointer group">
                        <p className="text-xs xl:text-sm font-bold text-slate-300 group-hover:text-white transition-colors">Recent Subject Tick-00{i}</p>
                        <p className="text-[8px] xl:text-[10px] text-slate-500 mt-1">{i}. Subject Ticket-00{i} • 1 hour ago</p>
                    </div>
                ))}
            </div>
        </div>
    </div>
</div>
</>)}
{adminTab === 'SETTINGS' && (<>
<h3 className="font-bold text-[#e5c158]/80 uppercase tracking-widest text-[10px] mb-3 ml-1 mt-6">System Control: Platform Settings</h3>
             <div className="bg-[#13151c] rounded-2xl shadow-lg border border-[#e5c158]/20 p-5 mb-6 relative overflow-hidden backdrop-blur-sm">
                 <div className="flex justify-between items-center mb-2">
                    <p className="font-bold text-slate-200">Winning Distribution Rate</p>
                    <p className="text-xl font-black text-[#e5c158] drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]">{winningPercentage}%</p>
                 </div>
                 <p className="text-xs text-slate-400 mb-4">Set the percentage of the dynamic prize pool that goes to the winners. The rest ({100 - winningPercentage}%) is kept as platform fee.</p>
                 
                 <div className="flex gap-2 items-center">
                    <input 
                      type="range" 
                      min="10" 
                      max="100" 
                      step="5"
                      value={winningPercentage} 
                      onChange={(e) => setWinningPercentage(parseInt(e.target.value))} 
                      className="flex-1 accent-yellow-500"
                    />
                 </div>
                 <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-bold">
                    <span>10%</span>
                    <span>50%</span>
                    <span>100%</span>
                 </div>
             </div>

             <h3 className="font-bold text-[#e5c158]/80 uppercase tracking-widest text-[10px] mb-3 ml-1">System Control: Deposit Gateway</h3>
             <div className="bg-[#13151c] rounded-2xl shadow-lg border border-[#e5c158]/20 p-5 mb-6 relative overflow-hidden backdrop-blur-sm">
                 <p className="text-xs text-slate-400 mb-4">Set your UPI ID and QR Code image URL so users can make deposits. The app will auto-scan users payments.</p>
                 
                 <div className="mb-4">
                    <label className="text-xs font-bold text-[#e5c158]/80 uppercase tracking-widest mb-1.5 block">Your UPI ID</label>
                    <div className="flex gap-2">
                       <input 
                         type="text" 
                         value={adminUPI} 
                         onChange={(e) => setAdminUPI(e.target.value)} 
                         className="flex-1 bg-black/50 text-slate-200 border border-[#e5c158]/30 rounded-lg px-3 py-2 text-sm outline-none focus:border-yellow-500 focus:shadow-[0_0_10px_rgba(234,179,8,0.2)] transition-all"
                       />
                       <button onClick={() => setDoc(doc(db, 'gameData', 'settings'), {adminUPI, adminUpiQR}, {merge: true})} className="bg-[#e5c158]/20 hover:bg-yellow-500/30 text-[#e5c158] border border-[#e5c158]/50 font-bold px-4 py-2 rounded-lg text-xs transition-colors">Save</button>
                    </div>
                 </div>

                 <div className="mb-3">
                    <label className="text-xs font-bold text-[#e5c158]/80 uppercase tracking-widest mb-1.5 block">Upload QR Code Image</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                         const file = e.target.files?.[0];
                         if (file) {
                             if (file.size > 1048576) return alert("Image size must be less than 1MB");
                             const reader = new FileReader();
                             reader.onloadend = () => {
                                 setAdminUpiQR(reader.result as string);
                                 setDoc(doc(db, 'gameData', 'settings'), {adminUPI, adminUpiQR: reader.result}, {merge: true}).then(() => alert("QR Code uploaded and saved!"));
                             };
                             reader.readAsDataURL(file);
                         }
                      }} 
                      className="w-full bg-black/50 text-slate-400 border border-[#e5c158]/30 rounded-lg p-2 text-sm outline-none focus:border-yellow-500 mb-2 file:bg-[#e5c158]/20 file:text-[#e5c158] file:border-0 file:rounded file:px-3 file:py-1 file:font-semibold"
                    />
                 </div>
                 {adminUpiQR && (
                     <div className="mt-2 text-center bg-black/30 p-4 rounded-xl border border-yellow-500/10">
                         <img src={adminUpiQR} referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.src = 'https://placehold.co/100x100?text=Invalid+Image'; }} alt="QR Code Preview" className="w-[100px] h-[100px] object-cover rounded-xl shadow-[0_0_15px_rgba(234,179,8,0.15)] inline-block border-2 border-[#e5c158]/50" />
                     </div>
                 )}
             </div>

             </>)}
{adminTab === 'BANNERS' && (<>
<h3 className="font-bold text-[#e5c158]/80 uppercase tracking-widest text-[10px] mb-3 ml-1 mt-6">System Control: App Banners</h3>
             <div className="bg-[#13151c] rounded-2xl shadow-lg border border-[#e5c158]/20 p-5 mb-6 relative overflow-hidden backdrop-blur-sm">
                 <p className="text-xs text-slate-400 mb-4">Set the promotional banners that appear at the top of the user home screen. Upload 16:9 images for best results.</p>
                 
                 {appBanners.map((banner, index) => (
                    <div key={banner.id} className="mb-4 bg-black/30 p-3 rounded-xl border border-slate-700/50">
                       <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold text-slate-400">Banner {index + 1}</span>
                          <button onClick={() => setAppBanners(prev => prev.filter(b => b.id !== banner.id))} className="text-red-500 hover:bg-red-500/10 p-1 rounded transition-colors"><Trash2 size={14}/></button>
                       </div>
                       {banner.imageUrl ? (
                           <div className="relative w-full h-32 rounded-lg overflow-hidden border border-slate-700 bg-black mb-3 group">
                              <img src={banner.imageUrl} alt="Banner" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => document.getElementById(`banner-upload-${banner.id}`)?.click()}>
                                 <ImageIcon size={24} className="text-white mb-1" />
                                 <span className="text-[10px] text-white font-bold">Change Image</span>
                              </div>
                           </div>
                       ) : (
                           <div className="w-full h-32 rounded-lg border-2 border-dashed border-slate-700 relative flex flex-col items-center justify-center cursor-pointer hover:border-[#e5c158]/50 hover:text-[#e5c158] text-slate-500 transition-colors bg-black/50 mb-3" onClick={() => document.getElementById(`banner-upload-${banner.id}`)?.click()}>
                              <ImageIcon size={24} className="mb-2" />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Upload Image</span>
                           </div>
                       )}
                       
                       <input 
                         id={`banner-upload-${banner.id}`}
                         type="file" 
                         accept="image/*" 
                         className="hidden" 
                         onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                               const reader = new FileReader();
                               reader.onloadend = () => {
                                  setAppBanners(prev => prev.map(b => b.id === banner.id ? { ...b, imageUrl: reader.result as string } : b));
                               };
                               reader.readAsDataURL(file);
                            }
                         }} 
                       />
                       <input 
                          value={banner.linkUrl} 
                          onChange={(e) => setAppBanners(prev => prev.map(b => b.id === banner.id ? { ...b, linkUrl: e.target.value } : b))} 
                          placeholder="Optional Link URL (e.g. contest ID)" 
                          className="w-full bg-black/50 border border-[#e5c158]/30 rounded-lg px-3 py-2 text-xs outline-none focus:border-yellow-500 transition-all text-slate-300" 
                       />
                    </div>
                 ))}
                 
                 <button onClick={() => setAppBanners(prev => [...prev, {id: 'b'+Date.now(), imageUrl: '', linkUrl: ''}])} className="w-full py-2.5 rounded-xl border border-dashed border-[#e5c158]/50 text-[#e5c158] bg-[#e5c158]/5 hover:bg-[#e5c158]/10 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mb-4">
                    <Plus size={16}/> Add New Banner
                 </button>
                 
                 <button onClick={() => {
                    const ts = Date.now();
                    Promise.all([
                        setDoc(doc(db, 'gameData', 'banners'), { data: JSON.parse(JSON.stringify(appBanners)), timestamp: ts }),
                        setDoc(doc(db, 'gameData', 'sync_meta'), { lastUpdate: ts })
                    ])
                    .then(() => alert('Banners saved to server successfully!'))
                    .catch(e => alert('Failed to save banners: ' + e));
                 }} className="w-full py-3 bg-[#e5c158] text-black rounded-xl font-bold uppercase tracking-widest text-[11px] shadow-[0_0_15px_rgba(229,193,88,0.4)] transition-all active:scale-95">Push Banners Live</button>
             </div>
             </>)}
{adminTab === 'DASHBOARD' && (<>

             </>)}
{adminTab === 'CONTESTS' && (<>
<button 
      onClick={() => setShowManageContests(!showManageContests)}
      className={`flex items-center justify-between w-full mt-4 bg-[#13151c] border ${showManageContests ? 'border-[#e5c158]/30 rounded-t-xl border-b-0 mb-0 bg-gradient-to-b from-[#e5c158]/5 to-transparent' : 'border-slate-800 rounded-xl mb-3 hover:border-[#e5c158]/30'} p-4 shadow-lg transition-all relative group overflow-hidden`}
    >
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <h3 className="font-bold text-slate-200 tracking-wide flex items-center justify-between z-10"><Trophy size={16} className="text-[#e5c158] mr-2"/> Manage Contests</h3>
                <div className={`p-1.5 rounded-lg border transition-all z-10 ${showManageContests ? 'text-black border-[#e5c158] bg-[#e5c158] shadow-[0_0_10px_rgba(229,193,88,0.5)]' : 'text-slate-500 border-slate-700 bg-black/40 group-hover:text-[#e5c158] group-hover:border-[#e5c158]/30'}`}>
       {showManageContests ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} />}
    </div>
             </button>
             
             {showManageContests && (
               <div className="bg-[#13151c] rounded-b-2xl shadow-lg border border-[#e5c158]/50 border-t-0 p-5 mb-6 backdrop-blur-sm relative before:absolute before:inset-0 before:bg-gradient-to-b before:from-yellow-500/5 before:to-transparent before:pointer-events-none">
                  <p className="text-xs text-slate-400 mb-5 pl-1 relative z-10">Create new public Mega Contests or Head to Head matches with custom fees and rewards.</p>
                  <div className="space-y-4 relative z-10">
                     <div className="bg-black/40 border border-[#e5c158]/20 p-4 rounded-xl">
                       <label className="text-[10px] font-black text-[#e5c158]/70 uppercase tracking-widest block mb-2">Contest Type</label>
                       <div className="flex flex-wrap gap-2">
                          <button onClick={() => setAdminContestType('Mega')} className={`flex-1 min-w-[140px] py-2.5 rounded-lg text-sm font-bold border transition-all ${adminContestType === 'Mega' ? 'bg-[#e5c158]/20 text-[#e5c158] border-[#e5c158]/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : 'bg-black/50 text-slate-400 border-slate-700 hover:border-slate-500'}`}>Mega Contest</button>
                          <button onClick={() => setAdminContestType('H2H')} className={`flex-1 min-w-[140px] py-2.5 rounded-lg text-sm font-bold border transition-all ${adminContestType === 'H2H' ? 'bg-[#e5c158]/20 text-[#e5c158] border-[#e5c158]/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : 'bg-black/50 text-slate-400 border-slate-700 hover:border-slate-500'}`}>Head to Head (2 Spots)</button>
                          <button onClick={() => setAdminContestType('H2H_3')} className={`flex-1 min-w-[140px] py-2.5 rounded-lg text-sm font-bold border transition-all ${adminContestType === 'H2H_3' ? 'bg-[#e5c158]/20 text-[#e5c158] border-[#e5c158]/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : 'bg-black/50 text-slate-400 border-slate-700 hover:border-slate-500'}`}>3 Spots (3 to 1)</button>
                          <button onClick={() => setAdminContestType('H2H_4')} className={`flex-1 min-w-[140px] py-2.5 rounded-lg text-sm font-bold border transition-all ${adminContestType === 'H2H_4' ? 'bg-[#e5c158]/20 text-[#e5c158] border-[#e5c158]/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : 'bg-black/50 text-slate-400 border-slate-700 hover:border-slate-500'}`}>4 Spots (4 to 1)</button>
                          <button onClick={() => setAdminContestType('H2H_5')} className={`flex-1 min-w-[140px] py-2.5 rounded-lg text-sm font-bold border transition-all ${adminContestType === 'H2H_5' ? 'bg-[#e5c158]/20 text-[#e5c158] border-[#e5c158]/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : 'bg-black/50 text-slate-400 border-slate-700 hover:border-slate-500'}`}>5 Spots (5 to 1)</button>
                       </div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="bg-black/40 border border-[#e5c158]/20 p-4 rounded-xl">
                         <label className="text-[10px] font-black text-[#e5c158]/70 uppercase tracking-widest block mb-2">Contest Target Name</label>
                         <input type="text" placeholder="e.g., Grand League 1" value={adminContestName} onChange={(e) => setAdminContestName(e.target.value)} className="w-full bg-black/60 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 outline-none focus:border-yellow-500 focus:shadow-[0_0_10px_rgba(234,179,8,0.2)] transition-all" />
                       </div>
                       <div className="bg-black/40 border border-[#e5c158]/20 p-4 rounded-xl">
                         <label className="text-[10px] font-black text-[#e5c158]/70 uppercase tracking-widest block mb-2">Total Prize Pool (Text)</label>
                         <input type="text" placeholder="e.g., ₹20 Crores or ₹5000" value={adminContestPrize} onChange={(e) => setAdminContestPrize(e.target.value)} className="w-full bg-black/60 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 outline-none focus:border-yellow-500 focus:shadow-[0_0_10px_rgba(234,179,8,0.2)] transition-all" />
                       </div>
                       <div className="bg-black/40 border border-[#e5c158]/20 p-4 rounded-xl">
                         <label className="text-[10px] font-black text-[#e5c158]/70 uppercase tracking-widest block mb-2">Entry Fee (Number)</label>
                         <input type="number" placeholder="e.g., 49" value={adminContestEntry} onChange={(e) => setAdminContestEntry(e.target.value)} className="w-full bg-black/60 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 outline-none focus:border-yellow-500 focus:shadow-[0_0_10px_rgba(234,179,8,0.2)] transition-all" />
                       </div>
                       {adminContestType === 'Mega' && (
                          <div className="bg-black/40 border border-[#e5c158]/20 p-4 rounded-xl">
                            <label className="text-[10px] font-black text-[#e5c158]/70 uppercase tracking-widest block mb-2">Total Spots</label>
                            <input type="number" placeholder="e.g., 5000000" value={adminContestSpots} onChange={(e) => setAdminContestSpots(e.target.value)} className="w-full bg-black/60 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 outline-none focus:border-yellow-500 focus:shadow-[0_0_10px_rgba(234,179,8,0.2)] transition-all" />
                          </div>
                       )}
                     </div>
                     <div className="bg-black/40 border border-[#e5c158]/20 p-4 rounded-xl mt-4">
                        <div className="flex justify-between items-center mb-3 border-b border-[#e5c158]/20 pb-2">
                           <h4 className="text-[10px] font-black text-[#e5c158] uppercase tracking-widest">Prize Distribution Settings</h4>
                           {adminContestType === 'Mega' && (
                              <button onClick={() => setAdminContestAutoPayouts(!adminContestAutoPayouts)} className="text-xs text-blue-400 hover:text-blue-300 font-bold px-2 py-1 bg-blue-500/10 rounded">
                                 {adminContestAutoPayouts ? 'Switch to Custom Payouts' : 'Switch to Auto Payouts'}
                              </button>
                           )}
                        </div>
                        {adminContestAutoPayouts ? (
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div>
                               <label className="text-[10px] font-bold text-[#e5c158]/70 uppercase tracking-widest block mb-1">Platform Margin (%)</label>
                               <input type="number" placeholder="e.g. 20" value={adminPlatformMargin} onChange={(e) => setAdminPlatformMargin(e.target.value)} className="w-full bg-black/60 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 outline-none focus:border-yellow-500 transition-all" />
                               <p className="text-[9px] text-slate-500 mt-1">Percentage of total entry fees the platform keeps.</p>
                             </div>
                             <div>
                               <label className="text-[10px] font-bold text-[#e5c158]/70 uppercase tracking-widest block mb-1">Winning Spots (%)</label>
                               <input type="number" placeholder="e.g. 48" value={adminWinnersPercent} onChange={(e) => setAdminWinnersPercent(e.target.value)} className="w-full bg-black/60 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 outline-none focus:border-yellow-500 transition-all" />
                               <p className="text-[9px] text-slate-500 mt-1">Percentage of spots that get a payout.</p>
                             </div>
                             <div>
                               <label className="text-[10px] font-bold text-[#e5c158]/70 uppercase tracking-widest block mb-1">1st Prize Gets (%)</label>
                               <input type="number" placeholder="e.g. 15" value={adminFirstPrizePercent} onChange={(e) => setAdminFirstPrizePercent(e.target.value)} className="w-full bg-black/60 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 outline-none focus:border-yellow-500 transition-all" />
                               <p className="text-[9px] text-slate-500 mt-1">Percentage of the prize pool allocated to Rank 1.</p>
                             </div>
                           </div>
                        ) : (
                           <div className="space-y-3">
                              {adminCustomPayouts.map((cp, idx) => (
                                 <div key={idx} className="flex gap-2 items-center">
                                    <div className="flex-1">
                                       <label className="text-[10px] text-slate-400 block mb-1">Rank From</label>
                                       <input type="number" value={cp.rankFrom} onChange={(e) => {
                                          const newPayouts = [...adminCustomPayouts];
                                          newPayouts[idx].rankFrom = e.target.value;
                                          setAdminCustomPayouts(newPayouts);
                                       }} className="w-full bg-black/60 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 outline-none focus:border-yellow-500" />
                                    </div>
                                    <div className="flex-1">
                                       <label className="text-[10px] text-slate-400 block mb-1">Rank To</label>
                                       <input type="number" value={cp.rankTo} onChange={(e) => {
                                          const newPayouts = [...adminCustomPayouts];
                                          newPayouts[idx].rankTo = e.target.value;
                                          setAdminCustomPayouts(newPayouts);
                                       }} className="w-full bg-black/60 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 outline-none focus:border-yellow-500" />
                                    </div>
                                    <div className="flex-1">
                                       <label className="text-[10px] text-slate-400 block mb-1">Prize (e.g. ₹75,000)</label>
                                       <input type="text" value={cp.amount} onChange={(e) => {
                                          const newPayouts = [...adminCustomPayouts];
                                          newPayouts[idx].amount = e.target.value;
                                          setAdminCustomPayouts(newPayouts);
                                       }} className="w-full bg-black/60 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 outline-none focus:border-yellow-500" />
                                    </div>
                                    <button onClick={() => {
                                       setAdminCustomPayouts(adminCustomPayouts.filter((_, i) => i !== idx));
                                    }} className="mt-5 p-2 text-red-500 hover:bg-red-500/20 rounded-lg">
                                       <Trash2 size={16} />
                                    </button>
                                 </div>
                              ))}
                              <div className="flex justify-between items-center mt-2">
                                 <button onClick={() => {
                                    setAdminCustomPayouts([...adminCustomPayouts, {rankFrom: '', rankTo: '', amount: ''}]);
                                 }} className="text-xs font-bold text-yellow-500 bg-yellow-500/10 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-yellow-500/20 transition-colors">
                                    <PlusCircle size={14} /> Add Rank Tier
                                 </button>
                                 <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={adminAutoFillRemaining} onChange={(e) => setAdminAutoFillRemaining(e.target.checked)} className="rounded border-slate-700 bg-black/50 text-[#e5c158] focus:ring-[#e5c158]" />
                                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Auto-fill remaining ranks</span>
                                 </label>
                              </div>
                           </div>
                        )}
                     </div>
                     <button 
                        onClick={() => {
                          const fee = parseFloat(adminContestEntry);
                          if (!adminContestName || !adminContestPrize || isNaN(fee)) return alert("Fill all fields correctly");
                          
                          let spots = 2;
                          if (adminContestType === 'Mega') spots = parseInt(adminContestSpots) || 5000000;
                          else if (adminContestType === 'H2H_3') spots = 3;
                          else if (adminContestType === 'H2H_4') spots = 4;
                          else if (adminContestType === 'H2H_5') spots = 5;
                          
                          let payouts = undefined;
                          let parsedPrize = 0;
                          const lowerPrize = (adminContestPrize || '').toString().toLowerCase();
                          const numPart = parseFloat(lowerPrize.replace(/[^0-9.]/g, ''));
                          if (!isNaN(numPart) && numPart > 0) {
                              if (lowerPrize.includes('cr')) parsedPrize = numPart * 10000000;
                              else if (lowerPrize.includes('lakh') || lowerPrize.includes('l')) parsedPrize = numPart * 100000;
                              else if (lowerPrize.includes('k')) parsedPrize = numPart * 1000;
                              else parsedPrize = numPart;
                          }

                          const platMargin = parseFloat(adminPlatformMargin) || 20;
                          const winSpotsPerc = parseFloat(adminWinnersPercent) || 48;
                          const firstPrizePerc = parseFloat(adminFirstPrizePercent) || 15;
                          
                          const totalFeesCollected = (fee || 0) * spots;
                          const calculatedPool = totalFeesCollected * ((100 - platMargin) / 100);
                          const actualPool = parsedPrize > 0 ? parsedPrize : (calculatedPool || 0);

                          if (adminContestType === 'Mega') {
                             const formatAmount = (amt: number) => amt >= 100000 ? `₹${Number.isInteger(amt/100000) ? (amt/100000) : (amt/100000).toFixed(2)} Lakhs` : `₹${Math.round(amt).toLocaleString('en-IN')}`;
                             let customRanksCost = 0;
                             let highestCustomRank = 0;
                             
                             let validCustomPayouts = adminContestAutoPayouts ? [] : adminCustomPayouts.filter(cp => cp.rankFrom && cp.amount);

                             payouts = validCustomPayouts.map(cp => {
                                let from = parseInt(cp.rankFrom) || 1;
                                let to = parseInt(cp.rankTo) || from;
                                let rankLabel = from === to ? `# ${from}` : `# ${from} - ${to}`;
                                let amtLabel = cp.amount.trim();
                                if (!amtLabel.startsWith('₹')) amtLabel = `₹${amtLabel}`;
                                return { rank: rankLabel, amount: amtLabel };
                             });

                             if (!adminContestAutoPayouts) {
                                validCustomPayouts.forEach(cp => {
                                   const from = parseInt(cp.rankFrom) || 0;
                                   const to = parseInt(cp.rankTo) || from;
                                   const spotsInTier = (to - from + 1);
                                   
                                   let rawAmountLabel = (cp.amount || '').toString().toLowerCase().replace(/,/g, '');
                                   let numericAmount = parseFloat(rawAmountLabel.replace(/[^0-9.]/g, '')) || 0;
                                   if (rawAmountLabel.includes('lakh') || rawAmountLabel.includes('l')) numericAmount *= 100000;
                                   else if (rawAmountLabel.includes('cr')) numericAmount *= 10000000;
                                   else if (rawAmountLabel.includes('k')) numericAmount *= 1000;
                                   
                                   if (spotsInTier > 0 && numericAmount > 0) {
                                      customRanksCost += (spotsInTier * numericAmount);
                                   }
                                   if (to > highestCustomRank) highestCustomRank = to;
                                });
                             } else {
                                // Default Auto Payouts: auto generate Rank 1
                                let rank1Amount = actualPool * (firstPrizePerc/100);
                                payouts.push({ rank: '# 1', amount: formatAmount(rank1Amount) });
                                highestCustomRank = 1;
                                customRanksCost = rank1Amount;
                             }
                             
                             const shouldAutoFill = adminContestAutoPayouts || adminAutoFillRemaining;
                             
                             const remainingPool = actualPool - customRanksCost;
                             
                             if (shouldAutoFill && remainingPool > 0) {
                                let nextStart = highestCustomRank + 1;
                                let desiredLastRankEnd = Math.floor(spots * (winSpotsPerc / 100));
                                
                                let minPrizeForRest = Math.max(fee || 0, 1);
                                let maxAffordableWinners = Math.floor(remainingPool / minPrizeForRest);
                                
                                let lastRankEnd = desiredLastRankEnd;
                                if (lastRankEnd > nextStart + maxAffordableWinners - 1) {
                                    lastRankEnd = nextStart + maxAffordableWinners - 1;
                                }
                                if (lastRankEnd < nextStart) lastRankEnd = nextStart;
                                
                                let remainingWinners = lastRankEnd - nextStart + 1;
                                
                                if (remainingWinners > 0) {
                                    const rawTiers = [
                                        { maxEnd: 5, weight: 15 },
                                        { maxEnd: 10, weight: 12 },
                                        { maxEnd: 50, weight: 10 },
                                        { maxEnd: 200, weight: 8 },
                                        { maxEnd: 1000, weight: 6 },
                                        { maxEnd: 5000, weight: 5 },
                                        { maxEnd: 20000, weight: 4 },
                                        { maxEnd: 100000, weight: 2 },
                                        { maxEnd: spots, weight: 1 }
                                    ];
                                    
                                    let validTiers: {start: number, end: number, spots: number, weight: number}[] = [];
                                    let currStart = nextStart;
                                    
                                    for (let tier of rawTiers) {
                                        if (currStart <= tier.maxEnd && currStart <= lastRankEnd) {
                                            let actualEnd = Math.min(tier.maxEnd, lastRankEnd);
                                            validTiers.push({
                                                start: currStart,
                                                end: actualEnd,
                                                spots: actualEnd - currStart + 1,
                                                weight: tier.weight
                                            });
                                            currStart = actualEnd + 1;
                                        }
                                    }
                                    if (currStart <= lastRankEnd) {
                                        validTiers.push({
                                            start: currStart,
                                            end: lastRankEnd,
                                            spots: lastRankEnd - currStart + 1,
                                            weight: 1
                                        });
                                    }

                                    // Deduct minimal fee for everyone first
                                    let minPrize = Math.max(fee || 0, 1);
                                    let totalMinCost = minPrize * remainingWinners;
                                    let excessPool = remainingPool - totalMinCost;

                                    if (excessPool < 0) {
                                        // Give everyone evenly what's left
                                        let evenPrize = Math.floor(remainingPool / remainingWinners);
                                        payouts.push({
                                            rank: nextStart === lastRankEnd ? `# ${nextStart}` : `# ${nextStart.toLocaleString('en-IN')} - ${lastRankEnd.toLocaleString('en-IN')}`,
                                            amount: `₹${evenPrize.toLocaleString('en-IN')}`
                                        });
                                    } else {
                                        // We have excess to distribute based on weights
                                        let totalWeightSum = validTiers.reduce((sum, t) => sum + t.weight, 0);
                                        
                                        // First pass: assign pool per tier
                                        let tierPrizes = validTiers.map(t => {
                                            let alloc = (t.weight / totalWeightSum) * excessPool;
                                            let perSpot = Math.floor(alloc / t.spots) + minPrize;
                                            return perSpot;
                                        });
                                        
                                        // Ensure monotonic decrease constraint (smooth it out)
                                        for(let i = 1; i < tierPrizes.length; i++) {
                                            if (tierPrizes[i] >= tierPrizes[i-1]) {
                                               tierPrizes[i] = Math.max(minPrize, tierPrizes[i-1] - 1);
                                            }
                                        }

                                        let finalTiers: {start: number, end: number, amt: number}[] = [];
                                        validTiers.forEach((t, i) => {
                                            let amt = tierPrizes[i];
                                            if (finalTiers.length > 0 && finalTiers[finalTiers.length-1].amt === amt) {
                                                finalTiers[finalTiers.length-1].end = t.end;
                                            } else {
                                                finalTiers.push({ start: t.start, end: t.end, amt });
                                            }
                                        });

                                        finalTiers.forEach(t => {
                                            if (t.amt >= 1) {
                                                payouts.push({
                                                    rank: t.start === t.end ? `# ${t.start}` : `# ${t.start.toLocaleString('en-IN')} - ${t.end.toLocaleString('en-IN')}`,
                                                    amount: `₹${t.amt.toLocaleString('en-IN')}`
                                                });
                                            }
                                        });
                                    }
                                }
                             }
                          }


                          let displayType = 'H2H';
                          if (adminContestType === 'H2H_3') displayType = '3 Spots';
                          else if (adminContestType === 'H2H_4') displayType = '4 Spots';
                          else if (adminContestType === 'H2H_5') displayType = '5 Spots';
                          else if (adminContestType === 'Mega') displayType = 'Mega';

                          let calculatedWinPercentage = adminContestType === 'Mega' ? winSpotsPerc : (adminContestType === 'H2H' ? 50 : Math.floor(100/spots));
                          let calculatedFirstPrize = adminContestType === 'Mega' ? (payouts?.[0]?.amount || '₹8 L') : (parsedPrize > 0 ? (adminContestPrize.toString().includes('₹') ? adminContestPrize : `₹${adminContestPrize}`) : `₹${Math.floor(actualPool)}`);
                          
                          if (adminContestType === 'Mega' && !adminContestAutoPayouts) {
                             if (payouts && payouts.length > 0) {
                                calculatedFirstPrize = payouts[0].amount;
                             }
                             // try to calculate win percentage from the last rankTo
                             if (adminCustomPayouts && adminCustomPayouts.length > 0) {
                                const lastCustom = adminCustomPayouts[adminCustomPayouts.length - 1];
                                const maxRank = parseInt(lastCustom.rankTo || lastCustom.rankFrom) || 1;
                                calculatedWinPercentage = parseFloat(((maxRank / spots) * 100).toFixed(1));
                             }
                          }

                          const newContest: Contest = {
                            id: 'c_' + Math.random().toString(36).substring(7),
                            type: displayType,
                            name: adminContestName,
                            prizeText: parsedPrize > 0 ? (parsedPrize >= 100000 ? `₹${Number.isInteger(parsedPrize/100000) ? parsedPrize/100000 : (parsedPrize/100000).toFixed(2)} Lakhs` : `₹${parsedPrize}`) : adminContestPrize,
                            entryFee: fee,
                            spots: spots,
                            firstPrize: calculatedFirstPrize,
                            winPercentage: calculatedWinPercentage,
                            maxTeams: adminContestType === 'Mega' ? 20 : 1,
                            payouts: payouts || []
                          };
                          
                          const updatedContests = [...appContests, newContest];
                          setAppContests(updatedContests);
                          localStorage.setItem('dreamApp_contests', JSON.stringify(updatedContests));
                          // syncActiveDataToCloud(); // Call sync button instead to avoid payload size errors
                          
                          alert(`Successfully added ${adminContestType} contest!`);
                          setAdminContestName('');
                          setAdminContestPrize('');
                          setAdminContestEntry('');
                        }} 
                        className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-black uppercase tracking-widest py-3.5 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_25px_rgba(234,179,8,0.5)] flex items-center justify-center gap-2 active:scale-[0.98] transition-all mt-4"
                     >
                       <PlusCircle size={18} /> Publish VIP Contest
                     </button>
                  </div>
                  
                  <div className="mt-8 border-t border-[#e5c158]/20 pt-5 relative z-10">
                     <p className="text-[10px] font-black text-[#e5c158]/70 uppercase tracking-widest mb-3">Active Listed Contests</p>
                     <div className="space-y-3">
                       {appContests.map(c => (
                          <div key={c.id} className="bg-black/60 border border-slate-700 hover:border-[#e5c158]/50 rounded-xl p-3 flex justify-between items-center text-xs transition-colors">
                             <div>
                               <span className="font-bold text-slate-200 text-sm">{c.name}</span>
                               <span className="text-[#e5c158]/80 ml-2 text-[10px] uppercase font-bold tracking-widest border border-[#e5c158]/30 px-1.5 py-0.5 rounded-sm">{c.type}</span>
                             </div>
                             <div className="flex items-center gap-4">
                                <span className="font-black text-[#e5c158] drop-shadow-[0_0_8px_rgba(234,179,8,0.3)] text-sm">Pool: {c.prizeText}</span>
                                <button onClick={() => setAppContests(appContests.filter(cc => cc.id !== c.id))} className="text-red-400 hover:text-red-300 bg-red-900/30 hover:bg-red-900/50 p-1.5 rounded-lg transition-colors"><X size={16}/></button>
                             </div>
                          </div>
                       ))}
                     </div>
                  </div>
               </div>
             )}

             </>)}
{adminTab === 'TEAMS' && (<>
   <div className="flex flex-col gap-4 mt-2 mb-6">
      <div className="flex gap-2 p-2 bg-black/40 border border-slate-700/50 rounded-xl overflow-x-auto no-scrollbar items-center">
         {appFormats.map(fmt => (
            <button 
               key={fmt} 
               onClick={() => setSelectedFormat(fmt)}
               className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors flex-shrink-0 ${selectedFormat === fmt ? 'bg-[#e5c158] text-black shadow-[0_0_10px_rgba(229,193,88,0.3)]' : 'bg-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
            >
               {fmt}
            </button>
         ))}
         <button onClick={() => setShowAddFormatModal(true)} className="px-3 py-2 rounded-lg bg-black/50 border border-slate-700 hover:border-[#e5c158]/50 text-slate-400 hover:text-[#e5c158] flex items-center justify-center transition-colors">
            <Plus size={18} />
         </button>
      </div>

      {selectedTeamsForMatch.length > 0 && (
          <div className="bg-green-900/40 border border-green-500/50 p-4 rounded-xl flex justify-between items-center sticky top-[70px] z-20 shadow-lg backdrop-blur-sm mt-2">
             <div className="text-white">
                <p className="text-xs text-green-300 font-bold uppercase tracking-wider mb-1">Match Creation Mode</p>
                <div className="flex items-center gap-2 font-black text-lg">
                   {selectedTeamsForMatch[0]?.shortName}
                   <span className="text-slate-400 text-sm mx-1">vs</span>
                   {selectedTeamsForMatch[1] ? selectedTeamsForMatch[1].shortName : <span className="text-slate-500 italic text-sm">Select 2nd Team</span>}
                </div>
             </div>
             <div className="flex gap-2">
                <button onClick={() => setSelectedTeamsForMatch([])} className="p-2 bg-black/40 rounded-lg text-slate-400 hover:text-red-400 transition-colors"><X size={20}/></button>
                {selectedTeamsForMatch.length === 2 && (
                   <button onClick={() => setShowCreateMatchFromTeamsModal(true)} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold shadow-[0_0_15px_rgba(34,197,94,0.4)] whitespace-nowrap transition-all">Create</button>
                )}
             </div>
          </div>
      )}

      <div className="flex justify-between items-center mt-2">
         <h3 className="font-bold text-slate-300 tracking-wide uppercase text-[10px]">Teams for {selectedFormat}</h3>
         <div className="flex gap-2">
            <button 
               onClick={() => {
                  if (window.confirm("WARNING: This will RESET all teams and UNLOCK all players to official defaults. Any custom teams you created will be preserved but missing ones will be added. Continue?")) {
                     const defaultTeams = [
                        { id: 'it1', name: 'Chennai Super Kings', shortName: 'CSK', color: 'bg-yellow-500', format: 'IPL' },
                        { id: 'it2', name: 'Mumbai Indians', shortName: 'MI', color: 'bg-blue-600', format: 'IPL' },
                        { id: 'it3', name: 'Royal Challengers Bangalore', shortName: 'RCB', color: 'bg-red-600', format: 'IPL' },
                        { id: 'it4', name: 'Kolkata Knight Riders', shortName: 'KKR', color: 'bg-purple-800', format: 'IPL' },
                        { id: 'it5', name: 'Sunrisers Hyderabad', shortName: 'SRH', color: 'bg-orange-500', format: 'IPL' },
                        { id: 'it6', name: 'Rajasthan Royals', shortName: 'RR', color: 'bg-pink-600', format: 'IPL' },
                        { id: 'it7', name: 'Gujarat Titans', shortName: 'GT', color: 'bg-slate-800', format: 'IPL' },
                        { id: 'it8', name: 'Delhi Capitals', shortName: 'DC', color: 'bg-blue-800', format: 'IPL' },
                        { id: 'it9', name: 'Lucknow Super Giants', shortName: 'LSG', color: 'bg-blue-400', format: 'IPL' },
                        { id: 'it10', name: 'Punjab Kings', shortName: 'PBKS', color: 'bg-red-500', format: 'IPL' },
                        { id: 't1', name: 'India', shortName: 'IND', color: 'bg-blue-600', format: 'T20' },
                        { id: 't2', name: 'Pakistan', shortName: 'PAK', color: 'bg-green-600', format: 'T20' },
                        { id: 't3', name: 'England', shortName: 'ENG', color: 'bg-red-600', format: 'T20' },
                        { id: 't4', name: 'Australia', shortName: 'AUS', color: 'bg-yellow-500', format: 'T20' }
                     ];
                     
                     setAppTeamsList(prev => {
                        const existingKeys = new Set(prev.map(t => `${t.shortName}_${t.format}`));
                        const toAdd = defaultTeams.filter(t => !existingKeys.has(`${t.shortName}_${t.format}`));
                        return [...prev, ...toAdd];
                     });
                     
                     setAppPlayers(MOCK_PLAYERS); // Force reset to full official list
                     alert("Full Sync & Reset Complete! All IPL teams and India team are now populated with players.");
                  }
               }}
               className="bg-blue-500/10 hover:bg-blue-500/20 px-3 py-2 rounded-lg text-blue-400 border border-blue-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
               <RefreshCw size={14}/> Force Sync Defaults
            </button>
            <button onClick={() => setShowAddTeamModal(true)} className="bg-[#e5c158]/10 hover:bg-[#e5c158]/20 px-3 py-2 rounded-lg text-[#e5c158] border border-[#e5c158]/30 text-xs font-bold flex items-center gap-1.5 transition-all"><Plus size={14}/> Add Team</button>
         </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
         {appTeamsList.filter(t => t.format === selectedFormat).map(team => {
             const teamPlayers = appPlayers.filter(p => p.team === team.shortName);
             const isExpanded = expandedTeamId === team.id;
             const isSelectedForMatch = selectedTeamsForMatch.some(st => st.id === team.id);
             
             return (
                 <div key={team.id} className={`bg-[#13151c] border ${isSelectedForMatch ? 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'border-slate-800'} rounded-xl overflow-hidden transition-all duration-300`}>
                    <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}>
                       <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-inner overflow-hidden relative shrink-0 ${team?.color?.startsWith('bg-') ? team.color : ''}`} style={!team?.color?.startsWith('bg-') ? {backgroundColor: team?.color} : {}}>
                             {team.flagUrl ? (
                                 <img src={team.flagUrl} alt={team.shortName} className={`w-full h-full ${team.flagFit === 'contain' ? 'object-contain' : 'object-cover'}`} />
                             ) : (
                                 team.shortName
                             )}
                          </div>
                          <div>
                             <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-200">{team.name}</h4>
                                <button 
                                   onClick={(e) => {
                                       e.stopPropagation();
                                       setNewFlagUrl(team.flagUrl || '');
                                       setNewFlagFit(team.flagFit || 'cover');
                                       setShowAddFlagModal(team.id);
                                   }}
                                   className="text-slate-500 hover:text-white transition-colors"
                                   title="Add/Edit Flag"
                                >
                                   <PlusCircle size={14} />
                                </button>
                             </div>
                             <p className="text-[10px] text-slate-500 font-semibold">{teamPlayers.length} Players</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-3">
                          <button 
                             onClick={(e) => {
                                 e.stopPropagation();
                                 if (isSelectedForMatch) {
                                     setSelectedTeamsForMatch(prev => prev.filter(t => t.id !== team.id));
                                 } else {
                                     if (selectedTeamsForMatch.length >= 2) {
                                         alert("You can only select 2 teams for a match!");
                                     } else {
                                         setSelectedTeamsForMatch(prev => [...prev, team]);
                                     }
                                 }
                             }}
                             className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${isSelectedForMatch ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-500'}`}
                          >
                             {isSelectedForMatch ? 'Selected' : 'Select'}
                          </button>
                          <div className={`p-1.5 bg-black/40 rounded border border-slate-700 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                             <ChevronDown size={16} className="text-slate-500" />
                          </div>
                       </div>
                    </div>
                    {isExpanded && (
                       <div className="bg-black/40 border-t border-slate-800 p-3 pt-4">
                          <div className="flex justify-between items-center mb-3">
                             <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Player List</h5>
                             <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setNewPlayerTeamShort(team.shortName);
                                    setShowTeamAddPlayerModal(true);
                                }}
                                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1.5 flex items-center gap-1 rounded border border-slate-700 transition-colors uppercase font-bold"
                             >
                                <Plus size={12}/> Add Player
                             </button>
                          </div>
                          
                          <div className="flex gap-1 mb-4 overflow-x-auto no-scrollbar pb-1">
                             {(['ALL', 'WK', 'BAT', 'AR', 'BOWL'] as const).map(f => (
                                 <button
                                     key={f}
                                     onClick={(e) => { e.stopPropagation(); setAdminTeamPlayerRoleFilter(f); }}
                                     className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wide flex-shrink-0 transition-colors ${adminTeamPlayerRoleFilter === f ? 'bg-[#e5c158] text-black' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                 >
                                     {f}
                                 </button>
                             ))}
                          </div>
                          
                          {teamPlayers.length === 0 ? (
                              <p className="text-xs text-slate-600 text-center py-4 italic font-medium">No players added to this team yet.</p>
                          ) : (
                              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                 {(adminTeamPlayerRoleFilter === 'ALL' ? teamPlayers : teamPlayers.filter(p => p.role === adminTeamPlayerRoleFilter)).length === 0 ? (
                                    <p className="text-[10px] text-slate-500 text-center py-2 italic font-medium">No players found for this role.</p>
                                 ) : (adminTeamPlayerRoleFilter === 'ALL' ? teamPlayers : teamPlayers.filter(p => p.role === adminTeamPlayerRoleFilter)).map((p: any) => (
                                     <div key={p.id} 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingPlayerId(p.id);
                                            setNewPlayerName(p.name);
                                            setNewPlayerRole(p.role as 'BAT' | 'BOWL' | 'AR' | 'WK');
                                            setNewPlayerCredits((p.credits || 0).toString());
                                            setNewPlayerTeamShort(team.shortName);
                                            setShowTeamAddPlayerModal(true);
                                        }}
                                        className="flex items-center justify-between bg-[#13151c] px-3 py-2 rounded-lg border border-slate-800/50 hover:border-[#e5c158]/20 transition-colors cursor-pointer"
                                     >
                                        <div className="flex items-center gap-2">
                                           <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                                              <User size={12} className="text-slate-400" />
                                           </div>
                                           <span className="text-sm font-bold text-slate-300">{p.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                           <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded tracking-wide">{p.role}</span>
                                           <span className="text-[10px] font-bold text-[#e5c158]">{p.credits} Cr</span>
                                           <button onClick={(e) => {
                                              e.stopPropagation();
                                              setAppPlayers(prev => prev.filter(pl => pl.id !== p.id));
                                            }} className="text-red-500/50 hover:text-red-500 p-2 -mr-2 bg-transparent border-none outline-none"><Trash2 size={14}/></button>
                                        </div>
                                     </div>
                                 ))}
                              </div>
                          )}
                       </div>
                    )}
                 </div>
             );
         })}
         {appTeamsList.filter(t => t.format === selectedFormat).length === 0 && (
            <div className="text-center py-12 bg-black/20 border border-slate-800/50 rounded-xl border-dashed">
               <p className="text-slate-500 font-bold mb-2">No teams found for {selectedFormat}</p>
               <button onClick={() => setShowAddTeamModal(true)} className="text-[#e5c158] text-sm font-semibold hover:underline border-none bg-transparent">Create a Team</button>
            </div>
         )}
      </div>
   </div>
</>)}
{adminTab === 'MATCHES' && (<>
<button
   onClick={() => setShowApiSync(!showApiSync)}
   className={`flex items-center justify-between w-full mt-4 bg-[#13151c] border ${showApiSync ? 'border-blue-500/50 rounded-t-xl border-b-0 mb-0 bg-gradient-to-b from-blue-500/10 to-transparent' : 'border-blue-500/30 rounded-xl mb-3 hover:border-blue-500/50'} p-4 shadow-lg transition-all relative group overflow-hidden`}
>
  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
  <h3 className="font-bold text-slate-200 tracking-wide flex items-center justify-between z-10 gap-2">
     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>
     Live Match Sync (API)
  </h3>
  <div className={`p-1.5 rounded-lg border transition-all z-10 ${showApiSync ? 'text-white border-blue-500 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'text-blue-500 border-blue-500/50 bg-black/40 group-hover:text-blue-400 group-hover:border-blue-400'}`}>
     {showApiSync ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} />}
  </div>
</button>

{showApiSync && (
  <div className="bg-[#13151c] rounded-b-2xl shadow-lg border border-blue-500/50 border-t-0 p-5 mb-6 backdrop-blur-sm relative before:absolute before:inset-0 before:bg-gradient-to-b before:from-blue-500/5 before:to-transparent before:pointer-events-none">
     <p className="text-xs text-slate-400 mb-5 pl-1 relative z-10">Automatically fetch Live and Upcoming matches from Cricket API. Accept to import them into the app.</p>
     
     <div className="flex flex-col gap-3 relative z-10 border border-slate-700/50 p-4 rounded-xl bg-black/40">
       <div className="flex justify-between items-center">
         <div className="text-xs text-slate-300">
           <span className="font-bold text-white block mb-1">Cricket Data Source</span>
           <span className="text-slate-400">cricapi.com (Signup for free key)</span>
         </div>
       </div>
       <div className="flex gap-2">
         <button 
           onClick={async () => {
             setIsFetchingApi(true);
             setApiMatches([]);
             
             try {
               const response = await fetch(`/api/cricket/currentMatches?offset=0`);
               const data = await response.json();
               
               if (data.status !== 'success') {
                 throw new Error(data.reason || 'Failed to fetch matches.');
               }
               
               const matches = data.data.map((m: any) => ({
                 id: m.id,
                 series: m.name,
                 status: m.matchStarted ? 'Live' : 'Upcoming',
                 matchDateISO: m.dateTimeGMT ? new Date(m.dateTimeGMT).toISOString() : undefined,
                 time: m.dateTimeGMT ? new Date(m.dateTimeGMT).toLocaleString() : 'TBA',
                 team1: { 
                   name: m.teamInfo?.[0]?.name || 'TBA', 
                   shortFrame: m.teamInfo?.[0]?.shortname || 'TBA', 
                   color: '#1E3A8A', 
                   flagUrl: m.teamInfo?.[0]?.img || '' 
                 },
                 team2: { 
                   name: m.teamInfo?.[1]?.name || 'TBA', 
                   shortFrame: m.teamInfo?.[1]?.shortname || 'TBA', 
                   color: '#eab308', 
                   flagUrl: m.teamInfo?.[1]?.img || '' 
                 }
               }));
               
               setApiMatches(matches);
             } catch (error: any) {
               console.error("API Error:", error);
               alert("API Error: " + error.message);
             } finally {
               setIsFetchingApi(false);
             }
           }}
           className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap active:scale-95 shadow-[0_0_10px_rgba(59,130,246,0.4)]"
         >
            {isFetchingApi ? 'Fetching...' : 'Fetch Matches'}
         </button>
       </div>
     </div>
     
     {apiMatches.length > 0 && (
        <div className="mt-4 space-y-3 relative z-10">
           <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2">Available Matches from API</h4>
           {apiMatches.map(m => {
              const alreadyExists = appMatches.find(am => am.series === m.series && am?.team1?.shortFrame === m?.team1?.shortFrame && am?.team2?.shortFrame === m?.team2?.shortFrame);
              
              return (
               <div key={m.id} className="bg-black/60 border border-slate-700/50 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded ${m.status === 'Live' ? 'bg-red-500/20 text-red-500' : 'bg-slate-700 text-slate-300'}`}>{m.status}</span>
                      <span className="text-[10px] text-slate-400">{m.series} • {m.time}</span>
                    </div>
                    <div className="font-bold text-sm text-white">
                      {m?.team1?.shortFrame} <span className="text-slate-500 mx-1">vs</span> {m?.team2?.shortFrame}
                    </div>
                  </div>
                  
                  {alreadyExists ? (
                     <span className="text-[10px] text-green-500 font-bold border border-green-500/30 px-3 py-1.5 rounded-lg bg-green-500/10 opacity-70">IMPORTED ✓</span>
                  ) : (
                     <button
                       onClick={() => {
                          const newAppMatch = {
                            id: m.id,
                            series: m.series,
                            time: m.time,
                            matchDateISO: m.matchDateISO,
                            status: m.status,
                            format: 'T20',
                            type: 'Mega',
                            prize: '₹200 Crore',
                            lineupStatus: 'OUT' as const,
                            team1: m.team1,
                            team2: m.team2
                          };
                          const newMatches = [newAppMatch, ...appMatches];
                          setAppMatches(newMatches);
                          // Removing main_state write to avoid 1MB document size errors.
                          // Force re-render of this button
                          setApiMatches([...apiMatches]);
                       }}
                       className="bg-[#e5c158] hover:bg-[#f0b90b] text-black px-4 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-[0_0_10px_rgba(229,193,88,0.4)]"
                     >
                       Accept & Import
                     </button>
                  )}
               </div>
              );
           })}
        </div>
     )}
  </div>
)}

<button
   onClick={() => setShowMatchList(!showMatchList)}
   className={`flex items-center justify-between w-full mt-4 bg-[#13151c] border ${showMatchList ? 'border-red-500/50 rounded-t-xl border-b-0 mb-0 bg-gradient-to-b from-red-500/10 to-transparent' : 'border-red-500/30 rounded-xl mb-3 hover:border-red-500/50'} p-4 shadow-lg transition-all relative group overflow-hidden`}
>
  <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/10 to-red-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
  <h3 className="font-bold text-red-500 tracking-wide flex items-center gap-2 z-10"><Trophy size={18} /> MATCH LIST & CREATOR</h3>
  <div className={`p-1.5 rounded-lg border transition-all z-10 ${showMatchList ? 'text-white border-red-500 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'text-red-500 border-red-500/50 bg-black/40 group-hover:text-red-400 group-hover:border-red-400'}`}>
     {showMatchList ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} />}
  </div>
</button>

{showMatchList && (
  <div className="bg-[#13151c] rounded-b-2xl shadow-lg border border-red-500/50 border-t-0 p-5 mb-6 backdrop-blur-sm relative before:absolute before:inset-0 before:bg-gradient-to-b before:from-red-500/5 before:to-transparent before:pointer-events-none">
     <h2 className="text-xl font-bold text-slate-200 tracking-wide uppercase text-center mb-6 relative z-10">Match List & Player Database</h2>
     
     <div className="space-y-4 relative z-10">
        <div className="bg-black/40 border border-slate-700/50 p-4 rounded-xl space-y-3">
           <div>
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Select Series</label>
               <select value={matchListSeries} onChange={e => setMatchListSeries(e.target.value)} className="w-full bg-black/60 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 outline-none focus:border-red-500">
                  <option value="IPL">IPL</option>
                  <option value="TEST">Test</option>
                  <option value="ODI">ODI</option>
                  <option value="T20">T20</option>
                  <option value="THE HUNDRED">The Hundred</option>
               </select>
           </div>
           
           <div className="grid grid-cols-2 gap-3">
              <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Team 1 Name</label>
                 <input type="text" placeholder="India" value={matchListT1Name} onChange={e => setMatchListT1Name(e.target.value)} className="w-full bg-black/60 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-red-500" />
              </div>
              <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Team 1 Code</label>
                 <input type="text" placeholder="IND" value={matchListT1Code} onChange={e => setMatchListT1Code(e.target.value)} className="w-full bg-black/60 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-red-500" />
              </div>
           </div>

           <div className="grid grid-cols-2 gap-3">
              <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Team 2 Name</label>
                 <input type="text" placeholder="Pakistan" value={matchListT2Name} onChange={e => setMatchListT2Name(e.target.value)} className="w-full bg-black/60 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-red-500" />
              </div>
              <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Team 2 Code</label>
                 <input type="text" placeholder="PAK" value={matchListT2Code} onChange={e => setMatchListT2Code(e.target.value)} className="w-full bg-black/60 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-red-500" />
              </div>
           </div>
        </div>

        <div className="bg-black/40 border border-slate-700/50 p-4 rounded-xl">
           <h3 className="text-sm font-bold text-slate-200 mb-3 border-b border-slate-700/50 pb-2">Add Player</h3>
           <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="col-span-2">
                 <input type="text" placeholder="Player Name" value={mlPlayerName} onChange={e => setMlPlayerName(e.target.value)} className="w-full bg-black/60 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-red-500" />
              </div>
              <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase">Role</label>
                 <select value={mlPlayerRole} onChange={e => setMlPlayerRole(e.target.value)} className="w-full bg-black/60 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-red-500">
                    <option value="BAT">Batsman</option>
                    <option value="AR">All Rounder</option>
                    <option value="BOWL">Bowler</option>
                    <option value="WK">Wicket Keeper</option>
                 </select>
              </div>
              <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase">Team</label>
                 <select value={mlPlayerTeam} onChange={e => setMlPlayerTeam(Number(e.target.value))} className="w-full bg-black/60 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-red-500">
                    <option value={1}>Team 1 ({matchListT1Code || 'T1'})</option>
                    <option value={2}>Team 2 ({matchListT2Code || 'T2'})</option>
                 </select>
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase flex justify-between">
                     Credits 
                     <span className="text-red-400">{mlPlayerCredits}</span>
                 </label>
                 <input type="range" min="4" max="12" step="0.5" value={mlPlayerCredits} onChange={e => setMlPlayerCredits(Number(e.target.value))} className="w-full accent-red-500 mt-1" />
              </div>
           </div>
           <button 
              onClick={() => {
                 if(mlPlayerName.trim()) {
                    setMatchListPlayers([...matchListPlayers, { name: mlPlayerName.trim(), role: mlPlayerRole, team: mlPlayerTeam, credits: mlPlayerCredits }]);
                    setMlPlayerName('');
                 }
              }}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded-lg text-sm border border-slate-600 transition-colors"
           >
              Add Player to List
           </button>
        </div>

        {matchListPlayers.length > 0 && (
           <div className="bg-black/40 border border-slate-700/50 p-4 rounded-xl max-h-[300px] overflow-y-auto">
              <h3 className="text-sm font-bold text-slate-200 mb-3 border-b border-slate-700/50 pb-2">Added Players ({matchListPlayers.length})</h3>
              <div className="space-y-1">
                 {matchListPlayers.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-black/40 p-2 rounded border border-slate-800/50">
                       <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-300">{p.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{p.role}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded text-red-400 font-mono">{p.credits} cr</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-500">{p.team === 1 ? matchListT1Code || 'T1' : matchListT2Code || 'T2'}</span>
                          <button onClick={() => setMatchListPlayers(matchListPlayers.filter((_, i) => i !== idx))} className="text-red-500/70 hover:text-red-500">
                             <X size={14} />
                          </button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}
        
        <button 
           onClick={() => {
              if(!matchListT1Name || !matchListT1Code || !matchListT2Name || !matchListT2Code) {
                 alert("Please fill in both team names and codes.");
                 return;
              }
              if(matchListPlayers.length === 0) {
                 alert("Please add at least one player.");
                 return;
              }
              
              const newMatchId = `ml_${Date.now()}`;
              const newMatch = {
                 id: newMatchId,
                 series: matchListSeries,
                 team1: { name: matchListT1Name, shortFrame: matchListT1Code, color: 'bg-blue-600' },
                 team2: { name: matchListT2Name, shortFrame: matchListT2Code, color: 'bg-green-600' },
                 time: 'Upcoming',
                 matchDateISO: new Date(Date.now() + 86400000).toISOString(),
                 status: 'Upcoming' as any,
                 lineupStatus: 'OUT' as any
              };
              
              const newPlayers = matchListPlayers.map((p, i) => ({
                 id: `mlp_${newMatchId}_${i}`,
                 name: p.name,
                 role: p.role,
                 team: p.team === 1 ? matchListT1Code : matchListT2Code,
                 credits: p.credits,
                 points: 0,
                 selPercent: 30 + Math.floor(Math.random() * 60)
              }));
              
              const updatedPlayers = [...appPlayers, ...newPlayers];
              const updatedMatches = [newMatch, ...appMatches];
              setAppMatches(updatedMatches);
              setAppPlayers(updatedPlayers);
              
              localStorage.setItem('dreamApp_matches', JSON.stringify(updatedMatches));
              localStorage.setItem('dreamApp_players', JSON.stringify(updatedPlayers));
              
              // syncActiveDataToCloud(); // Call sync button instead to avoid payload size errors
              
              setMatchListT1Name('');
              setMatchListT1Code('');
              setMatchListT2Name('');
              setMatchListT2Code('');
              setMatchListPlayers([]);
              setMlPlayerName('');
              alert(`Saved Match ${matchListT1Name} vs ${matchListT2Name} with ${newPlayers.length} players!`);
           }}
           className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-[0_0_15px_rgba(220,38,38,0.4)] flex items-center justify-center gap-2"
        >
           <Check size={18} /> SAVE COMPILED MATCH
        </button>
     </div>
  </div>
)}

<button 
      onClick={() => setShowPlayerScoring(!showPlayerScoring)}
      className={`flex items-center justify-between w-full mt-4 bg-[#13151c] border ${showPlayerScoring ? 'border-[#e5c158]/30 rounded-t-xl border-b-0 mb-0 bg-gradient-to-b from-[#e5c158]/5 to-transparent' : 'border-slate-800 rounded-xl mb-3 hover:border-[#e5c158]/30'} p-4 shadow-lg transition-all relative group overflow-hidden`}
    >
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <h3 className="font-bold text-slate-200 tracking-wide flex items-center justify-between z-10">Live Player Scoring & Adjustments</h3>
                <div className={`p-1.5 rounded-lg border transition-all z-10 ${showPlayerScoring ? 'text-black border-[#e5c158] bg-[#e5c158] shadow-[0_0_10px_rgba(229,193,88,0.5)]' : 'text-slate-500 border-slate-700 bg-black/40 group-hover:text-[#e5c158] group-hover:border-[#e5c158]/30'}`}>
       {showPlayerScoring ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} />}
    </div>
             </button>
             
             {showPlayerScoring && (
               <div className="bg-[#13151c] rounded-b-2xl shadow-lg border border-[#e5c158]/50 border-t-0 p-5 mb-6 backdrop-blur-sm relative before:absolute before:inset-0 before:bg-gradient-to-b before:from-yellow-500/5 before:to-transparent before:pointer-events-none">
                  <h2 className="text-xl font-bold text-slate-200 tracking-wide uppercase text-center mb-6 relative z-10">PLAYER SCORING & ADJUSTMENTS</h2>
                  
                  {(() => {
                      if (!adminScoringLiveMatchId) {
                          const liveMatches = appMatches.filter(m => m.status === 'Live' || m.status === 'LIVE');
                          if (liveMatches.length === 0) {
                              return (
                                  <div className="text-center text-slate-400 py-8 border border-slate-800 rounded-lg bg-black/20 relative z-10">
                                      <p>No matches are currently LIVE.</p>
                                      <p className="text-xs mt-2 text-slate-500">Go to Match Status to mark a match as LIVE to edit players.</p>
                                  </div>
                              );
                          }
                          
                          return (
                              <div className="relative z-10 space-y-3">
                                  <p className="text-sm text-slate-400 mb-4">Select a LIVE match to adjust player points:</p>
                                  {liveMatches.map(match => (
                                      <button 
                                          key={match.id}
                                          onClick={() => setAdminScoringLiveMatchId(match.id)}
                                          className="w-full flex items-center justify-between p-4 bg-black/40 border border-slate-700 rounded-xl hover:border-[#e5c158]/50 transition-colors"
                                      >
                                          <div className="flex flex-col items-start gap-1">
                                              <span className="text-xs text-[#e5c158] font-bold">{match.series}</span>
                                              <span className="font-bold text-slate-200">{match?.team1?.name} <span className="text-slate-500 font-normal">vs</span> {match?.team2?.name}</span>
                                          </div>
                                          <ChevronRight className="text-slate-500" size={20} />
                                      </button>
                                  ))}
                              </div>
                          );
                      }

                      const activeMatch = appMatches.find(m => m.id === adminScoringLiveMatchId);
                      if (!activeMatch) return null;

                      const liveTeams = [activeMatch?.team1?.shortFrame, activeMatch?.team2?.shortFrame];
                      const filteredPlayers = appPlayers.filter(p => liveTeams.includes(p.team) && ((p.name || '').toLowerCase().includes((playerScoringSearch || '').toLowerCase()) || (p.team || '').toLowerCase().includes((playerScoringSearch || '').toLowerCase())));

                      return (
                          <>
                              <div className="mb-6 relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                  <button onClick={() => setAdminScoringLiveMatchId(null)} className="p-1.5 bg-black/40 border border-slate-700 rounded-lg hover:border-[#e5c158]/50"><ArrowLeft size={16} className="text-slate-400" /></button>
                                  <h3 className="font-bold text-slate-200">{activeMatch?.team1?.name} vs {activeMatch?.team2?.name}</h3>
                                </div>
                                <div className="flex items-center gap-2 bg-black/40 border border-slate-700/50 rounded-lg p-2.5">
                                  <Search size={16} className="text-slate-500" />
                                  <input 
                                     type="text" 
                                     value={playerScoringSearch}
                                     onChange={e => setPlayerScoringSearch(e.target.value)}
                                     className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-none focus:ring-0" 
                                     placeholder="Search Player by Name or Team" 
                                  />
                                </div>
                              </div>
                              
                              <div className="overflow-hidden rounded-xl border border-slate-800/50 bg-black/20 relative z-10 overflow-x-auto">
                                <table className="w-full text-left text-xs min-w-[1000px]">
                                  <thead className="bg-[#090b10] border-b border-slate-800/50 text-slate-400">
                                    <tr>
                                      <th className="p-3 font-normal whitespace-nowrap">Player Name</th>
                                      <th className="p-3 font-normal">Team</th>
                                      <th className="p-3 font-normal text-center">Points<br/>(Default)</th>
                                      <th className="p-3 font-normal text-center">Adjustment<br/>Value</th>
                                      <th className="p-3 font-normal text-center">Manual<br/>Override</th>
                                      <th className="p-3 font-normal text-center">Quick Points Adds</th>
                                      <th className="p-3 font-normal text-center">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/50 bg-black/20">
                                    {filteredPlayers.slice(0, 50).map((p) => {
                           const st = playerAdjustments[p.id] || { adjustment: 0, manual: p.points, reason: '' };
                           return (
                             <tr key={p.id}>
                               <td className="p-3 font-bold text-slate-200">{p.name}</td>
                               <td className="p-3 text-slate-400 font-mono">{String(p.team || '').substring(0,3).toUpperCase()}</td>
                               <td className="p-3 text-center text-slate-300">{p.points}</td>
                               <td className="p-3">
                                  <div className="flex items-center justify-center gap-2 bg-[#090b10] border border-slate-700 rounded p-1 w-24 mx-auto">
                                    <button onClick={() => setPlayerAdjustments(prev => ({...prev, [p.id]: {...st, adjustment: st.adjustment - 1, manual: p.points + st.adjustment - 1}}))} className="text-slate-400 hover:text-white font-mono text-base font-bold">-</button>
                                    <span className={`font-mono font-bold w-6 text-center ${st.adjustment > 0 ? 'text-green-500' : st.adjustment < 0 ? 'text-red-500' : 'text-slate-400'}`}>{st.adjustment > 0 ? '+' : ''}{st.adjustment}</span>
                                    <button onClick={() => setPlayerAdjustments(prev => ({...prev, [p.id]: {...st, adjustment: st.adjustment + 1, manual: p.points + st.adjustment + 1}}))} className="text-slate-400 hover:text-white font-mono text-base font-bold">+</button>
                                  </div>
                               </td>
                               <td className="p-3">
                                  <div className="w-16 mx-auto">
                                    <input type="number" 
                                      value={st.manual}
                                      onChange={e => setPlayerAdjustments(prev => ({...prev, [p.id]: {...st, manual: parseInt(e.target.value)||0, adjustment: (parseInt(e.target.value)||0) - p.points}}))}
                                      className="w-full bg-[#090b10] border border-slate-800 text-center rounded p-1.5 text-xs text-slate-200 outline-none focus:border-[#e5c158]/50" />
                                  </div>
                               </td>
                               <td className="p-3">
                                 <div className="flex flex-wrap gap-1.5 justify-center max-w-[280px] mx-auto">
                                    <button onClick={() => setPlayerAdjustments(prev => ({...prev, [p.id]: {...st, adjustment: st.adjustment + 25, manual: p.points + st.adjustment + 25}}))} className="bg-green-600/20 hover:bg-green-600/40 text-green-500 text-[10px] px-2 py-1 rounded border border-green-600/30 whitespace-nowrap font-bold text-center flex items-center justify-center">+25 WICKET</button>
                                    <button onClick={() => setPlayerAdjustments(prev => ({...prev, [p.id]: {...st, adjustment: st.adjustment + 12, manual: p.points + st.adjustment + 12}}))} className="bg-green-600/20 hover:bg-green-600/40 text-green-500 text-[10px] px-2 py-1 rounded border border-green-600/30 whitespace-nowrap font-bold text-center flex items-center justify-center">+12 CATCH</button>
                                    <button onClick={() => setPlayerAdjustments(prev => ({...prev, [p.id]: {...st, adjustment: st.adjustment + 6, manual: p.points + st.adjustment + 6}}))} className="bg-green-600/20 hover:bg-green-600/40 text-green-500 text-[10px] px-2 py-1 rounded border border-green-600/30 whitespace-nowrap font-bold text-center flex items-center justify-center">+6 SIX</button>
                                    <button onClick={() => setPlayerAdjustments(prev => ({...prev, [p.id]: {...st, adjustment: st.adjustment + 4, manual: p.points + st.adjustment + 4}}))} className="bg-green-600/20 hover:bg-green-600/40 text-green-500 text-[10px] px-2 py-1 rounded border border-green-600/30 whitespace-nowrap font-bold text-center flex items-center justify-center">+4 FOUR</button>
                                    <button onClick={() => setPlayerAdjustments(prev => ({...prev, [p.id]: {...st, adjustment: st.adjustment + 2, manual: p.points + st.adjustment + 2}}))} className="bg-green-600/20 hover:bg-green-600/40 text-green-500 text-[10px] px-2 py-1 rounded border border-green-600/30 whitespace-nowrap font-bold text-center flex items-center justify-center">+2 (2 RUNS)</button>
                                    <button onClick={() => setPlayerAdjustments(prev => ({...prev, [p.id]: {...st, adjustment: st.adjustment + 1, manual: p.points + st.adjustment + 1}}))} className="bg-green-600/20 hover:bg-green-600/40 text-green-500 text-[10px] px-2 py-1 rounded border border-green-600/30 whitespace-nowrap font-bold text-center flex items-center justify-center">+1 RUN</button>
                                    
                                    <button onClick={() => {
                                        const customStr = prompt('Enter custom points to add/subtract:');
                                        if (customStr && !isNaN(parseInt(customStr))) {
                                            const pts = parseInt(customStr);
                                            setPlayerAdjustments(prev => ({...prev, [p.id]: {...st, adjustment: st.adjustment + pts, manual: p.points + st.adjustment + pts}}));
                                        }
                                    }} className="bg-[#e5c158]/20 hover:bg-[#e5c158]/40 text-[#e5c158] text-[10px] px-2 py-1 rounded border border-[#e5c158]/30 flex items-center justify-center font-bold font-mono min-w-[30px]"><Plus size={12} /></button>
                                 </div>
                               </td>
                               <td className="p-3 text-center">
                                 <button 
                                     onClick={async () => {
                                        const finalPts = st.manual;
                                        setAppPlayers(prev => prev.map(pl => pl.id === p.id ? { ...pl, points: finalPts } : pl));
                                        setPlayerAdjustments(prev => {
                                            const newState = { ...prev };
                                            delete newState[p.id];
                                            return newState;
                                        });
                                        
                                        // Also sync to cloud db immediately if possible
                                        try {
                                          await setDoc(doc(db, 'gameData', 'live_player_points'), { [p.id]: finalPts }, { merge: true });
                                        } catch (e) {
                                          console.error("Could not sync point update to cloud immediately", e);
                                        }

                                        setUpdateSuccessIds(prev => ({...prev, [p.id]: true}));
                                        setTimeout(() => {
                                            setUpdateSuccessIds(prev => ({...prev, [p.id]: false}));
                                        }, 2000);
                                     }}
                                     className={`${updateSuccessIds[p.id] ? 'bg-blue-600/30 hover:bg-blue-600/50 text-blue-400 border-blue-500/50' : 'bg-green-600/20 hover:bg-green-600/40 text-green-500 border-green-600/30'} font-bold px-4 py-2 rounded border transition-all text-xs uppercase tracking-wider`}>
                                    {updateSuccessIds[p.id] ? 'Successful' : 'Update'}
                                 </button>
                               </td>
                             </tr>
                           );
                        })}
                      </tbody>
                    </table>
                  </div>
                  </>
                  );
                  })()}
               </div>
             )}

             <button 
      onClick={() => setShowManageMatches(!showManageMatches)}
      className={`flex items-center justify-between w-full mt-4 bg-[#13151c] border ${showManageMatches ? 'border-[#e5c158]/30 rounded-t-xl border-b-0 mb-0 bg-gradient-to-b from-[#e5c158]/5 to-transparent' : 'border-slate-800 rounded-xl mb-3 hover:border-[#e5c158]/30'} p-4 shadow-lg transition-all relative group overflow-hidden`}
    >
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <h3 className="font-bold text-slate-200 tracking-wide flex items-center justify-between z-10">App Settings: Manage Matches</h3>
                <div className={`p-1.5 rounded-lg border transition-all z-10 ${showManageMatches ? 'text-black border-[#e5c158] bg-[#e5c158] shadow-[0_0_10px_rgba(229,193,88,0.5)]' : 'text-slate-500 border-slate-700 bg-black/40 group-hover:text-[#e5c158] group-hover:border-[#e5c158]/30'}`}>
       {showManageMatches ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} />}
    </div>
             </button>
             
             {showManageMatches && (
               <div className="bg-[#13151c] rounded-b-2xl shadow-lg border border-[#e5c158]/50 border-t-0 p-5 mb-6 backdrop-blur-sm relative before:absolute before:inset-0 before:bg-gradient-to-b before:from-yellow-500/5 before:to-transparent before:pointer-events-none">
                  <p className="text-xs text-slate-400 mb-5 pl-1 relative z-10">Create new upcoming matches or change the status of existing matches (Live, Completed).</p>
                  
                  <p className="text-[10px] font-black text-[#e5c158]/70 uppercase tracking-widest mb-3 relative z-10">Live / Existing Matches Control</p>
                  <div className="space-y-4 relative z-10">
                    {appMatches.map(m => (
                       <AdminMatchEditCard 
                         key={m.id} 
                         match={m} 
                         onUpdate={(updatedMatch) => {
                            const newMatches = appMatches.map(mm => mm.id === m.id ? updatedMatch : mm);
                            setAppMatches(newMatches);
                            // Removing main_state write to avoid 1MB document size errors.
                            // Use "Update Apps & Player" button to sync.
                         }}
                         onDelete={() => {
                            const newMatches = appMatches.filter(mm => mm.id !== m.id);
                            setAppMatches(newMatches);
                            // Removing main_state write to avoid 1MB document size errors.
                         }}
                         onStatusChange={(status) => {
                            if (status === 'Completed' && m.status !== 'Completed') {
                                distributePrizes(m.id);
                            }
                            const newMatches = appMatches.map(mm => mm.id === m.id ? { ...mm, status } : mm);
                            setAppMatches(newMatches);
                            // Removing main_state write to avoid 1MB document size errors.
                         }}
                         onLineupToggle={() => {
                            const newMatches = appMatches.map(mm => mm.id === m.id ? { ...mm, lineupStatus: mm.lineupStatus === 'OUT' ? 'NOT_OUT' : 'OUT' as const } : mm);
                            setAppMatches(newMatches);
                            // Removing main_state write to avoid 1MB document size errors.
                         }}
                       />
                    ))}
                  </div>
               </div>
             )}

             </>)}
{adminTab === 'USERS' && (<>


<button 
      onClick={() => setShowManageKYC(!showManageKYC)}
      className={`flex items-center justify-between w-full mt-4 bg-[#13151c] border ${showManageKYC ? 'border-[#e5c158]/30 rounded-t-xl border-b-0 mb-0 bg-gradient-to-b from-[#e5c158]/5 to-transparent' : 'border-slate-800 rounded-xl mb-3 hover:border-[#e5c158]/30'} p-4 shadow-lg transition-all relative group overflow-hidden`}
    >
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <h3 className="font-bold text-slate-200 tracking-wide flex items-center justify-between z-10">Manage KYC Requests</h3>
                <div className={`p-1.5 rounded-lg border transition-all z-10 ${showManageKYC ? 'text-black border-[#e5c158] bg-[#e5c158] shadow-[0_0_10px_rgba(229,193,88,0.5)]' : 'text-slate-500 border-slate-700 bg-black/40 group-hover:text-[#e5c158] group-hover:border-[#e5c158]/30'}`}>
       {showManageKYC ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} />}
    </div>
             </button>
             
             {showManageKYC && (
               <div className="bg-[#13151c] rounded-b-2xl shadow-lg border border-[#e5c158]/50 border-t-0 p-5 mb-6 relative">
                 {selectedKycRequest ? (
                   <div>
                     <button onClick={() => setSelectedKycRequest(null)} className="mb-4 flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"><ChevronLeft size={16}/> Back to Requests</button>
                     <h2 className="text-xl font-bold text-slate-200 tracking-wide uppercase text-center mb-6">User Manage KYC</h2>
                     
                     <div className="mb-6">
                       <label className="block text-xs text-slate-400 mb-1">Search User ID / Email</label>
                       <input type="text" className="w-full bg-transparent border border-slate-700/50 rounded-lg p-2.5 text-sm text-slate-200 outline-none focus:border-[#e5c158]/50" placeholder="Enter User ID or Email..." />
                     </div>
                     
                     <div className="mb-6">
                       <p className="text-sm text-slate-300 mb-3">User Profile & KYC Documents</p>
                       <div className="flex items-center gap-4 bg-black/20 p-4 rounded-xl border border-slate-800/50">
                         <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
                            <User size={32} className="text-slate-500" />
                         </div>
                         <div className="flex-1 space-y-1">
                           <p className="text-sm text-slate-400">Full Name: <span className="text-slate-200">{selectedKycRequest.userName}</span></p>
                           <p className="text-sm text-slate-400">User ID: <span className="text-slate-200 font-mono select-all">{selectedKycRequest.userNumericId || selectedKycRequest.userId}</span></p>
                           <p className="text-sm text-slate-400">Email: <span className="text-slate-200">{selectedKycRequest.userEmail || 'user@example.com'}</span></p>
                           <p className="text-sm text-slate-400">Phone: <span className="text-slate-200">{selectedKycRequest.userPhone || '+91-XXXXX-XXXXX'}</span></p>
                           <p className="text-sm text-slate-400 flex items-center gap-2">KYC Status: <span className="px-2 py-0.5 rounded bg-[#e5c158]/20 text-[#e5c158] text-[10px] uppercase font-bold tracking-wider">{selectedKycRequest.status === 'Pending Review' ? 'PENDING VERIFICATION' : selectedKycRequest.status}</span></p>
                         </div>
                       </div>
                     </div>
                     
                     <div className="mb-6">
                       <p className="text-sm text-slate-300 mb-3">KYC Document Verification</p>
                       <div className="overflow-hidden rounded-xl border border-slate-800/50 bg-black/20">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-black/40 border-b border-slate-800/50">
                              <tr>
                                <th className="p-3 font-normal text-slate-400">Document Type</th>
                                <th className="p-3 font-normal text-slate-400">Document ID</th>
                                <th className="p-3 font-normal text-slate-400">Status</th>
                                <th className="p-3 font-normal text-slate-400 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                              <tr>
                                <td className="p-3 text-slate-300">Aadhaar Card</td>
                                <td className="p-3 text-slate-300">{selectedKycRequest.aadhar || 'ID-XXXXXXXXXXXX'}</td>
                                <td className="p-3 text-[#e5c158]">PENDING</td>
                                <td className="p-3 text-center"><button className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors uppercase text-[10px] tracking-wider">VIEW/VERIFY</button></td>
                              </tr>
                              <tr>
                                <td className="p-3 text-slate-300">PAN Card</td>
                                <td className="p-3 text-slate-300">{selectedKycRequest.pan || 'ID-XXXXXXXXXXXX'}</td>
                                <td className="p-3 text-green-500">VERIFIED</td>
                                <td className="p-3 text-center"><button className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors uppercase text-[10px] tracking-wider">RE-VIEW</button></td>
                              </tr>
                            </tbody>
                          </table>
                       </div>
                     </div>
                     
                     <div className="space-y-3 mb-6">
                        <button onClick={async () => {
                                      await setDoc(doc(db, 'kyc', selectedKycRequest.id), { ...selectedKycRequest, status: 'Approved' });
                                      alert('KYC Approved for ' + selectedKycRequest.userName + '.');
                                      setSelectedKycRequest(null);
                                   }} className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 rounded-lg transition-colors uppercase tracking-widest text-sm">VERIFY USER KYC</button>
                        <button className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold py-3 rounded-lg transition-colors uppercase tracking-widest text-sm">REQUEST ADDITIONAL INFO</button>
                     </div>
                     
                     <div>
                       <p className="text-sm text-slate-300 mb-3">User Verification History</p>
                       <div className="overflow-hidden rounded-xl border border-slate-800/50 bg-black/20">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-black/40 border-b border-slate-800/50">
                              <tr>
                                <th className="p-3 font-normal text-slate-400">Date</th>
                                <th className="p-3 font-normal text-slate-400">Action Take</th>
                                <th className="p-3 font-normal text-slate-400">Admin Notes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                              <tr>
                                <td className="p-3 text-slate-500" colSpan={3}>No history available</td>
                              </tr>
                            </tbody>
                          </table>
                       </div>
                     </div>
                   </div>
                 ) : (
                  <div>
                  <h2 className="text-xl font-bold text-slate-200 tracking-wide uppercase text-center mb-6">KYC Requests</h2>
                  <div className="space-y-4 relative z-10">
                     {kycRequests.filter(r => r.status === 'Pending Review').length === 0 ? (
                        <p className="text-sm font-bold text-slate-500 text-center py-6 bg-black/40 border border-slate-700 rounded-xl">No pending KYC requests.</p>
                     ) : (
                        kycRequests.filter(r => r.status === 'Pending Review').map((req) => (
                           <div key={req.id} className="bg-black/40 border border-[#e5c158]/20 rounded-xl p-4">
                              <div className="flex justify-between items-start mb-3 border-b border-[#e5c158]/20 pb-3">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-[#e5c158]/70 uppercase tracking-widest leading-none mb-1">User</span>
                                  <span className="font-bold text-slate-200">{req.userName}</span>
                                </div>
                                <div className="flex flex-col text-right">
                                  <span className="text-[10px] font-black text-[#e5c158]/70 uppercase tracking-widest leading-none mb-1">Time</span>
                                  <span className="text-xs text-slate-400">{req.timestamp}</span>
                                </div>
                              </div>
                              <div className="mb-4 bg-black/60 p-3 rounded-lg border border-slate-700">
                                <p className="text-xs text-slate-400 mb-1.5 flex justify-between">Aadhar: <span className="font-mono font-bold text-slate-200">{req.aadhar}</span></p>
                                <p className="text-xs text-slate-400 flex justify-between">PAN: <span className="font-mono font-bold text-slate-200">{req.pan}</span></p>
                              </div>
                              <div className="flex gap-3">
                                 <button 
                                   onClick={() => setSelectedKycRequest(req)}
                                   className="flex-1 bg-[#e5c158]/20 hover:bg-[#e5c158]/30 text-[#e5c158] border border-[#e5c158]/50 font-bold py-2.5 rounded-lg active:scale-[0.98] transition-all text-xs text-center uppercase tracking-widest">
                                   Review KYC
                                 </button>
                              </div>
                           </div>
                        ))
                     )}
                  </div>
                  </div>
                 )}
               </div>
             )}

             </>)}
{adminTab === 'ENTRY FEES' && (<>
   <h3 className="font-bold text-[#e5c158]/80 uppercase tracking-widest text-[10px] mb-3 ml-1 mt-6">System Control: Entry Fees Section</h3>
   <div className="bg-[#13151c] rounded-2xl shadow-lg border border-[#e5c158]/20 p-5 mb-6 relative overflow-hidden backdrop-blur-sm">
       <p className="text-xs text-slate-400 mb-5 pl-1 relative z-10">See all completed/filled contest instances and the entry fees generated.</p>
       
       <div className="space-y-4 relative z-10">
           {(() => {
               // Group savedTeams by match.id -> contestName -> instanceId
               const filledInstances: any[] = [];
               appMatches.forEach(match => {
                   appContests.forEach(contest => {
                       const cspots = contest.spots > 0 ? contest.spots : 2;
                       const teamsForThis = savedTeams.filter(t => t.match?.id === match.id && t.contestName === contest.name);
                       if (teamsForThis.length === 0) return;
                       
                       // Group by instanceId
                       const instanceMap: {[key: string]: any[]} = {};
                       teamsForThis.forEach(t => {
                           const iId = t.instanceId || 0;
                           if (!instanceMap[iId]) instanceMap[iId] = [];
                           instanceMap[iId].push(t);
                       });

                       Object.keys(instanceMap).forEach(iId => {
                           const teamsInInstance = instanceMap[iId];
                           if (teamsInInstance.length === cspots) {
                               filledInstances.push({
                                   matchId: match.id,
                                   matchSeries: match.series,
                                   team1: match?.team1?.shortFrame,
                                   team2: match?.team2?.shortFrame,
                                   matchTime: match.time,
                                   contestName: contest.name,
                                   contestType: contest.type,
                                   instanceId: iId,
                                   totalFees: teamsInInstance.reduce((acc, t) => acc + (t.fee || 0), 0),
                                   teams: teamsInInstance
                               });
                           }
                       });
                   });
               });

               if (filledInstances.length === 0) {
                   return <p className="text-sm font-bold text-slate-500 text-center py-6 bg-black/40 border border-slate-700 rounded-xl">No filled contests yet.</p>;
               }

               const totalRevenue = filledInstances.reduce((acc, inst) => acc + inst.totalFees, 0);

               return (
                  <>
                    <div className="bg-black/40 border border-slate-700 p-4 rounded-xl flex items-center justify-between mb-4">
                       <span className="text-sm text-slate-400 font-bold uppercase">Total Entry Fees (Filled)</span>
                       <span className="text-xl font-black text-green-500">₹{totalRevenue}</span>
                    </div>

                    {filledInstances.map((inst, i) => (
                        <div key={i} className="bg-black/40 border border-slate-700/50 p-4 rounded-xl flex flex-col gap-2 relative">
                            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                               <div>
                                  <span className="text-xs text-yellow-500 font-bold">{inst.contestName} ({inst.contestType})</span>
                                  <div className="text-[10px] text-slate-400 flex gap-1 items-center mt-1">
                                     <span className="bg-slate-800 px-1.5 py-0.5 rounded">{inst.team1} vs {inst.team2}</span>
                                     <span>• Instance #{parseInt(inst.instanceId) + 1}</span>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <span className="text-xs text-slate-500 block uppercase font-bold">Total Entry Fee</span>
                                  <span className="text-sm text-green-400 font-black">₹{inst.totalFees}</span>
                               </div>
                            </div>
                            <div className="flex -space-x-2 overflow-hidden py-1">
                               {inst.teams.map((t: any, idx: number) => (
                                   <div key={idx} className="inline-block h-6 w-6 rounded-full ring-2 ring-black bg-slate-800 text-[8px] flex items-center justify-center font-bold text-white shrink-0" title={t.userName}>
                                      {String(t.userName || t.userId || 'U').substring(0, 2).toUpperCase()}
                                   </div>
                               ))}
                               <span className="ml-4 text-[10px] text-slate-500 self-center font-bold">{inst.teams.length} Users Joined</span>
                            </div>
                        </div>
                    ))}
                  </>
               );
           })()}
       </div>
   </div>
</>)}
{adminTab === 'FINANCIALS' && (<>
   <div className="bg-[#13151c] rounded-2xl shadow-lg border border-[#e5c158]/20 p-5 mb-6 relative overflow-hidden backdrop-blur-sm">
       <h3 className="font-bold text-slate-200 tracking-wide flex items-center gap-2 mb-6">
           <BarChart2 size={18} className="text-[#e5c158]" /> Real-time Financial Breakdown
       </h3>
       
       {(() => {
           let totalRev = 0;
           depositRequests.forEach(d => {
               if (d.status === 'Approved') totalRev += parseFloat(d.amount?.toString() || '0');
           });
       
           let totalPay = 0;
           withdrawRequests.forEach(w => {
               if (w.status === 'Approved') totalPay += parseFloat(w.amount?.toString() || '0');
           });
       
           let margin = 0;
           if (totalRev > 0) {
               margin = ((totalRev - totalPay) / totalRev) * 100;
           }

           // Generate Monthly Data
           const monthMap: Record<string, { name: string; revenue: number; payout: number }> = {};
           
           // Initialize last 6 months
           for(let i=5; i>=0; i--) {
               const d = new Date();
               d.setMonth(d.getMonth() - i);
               const monthName = d.toLocaleString('default', { month: 'short', year: '2-digit' });
               monthMap[monthName] = { name: monthName, revenue: 0, payout: 0 };
           }

           depositRequests.forEach(d => {
               if (d.status === 'Approved' && d.timestamp) {
                   const date = new Date(d.timestamp);
                   const mName = date.toLocaleString('default', { month: 'short', year: '2-digit' });
                   if (monthMap[mName]) {
                       monthMap[mName].revenue += parseFloat(d.amount?.toString() || '0');
                   } else {
                       monthMap[mName] = { name: mName, revenue: parseFloat(d.amount?.toString() || '0'), payout: 0 };
                   }
               }
           });

           withdrawRequests.forEach(w => {
               if (w.status === 'Approved' && w.timestamp) {
                   const date = new Date(w.timestamp);
                   const mName = date.toLocaleString('default', { month: 'short', year: '2-digit' });
                   if (monthMap[mName]) {
                       monthMap[mName].payout += parseFloat(w.amount?.toString() || '0');
                   } else {
                       if (monthMap[mName]) {
                           monthMap[mName].payout += parseFloat(w.amount?.toString() || '0');
                       } else {
                           monthMap[mName] = { name: mName, revenue: 0, payout: parseFloat(w.amount?.toString() || '0') };
                       }
                   }
               }
           });

           // Sort the months chronologically
           const monthlyData = Object.values(monthMap).sort((a,b) => {
               const dateA = new Date('01 ' + a.name.replace("'", ""));
               const dateB = new Date('01 ' + b.name.replace("'", ""));
               return dateA.getTime() - dateB.getTime();
           });

           const formatFinance = (val: number) => {
               if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
               if (val >= 1000) return `₹${(val / 1000).toFixed(2)} K`;
               return `₹${val.toFixed(0)}`;
           };

           return (
               <>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                       <div className="bg-black/40 border border-[#3b82f6]/30 p-4 rounded-xl flex flex-col justify-center">
                           <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Total Lifetime Revenue</p>
                           <p className="text-2xl font-black text-[#3b82f6]">{formatFinance(totalRev)}</p>
                       </div>
                       <div className="bg-black/40 border border-[#eab308]/30 p-4 rounded-xl flex flex-col justify-center">
                           <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Total Lifetime Payouts</p>
                           <p className="text-2xl font-black text-[#eab308]">{formatFinance(totalPay)}</p>
                       </div>
                       <div className="bg-black/40 border border-[#22c55e]/30 p-4 rounded-xl flex flex-col justify-center">
                           <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Net Margin</p>
                           <p className="text-2xl font-black text-[#22c55e]">{margin.toFixed(2)}%</p>
                       </div>
                   </div>

                   <div className="h-[250px] w-full">
                       <p className="text-sm font-bold text-slate-300 mb-4">Monthly Revenue vs Payouts</p>
                       <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={monthlyData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                           <defs>
                             <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                             </linearGradient>
                             <linearGradient id="colorPay" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                             </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                           <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} />
                           <YAxis stroke="#64748b" fontSize={10} tickFormatter={(value) => `₹${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`} axisLine={false} tickLine={false} />
                           <RechartsTooltip 
                               contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                               itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                               labelStyle={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}
                               formatter={(value: number) => [`₹${value}`, '']}
                           />
                           <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                           <Area type="monotone" dataKey="payout" name="Payouts" stroke="#eab308" strokeWidth={3} fillOpacity={1} fill="url(#colorPay)" />
                         </AreaChart>
                       </ResponsiveContainer>
                   </div>
               </>
           );
       })()}
   </div>

    <div className="mb-6 flex justify-end">
        <button onClick={async () => {
                 if (window.confirm("WARNING: This will permanently DELETE ALL deposit and withdrawal history. It will set Total Lifetime Revenue and Payouts to zero. Are you absolutely sure?")) {
                     const confirmText = window.prompt("Type 'RESET' to confirm.");
                     if (confirmText === 'RESET') {
                         try {
                              depositRequests.forEach(async (d) => {
                                  await deleteDoc(doc(db, 'deposits', d.id));
                              });
                              withdrawRequests.forEach(async (w) => {
                                  await deleteDoc(doc(db, 'withdrawals', w.id));
                              });
                              alert("System financial history has been completely wiped.");
                         } catch (e) {
                              console.error(e);
                              alert("Failed to wipe data.");
                         }
                     } else {
                         alert("Cancelled.");
                     }
                 }
            }} className="bg-red-900/40 text-red-500 border border-red-900/50 hover:bg-red-900/60 transition-colors uppercase tracking-widest text-[10px] font-bold py-2 px-4 rounded-lg flex items-center gap-2">
            <Trash2 size={14} /> Wipe All Financial History
        </button>
    </div>

<button 
      onClick={() => setShowManageWithdrawals(!showManageWithdrawals)}
      className={`flex items-center justify-between w-full mt-4 bg-[#13151c] border ${showManageWithdrawals ? 'border-[#e5c158]/30 rounded-t-xl border-b-0 mb-0 bg-gradient-to-b from-[#e5c158]/5 to-transparent' : 'border-slate-800 rounded-xl mb-3 hover:border-[#e5c158]/30'} p-4 shadow-lg transition-all relative group overflow-hidden`}
    >
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <h3 className="font-bold text-slate-200 tracking-wide flex items-center justify-between z-10">Manage Withdrawal Requests</h3>
                <div className={`p-1.5 rounded-lg border transition-all z-10 ${showManageWithdrawals ? 'text-black border-[#e5c158] bg-[#e5c158] shadow-[0_0_10px_rgba(229,193,88,0.5)]' : 'text-slate-500 border-slate-700 bg-black/40 group-hover:text-[#e5c158] group-hover:border-[#e5c158]/30'}`}>
       {showManageWithdrawals ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} />}
    </div>
             </button>
             
             {showManageWithdrawals && (
               <div className="bg-[#13151c] rounded-b-2xl shadow-lg border border-[#e5c158]/50 border-t-0 p-5 mb-6 backdrop-blur-sm relative before:absolute before:inset-0 before:bg-gradient-to-b before:from-yellow-500/5 before:to-transparent before:pointer-events-none">
                  <p className="text-xs text-slate-400 mb-5 pl-1 relative z-10">View and approve user withdrawal requests.</p>
                  <div className="space-y-4 relative z-10">
                     {withdrawRequests.filter(r => r.status === 'Pending').length === 0 ? (
                        <p className="text-sm font-bold text-slate-500 text-center py-6 bg-black/40 border border-slate-700 rounded-xl">No pending withdrawal requests.</p>
                     ) : (
                        withdrawRequests.filter(r => r.status === 'Pending').map((req) => {
                           const bankAccount = bankAccounts.find(b => b.id === req.bankAccountId);
                           return (
                             <div key={req.id} className="bg-black/40 border border-[#e5c158]/20 rounded-xl p-4">
                                <div className="flex justify-between items-start mb-3 border-b border-[#e5c158]/20 pb-3">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-[#e5c158]/70 uppercase tracking-widest leading-none mb-1">User ID</span>
                                    <span className="font-bold text-slate-200 text-xs font-mono select-all">{req.userNumericId || req.userId || 'Unknown'}</span>
                                  </div>
                                  <div className="flex flex-col text-right">
                                    <span className="text-[10px] font-black text-[#e5c158]/70 uppercase tracking-widest leading-none mb-1">Amount</span>
                                    <span className="font-black text-[#e5c158] drop-shadow-[0_0_8px_rgba(234,179,8,0.3)] text-xl">₹{req.amount}</span>
                                  </div>
                                </div>
                                <div className="mb-4 bg-black/60 p-4 rounded-lg border border-slate-700">
                                  <p className="text-[10px] font-black text-[#e5c158]/70 uppercase tracking-widest mb-2">Bank Details</p>
                                  <p className="text-sm font-bold text-slate-200 mb-1.5"><span className="text-slate-500 font-normal">Holder:</span> {bankAccount?.accountHolderName}</p>
                                  <p className="text-sm font-bold text-slate-200 mb-1.5"><span className="text-slate-500 font-normal">Acc Num:</span> {bankAccount?.accountNumber}</p>
                                  <p className="text-sm font-bold text-slate-200 uppercase"><span className="text-slate-500 font-normal capitalize">IFSC:</span> {bankAccount?.ifscCode}</p>
                                </div>
                                <div className="flex gap-3">
                                   <button 
                                     onClick={async () => {
                                        await setDoc(doc(db, 'withdrawals', req.id), { ...req, status: 'Approved' });
                                        alert(`Withdrawal of ₹${req.amount} approved. Make sure you sent the money via the bank details provided.`);
                                     }}
                                     className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 font-bold py-2.5 rounded-lg active:scale-[0.98] transition-all text-xs text-center uppercase tracking-widest"
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
                                     className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 font-bold py-2.5 rounded-lg active:scale-[0.98] transition-all text-xs text-center uppercase tracking-widest"
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
      className={`flex items-center justify-between w-full mt-4 bg-[#13151c] border ${showManageDeposits ? 'border-[#e5c158]/30 rounded-t-xl border-b-0 mb-0 bg-gradient-to-b from-[#e5c158]/5 to-transparent' : 'border-slate-800 rounded-xl mb-3 hover:border-[#e5c158]/30'} p-4 shadow-lg transition-all relative group overflow-hidden`}
    >
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <h3 className="font-bold text-slate-200 tracking-wide flex items-center justify-between z-10">Manage Deposit Requests</h3>
                <div className={`p-1.5 rounded-lg border transition-all z-10 ${showManageDeposits ? 'text-black border-[#e5c158] bg-[#e5c158] shadow-[0_0_10px_rgba(229,193,88,0.5)]' : 'text-slate-500 border-slate-700 bg-black/40 group-hover:text-[#e5c158] group-hover:border-[#e5c158]/30'}`}>
       {showManageDeposits ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} />}
    </div>
             </button>
             
             {showManageDeposits && (
               <div className="bg-[#13151c] rounded-b-2xl shadow-lg border border-[#e5c158]/50 border-t-0 p-5 mb-6 backdrop-blur-sm relative before:absolute before:inset-0 before:bg-gradient-to-b before:from-yellow-500/5 before:to-transparent before:pointer-events-none">
                  <p className="text-xs text-slate-400 mb-5 pl-1 relative z-10">View user deposit requests, verify their screenshot/UTR, and add the amount to their wallet.</p>
                  
                  <div className="space-y-4 relative z-10">
                     {depositRequests.filter(r => r.status === 'Pending').length === 0 ? (
                        <p className="text-sm font-bold text-slate-500 text-center py-6 bg-black/40 border border-slate-700 rounded-xl">No pending deposit requests.</p>
                     ) : (
                        depositRequests.filter(r => r.status === 'Pending').map((req, index) => (
                           <div key={req.id} className="bg-black/40 border border-[#e5c158]/20 rounded-xl p-4">
                              <div className="flex justify-between items-start mb-3 border-b border-[#e5c158]/20 pb-3">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-[#e5c158]/70 uppercase tracking-widest leading-none mb-1">Method</span>
                                  <span className="font-bold text-slate-200 text-xs">{req.method}</span>
                                </div>
                                <div className="flex flex-col text-right">
                                  <span className="text-[10px] font-black text-[#e5c158]/70 uppercase tracking-widest leading-none mb-1">Amount</span>
                                  <span className="font-black text-[#e5c158] drop-shadow-[0_0_8px_rgba(234,179,8,0.3)] text-xl">₹{req.amount}</span>
                                </div>
                              </div>
                              <div className="mb-4 bg-black/60 p-4 rounded-lg border border-slate-700">
                                {req.userName && <p className="text-xs text-slate-300 mb-2 flex justify-between"><span>User:</span> <span className="font-bold text-slate-200">{req.userName}</span></p>}
                                <p className="text-xs text-slate-300 mb-2 flex justify-between"><span>ID:</span> <span className="font-bold text-slate-200 font-mono select-all">{req.userNumericId || req.userId}</span></p>
                                <p className="text-xs text-slate-300 mb-2 flex justify-between"><span>Time:</span> <span className="font-bold text-slate-200 text-[10px]">{req.timestamp}</span></p>
                                <p className="text-xs text-slate-300 mb-2 flex justify-between items-center"><span>UTR:</span> <span className="font-mono font-bold text-slate-200 bg-black/80 px-2 py-0.5 border border-slate-600 rounded">{req.utr}</span></p>
                                <p className="text-xs text-[#e5c158] font-bold flex items-center justify-end gap-1 underline mt-3 cursor-pointer hover:text-[#f0b90b]">
                                  View Screenshot
                                </p>
                              </div>
                              <div className="flex gap-3">
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
                                   className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 font-bold py-2.5 rounded-lg active:scale-[0.98] transition-all text-xs text-center uppercase tracking-widest"
                                 >
                                   Accept & Add ₹{req.amount}
                                 </button>
                                 <button 
                                   onClick={async () => {
                                      // Reject Logic
                                      await setDoc(doc(db, 'deposits', req.id), { ...req, status: 'Rejected' });
                                      alert(`Deposit request rejected.`);
                                   }}
                                   className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 font-bold py-2.5 rounded-lg active:scale-[0.98] transition-all text-xs text-center uppercase tracking-widest"
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

             </>)}
{adminTab === 'MATCHES' && (<>
<button 
      onClick={() => setShowManageUserTeams(!showManageUserTeams)}
      className={`flex items-center justify-between w-full mt-4 bg-[#13151c] border ${showManageUserTeams ? 'border-[#e5c158]/30 rounded-t-xl border-b-0 mb-0 bg-gradient-to-b from-[#e5c158]/5 to-transparent' : 'border-slate-800 rounded-xl mb-3 hover:border-[#e5c158]/30'} p-4 shadow-lg transition-all relative group overflow-hidden`}
    >
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <h3 className="font-bold text-slate-200 tracking-wide flex items-center justify-between z-10">Manage User Teams (Edit)</h3>
                <div className={`p-1.5 rounded-lg border transition-all z-10 ${showManageUserTeams ? 'text-black border-[#e5c158] bg-[#e5c158] shadow-[0_0_10px_rgba(229,193,88,0.5)]' : 'text-slate-500 border-slate-700 bg-black/40 group-hover:text-[#e5c158] group-hover:border-[#e5c158]/30'}`}>
       {showManageUserTeams ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} />}
    </div>
             </button>
             
             {showManageUserTeams && (
               <div className="bg-[#13151c] rounded-b-2xl shadow-lg border border-[#e5c158]/50 border-t-0 p-5 mb-6 backdrop-blur-sm relative before:absolute before:inset-0 before:bg-gradient-to-b before:from-yellow-500/5 before:to-transparent before:pointer-events-none">
                  {!adminTeamEditMatchId ? (
                     <>
                        <p className="text-xs text-slate-400 mb-5 pl-1 relative z-10">Select a match to view and edit user teams.</p>
                        <div className="space-y-4 relative z-10">
                           {appMatches.map(match => (
                               <div 
                                 key={match.id}
                                 onClick={() => setAdminTeamEditMatchId(match.id)}
                                 className="bg-black/60 border border-slate-700 hover:border-[#e5c158]/30 rounded-xl p-4 flex justify-between items-center cursor-pointer transition-colors"
                               >
                                 <div className="flex flex-col">
                                    <span className="font-bold text-slate-200 text-sm">{match.series} ({match?.team1?.shortFrame} vs {match?.team2?.shortFrame})</span>
                                    <span className={`text-[10px] font-black uppercase tracking-widest mt-2 w-fit px-2 py-1 rounded-sm border ${match.status === 'Live' ? 'bg-red-900/40 text-red-500 border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.2)] animate-pulse' : match.status === 'Completed' ? 'bg-green-900/30 text-green-400 border-green-500/30' : 'bg-blue-900/30 text-blue-400 border-blue-500/30'}`}>
                                       {match.status}
                                    </span>
                                 </div>
                                 <span className="text-[10px] font-black tracking-widest bg-black border border-slate-700 px-3 py-1.5 rounded-lg text-[#e5c158]/70 shadow-inner">
                                    {savedTeams.filter(t => t.match?.id === match.id).length} TEAMS
                                 </span>
                               </div>
                           ))}
                        </div>
                     </>
                  ) : (
                     <>
                        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#e5c158]/20 relative z-10">
                           <button onClick={() => setAdminTeamEditMatchId(null)} className="p-1.5 rounded-lg bg-black border border-slate-700 hover:border-[#e5c158]/50 hover:text-[#e5c158] transition-colors text-slate-300"><ArrowLeft size={16}/></button>
                           <h4 className="font-bold text-slate-200 text-sm">{appMatches.find(m => m.id === adminTeamEditMatchId)?.team1.shortFrame} vs {appMatches.find(m => m.id === adminTeamEditMatchId)?.team2.shortFrame} Teams</h4>
                        </div>
                        
                        <div className="relative mb-5 z-10">
                           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                           <input 
                              type="text" 
                              placeholder="Search by 10-digit User ID..."
                              value={teamSearchQuery}
                              onChange={(e) => setTeamSearchQuery(e.target.value)}
                              className="w-full bg-black/60 border border-slate-700 text-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                           />
                        </div>
                        
                        <div className="space-y-4 relative z-10">
                           {(() => {
                              const matchTeams = savedTeams.filter(t => t.match?.id === adminTeamEditMatchId && t.userId !== 'admin_bot' && t.userId !== 'admin_bot_boot');
                              const filtered = matchTeams
                                .filter((st) => String(st.userId || '').toLowerCase().includes(teamSearchQuery.toLowerCase()) || String(st.teamId || '').toLowerCase().includes(teamSearchQuery.toLowerCase()));
                                
                              if (matchTeams.length === 0) return <p className="text-sm font-bold text-slate-500 text-center py-6 bg-black/40 border border-slate-700 rounded-xl">No user teams for this match.</p>;
                              if (filtered.length === 0) return <p className="text-sm font-bold text-slate-500 text-center py-6 bg-black/40 border border-slate-700 rounded-xl">No results for "{teamSearchQuery}"</p>;
                              
                              return filtered.map((st, actIdx) => (
                                 <div key={st.id || actIdx} className="bg-black/60 border border-slate-700 rounded-xl p-4 text-sm transition-colors hover:border-[#e5c158]/30">
                                    <div className="flex justify-between items-center font-bold text-slate-200 mb-3 pb-2 border-b border-yellow-500/10">
                                       <span className="flex-1 truncate pr-2">{st.match?.series} ({st.match?.team1?.shortFrame} vs {st.match?.team2?.shortFrame})</span>
                                       <span className="text-[#e5c158] bg-[#e5c158]/10 border border-[#e5c158]/20 px-2 py-1 rounded text-[10px] tracking-widest">{st.userId}</span>
                                    </div>
                                    <div className="text-xs text-slate-400 mb-3 flex justify-between">
                                       <span>Contest: <span className="font-bold text-slate-300">{st.contestName}</span></span>
                                       <span className="font-bold text-slate-300">{st.teamId}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-slate-400 mb-4 bg-black/40 p-2 rounded-lg border border-slate-800">
                                       <span className="font-bold tracking-wide uppercase text-[10px]">Total Players</span>
                                       <span className="text-[#e5c158] font-bold">{st.players.length} / 11</span>
                                    </div>
                                    <button
                                       onClick={() => {
                                          const realIndex = savedTeams.findIndex(orig => orig.id === st.id);
                                          setEditingSavedTeamIndex(realIndex);
                                          setActiveMatch(st.match);
                                          setTeam(st.players || []);
                                          setCaptain(st.captain || null);
                                          setViceCaptain(st.viceCaptain || null);
                                          const cMatch = appContests.find(cc => cc.name === st.contestName);
                                          if (cMatch) setActiveContestDetails(cMatch);
                                          setActiveContestInstanceId(st.instanceId);
                                          setSelectedContest({ fee: st.fee, name: st.contestName });
                                          setView('CREATE_TEAM');
                                       }}
                                       className="w-full bg-[#e5c158]/20 hover:bg-yellow-500/30 transition-colors text-[#e5c158] border border-[#e5c158]/50 font-bold py-2.5 rounded-lg text-xs flex justify-center items-center gap-2 active:scale-95 shadow-[0_0_15px_rgba(234,179,8,0.1)]"
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
      className={`flex items-center justify-between w-full mt-4 bg-[#13151c] border ${showManagePlayers ? 'border-[#e5c158]/30 rounded-t-xl border-b-0 mb-0 bg-gradient-to-b from-[#e5c158]/5 to-transparent' : 'border-slate-800 rounded-xl mb-3 hover:border-[#e5c158]/30'} p-4 shadow-lg transition-all relative group overflow-hidden`}
    >
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <h3 className="font-bold text-slate-200 tracking-wide flex items-center gap-3 z-10">
                   <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></div> Live Match Dashboard
                </h3>
                <div className={`p-1.5 rounded-lg border transition-all z-10 ${showManagePlayers ? 'text-black border-[#e5c158] bg-[#e5c158] shadow-[0_0_10px_rgba(229,193,88,0.5)]' : 'text-slate-500 border-slate-700 bg-black/40 group-hover:text-[#e5c158] group-hover:border-[#e5c158]/30'}`}>
       {showManagePlayers ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} />}
    </div>
             </button>
             
             {showManagePlayers && (
               <div className="bg-[#13151c] rounded-b-2xl shadow-lg border border-[#e5c158]/50 border-t-0 p-5 mb-6 backdrop-blur-sm relative before:absolute before:inset-0 before:bg-gradient-to-b before:from-yellow-500/5 before:to-transparent before:pointer-events-none">
                 {!adminLiveMatchId ? (
                   <>
                     <p className="text-xs text-slate-400 mb-5 pl-1 relative z-10">Select a live match to award real-time points.</p>
                     <div className="space-y-4 relative z-10">
                       {appMatches.filter(m => m.status === 'Live').length > 0 ? appMatches.filter(m => m.status === 'Live').map(match => (
                         <div 
                           key={match.id}
                           onClick={() => setAdminLiveMatchId(match.id)}
                           className="bg-black/60 rounded-xl border border-slate-700 p-4 flex justify-between items-center cursor-pointer hover:border-[#e5c158]/50 transition-colors"
                         >
                           <div className="flex items-center gap-4">
                             <div className="flex items-center gap-2">
                               <div className="w-6 h-6 rounded-full border border-[#e5c158]/30 shadow-sm" style={{backgroundColor: match?.team1?.color}}></div>
                               <span className="font-bold text-slate-200 text-sm tracking-wide">{match?.team1?.shortFrame}</span>
                             </div>
                             <span className="text-slate-500 text-xs font-black tracking-widest uppercase">vs</span>
                             <div className="flex items-center gap-2">
                               <span className="font-bold text-slate-200 text-sm tracking-wide">{match?.team2?.shortFrame}</span>
                               <div className="w-6 h-6 rounded-full border border-[#e5c158]/30 shadow-sm" style={{backgroundColor: match?.team2?.color}}></div>
                             </div>
                           </div>
                           <ArrowRight size={18} className="text-[#e5c158]/70" />
                         </div>
                       )) : (
                         <div className="text-center p-8 bg-black/40 rounded-xl border border-slate-800 relative z-10">
                            <div className="inline-flex w-12 h-12 rounded-full bg-slate-800 items-center justify-center mb-3">
                               <Trophy className="text-slate-600" size={20} />
                            </div>
                            <span className="text-slate-500 text-sm font-bold block mb-1 tracking-wide">No Live Matches</span>
                            <p className="text-xs text-slate-600">Start a match to see the dashboard.</p>
                         </div>
                       )}
                     </div>
                   </>
                 ) : (
                   <div className="relative z-10">
                     {(() => {
                       const match = appMatches.find(m => m.id === adminLiveMatchId);
                       if (!match) return null;
                       const matchPlayers = appPlayers.filter(p => p.team === match?.team1?.shortFrame || p.team === match?.team2?.shortFrame);
                       return (
                         <>
                           <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#e5c158]/20">
                             <button onClick={() => setAdminLiveMatchId(null)} className="p-1.5 rounded-lg bg-black border border-slate-700 hover:border-[#e5c158]/50 hover:text-[#e5c158] transition-colors text-slate-300"><ArrowLeft size={16}/></button>
                             <h4 className="font-bold text-slate-200 text-sm">{match?.team1?.shortFrame} vs {match?.team2?.shortFrame} Control</h4>
                           </div>
                           <p className="text-xs text-slate-400 mb-5 pl-1">Award real-time points. Leaderboards and user dashboards will update instantly.</p>
                           
                           <div className="space-y-4">
                              {matchPlayers.map((player) => (
                                <div key={player.id} className="bg-black/60 rounded-xl border border-slate-700 overflow-hidden transition-all hover:border-[#e5c158]/30">
                                   <div className="flex justify-between items-center p-4">
                                      <div className="flex flex-col gap-1.5">
                                         <span className="text-sm font-bold text-slate-200 flex items-center gap-3">{player.name} <span className="bg-[#e5c158]/10 border border-[#e5c158]/20 text-[10px] uppercase font-black px-2 py-0.5 rounded text-[#e5c158] tracking-widest">{player.team}</span></span>
                                         <span className="text-xs font-bold text-emerald-400 tracking-wide mt-1">{player.points} Total Pts</span>
                                      </div>
                                      <button 
                                        onClick={() => setAdminExpandedPlayerId(adminExpandedPlayerId === player.id ? null : player.id)}
                                        className="bg-black border border-slate-700 p-2 rounded-lg hover:border-[#e5c158]/50 hover:text-[#e5c158] transition-colors active:scale-95 text-slate-400"
                                      >
                                        {adminExpandedPlayerId === player.id ? <Minus size={18} /> : <PlusCircle size={18} />}
                                      </button>
                                   </div>
                                   
                                   {adminExpandedPlayerId === player.id && (
                                      <div className="p-4 bg-black/80 border-t border-slate-700">
                                        <p className="text-[10px] font-black tracking-widest text-[#e5c158]/70 uppercase mb-4 pl-1">Award Points</p>
                                        <div className="grid grid-cols-3 gap-3">
                                           <button 
                                             onClick={() => setAppPlayers(appPlayers.map(p => p.id === player.id ? { ...p, points: p.points + 6 } : p))}
                                             className="bg-black border border-slate-700 hover:border-blue-500/50 active:scale-95 transition-all rounded-xl py-3 text-[11px] uppercase font-bold text-slate-300 flex flex-col items-center gap-1 shadow-sm"
                                           >
                                             <span className="text-blue-400 text-sm">+6</span> Six
                                           </button>
                                           <button 
                                             onClick={() => setAppPlayers(appPlayers.map(p => p.id === player.id ? { ...p, points: p.points + 4 } : p))}
                                             className="bg-black border border-slate-700 hover:border-blue-500/50 active:scale-95 transition-all rounded-xl py-3 text-[11px] uppercase font-bold text-slate-300 flex flex-col items-center gap-1 shadow-sm"
                                           >
                                             <span className="text-blue-400 text-sm">+4</span> Four
                                           </button>
                                           <button 
                                             onClick={() => setAppPlayers(appPlayers.map(p => p.id === player.id ? { ...p, points: p.points + 25 } : p))}
                                             className="bg-black border border-slate-700 hover:border-red-500/50 active:scale-95 transition-all rounded-xl py-3 text-[11px] uppercase font-bold text-slate-300 flex flex-col items-center gap-1 shadow-sm"
                                           >
                                             <span className="text-red-500 text-sm shadow-[0_0_10px_rgba(239,68,68,0.2)] pb-0.5">+25</span> Wicket
                                           </button>
                                           <button 
                                             onClick={() => setAppPlayers(appPlayers.map(p => p.id === player.id ? { ...p, points: p.points + 1 } : p))}
                                             className="bg-black border border-slate-700 hover:border-emerald-500/50 active:scale-95 transition-all rounded-xl py-3 text-[11px] uppercase font-bold text-slate-300 flex flex-col items-center gap-1 shadow-sm"
                                           >
                                             <span className="text-emerald-400 text-sm">+1</span> 1 Run
                                           </button>
                                           <button 
                                             onClick={() => setAppPlayers(appPlayers.map(p => p.id === player.id ? { ...p, points: p.points + 2 } : p))}
                                             className="bg-black border border-slate-700 hover:border-emerald-500/50 active:scale-95 transition-all rounded-xl py-3 text-[11px] uppercase font-bold text-slate-300 flex flex-col items-center gap-1 shadow-sm"
                                           >
                                             <span className="text-emerald-400 text-sm">+2</span> 2 Run
                                           </button>
                                           <button 
                                             onClick={() => setAppPlayers(appPlayers.map(p => p.id === player.id ? { ...p, points: p.points + 12 } : p))}
                                             className="bg-black border border-slate-700 hover:border-orange-500/50 active:scale-95 transition-all rounded-xl py-3 text-[11px] uppercase font-bold text-slate-300 flex flex-col items-center gap-1 shadow-sm"
                                           >
                                             <span className="text-orange-400 text-sm">+12</span> Catch
                                           </button>
                                        </div>
                                        <div className="flex gap-3 items-center mt-4 pt-4 border-t border-slate-800">
                                           <span className="text-[10px] font-black tracking-widest flex-1 text-slate-500 uppercase">Custom Manual:</span>
                                           <button onClick={() => setAppPlayers(appPlayers.map(p => p.id === player.id ? { ...p, points: Math.max(0, p.points - 1) } : p))} className="bg-red-950/50 border border-red-900/50 text-red-500 px-4 py-2 rounded-lg font-bold text-xs tracking-wider active:scale-95">-1</button>
                                           <button onClick={() => setAppPlayers(appPlayers.map(p => p.id === player.id ? { ...p, points: p.points + 10 } : p))} className="bg-emerald-950/50 border border-emerald-900/50 text-emerald-500 px-4 py-2 rounded-lg font-bold text-xs tracking-wider active:scale-95">+10</button>
                                        </div>
                                      </div>
                                   )}
                                </div>
                              ))}
                           </div>
                         </>
                       );
                     })()}
                   </div>
                 )}
               </div>
             )}

             {/* Manage Upcoming Match Lineups */}
             <button 
      onClick={() => setShowManageLineups(!showManageLineups)}
      className={`flex items-center justify-between w-full mt-4 bg-[#13151c] border ${showManageLineups ? 'border-[#e5c158]/30 rounded-t-xl border-b-0 mb-0 bg-gradient-to-b from-[#e5c158]/5 to-transparent' : 'border-slate-800 rounded-xl mb-3 hover:border-[#e5c158]/30'} p-4 shadow-lg transition-all relative group overflow-hidden`}
    >
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <h3 className="font-bold text-slate-200 tracking-wide flex items-center justify-between z-10">App Settings: Upcoming Matches Lineups</h3>
                <div className={`p-1.5 rounded-lg border transition-all z-10 ${showManageLineups ? 'text-black border-[#e5c158] bg-[#e5c158] shadow-[0_0_10px_rgba(229,193,88,0.5)]' : 'text-slate-500 border-slate-700 bg-black/40 group-hover:text-[#e5c158] group-hover:border-[#e5c158]/30'}`}>
       {showManageLineups ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} />}
    </div>
             </button>
             
             {showManageLineups && (
               <div className="bg-[#13151c] rounded-b-2xl shadow-lg border border-[#e5c158]/50 border-t-0 p-5 mb-6 backdrop-blur-sm relative before:absolute before:inset-0 before:bg-gradient-to-b before:from-yellow-500/5 before:to-transparent before:pointer-events-none">
                 {!adminUpcomingLineupMatchId ? (
                   <>
                     <p className="text-xs text-slate-400 mb-5 pl-1 relative z-10">Select an upcoming match to set player lineups.</p>
                     <div className="space-y-4 relative z-10">
                       {appMatches.filter(m => m.status === 'Upcoming').length > 0 ? appMatches.filter(m => m.status === 'Upcoming').map(match => (
                         <div 
                           key={match.id}
                           onClick={() => setAdminUpcomingLineupMatchId(match.id)}
                           className="bg-black/60 rounded-xl border border-slate-700 p-4 flex justify-between items-center cursor-pointer hover:border-[#e5c158]/50 transition-colors"
                         >
                           <div className="flex items-center gap-4">
                             <div className="flex items-center gap-2">
                               <div className="w-6 h-6 rounded-full border border-[#e5c158]/30 shadow-sm" style={{backgroundColor: match?.team1?.color}}></div>
                               <span className="font-bold text-slate-200 text-sm tracking-wide">{match?.team1?.shortFrame}</span>
                             </div>
                             <span className="text-slate-500 text-xs font-black tracking-widest uppercase">vs</span>
                             <div className="flex items-center gap-2">
                               <span className="font-bold text-slate-200 text-sm tracking-wide">{match?.team2?.shortFrame}</span>
                               <div className="w-6 h-6 rounded-full border border-[#e5c158]/30 shadow-sm" style={{backgroundColor: match?.team2?.color}}></div>
                             </div>
                           </div>
                           <div className="flex items-center gap-4">
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 const newMatchesList = appMatches.map(m => m.id === match.id ? { ...m, lineupStatus: m.lineupStatus === 'OUT' ? 'NOT_OUT' : 'OUT' as const } : m);
                                 setAppMatches(newMatchesList);
                                 // Removed main_state write to avoid 1MB error. 
                               }}
                               className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${match.lineupStatus === 'OUT' ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'bg-red-500/10 text-red-500 border border-red-500/50'}`}
                             >
                               {match.lineupStatus === 'OUT' ? 'Lineups Out' : 'Lineups Not Out'}
                             </button>
                             <ArrowRight size={18} className="text-[#e5c158]/70" />
                           </div>
                         </div>
                       )) : (
                         <div className="text-center p-8 bg-black/40 rounded-xl border border-slate-800 relative z-10">
                            <span className="text-slate-500 text-sm font-bold block tracking-wide">No Upcoming Matches</span>
                         </div>
                       )}
                     </div>
                   </>
                 ) : (
                   <div className="relative z-10">
                     {(() => {
                       const match = appMatches.find(m => m.id === adminUpcomingLineupMatchId);
                       if (!match) return null;
                       const matchPlayers = appPlayers.filter(p => p.team === match?.team1?.shortFrame || p.team === match?.team2?.shortFrame);
                       return (
                         <>
                           <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#e5c158]/20">
                             <button onClick={() => setAdminUpcomingLineupMatchId(null)} className="p-1.5 rounded-lg bg-black border border-slate-700 hover:border-[#e5c158]/50 hover:text-[#e5c158] transition-colors text-slate-300"><ArrowLeft size={16}/></button>
                             <h4 className="font-bold text-slate-200 text-sm">{match?.team1?.shortFrame} vs {match?.team2?.shortFrame} - Lineups</h4>
                           </div>
                           <p className="text-xs text-slate-400 mb-5 pl-1">Select players that are playing. They will get a green tick. Unselected players will have a red dot.</p>
                           
                           <div className="space-y-3">
                              {matchPlayers.map((player) => (
                                <div 
                                  key={player.id} 
                                  onClick={() => setAppPlayers(appPlayers.map(p => p.id === player.id ? { ...p, isPlaying: !p.isPlaying } : p))}
                                  className={`bg-black/60 rounded-xl border cursor-pointer hover:border-[#e5c158]/50 transition-colors overflow-hidden flex justify-between items-center p-4 ${player.isPlaying ? 'border-green-500/40 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'border-slate-700'}`}
                                >
                                  <div className="flex flex-col gap-1">
                                     <span className="text-sm font-bold text-slate-200 flex items-center gap-3">{player.name} <span className="bg-[#e5c158]/10 border border-[#e5c158]/20 text-[10px] uppercase font-black px-2 py-0.5 rounded text-[#e5c158] tracking-widest">{player.team}</span></span>
                                  </div>
                                  <div>
                                    {player.isPlaying ? (
                                        <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/50 shadow-[0_0_8px_rgba(34,197,94,0.3)] flex items-center justify-center text-green-400">
                                           <Check size={14} />
                                        </div>
                                    ) : (
                                        <div className="w-6 h-6 rounded-full border border-red-500/30 bg-red-500/10 flex items-center justify-center text-red-500/50">
                                           <X size={14} />
                                        </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                           </div>
                         </>
                       );
                     })()}
                   </div>
                 )}
               </div>
             )}

</>)}          </div>
       </div>
    );
  };

  if (wallet?.blocked && !isAdmin) {
     return (
        <div className={`relative h-[100dvh] w-full max-w-md mx-auto bg-app-bg text-app-text font-sans shadow-2xl overflow-hidden border-x border-app-border flex flex-col items-center justify-center p-8 text-center ${themeMode === 'Light' ? 'theme-light' : ''} color-${themeColor.toLowerCase()}`}>
           <Shield size={64} className="text-red-500 mb-4" />
           <h2 className="text-2xl font-black mb-2 text-red-500">Account Blocked</h2>
           <p className="text-sm font-bold text-app-text-muted mb-8">Your account has been restricted by the admin. Please contact support.</p>
           <button onClick={async () => { if (supabase) await supabase.auth.signOut(); await firebaseSignOut(auth); }} className="bg-red-600 hover:bg-red-700 font-bold px-6 py-2 rounded-xl text-white shadow-lg active:scale-95 transition-transform">Logout</button>
        </div>
     );
  }

  return (
    <div className={`relative h-[100dvh] w-full max-w-md mx-auto bg-app-bg text-app-text font-sans shadow-2xl overflow-hidden border-x border-app-border ${themeMode === 'Light' ? 'theme-light' : ''} color-${themeColor.toLowerCase()}`}>
<>
        {showAddFlagModal && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 min-h-[100dvh]">
                <div className="bg-[#13151c] border border-slate-700 w-full rounded-2xl p-6 shadow-2xl relative">
                   <button onClick={() => { setShowAddFlagModal(null); setNewFlagUrl(''); setZoom(1); setCrop({x:0, y:0}); }} className="absolute top-4 right-4 text-slate-500 hover:text-white z-10"><X size={20}/></button>
                   <h3 className="font-bold text-slate-200 text-lg mb-4">Set Team Flag/Image</h3>
                   
                   <div className="flex flex-col items-center gap-4 mb-4">
                      {newFlagUrl ? (
                         <div className="w-full flex flex-col gap-4">
                             <div className="relative w-full h-64 rounded-xl overflow-hidden border-2 border-slate-700 bg-black bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+Cgo8cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMzMzMiIC8+Cgo8cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzMzMyIgLz4KPC9zdmc+')]">
                                <Cropper
                                  image={newFlagUrl}
                                  crop={crop}
                                  zoom={zoom}
                                  aspect={1}
                                  cropShape="round"
                                  showGrid={false}
                                  onCropChange={setCrop}
                                  onCropComplete={(croppedArea, croppedAreaPixels) => {
                                      setCroppedAreaPixels(croppedAreaPixels as any);
                                  }}
                                  onZoomChange={setZoom}
                                />
                             </div>
                             <div className="flex items-center gap-3 w-full px-2">
                                 <ZoomIn size={16} className="text-slate-500 shrink-0" />
                                 <input
                                   type="range"
                                   value={zoom}
                                   min={1}
                                   max={3}
                                   step={0.1}
                                   aria-labelledby="Zoom"
                                   onChange={(e) => {
                                     setZoom(Number(e.target.value))
                                   }}
                                   className="w-full accent-[#e5c158]"
                                 />
                             </div>
                             <button onClick={() => document.getElementById('flag-upload')?.click()} className="text-xs text-[#e5c158] font-bold self-center hover:underline">Change Image</button>
                         </div>
                      ) : (
                         <div 
                            className="w-24 h-24 rounded-full border-2 border-dashed border-slate-700 relative flex flex-col items-center justify-center cursor-pointer hover:border-[#e5c158]/50 hover:text-[#e5c158] text-slate-500 transition-colors bg-black/50"
                            onClick={() => document.getElementById('flag-upload')?.click()}
                         >
                            <ImageIcon size={24} className="mb-2" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Upload</span>
                         </div>
                      )}
                      
                      <input 
                         id="flag-upload"
                         type="file" 
                         accept="image/*" 
                         className="hidden" 
                         onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                               const reader = new FileReader();
                               reader.onloadend = () => {
                                  setNewFlagUrl(reader.result as string);
                                  setZoom(1);
                                  setCrop({x:0, y:0});
                               };
                               reader.readAsDataURL(file);
                            }
                         }} 
                      />
                   </div>

                   <button 
                       onClick={async () => {
                           if (newFlagUrl && croppedAreaPixels) {
                               try {
                                   const finalCroppedImageBase64 = await getCroppedImg(newFlagUrl, croppedAreaPixels);
                                   setAppTeamsList(prev => prev.map(t => t.id === showAddFlagModal ? { ...t, flagUrl: finalCroppedImageBase64, flagFit: 'cover' } : t));
                                   setShowAddFlagModal(null);
                                   setNewFlagUrl('');
                                   setZoom(1);
                                   setCrop({x:0, y:0});
                               } catch (e) {
                                   console.error(e);
                                   alert('Failed to crop image');
                               }
                           }
                       }} 
                       className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all active:scale-95 ${newFlagUrl ? 'bg-[#e5c158] text-black shadow-[0_0_15px_rgba(229,193,88,0.4)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                       disabled={!newFlagUrl || !croppedAreaPixels}
                   >
                       Save Processed Image
                   </button>
                </div>
            </div>
        )}
        {showAddFormatModal && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 min-h-[100dvh]">
                <div className="bg-[#13151c] border border-slate-700 w-full rounded-2xl p-6 shadow-2xl relative">
                   <button onClick={() => setShowAddFormatModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20}/></button>
                   <h3 className="font-bold text-slate-200 text-lg mb-4">Add Format/League</h3>
                   <input value={newFormatName} onChange={e=>setNewFormatName(e.target.value)} placeholder="Format Name (e.g. BBL or The Hundred)" className="w-full bg-black border border-slate-700 rounded-xl px-4 py-3 text-slate-200 outline-none text-sm mb-4" />
                   <button onClick={() => {
                       if (newFormatName.trim() && !appFormats.includes(newFormatName.trim())) {
                           setAppFormats([...appFormats, newFormatName.trim()]);
                           setNewFormatName('');
                           setShowAddFormatModal(false);
                           setSelectedFormat(newFormatName.trim());
                       }
                   }} className="w-full py-3 bg-[#e5c158] text-black rounded-xl font-bold uppercase tracking-widest text-sm shadow-[0_0_15px_rgba(229,193,88,0.4)] transition-all active:scale-95">Add Format</button>
                </div>
            </div>
        )}
        {showAddTeamModal && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 min-h-[100dvh]">
                <div className="bg-[#13151c] border border-slate-700 w-full rounded-2xl p-6 shadow-2xl relative">
                   <button onClick={() => setShowAddTeamModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20}/></button>
                   <h3 className="font-bold text-slate-200 text-lg mb-4">Add Team to {selectedFormat}</h3>
                   <input value={newTeamName} onChange={e=>setNewTeamName(e.target.value)} placeholder="Team Name (e.g. India)" className="w-full bg-black border border-slate-700 rounded-xl px-4 py-3 text-slate-200 outline-none text-sm mb-3 focus:border-[#e5c158]/50 transition-colors" />
                   <input value={newTeamShort} onChange={e=>setNewTeamShort(e.target.value)} placeholder="Short Name (e.g. IND, max 4)" maxLength={4} className="w-full bg-black border border-slate-700 rounded-xl px-4 py-3 text-slate-200 outline-none text-sm mb-3 uppercase focus:border-[#e5c158]/50 transition-colors" />
                   
                   <div className="flex gap-2 mb-6 justify-between border-t border-slate-800 pt-3">
                      {['bg-blue-600', 'bg-green-600', 'bg-red-600', 'bg-yellow-500', 'bg-purple-600', 'bg-slate-800', 'bg-orange-500', 'bg-pink-600'].map(c => (
                         <button key={c} onClick={() => setNewTeamColor(c)} className={`w-8 h-8 rounded-full ${c} ${newTeamColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#13151c]' : ''} hover:scale-110 transition-transform`}></button>
                      ))}
                   </div>
                   <button onClick={() => {
                       if (newTeamName.trim() && newTeamShort.trim()) {
                           const t: any = {
                               id: 't' + Date.now() + Math.random().toString(36).substring(2,6),
                               name: newTeamName.trim(),
                               shortName: newTeamShort.trim().toUpperCase(),
                               color: newTeamColor,
                               format: selectedFormat
                           };
                           setAppTeamsList([...appTeamsList, t]);
                           setNewTeamName('');
                           setNewTeamShort('');
                           setShowAddTeamModal(false);
                       }
                   }} className="w-full py-3 bg-[#e5c158] text-black rounded-xl font-bold uppercase tracking-widest text-sm shadow-[0_0_15px_rgba(229,193,88,0.4)] transition-all active:scale-95 border border-[#e5c158]/50">Save Team</button>
                </div>
            </div>
        )}
        {showTeamAddPlayerModal && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 min-h-[100dvh]">
                <div className="bg-[#13151c] border border-slate-700 w-full rounded-2xl p-6 shadow-2xl relative">
                   <button onClick={() => { setShowTeamAddPlayerModal(false); setEditingPlayerId(null); }} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20}/></button>
                   <h3 className="font-bold text-slate-200 text-lg mb-1">{editingPlayerId ? 'Edit Player' : 'Add Player'}</h3>
                   <p className="text-xs text-slate-500 mb-4 uppercase tracking-widest font-semibold flex items-center gap-1.5">{editingPlayerId ? 'Updating in' : 'Adding to'} <span className="bg-white/10 text-white px-1.5 py-0.5 rounded text-[10px]">{newPlayerTeamShort}</span></p>
                   
                   <input value={newPlayerName} onChange={e=>setNewPlayerName(e.target.value)} placeholder="Player Name" className="w-full bg-black border border-slate-700 rounded-xl px-4 py-3 text-slate-200 outline-none text-sm mb-3 focus:border-[#e5c158]/50 transition-colors" />
                   
                   <div className="grid grid-cols-4 gap-2 mb-3">
                      {(['BAT', 'BOWL', 'AR', 'WK'] as const).map(r => (
                         <button key={r} onClick={() => setNewPlayerRole(r)} className={`py-2 text-xs font-bold rounded-lg transition-all ${newPlayerRole === r ? 'bg-slate-700 text-[#e5c158] border border-[#e5c158]/50 shadow-[0_0_10px_rgba(229,193,88,0.15)]' : 'bg-black text-slate-500 border border-slate-800'}`}>{r}</button>
                      ))}
                   </div>
                   
                   <input type="number" step="0.5" value={newPlayerCredits} onChange={e=>setNewPlayerCredits(e.target.value)} placeholder="Credits (e.g. 9.0)" className="w-full bg-black border border-slate-700 rounded-xl px-4 py-3 text-slate-200 outline-none text-sm mb-6 focus:border-[#e5c158]/50 transition-colors" />
                   
                   <button onClick={() => {
                       if (newPlayerName.trim() && newPlayerCredits.trim()) {
                           if (editingPlayerId) {
                               setAppPlayers(prev => prev.map(p => p.id === editingPlayerId ? {
                                   ...p,
                                   name: newPlayerName.trim(),
                                   role: newPlayerRole,
                                   credits: parseFloat(newPlayerCredits.trim()) || 8.0,
                               } : p));
                           } else {
                               const newP: Player = {
                                   id: 'p' + Date.now(),
                                   name: newPlayerName.trim(),
                                   role: newPlayerRole as 'BAT' | 'BOWL' | 'AR' | 'WK',
                                   credits: parseFloat(newPlayerCredits.trim()) || 8.0,
                                   points: 0,
                                   team: newPlayerTeamShort,
                                   isPlaying: false,
                                   selPercent: 50
                               };
                               setAppPlayers([...appPlayers, newP]);
                           }
                           setNewPlayerName('');
                           setNewPlayerCredits('9.0');
                           setEditingPlayerId(null);
                           setShowTeamAddPlayerModal(false);
                       }
                   }} className="w-full py-3 bg-[#e5c158] text-black shadow-lg rounded-xl font-bold tracking-widest text-sm text-center transition-all active:scale-95 uppercase">{editingPlayerId ? 'Save Changes' : 'Save Player'}</button>
                   {editingPlayerId && (
                       <button onClick={() => {
                           if (window.confirm("Are you sure you want to delete this player?")) {
                               setAppPlayers(appPlayers.filter(p => p.id !== editingPlayerId));
                               setNewPlayerName('');
                               setNewPlayerCredits('9.0');
                               setEditingPlayerId(null);
                               setShowTeamAddPlayerModal(false);
                           }
                       }} className="w-full mt-2 py-3 bg-red-600/20 text-red-500 border border-red-500/50 shadow-lg rounded-xl font-bold tracking-widest text-sm text-center transition-all active:scale-95 uppercase">Delete Player</button>
                   )}
                </div>
            </div>
        )}
        {showCreateMatchFromTeamsModal && selectedTeamsForMatch.length === 2 && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end min-h-[100dvh]">
                <div className="bg-[#13151c] border-t border-slate-700 w-full rounded-t-3xl p-6 pt-5 shadow-[0_-10px_40px_rgba(34,197,94,0.1)] relative pb-10 mt-auto shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
                   <div className="w-12 h-1 bg-slate-800 rounded-full mx-auto mb-6"></div>
                   <h3 className="font-bold text-slate-200 text-xl tracking-tight text-center mb-1 drop-shadow-sm flex justify-center items-center gap-2"><Trophy size={20} className="text-green-500" /> Create Match</h3>
                   <div className="flex items-center justify-center gap-3 font-black text-2xl mb-6 text-white drop-shadow-md">
                      <span className={selectedTeamsForMatch[0].color === 'bg-blue-600' ? 'text-blue-400' : 'text-slate-200'}>{selectedTeamsForMatch[0].shortName}</span>
                      <span className="text-sm font-normal text-slate-500 italic flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 border border-slate-700 pt-0.5">V</span>
                      <span className={selectedTeamsForMatch[1].color === 'bg-green-600' ? 'text-green-400' : 'text-slate-200'}>{selectedTeamsForMatch[1].shortName}</span>
                   </div>
                   
                   <div className="space-y-4 mb-8">
                     <div>
                       <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Match Time</label>
                       <input value={newMatchTimeForm} onChange={e=>setNewMatchTimeForm(e.target.value)} type="datetime-local" className="w-full bg-black border border-slate-700 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-green-500 focus:shadow-[0_0_10px_rgba(34,197,94,0.15)] transition-all text-sm" />
                     </div>
                   </div>
                   
                   <div className="flex gap-3">
                      <button onClick={() => setShowCreateMatchFromTeamsModal(false)} className="flex-1 py-4 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl font-bold uppercase tracking-widest text-sm active:scale-95 transition-transform hover:bg-slate-700">Cancel</button>
                      <button onClick={() => {
                          if (newMatchTimeForm) {
                              const dateFormat = new Date(newMatchTimeForm);
                              let formattedLabel = dateFormat.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                              
                              const dt = new Date(dateFormat);
                              dt.setHours(0,0,0,0);
                              const today = new Date();
                              today.setHours(0,0,0,0);
                              if (dt.getTime() === today.getTime()) {
                                 formattedLabel = "Today, " + formattedLabel;
                              } else {
                                 formattedLabel = dateFormat.toLocaleDateString([], {month: 'short', day: 'numeric'}) + " " + formattedLabel;
                              }
                              
                              const newMatchObj: Match = {
                                  id: 'm' + Date.now(),
                                  team1: { name: selectedTeamsForMatch[0].name, shortFrame: selectedTeamsForMatch[0].shortName, color: (selectedTeamsForMatch[0].color || 'bg-slate-800').replace('bg-', 'text-'), flagUrl: selectedTeamsForMatch[0].flagUrl, flagFit: selectedTeamsForMatch[0].flagFit },
                                  team2: { name: selectedTeamsForMatch[1].name, shortFrame: selectedTeamsForMatch[1].shortName, color: (selectedTeamsForMatch[1].color || 'bg-slate-800').replace('bg-', 'text-'), flagUrl: selectedTeamsForMatch[1].flagUrl, flagFit: selectedTeamsForMatch[1].flagFit },
                                  time: formattedLabel,
                                  series: selectedFormat + ' Series',
                                  status: 'Upcoming' as const,
                                  totalPrize: '₹0',
                                  matchDateISO: dateFormat.toISOString()
                              };
                              const newMatchesList = [...appMatches, newMatchObj];
                              setAppMatches(newMatchesList);
                              // syncActiveDataToCloud(); // Call sync button instead to avoid payload size errors
                              
                              setSelectedTeamsForMatch([]);
                              setNewMatchTimeForm('');
                              setShowCreateMatchFromTeamsModal(false);
                              alert('Match Created Successfully! You can find it in the matches list.');
                          } else {
                              alert('Please select match time');
                          }
                      }} className="flex-1 py-4 bg-green-500 border border-green-400 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] rounded-xl font-black uppercase tracking-widest text-sm active:scale-95 transition-transform hover:bg-green-400">CREATE</button>
                   </div>
                </div>
            </div>
        )}
</>
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
            instanceId={activeContestInstanceId}
            savedTeams={savedTeams}
            appPlayers={appPlayers}
            currentUser={user}
            isAdmin={isAdmin}
            onMakeBotsWin={() => {
                if (window.confirm("Are you sure you want to force all bots to win this contest? This will recalculate rankings immediately.")) {
                    setSavedTeams(prev => {
                        const newTeams = prev.map(t => 
                            (t.userId === 'admin_bot' || t.userId === 'admin_bot_boot') && t.match?.id === activeMatch?.id && t.contestName === activeContestDetails.name
                            ? { ...t, isWinnerBot: true } 
                            : t
                        );
                        const adminTeams = newTeams.filter(t => t.userId === 'admin_bot' || t.userId === 'admin_bot_boot');
                        // setDoc(doc(db, 'gameData', 'main_state'), JSON.parse(JSON.stringify({ adminTeams })), { merge: true }).catch(console.error);
                        return newTeams;
                    });
                    alert("Bots in this contest are now set as winners!");
                }
            }}
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

      {adminProfileModalUser && (
        <div className="absolute inset-0 z-[200] bg-app-bg text-app-text flex flex-col font-sans overflow-hidden max-w-md mx-auto">
            <header className="p-4 flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-app-accent"></div>
                    <h1 className="text-xl font-bold">Fantasy11</h1>
                </div>
                <h2 className="text-lg font-bold mx-auto pr-8">Profile</h2>
                <button onClick={() => setAdminProfileModalUser(null)} className="text-app-text-muted"><ArrowLeft/></button>
            </header>
            <div className="p-4 flex-1 overflow-y-auto pb-20">
                <div className="bg-app-accent rounded-xl shadow-sm p-5 flex flex-col mb-4 text-white">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl font-bold shadow-inner uppercase">
                            {adminProfileModalUser.name?.charAt(0) || 'U'}
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-xl font-bold uppercase">{adminProfileModalUser.name || 'User'}</h2>
                            <p className="text-sm opacity-90 mb-2 font-mono truncate max-w-[200px]">ID: {adminProfileModalUser.numericId || adminProfileModalUser.id}</p>
                            <div className="flex items-center gap-2">
                                <span className="bg-yellow-500 text-black text-[10px] px-2 py-0.5 rounded flex items-center font-bold">⚡ Level {Math.floor((savedTeams.filter(t => t.userId === adminProfileModalUser.id).length) / 10)}</span>
                                <span className="text-xs font-bold text-white/90">{(savedTeams.filter(t => t.userId === adminProfileModalUser.id).length) % 10} / 10 to Lvl {Math.floor((savedTeams.filter(t => t.userId === adminProfileModalUser.id).length) / 10) + 1}</span>
                            </div>
                            <div className="w-full bg-black/30 h-1.5 rounded-full overflow-hidden mt-1">
                                <div className="bg-yellow-500 h-full rounded-full" style={{ width: `${((savedTeams.filter(t => t.userId === adminProfileModalUser.id).length) % 10) * 10}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-app-card rounded-xl flex-1 p-3 flex flex-col items-center justify-center border border-app-border shadow-sm">
                        <span className="text-2xl font-bold">{savedTeams.filter(t => t.userId === adminProfileModalUser.id).length}</span>
                        <span className="text-[10px] text-app-text-muted mt-1 text-center font-medium uppercase tracking-wider">Matches<br/>Played</span>
                    </div>
                    <div className="bg-app-card rounded-xl flex-1 p-3 flex flex-col items-center justify-center border border-app-border shadow-sm">
                        <span className="text-2xl font-bold">{savedTeams.filter(t => t.userId === adminProfileModalUser.id).length > 0 ? Math.round((adminProfileModalUser.wins || 0) / savedTeams.filter(t => t.userId === adminProfileModalUser.id).length * 100) : 0}%</span>
                        <span className="text-[10px] text-app-text-muted mt-1 text-center font-medium uppercase tracking-wider">Winning<br/>Rate</span>
                    </div>
                    <div className="bg-app-card rounded-xl flex-1 p-3 flex flex-col items-center justify-center border border-app-border shadow-sm col-span-2">
                        <span className="text-3xl font-black text-[#4ADE80]">₹{Number(adminProfileModalUser.winning || 0).toLocaleString('en-IN')}</span>
                        <span className="text-xs text-app-text-muted mt-1 text-center font-bold uppercase tracking-wider">Total Profit Earned</span>
                    </div>
                </div>

                <h3 className="font-bold text-sm mb-3">Admin Controls</h3>
                
                {/* Block/Unblock */}
                <div className="bg-app-card rounded-xl shadow-sm border border-app-border overflow-hidden p-4 mb-4 flex items-center justify-between">
                    <div>
                        <div className="font-bold text-sm flex items-center gap-2"><Shield size={16}/> Account Status</div>
                        <div className="text-xs text-app-text-muted font-medium mt-1">Restrict user access to the app</div>
                    </div>
                    <button 
                        onClick={async () => {
                            const newBlockedStat = !adminProfileModalUser.blocked;
                            await setDoc(doc(db, 'wallets', adminProfileModalUser.id), { ...adminProfileModalUser, blocked: newBlockedStat }, { merge: true });
                            setAdminProfileModalUser({...adminProfileModalUser, blocked: newBlockedStat});
                            // also update local list right away if possible by forcing reload or just waiting for snapshot
                        }}
                        className={`text-xs font-black uppercase px-4 py-2 rounded-lg border shadow-sm ${adminProfileModalUser.blocked ? 'bg-[#153B25]/20 border-[#4ADE80]/50 text-[#4ADE80] hover:bg-[#153B25]/50' : 'bg-red-900/20 border-red-500/50 text-red-500 hover:bg-red-900/50'}`}
                    >
                        {adminProfileModalUser.blocked ? 'Unblock' : 'Block User'}
                    </button>
                </div>

                {/* Wallet Control */}
                <div className="bg-[#13151c] rounded-2xl shadow-lg border border-[#e5c158]/20 p-5 mt-4 relative overflow-hidden backdrop-blur-sm">
                    <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[9px] uppercase tracking-widest font-black px-3 py-1 rounded-bl-xl shadow-[0_0_10px_rgba(234,179,8,0.5)]">VIP ACCESS</div>
                    <div className="flex justify-between items-center mb-4 mt-2">
                       <div>
                          <p className="font-bold text-slate-200">{adminProfileModalUser.name || 'User'}</p>
                          <p className="text-xs text-[#e5c158]/70 font-mono truncate max-w-[150px]">{adminProfileModalUser.email || adminProfileModalUser.id}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Wallet Balance</p>
                          <p className="font-black text-xl text-[#e5c158] drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]">₹{((adminProfileModalUser.deposit||0) + (adminProfileModalUser.winning||0) + (adminProfileModalUser.bonus||0)).toFixed(2)}</p>
                       </div>
                    </div>
                    <div className="flex flex-col gap-3">
                       <div className="flex flex-col gap-2">
                          <input 
                             type="text" 
                             placeholder="Enter money to add/deduct (₹)" 
                             value={adminCustomAmount}
                             onChange={(e) => setAdminCustomAmount(e.target.value)}
                             className="flex-1 bg-black/50 border border-[#e5c158]/30 rounded-xl px-4 py-3 text-sm font-semibold text-slate-200 outline-none focus:border-yellow-500 focus:shadow-[0_0_10px_rgba(234,179,8,0.2)] transition-all"
                          />
                          <div className="grid grid-cols-3 gap-2">
                             <button onClick={async () => {
                                 const sanitized = adminCustomAmount.toString().replace(/[^\d.]/g, '');
                                 const amt = parseFloat(sanitized);
                                 if (!isNaN(amt) && amt > 0) {
                                     const newVal = (adminProfileModalUser.deposit || 0) + amt;
                                     try {
                                         await syncWalletToBackend(db, adminProfileModalUser.id, { deposit: newVal });
                                         
                                         // Create an approved deposit request record for history
                                         const depId = `DEP_${Date.now()}_${adminProfileModalUser.id}`;
                                         await setDoc(doc(db, 'deposits', depId), {
                                            id: depId,
                                            userId: adminProfileModalUser.id,
                                            amount: amt,
                                            status: 'Approved',
                                            timestamp: new Date().toLocaleString(),
                                            type: 'Admin Credit'
                                         });

                                         setAdminProfileModalUser({...adminProfileModalUser, deposit: newVal});
                                         setAdminCustomAmount('');
                                         alert(`₹${amt} added to Deposit`);
                                     } catch(e) { console.error(e); alert("Failed to add funds"); }
                                 }
                             }} className="bg-blue-500/20 text-blue-400 border border-blue-500/50 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-500/30 transition-colors">+ Deposit</button>
                             
                             <button onClick={async () => {
                                 const sanitized = adminCustomAmount.toString().replace(/[^\d.]/g, '');
                                 const amt = parseFloat(sanitized);
                                 if (!isNaN(amt) && amt > 0) {
                                     const newVal = (adminProfileModalUser.winning || 0) + amt;
                                     try {
                                         await syncWalletToBackend(db, adminProfileModalUser.id, { winning: newVal });
                                         
                                         // Create an approved deposit request record for history (using deposits collection for visibility)
                                         const depId = `WIN_${Date.now()}_${adminProfileModalUser.id}`;
                                         await setDoc(doc(db, 'deposits', depId), {
                                            id: depId,
                                            userId: adminProfileModalUser.id,
                                            amount: amt,
                                            status: 'Approved',
                                            timestamp: new Date().toLocaleString(),
                                            type: 'Bonus/Winnings'
                                         });

                                         setAdminProfileModalUser({...adminProfileModalUser, winning: newVal});
                                         setAdminCustomAmount('');
                                         alert(`₹${amt} added to Winning`);
                                     } catch(e) { console.error(e); alert("Failed to add funds"); }
                                 }
                             }} className="bg-green-500/20 text-green-400 border border-green-500/50 py-2.5 rounded-xl text-xs font-bold hover:bg-green-500/30 transition-colors">+ Winning</button>
                             
                             <button onClick={async () => {
                                 const sanitized = adminCustomAmount.toString().replace(/[^\d.]/g, '');
                                 const amt = parseFloat(sanitized);
                                 if (!isNaN(amt) && amt > 0) {
                                     const newVal = (adminProfileModalUser.bonus || 0) + amt;
                                     try {
                                         await syncWalletToBackend(db, adminProfileModalUser.id, { bonus: newVal });
                                         
                                         // Create an approved record for history
                                         const depId = `BON_${Date.now()}_${adminProfileModalUser.id}`;
                                         await setDoc(doc(db, 'deposits', depId), {
                                            id: depId,
                                            userId: adminProfileModalUser.id,
                                            amount: amt,
                                            status: 'Approved',
                                            timestamp: new Date().toLocaleString(),
                                            type: 'Bonus Added'
                                         });

                                         setAdminProfileModalUser({...adminProfileModalUser, bonus: newVal});
                                         setAdminCustomAmount('');
                                         alert(`₹${amt} added to Bonus`);
                                     } catch(e) { console.error(e); alert("Failed to add funds"); }
                                 }
                             }} className="bg-purple-500/20 text-purple-400 border border-purple-500/50 py-2.5 rounded-xl text-xs font-bold hover:bg-purple-500/30 transition-colors">+ Bonus</button>
                          </div>
                          
                          <button 
                             onClick={async () => {
                                const sanitized = adminCustomAmount.toString().replace(/[^\d.]/g, '');
                                const amt = parseFloat(sanitized);
                                if (!isNaN(amt) && amt > 0) {
                                   let rem = amt;
                                   let nDep = adminProfileModalUser.deposit || 0;
                                   let nWin = adminProfileModalUser.winning || 0;
                                   let nBon = adminProfileModalUser.bonus || 0;
                                   
                                   if (nDep >= rem) { nDep -= rem; rem = 0; }
                                   else { rem -= nDep; nDep = 0; }
                                   
                                   if (rem > 0 && nWin >= rem) { nWin -= rem; rem = 0; }
                                   else if (rem > 0) { rem -= nWin; nWin = 0; }

                                   if (rem > 0 && nBon >= rem) { nBon -= rem; rem = 0; }
                                   else if (rem > 0) { rem -= nBon; nBon = 0; }
                                   
                                   try {
                                       await syncWalletToBackend(db, adminProfileModalUser.id, { deposit: nDep, winning: nWin, bonus: nBon });
                                       
                                       // Create a withdrawal record for history
                                       const wId = `WD_${Date.now()}_${adminProfileModalUser.id}`;
                                       await setDoc(doc(db, 'withdrawals', wId), {
                                          id: wId,
                                          userId: adminProfileModalUser.id,
                                          amount: amt,
                                          status: 'Approved',
                                          timestamp: new Date().toLocaleString(),
                                          type: 'Admin Deduction'
                                       });

                                       setAdminProfileModalUser({...adminProfileModalUser, deposit: nDep, winning: nWin, bonus: nBon});
                                       setAdminCustomAmount('');
                                   } catch(e) { console.error(e); alert("Failed to deduct funds"); }
                                }
                             }} 
                             className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 py-2.5 rounded-xl text-sm font-bold transition-colors mt-1"
                          >
                             - Deduct Total Funds
                          </button>
                       </div>
                       <button onClick={async () => {
                          if (window.confirm("Are you sure you want to wipe this user's wallet to 0?")) {
                             try {
                                 await updateDoc(doc(db, 'wallets', adminProfileModalUser.id), { deposit: 0, winning: 0, bonus: 0, profits: 0, wins: 0 });
                                 setAdminProfileModalUser({...adminProfileModalUser, deposit: 0, winning: 0, bonus: 0, profits: 0, wins: 0});
                             } catch(e) { console.error(e); alert("Failed to wipe funds"); }
                          }
                       }} className="w-full bg-black/40 hover:bg-black/60 text-slate-400 border border-slate-700 py-2.5 rounded-xl text-sm font-bold transition-colors">Wipe Wallet to 0</button>

                        <div className="pt-2 border-t border-app-border mt-1 flex justify-between gap-1">
                            <div className="flex-1 bg-black/20 p-2 rounded flex flex-col items-center">
                               <span className="text-[9px] uppercase text-app-text-muted font-bold">Deposit</span>
                               <span className="font-mono text-xs">₹{adminProfileModalUser.deposit || 0}</span>
                            </div>
                            <div className="flex-1 bg-black/20 p-2 rounded flex flex-col items-center">
                               <span className="text-[9px] uppercase text-app-text-muted font-bold">Winning</span>
                               <span className="font-mono text-xs">₹{adminProfileModalUser.winning || 0}</span>
                            </div>
                            <div className="flex-1 bg-black/20 p-2 rounded flex flex-col items-center">
                               <span className="text-[9px] uppercase text-app-text-muted font-bold">Bonus</span>
                               <span className="font-mono text-xs">₹{adminProfileModalUser.bonus || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
      )}

      {showDashboardUsers && (
        <div className="absolute inset-0 z-[200] bg-app-bg text-app-text flex flex-col font-sans overflow-hidden max-w-md mx-auto">
            <header className="p-4 flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-app-accent"></div>
                    <h1 className="text-xl font-bold">Dream11 VIP</h1>
                </div>
                <h2 className="text-lg font-bold mx-auto pr-8">Users</h2>
                <button onClick={() => setShowDashboardUsers(false)} className="text-app-text-muted"><X/></button>
            </header>
            <div className="px-4 pb-2 pt-1 border-b border-app-border flex gap-2 w-full">
               <input 
                type="text" 
                placeholder="Enter User ID to Search..."
                value={searchUserId}
                onChange={e => setSearchUserId(e.target.value)}
                className="bg-black/50 border border-app-border text-app-text px-4 py-2.5 rounded-xl w-full focus:outline-none focus:border-app-accent text-sm font-mono placeholder:text-app-text-muted"
               />
               <button 
                onClick={async () => {
                    const searchId = searchUserId.trim();
                    if(!searchId) return;
                    setIsSearchingUser(true);
                    try {
                        const userRec = adminUserList.find(u => 
                             u.id === searchId || 
                             String(u.numericId) === searchId ||
                             (u.email && u.email === searchId)
                        );
                        
                        let targetId = userRec ? userRec.id : searchId;
                        
                        // STRICT UID RESOLUTION: If the targetId is a 10-digit number, we MUST get the UID
                        if (/^\d{10}$/.test(targetId)) {
                            try {
                                const userByNumericQuery = query(collection(db, 'users'), where('numericId', '==', targetId));
                                const userSnap = await getDocs(userByNumericQuery);
                                
                                if (!userSnap.empty) {
                                    const realUid = userSnap.docs[0].id;
                                    const userData = userSnap.docs[0].data();
                                    const wDoc = await getDoc(doc(db, 'wallets', realUid));
                                    
                                    setAdminProfileModalUser({
                                        ...userData,
                                        id: realUid,
                                        ...(wDoc.exists() ? wDoc.data() : { deposit: 0, winning: 0, bonus: 0, blocked: false })
                                    });
                                    setIsSearchingUser(false);
                                    return;
                                }
                            } catch(err) {
                                console.error("Numeric resolution failed", err);
                            }
                        }

                        // If not a numeric ID or resolution failed, check if it's already a UID
                        if (!userRec) {
                            const wRef = doc(db, 'wallets', targetId);
                            const wDoc = await getDoc(wRef);
                            const uDoc = await getDoc(doc(db, 'users', targetId));
                            
                            if (wDoc.exists() || uDoc.exists()) {
                                 setAdminProfileModalUser({ 
                                    ...(uDoc.exists() ? uDoc.data() : { name: 'UID User' }), 
                                    id: targetId, 
                                    ...(wDoc.exists() ? wDoc.data() : { deposit: 0, winning: 0, bonus: 0, blocked: false }) 
                                 });
                                 setIsSearchingUser(false);
                                 return;
                            }
                            
                            // Last resort fallback
                            setAdminProfileModalUser({ 
                               id: targetId, 
                               name: 'Searched User',
                               deposit: 0, winning: 0, bonus: 0, blocked: false
                            });
                        } else {
                            // Already found in local list (and handled numeric case above)
                            const wDoc = await getDoc(doc(db, 'wallets', userRec.id));
                            setAdminProfileModalUser({
                                ...userRec,
                                id: userRec.id,
                                ...(wDoc.exists() ? wDoc.data() : { deposit: 0, winning: 0, bonus: 0, blocked: false })
                            });
                        }
                        // Automatically open modal by setting the user
                    } catch(e) {
                        handleFsError(e, 'admin_user_search');
                        console.error(e);
                        alert("Error finding user.");
                    }
                    setIsSearchingUser(false);
                }}
                disabled={isSearchingUser || !searchUserId.trim()}
                className={`bg-app-accent text-black px-4 py-2 rounded-xl font-bold active:scale-95 transition-transform flex items-center justify-center shrink-0 ${isSearchingUser ? 'opacity-70' : 'hover:opacity-90'}`}
               >
                   {isSearchingUser ? '...' : <Search size={18} />}
               </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto pb-20 space-y-3">
                {[...adminUserList]
                    .filter(u => {
                        const searchLower = searchUserId.trim().toLowerCase();
                        if (!searchLower) return true;
                        return String(u.id || '').toLowerCase().includes(searchLower) ||
                               String(u.name || '').toLowerCase().includes(searchLower) ||
                               String(u.email || '').toLowerCase().includes(searchLower) ||
                               String(u.numericId || '').includes(searchLower);
                    })
                    .sort((a, b) => {
                        if ((b.winning || 0) >= 10000 && (a.winning || 0) < 10000) return 1;
                        if ((a.winning || 0) >= 10000 && (b.winning || 0) < 10000) return -1;
                        return (b.winning || 0) - (a.winning || 0);
                    })
                    .map(u => (
                    <div key={u.id} className={`bg-app-card border ${u.winning >= 10000 ? 'border-red-500/50' : 'border-app-border'} rounded-xl p-3 flex justify-between items-center relative overflow-hidden shadow-sm`}>
                         {u.winning >= 10000 && <div className="absolute left-0 top-0 w-1 h-full bg-red-500" title="High Winner!"></div>}
                         <div className="flex-1 min-w-0 mr-3">
                             <p className="text-sm font-bold text-app-text truncate">{u.name || (u.email && String(u.email).split('@')[0]) || 'User'}</p>
                             <p className="text-[10px] text-app-text-muted font-mono truncate">{u.id}</p>
                             <p className="text-[11px] font-bold mt-1 max-w-fit px-1.5 py-0.5 rounded bg-black/50 text-white">
                                 <span className="text-green-400 text-[10px] uppercase mr-1">WIN:</span> ₹{u.winning || 0}
                             </p>
                         </div>
                         <div className="flex flex-col gap-1.5 sm:flex-row shadow-sm">
                             <button onClick={() => {
                                 setAdminProfileModalUser({...u, name: u.name, email: u.email}); 
                             }} className="px-3 py-1.5 text-xs font-bold bg-slate-800 text-slate-300 rounded hover:bg-slate-700 hover:text-white transition-colors flex items-center justify-center gap-1">
                                <User size={12}/> Profile
                             </button>
                             <button onClick={async () => {
                                 const newBlockedStat = !u.blocked;
                                 await setDoc(doc(db, 'wallets', u.id), { ...u, blocked: newBlockedStat }, { merge: true });
                             }} className={`px-3 py-1.5 text-[10px] font-bold rounded ${u.blocked ? 'text-[#4ADE80] border border-[#4ADE80] hover:bg-[#4ADE80]/10' : 'text-red-500 border border-red-500 hover:bg-red-500/10'} transition-colors whitespace-nowrap text-center`}>
                                 {u.blocked ? 'Unblock' : 'Block'}
                             </button>
                         </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {showAdminQuickAdd && isAdmin && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 min-h-[100dvh]">
                <div className="bg-[#13151c] border border-green-500/30 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
                   <button onClick={() => { setShowAdminQuickAdd(false); setPaymentAmount('100'); }} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20}/></button>
                   <h3 className="font-bold text-slate-200 text-lg mb-1 flex items-center gap-2">
                     <Wallet className="text-green-500" size={20} /> Quick Add Cash
                   </h3>
                   <p className="text-xs text-slate-400 mb-6 font-medium">Instantly add money to your wallet without payment.</p>
                   
                   <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block ml-1">Amount (₹)</label>
                   <input type="number" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)} placeholder="0" className="w-full text-2xl font-black bg-black/50 text-white border border-slate-700 rounded-lg p-4 mb-4 outline-none focus:border-green-500 transition-colors text-center" />
                   
                   <div className="grid grid-cols-4 gap-2 mb-6">
                      {[100, 500, 1000, 5000].map(amt => (
                         <button key={amt} onClick={() => setPaymentAmount(amt.toString())} className="bg-slate-800 text-slate-300 font-bold py-2 rounded border border-slate-700 active:bg-slate-700 text-xs text-center transition-colors">
                            +₹{amt}
                         </button>
                      ))}
                   </div>

                   <button onClick={async () => {
                       const amt = parseInt(paymentAmount);
                       if (!amt || isNaN(amt) || amt <= 0) return alert('Invalid amount');
                       if (user?.id) {
                           const newDeposit = (wallet.deposit || 0) + amt;
                           setWallet(prev => ({...prev, deposit: newDeposit}));
                           await setDoc(doc(db, 'wallets', user.id), { deposit: newDeposit }, { merge: true });
                           
                           const newReq: DepositRequest = {
                               id: 'dep_' + Date.now(),
                               userId: user.id,
                               userNumericId: user.numericId,
                               userName: user.name,
                               amount: amt,
                               method: 'Admin Quick Add',
                               utr: 'N/A',
                               status: 'Approved',
                               timestamp: new Date().toLocaleString()
                           };
                           await setDoc(doc(db, 'deposits', newReq.id), newReq);
                           
                           alert(`₹${amt} added to your wallet!`);
                           setShowAdminQuickAdd(false);
                           setPaymentAmount('100');
                       }
                   }} className="w-full py-3 bg-green-500 text-black rounded-xl font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-all hover:bg-green-400 active:scale-95 flex items-center justify-center gap-2">
                     <Plus size={18} strokeWidth={3} /> Add Funds
                   </button>

                   <button onClick={async () => {
                       if (user?.id && window.confirm("Reset your wallet completely to ₹0? This cannot be undone.")) {
                           setWallet({ deposit: 0, winning: 0, bonus: 0 });
                           await setDoc(doc(db, 'wallets', user.id), { deposit: 0, winning: 0, bonus: 0 });
                           alert("Wallet reset to ₹0");
                           setShowAdminQuickAdd(false);
                       }
                   }} className="w-full py-2 mt-3 bg-red-900/40 text-red-500 border border-red-900/50 rounded-xl font-bold uppercase tracking-widest transition-all hover:bg-red-900/60 active:scale-95 text-[10px]">
                     Zero Out Wallet
                   </button>
                </div>
            </div>
      )}

    </div>
  );
}
