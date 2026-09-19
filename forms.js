// forms.js
import { supabase } from './config.js';

export const FormsAPI = {
    async getAll() {
        const { data, error } = await supabase
            .from('forms')
            .select(`
                id,
                title,
                slug,
                status,
                created_at,
                programmes ( name )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },
    
    async delete(id) {
        const { error } = await supabase.from('forms').delete().eq('id', id);
        if (error) throw error;
        return true;
    }
};