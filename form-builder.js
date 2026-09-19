// form-builder.js
import { supabase } from '../config.js';

export class FormBuilder {
    constructor(formId = null) {
        this.formId = formId;
        this.schema = {
            title: 'Untitled Form',
            description: 'Enter a description for this form.',
            theme: {
                primaryColor: '#4F46E5',
                bgColor: '#F8FAFC',
                fieldBgColor: '#FFFFFF',
                fontFamily: 'Inter',
                headerImage: '',
                formLogo: '',
                borderRadius: '8px',
                textAlign: 'left'
            },
            fields: []
        };
        this.selectedFieldIndex = null;

        // DOM Elements
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
        if (this.formId) await this.loadForm(this.formId);
        this.bindHeaderInputs();
        this.initDragAndDrop();
        this.initTabs();
        this.initThemeControls();
        this.renderCanvas();
    }

    async loadForm(id) {
        try {
            const { data, error } = await supabase.from('forms').select('*').eq('id', id).single();
            if (error) throw error;
            if (data.schema) {
                this.schema = { ...this.schema, ...data.schema, theme: { ...this.schema.theme, ...(data.schema.theme || {}) } };
            }
            this.titleInput.value = this.schema.title;
            this.descInput.value = this.schema.description;
            this.applyTheme();
        } catch (error) {
            console.error("Failed to load schema:", error);
        }
    }

    // === UPLOAD ENGINE ===
    async uploadAsset(file) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `themes/${fileName}`;
            
            const { error } = await supabase.storage.from('form_assets').upload(filePath, file);
            if (error) throw error;
            
