import mongoose from 'mongoose';

export const connectDatabase = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/tournament_db';

  try {
    await mongoose.connect(uri);
    console.log('[Database] Connected to MongoDB successfully.');
  } catch (error) {
    console.error('[Database] MongoDB connection failed:', error);
    throw error;
  }
};
