import axios from 'axios';
import { config } from './config';

async function testInsert() {
  try {
    // First, let's check the table structure
    const checkTableSQL = `
      SELECT sql FROM sqlite_master WHERE type='table' AND name='chess_openings';
    `;
    
    console.log('Checking table structure...');
    const tableResponse = await axios.post(config.API_URL, {
      sql: checkTableSQL,
      params: []
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.API_KEY}`
      }
    });
    
    console.log('Table structure:', tableResponse.data);

    // Now try a simple insert
    const insertSQL = `
      INSERT INTO chess_openings (eco_code, name, moves) 
      VALUES ('A00', 'Test Opening', 'e4');
    `;
    
    console.log('\nTrying simple insert...');
    const insertResponse = await axios.post(config.API_URL, {
      sql: insertSQL,
      params: []
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.API_KEY}`
      }
    });
    
    console.log('Insert response:', insertResponse.data);

  } catch (error: any) {
    if (error.response) {
      console.error('Error response:', error.response.data);
    } else {
      console.error('Error:', error);
    }
  }
}

testInsert(); 