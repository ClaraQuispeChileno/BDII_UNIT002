# Documentación de la Extensión de VS Code - DataScript AI

Esta es la documentación conceptual del proceso de diseño, desarrollo, arquitectura y publicación de la extensión nativa para Visual Studio Code de **DataScript AI (Documentador de Base de Datos)**.

---

## 1. Introducción al Proyecto

**DataScript AI** es una plataforma híbrida diseñada para resolver la falta de documentación actualizada y el diseño deficiente de las bases de datos. 

Para acercar esta herramienta a los desarrolladores en su entorno de trabajo diario, se convirtió el sistema web en una **extensión nativa para Visual Studio Code**. De este modo, los programadores pueden auditar, generar diagramas ER y documentar sus esquemas directamente desde su editor de código con solo hacer clic derecho sobre un archivo de base de datos.

---

## 2. Evolución de la Arquitectura de Software

Durante la fase de diseño de la extensión, se analizaron dos enfoques arquitectónicos muy distintos para la gestión del procesamiento de datos (análisis de Python y llamadas a OpenAI):

### Enfoque 1: Arquitectura Híbrida Local (Descartada)
En un inicio, se diseñó la extensión para que levantara un servidor local de Node/Express en segundo plano cada vez que el usuario abría el editor.
*   **Cómo funcionaba:** La extensión ejecutaba un proceso hijo local. Este proceso ejecutaba el servidor web y llamaba al motor local de Python para procesar los archivos SQL.
*   **Por qué se descartó:**
    1.  **Fricción de Instalación:** Obligaba al docente y a cualquier otro usuario a tener instalado Node.js, Python y múltiples librerías científicas de Python en su computadora para que la extensión funcionara.
    2.  **Seguridad Comprometida:** Al subir la extensión a la tienda pública, existía un alto riesgo de incluir por error el archivo de claves privadas del desarrollador, comprometiendo sus fondos de OpenAI.
    3.  **Rendimiento y Peso:** La extensión pesaba más de 67 Megabytes debido a las dependencias empaquetadas, haciendo la descarga lenta.

### Enfoque 2: Arquitectura de Cliente Liviano en la Nube (Implementada)
Se migró todo el procesamiento pesado a un servidor central en la nube utilizando **Vercel**.
*   **Cómo funciona:** El servidor Express y el analizador de Python están alojados en la nube. La extensión en la máquina del usuario actúa únicamente como un "visor inteligente". 
*   **El flujo de comunicación:**
    1.  El desarrollador hace clic derecho en su archivo local en VS Code y elige analizarlo.
    2.  La extensión lee el texto del archivo directamente desde el disco de la computadora.
    3.  La extensión abre una ventana visual (Webview) que carga de forma segura la interfaz de Vercel.
    4.  Utilizando un protocolo de comunicación web seguro de navegador (mensajería interna), la extensión le inyecta el contenido del archivo a la interfaz web.
    5.  La interfaz web procesa el análisis directamente con la nube de Vercel y presenta los diagramas y auditorías de forma instantánea.

---

## 3. Beneficios Clave del Diseño en la Nube

*   **Sin instalaciones previas:** La extensión funciona al instante en cualquier computadora (Windows, Mac o Linux) sin necesidad de configurar Node.js o Python localmente.
*   **Seguridad absoluta:** Las credenciales y claves de API de OpenAI y bases de datos se configuran de forma segura y centralizada en el servidor de Vercel, previniendo cualquier filtración de datos de desarrollo.
*   **Instalación ultrarrápida:** Al delegar todo el peso a Vercel, el tamaño final del instalador de la extensión en la tienda pasó de **16.5 Megabytes a solo ~10 Kilobytes** (un peso insignificante que se instala en un segundo).

---

## 4. Paso a Paso de la Creación y Publicación en Microsoft Marketplace

Para lograr publicar la extensión de forma oficial y funcional, se siguió un proceso de tres etapas fundamentales:

### Etapa A: Programación de los Componentes
1.  **Configuración del Menú Contextual:** Se editó el manifiesto de la extensión para integrarse en el menú de clic derecho del explorador de archivos de VS Code, programándolo para que solo aparezca al hacer clic en archivos relevantes de base de datos (como `.sql`, `.dbml` o `.json`).
2.  **Bypass de Autenticación:** Se implementó una lógica en el frontend web para detectar si la página se abría dentro de VS Code. De ser así, el sistema simula un inicio de sesión local automático de solo lectura para evitar pedirle usuario y contraseña de Supabase al programador cada vez que trabaja en su editor.
3.  **Transmisión de Datos:** Se programó el puente de comunicación seguro entre la extensión de VS Code y la nube de Vercel para permitir el envío del archivo en tiempo real mediante mensajería web.

### Etapa B: Creación de la Cuenta de Publicador y Token de Seguridad (PAT)
Para subir la extensión a la tienda de Microsoft, se debieron configurar credenciales de desarrollo:
1.  **Registro en Azure DevOps:** Se ingresó a la plataforma de desarrollo de Microsoft para generar un **Personal Access Token (PAT)** con permisos de administración sobre la tienda de extensiones (Marketplace).
2.  **Configuración de la Cuenta de Publicador:** Se accedió al portal de administración del Marketplace de Visual Studio y se registró la cuenta oficial de publicador con el identificador único **`ClaraQuispe`**.
3.  **Vinculación del Proyecto:** Se modificaron los metadatos del proyecto para apuntar a este ID de publicador autorizado.

### Etapa C: Empaquetado y Publicación
1.  **Filtrado de Archivos:** Se configuraron reglas de exclusión para asegurar que archivos de configuración confidenciales y código pesado de servidor local no se incluyeran en la subida final.
2.  **Subida mediante Consola:** Se utilizó la herramienta oficial de empaquetado para autenticar la sesión del desarrollador con el Token de Seguridad y subir la extensión a la tienda.
3.  **Proceso de Verificación de Microsoft:** Al recibir la extensión, los servidores de Microsoft iniciaron una fase de verificación automática que analiza el código en busca de virus, malware o problemas de rendimiento antes de aprobarla y publicarla en el buscador general.
