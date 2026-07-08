import { CommandInteraction, SlashCommandBuilder } from 'discord.js';

export interface Command {
  data: any;
  execute: (interaction: CommandInteraction) => Promise<any>;
}
