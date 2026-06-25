const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

function activate(context) {
    console.log('La extensión "database-documentation-system" está activa en modo Nube (Vercel).');

    let disposable = vscode.commands.registerCommand('db-documenter.open', function (uri) {
        let filePath = '';
        
        // 1. Obtener la ruta del archivo seleccionado
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
            // Leer el archivo local
            if (!fs.existsSync(filePath)) {
                vscode.window.showErrorMessage('El archivo seleccionado no existe.');
                return;
            }
            
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const fileName = path.basename(filePath);

            // Leer configuración nativa del espacio de trabajo
            const config = vscode.workspace.getConfiguration('datascript');
            const apiKey = config.get('openaiApiKey') || '';
            const aiModel = config.get('aiModel') || 'gpt-4o';

            // Abrir directamente el webview pasándole la configuración
            openDashboardWebview(fileName, fileContent, apiKey, aiModel);
        } catch (err) {
            vscode.window.showErrorMessage(`Error al leer el archivo: ${err.message}`);
        }
    });

    context.subscriptions.push(disposable);
}

function openDashboardWebview(fileName, fileContent, apiKey, aiModel) {
    // Crear el panel de Webview
    const panel = vscode.window.createWebviewPanel(
        'dbDocumenterDashboard',
        `Documentar: ${fileName}`,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    // Contenido HTML con iframe que apunta a tu servidor de Vercel
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
            <iframe id="dashboard-iframe" src="http://localhost:3000/html/usu_generar.html?vscode=true"></iframe>
            
            <script>
                const iframe = document.getElementById('dashboard-iframe');
                
                // Esperar a que el iframe cargue para pasarle el archivo y la configuración
                iframe.onload = () => {
                    const fileData = {
                        type: 'load-file',
                        content: ${JSON.stringify(fileContent)},
                        filename: ${JSON.stringify(fileName)},
                        apiKey: ${JSON.stringify(apiKey)},
                        aiModel: ${JSON.stringify(aiModel)}
                    };
                    
                    // Enviar el archivo mediante postMessage al iframe de Vercel
                    iframe.contentWindow.postMessage(fileData, 'https://localhost:3000');
                };
            </script>
        </body>
        </html>
    `;
}

function deactivate() {
    // No hay recursos locales que limpiar en modo Vercel
}

module.exports = {
    activate,
    deactivate
};
