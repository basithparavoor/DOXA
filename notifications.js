// notifications.js
import { supabase } from '../config.js';

export class NotificationSystem {
    constructor() {
        this.wrapper = document.getElementById('notiWrapper');
        this.btn = document.getElementById('notiBtn');
        this.badge = document.getElementById('notiBadge');
        this.dropdown = document.getElementById('notiDropdown');
        this.list = document.getElementById('notiList');
        this.markAllBtn = document.getElementById('markAllReadBtn');
        this.userId = null;
        
        if (this.wrapper) this.init();
    }

    async init() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        this.userId = user.id;

        this.bindEvents();
        await this.loadNotifications();
        this.subscribeToRealtime();
    }

    bindEvents() {
        // Toggle Dropdown
        this.btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dropdown.classList.toggle('active');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.dropdown.classList.remove('active');
            }
        });

        // Mark all as read
        this.markAllBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await supabase.from('notifications').update({ is_read: true }).eq('profile_id', this.userId).eq('is_read', false);
            this.loadNotifications();
        });
    }

    async loadNotifications() {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('profile_id', this.userId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) return console.error(error);

        const unreadCount = data.filter(n => !n.is_read).length;
        this.updateBadge(unreadCount);
        this.renderList(data);
    }

    updateBadge(count) {
        if (count > 0) {
            this.badge.style.display = 'flex';
            this.badge.textContent = count > 9 ? '9+' : count;
        } else {
            this.badge.style.display = 'none';
        }
    }

    renderList(notifications) {
        this.list.innerHTML = '';
        
        if (notifications.length === 0) {
            this.list.innerHTML = '<div class="noti-empty">No notifications caught yet.</div>';
            return;
        }

        notifications.forEach(noti => {
            const timeAgo = new Date(noti.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const item = document.createElement('a');
            item.href = noti.link || '#';
            item.className = `noti-item ${!noti.is_read ? 'unread' : ''}`;
            item.innerHTML = `
                <div class="noti-title">${noti.title}</div>
                <div class="noti-msg">${noti.message}</div>
                <div class="noti-time">${timeAgo}</div>
            `;
            
            // Mark as read when clicked
            item.addEventListener('click', async () => {
                if (!noti.is_read) {
                    await supabase.from('notifications').update({ is_read: true }).eq('id', noti.id);
                }
            });

            this.list.appendChild(item);
        });
    }

    subscribeToRealtime() {
        // Listen for new notifications instantly
        supabase.channel('public:notifications')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'notifications',
                filter: `profile_id=eq.${this.userId}`
            }, () => {
                this.loadNotifications(); // Reload list and badge when a new one arrives
            })
            .subscribe();
    }
}