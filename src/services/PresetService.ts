import Preset, { IPreset } from '../database/models/Preset';
import Tournament from '../database/models/Tournament';
import { v4 as uuidv4 } from 'uuid';

export class PresetService {
  /**
   * Generates a unique short ID for a preset.
   */
  static generatePresetId(): string {
    return 'PRESET-' + uuidv4().split('-')[0].toUpperCase();
  }

  /**
   * Fetch all presets for a specific guild
   */
  static async getPresetsByGuild(guildId: string): Promise<IPreset[]> {
    return Preset.find({ guildId }).sort({ isFavorite: -1, lastUsed: -1 }).exec();
  }

  /**
   * Create a completely new preset from a configuration object
   */
  static async createPreset(data: Partial<IPreset>): Promise<IPreset> {
    const presetId = this.generatePresetId();
    const newPreset = new Preset({ ...data, presetId });
    return newPreset.save();
  }

  /**
   * Save an existing Tournament configuration as a preset
   */
  static async saveTournamentAsPreset(tournamentId: string, presetMeta: { name: string, description: string, ownerId: string, guildId: string, isFavorite?: boolean, isDefault?: boolean }): Promise<IPreset | null> {
    const tournament = await Tournament.findOne({ tournamentId, guildId: presetMeta.guildId });
    if (!tournament) return null;

    const presetData: Partial<IPreset> = {
      presetId: this.generatePresetId(),
      guildId: presetMeta.guildId,
      ownerId: presetMeta.ownerId,
      name: presetMeta.name,
      description: presetMeta.description,
      isFavorite: presetMeta.isFavorite || false,
      isDefault: presetMeta.isDefault || false,
      
      gameName: tournament.gameName,
      matchType: tournament.matchType as any,
      maxTeams: tournament.maxTeams,
      reservedSlots: tournament.reservedSlots,
      prizePool: tournament.prizePool,
      prizes: tournament.prizes,
      prizeEnabled: tournament.prizeEnabled,
      registrationFee: tournament.registrationFee,
      currency: tournament.currency,
      
      waitlistEnabled: tournament.waitlistEnabled,
      
      embedColor: tournament.embedColor,
      embedThumbnail: tournament.embedThumbnail,
      embedBanner: tournament.embedBanner,
      embedFooter: tournament.embedFooter,
      
      announcementChannelId: tournament.announcementChannelId,
      
      paymentDetails: tournament.paymentDetails ? {
        enabled: !!tournament.paymentDetails.upiId,
        upiId: tournament.paymentDetails.upiId,
        qrCodeUrl: tournament.paymentDetails.qrCodeUrl,
        instructions: tournament.paymentDetails.instructions,
      } : { enabled: false },
      
      rules: tournament.rules,
      notes: tournament.notes,
      dmTemplates: {} // Initialize empty
    };

    const newPreset = new Preset(presetData);
    return newPreset.save();
  }

  /**
   * Update an existing preset
   */
  static async updatePreset(presetId: string, guildId: string, updates: Partial<IPreset>): Promise<IPreset | null> {
    return Preset.findOneAndUpdate({ presetId, guildId }, { $set: updates }, { new: true }).exec();
  }

  /**
   * Duplicate an existing preset
   */
  static async duplicatePreset(presetId: string, guildId: string, newName: string): Promise<IPreset | null> {
    const preset = await Preset.findOne({ presetId, guildId }).lean();
    if (!preset) return null;

    // Remove _id, __v, dates, and presetId to create a fresh copy
    const { _id, __v, createdAt, updatedAt, presetId: oldId, ...rest } = preset as any;
    
    const newPresetData = {
      ...rest,
      presetId: this.generatePresetId(),
      name: newName,
      isDefault: false, // Don't duplicate the default flag
      usageCount: 0,
      lastUsed: undefined,
    };

    return Preset.create(newPresetData);
  }

  /**
   * Delete a preset
   */
  static async deletePreset(presetId: string, guildId: string): Promise<boolean> {
    const result = await Preset.deleteOne({ presetId, guildId });
    return result.deletedCount === 1;
  }

  /**
   * Export preset as JSON string
   */
  static async exportPreset(presetId: string, guildId: string): Promise<string | null> {
    const preset = await Preset.findOne({ presetId, guildId }).lean();
    if (!preset) return null;

    // Clean up sensitive/internal data before export
    const { _id, __v, guildId: gId, ownerId, presetId: pId, createdAt, updatedAt, usageCount, lastUsed, ...exportData } = preset as any;
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import preset from JSON string
   */
  static async importPreset(jsonString: string, ownerId: string, guildId: string): Promise<IPreset | null> {
    try {
      const data = JSON.parse(jsonString);
      
      // Basic validation
      if (!data.name || !data.gameName || typeof data.maxTeams !== 'number') {
        throw new Error('Invalid preset JSON schema');
      }

      // Add server-specific metadata
      const newPresetData: Partial<IPreset> = {
        ...data,
        presetId: this.generatePresetId(),
        guildId,
        ownerId,
        isDefault: false, // Imported presets shouldn't override default automatically
        usageCount: 0
      };

      return Preset.create(newPresetData);
    } catch (e) {
      console.error('Failed to import preset:', e);
      return null;
    }
  }

  /**
   * Generate a Tournament object from a Preset (merging volatile data)
   */
  static async applyPresetToTournament(presetId: string, guildId: string, volatileData: { matchDate: Date, roomCredentials?: any }): Promise<any> {
    const preset = await Preset.findOne({ presetId, guildId });
    if (!preset) return null;

    // Update usage stats
    preset.usageCount += 1;
    preset.lastUsed = new Date();
    await preset.save();

    const tId = 'T-' + uuidv4().split('-')[0].toUpperCase();

    // Create tournament document data based on preset
    const tournamentData = {
      tournamentId: tId,
      guildId,
      name: preset.name + ' (Auto)',
      description: preset.description,
      gameName: preset.gameName,
      matchType: preset.matchType,
      status: 'upcoming', // Default status
      maxTeams: preset.maxTeams,
      reservedSlots: preset.reservedSlots,
      prizePool: preset.prizePool,
      prizes: preset.prizes,
      prizeEnabled: preset.prizeEnabled,
      registrationFee: preset.registrationFee,
      currency: preset.currency,
      waitlistEnabled: preset.waitlistEnabled,
      embedColor: preset.embedColor,
      embedThumbnail: preset.embedThumbnail,
      embedBanner: preset.embedBanner,
      embedFooter: preset.embedFooter,
      announcementChannelId: preset.announcementChannelId,
      paymentDetails: preset.paymentDetails,
      rules: preset.rules,
      notes: preset.notes,
      
      matchDate: volatileData.matchDate,
      roomCredentials: volatileData.roomCredentials ? [volatileData.roomCredentials] : [],
      
      // Other defaults
      registeredTeams: 0,
      approvedParticipants: [],
      remindersSent: [],
      waitlistCount: 0,
    };

    const newTournament = new Tournament(tournamentData);
    return newTournament.save();
  }
}
