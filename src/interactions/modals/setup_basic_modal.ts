import { ModalSubmitInteraction, Client } from 'discord.js';
import Tournament from '../../database/models/Tournament';
import { updateAnnouncementEmbed } from '../../jobs/tournamentScheduler';

export async function execute(interaction: ModalSubmitInteraction) {
  const tournamentId = interaction.customId.replace('setup_basic_modal_', '');
  const tournament = await Tournament.findOne({ tournamentId, guildId: interaction.guildId! });
  if (!tournament) return interaction.reply({ content: '❌ Tournament not found.', ephemeral: true });

  tournament.name = interaction.fields.getTextInputValue('name');
  tournament.gameName = interaction.fields.getTextInputValue('gameName');
  tournament.matchType = interaction.fields.getTextInputValue('matchType') as any;
  
  try {
    tournament.description = interaction.fields.getTextInputValue('description');
  } catch (e) { /* optional field */ }
  
  try {
    tournament.organizerName = interaction.fields.getTextInputValue('organizerName');
  } catch (e) { /* optional field */ }

  await tournament.save();
  await updateAnnouncementEmbed(interaction.client as Client, tournament);

  await interaction.reply({ content: '✅ Basic information updated!', ephemeral: true });
}