            const { data } = supabase.storage.from('form_assets').getPublicUrl(filePath);
            return data.publicUrl;
        } catch (err) {
            alert('Upload failed: ' + err.message);
            return null;
        }
    }

    async handleFileUpload(e, callback) {
        const file = e.target.files[0];
        if (!file) return;
        
        const labelBtn = e.target.closest('label');
        const originalContent = labelBtn.innerHTML;
        labelBtn.innerHTML = '<span style="font-size: 0.65rem;">Uploading...</span>';
        
        const url = await this.uploadAsset(file);
        
        labelBtn.innerHTML = originalContent;
        lucide.createIcons();
        
        if (url) callback(url);
    }

    initTabs() {
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.sidebar-tab, .tab-content').forEach(el => el.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.target).classList.add('active');
            });
        });
    }

    bindHeaderInputs() {
        this.titleInput.addEventListener('input', (e) => this.schema.title = e.target.value);
        this.descInput.addEventListener('input', (e) => this.schema.description = e.target.value);
    }

    initThemeControls() {
        const bindInput = (id, key) => {
            const el = document.getElementById(id);
            if(el) {
                el.value = this.schema.theme[key];
                el.addEventListener('input', (e) => { this.schema.theme[key] = e.target.value; this.applyTheme(); });
            }
        };

        bindInput('themePrimaryColor', 'primaryColor');
        bindInput('themeBgColor', 'bgColor');
        bindInput('themeFieldBgColor', 'fieldBgColor');
        bindInput('themeFont', 'fontFamily');
        bindInput('themeBorderRadius', 'borderRadius');
        
        // Form Logo Controls (URL + Local Upload)
        bindInput('themeFormLogo', 'formLogo');
        const uploadLogoEl = document.getElementById('uploadFormLogo');
        if(uploadLogoEl) {
            uploadLogoEl.addEventListener('change', (e) => {
                this.handleFileUpload(e, (url) => {
                    document.getElementById('themeFormLogo').value = url;
                    this.schema.theme.formLogo = url;
                    this.applyTheme();
                });
            });
        }

        // Header Image Controls (URL + Local Upload)
        bindInput('themeHeaderImage', 'headerImage');
        const uploadHeaderEl = document.getElementById('uploadHeaderImage');
        if(uploadHeaderEl) {
            uploadHeaderEl.addEventListener('change', (e) => {
                this.handleFileUpload(e, (url) => {
                    document.getElementById('themeHeaderImage').value = url;
                    this.schema.theme.headerImage = url;
                    this.applyTheme();
                });
            });
        }

        // Global Text Alignment
        document.querySelectorAll('.theme-align-btn').forEach(btn => {
            if (btn.dataset.align === this.schema.theme.textAlign) btn.classList.add('active');
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.theme-align-btn').forEach(b => b.classList.remove('active'));
                const align = e.currentTarget.dataset.align;
                e.currentTarget.classList.add('active');
                this.schema.theme.textAlign = align;
                this.applyTheme();
            });
        });
    }

    applyTheme() {
        this.formPaper.style.fontFamily = this.schema.theme.fontFamily;
        document.querySelector('.builder-canvas').style.backgroundColor = this.schema.theme.bgColor;
        
        if (this.schema.theme.headerImage) {
            this.headerImageEl.src = this.schema.theme.headerImage;
            this.headerImageEl.style.display = 'block';
        } else {
            this.headerImageEl.style.display = 'none';
        }

        if (this.schema.theme.formLogo) {
            this.formLogoEl.src = this.schema.theme.formLogo;
            this.formLogoEl.style.display = 'block';
        } else {
            this.formLogoEl.style.display = 'none';
        }

        this.titleInput.style.textAlign = this.schema.theme.textAlign;
        this.descInput.style.textAlign = this.schema.theme.textAlign;

        this.renderCanvas();
    }

    initDragAndDrop() {
        const items = document.querySelectorAll('.draggable-item');
        items.forEach(item => {
            item.addEventListener('dragstart', (e) => e.dataTransfer.setData('type', item.dataset.type));
        });

        this.dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropzone.classList.add('drag-over');
        });

        this.dropzone.addEventListener('dragleave', () => this.dropzone.classList.remove('drag-over'));

        this.dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropzone.classList.remove('drag-over');
            const type = e.dataTransfer.getData('type');
            if (type) this.addField(type); 
        });
    }

    addField(type) {
        this.schema.fields.push({
            id: 'field_' + Math.random().toString(36).substr(2, 9),
            type: type,
            label: type === 'section' ? 'New Section' : `New ${type.replace('_', ' ')} Question`,
            description: '',
            required: false,
            placeholder: '',
            imageUrl: '',
            align: 'left',
            options: ['select', 'radio', 'checkbox'].includes(type) ? ['Option 1', 'Option 2'] : null,
            validation: { min: null, max: null }
        });
        
        this.selectedFieldIndex = this.schema.fields.length - 1;
        document.querySelector('.sidebar-tab[data-target="propertiesPanel"]').click();
        this.renderCanvas();
        this.renderProperties();
    }

    deleteField(index) {
        this.schema.fields.splice(index, 1);
        this.selectedFieldIndex = null;
        this.renderCanvas();
        this.renderProperties();
    }

    renderCanvas() {
        this.dropzone.innerHTML = '';
        if (this.schema.fields.length === 0) {
            this.dropzone.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-light); border: 2px dashed var(--border-light);">Drag fields here</div>`;
            return;
        }

        this.schema.fields.forEach((field, index) => {
            const fieldEl = document.createElement('div');
            fieldEl.draggable = true;
            
            fieldEl.style.backgroundColor = this.schema.theme.fieldBgColor;
            fieldEl.style.borderRadius = this.schema.theme.borderRadius;
            fieldEl.style.textAlign = field.align || this.schema.theme.textAlign;

            if (field.type === 'section') {
                fieldEl.className = `canvas-section-break ${this.selectedFieldIndex === index ? 'selected' : ''}`;
                fieldEl.style.backgroundColor = this.schema.theme.primaryColor;
                fieldEl.style.color = '#fff';
                fieldEl.innerHTML = `
                    <div style="display: flex; justify-content: space-between; width: 100%;">
                        <span><i data-lucide="layers" style="width:16px; margin-right:8px; vertical-align:middle;"></i> ${field.label}</span>
                        <div class="field-actions" style="position:static; display:flex; box-shadow:none; background:transparent; border:none;">
                            <i data-lucide="grip-vertical" style="cursor:grab; margin-right:8px; opacity:0.7;"></i>
                            <button class="icon-btn delete-btn" style="color:white; padding:0;"><i data-lucide="trash-2"></i></button>
                        </div>
                    </div>
                    ${field.description ? `<p style="font-size:0.8rem; margin-top:8px; opacity:0.9;">${field.description}</p>` : ''}
                `;
            } else {
                fieldEl.className = `canvas-field ${this.selectedFieldIndex === index ? 'selected' : ''}`;
                if (this.selectedFieldIndex === index) fieldEl.style.borderColor = this.schema.theme.primaryColor;

                let inputPreview = '';
                if (['short_text', 'email', 'phone', 'number', 'date', 'time'].includes(field.type)) {
                    inputPreview = `<input type="text" class="form-control" placeholder="${field.placeholder}" disabled style="background:#f8fafc;">`;
                } else if (field.type === 'long_text') {
                    inputPreview = `<textarea class="form-control" placeholder="${field.placeholder}" disabled style="background:#f8fafc;"></textarea>`;
                } else if (['radio', 'checkbox'].includes(field.type)) {
                    inputPreview = field.options.map(opt => `<div style="margin-bottom:8px; text-align: left;"><input type="${field.type}" disabled> <span style="color:var(--text-muted)">${opt}</span></div>`).join('');
                } else if (field.type === 'select') {
                    inputPreview = `<select class="form-control" disabled><option>${field.options[0]}</option></select>`;
                } else if (field.type === 'file') {
                    inputPreview = `<div style="padding: 12px; border: 1px dashed var(--border-strong); background: #f8fafc; color: var(--text-muted); text-align:center;"><i data-lucide="upload-cloud"></i> File Upload Area</div>`;
                }

                fieldEl.innerHTML = `
                    <div class="field-actions">
                        <i data-lucide="grip-vertical" style="cursor:grab; padding: 4px; color: var(--text-muted);"></i>
                        <button class="icon-btn delete-btn" title="Delete"><i data-lucide="trash-2"></i></button>
                    </div>
                    <label style="display:block; font-weight:600; margin-bottom:8px; font-size: 0.95rem;">
                        ${field.label} ${field.required ? '<span style="color:var(--danger)">*</span>' : ''}
                    </label>
                    ${field.description ? `<p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">${field.description}</p>` : ''}
                    ${field.imageUrl ? `<img src="${field.imageUrl}" class="field-image-preview">` : ''}
                    ${inputPreview}
                `;
            }

            fieldEl.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                e.dataTransfer.setData('sourceIndex', index);
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => fieldEl.classList.add('dragging'), 0);
            });

            fieldEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const dragging = document.querySelector('.dragging');
                if (dragging && dragging !== fieldEl) {
                    fieldEl.classList.add('drag-over-target');
                }
            });

            fieldEl.addEventListener('dragleave', () => fieldEl.classList.remove('drag-over-target'));

            fieldEl.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fieldEl.classList.remove('drag-over-target');
                
                const sourceIndexStr = e.dataTransfer.getData('sourceIndex');
                if (sourceIndexStr !== '') {
                    const from = parseInt(sourceIndexStr);
                    const to = index;
                    if (from !== to) {
                        const [movedItem] = this.schema.fields.splice(from, 1);
                        this.schema.fields.splice(to, 0, movedItem);
                        this.selectedFieldIndex = to;
                        this.renderCanvas();
                        this.renderProperties();
                    }
                }
            });

            fieldEl.addEventListener('dragend', () => fieldEl.classList.remove('dragging'));

            fieldEl.addEventListener('click', (e) => {
                if(!e.target.closest('.field-actions')) {
                    this.selectedFieldIndex = index;
                    this.renderCanvas();
                    this.renderProperties();
                }
            });

            fieldEl.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteField(index);
            });

            this.dropzone.appendChild(fieldEl);
        });

        lucide.createIcons();
    }

    renderProperties() {
        if (this.selectedFieldIndex === null) {
            this.propertiesPanel.innerHTML = `<div class="empty-properties"><i data-lucide="settings" style="width:32px;height:32px;"></i><p>Select a field to edit</p></div>`;
            lucide.createIcons();
            return;
        }

        const field = this.schema.fields[this.selectedFieldIndex];
        
        let html = `
            <div class="form-group">
                <label>Field Label / Question</label>
                <input type="text" class="form-control prop-label" value="${field.label}">
            </div>
            <div class="form-group">
                <label>Help Text / Description</label>
                <textarea class="form-control prop-desc" rows="2" placeholder="Hint or instructions">${field.description || ''}</textarea>
            </div>
        `;

        html += `
            <div class="form-group">
                <label>Text Alignment</label>
                <div class="text-align-group">
                    <button class="text-align-btn field-align-btn ${field.align === 'left' ? 'active' : ''}" data-align="left"><i data-lucide="align-left"></i></button>
                    <button class="text-align-btn field-align-btn ${field.align === 'center' ? 'active' : ''}" data-align="center"><i data-lucide="align-center"></i></button>
                    <button class="text-align-btn field-align-btn ${field.align === 'right' ? 'active' : ''}" data-align="right"><i data-lucide="align-right"></i></button>
                </div>
            </div>
        `;

        if (field.type !== 'section') {
            html += `
                <div class="form-group">
                    <label>Attach Image</label>
                    <div style="display: flex; gap: 8px;">
                        <input type="url" class="form-control prop-image" value="${field.imageUrl || ''}" placeholder="Image URL" style="flex: 1;">
                        <label class="btn btn-outline" style="cursor: pointer; padding: 10px; margin: 0; min-width: 44px; display: flex; align-items: center; justify-content: center;">
                            <i data-lucide="upload-cloud"></i>
                            <input type="file" class="prop-image-upload" accept="image/png, image/jpeg, image/webp" style="display: none;">
                        </label>
                    </div>
                </div>
                <div class="form-group" style="display:flex; align-items:center; gap:8px; padding: 12px; background: var(--bg-surface-hover); border-radius: var(--radius-md);">
                    <input type="checkbox" class="prop-required" ${field.required ? 'checked' : ''} style="width: 18px; height: 18px;">
                    <label style="margin:0; font-weight: 600;">Required field</label>
                </div>
            `;
        }

        if (['short_text', 'long_text', 'email', 'phone', 'number'].includes(field.type)) {
            html += `
                <div class="form-group" style="margin-top: 16px;">
                    <label>Placeholder Text</label>
                    <input type="text" class="form-control prop-placeholder" value="${field.placeholder || ''}">
                </div>
                <div style="display: flex; gap: 12px; margin-top: 16px;">
                    <div class="form-group" style="flex: 1;">
                        <label>Min Length/Val</label>
                        <input type="number" class="form-control prop-min" value="${field.validation?.min || ''}">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label>Max Length/Val</label>
                        <input type="number" class="form-control prop-max" value="${field.validation?.max || ''}">
                    </div>
                </div>
            `;
        }
        
        if (field.options) {
            html += `
                <div class="form-group" style="margin-top: 16px;">
                    <label>Options (One per line)</label>
                    <textarea class="form-control prop-options" style="min-height: 120px;">${field.options.join('\n')}</textarea>
                </div>
            `;
        }

        this.propertiesPanel.innerHTML = html;
        lucide.createIcons();

        this.propertiesPanel.querySelector('.prop-label').addEventListener('input', (e) => { field.label = e.target.value; this.renderCanvas(); });
        this.propertiesPanel.querySelector('.prop-desc').addEventListener('input', (e) => { field.description = e.target.value; this.renderCanvas(); });
        
        const reqEl = this.propertiesPanel.querySelector('.prop-required');
        if(reqEl) reqEl.addEventListener('change', (e) => { field.required = e.target.checked; this.renderCanvas(); });

        const imgEl = this.propertiesPanel.querySelector('.prop-image');
        if(imgEl) imgEl.addEventListener('input', (e) => { field.imageUrl = e.target.value; this.renderCanvas(); });
        
        // Field Specific File Upload
        const imgUploadEl = this.propertiesPanel.querySelector('.prop-image-upload');
        if(imgUploadEl) {
            imgUploadEl.addEventListener('change', (e) => {
                this.handleFileUpload(e, (url) => {
                    field.imageUrl = url;
                    this.renderCanvas();
                    this.renderProperties();
                });
            });
        }

        const placeholderEl = this.propertiesPanel.querySelector('.prop-placeholder');
        if (placeholderEl) placeholderEl.addEventListener('input', (e) => { field.placeholder = e.target.value; this.renderCanvas(); });

        const optionsEl = this.propertiesPanel.querySelector('.prop-options');
        if (optionsEl) optionsEl.addEventListener('input', (e) => {
            field.options = e.target.value.split('\n').filter(s => s.trim() !== '');
            this.renderCanvas();
        });

        document.querySelectorAll('.field-align-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.field-align-btn').forEach(b => b.classList.remove('active'));
                const align = e.currentTarget.dataset.align;
                e.currentTarget.classList.add('active');
                field.align = align;
                this.renderCanvas();
            });
        });
    }

    getSchema() {
        return this.schema;
    }
}