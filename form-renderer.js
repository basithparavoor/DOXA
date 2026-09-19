import { supabase } from './config.js';
import { StorageAPI } from './storage.js'; 

export class FormRenderer {
    constructor(containerId, formSlug) {
        this.container = document.getElementById(containerId);
        this.formSlug = formSlug;
        this.formData = null;
        this.sessionToken = new URLSearchParams(window.location.search).get('session');
        this.savedData = {}; 
        this.inventoryCounts = {}; 
        this.currentPage = 0;
        this.pages = [];
        this.init();
    }

    async init() {
        try {
            await this.loadForm();
            await this.loadInventory();
            if (this.sessionToken) await this.loadSession();
            this.chunkPages();
            this.applyGlobalTheme();
            this.render();
            this.bindEvents();
            this.applyLogic(); 
            this.showPage(0);
        } catch (error) { this.container.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--danger);">Error: ${error.message}</div>`; }
    }

    async loadForm() {
        const { data, error } = await supabase.from('forms').select('*, programmes(name)').eq('slug', this.formSlug).single();
        if (error || data.status !== 'PUBLISHED') throw new Error("Form is unavailable.");
        if (data.expires_at && new Date(data.expires_at) < new Date()) throw new Error("This form has expired.");
        if (data.max_responses) {
            const { count } = await supabase.from('responses').select('*', { count: 'exact', head: true }).eq('form_id', data.id);
            if (count >= data.max_responses) throw new Error("This form has reached its maximum submissions.");
        }
        this.formData = data;
    }

    async loadInventory() {
        this.inventoryCounts = {};
        const { data, error } = await supabase.from('responses').select('data').eq('form_id', this.formData.id);
        if (!error && data) {
            data.forEach(res => {
                if (res.data) {
                    Object.values(res.data).forEach(val => {
                        if (Array.isArray(val)) { val.forEach(v => { this.inventoryCounts[v] = (this.inventoryCounts[v] || 0) + 1; }); } 
                        else if (typeof val === 'string') { this.inventoryCounts[val] = (this.inventoryCounts[val] || 0) + 1; }
                    });
                }
            });
        }
    }

    async loadSession() {
        const { data, error } = await supabase.from('saved_sessions').select('data').eq('session_token', this.sessionToken).single();
        if (!error && data) this.savedData = data.data || {};
    }

    chunkPages() {
        this.pages = [[]];
        let pageIndex = 0;
        this.formData.schema.fields.forEach((field, index) => {
            if (field.type === 'section' && index !== 0) { this.pages.push([]); pageIndex++; }
            this.pages[pageIndex].push(field);
        });
    }

    applyGlobalTheme() {
        const theme = this.formData.schema.theme || {};
        if (['Roboto', 'Lora', 'Montserrat'].includes(theme.fontFamily)) {
            const link = document.createElement('link'); link.href = `https://fonts.googleapis.com/css2?family=${theme.fontFamily}:wght@400;500;600;700&display=swap`; link.rel = 'stylesheet'; document.head.appendChild(link);
        }
        document.body.style.backgroundColor = theme.bgColor || 'var(--bg-surface-hover)';
        document.body.style.fontFamily = theme.fontFamily || 'Inter, sans-serif';
        document.documentElement.style.setProperty('--primary', theme.primaryColor || '#4F46E5');
    }

