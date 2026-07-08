import { ButtonInteraction, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import Tournament from '../../database/models/Tournament';

export async function execute(interaction: ButtonInteraction) {
  const tournamentId = interaction.customId.replace('setup_visuals_', '');
  const tournament = await Tournament.findOne({ tournamentId, guildId: interaction.guildId! });
  if (!tournament) return interaction.reply({ content: '❌ Tournament not found.', ephemeral: true });

  const modal = new ModalBuilder()
    .setCustomId(`setup_visuals_modal_${tournamentId}`)
    .setTitle('Visuals Information');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('embedColor').setLabel('Embed Color (Hex)').setStyle(TextInputStyle.Short).setValue(tournament.embedColor || '#e74c3c').setRequired(false)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('embedThumbnail').setLabel('Thumbnail URL').setStyle(TextInputStyle.Short).setValue(tournament.embedThumbnail || '').setRequired(false)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('embedBanner').setLabel('Banner Image URL').setStyle(TextInputStyle.Short).setValue(tournament.embedBanner || '').setRequired(false)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('embedFooter').setLabel('Footer Text').setStyle(TextInputStyle.Short).setValue(tournament.embedFooter || '').setRequired(false)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('notes').setLabel('Notes').setStyle(TextInputStyle.Paragraph).setValue(tournament.notes || '').setRequired(false)
    )
  );

  await interaction.showModal(modal);
}
