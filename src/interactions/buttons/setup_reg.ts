import { ButtonInteraction, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import Tournament from '../../database/models/Tournament';

export async function execute(interaction: ButtonInteraction) {
  const tournamentId = interaction.customId.replace('setup_reg_', '');
  const tournament = await Tournament.findOne({ tournamentId, guildId: interaction.guildId! });
  if (!tournament) return interaction.reply({ content: '❌ Tournament not found.', ephemeral: true });

  const modal = new ModalBuilder()
    .setCustomId(`setup_reg_modal_${tournamentId}`)
    .setTitle('Registration Information');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('maxTeams').setLabel('Total Slots').setStyle(TextInputStyle.Short).setValue(tournament.maxTeams?.toString() || '100').setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('registrationFee').setLabel('Registration Fee').setStyle(TextInputStyle.Short).setValue(tournament.registrationFee?.toString() || '0').setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('currency').setLabel('Currency (INR/USD/EUR/GBP)').setStyle(TextInputStyle.Short).setValue(tournament.currency || 'INR').setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('waitlistEnabled').setLabel('Enable Waitlist? (true/false)').setStyle(TextInputStyle.Short).setValue(tournament.waitlistEnabled ? 'true' : 'false').setRequired(false)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('reservedSlots').setLabel('Reserved Slots').setStyle(TextInputStyle.Short).setValue(tournament.reservedSlots?.toString() || '0').setRequired(false)
    )
  );

  await interaction.showModal(modal);
}
