// programmes.js
import { supabase } from '../config.js';

export const ProgrammesAPI = {
    async getAll() {
        const { data, error } = await supabase
            .from('programmes')
            .select(`
                *,
                forms (count)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async getById(id) {
        const { data, error } = await supabase
            .from('programmes')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    async create(programmeData) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const payload = {
            ...programmeData,
            created_by: user.id
        };

        const { data, error } = await supabase
            .from('programmes')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async update(id, updates) {
        const { data, error } = await supabase
            .from('programmes')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async delete(id) {
        const { error } = await supabase
            .from('programmes')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }
};