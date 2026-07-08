import { CommandInteraction, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, TextChannel } from 'discord.js';
import { Command } from '../types/Command';
import Settings from '../database/models/Settings';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Deploy the registration panel to the configured registration channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: CommandInteraction) {
    const guildId = interaction.guildId!;

    try {
      const settings = await Settings.findOne({ guildId });
      if (!settings || !settings.registrationChannelId) {
        return await interaction.reply({ content: '❌ Registration channel is not configured! Use `/dashboard set_channel` first.', ephemeral: true });
      }

      const channel = interaction.guild?.channels.cache.get(settings.registrationChannelId) as TextChannel;
      if (!channel) {
        return await interaction.reply({ content: '❌ Configured registration channel not found in the server.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle('🎮 Tournament Registration')
        .setDescription('Click the button below to start your registration and open a ticket.\n\nPlease have your **In-Game Name (IGN)**, **UID**, and **Team Name** ready!')
        .setColor('#e74c3c');

      const button = new ButtonBuilder()
        .setCustomId('register_button')
        .setLabel('Register Now')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

      await channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: `✅ Registration panel successfully deployed to <#${channel.id}>!`, ephemeral: true });

    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'An error occurred while setting up the panel.', ephemeral: true });
    }
  },
};
