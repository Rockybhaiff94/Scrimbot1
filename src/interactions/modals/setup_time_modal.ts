import { ModalSubmitInteraction, Client } from 'discord.js';
import Tournament from '../../database/models/Tournament';
import { updateAnnouncementEmbed } from '../../jobs/tournamentScheduler';

export async function execute(interaction: ModalSubmitInteraction) {
  const tournamentId = interaction.customId.replace('setup_time_modal_', '');
  const tournament = await Tournament.findOne({ tournamentId, guildId: interaction.guildId! });
  if (!tournament) return interaction.reply({ content: '❌ Tournament not found.', ephemeral: true });

  try {
    const matchDate = interaction.fields.getTextInputValue('matchDate');
    if (matchDate) {
      tournament.matchDate = new Date(matchDate);
    }
  } catch (e) { /* optional */ }

  try {
    const regClose = interaction.fields.getTextInputValue('regClose');
    if (regClose) {
      tournament.registrationCloseTime = new Date(regClose);
    }
  } catch (e) { /* optional */ }

  await tournament.save();
  await updateAnnouncementEmbed(interaction.client as Client, tournament);

  await interaction.reply({ content: '✅ Date and time information updated!', ephemeral: true });
}
