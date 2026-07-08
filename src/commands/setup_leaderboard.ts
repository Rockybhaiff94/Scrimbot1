import { CommandInteraction, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, TextChannel } from 'discord.js';
import { Command } from '../types/Command';
import Leaderboard from '../database/models/Leaderboard';
import Tournament from '../database/models/Tournament';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup_leaderboard')
    .setDescription('Deploy a live updating tournaments leaderboard in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: CommandInteraction) {
    const guildId = interaction.guildId!;
    const channel = interaction.channel as TextChannel;

    await interaction.deferReply({ ephemeral: true });

    try {
      const embed = new EmbedBuilder()
        .setTitle('🔴 LIVE: Tournaments Leaderboard')
        .setDescription('Fetching latest tournament data...')
        .setColor('#3498db')
        .setTimestamp();

      const message = await channel.send({ embeds: [embed] });

      // Save or update in DB
      let leaderboard = await Leaderboard.findOne({ guildId });
      if (leaderboard) {
        leaderboard.channelId = channel.id;
        leaderboard.messageId = message.id;
      } else {
        leaderboard = new Leaderboard({ guildId, channelId: channel.id, messageId: message.id });
      }
      await leaderboard.save();

      await interaction.editReply({ content: '✅ Live Leaderboard successfully deployed! It will automatically update every minute.' });

    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: '❌ Failed to deploy the live leaderboard.' });
    }
  },
};