    render() {
        const schema = this.formData.schema; const theme = schema.theme || {}; const logoSrc = theme.formLogo || 'logo.png'; const borderRadius = theme.borderRadius || '8px';
        let headerImageHtml = theme.headerImage ? `<img src="${theme.headerImage}" style="width: 100%; height: 160px; object-fit: cover; border-radius: ${borderRadius} ${borderRadius} 0 0; display: block;">` : '';
        let headerRadiusStyle = !theme.headerImage ? `border-radius: ${borderRadius} ${borderRadius} 0 0;` : '';

        let html = `
            <div class="public-form-container" style="max-width: 768px; margin: 0 auto;">
                ${headerImageHtml}
                <div class="public-form-header" style="background: var(--primary); color: white; padding: 40px; text-align: ${theme.textAlign || 'left'}; ${headerRadiusStyle}">
                    <img src="${logoSrc}" alt="Logo" style="height: 60px; width: auto; margin-bottom: 16px; object-fit: contain; border-radius: 4px;">
                    <h1 class="public-form-title">${schema.title}</h1>
                    <p class="public-form-desc">${schema.description}</p>
                    ${this.pages.length > 1 ? `<div class="progress-bar"><div class="progress-fill" id="formProgress" style="width: 0%"></div></div>` : ''}
                </div>
                <form id="publicRespondentForm">
                    <div class="public-form-body" style="padding: 32px;">
        `;
        
        this.pages.forEach((pageFields, index) => {
            html += `<div class="wizard-page" id="page_${index}">`;
            pageFields.forEach(field => { html += this.renderField(field); });
            html += `</div>`;
        });
        
        html += `
                    </div>
                    <div class="form-footer" style="padding: 32px; background: ${theme.fieldBgColor || '#FFFFFF'}; border-top: 1px solid var(--border-light); border-radius: 0 0 ${borderRadius} ${borderRadius}; display: flex; gap: 12px; align-items: center;">
                        <button type="button" class="btn btn-outline" id="saveDraftBtn" style="flex: 1; justify-content: center; display: none;">Save Draft</button>
                        <button type="button" class="btn btn-outline" id="prevBtn" style="display: none;"><i data-lucide="arrow-left"></i> Back</button>
                        <button type="button" class="btn btn-primary" id="nextBtn" style="flex: 2; justify-content: center; font-size: 1.1rem; padding: 14px; border-radius: ${borderRadius};">Next Step</button>
                        <button type="submit" class="btn btn-primary submit-btn" id="submitFormBtn" style="display: none; flex: 2; font-size: 1.1rem; padding: 14px; border-radius: ${borderRadius}; justify-content: center;">Submit Form</button>
                    </div>
                </form>
            </div>
        `;
        this.container.innerHTML = html;
        this.bindSignatures(); lucide.createIcons();
    }

