// responses.js
import { supabase } from '../config.js';

export const ResponsesAPI = {
    async getAll() {
        const { data, error } = await supabase
            .from('responses')
            .select(`
                id,
                registration_id,
                status,
                submitted_at,
                data,
                forms ( title ),
                programmes ( name )
            `)
            .order('submitted_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async updateStatus(responseId, newStatus) {
        const { data, error } = await supabase
            .from('responses')
            .update({ status: newStatus })
            .eq('id', responseId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};