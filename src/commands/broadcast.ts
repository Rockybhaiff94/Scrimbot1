import { CommandInteraction, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, TextChannel } from 'discord.js';
import { Command } from '../types/Command';
import Settings from '../database/models/Settings';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('broadcast')
    .setDescription('Send an announcement to the configured announcement channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option => option.setName('title').setDescription('Title of the announcement').setRequired(true))
    .addStringOption(option => option.setName('message').setDescription('The message content').setRequired(true)),

  async execute(interaction: CommandInteraction) {
    const chatInteraction = interaction as ChatInputCommandInteraction;
    const guildId = interaction.guildId!;
    const title = chatInteraction.options.getString('title', true);
    const message = chatInteraction.options.getString('message', true);

    try {
      const settings = await Settings.findOne({ guildId });
      if (!settings || !settings.announcementChannelId) {
        return await interaction.reply({ content: '❌ Announcement channel is not configured! Use `/dashboard set_channel` first.', ephemeral: true });
      }

      const channel = interaction.guild?.channels.cache.get(settings.announcementChannelId) as TextChannel;
      if (!channel) {
        return await interaction.reply({ content: '❌ Configured announcement channel not found.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(`📢 ${title}`)
        .setDescription(message)
        .setColor('#9b59b6')
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      await interaction.reply({ content: `✅ Announcement sent to <#${channel.id}>!`, ephemeral: true });

    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Failed to send broadcast.', ephemeral: true });
    }
  },
};