    renderField(field) {
        if (field.type === 'section') {
            let descHtml = field.description ? `<p style="color: var(--text-muted); margin-top: 8px; text-align: ${field.align || 'left'};">${field.description}</p>` : '';
            return `<div id="wrapper_${field.id}" style="margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid var(--primary);"><h2 style="font-size: 1.5rem; font-weight: 700; color: var(--primary); text-align: ${field.align || 'left'};">${field.label}</h2>${descHtml}</div>`;
        }

        const req = field.required ? 'required' : ''; const ast = field.required ? '<span class="field-required">*</span>' : ''; const align = field.align || 'left';
        const urlParams = new URLSearchParams(window.location.search); const paramLabel = field.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
        let prefillVal = this.savedData[field.id] !== undefined ? this.savedData[field.id] : (urlParams.get(field.id) || urlParams.get(paramLabel) || '');
        const placeholderText = field.placeholder || '';
        let inputHtml = '';
        
        if (field.type === 'signature') {
            inputHtml = `<div class="signature-pad-wrapper" style="border: 2px dashed var(--border-strong); border-radius: var(--radius-md); background: #fff; position: relative;"><canvas id="sig_${field.id}" width="400" height="150" class="signature-canvas" style="width: 100%; height: 150px; touch-action: none; cursor: crosshair;"></canvas><button type="button" class="btn btn-outline clear-sig-btn" data-target="sig_${field.id}" style="position: absolute; bottom: 8px; right: 8px; padding: 4px 8px; font-size: 0.75rem;">Clear</button><input type="hidden" name="${field.id}" id="input_${field.id}" class="logic-input" ${req} value="${prefillVal}"></div>`;
        } else if (field.type === 'file') {
            inputHtml = `<input type="file" name="${field.id}" class="public-input logic-input" ${req} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">`;
        } else if (['short_text', 'email', 'phone', 'number', 'date', 'time'].includes(field.type)) {
            const typeMap = { short_text: 'text', email: 'email', phone: 'tel', number: 'number', date: 'date', time: 'time' };
            inputHtml = `<input type="${typeMap[field.type]}" name="${field.id}" class="public-input logic-input" placeholder="${placeholderText}" value="${prefillVal}" ${req}>`;
        } else if (field.type === 'long_text') {
            inputHtml = `<textarea name="${field.id}" class="public-input logic-input" placeholder="${placeholderText}" ${req}>${prefillVal}</textarea>`;
        } else if (field.type === 'payment') {
            inputHtml = `<div style="padding: 16px; border: 1px solid var(--border-light); border-radius: var(--radius-md); background: #f8fafc;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;"><span style="font-weight:600; font-size:1.1rem;">Total Due</span><span style="font-weight:700; font-size:1.25rem; color:var(--primary);">${field.amount || 0} ${field.currency || 'USD'}</span></div><div style="padding: 12px; background: #fff; border: 1px solid var(--border-strong); border-radius: 4px; color: var(--text-muted); display:flex; align-items:center; gap:8px;"><i data-lucide="credit-card"></i> Card number, expiration, and CVC</div><input type="hidden" name="${field.id}" value="${field.amount}" class="logic-input"></div>`;
        } else if (field.type === 'select') {
            let optionsHtml = '';
            (field.options || []).forEach((opt, i) => {
                const limit = field.limits && field.limits[i] ? parseInt(field.limits[i]) : null;
                const isSoldOut = limit !== null && !isNaN(limit) && (this.inventoryCounts[opt] || 0) >= limit;
                optionsHtml += `<option value="${opt}" ${prefillVal === opt ? 'selected' : ''} ${isSoldOut ? 'disabled' : ''}>${opt}${isSoldOut ? ' (Sold Out)' : ''}</option>`;
            });
            inputHtml = `<select name="${field.id}" class="public-input logic-input" ${req}><option value="" disabled ${!prefillVal ? 'selected' : ''}>Select...</option>${optionsHtml}</select>`;
        } else if (field.type === 'radio') {
            let optionsHtml = '';
            (field.options || []).forEach((opt, i) => {
                const limit = field.limits && field.limits[i] ? parseInt(field.limits[i]) : null;
                const isSoldOut = limit !== null && !isNaN(limit) && (this.inventoryCounts[opt] || 0) >= limit;
                optionsHtml += `<label class="radio-label" style="${isSoldOut ? 'opacity:0.5; pointer-events:none;' : ''}"><input type="radio" name="${field.id}" class="logic-input" value="${opt}" ${req} ${prefillVal === opt ? 'checked' : ''} ${isSoldOut ? 'disabled' : ''}><span>${opt}${isSoldOut ? ' <span style="color:var(--danger); font-size:0.75rem;">(Sold Out)</span>' : ''}</span></label>`;
            });
            inputHtml = `<div class="radio-group" style="text-align: left;">${optionsHtml}</div>`;
        } else if (field.type === 'checkbox') {
            const prefillArr = typeof prefillVal === 'string' ? prefillVal.split(',').map(s => s.trim()) : (Array.isArray(prefillVal) ? prefillVal : []);
            let optionsHtml = '';
            (field.options || []).forEach((opt, i) => {
                const limit = field.limits && field.limits[i] ? parseInt(field.limits[i]) : null;
                const isSoldOut = limit !== null && !isNaN(limit) && (this.inventoryCounts[opt] || 0) >= limit;
                optionsHtml += `<label class="radio-label" style="${isSoldOut ? 'opacity:0.5; pointer-events:none;' : ''}"><input type="checkbox" name="${field.id}[]" class="logic-input" value="${opt}" ${prefillArr.includes(opt) ? 'checked' : ''} ${isSoldOut ? 'disabled' : ''}><span>${opt}${isSoldOut ? ' <span style="color:var(--danger); font-size:0.75rem;">(Sold Out)</span>' : ''}</span></label>`;
            });
            inputHtml = `<div class="radio-group" style="text-align: left;">${optionsHtml}</div>`;
        } else if (field.type === 'matrix') {
            let thead = `<tr><th></th>${(field.columns || []).map(c => `<th style="text-align:center; padding:12px 8px; font-weight:600; color:var(--text-main); font-size:0.875rem; min-width:80px;">${c}</th>`).join('')}</tr>`;
            let tbody = (field.rows || []).map(r => {
                let tr = `<tr><td style="padding:12px 8px; border-top:1px solid var(--border-light); font-weight:500; font-size:0.9rem;">${r}</td>`;
                tr += (field.columns || []).map(c => { const isChecked = prefillVal && prefillVal[r] === c ? 'checked' : ''; return `<td style="text-align:center; padding:12px 8px; border-top:1px solid var(--border-light);"><input type="radio" name="${field.id}[${r}]" class="logic-input" value="${c}" ${req} ${isChecked} style="width:18px; height:18px; cursor:pointer;"></td>`; }).join('');
                return tr + `</tr>`;
            }).join('');
            inputHtml = `<div style="overflow-x:auto; background:var(--bg-surface); border-radius:var(--radius-md); border:1px solid var(--border-light);"><table style="width:100%; border-collapse: collapse;"><thead style="background:var(--bg-surface-hover);">${thead}</thead><tbody>${tbody}</tbody></table></div>`;
        } else if (field.type === 'rank') {
            let currentOrder = prefillVal ? prefillVal.split(',').map(s => s.trim()) : (field.options || []);
            let itemsHtml = currentOrder.map(opt => `<div class="rank-item" data-id="${opt}" style="padding: 12px; margin-bottom: 8px; background: #fff; border: 1px solid var(--border-light); border-radius: 6px; display: flex; align-items: center; justify-content: space-between;"><div style="display:flex; align-items:center; gap:8px;"><i data-lucide="grip-vertical" style="color:var(--text-muted); width:16px;"></i> ${opt}</div><div style="display:flex; flex-direction:column; gap:4px;"><button type="button" class="btn btn-outline rank-up" style="padding:2px 4px; border:none; background:var(--bg-surface-hover);"><i data-lucide="chevron-up" style="width:14px;"></i></button><button type="button" class="btn btn-outline rank-down" style="padding:2px 4px; border:none; background:var(--bg-surface-hover);"><i data-lucide="chevron-down" style="width:14px;"></i></button></div></div>`).join('');
            inputHtml = `<div class="rank-container" style="background: var(--bg-surface-hover); padding: 12px; border-radius: var(--radius-md);">${itemsHtml}<input type="hidden" name="${field.id}" class="rank-hidden-input logic-input" value="${currentOrder.join(', ')}" ${req}></div>`;
        }

        let descHtml = field.description ? `<p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 16px;">${field.description}</p>` : '';
        let imageHtml = field.imageUrl ? `<img src="${field.imageUrl}" style="max-width: 100%; border-radius: var(--radius-md); margin-bottom: 16px; display: block; ${align === 'center' ? 'margin-left:auto; margin-right:auto;' : ''}">` : '';

        return `<div id="wrapper_${field.id}" class="field-wrapper" style="text-align: ${align};"><label class="field-label" style="font-size: 1.1rem; margin-bottom: 12px;">${field.label} ${ast}</label>${descHtml}${imageHtml}${inputHtml}</div>`;
    }

