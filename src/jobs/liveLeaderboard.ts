import cron from 'node-cron';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import Leaderboard from '../database/models/Leaderboard';
import Tournament from '../database/models/Tournament';
import { logger } from '../utilities/logger';

export const startLeaderboardJob = (client: Client) => {
  cron.schedule('* * * * *', async () => {
    try {
      const leaderboards = await Leaderboard.find();
      if (leaderboards.length === 0) return;

      const tournaments = await Tournament.find();

      const upcoming = tournaments.filter(t => t.status === 'upcoming' || t.status === 'registration_open');
      const ongoing = tournaments.filter(t => t.status === 'ongoing' || t.status === 'registration_closed');
      const completed = tournaments.filter(t => t.status === 'completed');

      const embed = new EmbedBuilder()
        .setTitle('🔴 LIVE: Tournaments Leaderboard')
        .setColor('#3498db')
        .setFooter({ text: 'Last Updated' })
        .setTimestamp();

      if (upcoming.length > 0) {
        embed.addFields({
          name: '🟢 Upcoming / Registration Open',
          value: upcoming.map(t => {
            const approved = t.approvedParticipants?.length || 0;
            return `**${t.name}** (\`${t.tournamentId}\`) — ${approved}/${t.maxTeams} Players`;
          }).join('\n'),
        });
      }

      if (ongoing.length > 0) {
        embed.addFields({
          name: '🔥 Ongoing',
          value: ongoing.map(t => `**${t.name}** (\`${t.tournamentId}\`)`).join('\n'),
        });
      }

      if (completed.length > 0) {
        embed.addFields({
          name: '🏁 Completed',
          value: completed.map(t => `**${t.name}** (\`${t.tournamentId}\`)`).join('\n'),
        });
      }

      if (tournaments.length === 0) {
        embed.setDescription('*No tournaments currently.*');
      }

      for (const lb of leaderboards) {
        try {
          const guild = client.guilds.cache.get(lb.guildId);
          if (!guild) continue;

          const channel = guild.channels.cache.get(lb.channelId) as TextChannel;
          if (!channel) continue;

          const message = await channel.messages.fetch(lb.messageId);
          if (message) {
            await message.edit({ embeds: [embed] });
          }
        } catch (err) {
          logger.warn(`Could not update leaderboard for guild ${lb.guildId}: ${err}`);
        }
      }
    } catch (error) {
      logger.error('Error in leaderboard cron job:', error);
    }
  });

  logger.info('[Jobs] Live Leaderboard cron job started (runs every minute).');
};
