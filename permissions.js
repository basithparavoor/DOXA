// permissions.js
import { supabase } from './config.js';

export const PermissionsAPI = {
    // Get all users who have access to a specific form
    async getFormAccess(formId) {
        const { data, error } = await supabase
            .from('form_permissions')
            .select(`
                id,
                role,
                profiles:user_id (id, full_name, email)
            `)
            .eq('form_id', formId);

        if (error) throw error;
        return data;
    },

    // Grant a user access to a form
    async grantAccess(formId, userId, role) {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data, error } = await supabase
            .from('form_permissions')
            .upsert({ 
                form_id: formId, 
                user_id: userId, 
                role: role,
                granted_by: user.id
            }, { onConflict: 'form_id, user_id' })
            .select();

        if (error) throw error;
        return data;
    },

    // Remove a user's access
    async revokeAccess(permissionId) {
        const { error } = await supabase
            .from('form_permissions')
            .delete()
            .eq('id', permissionId);

        if (error) throw error;
        return true;
    }
};