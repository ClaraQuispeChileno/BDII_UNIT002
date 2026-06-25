const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Intentar cargar la dependencia de PDF de forma segura para evitar crashes en el Marketplace
let convertMarkdownToPdf;
try {
    convertMarkdownToPdf = require('./pdfHelper').convertMarkdownToPdf;
} catch (err) {
    console.warn("pdfHelper no pudo ser cargado localmente (falta jspdf).");
}

function activate(context) {
    console.log('La extensión "database-documentation-system" está activa.');

    // 1. Registrar el proveedor de Webview para el panel inferior ("DB")
    const dbPanelProvider = new DBPanelProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(DBPanelProvider.viewType, dbPanelProvider)
    );

    // 2. Registrar el comando principal para abrir la interfaz en una PESTAÑA (Editor Tab)
    let openDisposable = vscode.commands.registerCommand('db-documenter.open', function (uri) {
        let filePath = '';
        if (uri && uri.fsPath) {
            filePath = uri.fsPath;
        } else if (vscode.window.activeTextEditor) {
            filePath = vscode.window.activeTextEditor.document.uri.fsPath;
        }

        if (!filePath) {
            vscode.window.showErrorMessage('Por favor, selecciona un archivo en el explorador o abre uno para documentarlo.');
            return;
        }

        try {
            if (!fs.existsSync(filePath)) {
                vscode.window.showErrorMessage('El archivo seleccionado no existe.');
                return;
            }
            
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const fileName = path.basename(filePath);

            // Leer la configuración del usuario
            const config = vscode.workspace.getConfiguration('datascript');
            const apiKey = config.get('openaiApiKey') || '';
            const aiModel = config.get('aiModel') || 'gpt-4o';

            // Abrir en una pestaña del editor usando Vercel
            openDashboardWebview(fileName, fileContent, apiKey, aiModel);
        } catch (err) {
            vscode.window.showErrorMessage(`Error al leer el archivo: ${err.message}`);
        }
    });

    context.subscriptions.push(openDisposable);
}

