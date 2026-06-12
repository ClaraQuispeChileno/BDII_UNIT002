// DataScript AI - Custom Premium Alerts system using SweetAlert2
(function () {
    // Inject Custom Styles for SweetAlert2
    const style = document.createElement('style');
    style.textContent = `
        /* Custom styled SweetAlert2 theme matching DataScript AI */
        .glass-swal-popup {
            background: linear-gradient(135deg, rgba(20, 24, 46, 0.95), rgba(13, 16, 30, 0.98)) !important;
            border: 1px solid rgba(123, 136, 255, 0.2) !important;
            border-radius: 20px !important;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(99, 102, 241, 0.15) !important;
            font-family: 'Outfit', sans-serif !important;
            backdrop-filter: blur(10px) !important;
        }
        .glass-swal-title {
            color: #ffffff !important;
            font-weight: 700 !important;
            font-size: 1.45rem !important;
        }
        .glass-swal-html {
            color: #94a3b8 !important;
            font-size: 0.95rem !important;
            line-height: 1.6 !important;
        }
        .glass-swal-confirm {
            background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
            color: #ffffff !important;
            border: none !important;
            padding: 10px 24px !important;
            font-size: 0.95rem !important;
            font-weight: 600 !important;
            border-radius: 10px !important;
            transition: all 0.3s ease !important;
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3) !important;
        }
        .glass-swal-confirm:hover {
            transform: translateY(-1px) !important;
            box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5) !important;
            background: linear-gradient(135deg, #4f46e5, #7c3aed) !important;
        }
        .glass-swal-cancel {
            background: rgba(255, 255, 255, 0.05) !important;
            color: #94a3b8 !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            padding: 10px 24px !important;
            font-size: 0.95rem !important;
            font-weight: 600 !important;
            border-radius: 10px !important;
            transition: all 0.3s ease !important;
        }
        .glass-swal-cancel:hover {
            background: rgba(255, 255, 255, 0.1) !important;
            color: #ffffff !important;
        }
        .glass-swal-icon {
            border-color: rgba(255, 255, 255, 0.1) !important;
        }
        .swal2-loader {
            border-color: #6366f1 transparent #8b5cf6 transparent !important;
            margin-top: 15px !important;
        }
    `;
    document.head.appendChild(style);

    // Helper to detect correct alert icon type based on message text
    function getAlertIcon(message) {
        const lowerMsg = (message || '').toString().toLowerCase();
        
        if (
            lowerMsg.includes('éxito') || 
            lowerMsg.includes('exitoso') || 
            lowerMsg.includes('actualizada') || 
            lowerMsg.includes('activado') || 
            lowerMsg.includes('felicidades') || 
            lowerMsg.includes('guardado') || 
            lowerMsg.includes('guardada') || 
            lowerMsg.includes('con éxito') ||
            lowerMsg.includes('subidos con éxito') ||
            lowerMsg.includes('recuperado')
        ) {
            return { icon: 'success', title: '¡Éxito!' };
        } else if (
            lowerMsg.includes('error') || 
            lowerMsg.includes('no válido') || 
            lowerMsg.includes('falló') || 
            lowerMsg.includes('no se pudo') || 
            lowerMsg.includes('rechazada') || 
            lowerMsg.includes('problema') ||
            lowerMsg.includes('no autorizado') ||
            lowerMsg.includes('incorrecta')
        ) {
            return { icon: 'error', title: 'Error' };
        } else if (
            lowerMsg.includes('atención') || 
            lowerMsg.includes('advertencia') || 
            lowerMsg.includes('cuidado') || 
            lowerMsg.includes('seguro') || 
            lowerMsg.includes('eliminar') || 
            lowerMsg.includes('obligatorios') || 
            lowerMsg.includes('no coinciden') || 
            lowerMsg.includes('debe ser menor') ||
            lowerMsg.includes('no permitida') ||
            lowerMsg.includes('requiere estar autenticado')
        ) {
            return { icon: 'warning', title: 'Advertencia' };
        }
        
        return { icon: 'info', title: 'Información' };
    }

    // Override the native browser alert
    window.alert = function (message) {
        // Fallback if SweetAlert2 is not loaded yet
        if (typeof Swal === 'undefined') {
            console.warn('SweetAlert2 (Swal) is not loaded. Falling back to native alert.');
            return window.alert(message);
        }

        const details = getAlertIcon(message);

        return Swal.fire({
            title: details.title,
            text: message,
            icon: details.icon,
            background: 'transparent', // CSS gradient in .glass-swal-popup handles it
            customClass: {
                popup: 'glass-swal-popup',
                title: 'glass-swal-title',
                htmlContainer: 'glass-swal-html',
                confirmButton: 'glass-swal-confirm',
                cancelButton: 'glass-swal-cancel',
                icon: 'glass-swal-icon'
            },
            buttonsStyling: false,
            confirmButtonText: 'Aceptar'
        });
    };
})();
