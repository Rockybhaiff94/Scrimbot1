import { CommandInteraction, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types/Command';
import Tournament from '../database/models/Tournament';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('tournament')
    .setDescription('Manage tournaments')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new tournament')
        .addStringOption(option => option.setName('id').setDescription('Unique ID (e.g., bgmi-s1)').setRequired(true))
        .addStringOption(option => option.setName('name').setDescription('Display name').setRequired(true))
        .addIntegerOption(option => option.setName('max_teams').setDescription('Max teams allowed').setRequired(false))
        .addStringOption(option => option.setName('prize').setDescription('Prize Pool description').setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit an existing tournament')
        .addStringOption(option => option.setName('id').setDescription('Tournament ID to edit').setRequired(true))
        .addStringOption(option => option.setName('name').setDescription('New Display name').setRequired(false))
        .addStringOption(option => option.setName('status').setDescription('New status').addChoices(
          { name: 'Upcoming', value: 'upcoming' },
          { name: 'Registration Open', value: 'registration_open' },
          { name: 'Registration Closed', value: 'registration_closed' },
          { name: 'Ongoing', value: 'ongoing' },
          { name: 'Completed', value: 'completed' },
          { name: 'Cancelled', value: 'cancelled' }
        ).setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a tournament')
        .addStringOption(option => option.setName('id').setDescription('Tournament ID to delete').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all tournaments')
    ),

  async execute(interaction: CommandInteraction) {
    const chatInteraction = interaction as ChatInputCommandInteraction;
    const subcommand = chatInteraction.options.getSubcommand();

    if (subcommand === 'create') {
      const id = chatInteraction.options.getString('id', true);
      const name = chatInteraction.options.getString('name', true);
      const maxTeams = chatInteraction.options.getInteger('max_teams') || 100;
      const prizePool = chatInteraction.options.getString('prize') || 'TBA';

      try {
        const existing = await Tournament.findOne({ tournamentId: id });
        if (existing) return await interaction.reply({ content: `A tournament with ID \`${id}\` already exists!`, ephemeral: true });

        const newTournament = new Tournament({ tournamentId: id, name, maxTeams, prizePool, guildId: interaction.guildId! });
        await newTournament.save();
        await interaction.reply({ content: `✅ Successfully created tournament **${name}** (\`${id}\`)!`, ephemeral: false });
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Database error.', ephemeral: true });
      }
    }

    if (subcommand === 'edit') {
      const id = chatInteraction.options.getString('id', true);
      const name = chatInteraction.options.getString('name');
      const status = chatInteraction.options.getString('status');

      try {
        const tournament = await Tournament.findOne({ tournamentId: id });
        if (!tournament) return await interaction.reply({ content: `Tournament \`${id}\` not found!`, ephemeral: true });

        if (name) tournament.name = name;
        if (status) tournament.status = status as 'upcoming' | 'registration_open' | 'registration_closed' | 'ongoing' | 'completed' | 'cancelled';
        
        await tournament.save();
        await interaction.reply({ content: `✅ Updated tournament **${tournament.name}** (\`${id}\`)!`, ephemeral: true });
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Database error.', ephemeral: true });
      }
    }

    if (subcommand === 'delete') {
      const id = chatInteraction.options.getString('id', true);
      try {
        const deleted = await Tournament.findOneAndDelete({ tournamentId: id });
        if (!deleted) return await interaction.reply({ content: `Tournament \`${id}\` not found!`, ephemeral: true });
        await interaction.reply({ content: `🗑️ Deleted tournament **${deleted.name}** (\`${id}\`).`, ephemeral: true });
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Database error.', ephemeral: true });
      }
    }

    if (subcommand === 'list') {
      try {
        const tournaments = await Tournament.find();
        if (tournaments.length === 0) return await interaction.reply({ content: 'No active tournaments.', ephemeral: true });

        const embed = new EmbedBuilder()
          .setTitle('🏆 Current Tournaments')
          .setColor('#0099ff');

        tournaments.forEach(t => {
          embed.addFields({
            name: `${t.name} (${t.tournamentId})`,
            value: `Status: **${t.status}**\nTeams: ${t.registeredTeams}/${t.maxTeams}\Prize Pool: ${t.prizePool || 'TBA'}`,
            inline: false
          });
        });

        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Database error.', ephemeral: true });
      }
    }
  },
};
