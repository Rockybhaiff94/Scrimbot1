import { CommandInteraction, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { Command } from '../types/Command';
import { PresetService } from '../services/PresetService';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('match_quick')
    .setDescription('Instantly create a tournament using your default preset')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId;
    
    if (!guildId) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    try {
      // Find the default preset
      const presets = await PresetService.getPresetsByGuild(guildId);
      const defaultPreset = presets.find((p: any) => p.isDefault);

      if (!defaultPreset) {
        return interaction.reply({ 
          content: 'You do not have a default preset set! Please use `/preset list` to manage your presets and set one as default, or use `/preset use` to select a preset manually.', 
          ephemeral: true 
        });
      }

      // Open a modal to get volatile data (Date, Time, Room ID)
      const modal = new ModalBuilder()
        .setCustomId(`quick_match_modal_${defaultPreset.presetId}`)
        .setTitle(`Quick Match: ${defaultPreset.name.substring(0, 30)}`);

      const dateInput = new TextInputBuilder()
        .setCustomId('match_date')
        .setLabel('Tournament Date & Time')
        .setPlaceholder('e.g., Today at 8 PM, or YYYY-MM-DD HH:MM')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const roomIdInput = new TextInputBuilder()
        .setCustomId('room_id')
        .setLabel('Room ID (Optional)')
        .setPlaceholder('Leave blank if creating later')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const roomPassInput = new TextInputBuilder()
        .setCustomId('room_password')
        .setLabel('Room Password (Optional)')
        .setPlaceholder('Leave blank if creating later')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(roomIdInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(roomPassInput)
      );

      await interaction.showModal(modal);

    } catch (error) {
      console.error(error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  },
};
