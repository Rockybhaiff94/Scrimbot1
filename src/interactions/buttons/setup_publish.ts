import { ButtonInteraction, ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, EmbedBuilder } from 'discord.js';
import Tournament from '../../database/models/Tournament';

export async function execute(interaction: ButtonInteraction) {
  const tournamentId = interaction.customId.replace('setup_publish_', '');
  const tournament = await Tournament.findOne({ tournamentId, guildId: interaction.guildId! });
  if (!tournament) return interaction.reply({ content: '❌ Tournament not found.', ephemeral: true });

  const selectMenu = new ChannelSelectMenuBuilder()
    .setCustomId(`publish_channel_select_${tournamentId}`)
    .setPlaceholder('Select announcement channel')
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

  const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectMenu);

  const embed = new EmbedBuilder()
    .setTitle('📢 Publish Tournament')
    .setDescription('Select the channel where you want to publish the live tournament embed.')
    .setColor('#3498db');

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}