    // NEW: Page-Level Logic Evaluator
    isPageVisible(pageIndex) {
        if (pageIndex === 0) return true; // Always show the first page
        const pageFields = this.pages[pageIndex];
        const sectionField = pageFields.find(f => f.type === 'section');
        
        // If the section doesn't have a logic target, it's always visible
        if (!sectionField || !sectionField.logic || !sectionField.logic.fieldId) return true;

        const formEl = document.getElementById('publicRespondentForm');
        if (!formEl) return true;
        
        const currentFormData = new FormData(formEl);
        const targetValues = currentFormData.getAll(sectionField.logic.fieldId).concat(currentFormData.getAll(sectionField.logic.fieldId + '[]'));
        
        // Return true if the condition is met, otherwise false (skip page)
        return targetValues.some(val => val.toLowerCase().trim() === sectionField.logic.value.toLowerCase().trim());
    }

    showPage(n) {
        document.querySelectorAll('.wizard-page').forEach(el => el.classList.remove('active'));
        document.getElementById(`page_${n}`).classList.add('active');
        
        const prevBtn = document.getElementById('prevBtn'); 
        const nextBtn = document.getElementById('nextBtn'); 
        const submitBtn = document.getElementById('submitFormBtn'); 
        const saveBtn = document.getElementById('saveDraftBtn');

        // Look backwards to see if there is a visible previous page
        let hasPrev = false;
        for (let i = n - 1; i >= 0; i--) { if (this.isPageVisible(i)) { hasPrev = true; break; } }
        prevBtn.style.display = hasPrev ? 'inline-flex' : 'none';

        // Look forwards to see if there is a visible next page
        let hasNext = false;
        for (let i = n + 1; i < this.pages.length; i++) { if (this.isPageVisible(i)) { hasNext = true; break; } }

        if (!hasNext) { 
            nextBtn.style.display = 'none'; submitBtn.style.display = 'inline-flex'; saveBtn.style.display = 'inline-flex'; 
        } else { 
            nextBtn.style.display = 'inline-flex'; submitBtn.style.display = 'none'; saveBtn.style.display = 'none'; 
        }

        if (this.pages.length > 1) document.getElementById('formProgress').style.width = `${((n + 1) / this.pages.length) * 100}%`;
    }

