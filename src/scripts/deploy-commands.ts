import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { logger } from '../utilities/logger';
import { Command } from '../types/Command';

dotenv.config();

const token = process.env.DISCORD_TOKEN!;
const clientId = process.env.CLIENT_ID!;
const guildId = process.env.GUILD_ID; // Optional, if set we deploy to guild, otherwise globally

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    logger.info('Started clearing old application (/) commands.');

    // 1. Clear all guild commands if guildId is provided
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
      logger.info(`Successfully cleared guild commands for guild: ${guildId}`);
    }

    // 2. Clear all global commands
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    logger.info('Successfully cleared global commands.');

    logger.info('Started refreshing application (/) commands.');

    const commands = [];
    const commandsPath = path.join(__dirname, '..', 'commands');
    
    if (fs.existsSync(commandsPath)) {
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
      
      for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const { command } = require(filePath) as { command: Command };
        if ('data' in command && 'execute' in command) {
          commands.push(command.data.toJSON());
        } else {
          logger.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
      }
    }

    if (guildId) {
      // Deploy to guild (instant update for testing)
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands },
      );
      logger.info(`Successfully loaded ${commands.length} application (/) commands to guild.`);
    } else {
      // Deploy globally (can take up to an hour)
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands },
      );
      logger.info(`Successfully loaded ${commands.length} global application (/) commands.`);
    }
  } catch (error) {
    logger.error('Error deploying commands:', error);
  }
})();
