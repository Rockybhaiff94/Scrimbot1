import { ModalSubmitInteraction, Client } from 'discord.js';
import Tournament from '../../database/models/Tournament';
import { updateAnnouncementEmbed } from '../../jobs/tournamentScheduler';

export async function execute(interaction: ModalSubmitInteraction) {
  const tournamentId = interaction.customId.replace('prize_modal_', '');
  const tournament = await Tournament.findOne({ tournamentId, guildId: interaction.guildId! });
  if (!tournament) return interaction.reply({ content: '❌ Tournament not found.', ephemeral: true });

  const firstPlace = interaction.fields.getTextInputValue('firstPlace');
  
  let secondPlace = '';
  try { secondPlace = interaction.fields.getTextInputValue('secondPlace'); } catch (e) {}
  
  let thirdPlace = '';
  try { thirdPlace = interaction.fields.getTextInputValue('thirdPlace'); } catch (e) {}
  
  let otherPrizes = '';
  try { otherPrizes = interaction.fields.getTextInputValue('otherPrizes'); } catch (e) {}

  const currencySymbol = tournament.currency === 'INR' ? '₹' : (tournament.currency === 'USD' ? '$' : tournament.currency);
  
  let prizeDistribution = `🥇 1st Place: ${currencySymbol}${firstPlace}\n`;
  if (secondPlace) prizeDistribution += `🥈 2nd Place: ${currencySymbol}${secondPlace}\n`;
  if (thirdPlace) prizeDistribution += `🥉 3rd Place: ${currencySymbol}${thirdPlace}\n`;
  if (otherPrizes) prizeDistribution += `\n**Other Prizes:**\n${otherPrizes}`;

  tournament.prizePool = prizeDistribution;
  tournament.prizeEnabled = true;
  await tournament.save();
  await updateAnnouncementEmbed(interaction.client as Client, tournament);

  const channel = interaction.channel;
  if (channel && channel.isTextBased() && 'messages' in channel) {
    try {
      if (interaction.message) {
        await interaction.message.edit({ content: '✅ Prize distribution configured successfully!', embeds: [], components: [] });
      }
    } catch (e) {
      // Ignored
    }
  }

  await interaction.reply({ content: '✅ Prize distribution updated on the live embed.', ephemeral: true });
}
