// settings.js
import { supabase } from './config.js';

export const SettingsAPI = {
    async getSettings() {
        const { data, error } = await supabase
            .from('organization_settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) throw error;
        return data;
    },

    async updateSettings(updates) {
        updates.updated_at = new Date().toISOString();
        const { data, error } = await supabase
            .from('organization_settings')
            .update(updates)
            .eq('id', 1)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};