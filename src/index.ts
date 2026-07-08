import { Client, GatewayIntentBits, Collection } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { connectDatabase } from './database/connect';
import { logger } from './utilities/logger';
import { startLeaderboardJob } from './jobs/liveLeaderboard';
import { startTournamentScheduler } from './jobs/tournamentScheduler';

// Load environment variables
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Command Handler Setup
const commands = new Collection<string, any>();
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const { command } = require(filePath);
    if (command && command.data && command.execute) {
      commands.set(command.data.name, command);
    }
  }
}

// Basic ready event
client.once('ready', () => {
  logger.info(`[Bot] Logged in as ${client.user?.tag}!`);
  startLeaderboardJob(client);
  startTournamentScheduler(client);
});

// Interaction Create Event for Commands and Components
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) {
      logger.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }
    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error executing ${interaction.commandName}`);
      logger.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  } else if (interaction.isButton()) {
    try {
      // Resolve button handler - support dynamic IDs (e.g., register_button_T-XXXXX)
      let handlerId = interaction.customId;
      
      // Extract base handler ID for dynamic IDs (e.g., register_button_T-XXXXX -> register_button)
      if (handlerId.startsWith('register_button')) handlerId = 'register_button';
      else if (handlerId.startsWith('setup_basic')) handlerId = 'setup_basic';
      else if (handlerId.startsWith('setup_visuals')) handlerId = 'setup_visuals';
      else if (handlerId.startsWith('setup_reg')) handlerId = 'setup_reg';
      else if (handlerId.startsWith('setup_time')) handlerId = 'setup_time';
      else if (handlerId.startsWith('setup_payment')) handlerId = 'setup_payment';
      else if (handlerId.startsWith('setup_publish')) handlerId = 'setup_publish';
      else if (handlerId.startsWith('prize_yes')) handlerId = 'prize_yes';
      else if (handlerId.startsWith('prize_skip')) handlerId = 'prize_skip';
      
      const buttonPath = path.join(__dirname, 'interactions', 'buttons', `${handlerId}.ts`);
      const jsButtonPath = path.join(__dirname, 'interactions', 'buttons', `${handlerId}.js`);
      
      if (fs.existsSync(buttonPath)) {
        const button = require(buttonPath);
        await button.execute(interaction);
      } else if (fs.existsSync(jsButtonPath)) {
        const button = require(jsButtonPath);
        await button.execute(interaction);
      } else {
        logger.warn(`No handler found for button: ${interaction.customId}`);
      }
    } catch (error) {
      logger.error(`Error handling button ${interaction.customId}:`, error);
      if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'There was an error while executing this button!', ephemeral: true });
    }
  } else if (interaction.isModalSubmit()) {
    try {
      // Resolve modal handler - support dynamic IDs (e.g., registration_modal_T-XXXXX)
      let handlerId = interaction.customId;
      
      // Extract base handler ID for dynamic IDs
      if (handlerId.startsWith('registration_modal')) handlerId = 'registration_modal';
      else if (handlerId.startsWith('setup_basic_modal')) handlerId = 'setup_basic_modal';
      else if (handlerId.startsWith('setup_visuals_modal')) handlerId = 'setup_visuals_modal';
      else if (handlerId.startsWith('setup_reg_modal')) handlerId = 'setup_reg_modal';
      else if (handlerId.startsWith('setup_time_modal')) handlerId = 'setup_time_modal';
      else if (handlerId.startsWith('setup_payment_modal')) handlerId = 'setup_payment_modal';
      else if (handlerId.startsWith('prize_modal')) handlerId = 'prize_modal';
      
      const modalPath = path.join(__dirname, 'interactions', 'modals', `${handlerId}.ts`);
      const jsModalPath = path.join(__dirname, 'interactions', 'modals', `${handlerId}.js`);
      
      if (fs.existsSync(modalPath)) {
        const modal = require(modalPath);
        await modal.execute(interaction);
      } else if (fs.existsSync(jsModalPath)) {
        const modal = require(jsModalPath);
        await modal.execute(interaction);
      } else {
        logger.warn(`No handler found for modal: ${interaction.customId}`);
      }
    } catch (error) {
      logger.error(`Error handling modal ${interaction.customId}:`, error);
      if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'There was an error while executing this modal!', ephemeral: true });
    }
  } else if (interaction.isAnySelectMenu()) {
    try {
      let handlerId = interaction.customId;
      if (handlerId.startsWith('publish_channel_select')) handlerId = 'publish_channel_select';
      
      const selectPath = path.join(__dirname, 'interactions', 'selectmenus', `${handlerId}.ts`);
      const jsSelectPath = path.join(__dirname, 'interactions', 'selectmenus', `${handlerId}.js`);
      
      if (fs.existsSync(selectPath)) {
        const selectMenu = require(selectPath);
        await selectMenu.execute(interaction);
      } else if (fs.existsSync(jsSelectPath)) {
        const selectMenu = require(jsSelectPath);
        await selectMenu.execute(interaction);
      } else {
        logger.warn(`No handler found for select menu: ${interaction.customId}`);
      }
    } catch (error) {
      logger.error(`Error handling select menu ${interaction.customId}:`, error);
      if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Error executing select menu!', ephemeral: true });
    }
  }
});

const start = async () => {
  try {
    await connectDatabase();
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    logger.error('[Startup Error]', error);
    process.exit(1);
  }
};

start();
