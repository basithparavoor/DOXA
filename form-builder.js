import { supabase } from './config.js';

export class FormBuilder {
    constructor(formId = null) {
        this.formId = formId;
        this.schema = {
            title: 'Untitled Form', description: 'Enter a description for this form.',
            theme: { primaryColor: '#4F46E5', bgColor: '#F8FAFC', fieldBgColor: '#FFFFFF', fontFamily: 'Inter', headerImage: '', formLogo: '', borderRadius: '8px', textAlign: 'left' },
            fields: []
        };
        this.selectedFieldIndex = null;
        this.channel = null;
        this.myUserId = `admin_${Math.floor(Math.random() * 10000)}`;

        this.dropzone = document.getElementById('canvasDropzone');
        this.propertiesPanel = document.getElementById('propertiesPanel');
        this.titleInput = document.getElementById('formTitleInput');
        this.descInput = document.getElementById('formDescInput');
        this.headerImageEl = document.getElementById('canvasHeaderImage');
        this.formLogoEl = document.getElementById('canvasFormLogo');
        this.formPaper = document.getElementById('formPaper');

        this.init();
    }

    async init() {
        if (this.formId) {
            await this.loadForm(this.formId);
            this.initMultiplayer();
        }
        this.bindHeaderInputs(); 
        this.initDragAndDrop(); 
        this.initTapToAdd(); 
        this.initTabs(); 
        this.initThemeControls(); 
        this.renderCanvas();
    }

