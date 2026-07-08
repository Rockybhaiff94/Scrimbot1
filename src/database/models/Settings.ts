import mongoose, { Schema, Document } from 'mongoose';

export interface ISettings extends Document {
  guildId: string;
  registrationChannelId?: string;
  announcementChannelId?: string;
  logChannelId?: string;
  ticketCategoryId?: string;
  staffRoleId?: string;
  paymentMethod?: string;
  paymentQrUrl?: string;
  upiId?: string;
}

const SettingsSchema: Schema = new Schema({
  guildId: { type: String, required: true, unique: true },
  registrationChannelId: { type: String },
  announcementChannelId: { type: String },
  logChannelId: { type: String },
  ticketCategoryId: { type: String },
  staffRoleId: { type: String },
  paymentMethod: { type: String },
  paymentQrUrl: { type: String },
  upiId: { type: String },
});

export default mongoose.model<ISettings>('Settings', SettingsSchema);
