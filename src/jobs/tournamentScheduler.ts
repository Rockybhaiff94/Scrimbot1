import cron from 'node-cron';
import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import Tournament from '../database/models/Tournament';
import Settings from '../database/models/Settings';
import { logger } from '../utilities/logger';

export const startTournamentScheduler = (client: Client) => {
  // Run every minute - check for auto-close and reminders
  cron.schedule('* * * * *', async () => {
    try {
      await checkAutoClose(client);
      await checkReminders(client);
    } catch (error) {
      logger.error('Tournament scheduler error:', error);
    }
  });

  logger.info('[Jobs] Tournament scheduler started (auto-close + reminders).');
};

// ─── AUTO-CLOSE REGISTRATION ─────────────────────────────────────────
async function checkAutoClose(client: Client) {
  const now = new Date();

  // Find tournaments that should be auto-closed (registration time expired)
  const expiredTournaments = await Tournament.find({
    status: 'registration_open',
    registrationCloseTime: { $lte: now },
  });

  for (const tournament of expiredTournaments) {
    tournament.status = 'registration_closed';
    await tournament.save();

    // Update the live announcement embed if it exists
    await updateAnnouncementEmbed(client, tournament);

    // Prompt admin for prizes
    await promptForPrizes(client, tournament);

    // Log the event
    await logToChannel(client, tournament.guildId, 'Registration Auto-Closed',
      `**${tournament.name}** (\`${tournament.tournamentId}\`) — Timer expired.`);

    logger.info(`Auto-closed registration: ${tournament.name} (${tournament.tournamentId})`);
  }

  // Also check for tournaments that are full
  const fullTournaments = await Tournament.find({
    status: 'registration_open',
  });

  for (const tournament of fullTournaments) {
    const approvedCount = tournament.approvedParticipants?.length || 0;
    if (approvedCount >= tournament.maxTeams) {
      tournament.status = 'registration_closed';
      await tournament.save();
      await updateAnnouncementEmbed(client, tournament);
      
      await promptForPrizes(client, tournament);
      
      await logToChannel(client, tournament.guildId, 'Registration Auto-Closed',
        `**${tournament.name}** (\`${tournament.tournamentId}\`) — All slots filled.`);
      logger.info(`Auto-closed (full): ${tournament.name}`);
    }
  }
}

async function promptForPrizes(client: Client, tournament: any) {
  if (tournament.prizeEnabled) return;
  
  const guild = client.guilds.cache.get(tournament.guildId);
  if (!guild || !tournament.createdBy) return;
  
  try {
    const admin = await guild.members.fetch(tournament.createdBy);
    if (admin) {
      const embed = new EmbedBuilder()
        .setTitle('💰 Configure Prizes?')
        .setDescription(`**${tournament.name}** has closed registration.\nWould you like to configure the prize distribution now?`)
        .setColor('#f39c12');
      const yesBtn = new ButtonBuilder().setCustomId(`prize_yes_${tournament.tournamentId}`).setLabel('Yes').setStyle(ButtonStyle.Success);
      const skipBtn = new ButtonBuilder().setCustomId(`prize_skip_${tournament.tournamentId}`).setLabel('Skip').setStyle(ButtonStyle.Secondary);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(yesBtn, skipBtn);
      
      await admin.send({ embeds: [embed], components: [row] });
    }
  } catch (e) {
    // DMs might be closed, try sending to the preview channel
    if (tournament.previewChannelId) {
      const channel = guild.channels.cache.get(tournament.previewChannelId) as TextChannel;
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('💰 Configure Prizes?')
          .setDescription(`Registration closed. Would you like to configure the prize distribution now?`)
          .setColor('#f39c12');
        const yesBtn = new ButtonBuilder().setCustomId(`prize_yes_${tournament.tournamentId}`).setLabel('Yes').setStyle(ButtonStyle.Success);
        const skipBtn = new ButtonBuilder().setCustomId(`prize_skip_${tournament.tournamentId}`).setLabel('Skip').setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(yesBtn, skipBtn);
        
        await channel.send({ content: `<@${tournament.createdBy}>`, embeds: [embed], components: [row] }).catch(() => null);
      }
    }
  }
}

