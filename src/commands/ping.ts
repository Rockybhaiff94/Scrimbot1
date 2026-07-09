import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types/Command';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with the bot latency!'),
  async execute(interaction: CommandInteraction) {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    const roundTripLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const wsLatency = interaction.client.ws.ping;
    
    await interaction.editReply(`Pong! 🏓\n- **Round-trip latency:** ${roundTripLatency}ms\n- **WebSocket ping:** ${wsLatency}ms`);
  },
};