    validateCurrentPage() {
        const inputs = document.getElementById(`page_${this.currentPage}`).querySelectorAll('input[required], select[required], textarea[required]');
        let valid = true; inputs.forEach(input => { if (!input.checkValidity()) { input.reportValidity(); valid = false; } }); return valid;
    }

    applyLogic() {
        const formEl = document.getElementById('publicRespondentForm'); if (!formEl) return;
        const currentFormData = new FormData(formEl);
        this.formData.schema.fields.forEach(field => {
            if (field.type === 'section') return;
            const wrapper = document.getElementById(`wrapper_${field.id}`); if (!wrapper) return;
            if (field.logic && field.logic.fieldId) {
                const targetValues = currentFormData.getAll(field.logic.fieldId).concat(currentFormData.getAll(field.logic.fieldId + '[]'));
                const conditionMet = targetValues.some(val => val.toLowerCase().trim() === field.logic.value.toLowerCase().trim());
                if (conditionMet) { wrapper.style.display = 'block'; if (field.required) wrapper.querySelectorAll('.logic-input').forEach(inp => inp.setAttribute('required', 'true')); }
                else { wrapper.style.display = 'none'; wrapper.querySelectorAll('.logic-input').forEach(inp => inp.removeAttribute('required')); }
            }
        });
    }

    bindEvents() {
        const formEl = document.getElementById('publicRespondentForm');
        formEl.addEventListener('change', () => this.applyLogic()); formEl.addEventListener('input', () => this.applyLogic());
        
        // NEW: Dynamic Next Page Navigation
        document.getElementById('nextBtn').addEventListener('click', () => { 
            if (this.validateCurrentPage()) { 
                let next = this.currentPage + 1;
                while (next < this.pages.length && !this.isPageVisible(next)) { next++; } // Skip invalid pages
                if (next < this.pages.length) {
                    this.currentPage = next; this.showPage(this.currentPage); window.scrollTo({ top: 0, behavior: 'smooth' }); 
                }
            }
        });
        
        // NEW: Dynamic Previous Page Navigation
        document.getElementById('prevBtn').addEventListener('click', () => { 
            let prev = this.currentPage - 1;
            while (prev >= 0 && !this.isPageVisible(prev)) { prev--; } // Skip invalid pages
            if (prev >= 0) {
                this.currentPage = prev; this.showPage(this.currentPage); window.scrollTo({ top: 0, behavior: 'smooth' }); 
            }
        });
        
        document.querySelectorAll('.rank-container').forEach(container => {
            container.addEventListener('click', (e) => {
                const upBtn = e.target.closest('.rank-up'); const downBtn = e.target.closest('.rank-down'); if (!upBtn && !downBtn) return;
                const item = e.target.closest('.rank-item');
                if (upBtn && item.previousElementSibling && item.previousElementSibling.classList.contains('rank-item')) { container.insertBefore(item, item.previousElementSibling); } 
                else if (downBtn && item.nextElementSibling && item.nextElementSibling.classList.contains('rank-item')) { container.insertBefore(item.nextElementSibling, item); }
                const hiddenInput = container.querySelector('.rank-hidden-input');
                hiddenInput.value = Array.from(container.querySelectorAll('.rank-item')).map(el => el.dataset.id).join(', ');
            });
        });

        this.bindSubmit(formEl); this.bindSaveDraft(formEl);
    }

