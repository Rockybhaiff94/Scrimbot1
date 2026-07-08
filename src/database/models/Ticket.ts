import mongoose, { Schema, Document } from 'mongoose';

export interface ITicket extends Document {
  ticketId: string;
  userId: string;
  channelId: string;
  tournamentId: string;
  type: 'registration' | 'support' | 'payment';
  status: 'open' | 'closed' | 'pending_approval' | 'approved' | 'rejected';
  paymentProofUrl?: string;
  createdAt: Date;
}

const TicketSchema: Schema = new Schema({
  ticketId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  channelId: { type: String, required: true },
  tournamentId: { type: String },
  type: { type: String, enum: ['registration', 'support', 'payment'], required: true },
  status: { type: String, enum: ['open', 'closed', 'pending_approval', 'approved', 'rejected'], default: 'open' },
  paymentProofUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<ITicket>('Ticket', TicketSchema);
