import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import axios, { AxiosError } from 'axios';
import { config } from './config';

interface ChessOpening {
  eco_code: string;
  name: string;
  moves: string;
}

// Helper function to escape single quotes in SQL strings
function escapeSqlString(str: string): string {
  return str.replace(/'/g, "''");
}

async function createTableIfNotExists() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS chess_openings (
      eco_code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      moves TEXT NOT NULL
    );
  `;

  try {
    await axios.post(config.API_URL, {
      sql: createTableSQL,
      params: []
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.API_KEY}`
      }
    });
    console.log('Table created or already exists');
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      console.error('Error creating table:', error.response.data);
    } else {
      console.error('Error creating table:', error);
    }
    throw error;
  }
}

async function insertOpening(opening: ChessOpening) {
  // First try to delete if exists
  const deleteSQL = `
    DELETE FROM chess_openings WHERE eco_code = '${escapeSqlString(opening.eco_code)}';
  `;

  // Then insert new record
  const insertSQL = `
    INSERT INTO chess_openings (eco_code, name, moves)
    VALUES (
      '${escapeSqlString(opening.eco_code)}',
      '${escapeSqlString(opening.name)}',
      '${escapeSqlString(opening.moves)}'
    );
  `;

  try {
    // Log what we're trying to insert
    console.log('\nAttempting to insert opening:');
    console.log('ECO Code:', opening.eco_code);
    console.log('Name:', opening.name);
    console.log('Moves:', opening.moves);
    console.log('\nSQL:', insertSQL);

    // Delete existing record if any
    await axios.post(config.API_URL, {
      sql: deleteSQL,
      params: []
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.API_KEY}`
      }
    });

    // Insert new record
    const response = await axios.post(config.API_URL, {
      sql: insertSQL,
      params: []
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.API_KEY}`
      }
    });
    
    console.log(`Successfully inserted opening: ${opening.eco_code} - ${opening.name}`);
    console.log('Response:', response.data);
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      console.error(`Error inserting opening ${opening.eco_code}:`, error.response.data);
    } else {
      console.error(`Error inserting opening ${opening.eco_code}:`, error);
    }
    throw error;
  }
}

async function populateDatabase() {
  try {
    // Create table if it doesn't exist
    await createTableIfNotExists();

    // Read and parse CSV file
    const csvPath = path.join(process.cwd(), 'sample_eco.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });

    // Log the first record to see what we're getting from the CSV
    console.log('\nFirst record from CSV:', records[0]);

    // Insert each opening
    for (const record of records) {
      const opening: ChessOpening = {
        eco_code: record['ECO Code'],
        name: record['Name'],
        moves: record['Opening Moves']
      };
      await insertOpening(opening);
    }

    console.log('Database population completed successfully');
  } catch (error) {
    console.error('Error populating database:', error);
    process.exit(1);
  }
}

// Run the population script
populateDatabase(); 