    bindSaveDraft(formEl) {
        document.getElementById('saveDraftBtn').addEventListener('click', async () => {
            const btn = document.getElementById('saveDraftBtn'); btn.disabled = true; btn.textContent = 'Saving...';
            try {
                const formData = new FormData(formEl); const answers = {};
                for (let [key, value] of formData.entries()) {
                    const matrixMatch = key.match(/^(.+)\[(.+)\]$/);
                    let baseKey = key.endsWith('[]') ? key.slice(0, -2) : (matrixMatch ? matrixMatch[1] : key);
                    
                    // Filter out skipped pages
                    let fieldPageIdx = -1;
                    this.pages.forEach((page, idx) => { if (page.find(f => f.id === baseKey)) fieldPageIdx = idx; });
                    if (fieldPageIdx > -1 && !this.isPageVisible(fieldPageIdx)) continue;
                    
                    if (key.endsWith('[]')) { if (!answers[baseKey]) answers[baseKey] = []; answers[baseKey].push(value); } 
                    else if (matrixMatch) { if (!answers[baseKey]) answers[baseKey] = {}; answers[baseKey][matrixMatch[2]] = value; } 
                    else if (!(value instanceof File) || (value instanceof File && value.size === 0)) { answers[key] = value; }
                }
                const token = this.sessionToken || `sess_${Math.random().toString(36).substr(2, 9)}`;
                const { error } = await supabase.from('saved_sessions').upsert({ form_id: this.formData.id, session_token: token, data: answers }, { onConflict: 'session_token' });
                if (error) throw error;
                alert(`Draft Saved!\n\nCopy this link to resume later:\n${window.location.origin}${window.location.pathname}?slug=${this.formSlug}&session=${token}`);
                if (!this.sessionToken) window.history.replaceState({}, '', `?slug=${this.formSlug}&session=${token}`);
            } catch (err) { alert('Failed to save draft: ' + err.message); } finally { btn.disabled = false; btn.textContent = 'Save Draft'; }
        });
    }

