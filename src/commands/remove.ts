import { CommandInteraction, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { Command } from '../types/Command';
import User from '../database/models/User';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Forcefully remove a player from the tournament registration database')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addUserOption(option => 
      option.setName('player')
        .setDescription('The player to remove')
        .setRequired(true)
    ),

  async execute(interaction: CommandInteraction) {
    const chatInteraction = interaction as ChatInputCommandInteraction;
    const targetUser = chatInteraction.options.getUser('player', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      const deletedUser = await User.findOneAndDelete({ discordId: targetUser.id });

      if (!deletedUser) {
        return await interaction.editReply({ content: `❌ **${targetUser.username}** is not registered in the database.` });
      }

      await interaction.editReply({ content: `✅ Successfully removed **${targetUser.username}** (IGN: ${deletedUser.inGameName}) from the tournament registration database.` });

    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: '❌ Failed to remove player from the database due to an error.' });
    }
  },
};
