import axios from 'axios';
import type { ChessOpening } from '../types/chess';

const API_URL = import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

// Helper function to escape single quotes in SQL strings
function escapeSqlString(str: string): string {
  return str.replace(/'/g, "''");
}

export async function findOpening(moves: string): Promise<ChessOpening | null> {
  try {
    console.log('Searching for opening with moves:', moves);
    
    const sql = `
      SELECT eco_code, name, moves 
      FROM chess_openings 
      WHERE moves = '${escapeSqlString(moves)}'
      LIMIT 1;
    `;

    console.log('Executing SQL:', sql);

    const response = await axios.post(API_URL, {
      sql,
      params: []
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      }
    });

    console.log('Database response:', response.data);

    // Handle Supabase response format
    if (response.data?.results?.[0]?.results?.[0]) {
      const opening = response.data.results[0].results[0];
      return {
        ecoCode: opening.eco_code,
        name: opening.name,
        moves: opening.moves
      };
    }

    console.log('No opening found for moves:', moves);
    return null;
  } catch (error) {
    console.error('Error finding opening:', error);
    return null;
  }
} 