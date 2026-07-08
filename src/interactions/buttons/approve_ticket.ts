import { ButtonInteraction, TextChannel, EmbedBuilder, AttachmentBuilder, Client } from 'discord.js';
import * as discordTranscripts from 'discord-html-transcripts';
import Ticket from '../../database/models/Ticket';
import Tournament from '../../database/models/Tournament';
import { updateAnnouncementEmbed } from '../../jobs/tournamentScheduler';

export const execute = async (interaction: ButtonInteraction) => {
  if (!interaction.memberPermissions?.has('ManageChannels')) {
    return await interaction.reply({ content: '❌ You do not have permission to approve tickets.', ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const channel = interaction.channel as TextChannel;
    const ticket = await Ticket.findOne({ channelId: channel.id, status: { $in: ['open', 'pending_approval'] } });

    if (!ticket) {
      return await interaction.editReply({ content: '❌ Could not find an open ticket in the database for this channel.' });
    }

    // Prevent double approval
    if (ticket.status === 'approved') {
      return await interaction.editReply({ content: '⚠️ This ticket has already been approved.' });
    }

    ticket.status = 'approved';
    await ticket.save();

    // Add user to tournament's approved participants
    let tournament = null;
    if (ticket.tournamentId) {
      tournament = await Tournament.findOneAndUpdate(
        { tournamentId: ticket.tournamentId },
        {
          $addToSet: { approvedParticipants: ticket.userId },
          $inc: { registeredTeams: 1 },
        },
        { new: true }
      );

      // Update the live announcement embed
      if (tournament) {
        await updateAnnouncementEmbed(interaction.client as Client, tournament);
      }
    }

    // Generate Transcript before deleting
    const transcript = await discordTranscripts.createTranscript(channel, {
      limit: -1,
      returnType: 'buffer' as any,
      filename: `${channel.name}-transcript.html`,
      saveImages: true,
      poweredBy: false,
    });

    // Send Transcript to Staff
    try {
      const transcriptAttachment = new AttachmentBuilder(transcript as unknown as Buffer, {
        name: `${channel.name}-transcript.html`,
      });
      await interaction.user.send({
        content: `✅ You approved **${channel.name}**. Transcript:`,
        files: [transcriptAttachment],
      });
    } catch (e) {
      // Staff DMs disabled
    }

    // DM the user - approval confirmation
    try {
      const member = await interaction.guild?.members.fetch(ticket.userId);
      if (member) {
        const dmEmbed = new EmbedBuilder()
          .setTitle('✅ Registration Approved!')
          .setDescription(
            `Your registration in **${interaction.guild?.name}** has been approved!\n\n` +
            (tournament ? `**Tournament:** ${tournament.name}\n` : '') +
            'Keep an eye on your DMs for room details before the match.'
          )
          .setColor('#2ecc71')
          .setTimestamp();
        await member.send({ embeds: [dmEmbed] });
      }
    } catch (e) {
      // User DMs disabled
    }

    const approvedCount = tournament?.approvedParticipants?.length || '?';
    const maxSlots = tournament?.maxTeams || '?';
    await interaction.editReply({
      content: `✅ Ticket approved! (${approvedCount}/${maxSlots} slots filled) Deleting channel in 10s...`,
    });

    setTimeout(async () => {
      try {
        await channel.delete('Ticket approved and closed.');
      } catch (e) {
        // Channel already deleted or no permission
      }
    }, 10000);
  } catch (error) {
    console.error(error);
    await interaction.editReply({ content: 'An error occurred while approving the ticket.' });
  }
};
