import mongoose, { Document, Schema } from 'mongoose';

export interface ILeaderboard extends Document {
  guildId: string;
  channelId: string;
  messageId: string;
}

const leaderboardSchema = new Schema<ILeaderboard>({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true },
});

export default mongoose.model<ILeaderboard>('Leaderboard', leaderboardSchema);
