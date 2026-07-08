import { CommandInteraction, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { Command } from '../types/Command';
import User from '../database/models/User';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('room')
    .setDescription('Send Room ID and Password to all registered players via DM')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(option => option.setName('room_id').setDescription('The custom Room ID').setRequired(true))
    .addStringOption(option => option.setName('password').setDescription('The Room password').setRequired(true))
    .addStringOption(option => option.setName('map').setDescription('The map name (e.g. Erangel, Sanhok)').setRequired(false)),

  async execute(interaction: CommandInteraction) {
    const chatInteraction = interaction as ChatInputCommandInteraction;
    const roomId = chatInteraction.options.getString('room_id', true);
    const password = chatInteraction.options.getString('password', true);
    const map = chatInteraction.options.getString('map') || 'Not Specified';

    await interaction.deferReply({ ephemeral: false });

    try {
      const users = await User.find({});
      if (users.length === 0) {
        return await interaction.editReply({ content: '❌ No registered players found in the database.' });
      }

      const embed = new EmbedBuilder()
        .setTitle('🎮 Custom Room Details')
        .setDescription(`The custom room is now open! Please join immediately before the slots fill up.`)
        .addFields(
          { name: 'Room ID', value: `\`${roomId}\``, inline: true },
          { name: 'Password', value: `\`${password}\``, inline: true },
          { name: 'Map', value: `\`${map}\``, inline: false }
        )
        .setColor('#e67e22')
        .setFooter({ text: interaction.guild?.name || 'Tournament Room' });

      let successCount = 0;
      let failCount = 0;

      for (const user of users) {
        try {
          const member = await interaction.guild?.members.fetch(user.discordId);
          if (member) {
            await member.send({ embeds: [embed] });
            successCount++;
          } else {
            failCount++;
          }
        } catch (e) {
          failCount++;
        }
      }

      await interaction.editReply({ 
        content: `✅ Successfully sent Room ID and Password to **${successCount}** registered players. (Failed to send to ${failCount} users due to closed DMs or not in server).` 
      });

    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: 'An error occurred while fetching users or sending DMs.' });
    }
  },
};