// Función para abrir la interfaz completa en una pestaña del editor
function openDashboardWebview(fileName, fileContent, apiKey, aiModel) {
    const panel = vscode.window.createWebviewPanel(
        'dbDocumenterDashboard',
        `Documentar: ${fileName}`,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    panel.webview.html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>DataScript AI - Documentación</title>
            <style>
                html, body, iframe {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    border: none;
                    overflow: hidden;
                    background-color: #0c0e12;
                }
            </style>
        </head>
        <body>
            <iframe id="dashboard-iframe" src="https://bdii-unit-002.vercel.app/html/usu_generar.html?vscode=true"></iframe>
            
            <script>
                const iframe = document.getElementById('dashboard-iframe');
                
                iframe.onload = () => {
                    const fileData = {
                        type: 'load-file',
                        content: ${JSON.stringify(fileContent)},
                        filename: ${JSON.stringify(fileName)},
                        apiKey: ${JSON.stringify(apiKey)},
                        aiModel: ${JSON.stringify(aiModel)}
                    };
                    iframe.contentWindow.postMessage(fileData, 'https://bdii-unit-002.vercel.app');
                };
            </script>
        </body>
        </html>
    `;
}

// Proveedor del panel inferior de comandos tipo terminal ("DB")
class DBPanelProvider {
    static viewType = 'db-panel-view';
    
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
        this.view = null;
    }

    resolveWebviewView(webviewView, context, token) {
        this.view = webviewView;
        
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        // Escuchar mensajes del Webview de comandos
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'getWorkspaceFiles':
                    await this.scanWorkspaceFiles();
                    break;
                case 'selectFileDialog':
                    await this.selectFileViaDialog();
                    break;
                case 'runAnalyze':
                    await this.handleAnalysis(message.filePath, message.mode);
                    break;
                case 'runConvert':
                    await this.handleConversion(message.filePath, message.targetFormat);
                    break;
                case 'runGenerateData':
                    await this.handleDataGeneration(message.filePath);
                    break;
                case 'showNotification':
                    vscode.window.showInformationMessage(message.text);
                    break;
                case 'showError':
                    vscode.window.showErrorMessage(message.text);
                    break;
            }
        });
    }

    selectFileDirectly(filePath) {
        if (this.view) {
            this.view.webview.postMessage({
                command: 'setFile',
                file: {
                    name: path.basename(filePath),
                    fsPath: filePath
                }
            });
        }
    }

    async scanWorkspaceFiles() {
        try {
            const files = await vscode.workspace.findFiles('**/*.{sql,dbml,json,yaml,yml,csv,xlsx}');
            const fileItems = files.map(f => ({
                name: path.basename(f.fsPath),
                fsPath: f.fsPath
            }));
            if (this.view) {
                this.view.webview.postMessage({ command: 'workspaceFiles', files: fileItems });
            }
        } catch (err) {
            vscode.window.showErrorMessage(`Error al escanear workspace: ${err.message}`);
        }
    }

    async selectFileViaDialog() {
        const selected = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Seleccionar archivo DB',
            filters: { 'Bases de Datos': ['sql', 'dbml', 'json', 'yaml', 'yml', 'csv', 'xlsx'] }
        });
        if (selected && selected[0] && this.view) {
            this.view.webview.postMessage({
                command: 'setFile',
                file: {
                    name: path.basename(selected[0].fsPath),
                    fsPath: selected[0].fsPath
                }
            });
        }
    }

    async handleAnalysis(filePath, mode) {
        if (!fs.existsSync(filePath)) {
            vscode.window.showErrorMessage('El archivo no existe.');
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Auditor DB: Analizando y documentando esquema con Python...",
            cancellable: false
        }, async (progress) => {
            try {
                const analysis = await runPythonAnalyzer(filePath);
                const docMarkdown = generatePythonDocumentation(analysis);

                if (mode === 'download') {
                    if (!convertMarkdownToPdf) {
                        vscode.window.showErrorMessage('La descarga en PDF no está disponible localmente porque falta jspdf. Usa el clic derecho -> Documentar en pestaña.');
                        return;
                    }
                    const pdfBuffer = convertMarkdownToPdf(docMarkdown);
                    const defaultUri = vscode.Uri.file(path.join(path.dirname(filePath), `auditoria_${path.parse(filePath).name}.pdf`));
                    
                    const saveUri = await vscode.window.showSaveDialog({
                        defaultUri,
                        filters: { 'PDF Files': ['pdf'] },
                        saveLabel: 'Guardar PDF de Auditoría'
                    });

                    if (saveUri) {
                        fs.writeFileSync(saveUri.fsPath, pdfBuffer);
                        vscode.window.showInformationMessage(`PDF de Auditoría guardado en: ${path.basename(saveUri.fsPath)}`);
                    }
                } else {
                    const tempDoc = await vscode.workspace.openTextDocument({
                        content: docMarkdown,
                        language: 'markdown'
                    });
                    await vscode.window.showTextDocument(tempDoc, vscode.ViewColumn.Beside);
                    vscode.window.showInformationMessage('Reporte de Auditoría generado exitosamente.');
                }
            } catch (err) {
                vscode.window.showErrorMessage(`Error en análisis: ${err.message}`);
            }
        });
    }

    async handleConversion(filePath, targetFormat) {
        if (!fs.existsSync(filePath)) {
            vscode.window.showErrorMessage('El archivo no existe.');
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Auditor DB: Convirtiendo a ${targetFormat.toUpperCase()}...`,
            cancellable: false
        }, async (progress) => {
            try {
                const analysis = await runPythonAnalyzer(filePath);
                if (!analysis.schema) {
                    throw new Error("No se pudo detectar un esquema en el archivo.");
                }

                const convertedCode = await runPythonConverter(analysis.schema, targetFormat);

                let language = 'sql';
                if (targetFormat.toLowerCase().includes('json')) language = 'json';
                else if (targetFormat.toLowerCase().includes('dbml')) language = 'dbml';
                
                const tempDoc = await vscode.workspace.openTextDocument({
                    content: convertedCode,
                    language: language
                });
                await vscode.window.showTextDocument(tempDoc, vscode.ViewColumn.Beside);
                vscode.window.showInformationMessage(`Esquema convertido exitosamente a ${targetFormat.toUpperCase()}.`);
            } catch (err) {
                vscode.window.showErrorMessage(`Error en conversión: ${err.message}`);
            }
        });
    }

    async handleDataGeneration(filePath) {
        if (!fs.existsSync(filePath)) {
            vscode.window.showErrorMessage('El archivo no existe.');
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Auditor DB: Generando datos de prueba (Mock)...",
            cancellable: false
        }, async (progress) => {
            try {
                const analysis = await runPythonAnalyzer(filePath);
                if (!analysis.schema) {
                    throw new Error("No se pudo detectar un esquema en el archivo.");
                }

                const generationResult = await runPythonDataGenerator(analysis.schema);
                
                const scriptContent = generationResult.sqlScript || JSON.stringify(generationResult, null, 2);
                const isJson = analysis.schema.type === 'json' || analysis.schema.type === 'nosql';
                const language = isJson ? 'json' : 'sql';

                const tempDoc = await vscode.workspace.openTextDocument({
                    content: scriptContent,
                    language: language
                });
                await vscode.window.showTextDocument(tempDoc, vscode.ViewColumn.Beside);
                vscode.window.showInformationMessage('Datos de prueba (Mock) generados exitosamente.');
            } catch (err) {
                vscode.window.showErrorMessage(`Error al generar datos de prueba: ${err.message}`);
            }
        });
    }

    getHtmlForWebview(webview) {
        return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Auditor DB - Panel de Control</title>
            <style>
                :root {
                    --bg-primary: #1e1e1e;
                    --bg-secondary: #252526;
                    --border-color: #3c3c3c;
                    --text-primary: #cccccc;
                    --text-secondary: #858585;
                    --accent-color: #007acc;
                    --accent-bg: #37373d;
                    --accent-active: #094771;
                    --success-color: #89d185;
                    --danger-color: #f48771;
                }

                body {
                    margin: 0;
                    padding: 8px;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    background-color: var(--bg-primary);
                    color: var(--text-primary);
                    user-select: none;
                    overflow-x: hidden;
                }

                .container {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    max-width: 100%;
                    margin: 0;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid var(--border-color);
                    padding-bottom: 6px;
                    margin-bottom: 4px;
                }

                .title {
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    color: var(--text-primary);
                }

                .status-badge {
                    font-size: 10px;
                    background-color: var(--bg-secondary);
                    padding: 1px 6px;
                    border-radius: 3px;
                    border: 1px solid var(--border-color);
                    color: var(--text-secondary);
                    max-width: 200px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .menu-section {
                    background-color: var(--bg-primary);
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    position: relative;
                }

                .menu-title {
                    font-size: 10px;
                    font-weight: 600;
                    color: var(--text-secondary);
                    padding: 2px 4px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 2px;
                }

                .menu-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 6px 10px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: background-color 0.1s ease;
                    border: 1px solid transparent;
                    outline: none;
                }

                .menu-item:hover {
                    background-color: var(--accent-bg);
                }

                .menu-item.active {
                    background-color: var(--accent-active);
                    color: #ffffff;
                }

                .menu-item.disabled {
                    opacity: 0.4;
                    pointer-events: none;
                }

                .loading-overlay {
                    display: none;
                    justify-content: center;
                    align-items: center;
                    position: absolute;
                    inset: 0;
                    background-color: rgba(30, 30, 30, 0.8);
                    z-index: 10;
                    border-radius: 3px;
                    font-size: 12px;
                    gap: 6px;
                }

                .spinner {
                    width: 12px;
                    height: 12px;
                    border: 2px solid var(--text-secondary);
                    border-top-color: var(--accent-color);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .footer-tip {
                    font-size: 10px;
                    color: var(--text-secondary);
                    text-align: left;
                    padding-left: 4px;
                    margin-top: 6px;
                    border-top: 1px solid var(--border-color);
                    padding-top: 6px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="title">DB AUDITOR</div>
                    <div class="status-badge" id="selected-file-badge">Sin archivo seleccionado</div>
                </div>

                <div class="menu-section" id="menu-container">
                    <div class="menu-title" id="section-title">Menú Principal</div>
                    <div id="menu-items-list">
                        <!-- Generado dinámicamente -->
                    </div>
                    <div class="loading-overlay" id="loading-overlay">
                        <div class="spinner"></div>
                        <span id="loading-text">Cargando...</span>
                    </div>
                </div>

                <div class="footer-tip">
                    Navegación: ↑ ↓ para mover • Enter para seleccionar • Backspace para volver
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                let currentMenu = 'main';
                let selectedFile = null;
                let activeIndex = 0;
                let workspaceFilesList = [];

                const menus = {
                    main: () => [
                        { label: 'Seleccionar Archivo de DB', action: () => openSelectFileMenu() },
                        { label: 'Analizar y Documentar Esquema', action: () => openAnalyzeMenu(), disabled: !selectedFile },
                        { label: 'Convertir Formato de Esquema', action: () => openConvertMenu(), disabled: !selectedFile },
                        { label: 'Generar Datos de Prueba (Mock)', action: () => runGenerateData(), disabled: !selectedFile }
                    ],
                    analyze: () => [
                        { label: 'Descargar reporte en formato PDF', action: () => runAnalysis('download') },
                        { label: 'Mostrar reporte en editor', action: () => runAnalysis('show') },
                        { label: 'Volver al Menú Principal', action: () => goBack() }
                    ],
                    convert: () => [
                        { label: 'SQL Server (.sql)', action: () => runConversion('sqlserver') },
                        { label: 'PostgreSQL (.sql)', action: () => runConversion('postgresql') },
                        { label: 'MySQL (.sql)', action: () => runConversion('mysql') },
                        { label: 'SQLite (.sql)', action: () => runConversion('sqlite') },
                        { label: 'MongoDB (NoSQL)', action: () => runConversion('mongodb') },
                        { label: 'JSON Schema', action: () => runConversion('json_schema') },
                        { label: 'JSON Crack (Visual)', action: () => runConversion('json_crack') },
                        { label: 'DBML (.dbml)', action: () => runConversion('dbml') },
                        { label: 'Volver al Menú Principal', action: () => goBack() }
                    ]
                };

                function renderMenu() {
                    const listContainer = document.getElementById('menu-items-list');
                    const sectionTitle = document.getElementById('section-title');
                    listContainer.innerHTML = '';
                    
                    let items = [];
                    if (currentMenu === 'select_file') {
                        sectionTitle.innerText = 'Seleccionar Archivo';
                        items.push({
                            label: 'Buscar en mi equipo (Diálogo nativo)',
                            action: () => {
                                vscode.postMessage({ command: 'selectFileDialog' });
                            }
                        });
                        
                        workspaceFilesList.forEach(file => {
                            items.push({
                                label: file.name,
                                action: () => {
                                    selectedFile = file;
                                    document.getElementById('selected-file-badge').innerText = file.name;
                                    vscode.postMessage({ command: 'showNotification', text: 'Archivo seleccionado: ' + file.name });
                                    goBack();
                                }
                            });
                        });
                        
                        items.push({ label: 'Volver al Menú Principal', action: () => goBack() });
                    } else {
                        sectionTitle.innerText = currentMenu === 'main' ? 'Menú Principal' :
                                                 currentMenu === 'analyze' ? 'Opciones de Análisis' : 'Convertir Esquema';
                        items = menus[currentMenu]();
                    }

                    if (activeIndex >= items.length) {
                        activeIndex = Math.max(0, items.length - 1);
                    }

                    items.forEach((item, idx) => {
                        const div = document.createElement('div');
                        div.className = 'menu-item' + (idx === activeIndex ? ' active' : '') + (item.disabled ? ' disabled' : '');
                        div.innerHTML = \`<span>\${item.label}</span>\`;
                        
                        div.addEventListener('click', () => {
                            if (!item.disabled) {
                                activeIndex = idx;
                                renderMenu();
                                item.action();
                            }
                        });
                        listContainer.appendChild(div);
                    });
                }

                function openSelectFileMenu() {
                    currentMenu = 'select_file';
                    activeIndex = 0;
                    showLoading('Buscando archivos...');
                    vscode.postMessage({ command: 'getWorkspaceFiles' });
                }

                function openAnalyzeMenu() {
                    currentMenu = 'analyze';
                    activeIndex = 0;
                    renderMenu();
                }

                function openConvertMenu() {
                    currentMenu = 'convert';
                    activeIndex = 0;
                    renderMenu();
                }

                function goBack() {
                    currentMenu = 'main';
                    activeIndex = 0;
                    renderMenu();
                }

                function runAnalysis(mode) {
                    if (!selectedFile) return;
                    showLoading('Procesando análisis...');
                    vscode.postMessage({
                        command: 'runAnalyze',
                        filePath: selectedFile.fsPath,
                        mode: mode
                    });
                    setTimeout(hideLoading, 1000);
                }

                function runConversion(format) {
                    if (!selectedFile) return;
                    showLoading('Generando conversión...');
                    vscode.postMessage({
                        command: 'runConvert',
                        filePath: selectedFile.fsPath,
                        targetFormat: format
                    });
                    setTimeout(hideLoading, 1000);
                }

                function runGenerateData() {
                    if (!selectedFile) return;
                    showLoading('Generando datos...');
                    vscode.postMessage({
                        command: 'runGenerateData',
                        filePath: selectedFile.fsPath
                    });
                    setTimeout(hideLoading, 1000);
                }

                function showLoading(text) {
                    const overlay = document.getElementById('loading-overlay');
                    document.getElementById('loading-text').innerText = text;
                    overlay.style.display = 'flex';
                }

                function hideLoading() {
                    document.getElementById('loading-overlay').style.display = 'none';
                }

                window.addEventListener('keydown', (e) => {
                    let itemsCount = 0;
                    if (currentMenu === 'select_file') {
                        itemsCount = workspaceFilesList.length + 2;
                    } else {
                        itemsCount = menus[currentMenu]().length;
                    }

                    if (itemsCount === 0) return;

                    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'k') {
                        e.preventDefault();
                        activeIndex = (activeIndex - 1 + itemsCount) % itemsCount;
                        if (currentMenu !== 'select_file' && menus[currentMenu]()[activeIndex].disabled) {
                            activeIndex = (activeIndex - 1 + itemsCount) % itemsCount;
                        }
                        renderMenu();
                    } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'j') {
                        e.preventDefault();
                        activeIndex = (activeIndex + 1) % itemsCount;
                        if (currentMenu !== 'select_file' && menus[currentMenu]()[activeIndex].disabled) {
                            activeIndex = (activeIndex + 1) % itemsCount;
                        }
                        renderMenu();
                    } else if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const items = currentMenu === 'select_file' ? 
                            [
                                { action: () => vscode.postMessage({ command: 'selectFileDialog' }) },
                                ...workspaceFilesList.map(file => ({
                                    action: () => {
                                        selectedFile = file;
                                        document.getElementById('selected-file-badge').innerText = file.name;
                                        vscode.postMessage({ command: 'showNotification', text: 'Archivo seleccionado: ' + file.name });
                                        goBack();
                                    }
                                })),
                                { action: () => goBack() }
                            ] : menus[currentMenu]();
                        
                        if (items[activeIndex] && !items[activeIndex].disabled) {
                            items[activeIndex].action();
                        }
                    } else if (e.key === 'Escape' || e.key === 'Backspace') {
                        if (currentMenu !== 'main') {
                            e.preventDefault();
                            goBack();
                        }
                    }
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'workspaceFiles':
                            workspaceFilesList = message.files;
                            hideLoading();
                            renderMenu();
                            break;
                        case 'setFile':
                            selectedFile = message.file;
                            document.getElementById('selected-file-badge').innerText = message.file.name;
                            goBack();
                            break;
                    }
                });

                renderMenu();
            </script>
        </body>
        </html>
        `;
    }
}

// Ejecutar script Python para análisis
function runPythonAnalyzer(filePath) {
    return new Promise((resolve, reject) => {
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        const mainPy = path.join(__dirname, 'python_analyzer', 'main.py');
        const child = spawn(pythonCmd, [mainPy, '--file', filePath], {
            cwd: __dirname
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', data => stdout += data.toString());
        child.stderr.on('data', data => stderr += data.toString());
        
        child.on('close', code => {
            if (code !== 0) {
                return reject(new Error(stderr || `Python proceso terminó con código ${code}`));
            }
            try {
                const parsed = JSON.parse(stdout);
                if (parsed.success) {
                    resolve(parsed.analysis);
                } else {
                    reject(new Error(parsed.error || 'Error desconocido de análisis'));
                }
            } catch (e) {
                reject(new Error('Error al parsear salida del analizador Python: ' + e.message));
            }
        });
    });
}

// Ejecutar script Python para conversión
function runPythonConverter(schema, targetFormat) {
    return new Promise((resolve, reject) => {
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        const mainPy = path.join(__dirname, 'python_analyzer', 'main.py');
        const child = spawn(pythonCmd, [mainPy, '--convert'], {
            cwd: __dirname
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', data => stdout += data.toString());
        child.stderr.on('data', data => stderr += data.toString());
        
        child.on('close', code => {
            if (code !== 0) {
                return reject(new Error(stderr || `Python proceso terminó con código ${code}`));
            }
            try {
                const parsed = JSON.parse(stdout);
                if (parsed.success) {
                    resolve(parsed.convertedCode);
                } else {
                    reject(new Error(parsed.error || 'Error desconocido del convertidor'));
                }
            } catch (e) {
                reject(new Error('Error al parsear salida del convertidor Python: ' + e.message));
            }
        });
        
        child.stdin.write(JSON.stringify({ schema, targetFormat }));
        child.stdin.end();
    });
}

// Ejecutar script Python para generación de datos de prueba
function runPythonDataGenerator(schema) {
    return new Promise((resolve, reject) => {
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        const mainPy = path.join(__dirname, 'python_analyzer', 'main.py');
        const child = spawn(pythonCmd, [mainPy, '--generate-data'], {
            cwd: __dirname
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', data => stdout += data.toString());
        child.stderr.on('data', data => stderr += data.toString());
        
        child.on('close', code => {
            if (code !== 0) {
                return reject(new Error(stderr || `Python proceso terminó con código ${code}`));
            }
            try {
                const parsed = JSON.parse(stdout);
                if (parsed.success) {
                    resolve(parsed.data);
                } else {
                    reject(new Error(parsed.error || 'Error desconocido del generador de datos'));
                }
            } catch (e) {
                reject(new Error('Error al parsear salida del generador Python: ' + e.message));
            }
        });
        
        child.stdin.write(JSON.stringify({ schema, config: { maxRows: 10 } }));
        child.stdin.end();
    });
}

// Generar documentación local
function generatePythonDocumentation(analysis) {
    const schema = analysis.schema;
    const metrics = analysis.metrics || {};
    const anomalies = analysis.anomalies || [];
    const normScore = metrics.normalizationScore || 50;
    
    const progressFill = Math.round(normScore / 10);
    const progressEmpty = 10 - progressFill;
    const bar = '[' + '█'.repeat(progressFill) + '░'.repeat(progressEmpty) + `] ${normScore}%`;

    let doc = `# Documentación Técnica de Base de Datos (Generada Localmente)\n\n`;

    doc += `## 1. ANÁLISIS GENERAL\n\n`;
    doc += `${bar}\n\n`;
    
    if (analysis.opinion) {
        doc += `${analysis.opinion}\n\n`;
    }

    doc += `### Métricas Clave\n`;
    doc += `- **Integridad y Relaciones**: ${schema.relations ? schema.relations.length : 0} detectadas.\n`;
    doc += `- **Normalización**: ${normScore}%\n`;
    doc += `- **Tablas Totales**: ${metrics.totalTables || 0}\n`;
    doc += `- **Columnas Totales**: ${metrics.totalColumns || 0}\n\n`;

    doc += `## 2. DICCIONARIO DE DATOS\n\n`;
    schema.tables?.forEach(table => {
        doc += `### **${table.name}**\n`;
        doc += `Descripción: Entidad que almacena los registros correspondientes a ${table.name}. Cuenta con ${table.columns?.length || 0} columnas.\n\n`;
        doc += `| Campo | Tipo de dato | Descripción | Observaciones |\n`;
        doc += `|-------|--------------|-------------|----------------|\n`;
        
        table.columns?.forEach(column => {
            let obs = [];
            if (column.primaryKey) obs.push("PK");
            if (!column.nullable) obs.push("NOT NULL");
            if (column.autoIncrement) obs.push("AUTO_INCREMENT");
            
            const fk = table.foreignKeys?.find(f => f.column === column.name);
            if (fk) obs.push(`FK -> ${fk.references?.table || fk.referencesTable}`);
            
            doc += `| ${column.name} | ${column.type} | Campo '${column.name}' de tipo ${column.type}. | ${obs.join(", ") || "-"} |\n`;
        });
        doc += `\n`;
    });

    doc += `## 3. ANÁLISIS DE VÍNCULOS Y RELACIONES\n\n`;
    if (schema.relations && schema.relations.length > 0) {
        doc += `Se han detectado las siguientes relaciones clave en el esquema:\n\n`;
        schema.relations.forEach(rel => {
            doc += `- **${rel.from}** se relaciona con **${rel.to}** mediante el campo \`${rel.column}\`.\n`;
        });
    } else {
        doc += `No se han detectado relaciones (Foreign Keys) explícitas en el esquema. Esto puede comprometer la integridad referencial.\n`;
    }
    doc += `\n`;

    doc += `## 4. SUGERENCIAS DE OPTIMIZACIÓN\n\n`;
    const optimizationAnomalies = anomalies.filter(a => a.type === 'optimization' || a.severity === 'medium');
    
    if (optimizationAnomalies.length > 0) {
        optimizationAnomalies.forEach(anomaly => {
            doc += `- **[MEJORA]** En tabla **${anomaly.table}**: ${anomaly.message}\n`;
        });
    } else {
        doc += `- **[ESTÁNDAR]** El esquema cumple con estándares básicos. Se recomienda asegurar el uso de índices en campos de búsqueda frecuente.\n`;
    }
    doc += `\n`;

    doc += `## 5. CRÍTICA OBLIGATORIA\n\n`;
    const criticalAnomalies = anomalies.filter(a => a.severity === 'high');
    
    if (criticalAnomalies.length > 0) {
        criticalAnomalies.forEach(anomaly => {
            doc += `- **[CRÍTICO]** **${anomaly.table}**: ${anomaly.message}\n`;
        });
    } else {
        doc += `El diseño estructural es sólido. No se observan bloqueadores críticos. Asegúrese de documentar tipos alternativos para campos monetarios si aplica.\n`;
    }
    doc += `\n`;

    return doc;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
