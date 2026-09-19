// auth.js
import { supabase } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Check if already logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (session && window.location.pathname.includes('index.html')) {
        window.location.href = '/dashboard.html';
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = document.getElementById('loginBtn');
            const errorMsg = document.getElementById('errorMsg');
            const btnText = btn.querySelector('.btn-text');

            btn.disabled = true;
            btnText.textContent = 'Authenticating...';
            errorMsg.textContent = '';
            errorMsg.style.display = 'none';

            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;
                
                // Redirect on success
                window.location.href = '/dashboard.html';
                
            } catch (error) {
                errorMsg.textContent = error.message;
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btnText.textContent = 'Sign In';
            }
        });
    }
});

export async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/index.html';
}