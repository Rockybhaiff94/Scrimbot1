import { CommandInteraction, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types/Command';
import User from '../database/models/User';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View a player\'s tournament profile')
    .addUserOption(option => option.setName('player').setDescription('The player to view (leave blank for yourself)').setRequired(false)),

  async execute(interaction: CommandInteraction) {
    const chatInteraction = interaction as ChatInputCommandInteraction;
    const targetUser = chatInteraction.options.getUser('player') || interaction.user;

    try {
      const dbUser = await User.findOne({ discordId: targetUser.id });

      if (!dbUser) {
        const msg = targetUser.id === interaction.user.id 
          ? "❌ You haven't registered for any tournaments yet!" 
          : `❌ **${targetUser.username}** hasn't registered for any tournaments.`;
        return await interaction.reply({ content: msg, ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(`👤 Tournament Profile: ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: 'In-Game Name (IGN)', value: dbUser.inGameName || 'N/A', inline: true },
          { name: 'UID', value: dbUser.uid || 'N/A', inline: true },
          { name: 'Team Name', value: dbUser.teamName || 'Solo', inline: true },
          { name: 'Registered At', value: `<t:${Math.floor(dbUser.registeredAt.getTime() / 1000)}:R>`, inline: false }
        )
        .setColor('#3498db');

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Failed to fetch player profile.', ephemeral: true });
    }
  },
};
