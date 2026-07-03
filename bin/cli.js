#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Obtener la URL base del servidor (default a la URL de producción de Vercel)
const API_URL = process.env.API_URL || 'https://bdii-unit-002.vercel.app';

const args = process.argv.slice(2);
const command = args[0];
const targetSkill = args[1];

if (!command || command === '-h' || command === '--help') {
    showHelp();
    process.exit(0);
}

if (command === 'install') {
    if (!targetSkill) {
        // Modo escaneo automático si no se especifica un skill
        autoScanAndInstall();
    } else {
        // Instalación de un skill específico
        installSkill(targetSkill);
    }
} else {
    console.error(`Comando desconocido: ${command}`);
    showHelp();
    process.exit(1);
}

function showHelp() {
    console.log(`
DataScript AI - CLI de Gestión de Skills
=======================================
Uso:
  npx db-skills install [nombre-del-skill]

Opciones:
  install                      Escanea el proyecto e instala skills recomendados.
  install [nombre-del-skill]   Instala el skill especificado directamente.
  -h, --help                   Muestra esta ayuda.
`);
}

// Escanear el directorio para recomendar e instalar
async function autoScanAndInstall() {
    console.log('🔍 Escaneando tecnologías del proyecto...');
    const files = fs.readdirSync(process.cwd());
    const detectedExtensions = new Set();
    
    // Escaneo básico recursivo limitado o del nivel raíz
    files.forEach(file => {
        const ext = path.extname(file).toLowerCase();
        if (ext) detectedExtensions.add(ext);
        
        // Buscar subcarpetas comunes
        if (file === 'node_modules' || file === '.git') return;
        try {
            const stat = fs.statSync(file);
            if (stat.isDirectory()) {
                const subFiles = fs.readdirSync(file);
                subFiles.forEach(sf => {
                    const sext = path.extname(sf).toLowerCase();
                    if (sext) detectedExtensions.add(sext);
                });
            }
        } catch (e) {}
    });

    console.log(`💻 Extensiones detectadas: ${Array.from(detectedExtensions).join(', ') || 'ninguna'}`);

    try {
        console.log(`📡 Consultando registro de skills en: ${API_URL}...`);
        const response = await fetch(`${API_URL}/api/skills`);
        if (!response.ok) throw new Error(`El servidor respondió con código ${response.status}`);
        
        const data = await response.json();
        const skills = data.skills || [];
        
        const skillsToInstall = skills.filter(skill => {
            return skill.techTrigger.some(trigger => detectedExtensions.has(trigger));
        });

        if (skillsToInstall.length === 0) {
            console.log('✅ No se detectaron tecnologías específicas de bases de datos. No se requiere instalación automática.');
            console.log('💡 Tip: Puedes instalar cualquier skill manualmente ejecutando: npx db-skills install <skill-id>');
            return;
        }

        console.log(`📦 Skills sugeridos para instalar: ${skillsToInstall.map(s => s.id).join(', ')}`);
        for (const skill of skillsToInstall) {
            await installSkill(skill.id);
        }
        
    } catch (error) {
        console.error('❌ Error al escanear y conectar con el registro:', error.message);
    }
}

// Descargar e instalar un skill específico
async function installSkill(skillId) {
    console.log(`\n📥 Descargando skill: ${skillId}...`);
    try {
        const fileUrl = `${API_URL}/skills-registry/${skillId}/SKILL.md`;
        const response = await fetch(fileUrl);
        
        if (response.status === 404) {
            throw new Error(`El skill '${skillId}' no existe en el registro.`);
        }
        if (!response.ok) {
            throw new Error(`Error en el servidor al descargar: ${response.statusText}`);
        }

        const content = await response.text();
        
        // Crear carpeta de destino .skills/
        const targetDir = path.join(process.cwd(), '.skills', skillId);
        fs.mkdirSync(targetDir, { recursive: true });
        
        const filePath = path.join(targetDir, 'SKILL.md');
        fs.writeFileSync(filePath, content, 'utf8');
        
        console.log(`✅ ¡Instalado con éxito!`);
        console.log(`   Ubicación: ${path.relative(process.cwd(), filePath)}`);
        
    } catch (error) {
        console.error(`❌ Error instalando el skill '${skillId}':`, error.message);
    }
}
