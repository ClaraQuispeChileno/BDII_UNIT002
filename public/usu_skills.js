// Lógica del panel de control de Skills de IA
let allSkills = [];
let activeFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    fetchSkills();
    setupEventListeners();
});

// Obtener skills desde la API de nuestro servidor
async function fetchSkills() {
    try {
        const response = await fetch('/api/skills');
        if (!response.ok) throw new Error('Error al obtener la lista de skills');
        const data = await response.json();
        allSkills = data.skills || [];
        renderSkills(allSkills);
    } catch (error) {
        console.error('Error fetching skills:', error);
        document.getElementById('skills-grid').innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #ef4444;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; margin-bottom: 15px;"></i>
                <h3>No se pudo cargar la lista de skills.</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Renderizar tarjetas de skills
function renderSkills(skills) {
    const grid = document.getElementById('skills-grid');
    grid.innerHTML = '';

    if (skills.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                <i class="fa-regular fa-folder-open" style="font-size: 3rem; margin-bottom: 15px;"></i>
                <h3>No se encontraron skills que coincidan.</h3>
            </div>
        `;
        return;
    }

    skills.forEach(skill => {
        const card = document.createElement('div');
        card.className = 'skill-card';
        card.setAttribute('data-id', skill.id);

        const techTagsHtml = skill.techTrigger.map(t => `<span class="tech-tag">${t}</span>`).join('');
        
        let iconClass = 'fa-code-branch';
        if (skill.id === 'db-indexing') iconClass = 'fa-key';
        else if (skill.id === 'sql-optimization') iconClass = 'fa-bolt';
        else if (skill.id === 'schema-security') iconClass = 'fa-shield-halved';

        card.innerHTML = `
            <div>
                <div class="card-header">
                    <span class="category-badge">${skill.category}</span>
                    <i class="fa-solid ${iconClass} skill-icon"></i>
                </div>
                <h3 class="skill-title">${skill.name}</h3>
                <p class="skill-desc">${skill.description}</p>
                <div class="tech-tags">
                    ${techTagsHtml}
                </div>
            </div>
            <div class="card-actions">
                <button class="btn btn-outline preview-btn" data-id="${skill.id}">Previsualizar</button>
                <button class="btn btn-primary install-btn" data-id="${skill.id}">
                    <i class="fa-solid fa-terminal"></i> Instalar CLI
                </button>
            </div>
        `;

        grid.appendChild(card);
    });

    // Agregar listeners a los botones generados
    document.querySelectorAll('.preview-btn').forEach(btn => {
        btn.addEventListener('click', () => openSkillModal(btn.getAttribute('data-id')));
    });

    document.querySelectorAll('.install-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyInstallCommand(btn.getAttribute('data-id'), btn);
        });
    });
}

// Configurar los manejadores de eventos generales
function setupEventListeners() {
    // Búsqueda en tiempo real
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', filterSkillsList);

    // Filtros por botón de categoría
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.getAttribute('data-filter').toLowerCase();
            filterSkillsList();
        });
    });

    // Modal cerrar
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('modal-close-footer').addEventListener('click', closeModal);
    
    // Cerrar haciendo clic fuera
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('skill-modal');
        if (e.target === modal) closeModal();
    });
}

// Filtrar lista
function filterSkillsList() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    
    const filtered = allSkills.filter(skill => {
        const matchesQuery = skill.name.toLowerCase().includes(query) || 
                             skill.description.toLowerCase().includes(query) ||
                             skill.category.toLowerCase().includes(query);
        
        let matchesFilter = true;
        if (activeFilter !== 'all') {
            matchesFilter = skill.category.toLowerCase().includes(activeFilter);
        }

        return matchesQuery && matchesFilter;
    });

    renderSkills(filtered);
}

// Abrir previsualización de Skill
async function openSkillModal(skillId) {
    const skill = allSkills.find(s => s.id === skillId);
    if (!skill) return;

    const modal = document.getElementById('skill-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const downloadBtn = document.getElementById('modal-download-btn');

    modalTitle.textContent = skill.name;
    modalBody.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
            <p>Cargando reglas del skill...</p>
        </div>
    `;

    modal.style.display = 'flex';

    try {
        const response = await fetch(`/skills-registry/${skillId}/SKILL.md`);
        if (!response.ok) throw new Error('No se pudo descargar el archivo de reglas.');
        const markdown = await response.text();

        // Limpiar frontmatter del renderizado de marked si existe
        const cleanMarkdown = markdown.replace(/^---[\s\S]*?---/, '').trim();
        modalBody.innerHTML = window.marked.parse(cleanMarkdown);

        // Configurar botón de descarga
        downloadBtn.onclick = () => {
            const blob = new Blob([markdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'SKILL.md';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

    } catch (error) {
        modalBody.innerHTML = `
            <div style="text-align: center; color: #ef4444; padding: 20px;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem;"></i>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Cerrar Modal
function closeModal() {
    document.getElementById('skill-modal').style.display = 'none';
}

// Copiar comando al portapapeles
function copyInstallCommand(skillId, buttonElement) {
    const command = `npx db-skills-ai install ${skillId}`;
    navigator.clipboard.writeText(command).then(() => {
        const originalText = buttonElement.innerHTML;
        buttonElement.innerHTML = `<i class="fa-solid fa-check"></i> ¡Copiado!`;
        buttonElement.style.background = 'var(--accent)';
        
        setTimeout(() => {
            buttonElement.innerHTML = originalText;
            buttonElement.style.background = '';
        }, 2000);
    }).catch(err => {
        console.error('Error al copiar el comando:', err);
    });
}
