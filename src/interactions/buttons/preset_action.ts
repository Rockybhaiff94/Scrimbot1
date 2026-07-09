import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { PresetService } from '../../services/PresetService';
import Preset from '../../database/models/Preset';

export async function execute(interaction: ButtonInteraction) {
  const customId = interaction.customId; // preset_action_<action>_<presetId>
  
  // Parse action and preset ID
  const parts = customId.split('_');
  const action = parts[2];
  const presetId = parts.slice(3).join('_');
  
  const guildId = interaction.guildId;
  if (!guildId || !presetId) return;

  try {
    switch (action) {
      case 'use':
        await handleUse(interaction, presetId);
        break;
      case 'preview':
        await handlePreview(interaction, presetId, guildId);
        break;
      case 'edit':
        await handleEdit(interaction, presetId, guildId);
        break;
      case 'duplicate':
        await handleDuplicate(interaction, presetId, guildId);
        break;
      case 'delete':
        await handleDelete(interaction, presetId, guildId);
        break;
      default:
        await interaction.reply({ content: 'Unknown action.', ephemeral: true });
    }
  } catch (error) {
    console.error(error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    }
  }
}

async function handleUse(interaction: ButtonInteraction, presetId: string) {
  // Just like preset_use_select, open the quick match modal
  const modal = new ModalBuilder()
    .setCustomId(`quick_match_modal_${presetId}`)
    .setTitle(`Use Preset`);

  const dateInput = new TextInputBuilder()
    .setCustomId('match_date')
    .setLabel('Tournament Date & Time')
    .setPlaceholder('e.g., Today at 8 PM, or YYYY-MM-DD HH:MM')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput));
  
  // We can skip room details in the button shortcut or add them
  await interaction.showModal(modal);
}

async function handlePreview(interaction: ButtonInteraction, presetId: string, guildId: string) {
  await interaction.deferReply({ ephemeral: true });
  const preset = await Preset.findOne({ presetId, guildId }).lean();
  
  if (!preset) return interaction.editReply('Preset not found.');

  const embed = new EmbedBuilder()
    .setTitle(`Detailed Preview: ${preset.name}`)
    .setDescription(preset.description || 'No description')
    .addFields(
      { name: 'Tournament Settings', value: `Game: ${preset.gameName}\nType: ${preset.matchType}\nMax Teams: ${preset.maxTeams}\nPrize Pool: ${preset.prizePool || 'None'}`, inline: true },
      { name: 'Payment Settings', value: `Enabled: ${preset.paymentDetails?.enabled ? 'Yes' : 'No'}`, inline: true },
      { name: 'Rules', value: preset.rules ? 'Has Rules' : 'No Rules Set', inline: false }
    )
    .setColor('#f1c40f');
    
  await interaction.editReply({ embeds: [embed] });
}

async function handleEdit(interaction: ButtonInteraction, presetId: string, guildId: string) {
  // Normally this opens an interactive edit menu, for now just show a placeholder
  await interaction.reply({ content: 'Edit UI is under construction. It will feature a select menu to choose which category (General, Rules, Payment, etc.) to edit.', ephemeral: true });
}

async function handleDuplicate(interaction: ButtonInteraction, presetId: string, guildId: string) {
  await interaction.deferReply({ ephemeral: true });
  
  const duplicated = await PresetService.duplicatePreset(presetId, guildId, `Copy of ${presetId}`);
  if (!duplicated) return interaction.editReply('Failed to duplicate preset.');

  await interaction.editReply({ content: `✅ Successfully duplicated preset! New ID: \`${duplicated.presetId}\`` });
}

async function handleDelete(interaction: ButtonInteraction, presetId: string, guildId: string) {
  await interaction.deferReply({ ephemeral: true });
  
  const success = await PresetService.deletePreset(presetId, guildId);
  if (!success) return interaction.editReply('Failed to delete preset.');

  await interaction.editReply({ content: `🗑️ Preset \`${presetId}\` has been permanently deleted.` });
}
