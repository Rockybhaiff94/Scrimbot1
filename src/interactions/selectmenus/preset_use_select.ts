import { StringSelectMenuInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export async function execute(interaction: StringSelectMenuInteraction) {
  const presetId = interaction.values[0];
  
  if (!presetId) {
    return interaction.reply({ content: 'Invalid preset selection.', ephemeral: true });
  }

  // Open a modal to get volatile data (Date, Time, Room ID)
  const modal = new ModalBuilder()
    .setCustomId(`quick_match_modal_${presetId}`)
    .setTitle(`Use Preset`);

  const dateInput = new TextInputBuilder()
    .setCustomId('match_date')
    .setLabel('Tournament Date & Time')
    .setPlaceholder('e.g., Today at 8 PM, or YYYY-MM-DD HH:MM')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const roomIdInput = new TextInputBuilder()
    .setCustomId('room_id')
    .setLabel('Room ID (Optional)')
    .setPlaceholder('Leave blank if creating later')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const roomPassInput = new TextInputBuilder()
    .setCustomId('room_password')
    .setLabel('Room Password (Optional)')
    .setPlaceholder('Leave blank if creating later')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(roomIdInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(roomPassInput)
  );

  await interaction.showModal(modal);
}
