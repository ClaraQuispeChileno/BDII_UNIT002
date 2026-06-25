const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

function activate(context) {
    console.log('La extensión "database-documentation-system" está activa en modo Nube (Vercel).');

    // Registrar proveedor de Webview para el panel inferior ("DB")
    const dbPanelProvider = new DBPanelProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(DBPanelProvider.viewType, dbPanelProvider)
    );

    // Comando para abrir y documentar
    let openCommand = vscode.commands.registerCommand('db-documenter.open', async function (uri) {
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

        // Asegurar que el panel inferior esté visible
        await vscode.commands.executeCommand('workbench.view.extension.db-panel-container');

        // Pasar el archivo y la configuración del usuario al panel
        setTimeout(() => {
            if (dbPanelProvider.view) {
                dbPanelProvider.loadFile(filePath);
            }
        }, 800); // Pequeña espera para asegurar que el panel se haya inicializado
    });

    context.subscriptions.push(openCommand);
}

class DBPanelProvider {
    static viewType = 'db-panel-view';
    
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
        this.view = null;
    }

    resolveWebviewView(webviewView, context, token) {
        this.view = webviewView;
        
        webviewView.webview.options = {
            enableScripts: true
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        // Si hay un archivo activo en el editor, cargarlo automáticamente
        if (vscode.window.activeTextEditor) {
            const activePath = vscode.window.activeTextEditor.document.uri.fsPath;
            const ext = path.extname(activePath).toLowerCase();
            const allowed = ['.sql', '.dbml', '.json', '.yaml', '.yml', '.csv', '.xlsx', '.txt'];
            if (allowed.includes(ext)) {
                setTimeout(() => this.loadFile(activePath), 1000);
            }
        }
    }

    loadFile(filePath) {
        if (!this.view) return;
        
        try {
            if (!fs.existsSync(filePath)) return;
            
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const fileName = path.basename(filePath);
            
            // Obtener configuración del usuario
            const config = vscode.workspace.getConfiguration('datascript');
            const apiKey = config.get('openaiApiKey') || '';
            const aiModel = config.get('aiModel') || 'gpt-4o';

            const fileData = {
                type: 'load-file',
                content: fileContent,
                filename: fileName,
                apiKey: apiKey,
                aiModel: aiModel
            };
            
            // Enviar los datos al iframe de Vercel
            this.view.webview.postMessage(fileData);
        } catch (err) {
            console.error('Error cargando archivo:', err);
        }
    }

    getHtmlForWebview(webview) {
        return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>DataScript AI</title>
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
                const vscode = acquireVsCodeApi();
                const iframe = document.getElementById('dashboard-iframe');
                
                // Recibir el archivo desde la extensión de VS Code y pasarlo al iframe de Vercel
                window.addEventListener('message', event => {
                    const fileData = event.data;
                    if (fileData.type === 'load-file') {
                        // Esperar a que el iframe esté cargado
                        if (iframe.contentWindow) {
                            iframe.contentWindow.postMessage(fileData, 'https://bdii-unit-002.vercel.app');
                        }
                    }
                });
            </script>
        </body>
        </html>
        `;
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
