import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Configuration object with type assertion to ensure values are strings
export const config = {
  API_URL: process.env.VITE_API_URL as string,
  API_KEY: process.env.VITE_API_KEY as string
};

// Validate configuration
if (!config.API_URL || !config.API_KEY) {
  throw new Error('Missing required environment variables. Please check your .env file.');
} 