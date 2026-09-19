// analytics.js
import { supabase } from './config.js';

export const AnalyticsAPI = {
    async getGlobalStats() {
        // In a production environment with millions of rows, you would use Supabase RPC (PostgreSQL functions) 
        // to aggregate this on the server. For this phase, we'll fetch and aggregate in the client.
        const { data: responses, error: respError } = await supabase
            .from('responses')
            .select('status, submitted_at, forms(title)');

        if (respError) throw respError;

        const { count: formCount, error: formError } = await supabase
            .from('forms')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'PUBLISHED');

        if (formError) throw formError;

        // Process Status Distribution
        const statusCounts = {
            'SUBMITTED': 0,
            'UNDER_REVIEW': 0,
            'APPROVED': 0,
            'REJECTED': 0,
            'COMPLETED': 0
        };

        // Process Submissions over the last 7 days
        const last7Days = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last7Days[d.toISOString().split('T')[0]] = 0;
        }

        responses.forEach(r => {
            // Count statuses
            if (statusCounts[r.status] !== undefined) {
                statusCounts[r.status]++;
            }

            // Count dates
            const dateKey = r.submitted_at.split('T')[0];
            if (last7Days[dateKey] !== undefined) {
                last7Days[dateKey]++;
            }
        });

        return {
            totalSubmissions: responses.length,
            activeForms: formCount || 0,
            statusCounts,
            trendData: last7Days
        };
    }
};