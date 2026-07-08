import mongoose, { Schema, Document } from 'mongoose';

export interface IPrize {
  position: number;
  label: string;
  amount: number;
}

export interface IReminderSettings {
  enabled: boolean;
  intervals: number[]; // minutes before match
}

export interface ITournament extends Document {
  tournamentId: string;
  name: string;
  description: string;
  gameName: string;
  matchType: 'solo' | 'duo' | 'squad' | 'custom';
  status: 'upcoming' | 'registration_open' | 'registration_closed' | 'ongoing' | 'completed' | 'cancelled';
  maxTeams: number;
  reservedSlots: number;
  registeredTeams: number;
  approvedParticipants: string[];
  prizePool: string;
  prizes: IPrize[];
  prizeEnabled: boolean;
  registrationFee: number;
  currency: string;
  matchDate: Date;
  registrationOpenTime: Date;
  registrationCloseTime: Date;
  guildId: string;
  announcementMessageId?: string;
  announcementChannelId?: string;
  previewChannelId?: string;
  previewMessageId?: string;
  createdBy: string;
  organizerName?: string;
  hostName?: string;
  supportContact?: string;
  // Embed Customization
  embedColor?: string;
  embedThumbnail?: string;
  embedBanner?: string;
  embedFooter?: string;
  rules?: string;
  notes?: string;
  // Reminders
  reminderSettings: IReminderSettings;
  remindersSent: number[];
  // Waitlist
  waitlistEnabled: boolean;
  waitlistCount: number;
  // Payment
  paymentDetails: {
    upiId?: string;
    qrCodeUrl?: string;
    instructions?: string;
  };
  // Logging
  roomCredentials: { roomId?: string; password?: string; sentAt?: Date }[];
  createdAt: Date;
}

const PrizeSchema = new Schema({
  position: { type: Number, required: true },
  label: { type: String, required: true },
  amount: { type: Number, required: true },
}, { _id: false });

const TournamentSchema: Schema = new Schema({
  tournamentId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  gameName: { type: String, default: 'Free Fire' },
  matchType: { type: String, enum: ['solo', 'duo', 'squad', 'custom'], default: 'squad' },
  status: {
    type: String,
    enum: ['upcoming', 'registration_open', 'registration_closed', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming',
  },
  maxTeams: { type: Number, default: 100 },
  reservedSlots: { type: Number, default: 0 },
  registeredTeams: { type: Number, default: 0 },
  approvedParticipants: [{ type: String }],
  prizePool: { type: String },
  prizes: [PrizeSchema],
  prizeEnabled: { type: Boolean, default: false },
  registrationFee: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  matchDate: { type: Date },
  registrationOpenTime: { type: Date },
  registrationCloseTime: { type: Date },
  guildId: { type: String, required: true },
  announcementMessageId: { type: String },
  announcementChannelId: { type: String },
  previewChannelId: { type: String },
  previewMessageId: { type: String },
  createdBy: { type: String },
  organizerName: { type: String },
  hostName: { type: String },
  supportContact: { type: String },
  // Embed Customization
  embedColor: { type: String, default: '#e74c3c' },
  embedThumbnail: { type: String },
  embedBanner: { type: String },
  embedFooter: { type: String },
  rules: { type: String },
  notes: { type: String },
  // Reminders
  reminderSettings: {
    enabled: { type: Boolean, default: false },
    intervals: [{ type: Number }],
  },
  remindersSent: [{ type: Number }],
  // Waitlist
  waitlistEnabled: { type: Boolean, default: false },
  waitlistCount: { type: Number, default: 0 },
  // Payment
  paymentDetails: {
    upiId: { type: String },
    qrCodeUrl: { type: String },
    instructions: { type: String },
  },
  // Room credential history
  roomCredentials: [{
    roomId: { type: String },
    password: { type: String },
    sentAt: { type: Date, default: Date.now },
  }],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<ITournament>('Tournament', TournamentSchema);
