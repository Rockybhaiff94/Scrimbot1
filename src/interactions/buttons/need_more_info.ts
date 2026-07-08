import { ButtonInteraction, TextChannel, EmbedBuilder } from 'discord.js';
import Ticket from '../../database/models/Ticket';

export const execute = async (interaction: ButtonInteraction) => {
  if (!interaction.memberPermissions?.has('ManageChannels')) {
    return await interaction.reply({
      content: '❌ You do not have permission to use this.',
      ephemeral: true,
    });
  }

  try {
    const channel = interaction.channel as TextChannel;
    const ticket = await Ticket.findOne({ channelId: channel.id, status: 'open' });

    if (!ticket) {
      return await interaction.reply({
        content: '❌ Could not find an open ticket for this channel.',
        ephemeral: true,
      });
    }

    ticket.status = 'pending_approval';
    await ticket.save();

    const embed = new EmbedBuilder()
      .setTitle('ℹ️ More Information Needed')
      .setDescription(
        `<@${ticket.userId}>, the admin needs more information to process your registration.\n\n` +
        'Please provide:\n' +
        '• A clearer payment screenshot\n' +
        '• Or any additional details requested by staff\n\n' +
        'Reply in this channel with the required information.'
      )
      .setColor('#f39c12');

    await interaction.reply({ embeds: [embed] });

    // DM the user
    try {
      const member = await interaction.guild?.members.fetch(ticket.userId);
      if (member) {
        const dmEmbed = new EmbedBuilder()
          .setTitle('ℹ️ Additional Information Required')
          .setDescription(
            `The staff in **${interaction.guild?.name}** needs more information for your registration.\n\n` +
            'Please check your ticket channel and provide the requested details.'
          )
          .setColor('#f39c12');
        await member.send({ embeds: [dmEmbed] });
      }
    } catch (e) {
      // DMs disabled
    }
  } catch (error) {
    console.error(error);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
    }
  }
};
