import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME || 'athena-graph';

let client = null;
let db = null;

/**
 * Connect to MongoDB
 * @returns {Promise<MongoClient>}
 */
export async function connectToDatabase() {
  if (client && db) {
    return { client, db };
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
    console.log(`Connected to MongoDB: ${dbName}`);
    return { client, db };
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

/**
 * Close the database connection
 */
export async function closeDatabase() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB connection closed');
  }
}

/**
 * Get the database instance
 * @returns {Db}
 */
export function getDatabase() {
  if (!db) {
    throw new Error('Database not connected. Call connectToDatabase() first.');
  }
  return db;
}

/**
 * Get the subjects collection
 * @returns {Collection}
 */
export function getSubjectsCollection() {
  const database = getDatabase();
  return database.collection('subjects');
}