    initTapToAdd() {
        document.querySelectorAll('.draggable-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                if (type) {
                    this.addField(type);
                    if (window.innerWidth <= 900 && window.switchMobileView) window.switchMobileView('canvas');
                }
            });
        });
    }

    initMultiplayer() {
        this.channel = supabase.channel(`form_builder_${this.formId}`);
        this.channel.on('broadcast', { event: 'schema_sync' }, (payload) => {
            this.schema = payload.schema; this.titleInput.value = this.schema.title; this.descInput.value = this.schema.description;
            this.applyTheme(); this.renderCanvas(); this.renderProperties();
        });
        this.channel.on('broadcast', { event: 'cursor_move' }, (payload) => {
            if (window.innerWidth > 900) this.renderRemoteCursor(payload.userId, payload.x, payload.y);
        });
        this.channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                const badge = document.getElementById('statusBadge');
                if (badge) { badge.innerHTML = '<i data-lucide="users" style="width:12px; margin-right:4px;"></i> Live'; badge.className = 'badge badge-success'; lucide.createIcons(); }
            }
        });
        let lastMove = 0;
        document.addEventListener('mousemove', (e) => {
            const now = Date.now();
            if (now - lastMove > 50 && this.channel && window.innerWidth > 900) {
                lastMove = now; this.channel.send({ type: 'broadcast', event: 'cursor_move', payload: { userId: this.myUserId, x: e.clientX, y: e.clientY } });
            }
        });
    }

    broadcastSchema() { if (this.channel) this.channel.send({ type: 'broadcast', event: 'schema_sync', payload: { schema: this.schema } }); }

    renderRemoteCursor(id, x, y) {
        let cursor = document.getElementById(`cursor_${id}`);
        if (!cursor) {
            cursor = document.createElement('div'); cursor.id = `cursor_${id}`; cursor.style.position = 'fixed'; cursor.style.pointerEvents = 'none'; cursor.style.zIndex = '9999';
            cursor.innerHTML = `<i data-lucide="mouse-pointer-2" style="color: var(--primary); fill: var(--primary); width: 16px;"></i><div style="background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-top: 4px;">Admin</div>`;
            document.body.appendChild(cursor); lucide.createIcons();
        }
        cursor.style.left = `${x}px`; cursor.style.top = `${y}px`;
        clearTimeout(cursor.timeout); cursor.timeout = setTimeout(() => cursor.remove(), 3000);
    }

    loadSchema(newSchema) {
        // Safely merge incoming data with default theme settings to prevent crashes
        this.schema = {
            title: newSchema.title || 'Untitled Form',
            description: newSchema.description || '',
            theme: {
                primaryColor: '#4F46E5', 
                bgColor: '#F8FAFC', 
                fieldBgColor: '#FFFFFF', 
                fontFamily: 'Inter', 
                headerImage: '', 
                formLogo: '', 
                borderRadius: '8px', 
                textAlign: 'left',
                ...(newSchema.theme || {}) // Override defaults if the JSON happens to include a theme
            },
            fields: newSchema.fields || []
        };
        
        // Update UI
        this.titleInput.value = this.schema.title;
        this.descInput.value = this.schema.description;
        this.selectedFieldIndex = null;
        
        // Re-render everything
        this.applyTheme(); 
        this.broadcastSchema();
    }

    async loadForm(id) {
        try {
            const { data, error } = await supabase.from('forms').select('*').eq('id', id).single();
            if (error) throw error;
            if (data.schema) this.schema = { ...this.schema, ...data.schema, theme: { ...this.schema.theme, ...(data.schema.theme || {}) } };
            this.titleInput.value = this.schema.title; this.descInput.value = this.schema.description; this.applyTheme();
        } catch (error) { console.error("Failed to load schema:", error); }
    }

    async uploadAsset(file) {
        try {
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
            const { error } = await supabase.storage.from('form_assets').upload(`themes/${fileName}`, file);
            if (error) throw error;
            const { data } = supabase.storage.from('form_assets').getPublicUrl(`themes/${fileName}`);
            return data.publicUrl;
        } catch (err) { alert('Upload failed: ' + err.message); return null; }
    }

    async handleFileUpload(e, callback) {
        const file = e.target.files[0]; if (!file) return;
        const labelBtn = e.target.closest('label'); const originalContent = labelBtn.innerHTML;
        labelBtn.innerHTML = '<span style="font-size: 0.65rem;">Uploading...</span>';
        const url = await this.uploadAsset(file);
        labelBtn.innerHTML = originalContent; lucide.createIcons();
        if (url) callback(url);
    }

    initTabs() {
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.sidebar-tab, .tab-content').forEach(el => el.classList.remove('active'));
                tab.classList.add('active'); document.getElementById(tab.dataset.target).classList.add('active');
            });
        });
    }

    bindHeaderInputs() {
        this.titleInput.addEventListener('input', (e) => { this.schema.title = e.target.value; this.broadcastSchema(); });
        this.descInput.addEventListener('input', (e) => { this.schema.description = e.target.value; this.broadcastSchema(); });
    }

    initThemeControls() {
        const bindInput = (id, key) => { const el = document.getElementById(id); if(el) { el.value = this.schema.theme[key]; el.addEventListener('input', (e) => { this.schema.theme[key] = e.target.value; this.applyTheme(); this.broadcastSchema(); }); } };
        bindInput('themePrimaryColor', 'primaryColor'); bindInput('themeBgColor', 'bgColor'); bindInput('themeFieldBgColor', 'fieldBgColor'); bindInput('themeFont', 'fontFamily'); bindInput('themeBorderRadius', 'borderRadius');
        
        const uploadLogoEl = document.getElementById('uploadFormLogo');
        if(uploadLogoEl) uploadLogoEl.addEventListener('change', (e) => this.handleFileUpload(e, (url) => { document.getElementById('themeFormLogo').value = url; this.schema.theme.formLogo = url; this.applyTheme(); this.broadcastSchema(); }));
        const uploadHeaderEl = document.getElementById('uploadHeaderImage');
        if(uploadHeaderEl) uploadHeaderEl.addEventListener('change', (e) => this.handleFileUpload(e, (url) => { document.getElementById('themeHeaderImage').value = url; this.schema.theme.headerImage = url; this.applyTheme(); this.broadcastSchema(); }));

        document.querySelectorAll('.theme-align-btn').forEach(btn => {
            if (btn.dataset.align === this.schema.theme.textAlign) btn.classList.add('active');
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.theme-align-btn').forEach(b => b.classList.remove('active')); e.currentTarget.classList.add('active');
                this.schema.theme.textAlign = e.currentTarget.dataset.align; this.applyTheme(); this.broadcastSchema();
            });
        });
    }

    applyTheme() {
        this.formPaper.style.fontFamily = this.schema.theme.fontFamily; document.querySelector('.builder-canvas').style.backgroundColor = this.schema.theme.bgColor;
        this.headerImageEl.src = this.schema.theme.headerImage; this.headerImageEl.style.display = this.schema.theme.headerImage ? 'block' : 'none';
        this.formLogoEl.src = this.schema.theme.formLogo; this.formLogoEl.style.display = this.schema.theme.formLogo ? 'block' : 'none';
        this.titleInput.style.textAlign = this.schema.theme.textAlign; this.descInput.style.textAlign = this.schema.theme.textAlign;
        this.renderCanvas();
    }

    initDragAndDrop() {
        const items = document.querySelectorAll('.draggable-item');
        items.forEach(item => item.addEventListener('dragstart', (e) => e.dataTransfer.setData('type', item.dataset.type)));
        this.dropzone.addEventListener('dragover', (e) => { e.preventDefault(); this.dropzone.classList.add('drag-over'); });
        this.dropzone.addEventListener('dragleave', () => this.dropzone.classList.remove('drag-over'));
        this.dropzone.addEventListener('drop', (e) => { e.preventDefault(); this.dropzone.classList.remove('drag-over'); const type = e.dataTransfer.getData('type'); if (type) this.addField(type); });
    }

    addField(type) {
        const newField = {
            id: 'field_' + Math.random().toString(36).substr(2, 9),
            type: type, label: type === 'section' ? 'New Section' : (type === 'payment' ? 'Payment Details' : `New ${type.replace('_', ' ')} Question`),
            description: '', required: true, placeholder: '', imageUrl: '', align: 'left',
            logic: { fieldId: '', value: '' },
            options: ['select', 'radio', 'checkbox', 'rank'].includes(type) ? ['Option 1', 'Option 2'] : null,
            limits: ['select', 'radio', 'checkbox'].includes(type) ? [] : null,
            validation: { min: null, max: null }
        };
        if (type === 'matrix') { newField.rows = ['Item 1', 'Item 2']; newField.columns = ['Poor', 'Average', 'Excellent']; }
        if (['radio', 'select', 'checkbox'].includes(type)) { newField.enableScoring = false; newField.scores = [0, 0]; }
        if (type === 'payment') { newField.amount = 10; newField.currency = 'USD'; }

        this.schema.fields.push(newField);
        this.selectedFieldIndex = this.schema.fields.length - 1;
        document.querySelector('.sidebar-tab[data-target="propertiesPanel"]').click();
        this.renderCanvas(); this.renderProperties(); this.broadcastSchema();
    }

    moveField(index, direction) {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= this.schema.fields.length) return;
        const [movedItem] = this.schema.fields.splice(index, 1);
        this.schema.fields.splice(targetIndex, 0, movedItem);
        this.selectedFieldIndex = targetIndex;
        this.renderCanvas(); this.renderProperties(); this.broadcastSchema();
    }

    deleteField(index) { 
        this.schema.fields.splice(index, 1); this.selectedFieldIndex = null; 
        this.renderCanvas(); this.renderProperties(); this.broadcastSchema();
    }

    renderCanvas() {
        this.dropzone.innerHTML = '';
        if (this.schema.fields.length === 0) return this.dropzone.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-light); border: 2px dashed var(--border-light); border-radius: var(--radius-md);">Tap <strong>+ Elements</strong> to add your first question</div>`;

        this.schema.fields.forEach((field, index) => {
            const fieldEl = document.createElement('div');
            fieldEl.draggable = true; fieldEl.style.backgroundColor = this.schema.theme.fieldBgColor; fieldEl.style.borderRadius = this.schema.theme.borderRadius; fieldEl.style.textAlign = field.align || this.schema.theme.textAlign;
            
            const logicBadge = (field.logic && field.logic.fieldId) ? `<div style="font-size: 0.7rem; color: var(--primary); font-weight: 600; margin-bottom: 4px; margin-top: 8px;"><i data-lucide="git-branch" style="width:12px;"></i> ${field.type === 'section' ? 'Page-Level Routing Active' : 'Conditional Logic'}</div>` : '';
            const scoreBadge = field.enableScoring ? `<div style="font-size: 0.7rem; color: #10B981; font-weight: 600; margin-bottom: 4px;"><i data-lucide="check-circle" style="width:12px;"></i> Quiz Scoring Active</div>` : '';

            const actionsHtml = `
                <div class="field-actions" style="display:flex; align-items:center; gap:2px;">
                    <button type="button" class="icon-btn move-up-btn" title="Move Up" ${index === 0 ? 'disabled style="opacity:0.3;"' : ''}><i data-lucide="chevron-up"></i></button>
                    <button type="button" class="icon-btn move-down-btn" title="Move Down" ${index === this.schema.fields.length - 1 ? 'disabled style="opacity:0.3;"' : ''}><i data-lucide="chevron-down"></i></button>
                    <i data-lucide="grip-vertical" style="cursor:grab; padding: 4px; color: var(--text-muted);" class="desktop-only-grip"></i>
                    <button type="button" class="icon-btn delete-btn" title="Delete" style="color:var(--danger);"><i data-lucide="trash-2"></i></button>
                </div>
            `;

            if (field.type === 'section') {
                fieldEl.className = `canvas-section-break ${this.selectedFieldIndex === index ? 'selected' : ''}`;
                fieldEl.style.backgroundColor = this.schema.theme.primaryColor; fieldEl.style.color = '#fff';
                fieldEl.innerHTML = `<div style="display: flex; justify-content: space-between; width: 100%; align-items: center;"><span><i data-lucide="layers" style="width:16px; margin-right:8px; vertical-align:middle;"></i> ${field.label}</span>${actionsHtml}</div>${field.description ? `<p style="font-size:0.8rem; margin-top:8px; opacity:0.9;">${field.description}</p>` : ''}${logicBadge ? `<div style="color:#fff; opacity:0.9;">${logicBadge}</div>` : ''}`;
            } else {
                fieldEl.className = `canvas-field ${this.selectedFieldIndex === index ? 'selected' : ''}`;
                if (this.selectedFieldIndex === index) fieldEl.style.borderColor = this.schema.theme.primaryColor;

                let inputPreview = '';
                if (['short_text', 'email', 'phone', 'number', 'date', 'time'].includes(field.type)) { inputPreview = `<input type="text" class="form-control" placeholder="${field.placeholder}" disabled style="background:#f8fafc;">`; } 
                else if (field.type === 'long_text') { inputPreview = `<textarea class="form-control" placeholder="${field.placeholder}" disabled style="background:#f8fafc;"></textarea>`; } 
                else if (['radio', 'checkbox'].includes(field.type)) { inputPreview = field.options.map(opt => `<div style="margin-bottom:8px; text-align: left;"><input type="${field.type}" disabled> <span style="color:var(--text-muted)">${opt}</span></div>`).join(''); } 
                else if (field.type === 'select') { inputPreview = `<select class="form-control" disabled><option>${field.options[0]}</option></select>`; } 
                else if (field.type === 'rank') { inputPreview = field.options.map(opt => `<div style="padding:10px; margin-bottom:6px; background:#fff; border:1px solid var(--border-light); border-radius:4px; display:flex; align-items:center; gap:8px;"><i data-lucide="grip-vertical" style="width:16px; color:var(--text-muted);"></i>${opt}</div>`).join(''); } 
                else if (field.type === 'file') { inputPreview = `<div style="padding: 12px; border: 1px dashed var(--border-strong); background: #f8fafc; color: var(--text-muted); text-align:center;"><i data-lucide="upload-cloud"></i> File Upload Area</div>`; } 
                else if (field.type === 'signature') { inputPreview = `<div style="padding: 12px; border: 1px dashed var(--border-strong); background: #f8fafc; color: var(--text-muted); text-align:center; height: 60px;"><i data-lucide="pen-tool"></i> Signature Area</div>`; } 
                else if (field.type === 'payment') { inputPreview = `<div style="padding: 16px; border: 1px solid var(--border-light); border-radius: var(--radius-md); background: #f8fafc;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;"><span style="font-weight:600; font-size:1.1rem;">Total Due</span><span style="font-weight:700; font-size:1.25rem; color:var(--primary);">${field.amount || 0} ${field.currency || 'USD'}</span></div><div style="padding: 12px; background: #fff; border: 1px solid var(--border-strong); border-radius: 4px; color: var(--text-muted);"><i data-lucide="credit-card" style="vertical-align:middle; width:18px; margin-right:8px;"></i> Card Information</div></div>`; } 
                else if (field.type === 'matrix') { inputPreview = `<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:0.85rem;"><thead><tr><th></th>${field.columns.map(c => `<th style="text-align:center; padding:8px; color:var(--text-muted);">${c}</th>`).join('')}</tr></thead><tbody>${field.rows.map(r => `<tr><td style="padding:8px; border-top:1px solid var(--border-light);">${r}</td>${field.columns.map(() => `<td style="text-align:center; padding:8px; border-top:1px solid var(--border-light);"><input type="radio" disabled></td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }

                fieldEl.innerHTML = `
                    ${actionsHtml}
                    ${logicBadge} ${scoreBadge}
                    <label style="display:block; font-weight:600; margin-bottom:8px; font-size: 0.95rem;">${field.label} ${field.required ? '<span style="color:var(--danger)">*</span>' : ''}</label>
                    ${field.description ? `<p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">${field.description}</p>` : ''}
                    ${field.imageUrl ? `<img src="${field.imageUrl}" class="field-image-preview">` : ''}
                    ${inputPreview}
                `;
            }

            fieldEl.addEventListener('dragstart', (e) => { e.stopPropagation(); e.dataTransfer.setData('sourceIndex', index); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => fieldEl.classList.add('dragging'), 0); });
            fieldEl.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); const dragging = document.querySelector('.dragging'); if (dragging && dragging !== fieldEl) fieldEl.classList.add('drag-over-target'); });
            fieldEl.addEventListener('dragleave', () => fieldEl.classList.remove('drag-over-target'));
            fieldEl.addEventListener('drop', (e) => {
                e.preventDefault(); e.stopPropagation(); fieldEl.classList.remove('drag-over-target');
                const from = parseInt(e.dataTransfer.getData('sourceIndex'));
                if (!isNaN(from) && from !== index) {
                    const [movedItem] = this.schema.fields.splice(from, 1); this.schema.fields.splice(index, 0, movedItem);
                    this.selectedFieldIndex = index; this.renderCanvas(); this.renderProperties(); this.broadcastSchema();
                }
            });
            fieldEl.addEventListener('dragend', () => fieldEl.classList.remove('dragging'));

            fieldEl.addEventListener('click', (e) => { 
                if (!e.target.closest('.field-actions')) { 
                    this.selectedFieldIndex = index; this.renderCanvas(); this.renderProperties(); 
                    if (window.innerWidth <= 900 && window.switchMobileView) window.switchMobileView('properties');
                } 
            });

            fieldEl.querySelector('.move-up-btn').addEventListener('click', (e) => { e.stopPropagation(); this.moveField(index, -1); });
            fieldEl.querySelector('.move-down-btn').addEventListener('click', (e) => { e.stopPropagation(); this.moveField(index, 1); });
            fieldEl.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); this.deleteField(index); });

            this.dropzone.appendChild(fieldEl);
        });
        lucide.createIcons();
    }

    renderProperties() {
        if (this.selectedFieldIndex === null) { 
            this.propertiesPanel.innerHTML = `<div class="empty-properties"><i data-lucide="settings" style="width:32px;height:32px;"></i><p>Select any question on the canvas to configure it.</p></div>`; 
            lucide.createIcons(); return; 
        }

        const field = this.schema.fields[this.selectedFieldIndex];
        let html = `
            <div class="form-group"><label>Field Label / Question</label><input type="text" class="form-control prop-label" value="${field.label}"></div>
            <div class="form-group"><label>Help Text / Description</label><textarea class="form-control prop-desc" rows="2">${field.description || ''}</textarea></div>
        `;

        // 1. CONDITIONAL LOGIC IS NOW AVAILABLE FOR SECTIONS TOO
        const availableFields = this.schema.fields.filter((f, idx) => f.id !== field.id && f.type !== 'section' && idx < this.selectedFieldIndex);
        const logicLabel = field.type === 'section' ? 'Page Logic (Skip page if condition not met)' : 'Conditional Logic (Show field if)';
        
        html += `
            <div class="form-group" style="margin-top: 16px; padding: 16px; background: var(--bg-surface-hover); border-radius: var(--radius-md); border: 1px solid var(--border-light);">
                <label style="display:flex; align-items:center; gap:8px; color: var(--primary);"><i data-lucide="git-branch" style="width:16px;"></i> ${logicLabel}</label>
                <select class="form-control prop-logic-field" style="margin-bottom: 8px; margin-top: 8px;"><option value="">Always show this ${field.type === 'section' ? 'page' : 'field'} (Default)</option>${availableFields.map(f => `<option value="${f.id}" ${field.logic?.fieldId === f.id ? 'selected' : ''}>Show if: ${f.label}</option>`).join('')}</select>
                <input type="text" class="form-control prop-logic-value" placeholder="Equals value (e.g., Yes)" value="${field.logic?.value || ''}" style="${field.logic?.fieldId ? 'display:block;' : 'display:none;'}">
            </div>
        `;

        if (field.type === 'matrix') {
            html += `<div class="form-group" style="margin-top: 16px;"><label>Rows (One per line)</label><textarea class="form-control prop-matrix-rows" style="min-height: 80px;">${field.rows.join('\n')}</textarea></div>
                     <div class="form-group" style="margin-top: 16px;"><label>Columns (One per line)</label><textarea class="form-control prop-matrix-cols" style="min-height: 80px;">${field.columns.join('\n')}</textarea></div>`;
        }

        if (field.options) {
            html += `<div class="form-group" style="margin-top: 16px;"><label>Options (One per line)</label><textarea class="form-control prop-options" style="min-height: 120px;">${field.options.join('\n')}</textarea></div>`;
            if (field.limits !== undefined) { html += `<div class="form-group" style="margin-top: 16px;"><label>Inventory / Slot Limits (One per line)</label><textarea class="form-control prop-limits" style="min-height: 80px;">${(field.limits || []).join('\n')}</textarea></div>`; }
        }

        if (field.type === 'payment') {
            html += `<div class="form-group" style="margin-top: 16px;"><label>Amount</label><input type="number" class="form-control prop-amount" value="${field.amount || 0}"></div>
                     <div class="form-group" style="margin-top: 16px;"><label>Currency</label><input type="text" class="form-control prop-currency" value="${field.currency || 'USD'}"></div>`;
        }

        if (['radio', 'select', 'checkbox'].includes(field.type)) {
            html += `
                <div class="form-group" style="margin-top: 16px; padding: 16px; background: var(--bg-surface-hover); border-radius: var(--radius-md); border: 1px dashed var(--border-strong);">
                    <label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" class="prop-enable-scoring" ${field.enableScoring ? 'checked' : ''}> Enable Quiz Scoring</label>
                    ${field.enableScoring ? `<div style="margin-top: 12px;">${field.options.map((opt, i) => `<div style="display:flex; gap:8px; margin-bottom:6px; align-items:center;"><span style="flex:1; font-size:0.875rem;">${opt}</span><input type="number" class="form-control prop-score-input" data-index="${i}" value="${field.scores && field.scores[i] ? field.scores[i] : 0}" style="width: 80px; padding: 4px 8px;"></div>`).join('')}</div>` : ''}
                </div>
            `;
        }

        if (field.type !== 'section') {
            html += `<div class="form-group" style="display:flex; align-items:center; gap:8px; margin-top: 16px; padding: 12px; background: var(--bg-surface-hover); border-radius: var(--radius-md);"><input type="checkbox" class="prop-required" ${field.required ? 'checked' : ''} style="width: 18px; height: 18px;"><label style="margin:0; font-weight: 600;">Required field</label></div>`;
        }

html += `
            <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border-light);">
                <button type="button" class="btn btn-outline prop-delete-btn" style="width: 100%; color: var(--danger); border-color: var(--danger); justify-content: center;">
                    <i data-lucide="trash-2" style="width:18px;"></i> Delete ${field.type === 'section' ? 'Section Break' : 'Question'}
                </button>
            </div>
        `;

        this.propertiesPanel.innerHTML = html; lucide.createIcons();

        const bindAndBroadcast = (selector, eventType, callback) => {
            const el = this.propertiesPanel.querySelector(selector);
            if(el) el.addEventListener(eventType, (e) => { callback(e); this.renderCanvas(); this.broadcastSchema(); });
        };

        bindAndBroadcast('.prop-label', 'input', (e) => field.label = e.target.value);
        bindAndBroadcast('.prop-desc', 'input', (e) => field.description = e.target.value);
        bindAndBroadcast('.prop-required', 'change', (e) => field.required = e.target.checked);
        
        const logicFieldEl = this.propertiesPanel.querySelector('.prop-logic-field'); 
        const logicValueEl = this.propertiesPanel.querySelector('.prop-logic-value');
        if (logicFieldEl) logicFieldEl.addEventListener('change', (e) => { if (!field.logic) field.logic = {}; field.logic.fieldId = e.target.value; logicValueEl.style.display = e.target.value ? 'block' : 'none'; this.renderCanvas(); this.broadcastSchema(); });
        if (logicValueEl) logicValueEl.addEventListener('input', (e) => { if (!field.logic) field.logic = {}; field.logic.value = e.target.value; this.broadcastSchema(); });

        bindAndBroadcast('.prop-options', 'input', (e) => { field.options = e.target.value.split('\n'); if (field.enableScoring) this.renderProperties(); });
        bindAndBroadcast('.prop-limits', 'input', (e) => field.limits = e.target.value.split('\n').map(s => s.trim()));
        bindAndBroadcast('.prop-amount', 'input', (e) => field.amount = parseFloat(e.target.value) || 0);
        bindAndBroadcast('.prop-currency', 'input', (e) => field.currency = e.target.value.toUpperCase());
        bindAndBroadcast('.prop-matrix-rows', 'input', (e) => field.rows = e.target.value.split('\n').filter(s => s.trim() !== ''));
        bindAndBroadcast('.prop-matrix-cols', 'input', (e) => field.columns = e.target.value.split('\n').filter(s => s.trim() !== ''));


const propDeleteBtn = this.propertiesPanel.querySelector('.prop-delete-btn');
        if (propDeleteBtn) {
            propDeleteBtn.addEventListener('click', () => {
                if (confirm(`Are you sure you want to delete this ${field.type === 'section' ? 'section' : 'field'}?`)) {
                    this.deleteField(this.selectedFieldIndex);
                    // On mobile, automatically return to canvas after deleting
                    if (window.innerWidth <= 900 && window.switchMobileView) {
                        window.switchMobileView('canvas');
                    }
                }
            });
        }

        const scoreToggle = this.propertiesPanel.querySelector('.prop-enable-scoring'); 
        if (scoreToggle) scoreToggle.addEventListener('change', (e) => { field.enableScoring = e.target.checked; this.renderProperties(); this.renderCanvas(); this.broadcastSchema(); });
        
        const scoreInputs = this.propertiesPanel.querySelectorAll('.prop-score-input'); 
        scoreInputs.forEach(inp => { 
            inp.addEventListener('input', (e) => { if (!field.scores) field.scores = []; field.scores[e.target.dataset.index] = parseFloat(e.target.value) || 0; this.broadcastSchema(); }); 
        });
    }
    
    getSchema() { return this.schema; }
}