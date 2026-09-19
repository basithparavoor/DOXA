// form-renderer.js
import { supabase } from '../config.js';
import { StorageAPI } from '../storage.js'; 

export class FormRenderer {
    constructor(containerId, formSlug) {
        this.container = document.getElementById(containerId);
        this.formSlug = formSlug;
        this.formData = null;
        this.init();
    }

    async init() {
        try {
            await this.loadForm();
            this.applyGlobalTheme();
            this.render();
            this.bindSubmit();
        } catch (error) {
            this.container.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--danger);">Error: ${error.message}</div>`;
        }
    }

    async loadForm() {
        const { data, error } = await supabase.from('forms').select('*, programmes(name)').eq('slug', this.formSlug).single();
        if (error || data.status !== 'PUBLISHED') throw new Error("Form is unavailable.");
        this.formData = data;
    }

    applyGlobalTheme() {
        const theme = this.formData.schema.theme || {};
        
        // Load fonts if necessary
        if (['Roboto', 'Lora', 'Montserrat'].includes(theme.fontFamily)) {
            const link = document.createElement('link');
            link.href = `https://fonts.googleapis.com/css2?family=${theme.fontFamily}:wght@400;500;600;700&display=swap`;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }

        // Apply App Background and Global Font
        document.body.style.backgroundColor = theme.bgColor || 'var(--bg-surface-hover)';
        document.body.style.fontFamily = theme.fontFamily || 'Inter, sans-serif';
        
        // CSS Variables Override for this form
        document.documentElement.style.setProperty('--primary', theme.primaryColor || '#4F46E5');
        
        // Inject dynamic field background and border radius styles securely
        const borderRadius = theme.borderRadius || '8px';
        const fieldBgColor = theme.fieldBgColor || '#FFFFFF';
        
        const style = document.createElement('style');
        style.innerHTML = `
            .public-form-container { border-radius: ${borderRadius}; }
            .field-wrapper { 
                background: ${fieldBgColor}; 
                border-radius: ${borderRadius};
                padding: 24px;
                margin-bottom: 24px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                border: 1px solid var(--border-light);
            }
            .public-input { border-radius: ${borderRadius}; }
        `;
        document.head.appendChild(style);
    }

    render() {
        const schema = this.formData.schema;
        const theme = schema.theme || {};
        const logoSrc = theme.formLogo || 'logo.png';
        const textAlign = theme.textAlign || 'left';
        const borderRadius = theme.borderRadius || '8px';

        // Pre-build complex HTML segments to avoid template nesting errors
        let headerImageHtml = '';
        if (theme.headerImage) {
            headerImageHtml = `<img src="${theme.headerImage}" style="width: 100%; height: 160px; object-fit: cover; border-radius: ${borderRadius} ${borderRadius} 0 0; display: block;" alt="Cover">`;
        }
        
        let headerRadiusStyle = '';
        if (!theme.headerImage) {
            headerRadiusStyle = `border-radius: ${borderRadius} ${borderRadius} 0 0;`;
        }

        let html = `
            <div class="public-form-container" style="max-width: 768px; margin: 0 auto;">
                ${headerImageHtml}
                
                <div class="public-form-header" style="background: var(--primary); color: white; padding: 40px; text-align: ${textAlign}; ${headerRadiusStyle}">
                    <img src="${logoSrc}" alt="Logo" style="height: 60px; width: auto; margin-bottom: 16px; object-fit: contain; border-radius: 4px;">
                    <h1 class="public-form-title">${schema.title}</h1>
                    <p class="public-form-desc">${schema.description}</p>
                </div>
                
                <form id="publicRespondentForm">
                    <div class="public-form-body" style="padding: 32px;">
        `;
        
        schema.fields.forEach(field => { html += this.renderField(field); });
        
        html += `
                    </div>
                    <div class="form-footer" style="padding: 32px; background: ${theme.fieldBgColor || '#FFFFFF'}; border-top: 1px solid var(--border-light); border-radius: 0 0 ${borderRadius} ${borderRadius};">
                        <button type="submit" class="btn btn-primary submit-btn" id="submitFormBtn" style="width: 100%; font-size: 1.1rem; padding: 14px; border-radius: ${borderRadius};">Submit Form</button>
                    </div>
                </form>
            </div>
        `;
        this.container.innerHTML = html;
    }

    renderField(field) {
        // Section Break Render
        if (field.type === 'section') {
            let descHtml = '';
            if (field.description) {
                descHtml = `<p style="color: var(--text-muted); margin-top: 8px; text-align: ${field.align || 'left'};">${field.description}</p>`;
            }
            return `
                <div style="margin: 40px 0 24px 0; padding-bottom: 12px; border-bottom: 2px solid var(--primary);">
                    <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--primary); text-align: ${field.align || 'left'};">${field.label}</h2>
                    ${descHtml}
                </div>
            `;
        }

        // Standard Field Render
        const req = field.required ? 'required' : '';
        const ast = field.required ? '<span class="field-required">*</span>' : '';
        const align = field.align || 'left';
        
        let inputHtml = '';
        
        if (field.type === 'file') {
            inputHtml = `<input type="file" name="${field.id}" class="public-input" ${req} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
                         <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Max size: 5MB. Formats: PDF, Image, Doc.</div>`;
        } else if (['short_text', 'email', 'phone', 'number', 'date', 'time'].includes(field.type)) {
            const typeMap = { short_text: 'text', email: 'email', phone: 'tel', number: 'number', date: 'date', time: 'time' };
            const minAttr = (field.validation && field.validation.min) ? `min="${field.validation.min}"` : '';
            const maxAttr = (field.validation && field.validation.max) ? `max="${field.validation.max}"` : '';
            
            inputHtml = `<input type="${typeMap[field.type]}" name="${field.id}" class="public-input" placeholder="${field.placeholder || ''}" ${req} ${minAttr} ${maxAttr}>`;
        } else if (field.type === 'long_text') {
            inputHtml = `<textarea name="${field.id}" class="public-input" placeholder="${field.placeholder || ''}" ${req}></textarea>`;
        } else if (field.type === 'select') {
            const optionsHtml = (field.options || []).map(opt => `<option value="${opt}">${opt}</option>`).join('');
            inputHtml = `<select name="${field.id}" class="public-input" ${req}><option value="" disabled selected>Select...</option>${optionsHtml}</select>`;
        } else if (field.type === 'radio') {
            const optionsHtml = (field.options || []).map(opt => `<label class="radio-label"><input type="radio" name="${field.id}" value="${opt}" ${req}><span>${opt}</span></label>`).join('');
            inputHtml = `<div class="radio-group" style="text-align: left;">${optionsHtml}</div>`;
        } else if (field.type === 'checkbox') {
            const optionsHtml = (field.options || []).map(opt => `<label class="radio-label"><input type="checkbox" name="${field.id}[]" value="${opt}"><span>${opt}</span></label>`).join('');
            inputHtml = `<div class="radio-group" style="text-align: left;">${optionsHtml}</div>`;
        }

        let descHtml = '';
        if (field.description) {
            descHtml = `<p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 16px;">${field.description}</p>`;
        }

        let imageHtml = '';
        if (field.imageUrl) {
            const alignStyle = align === 'center' ? 'margin-left:auto; margin-right:auto;' : '';
            imageHtml = `<img src="${field.imageUrl}" style="max-width: 100%; border-radius: var(--radius-md); margin-bottom: 16px; display: block; ${alignStyle}">`;
        }

        return `
            <div class="field-wrapper" style="text-align: ${align};">
                <label class="field-label" style="font-size: 1.1rem; margin-bottom: 12px;">${field.label} ${ast}</label>
                ${descHtml}
                ${imageHtml}
                ${inputHtml}
            </div>
        `;
    }

    bindSubmit() {
        const formEl = document.getElementById('publicRespondentForm');
        formEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submitFormBtn');
            btn.disabled = true;
            btn.textContent = 'Uploading files & Submitting...';

            try {
                const regId = `REG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
                const formData = new FormData(formEl);
                const answers = {};

                for (let [key, value] of formData.entries()) {
                    if (key.endsWith('[]')) {
                        const cleanKey = key.slice(0, -2);
                        if (!answers[cleanKey]) answers[cleanKey] = [];
                        answers[cleanKey].push(value);
                    } else if (value instanceof File && value.size > 0) {
                        const path = await StorageAPI.uploadFile(value, this.formData.programme_id, regId);
                        answers[key] = { type: 'file', path: path, name: value.name };
                    } else if (!(value instanceof File)) {
                        answers[key] = value;
                    }
                }

                const payload = {
                    registration_id: regId,
                    form_id: this.formData.id,
                    programme_id: this.formData.programme_id,
                    data: answers,
                    status: 'SUBMITTED'
                };

                const { error } = await supabase.from('responses').insert([payload]);
                if (error) throw error;
                window.location.href = `success.html?reg_id=${regId}&form=${encodeURIComponent(this.formData.schema.title)}`;

            } catch (error) {
                alert('Submission failed: ' + error.message);
                btn.disabled = false;
                btn.textContent = 'Submit Form';
            }
        });
    }
}