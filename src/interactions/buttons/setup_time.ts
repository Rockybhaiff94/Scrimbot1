import { ButtonInteraction, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import Tournament from '../../database/models/Tournament';

export async function execute(interaction: ButtonInteraction) {
  const tournamentId = interaction.customId.replace('setup_time_', '');
  const tournament = await Tournament.findOne({ tournamentId, guildId: interaction.guildId! });
  if (!tournament) return interaction.reply({ content: '❌ Tournament not found.', ephemeral: true });

  const modal = new ModalBuilder()
    .setCustomId(`setup_time_modal_${tournamentId}`)
    .setTitle('Date & Time Information');

  const matchDate = tournament.matchDate ? tournament.matchDate.toISOString().slice(0, 16).replace('T', ' ') : '';
  const regClose = tournament.registrationCloseTime ? tournament.registrationCloseTime.toISOString().slice(0, 16).replace('T', ' ') : '';

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('matchDate').setLabel('Match Date (YYYY-MM-DD HH:mm)').setStyle(TextInputStyle.Short).setValue(matchDate).setRequired(false)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('regClose').setLabel('Reg Close Date (YYYY-MM-DD HH:mm)').setStyle(TextInputStyle.Short).setValue(regClose).setRequired(false)
    )
  );

  await interaction.showModal(modal);
}
