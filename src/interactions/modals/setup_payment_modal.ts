import { ModalSubmitInteraction } from 'discord.js';
import Tournament from '../../database/models/Tournament';

export async function execute(interaction: ModalSubmitInteraction) {
  const tournamentId = interaction.customId.replace('setup_payment_modal_', '');
  const tournament = await Tournament.findOne({ tournamentId, guildId: interaction.guildId! });
  if (!tournament) return interaction.reply({ content: '❌ Tournament not found.', ephemeral: true });

  const upiId = interaction.fields.getTextInputValue('upiId');
  const qrCodeUrl = interaction.fields.getTextInputValue('qrCodeUrl');
  const instructions = interaction.fields.getTextInputValue('instructions');

  tournament.paymentDetails = { upiId, qrCodeUrl, instructions };
  await tournament.save();

  await interaction.reply({ content: '✅ Payment information updated!', ephemeral: true });
}
