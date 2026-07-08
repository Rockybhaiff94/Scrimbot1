import {
  ModalSubmitInteraction,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import User from '../../database/models/User';
import Ticket from '../../database/models/Ticket';
import Settings from '../../database/models/Settings';
import Tournament from '../../database/models/Tournament';
import { logger } from '../../utilities/logger';

export const execute = async (interaction: ModalSubmitInteraction) => {
  const ign = interaction.fields.getTextInputValue('ignInput');
  const uid = interaction.fields.getTextInputValue('uidInput');
  const teamName = interaction.fields.getTextInputValue('teamInput');
  const phone = interaction.fields.getTextInputValue('phoneInput') || '';
  const notes = interaction.fields.getTextInputValue('notesInput') || '';
  const discordId = interaction.user.id;
  const guildId = interaction.guildId!;

  // Extract tournament ID from modal custom ID
  let tournamentId: string | null = null;
  if (interaction.customId.startsWith('registration_modal_')) {
    tournamentId = interaction.customId.replace('registration_modal_', '');
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Duplicate Protection - check per tournament if tournament-specific
    if (tournamentId) {
      const existingTicket = await Ticket.findOne({
        userId: discordId,
        tournamentId,
        status: { $in: ['open', 'pending_approval', 'approved'] },
      });
      if (existingTicket) {
        return await interaction.editReply({
          content: '❌ You are already registered for this tournament!',
        });
      }

      // Check if slots are still available
      const tournament = await Tournament.findOne({ tournamentId });
      if (tournament) {
        const approvedCount = tournament.approvedParticipants?.length || 0;
        if (approvedCount >= tournament.maxTeams) {
          return await interaction.editReply({
            content: '❌ All slots are filled for this tournament.',
          });
        }
        if (tournament.status === 'registration_closed' || tournament.status === 'completed' || tournament.status === 'cancelled') {
          return await interaction.editReply({
            content: '❌ Registration for this tournament is closed.',
          });
        }
      }
    } else {
      // Legacy: check if user already registered globally
      const existingUser = await User.findOne({ discordId });
      if (existingUser) {
        return await interaction.editReply({ content: '❌ You are already registered!' });
      }
    }

    const settings = await Settings.findOne({ guildId });

    // Create Ticket Channel
    const ticketId = `ticket-${Math.floor(Math.random() * 90000) + 10000}`;
    const guild = interaction.guild!;

    const permissionOverwrites: any[] = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: discordId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
        ],
      },
    ];

    if (settings && settings.staffRoleId) {
      permissionOverwrites.push({
        id: settings.staffRoleId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      });
    }

    const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites,
      ...(settings?.ticketCategoryId && { parent: settings.ticketCategoryId }),
    });

    // Save User to database
    let dbUser = await User.findOne({ discordId });
    if (!dbUser) {
      dbUser = new User({ discordId, inGameName: ign, uid, teamName });
      await dbUser.save();
    }

    // Save Ticket
    const newTicket = new Ticket({
      ticketId,
      userId: discordId,
      channelId: ticketChannel.id,
      tournamentId: tournamentId || undefined,
      type: 'registration',
      status: 'open',
    });
    await newTicket.save();

    // Build ticket embed with payment instructions
    let tournament = null;
    if (tournamentId) {
      tournament = await Tournament.findOne({ tournamentId });
    }

    const currencySymbol = getCurrencySymbol(tournament?.currency || 'INR');
    const fee = tournament?.registrationFee || 0;

    const embed = new EmbedBuilder()
      .setTitle('📝 Registration Ticket')
      .setColor('#f1c40f')
      .setDescription(
        `Welcome <@${discordId}>!\n\n` +
        (tournament ? `**Tournament:** ${tournament.name}\n` : '') +
        `**Team:** ${teamName}\n**IGN:** ${ign}\n**UID:** ${uid}\n` +
        (phone ? `**Phone:** ${phone}\n` : '') +
        (notes ? `**Notes:** ${notes}\n` : '')
      );

    // Payment section
    if (fee > 0) {
      embed.addFields({
        name: '💰 Registration Fee',
        value: `**${currencySymbol}${fee}**`,
        inline: true,
      });
    }

    const upiId = tournament?.paymentDetails?.upiId || settings?.upiId;
    const paymentMethod = tournament?.paymentDetails?.instructions || settings?.paymentMethod;
    const paymentQrUrl = tournament?.paymentDetails?.qrCodeUrl || settings?.paymentQrUrl;

    if (upiId) {
      embed.addFields({ name: 'UPI ID', value: `\`${upiId}\``, inline: true });
    }

    if (paymentMethod) {
      embed.addFields({ name: 'Payment Instructions', value: paymentMethod });
    }

    if (fee > 0) {
      embed.addFields({
        name: '📋 Steps',
        value:
          '1. Complete payment using the details above\n' +
          '2. Upload your payment screenshot here\n' +
          '3. Wait for admin verification',
      });
    } else {
      embed.addFields({
        name: '📋 Next Step',
        value: 'Your registration is being reviewed. An admin will approve it shortly.',
      });
    }

    // Admin buttons
    const approveBtn = new ButtonBuilder()
      .setCustomId('approve_ticket')
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success);
    const rejectBtn = new ButtonBuilder()
      .setCustomId('reject_ticket')
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger);
    const infoBtn = new ButtonBuilder()
      .setCustomId('need_more_info')
      .setLabel('Need More Info')
      .setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveBtn, rejectBtn, infoBtn);

    // Send QR code if available
    const embeds = [embed];
    if (paymentQrUrl && fee > 0) {
      const qrEmbed = new EmbedBuilder()
        .setTitle('📱 Scan QR Code to Pay')
        .setImage(paymentQrUrl)
        .setColor('#27ae60');
      embeds.push(qrEmbed);
    }

    await ticketChannel.send({ content: `<@${discordId}>`, embeds, components: [row] });

    await interaction.editReply({
      content: `✅ Registration submitted! Your ticket: <#${ticketChannel.id}>`,
    });

    // Send DM confirmation
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle('📨 Registration Received')
        .setDescription(
          `Your registration has been submitted successfully!\n\n` +
          (tournament ? `**Tournament:** ${tournament.name}\n` : '') +
          `**IGN:** ${ign}\n**UID:** ${uid}\n\n` +
          (fee > 0 ? 'Please complete your payment in the ticket channel.' : 'An admin will review your registration shortly.')
        )
        .setColor('#3498db')
        .setTimestamp();
      await interaction.user.send({ embeds: [dmEmbed] });
    } catch (e) {
      // DMs disabled
    }

    // Log the registration
    await logEvent(guild, settings, 'Registration Submitted', `<@${discordId}> registered for ${tournament?.name || 'tournament'}`);

    logger.info(`Registration: ${interaction.user.tag} for tournament ${tournamentId || 'global'}`);
  } catch (error) {
    logger.error('Registration modal error:', error);
    await interaction.editReply({ content: '❌ An error occurred while processing your registration.' });
  }
};

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  return symbols[currency] || currency + ' ';
}

async function logEvent(guild: any, settings: any, title: string, description: string) {
  try {
    if (!settings?.logChannelId) return;
    const logChannel = guild.channels.cache.get(settings.logChannelId);
    if (!logChannel) return;
    const embed = new EmbedBuilder()
      .setTitle(`📋 ${title}`)
      .setDescription(description)
      .setColor('#9b59b6')
      .setTimestamp();
    await logChannel.send({ embeds: [embed] });
  } catch (e) {
    // silent fail
  }
}
