import fs from 'fs';
import path from 'path';

// Local storage file path (will be in the app's current directory)
const STORAGE_FILE = path.join(process.cwd(), 'teams_local_storage.json');
// Maximum file size 10 MB in bytes
const MAX_STORAGE_SIZE_BYTES = 10 * 1024 * 1024;

export interface TeamData {
  userId: string;
  matchId: string;
  players: string[];
  timestamp: string;
}

export async function saveTeamToStorage(teamData: TeamData): Promise<boolean> {
  try {
    // If the file doesn't exist, create it with an empty array
    if (!fs.existsSync(STORAGE_FILE)) {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify([]));
    }

    // Check current file size before performing any operations
    const stats = fs.statSync(STORAGE_FILE);
    if (stats.size >= MAX_STORAGE_SIZE_BYTES) {
      console.error("[Storage] 10MB Limit Reached! Cannot save more teams in this file.");
      return false; // Storage limit reached
    }

    // Read the current data from the file
    const fileContent = fs.readFileSync(STORAGE_FILE, 'utf-8');
    let teams: TeamData[] = [];
    if (fileContent) {
      try {
        teams = JSON.parse(fileContent);
      } catch (e) {
        console.error("[Storage] Invalid JSON inside storage file. Resetting to empty array.");
        teams = [];
      }
    }

    // Check if the user already has a team saved for this match
    const existingIndex = teams.findIndex(
      (t) => t.userId === teamData.userId && t.matchId === teamData.matchId
    );

    // Update existing team or append the new one
    if (existingIndex >= 0) {
      teams[existingIndex] = teamData;
    } else {
      teams.push(teamData);
    }

    // Convert to string format
    const stringifiedData = JSON.stringify(teams, null, 2);
    
    // Safety check just in case new dataset exceeds 10MB limit
    if (Buffer.byteLength(stringifiedData, 'utf-8') >= MAX_STORAGE_SIZE_BYTES) {
      console.error("[Storage] 10MB Limit Reached! Not saving new data.");
      return false;
    }

    // Save the data to the file
    fs.writeFileSync(STORAGE_FILE, stringifiedData);
    return true;

  } catch (err) {
    console.error("[Storage] Error reading/writing team to storage file:", err);
    return false;
  }
}
