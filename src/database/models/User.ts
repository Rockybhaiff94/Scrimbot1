import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  discordId: string;
  inGameName?: string;
  uid?: string;
  teamName?: string;
  registeredAt: Date;
}

const UserSchema: Schema = new Schema({
  discordId: { type: String, required: true, unique: true },
  inGameName: { type: String },
  uid: { type: String },
  teamName: { type: String },
  registeredAt: { type: Date, default: Date.now },
});

export default mongoose.model<IUser>('User', UserSchema);
