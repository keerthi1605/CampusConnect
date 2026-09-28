import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set. Copy server/.env.example to server/.env and fill it in.');
  }

  const conn = await mongoose.connect(uri, {
    dbName: process.env.DB_NAME || 'campusconnect',
    serverSelectionTimeoutMS: 8000,
  });
  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
}
