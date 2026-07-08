import { ButtonInteraction, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import Tournament from '../../database/models/Tournament';

export async function execute(interaction: ButtonInteraction) {
  const tournamentId = interaction.customId.replace('prize_yes_', '');
  const tournament = await Tournament.findOne({ tournamentId, guildId: interaction.guildId! });
  if (!tournament) return interaction.reply({ content: '❌ Tournament not found.', ephemeral: true });

  const modal = new ModalBuilder()
    .setCustomId(`prize_modal_${tournamentId}`)
    .setTitle('Configure Prize Distribution');

  const totalCollected = (tournament.approvedParticipants?.length || 0) * (tournament.registrationFee || 0);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('firstPlace').setLabel(`1st Place (Total Pool: ${totalCollected})`).setStyle(TextInputStyle.Short).setValue('').setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('secondPlace').setLabel('2nd Place').setStyle(TextInputStyle.Short).setValue('').setRequired(false)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('thirdPlace').setLabel('3rd Place').setStyle(TextInputStyle.Short).setValue('').setRequired(false)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('otherPrizes').setLabel('Other Prizes').setStyle(TextInputStyle.Paragraph).setValue('').setRequired(false)
    )
  );

  await interaction.showModal(modal);
}
