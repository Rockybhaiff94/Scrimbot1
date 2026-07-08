import { ButtonInteraction, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import Tournament from '../../database/models/Tournament';

export async function execute(interaction: ButtonInteraction) {
  const tournamentId = interaction.customId.replace('setup_basic_', '');
  const tournament = await Tournament.findOne({ tournamentId, guildId: interaction.guildId! });
  if (!tournament) return interaction.reply({ content: '❌ Tournament not found.', ephemeral: true });

  const modal = new ModalBuilder()
    .setCustomId(`setup_basic_modal_${tournamentId}`)
    .setTitle('Basic Information');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('name').setLabel('Tournament Name').setStyle(TextInputStyle.Short).setValue(tournament.name || '').setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(tournament.description || '').setRequired(false)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('gameName').setLabel('Game Name').setStyle(TextInputStyle.Short).setValue(tournament.gameName || 'Free Fire').setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('matchType').setLabel('Match Type (solo/duo/squad/custom)').setStyle(TextInputStyle.Short).setValue(tournament.matchType || 'squad').setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('organizerName').setLabel('Organizer Name').setStyle(TextInputStyle.Short).setValue(tournament.organizerName || '').setRequired(false)
    )
  );

  await interaction.showModal(modal);
}
