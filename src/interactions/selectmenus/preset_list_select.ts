import { StringSelectMenuInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import Preset from '../../database/models/Preset';

export async function execute(interaction: StringSelectMenuInteraction) {
  const presetId = interaction.values[0];
  const guildId = interaction.guildId;
  
  if (!presetId || !guildId) return;

  await interaction.deferUpdate();

  const preset = await Preset.findOne({ presetId, guildId }).lean();
  if (!preset) {
    return interaction.followUp({ content: 'Preset not found.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle(`Preset: ${preset.name}`)
    .setDescription(preset.description || 'No description provided.')
    .addFields(
      { name: 'Game', value: preset.gameName, inline: true },
      { name: 'Match Type', value: preset.matchType, inline: true },
      { name: 'Max Teams', value: preset.maxTeams.toString(), inline: true },
      { name: 'Stats', value: `Used ${preset.usageCount} times\nDefault: ${preset.isDefault ? 'Yes' : 'No'}\nFavorite: ${preset.isFavorite ? 'Yes' : 'No'}`, inline: false }
    )
    .setColor(preset.embedColor ? (preset.embedColor as any) : '#3498db')
    .setFooter({ text: `ID: ${preset.presetId}` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`preset_action_use_${presetId}`)
      .setLabel('Use Preset')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`preset_action_preview_${presetId}`)
      .setLabel('Full Preview')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`preset_action_edit_${presetId}`)
      .setLabel('Edit')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`preset_action_duplicate_${presetId}`)
      .setLabel('Duplicate')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`preset_action_delete_${presetId}`)
      .setLabel('Delete')
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({ content: null, embeds: [embed], components: [row] });
}
