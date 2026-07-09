import { ModalSubmitInteraction, EmbedBuilder } from 'discord.js';
import { PresetService } from '../../services/PresetService';

function parseCustomDate(dateStr: string): Date {
  // Very basic parser just as a placeholder since real NLP dates require complex parsing.
  // In a real scenario, you'd use chrono-node or something.
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date(); // Fallback to now if invalid
  return d;
}

export async function execute(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const customId = interaction.customId; // quick_match_modal_PRESET-ID
  const presetId = customId.replace('quick_match_modal_', '');
  const guildId = interaction.guildId;

  if (!guildId) return interaction.editReply('This can only be used in a server.');

  const dateStr = interaction.fields.getTextInputValue('match_date');
  let roomId, roomPassword;
  
  try {
    roomId = interaction.fields.getTextInputValue('room_id');
    roomPassword = interaction.fields.getTextInputValue('room_password');
  } catch (e) {
    // Optional fields might throw if not provided
  }

  const matchDate = parseCustomDate(dateStr);
  const volatileData: any = { matchDate };
  
  if (roomId || roomPassword) {
    volatileData.roomCredentials = {
      roomId: roomId || '',
      password: roomPassword || '',
      sentAt: new Date()
    };
  }

  const tournament = await PresetService.applyPresetToTournament(presetId, guildId, volatileData);

  if (!tournament) {
    return interaction.editReply({ content: `Failed to load preset **${presetId}**. It may have been deleted.` });
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ Tournament Created from Preset!')
    .setDescription(`Successfully created **${tournament.name}** (ID: \`${tournament.tournamentId}\`)!`)
    .addFields(
      { name: 'Preset Used', value: presetId, inline: true },
      { name: 'Scheduled For', value: `<t:${Math.floor(matchDate.getTime() / 1000)}:F>`, inline: true }
    )
    .setColor('#2ecc71');

  await interaction.editReply({ embeds: [embed] });
}