    bindSubmit(formEl) {
        formEl.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            if (!this.validateCurrentPage()) return;
            
            const btn = document.getElementById('submitFormBtn'); 
            btn.disabled = true; 
            const paymentField = this.formData.schema.fields.find(f => f.type === 'payment');
            btn.textContent = paymentField ? 'Redirecting to Secure Checkout...' : 'Uploading files & Submitting...';

            try {
                const regId = `REG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
                const formData = new FormData(formEl); 
                const answers = {};

                for (let [key, value] of formData.entries()) {
                    const matrixMatch = key.match(/^(.+)\[(.+)\]$/);
                    let baseKey = key.endsWith('[]') ? key.slice(0, -2) : (matrixMatch ? matrixMatch[1] : key);
                    
                    // Filter out skipped pages completely
                    let fieldPageIdx = -1;
                    this.pages.forEach((page, idx) => { if (page.find(f => f.id === baseKey)) fieldPageIdx = idx; });
                    if (fieldPageIdx > -1 && !this.isPageVisible(fieldPageIdx)) continue;
                    
                    const wrapper = document.getElementById(`wrapper_${baseKey}`);
                    if (wrapper && wrapper.style.display === 'none') continue;
                    if (baseKey === paymentField?.id) continue;

                    if (key.endsWith('[]')) { if (!answers[baseKey]) answers[baseKey] = []; answers[baseKey].push(value); } 
                    else if (matrixMatch) { if (!answers[baseKey]) answers[baseKey] = {}; answers[baseKey][matrixMatch[2]] = value; } 
                    else if (value instanceof File && value.size > 0) { const path = await StorageAPI.uploadFile(value, this.formData.programme_id, regId); answers[key] = { type: 'file', path: path, name: value.name }; } 
                    else if (!(value instanceof File)) { answers[key] = value; }
                }

                let totalScore = 0; let isQuiz = false; const fieldMap = {}; this.formData.schema.fields.forEach(f => fieldMap[f.id] = f);
                for (let [k, v] of Object.entries(answers)) {
                    const f = fieldMap[k];
                    if (f && f.enableScoring && f.scores) {
                        isQuiz = true;
                        if (f.type === 'checkbox' && Array.isArray(v)) { v.forEach(val => { const idx = f.options.indexOf(val); if (idx > -1 && f.scores[idx]) totalScore += parseFloat(f.scores[idx]); }); } 
                        else { const idx = f.options.indexOf(v); if (idx > -1 && f.scores[idx]) totalScore += parseFloat(f.scores[idx]); }
                    }
                }
                if (isQuiz) answers['_total_score'] = totalScore;

                const payload = { regId, formId: this.formData.id, programmeId: this.formData.programme_id, formTitle: this.formData.schema.title, data: answers, totalAmount: paymentField ? paymentField.amount : 0, currency: paymentField ? paymentField.currency : 'USD' };
                const { data, error } = await supabase.functions.invoke('process-submission', { body: payload });
                if (error) throw new Error(error.message || "Failed to contact processing server.");
                if (data.error) throw new Error(data.error);

                if (this.sessionToken) await supabase.from('saved_sessions').delete().eq('session_token', this.sessionToken);

                if (data.checkoutUrl) window.location.href = data.checkoutUrl;
                else window.location.href = `success.html?reg_id=${regId}&form=${encodeURIComponent(this.formData.schema.title)}`;

            } catch (error) { alert('Submission failed: ' + error.message); btn.disabled = false; btn.textContent = 'Submit Form'; }
        });
    }

    bindSignatures() {
        document.querySelectorAll('.signature-canvas').forEach(canvas => {
            const ctx = canvas.getContext('2d'); let isDrawing = false;
            canvas.width = canvas.getBoundingClientRect().width; canvas.height = canvas.getBoundingClientRect().height;
            const draw = (e) => {
                if (!isDrawing) return; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
                const clientX = e.clientX || (e.touches && e.touches[0].clientX); const clientY = e.clientY || (e.touches && e.touches[0].clientY);
                ctx.lineTo(clientX - canvas.getBoundingClientRect().left, clientY - canvas.getBoundingClientRect().top);
                ctx.stroke(); ctx.beginPath(); ctx.moveTo(clientX - canvas.getBoundingClientRect().left, clientY - canvas.getBoundingClientRect().top);
            };
            const start = (e) => { isDrawing = true; draw(e); };
            const stop = () => { isDrawing = false; ctx.beginPath(); document.getElementById(canvas.id.replace('sig_', 'input_')).value = canvas.toDataURL(); };
            canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', stop); canvas.addEventListener('mouseout', stop);
            canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); }, { passive: false }); canvas.addEventListener('touchend', stop);
            document.querySelector(`.clear-sig-btn[data-target="${canvas.id}"]`).addEventListener('click', () => { ctx.clearRect(0, 0, canvas.width, canvas.height); document.getElementById(canvas.id.replace('sig_', 'input_')).value = ''; });
        });
    }
}