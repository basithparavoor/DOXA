// config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://wscmhiwngbezstyfixxd.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_R-qlGWU2MqHwy404bDOLLw_WrRqu1_T';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// config.js (Append to the bottom of the file)

// Automatically fetch and apply custom organization logo if it exists
document.addEventListener('DOMContentLoaded', async () => {
    const sidebarLogo = document.getElementById('globalSidebarLogo');
    
    // Only run if the sidebar logo exists on this page
    if (sidebarLogo) {
        try {
            const { data } = await supabase
                .from('organization_settings')
                .select('logo_url')
                .eq('id', 1)
                .single();

            // If a custom logo exists in the DB, override logo.png
            if (data && data.logo_url) {
                sidebarLogo.src = data.logo_url;
            }
        } catch (error) {
            // Silently fail and continue using the default logo.png
            console.warn("Could not fetch custom logo, using default.");
        }
    }
});

// config.js (Append to bottom)

// Global Mobile Sidebar Toggle
document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('mobileSidebarOverlay');

    if (mobileMenuBtn && sidebar && overlay) {
        // Open sidebar
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
            overlay.classList.add('active');
        });

        // Close sidebar when clicking outside (on the overlay)
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });

        // Close sidebar when clicking a nav link on mobile
        const navLinks = sidebar.querySelectorAll('.nav-item');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            });
        });
    }
});