import { ModalSubmitInteraction, Client } from 'discord.js';
import Tournament from '../../database/models/Tournament';
import { updateAnnouncementEmbed } from '../../jobs/tournamentScheduler';

export async function execute(interaction: ModalSubmitInteraction) {
  const tournamentId = interaction.customId.replace('setup_reg_modal_', '');
  const tournament = await Tournament.findOne({ tournamentId, guildId: interaction.guildId! });
  if (!tournament) return interaction.reply({ content: '❌ Tournament not found.', ephemeral: true });

  const maxTeams = parseInt(interaction.fields.getTextInputValue('maxTeams'));
  if (!isNaN(maxTeams)) tournament.maxTeams = maxTeams;

  const registrationFee = parseFloat(interaction.fields.getTextInputValue('registrationFee'));
  if (!isNaN(registrationFee)) tournament.registrationFee = registrationFee;

  tournament.currency = interaction.fields.getTextInputValue('currency');

  try {
    const waitlist = interaction.fields.getTextInputValue('waitlistEnabled').toLowerCase();
    tournament.waitlistEnabled = waitlist === 'true' || waitlist === 'yes';
  } catch (e) { /* optional field */ }

  try {
    const reserved = parseInt(interaction.fields.getTextInputValue('reservedSlots'));
    if (!isNaN(reserved)) tournament.reservedSlots = reserved;
  } catch (e) { /* optional field */ }

  await tournament.save();
  await updateAnnouncementEmbed(interaction.client as Client, tournament);

  await interaction.reply({ content: '✅ Registration information updated!', ephemeral: true });
}
