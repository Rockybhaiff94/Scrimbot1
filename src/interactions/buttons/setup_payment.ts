import { ButtonInteraction, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import Tournament from '../../database/models/Tournament';

export async function execute(interaction: ButtonInteraction) {
  const tournamentId = interaction.customId.replace('setup_payment_', '');
  const tournament = await Tournament.findOne({ tournamentId, guildId: interaction.guildId! });
  if (!tournament) return interaction.reply({ content: '❌ Tournament not found.', ephemeral: true });

  const modal = new ModalBuilder()
    .setCustomId(`setup_payment_modal_${tournamentId}`)
    .setTitle('Payment Configuration');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('upiId').setLabel('UPI ID').setStyle(TextInputStyle.Short).setValue(tournament.paymentDetails?.upiId || '').setRequired(false)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('qrCodeUrl').setLabel('QR Code Image URL').setStyle(TextInputStyle.Short).setValue(tournament.paymentDetails?.qrCodeUrl || '').setRequired(false)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('instructions').setLabel('Payment Instructions').setStyle(TextInputStyle.Paragraph).setValue(tournament.paymentDetails?.instructions || 'Complete payment and upload screenshot.').setRequired(false)
    )
  );

  await interaction.showModal(modal);
}
