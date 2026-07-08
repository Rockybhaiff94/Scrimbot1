import { ModalSubmitInteraction, Client } from 'discord.js';
import Tournament from '../../database/models/Tournament';
import { updateAnnouncementEmbed } from '../../jobs/tournamentScheduler';

export async function execute(interaction: ModalSubmitInteraction) {
  const tournamentId = interaction.customId.replace('setup_visuals_modal_', '');
  const tournament = await Tournament.findOne({ tournamentId, guildId: interaction.guildId! });
  if (!tournament) return interaction.reply({ content: '❌ Tournament not found.', ephemeral: true });

  const fields = ['embedColor', 'embedThumbnail', 'embedBanner', 'embedFooter', 'notes'];
  
  for (const field of fields) {
    try {
      const val = interaction.fields.getTextInputValue(field);
      if (val !== undefined) {
        (tournament as any)[field] = val;
      }
    } catch (e) { /* optional field */ }
  }

  await tournament.save();
  await updateAnnouncementEmbed(interaction.client as Client, tournament);

  await interaction.reply({ content: '✅ Visuals updated!', ephemeral: true });
}
