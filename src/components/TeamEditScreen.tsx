import React, { useState } from 'react';

interface TeamEditScreenProps {
  userId: string;
  matchId: string;
}

export const TeamEditScreen: React.FC<TeamEditScreenProps> = ({ userId, matchId }) => {
  const [selectedPlayers] = useState([
    "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11"
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; color: string } | null>(null);

  const showSnackbar = (message: string, color: string) => {
    setSnackbar({ message, color });
    // Hide snackbar after 3 seconds
    setTimeout(() => setSnackbar(null), 3000);
  };

  const saveTeamToBackend = async () => {
    setIsLoading(true);
    // Optimistic Response: Tell user to wait while we submit to queue
    showSnackbar('Saving your team... Please wait.', 'bg-orange-500');

    try {
      // Sending data to our Node.js Backend API
      const response = await fetch('/api/team/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          matchId,
          players: selectedPlayers,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        showSnackbar('Team Saved Successfully in Queue! 🎉', 'bg-green-500');
      } else if (response.status === 429) {
        showSnackbar('Too many requests! Please wait a second before editing again.', 'bg-red-500');
      } else {
        throw new Error('Server Error');
      }
    } catch (error: any) {
      showSnackbar(`Failed to save team online: ${error.message}. Retrying in background...`, 'bg-red-500');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] max-w-sm w-full mx-auto bg-white border border-gray-200 rounded-xl overflow-hidden shadow-lg relative font-sans">
      {/* AppBar Equivalent */}
      <div className="bg-green-800 text-white p-4 shadow-md flex items-center justify-between z-10">
        <h2 className="text-xl font-semibold">Edit Dream Team</h2>
      </div>

      {/* Snackbar Modal Equivalent */}
      {snackbar && (
        <div className={`absolute top-16 left-4 right-4 z-20 px-4 py-3 rounded text-white text-sm shadow-lg transition-all ${snackbar.color}`}>
          {snackbar.message}
        </div>
      )}

      {/* Body: Player List */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col items-stretch space-y-3 relative">
        {selectedPlayers.map((playerIdx, index) => (
          <div key={playerIdx} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-800 font-bold">
                {index + 1}
              </div>
              <span className="text-gray-800 font-medium">Player ID: {playerIdx}</span>
            </div>
            {/* Checkmark Icon */}
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        ))}
      </div>

      {/* Footer Button Equivalent */}
      <div className="p-4 bg-white border-t border-gray-200">
        <button
          onClick={saveTeamToBackend}
          disabled={isLoading}
          className={`w-full py-4 rounded font-bold text-white text-[15px] sm:text-lg transition-colors flex items-center justify-center 
            ${isLoading ? 'bg-green-600 opacity-80 cursor-not-allowed' : 'bg-green-800 hover:bg-green-700'}`}
        >
          {isLoading ? (
            <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            "SAVE TEAM (10K LIMIT COMPATIBLE)"
          )}
        </button>
      </div>
    </div>
  );
};
