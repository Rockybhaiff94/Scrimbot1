import { CommandInteraction, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { Command } from '../types/Command';
import { PresetService } from '../services/PresetService';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('preset')
    .setDescription('Manage tournament presets')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand => 
      subcommand
        .setName('create')
        .setDescription('Start the interactive wizard to create a new preset')
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('list')
        .setDescription('List all saved presets for this server')
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('save')
        .setDescription('Save an existing tournament as a preset')
        .addStringOption(option => 
          option.setName('tournament_id')
            .setDescription('The ID of the tournament to save (e.g., T-XXXXX)')
            .setRequired(true)
        )
        .addStringOption(option => 
          option.setName('name')
            .setDescription('Name for the new preset')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('use')
        .setDescription('Create a tournament using a saved preset')
    ),

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    
    if (!guildId) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    try {
      switch (subcommand) {
        case 'create':
          await handleCreate(interaction);
          break;
        case 'list':
          await handleList(interaction, guildId);
          break;
        case 'save':
          await handleSave(interaction, guildId);
          break;
        case 'use':
          await handleUse(interaction, guildId);
          break;
        default:
          await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
      }
    } catch (error) {
      console.error(error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  },
};

async function handleCreate(interaction: CommandInteraction) {
  // Start the interactive wizard
  const embed = new EmbedBuilder()
    .setTitle('🏆 Preset Creation Wizard')
    .setDescription('Welcome to the Preset Creation Wizard. This will guide you through setting up a reusable tournament configuration.\n\nClick **Start** to begin.')
    .setColor('#3498db');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('preset_wizard_start')
      .setLabel('Start Wizard')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('▶️')
  );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleList(interaction: CommandInteraction, guildId: string) {
  await interaction.deferReply({ ephemeral: true });
  
  const presets = await PresetService.getPresetsByGuild(guildId);
  
  if (!presets || presets.length === 0) {
    return interaction.editReply({ content: 'No presets found for this server. Use `/preset create` to make one!' });
  }

  const options = presets.map((p: any) => ({
    label: `${p.isDefault ? '⭐ ' : ''}${p.name}`.substring(0, 100),
    description: `Game: ${p.gameName} | Mode: ${p.matchType}`.substring(0, 100),
    value: p.presetId,
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('preset_list_select')
    .setPlaceholder('Select a preset to manage')
    .addOptions(options.slice(0, 25)); // Discord limits select menus to 25 options

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const embed = new EmbedBuilder()
    .setTitle('📋 Saved Presets')
    .setDescription(`Found **${presets.length}** preset(s) for this server. Select one from the dropdown below to view, edit, or use it.`)
    .setColor('#2ecc71');

  await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleSave(interaction: CommandInteraction, guildId: string) {
  await interaction.deferReply({ ephemeral: true });
  
  if (!interaction.isChatInputCommand()) return;
  const tournamentId = interaction.options.getString('tournament_id', true);
  const name = interaction.options.getString('name', true);

  const newPreset = await PresetService.saveTournamentAsPreset(tournamentId, {
    name,
    description: `Saved from tournament ${tournamentId}`,
    ownerId: interaction.user.id,
    guildId,
  });

  if (!newPreset) {
    return interaction.editReply({ content: `Could not find a tournament with ID **${tournamentId}**.` });
  }

  await interaction.editReply({ content: `✅ Successfully saved tournament **${tournamentId}** as a new preset: **${name}** (ID: ${newPreset.presetId})` });
}

async function handleUse(interaction: CommandInteraction, guildId: string) {
  await interaction.deferReply({ ephemeral: true });
  
  const presets = await PresetService.getPresetsByGuild(guildId);
  
  if (!presets || presets.length === 0) {
    return interaction.editReply({ content: 'No presets found to use. Create one first!' });
  }

  const options = presets.map((p: any) => ({
    label: p.name.substring(0, 100),
    description: `Game: ${p.gameName}`.substring(0, 100),
    value: p.presetId,
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('preset_use_select')
    .setPlaceholder('Choose a preset to create a tournament')
    .addOptions(options.slice(0, 25));

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.editReply({ 
    content: 'Please select which preset you would like to use:', 
    components: [row] 
  });
}