// ─── REMINDERS ───────────────────────────────────────────────────────
async function checkReminders(client: Client) {
  const now = new Date();

  const tournaments = await Tournament.find({
    status: { $in: ['registration_closed', 'upcoming', 'registration_open'] },
    matchDate: { $exists: true, $ne: null },
    'reminderSettings.enabled': true,
  });

  for (const tournament of tournaments) {
    if (!tournament.matchDate || !tournament.reminderSettings?.intervals) continue;

    const matchTime = tournament.matchDate.getTime();
    const minutesUntilMatch = (matchTime - now.getTime()) / 60000;

    for (const interval of tournament.reminderSettings.intervals) {
      // Check if this reminder should fire (within 1 minute window)
      if (minutesUntilMatch <= interval && minutesUntilMatch > interval - 1) {
        // Check if already sent
        if (tournament.remindersSent?.includes(interval)) continue;

        // Send reminders to all approved participants
        await sendReminders(client, tournament, interval);

        // Mark as sent
        tournament.remindersSent = [...(tournament.remindersSent || []), interval];
        await tournament.save();
      }
    }

    // Admin reminder: 60 minutes before match
    if (minutesUntilMatch <= 60 && minutesUntilMatch > 59) {
      if (!tournament.remindersSent?.includes(9999)) {
        await sendAdminReminder(client, tournament);
        tournament.remindersSent = [...(tournament.remindersSent || []), 9999];
        await tournament.save();
      }
    }
  }
}

async function sendReminders(client: Client, tournament: any, minutesBefore: number) {
  const guild = client.guilds.cache.get(tournament.guildId);
  if (!guild) return;

  const embed = new EmbedBuilder()
    .setTitle('⏰ Tournament Reminder')
    .setDescription(
      `Your match begins in **${minutesBefore} minutes**!\n\n` +
      `**Tournament:** ${tournament.name}\n` +
      `**Game:** ${tournament.gameName}\n\n` +
      'Room ID and Password will be sent shortly.\nPlease stay online.'
    )
    .setColor('#e74c3c')
    .setTimestamp();

  let sent = 0;
  for (const userId of tournament.approvedParticipants || []) {
    try {
      const member = await guild.members.fetch(userId);
      if (member) {
        await member.send({ embeds: [embed] });
        sent++;
      }
    } catch (e) {
      // DMs disabled - continue
    }
    // Rate limit protection
    await new Promise(r => setTimeout(r, 500));
  }

  logger.info(`Sent ${minutesBefore}min reminder to ${sent} users for ${tournament.name}`);
}

async function sendAdminReminder(client: Client, tournament: any) {
  const guild = client.guilds.cache.get(tournament.guildId);
  if (!guild || !tournament.createdBy) return;

  try {
    const admin = await guild.members.fetch(tournament.createdBy);
    if (admin) {
      const embed = new EmbedBuilder()
        .setTitle('🔔 Admin Reminder')
        .setDescription(
          `**${tournament.name}** starts in approximately **1 hour**!\n\n` +
          `• Approved Players: ${tournament.approvedParticipants?.length || 0}\n` +
          `• Make sure to release Room ID & Password using \`/match idpass\``
        )
        .setColor('#e67e22')
        .setTimestamp();
      await admin.send({ embeds: [embed] });
    }
  } catch (e) {
    // DMs disabled
  }
}

// ─── UPDATE ANNOUNCEMENT EMBED ───────────────────────────────────────
export async function updateAnnouncementEmbed(client: Client, tournament: any) {
  try {
    const guild = client.guilds.cache.get(tournament.guildId);
    if (!guild) return;

    const embed = buildTournamentEmbed(tournament);

    if (tournament.announcementChannelId && tournament.announcementMessageId) {
      const channel = guild.channels.cache.get(tournament.announcementChannelId) as TextChannel;
      if (channel) {
        const message = await channel.messages.fetch(tournament.announcementMessageId).catch(() => null);
        if (message) await message.edit({ embeds: [embed] });
      }
    }

    if (tournament.previewChannelId && tournament.previewMessageId) {
      const previewChannel = guild.channels.cache.get(tournament.previewChannelId) as TextChannel;
      if (previewChannel) {
        const previewMessage = await previewChannel.messages.fetch(tournament.previewMessageId).catch(() => null);
        if (previewMessage) await previewMessage.edit({ embeds: [embed] });
      }
    }
  } catch (err) {
    logger.warn(`Failed to update embeds for ${tournament.tournamentId}: ${err}`);
  }
}

