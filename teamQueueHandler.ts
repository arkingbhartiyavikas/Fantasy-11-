import { Request, Response } from 'express';

// In-Memory Queue to handle high burst of team edits (e.g. 20,000+ users at once)
// This prevents database quota exhaustion or connection drops by queueing requests
// and processing them in safe batches (max 500 per batch for Firestore).

import { saveTeamToStorage } from './localTeamStorage.js';

interface TeamEditRequest {
  userId: string;
  matchId: string;
  players: string[];
  timestamp: string;
}

class TeamQueue {
  private queue: TeamEditRequest[] = [];
  private isProcessing: boolean = false;
  // Firestore limit is 500 writes per batch. We use 450 to leave some margin.
  private BATCH_SIZE = 450; 

  // Add a new user team edit request to the Queue
  public enqueue(reqData: TeamEditRequest) {
    this.queue.push(reqData);
    console.log(`[Queue] Team edit added. Queue length: ${this.queue.length}`);
    this.processQueue(); // trigger background processing
  }

  // Process the queue continuously until empty
  private async processQueue() {
    // Prevent overlapping process loops
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        // Take a chunk out of the main queue array
        const batch = this.queue.splice(0, this.BATCH_SIZE);
        
        console.log(`[Queue Worker] Processing batch of ${batch.length} team edits...`);
        
        // Simulating the Backend DB saving (In-production, you will write this to Firebase-admin Firestore here)
        await this.simulateDatabaseBatchWrite(batch);
        
        console.log(`[Queue Worker] Successfully saved ${batch.length} teams.`);
      }
    } catch (e) {
      console.error("[Queue Worker] Error processing batch:", e);
    } finally {
      this.isProcessing = false;
    }
  }

  private async simulateDatabaseBatchWrite(batch: TeamEditRequest[]) {
    // Artificial delay to simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Save each team to our local JSON storage file
    for (const item of batch) {
      await saveTeamToStorage({
        userId: item.userId,
        matchId: item.matchId,
        players: item.players,
        timestamp: item.timestamp,
      });
    }
    
    // In actual production, you might also push to Firestore or real database here
  }

  public getQueueLength() {
    return this.queue.length;
  }
}

// Global Singleton Instance of our Queue
export const teamQueue = new TeamQueue();

// Memory store to prevent single users from spamming the endpoint
const userRateLimits = new Map<string, number>();

/**
 * Express Route Handler for /api/team/edit
 * Receives the POST request, rate limits, and enqueues.
 */
export const handleTeamEdit = (req: Request, res: Response): any => {
  const { userId, matchId, players, timestamp } = req.body;

  if (!userId || !matchId || !players) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // 1. User-Level Rate Limiting (e.g. 1 request per second per user)
  const now = Date.now();
  const lastUpdate = userRateLimits.get(userId);
  if (lastUpdate && now - lastUpdate < 1000) {
    // Returning 429 so the Flutter frontend handles it as "Too many requests!"
    return res.status(429).json({ error: "Too many requests! Please wait a second before editing again." });
  }
  userRateLimits.set(userId, now);

  // 2. Add the team to our processing queue
  teamQueue.enqueue({
    userId,
    matchId,
    players,
    timestamp: timestamp || new Date().toISOString()
  });

  // 3. Optimistic Response: Tell the client it's safely in queue
  return res.status(200).json({
    success: true,
    message: "Team Saved Successfully in Queue! 🎉",
    queuePosition: teamQueue.getQueueLength()
  });
};
