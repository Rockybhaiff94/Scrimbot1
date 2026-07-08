import { CommandInteraction, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../types/Command';
import Settings from '../database/models/Settings';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Configure server settings for the Tournament Bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('view').setDescription('View current configuration'))
    .addSubcommand(sub => sub
      .setName('set_channel')
      .setDescription('Set configuration channels')
      .addChannelOption(o => o.setName('registration').setDescription('Registration panel channel').setRequired(false))
      .addChannelOption(o => o.setName('announcements').setDescription('Announcements channel').setRequired(false))
      .addChannelOption(o => o.setName('logs').setDescription('Log channel').setRequired(false))
      .addChannelOption(o => o.setName('ticket_category').setDescription('Ticket category').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('set_payment')
      .setDescription('Set payment configuration')
      .addStringOption(o => o.setName('upi_id').setDescription('UPI ID for payments').setRequired(false))
      .addStringOption(o => o.setName('qr_url').setDescription('QR code image URL').setRequired(false))
      .addStringOption(o => o.setName('instructions').setDescription('Payment instructions text').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('set_staff')
      .setDescription('Set staff role for ticket access')
      .addRoleOption(o => o.setName('role').setDescription('Staff role').setRequired(true))
    ),

  async execute(interaction: CommandInteraction) {
    const ci = interaction as ChatInputCommandInteraction;
    const sub = ci.options.getSubcommand();
    const guildId = interaction.guildId!;

    try {
      let settings = await Settings.findOne({ guildId });
      if (!settings) { settings = new Settings({ guildId }); await settings.save(); }

      if (sub === 'view') {
        const embed = new EmbedBuilder()
          .setTitle('⚙️ Server Configuration')
          .setColor('#2ecc71')
          .addFields(
            { name: 'Registration Channel', value: settings.registrationChannelId ? `<#${settings.registrationChannelId}>` : 'Not set', inline: true },
            { name: 'Announcements', value: settings.announcementChannelId ? `<#${settings.announcementChannelId}>` : 'Not set', inline: true },
            { name: 'Log Channel', value: settings.logChannelId ? `<#${settings.logChannelId}>` : 'Not set', inline: true },
            { name: 'Ticket Category', value: settings.ticketCategoryId ? `<#${settings.ticketCategoryId}>` : 'Not set', inline: true },
            { name: 'Staff Role', value: settings.staffRoleId ? `<@&${settings.staffRoleId}>` : 'Not set', inline: true },
            { name: 'UPI ID', value: settings.upiId || 'Not set', inline: true },
            { name: 'QR Code', value: settings.paymentQrUrl ? '[Set ✅]' : 'Not set', inline: true },
            { name: 'Payment Instructions', value: settings.paymentMethod || 'Not set', inline: false },
          );
        return await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (sub === 'set_channel') {
        const reg = ci.options.getChannel('registration');
        const ann = ci.options.getChannel('announcements');
        const logs = ci.options.getChannel('logs');
        const category = ci.options.getChannel('ticket_category');

        if (reg) settings.registrationChannelId = reg.id;
        if (ann) settings.announcementChannelId = ann.id;
        if (logs) settings.logChannelId = logs.id;
        if (category) settings.ticketCategoryId = category.id;

        await settings.save();
        return await interaction.reply({ content: '✅ Channels updated.', ephemeral: true });
      }

      if (sub === 'set_payment') {
        const upiId = ci.options.getString('upi_id');
        const qrUrl = ci.options.getString('qr_url');
        const instructions = ci.options.getString('instructions');

        if (upiId) settings.upiId = upiId;
        if (qrUrl) settings.paymentQrUrl = qrUrl;
        if (instructions) settings.paymentMethod = instructions;

        await settings.save();
        return await interaction.reply({ content: '✅ Payment settings updated.', ephemeral: true });
      }

      if (sub === 'set_staff') {
        const role = ci.options.getRole('role', true);
        settings.staffRoleId = role.id;
        await settings.save();
        return await interaction.reply({ content: `✅ Staff role set to <@&${role.id}>.`, ephemeral: true });
      }
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: '❌ Database error.', ephemeral: true });
    }
  },
};
