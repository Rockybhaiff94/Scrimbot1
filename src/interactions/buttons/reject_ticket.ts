import { ButtonInteraction, TextChannel, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import * as discordTranscripts from 'discord-html-transcripts';
import Ticket from '../../database/models/Ticket';
import Tournament from '../../database/models/Tournament';

export const execute = async (interaction: ButtonInteraction) => {
  if (!interaction.memberPermissions?.has('ManageChannels')) {
    return await interaction.reply({ content: '❌ You do not have permission to reject tickets.', ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const channel = interaction.channel as TextChannel;
    const ticket = await Ticket.findOne({ channelId: channel.id, status: { $in: ['open', 'pending_approval'] } });

    if (!ticket) {
      return await interaction.editReply({ content: '❌ Could not find an open ticket for this channel.' });
    }

    if (ticket.status === 'rejected') {
      return await interaction.editReply({ content: '⚠️ This ticket has already been rejected.' });
    }

    ticket.status = 'rejected';
    await ticket.save();

    // Get tournament name for DM
    let tournamentName = '';
    if (ticket.tournamentId) {
      const tournament = await Tournament.findOne({ tournamentId: ticket.tournamentId });
      if (tournament) tournamentName = tournament.name;
    }

    // Generate Transcript
    const transcript = await discordTranscripts.createTranscript(channel, {
      limit: -1,
      returnType: 'buffer' as any,
      filename: `${channel.name}-rejection-transcript.html`,
      saveImages: true,
      poweredBy: false,
    });

    // Send Transcript to Staff
    try {
      const attachment = new AttachmentBuilder(transcript as unknown as Buffer, {
        name: `${channel.name}-transcript.html`,
      });
      await interaction.user.send({
        content: `❌ You rejected **${channel.name}**. Transcript:`,
        files: [attachment],
      });
    } catch (e) { /* Staff DMs disabled */ }

    // DM the user
    try {
      const member = await interaction.guild?.members.fetch(ticket.userId);
      if (member) {
        const dmEmbed = new EmbedBuilder()
          .setTitle('❌ Registration Rejected')
          .setDescription(
            `Your registration in **${interaction.guild?.name}** was rejected.\n\n` +
            (tournamentName ? `**Tournament:** ${tournamentName}\n\n` : '') +
            'This could be due to an invalid screenshot or missing details.\nYou may try registering again.'
          )
          .setColor('#e74c3c')
          .setTimestamp();
        await member.send({ embeds: [dmEmbed] });
      }
    } catch (e) { /* User DMs disabled */ }

    await interaction.editReply({ content: '❌ Ticket rejected! Deleting channel in 10 seconds...' });

    setTimeout(async () => {
      try {
        await channel.delete('Ticket rejected and closed.');
      } catch (e) { /* Channel already deleted */ }
    }, 10000);
  } catch (error) {
    console.error(error);
    await interaction.editReply({ content: 'An error occurred while rejecting the ticket.' });
  }
};
