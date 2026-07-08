import {
  CommandInteraction,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  TextChannel,
  ChannelType,
  Client,
} from 'discord.js';
import { Command } from '../types/Command';
import Tournament from '../database/models/Tournament';
import Ticket from '../database/models/Ticket';
import Settings from '../database/models/Settings';
import { logger } from '../utilities/logger';
import { buildTournamentEmbed, updateAnnouncementEmbed } from '../jobs/tournamentScheduler';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('match')
    .setDescription('Tournament match management commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('Create a new tournament and launch the setup wizard')
    )
    .addSubcommand(sub => sub.setName('idpass').setDescription('Distribute Room ID & Password'))
    .addSubcommand(sub => sub.setName('edit').setDescription('Edit a tournament')
      .addStringOption(o => o.setName('id').setDescription('Tournament ID').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('delete').setDescription('Delete a tournament')
      .addStringOption(o => o.setName('id').setDescription('Tournament ID').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('publish').setDescription('Publish tournament to announcement channel')
      .addStringOption(o => o.setName('id').setDescription('Tournament ID').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to publish to').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('stats').setDescription('View tournament stats')
      .addStringOption(o => o.setName('id').setDescription('Tournament ID').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('close').setDescription('Close registration')
      .addStringOption(o => o.setName('id').setDescription('Tournament ID').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('cancel').setDescription('Cancel a tournament')
      .addStringOption(o => o.setName('id').setDescription('Tournament ID').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('reminders').setDescription('Configure reminders')
      .addStringOption(o => o.setName('id').setDescription('Tournament ID').setRequired(true))
      .addStringOption(o => o.setName('intervals').setDescription('Reminder intervals in minutes (comma-separated, e.g. 30,15,5)').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('prizes').setDescription('Configure prize pool')
      .addStringOption(o => o.setName('id').setDescription('Tournament ID').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('logs').setDescription('View tournament log')
      .addStringOption(o => o.setName('id').setDescription('Tournament ID').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('export').setDescription('Export participant list')
      .addStringOption(o => o.setName('id').setDescription('Tournament ID').setRequired(true))
    ),

  async execute(interaction: CommandInteraction) {
    const ci = interaction as ChatInputCommandInteraction;
    const sub = ci.options.getSubcommand();

    const handlers: Record<string, (i: ChatInputCommandInteraction) => Promise<any>> = {
      create: handleCreate, idpass: handleIdPass, edit: handleEdit,
      delete: handleDelete, publish: handlePublish, stats: handleStats,
      close: handleClose, cancel: handleCancel, reminders: handleReminders,
      prizes: handlePrizes, logs: handleLogs, export: handleExport,
    };

    if (handlers[sub]) await handlers[sub](ci);
  },
};

// ─── CREATE ──────────────────────────────────────────────────────────
// ─── CREATE (SETUP WIZARD) ───────────────────────────────────────────
async function handleCreate(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  await interaction.deferReply({ ephemeral: true });

  const tournamentId = `T-${Date.now().toString(36).toUpperCase()}`;

  try {
    const previewChannel = await interaction.guild.channels.create({
      name: `preview-${tournamentId.toLowerCase()}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel] },
      ],
    });

    const newTournament = new Tournament({
      tournamentId,
      name: 'Untitled Tournament',
      description: 'Please setup the description.',
      gameName: 'Free Fire',
      matchType: 'squad',
      status: 'upcoming',
      maxTeams: 100,
      registrationFee: 0,
      currency: 'INR',
      guildId: interaction.guild.id,
      createdBy: interaction.user.id,
      previewChannelId: previewChannel.id,
    });
    
    const embed = buildTournamentEmbed(newTournament);
    
    // Setup Menu Embed
    const menuEmbed = new EmbedBuilder()
      .setTitle('⚙️ Tournament Setup Wizard')
      .setDescription('Use the buttons below to configure your tournament. The preview above will update automatically.')
      .setColor('#9b59b6');
      
    const r1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`setup_basic_${tournamentId}`).setLabel('Basic Info').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`setup_visuals_${tournamentId}`).setLabel('Visuals').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`setup_reg_${tournamentId}`).setLabel('Registration').setStyle(ButtonStyle.Primary)
    );
    const r2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`setup_time_${tournamentId}`).setLabel('Date & Time').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`setup_payment_${tournamentId}`).setLabel('Payment').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`setup_publish_${tournamentId}`).setLabel('Publish').setStyle(ButtonStyle.Success)
    );

    const previewMessage = await previewChannel.send({ embeds: [embed] });
    await previewChannel.send({ embeds: [menuEmbed], components: [r1, r2] });
    
    newTournament.previewMessageId = previewMessage.id;
    await newTournament.save();

    await interaction.editReply({ content: `✅ Setup wizard launched in <#${previewChannel.id}>!` });
    await logAction(interaction, 'Tournament Wizard Started', `\`${tournamentId}\``);
  } catch (error) {
    logger.error('Create error:', error);
    await interaction.editReply({ content: '❌ Failed to create tournament setup wizard.' });
  }
}

// ─── EDIT ────────────────────────────────────────────────────────────
async function handleEdit(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString('id', true);
  const tournament = await Tournament.findOne({ tournamentId: id, guildId: interaction.guildId! });
  if (!tournament) return await interaction.reply({ content: `❌ Tournament \`${id}\` not found.`, ephemeral: true });

  // Show a modal for editing
  const modal = new ModalBuilder()
    .setCustomId(`match_edit_modal_${id}`)
    .setTitle(`Edit: ${tournament.name.substring(0, 30)}`);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('editName').setLabel('Tournament Name')
        .setStyle(TextInputStyle.Short).setRequired(false).setValue(tournament.name)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('editDesc').setLabel('Description')
        .setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(tournament.description || '')
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('editPrize').setLabel('Prize Pool')
        .setStyle(TextInputStyle.Short).setRequired(false).setValue(tournament.prizePool || '')
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('editRules').setLabel('Rules')
        .setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(tournament.rules || '')
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('editNotes').setLabel('Notes')
        .setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(tournament.notes || '')
    ),
  );

  await interaction.showModal(modal);

  try {
    const modalResponse = await interaction.awaitModalSubmit({
      time: 300_000,
      filter: i => i.customId === `match_edit_modal_${id}` && i.user.id === interaction.user.id,
    });

    const newName = modalResponse.fields.getTextInputValue('editName').trim();
    const newDesc = modalResponse.fields.getTextInputValue('editDesc').trim();
    const newPrize = modalResponse.fields.getTextInputValue('editPrize').trim();
    const newRules = modalResponse.fields.getTextInputValue('editRules').trim();
    const newNotes = modalResponse.fields.getTextInputValue('editNotes').trim();

    if (newName) tournament.name = newName;
    if (newDesc !== undefined) tournament.description = newDesc;
    if (newPrize) tournament.prizePool = newPrize;
    if (newRules !== undefined) tournament.rules = newRules;
    if (newNotes !== undefined) tournament.notes = newNotes;

    await tournament.save();

    // Update live embed
    await updateAnnouncementEmbed(interaction.client as Client, tournament);

    await modalResponse.reply({ content: `✅ Tournament **${tournament.name}** updated!`, ephemeral: true });
    await logAction(interaction, 'Tournament Edited', `**${tournament.name}** (\`${id}\`)`);
  } catch (e) {
    // Modal timed out
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────
async function handleDelete(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString('id', true);
  await interaction.deferReply({ ephemeral: true });

  const tournament = await Tournament.findOne({ tournamentId: id, guildId: interaction.guildId! });
  if (!tournament) return await interaction.editReply({ content: `❌ Tournament \`${id}\` not found.` });

  // Confirmation embed
  const confirmEmbed = new EmbedBuilder()
    .setTitle('⚠️ Confirm Deletion')
    .setDescription(`Are you sure you want to delete **${tournament.name}** (\`${id}\`)?\nThis action cannot be undone.`)
    .setColor('#e74c3c');

  const confirmBtn = new ButtonBuilder().setCustomId('confirm_delete').setLabel('Delete').setStyle(ButtonStyle.Danger);
  const cancelBtn = new ButtonBuilder().setCustomId('cancel_delete').setLabel('Cancel').setStyle(ButtonStyle.Secondary);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

  const response = await interaction.editReply({ embeds: [confirmEmbed], components: [row] });

  const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30_000 });
  collector.on('collect', async btn => {
    if (btn.user.id !== interaction.user.id) return;
    if (btn.customId === 'confirm_delete') {
      await Tournament.findOneAndDelete({ tournamentId: id });
      await Ticket.deleteMany({ tournamentId: id });
      await btn.update({ content: `🗑️ Deleted **${tournament.name}**.`, embeds: [], components: [] });
      await logAction(interaction, 'Tournament Deleted', `**${tournament.name}** (\`${id}\`)`);
    } else {
      await btn.update({ content: 'Cancelled.', embeds: [], components: [] });
    }
    collector.stop();
  });
  collector.on('end', (_, reason) => {
    if (reason === 'time') interaction.editReply({ content: '⏰ Timed out.', embeds: [], components: [] }).catch(() => {});
  });
}

// ─── PUBLISH ─────────────────────────────────────────────────────────
async function handlePublish(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString('id', true);
  const targetChannel = interaction.options.getChannel('channel', true);

  await interaction.deferReply({ ephemeral: true });

  const tournament = await Tournament.findOne({ tournamentId: id, guildId: interaction.guildId! });
  if (!tournament) return await interaction.editReply({ content: `❌ Tournament \`${id}\` not found.` });

  try {
    const channel = interaction.guild?.channels.cache.get(targetChannel.id) as TextChannel;
    if (!channel) return await interaction.editReply({ content: '❌ Channel not accessible.' });

    // Build the tournament embed with a Register button
    const embed = buildTournamentEmbed(tournament);

    const registerBtn = new ButtonBuilder()
      .setCustomId(`register_button_${tournament.tournamentId}`)
      .setLabel('Register')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Primary);

    const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(registerBtn);

    const message = await channel.send({ embeds: [embed], components: [btnRow] });

    // Save the message/channel IDs for live updates
    tournament.announcementMessageId = message.id;
    tournament.announcementChannelId = channel.id;
    tournament.status = 'registration_open';
    await tournament.save();

    await interaction.editReply({
      content: `✅ Tournament **${tournament.name}** published to <#${channel.id}>! Registration is now open.`,
    });

    await logAction(interaction, 'Tournament Published', `**${tournament.name}** in <#${channel.id}>`);
  } catch (error) {
    logger.error('Publish error:', error);
    await interaction.editReply({ content: '❌ Failed to publish tournament.' });
  }
}

// ─── STATS ───────────────────────────────────────────────────────────
async function handleStats(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString('id', true);
  const tournament = await Tournament.findOne({ tournamentId: id, guildId: interaction.guildId! });
  if (!tournament) return await interaction.reply({ content: `❌ Tournament \`${id}\` not found.`, ephemeral: true });

  const approvedCount = tournament.approvedParticipants?.length || 0;
  const pending = await Ticket.countDocuments({ tournamentId: id, status: { $in: ['open', 'pending_approval'] } });
  const rejected = await Ticket.countDocuments({ tournamentId: id, status: 'rejected' });
  const sym = getCurrencySymbol(tournament.currency);
  const collected = approvedCount * tournament.registrationFee;

  const embed = new EmbedBuilder()
    .setTitle(`📊 Stats: ${tournament.name}`)
    .setColor('#3498db')
    .addFields(
      { name: 'ID', value: `\`${tournament.tournamentId}\``, inline: true },
      { name: 'Status', value: getStatusEmoji(tournament.status) + ' ' + formatStatus(tournament.status), inline: true },
      { name: 'Game', value: tournament.gameName, inline: true },
      { name: 'Total Slots', value: `${tournament.maxTeams}`, inline: true },
      { name: 'Approved', value: `${approvedCount}`, inline: true },
      { name: 'Available', value: `${tournament.maxTeams - approvedCount}`, inline: true },
      { name: 'Pending', value: `${pending}`, inline: true },
      { name: 'Rejected', value: `${rejected}`, inline: true },
      { name: 'Collected', value: `${sym}${collected}`, inline: true },
      { name: 'Prize', value: tournament.prizePool || 'TBA', inline: true },
    )
    .setTimestamp();

  if (tournament.prizeEnabled && tournament.prizes?.length > 0) {
    const prizeList = tournament.prizes.map(p => `${p.label}: ${sym}${p.amount}`).join('\n');
    embed.addFields({ name: '🏆 Prize Distribution', value: prizeList });
    const totalPrize = tournament.prizes.reduce((sum, p) => sum + p.amount, 0);
    embed.addFields(
      { name: 'Total Prize', value: `${sym}${totalPrize}`, inline: true },
      { name: 'Profit', value: `${sym}${collected - totalPrize}`, inline: true },
    );
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ─── CLOSE ───────────────────────────────────────────────────────────
async function handleClose(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString('id', true);
  const tournament = await Tournament.findOne({ tournamentId: id, guildId: interaction.guildId! });
  if (!tournament) return await interaction.reply({ content: `❌ Not found.`, ephemeral: true });
  if (tournament.status === 'completed' || tournament.status === 'cancelled')
    return await interaction.reply({ content: `❌ Already ${tournament.status}.`, ephemeral: true });

  tournament.status = 'registration_closed';
  await tournament.save();
  await updateAnnouncementEmbed(interaction.client as Client, tournament);
  await interaction.reply({ content: `✅ Registration closed for **${tournament.name}**.` });
  await logAction(interaction, 'Registration Closed', `**${tournament.name}** (\`${id}\`)`);

  // Prompt for prize configuration if prizes not set
  if (!tournament.prizeEnabled) {
    const embed = new EmbedBuilder()
      .setTitle('💰 Configure Prizes?')
      .setDescription('Would you like to configure the prize distribution now?')
      .setColor('#f39c12');
    const yesBtn = new ButtonBuilder().setCustomId(`prize_yes_${id}`).setLabel('Yes').setStyle(ButtonStyle.Success);
    const skipBtn = new ButtonBuilder().setCustomId(`prize_skip_${id}`).setLabel('Skip').setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(yesBtn, skipBtn);
    await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });
  }
}

// ─── CANCEL ──────────────────────────────────────────────────────────
async function handleCancel(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString('id', true);
  const tournament = await Tournament.findOne({ tournamentId: id, guildId: interaction.guildId! });
  if (!tournament) return await interaction.reply({ content: `❌ Not found.`, ephemeral: true });

  tournament.status = 'cancelled';
  await tournament.save();
  await updateAnnouncementEmbed(interaction.client as Client, tournament);

  // DM all approved participants about cancellation
  const guild = interaction.guild!;
  for (const userId of tournament.approvedParticipants || []) {
    try {
      const member = await guild.members.fetch(userId);
      const dmEmbed = new EmbedBuilder()
        .setTitle('🚫 Tournament Cancelled')
        .setDescription(`**${tournament.name}** has been cancelled by the organizer.`)
        .setColor('#e74c3c').setTimestamp();
      await member.send({ embeds: [dmEmbed] });
    } catch (e) { /* DMs disabled */ }
  }

  await interaction.reply({ content: `🚫 **${tournament.name}** cancelled. All participants notified.` });
  await logAction(interaction, 'Tournament Cancelled', `**${tournament.name}** (\`${id}\`)`);
}

// ─── REMINDERS ───────────────────────────────────────────────────────
async function handleReminders(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString('id', true);
  const intervalsStr = interaction.options.getString('intervals', true);

  const tournament = await Tournament.findOne({ tournamentId: id, guildId: interaction.guildId! });
  if (!tournament) return await interaction.reply({ content: `❌ Not found.`, ephemeral: true });

  if (!tournament.matchDate) {
    return await interaction.reply({
      content: '❌ Match date not set. Use `/match create` with `match_date` or edit the tournament first.',
      ephemeral: true,
    });
  }

  const intervals = intervalsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
  if (intervals.length === 0) {
    return await interaction.reply({ content: '❌ Invalid intervals. Use comma-separated numbers (e.g., 30,15,5)', ephemeral: true });
  }

  tournament.reminderSettings = { enabled: true, intervals };
  tournament.remindersSent = [];
  await tournament.save();

  await interaction.reply({
    content: `✅ Reminders configured for **${tournament.name}**!\n` +
      `Intervals: ${intervals.map(i => `${i} min`).join(', ')} before match.\n` +
      `Admin will also be reminded 1 hour before.`,
    ephemeral: true,
  });
}

// ─── PRIZES ──────────────────────────────────────────────────────────
async function handlePrizes(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString('id', true);
  const tournament = await Tournament.findOne({ tournamentId: id, guildId: interaction.guildId! });
  if (!tournament) return await interaction.reply({ content: `❌ Not found.`, ephemeral: true });

  const modal = new ModalBuilder()
    .setCustomId(`prize_modal_${id}`)
    .setTitle('Configure Prize Pool');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('prize1').setLabel('1st Place Prize Amount')
        .setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g., 700')
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('prize2').setLabel('2nd Place Prize Amount (optional)')
        .setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('e.g., 300')
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('prize3').setLabel('3rd Place Prize Amount (optional)')
        .setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('e.g., 150')
    ),
  );

  await interaction.showModal(modal);

  try {
    const modalRes = await interaction.awaitModalSubmit({
      time: 120_000,
      filter: i => i.customId === `prize_modal_${id}` && i.user.id === interaction.user.id,
    });

    const p1 = parseInt(modalRes.fields.getTextInputValue('prize1')) || 0;
    const p2 = parseInt(modalRes.fields.getTextInputValue('prize2')) || 0;
    const p3 = parseInt(modalRes.fields.getTextInputValue('prize3')) || 0;

    const prizes = [];
    if (p1 > 0) prizes.push({ position: 1, label: '1st Place', amount: p1 });
    if (p2 > 0) prizes.push({ position: 2, label: '2nd Place', amount: p2 });
    if (p3 > 0) prizes.push({ position: 3, label: '3rd Place', amount: p3 });

    tournament.prizes = prizes;
    tournament.prizeEnabled = prizes.length > 0;
    await tournament.save();

    const sym = getCurrencySymbol(tournament.currency);
    const total = prizes.reduce((s, p) => s + p.amount, 0);
    const approvedCount = tournament.approvedParticipants?.length || 0;
    const collected = approvedCount * tournament.registrationFee;

    const embed = new EmbedBuilder()
      .setTitle('🏆 Prize Pool Configured')
      .setColor('#f1c40f')
      .addFields(
        ...prizes.map(p => ({ name: p.label, value: `${sym}${p.amount}`, inline: true })),
        { name: 'Total Prize Pool', value: `${sym}${total}`, inline: true },
        { name: 'Collected Amount', value: `${sym}${collected}`, inline: true },
        { name: 'Balance/Profit', value: `${sym}${collected - total}`, inline: true },
      );

    await modalRes.reply({ embeds: [embed], ephemeral: true });
    await updateAnnouncementEmbed(interaction.client as Client, tournament);
  } catch (e) {
    // Modal timed out
  }
}

// ─── LOGS ────────────────────────────────────────────────────────────
async function handleLogs(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString('id', true);
  const tournament = await Tournament.findOne({ tournamentId: id, guildId: interaction.guildId! });
  if (!tournament) return await interaction.reply({ content: `❌ Not found.`, ephemeral: true });

  const tickets = await Ticket.find({ tournamentId: id }).sort({ createdAt: -1 }).limit(20);
  const approvedCount = tournament.approvedParticipants?.length || 0;

  let logText = '';
  for (const t of tickets) {
    const statusEmoji = t.status === 'approved' ? '✅' : t.status === 'rejected' ? '❌' : '⏳';
    logText += `${statusEmoji} <@${t.userId}> — ${t.status} — <t:${Math.floor(t.createdAt.getTime()/1000)}:R>\n`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`📋 Logs: ${tournament.name}`)
    .setColor('#9b59b6')
    .setDescription(logText || 'No registration activity yet.')
    .addFields(
      { name: 'Total Registrations', value: `${tickets.length}`, inline: true },
      { name: 'Approved', value: `${approvedCount}`, inline: true },
      { name: 'Status', value: formatStatus(tournament.status), inline: true },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ─── EXPORT ──────────────────────────────────────────────────────────
async function handleExport(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString('id', true);
  await interaction.deferReply({ ephemeral: true });

  const tournament = await Tournament.findOne({ tournamentId: id, guildId: interaction.guildId! });
  if (!tournament) return await interaction.editReply({ content: `❌ Not found.` });

  const tickets = await Ticket.find({ tournamentId: id, status: 'approved' });
  if (tickets.length === 0) return await interaction.editReply({ content: '❌ No approved participants to export.' });

  // Build CSV
  let csv = 'Discord ID,Username,Status,Registered At\n';
  for (const ticket of tickets) {
    try {
      const member = await interaction.guild?.members.fetch(ticket.userId);
      csv += `${ticket.userId},${member?.user.username || 'Unknown'},${ticket.status},${ticket.createdAt.toISOString()}\n`;
    } catch (e) {
      csv += `${ticket.userId},Unknown,${ticket.status},${ticket.createdAt.toISOString()}\n`;
    }
  }

  const { AttachmentBuilder } = require('discord.js');
  const attachment = new AttachmentBuilder(Buffer.from(csv, 'utf-8'), {
    name: `${tournament.tournamentId}-participants.csv`,
  });

  await interaction.editReply({
    content: `📄 Exported ${tickets.length} approved participants for **${tournament.name}**:`,
    files: [attachment],
  });
}

// ─── ID PASS ─────────────────────────────────────────────────────────
async function handleIdPass(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const tournaments = await Tournament.find({
    guildId: interaction.guildId!,
    status: { $in: ['upcoming', 'registration_open', 'registration_closed', 'ongoing'] },
  });

  if (tournaments.length === 0) {
    return await interaction.editReply({ content: '❌ No active tournaments found.' });
  }

  const options = tournaments.map(t => new StringSelectMenuOptionBuilder()
    .setLabel(t.name.substring(0, 100))
    .setDescription(`ID: ${t.tournamentId} | Players: ${t.approvedParticipants?.length || 0} | ${t.status}`)
    .setValue(t.tournamentId)
  );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('idpass_select')
    .setPlaceholder('Select tournament')
    .addOptions(options.slice(0, 25));

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  const embed = new EmbedBuilder()
    .setTitle('🎮 Room ID & Password Distribution')
    .setDescription('Select the tournament. Only **approved participants** will receive details via DM.')
    .setColor('#e67e22');

  const response = await interaction.editReply({ embeds: [embed], components: [row] });

  const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 120_000 });

  collector.on('collect', async selectInt => {
    if (selectInt.user.id !== interaction.user.id) {
      await selectInt.reply({ content: '❌ Not your interaction.', ephemeral: true });
      return;
    }

    const selectedId = selectInt.values[0];
    const tournament = tournaments.find(t => t.tournamentId === selectedId);
    if (!tournament) { await selectInt.reply({ content: '❌ Not found.', ephemeral: true }); return; }

    await handleIdPassModalFlow(selectInt, tournament, '', '', '');
  });

  collector.on('end', (c, reason) => {
    if (reason === 'time' && c.size === 0) {
      interaction.editReply({ content: '⏰ Timed out.', embeds: [], components: [] }).catch(() => {});
    }
  });
}

async function handleIdPassModalFlow(
  interaction: any, 
  tournament: any, 
  defaultRoomId: string, 
  defaultPass: string, 
  defaultMsg: string
) {
  const selectedId = tournament.tournamentId;
  const modal = new ModalBuilder()
    .setCustomId(`idpass_modal_${selectedId}_${Date.now()}`)
    .setTitle('Room Details');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('roomId').setLabel('Room ID (Optional)')
        .setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('654321987').setValue(defaultRoomId)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('roomPass').setLabel('Room Password (Optional)')
        .setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('ABC123').setValue(defaultPass)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('roomMsg').setLabel('Custom Message (Optional)')
        .setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder('Join 15 min early. Do not share.').setValue(defaultMsg)
    ),
  );

  await interaction.showModal(modal);

  try {
    const modalInt = await interaction.awaitModalSubmit({
      time: 300_000,
      filter: (i: any) => i.customId.startsWith(`idpass_modal_${selectedId}_`) && i.user.id === interaction.user.id,
    });

    await modalInt.deferReply({ ephemeral: true });

    const roomId = modalInt.fields.getTextInputValue('roomId').trim();
    const password = modalInt.fields.getTextInputValue('roomPass').trim();
    const customMsg = modalInt.fields.getTextInputValue('roomMsg').trim();

    if (!roomId && !password && !customMsg) {
      await modalInt.editReply({ content: '❌ Provide at least one field.' });
      return;
    }

    const previewEmbed = buildDistributionEmbed(tournament.name, roomId, password, customMsg);
    const approvedCount = tournament.approvedParticipants?.length || 0;

    const infoEmbed = new EmbedBuilder()
      .setTitle('📋 Distribution Preview')
      .setDescription(`**Tournament:** ${tournament.name}\n**ID:** \`${tournament.tournamentId}\`\n**Approved Players:** ${approvedCount}`)
      .setColor('#3498db');

    const sendBtn = new ButtonBuilder().setCustomId('idpass_send').setLabel('Send').setEmoji('📨').setStyle(ButtonStyle.Success);
    const editBtn = new ButtonBuilder().setCustomId('idpass_edit').setLabel('Edit').setEmoji('✏️').setStyle(ButtonStyle.Primary);
    const cancelBtn = new ButtonBuilder().setCustomId('idpass_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger);
    const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(sendBtn, editBtn, cancelBtn);

    const previewRes = await modalInt.editReply({ embeds: [infoEmbed, previewEmbed], components: [btnRow] });

    const btnCollector = previewRes.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120_000 });

    btnCollector.on('collect', async (btn: any) => {
      if (btn.user.id !== interaction.user.id) return;

      if (btn.customId === 'idpass_cancel') {
        await btn.update({ content: '❌ Cancelled.', embeds: [], components: [] });
        btnCollector.stop();
        return;
      }

      if (btn.customId === 'idpass_edit') {
        btnCollector.stop();
        // recursively call the flow to edit
        await handleIdPassModalFlow(btn, tournament, roomId, password, customMsg);
        return;
      }

      if (btn.customId === 'idpass_send') {
        await btn.update({ embeds: [infoEmbed], components: [] });
        await distributeRoomDetails(modalInt, tournament, roomId, password, customMsg, interaction);

        tournament.roomCredentials.push({ roomId, password, sentAt: new Date() });
        await tournament.save();

        btnCollector.stop();
      }
    });
  } catch (e) {
    logger.warn('IDPass modal timeout');
  }
}

// ─── DISTRIBUTE ROOM DETAILS ─────────────────────────────────────────
async function distributeRoomDetails(
  modalInt: any, tournament: any, roomId: string, password: string,
  customMsg: string, originalInt: ChatInputCommandInteraction
) {
  const approvedUsers: string[] = tournament.approvedParticipants || [];
  const total = approvedUsers.length;

  if (total === 0) {
    await modalInt.editReply({ content: '❌ No approved participants.', embeds: [], components: [] });
    return;
  }

  const dmEmbed = buildDistributionEmbed(tournament.name, roomId, password, customMsg);
  let success = 0, fail = 0;
  const failedUsers: string[] = [];
  const startTime = Date.now();

  const progressEmbed = new EmbedBuilder()
    .setTitle('📨 Sending Room Details...')
    .setColor('#f39c12')
    .addFields(
      { name: 'Progress', value: `0 / ${total}`, inline: true },
      { name: 'Success', value: '0', inline: true },
      { name: 'Failed', value: '0', inline: true },
    );

  await modalInt.editReply({ embeds: [progressEmbed], components: [] });

  for (let i = 0; i < approvedUsers.length; i++) {
    try {
      const member = await originalInt.guild?.members.fetch(approvedUsers[i]);
      if (member) { await member.send({ embeds: [dmEmbed] }); success++; }
      else { fail++; failedUsers.push(approvedUsers[i]); }
    } catch (e) { fail++; failedUsers.push(approvedUsers[i]); }

    if ((i + 1) % 5 === 0 || i === approvedUsers.length - 1) {
      const p = new EmbedBuilder().setTitle('📨 Sending...').setColor('#f39c12')
        .addFields(
          { name: 'Progress', value: `${i + 1} / ${total}`, inline: true },
          { name: 'Success', value: `${success}`, inline: true },
          { name: 'Failed', value: `${fail}`, inline: true },
        );
      await modalInt.editReply({ embeds: [p] }).catch(() => {});
    }
    if (i < approvedUsers.length - 1) await delay(1000);
  }

  const timeTaken = ((Date.now() - startTime) / 1000).toFixed(1);

  const report = new EmbedBuilder()
    .setTitle('✅ Distribution Complete')
    .setColor('#2ecc71')
    .addFields(
      { name: 'Tournament', value: tournament.name, inline: true },
      { name: 'ID', value: `\`${tournament.tournamentId}\``, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: 'Approved', value: `${total}`, inline: true },
      { name: 'Sent', value: `${success}`, inline: true },
      { name: 'Failed', value: `${fail}`, inline: true },
      { name: 'Time', value: `${timeTaken}s`, inline: true },
    );

  if (failedUsers.length > 0) {
    const list = failedUsers.map(id => `<@${id}>`).join(', ');
    report.addFields({ name: 'Failed Users', value: list.substring(0, 1024) });
  }

  await modalInt.editReply({ embeds: [report] });
  await logDistribution(originalInt, tournament, roomId, password, customMsg, success, fail);
}

// ─── HELPERS ─────────────────────────────────────────────────────────
function buildDistributionEmbed(name: string, roomId: string, password: string, msg: string): EmbedBuilder {
  const embed = new EmbedBuilder().setTitle('Tournament Name').setDescription(name).setColor('#e67e22');
  if (roomId) embed.addFields({ name: 'Room ID', value: `\`${roomId}\`` });
  if (password) embed.addFields({ name: 'Room Password', value: `\`${password}\`` });
  if (msg) embed.addFields({ name: 'Organizer Message', value: msg });
  embed.setFooter({ text: 'Good luck and have fun!' });
  return embed;
}

function getCurrencySymbol(currency: string): string {
  const s: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  return s[currency] || currency + ' ';
}

function getStatusEmoji(status: string): string {
  const e: Record<string, string> = {
    upcoming: '🟡', registration_open: '🟢', registration_closed: '🔴',
    ongoing: '🔥', completed: '🏁', cancelled: '🚫',
  };
  return e[status] || '⚪';
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function logAction(interaction: ChatInputCommandInteraction, title: string, description: string) {
  try {
    const settings = await Settings.findOne({ guildId: interaction.guildId! });
    if (!settings?.logChannelId) return;
    const channel = interaction.guild?.channels.cache.get(settings.logChannelId) as TextChannel;
    if (!channel) return;
    const embed = new EmbedBuilder()
      .setTitle(`📋 ${title}`)
      .setDescription(`${description}\nBy: <@${interaction.user.id}>`)
      .setColor('#9b59b6')
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (e) { /* silent */ }
}

async function logDistribution(
  interaction: ChatInputCommandInteraction,
  tournament: any,
  roomId: string,
  password: string,
  msg: string,
  success: number,
  fail: number
) {
  try {
    const settings = await Settings.findOne({ guildId: interaction.guildId! });
    if (!settings?.logChannelId) return;
    const channel = interaction.guild?.channels.cache.get(settings.logChannelId) as TextChannel;
    if (!channel) return;
    
    const embed = new EmbedBuilder()
      .setTitle('📋 Room Details Distributed')
      .setColor('#3498db')
      .addFields(
        { name: 'Administrator', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Tournament Name', value: tournament.name, inline: true },
        { name: 'Tournament ID', value: `\`${tournament.tournamentId}\``, inline: true },
        { name: 'Number of Recipients', value: `${success + fail}`, inline: true },
        { name: 'Successful DMs', value: `${success}`, inline: true },
        { name: 'Failed DMs', value: `${fail}`, inline: true },
      );
      
    if (roomId) embed.addFields({ name: 'Room ID', value: `\`${roomId}\`` });
    if (password) embed.addFields({ name: 'Password', value: `\`${password}\`` });
    if (msg) embed.addFields({ name: 'Custom Message', value: msg });

    embed.setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (e) { /* silent */ }
}
