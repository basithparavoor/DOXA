// storage.js
import { supabase } from 'config.js';

export const StorageAPI = {
    async uploadFile(file, programmeId, registrationId) {
        // Create a structured path: programme_id/registration_id/filename
        const fileExt = file.name.split('.').pop();
        const safeName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
        const filePath = `${programmeId}/${registrationId}/${Date.now()}_${safeName}.${fileExt}`;

        const { data, error } = await supabase.storage
            .from('form_uploads')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;
        return data.path; // Return the path to store in the JSON response payload
    },

    async getSignedUrl(filePath) {
        // Generate a secure URL valid for 60 seconds
        const { data, error } = await supabase.storage
            .from('form_uploads')
            .createSignedUrl(filePath, 60);

        if (error) throw error;
        return data.signedUrl;
    },

    async listFiles() {
        // For the file manager, we can query the storage.objects view securely
        const { data, error } = await supabase
            .from('storage.objects')
            .select('*')
            .eq('bucket_id', 'form_uploads')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        return data;
    }
};