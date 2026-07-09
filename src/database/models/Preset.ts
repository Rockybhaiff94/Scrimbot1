import mongoose, { Schema, Document } from 'mongoose';

export interface IDMTemplates {
  registrationSuccessful?: string;
  registrationPending?: string;
  registrationRejected?: string;
  roomDetails?: string;
  reminder?: string;
  tournamentStarting?: string;
  winnerAnnouncement?: string;
  paymentConfirmation?: string;
  refundConfirmation?: string;
  cancellationNotice?: string;
}

export interface IPreset extends Document {
  presetId: string;
  guildId: string;
  ownerId: string;
  
  // General
  name: string;
  description?: string;
  category?: string;
  isFavorite: boolean;
  isDefault: boolean;
  usageCount: number;
  lastUsed?: Date;
  
  // Tournament Configuration
  gameName: string;
  matchType: 'solo' | 'duo' | 'squad' | 'custom';
  maxTeams: number;
  reservedSlots: number;
  prizePool?: string;
  prizes: { position: number; label: string; amount: number; }[];
  prizeEnabled: boolean;
  registrationFee: number;
  currency: string;
  
  // Registration Settings
  waitlistEnabled: boolean;
  
  // Visual Assets
  embedColor?: string;
  embedThumbnail?: string;
  embedBanner?: string;
  embedFooter?: string;
  
  // Discord Config (Channels & Roles)
  announcementChannelId?: string;
  registrationChannelId?: string;
  resultChannelId?: string;
  logChannelId?: string;
  staffChannelId?: string;
  voiceChannelId?: string;
  
  winnerRoleId?: string;
  participantRoleId?: string;
  spectatorRoleId?: string;
  verificationRoleId?: string;
  rolePingId?: string;
  
  // Payment
  paymentDetails: {
    enabled: boolean;
    upiId?: string;
    qrCodeUrl?: string;
    instructions?: string;
  };
  
  // Advanced & Rules
  rules?: string;
  notes?: string;
  dmTemplates: IDMTemplates;
  
  createdAt: Date;
  updatedAt: Date;
}

const PresetSchema: Schema = new Schema({
  presetId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  ownerId: { type: String, required: true },
  
  // General
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String, default: 'General' },
  isFavorite: { type: Boolean, default: false },
  isDefault: { type: Boolean, default: false },
  usageCount: { type: Number, default: 0 },
  lastUsed: { type: Date },
  
  // Tournament Config
  gameName: { type: String, default: 'Free Fire' },
  matchType: { type: String, enum: ['solo', 'duo', 'squad', 'custom'], default: 'squad' },
  maxTeams: { type: Number, default: 100 },
  reservedSlots: { type: Number, default: 0 },
  prizePool: { type: String },
  prizes: [{
    position: { type: Number, required: true },
    label: { type: String, required: true },
    amount: { type: Number, required: true },
    _id: false
  }],
  prizeEnabled: { type: Boolean, default: false },
  registrationFee: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  
  // Registration
  waitlistEnabled: { type: Boolean, default: false },
  
  // Visual Assets
  embedColor: { type: String, default: '#e74c3c' },
  embedThumbnail: { type: String },
  embedBanner: { type: String },
  embedFooter: { type: String },
  
  // Discord Config
  announcementChannelId: { type: String },
  registrationChannelId: { type: String },
  resultChannelId: { type: String },
  logChannelId: { type: String },
  staffChannelId: { type: String },
  voiceChannelId: { type: String },
  
  winnerRoleId: { type: String },
  participantRoleId: { type: String },
  spectatorRoleId: { type: String },
  verificationRoleId: { type: String },
  rolePingId: { type: String },
  
  // Payment
  paymentDetails: {
    enabled: { type: Boolean, default: false },
    upiId: { type: String },
    qrCodeUrl: { type: String },
    instructions: { type: String },
  },
  
  // Advanced & Rules
  rules: { type: String },
  notes: { type: String },
  dmTemplates: {
    registrationSuccessful: { type: String },
    registrationPending: { type: String },
    registrationRejected: { type: String },
    roomDetails: { type: String },
    reminder: { type: String },
    tournamentStarting: { type: String },
    winnerAnnouncement: { type: String },
    paymentConfirmation: { type: String },
    refundConfirmation: { type: String },
    cancellationNotice: { type: String },
  },
  
}, { timestamps: true });

// Ensure only one default preset per guild
PresetSchema.pre('save', async function() {
  if (this.isModified('isDefault') && this.isDefault) {
    await this.model('Preset').updateMany(
      { guildId: this.guildId, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
});

export default mongoose.model<IPreset>('Preset', PresetSchema);