// ─── BUILD TOURNAMENT EMBED (Public) ─────────────────────────────────
export function buildTournamentEmbed(tournament: any): EmbedBuilder {
  const currencySymbol = getCurrencySymbol(tournament.currency || 'INR');
  const approvedCount = tournament.approvedParticipants?.length || 0;
  const available = tournament.maxTeams - approvedCount;
  const collectedAmount = approvedCount * (tournament.registrationFee || 0);

  const statusEmoji: Record<string, string> = {
    upcoming: '🟡', registration_open: '🟢', registration_closed: '🔴',
    ongoing: '🔥', completed: '🏁', cancelled: '🚫',
  };

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${tournament.name}`)
    .setColor((tournament.embedColor || '#e74c3c') as any)
    .addFields(
      { name: 'Game', value: tournament.gameName || 'Free Fire', inline: true },
      { name: 'Type', value: (tournament.matchType || 'squad').charAt(0).toUpperCase() + (tournament.matchType || 'squad').slice(1), inline: true },
      { name: 'Status', value: `${statusEmoji[tournament.status] || '⚪'} ${formatStatus(tournament.status)}`, inline: true },
      { name: 'Registered', value: `${approvedCount} / ${tournament.maxTeams}`, inline: true },
      { name: 'Available', value: `${available}`, inline: true },
      { name: 'Fee', value: tournament.registrationFee > 0 ? `${currencySymbol}${tournament.registrationFee}` : 'Free', inline: true },
    );

  if (tournament.registrationFee > 0) {
    embed.addFields({ name: 'Collected', value: `${currencySymbol}${collectedAmount}`, inline: true });
  }

  if (tournament.prizePool) {
    embed.addFields({ name: 'Prize Pool', value: tournament.prizePool, inline: true });
  }

  if (tournament.description) {
    embed.setDescription(tournament.description);
  }

  if (tournament.rules) {
    embed.addFields({ name: '📜 Rules', value: tournament.rules.substring(0, 1024) });
  }

  if (tournament.notes) {
    embed.addFields({ name: '📝 Notes', value: tournament.notes.substring(0, 1024) });
  }

  // Countdown
  if (tournament.registrationCloseTime && tournament.status === 'registration_open') {
    const closeTime = Math.floor(new Date(tournament.registrationCloseTime).getTime() / 1000);
    embed.addFields({
      name: '⏰ Registration Ends',
      value: `<t:${closeTime}:R>`,
      inline: true,
    });
  }

  if (tournament.matchDate) {
    const matchTime = Math.floor(new Date(tournament.matchDate).getTime() / 1000);
    embed.addFields({ name: '📅 Match Date', value: `<t:${matchTime}:F>`, inline: true });
  }

  if (tournament.organizerName) {
    embed.addFields({ name: 'Organizer', value: tournament.organizerName, inline: true });
  }

  if (tournament.embedThumbnail) embed.setThumbnail(tournament.embedThumbnail);
  if (tournament.embedBanner) embed.setImage(tournament.embedBanner);
  if (tournament.embedFooter) {
    embed.setFooter({ text: tournament.embedFooter });
  } else {
    embed.setFooter({ text: `ID: ${tournament.tournamentId}` });
  }

  embed.setTimestamp();
  return embed;
}

// ─── LOG TO CHANNEL ──────────────────────────────────────────────────
async function logToChannel(client: Client, guildId: string, title: string, description: string) {
  try {
    const settings = await Settings.findOne({ guildId });
    if (!settings?.logChannelId) return;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(settings.logChannelId) as TextChannel;
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(`📋 ${title}`)
      .setDescription(description)
      .setColor('#9b59b6')
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (e) {
    // silent fail
  }
}

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  return symbols[currency] || currency + ' ';
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
