import { ButtonInteraction, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import Tournament from '../../database/models/Tournament';

export const execute = async (interaction: ButtonInteraction) => {
  // Extract tournament ID from custom ID (format: register_button or register_button_T-XXXXX)
  const parts = interaction.customId.split('_');
  let tournamentId: string | null = null;

  // Check if button has embedded tournament ID (register_button_T-XXXXX)
  if (parts.length > 2) {
    tournamentId = parts.slice(2).join('_');
  }

  // If tournament-specific, validate it's still open
  if (tournamentId) {
    const tournament = await Tournament.findOne({ tournamentId });
    if (!tournament) {
      return await interaction.reply({
        content: '❌ This tournament no longer exists.',
        ephemeral: true,
      });
    }
    if (tournament.status === 'registration_closed' || tournament.status === 'completed' || tournament.status === 'cancelled') {
      return await interaction.reply({
        content: '❌ Registration for this tournament is closed.',
        ephemeral: true,
      });
    }
    const approvedCount = tournament.approvedParticipants?.length || 0;
    if (approvedCount >= tournament.maxTeams) {
      return await interaction.reply({
        content: '❌ All slots are filled for this tournament.',
        ephemeral: true,
      });
    }
  }

  const modalId = tournamentId
    ? `registration_modal_${tournamentId}`
    : 'registration_modal';

  const modal = new ModalBuilder()
    .setCustomId(modalId)
    .setTitle('Tournament Registration');

  const ignInput = new TextInputBuilder()
    .setCustomId('ignInput')
    .setLabel('What is your In-Game Name (IGN)?')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const uidInput = new TextInputBuilder()
    .setCustomId('uidInput')
    .setLabel('What is your Free Fire UID?')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const teamInput = new TextInputBuilder()
    .setCustomId('teamInput')
    .setLabel('What is your Team Name? (Solo if none)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const phoneInput = new TextInputBuilder()
    .setCustomId('phoneInput')
    .setLabel('Phone Number (Optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('Optional - for contact purposes');

  const notesInput = new TextInputBuilder()
    .setCustomId('notesInput')
    .setLabel('Extra Notes (Optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setPlaceholder('Any additional info...');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(ignInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(uidInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(teamInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(phoneInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(notesInput)
  );

  await interaction.showModal(modal);
};
