import { ChannelSelectMenuInteraction, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import Tournament from '../../database/models/Tournament';
import { buildTournamentEmbed } from '../../jobs/tournamentScheduler';

export async function execute(interaction: ChannelSelectMenuInteraction) {
  const tournamentId = interaction.customId.replace('publish_channel_select_', '');
  const tournament = await Tournament.findOne({ tournamentId, guildId: interaction.guildId! });
  if (!tournament) return interaction.reply({ content: '❌ Tournament not found.', ephemeral: true });

  const selectedChannelId = interaction.values[0];
  const channel = interaction.guild?.channels.cache.get(selectedChannelId) as TextChannel;
  if (!channel) return interaction.reply({ content: '❌ Selected channel not found or inaccessible.', ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  try {
    const embed = buildTournamentEmbed(tournament);
    
    const registerBtn = new ButtonBuilder()
      .setCustomId(`register_button_${tournament.tournamentId}`)
      .setLabel('Register')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Primary);

    const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(registerBtn);

    const message = await channel.send({ embeds: [embed], components: [btnRow] });

    tournament.announcementMessageId = message.id;
    tournament.announcementChannelId = channel.id;
    tournament.status = 'registration_open';
    await tournament.save();

    await interaction.editReply({ content: `✅ Tournament successfully published in <#${channel.id}>! Registration is now open.` });
  } catch (error) {
    console.error('Publish error:', error);
    await interaction.editReply({ content: '❌ Failed to publish tournament. Check bot permissions in that channel.' });
  }
}
