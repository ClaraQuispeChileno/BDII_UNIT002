import os
import sys
import json
import urllib.request
import urllib.error
from dotenv import load_dotenv

# Load environment variables from the root .env file
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)

API_URL = os.environ.get("API_URL", "https://bdii-unit-002.vercel.app/api/analyze_python")


def generate_documentation_markdown(analysis):
    schema = analysis.get('schema', {})
    metrics = analysis.get('metrics', {})
    anomalies = analysis.get('anomalies', [])
    norm_score = metrics.get('normalizationScore', 50)
    
    # Calcular barra de progreso de normalización
    progress_fill = int(round(norm_score / 10))
    progress_empty = 10 - progress_fill
    bar = '[' + '█' * progress_fill + '░' * progress_empty + f'] {norm_score}%'

    doc = f"# Documentación Técnica de Base de Datos (Generada Localmente)\n\n"

    # SECCIÓN 1: ANÁLISIS GENERAL
    doc += f"## 1. ANÁLISIS GENERAL\n\n"
    doc += f"{bar}\n\n"
    
    if analysis.get('opinion'):
        doc += f"{analysis.get('opinion')}\n\n"

    doc += f"### Métricas Clave\n"
    doc += f"- **Integridad y Relaciones**: {len(schema.get('relations', [])) if schema.get('relations') else 0} detectadas.\n"
    doc += f"- **Normalización**: {norm_score}%\n"
    doc += f"- **Tablas Totales**: {metrics.get('totalTables', 0)}\n"
    doc += f"- **Columnas Totales**: {metrics.get('totalColumns', 0)}\n\n"

    # SECCIÓN 2: DICCIONARIO DE DATOS
    doc += f"## 2. DICCIONARIO DE DATOS\n\n"
    tables = schema.get('tables', [])
    for table in tables:
        tname = table.get('name', 'Sin Nombre')
        columns = table.get('columns', [])
        doc += f"### **{tname}**\n"
        doc += f"Descripción: Entidad que almacena los registros correspondientes a {tname}. Cuenta con {len(columns)} columnas.\n\n"
        doc += f"| Campo | Tipo de dato | Descripción | Observaciones |\n"
        doc += f"|-------|--------------|-------------|----------------|\n"
        
        for column in columns:
            cname = column.get('name', '')
            ctype = column.get('type', '')
            obs = []
            if column.get('primaryKey'): obs.append("PK")
            if not column.get('nullable', True): obs.append("NOT NULL")
            if column.get('autoIncrement'): obs.append("AUTO_INCREMENT")
            
            # Detección de FK
            fks = table.get('foreignKeys', [])
            fk = next((f for f in fks if f.get('column') == cname), None)
            if fk:
                ref_t = fk.get('referencesTable') or fk.get('references', {}).get('table', '')
                obs.append(f"FK -> {ref_t}")
            
            obs_str = ", ".join(obs) if obs else "-"
            doc += f"| {cname} | {ctype} | Campo '{cname}' de tipo {ctype}. | {obs_str} |\n"
        doc += f"\n"

    # SECCIÓN 3: ANÁLISIS DE VÍNCULOS Y RELACIONES
    doc += f"## 3. ANÁLISIS DE VÍNCULOS Y RELACIONES\n\n"
    relations = schema.get('relations', [])
    if relations:
        doc += f"Se han detectado las siguientes relaciones clave en el esquema:\n\n"
        for rel in relations:
            doc += f"- **{rel.get('from')}** se relaciona con **{rel.get('to')}** mediante el campo `{rel.get('column')}`.\n"
    else:
        doc += f"No se han detectado relaciones (Foreign Keys) explícitas en el esquema. Esto puede comprometer la integridad referencial si se trata de un modelo relacional.\n"
    doc += f"\n"

    # SECCIÓN 4: SUGERENCIAS DE OPTIMIZACIÓN
    doc += f"## 4. SUGERENCIAS DE OPTIMIZACIÓN\n\n"
    optimization_anomalies = [a for a in anomalies if a.get('type') == 'optimization' or a.get('severity') == 'medium']
    if optimization_anomalies:
        for anomaly in optimization_anomalies:
            doc += f"- **[MEJORA]** En tabla **{anomaly.get('table')}**: {anomaly.get('message')}\n"
    else:
        doc += f"- **[ESTÁNDAR]** El esquema cumple con estándares básicos. Se recomienda asegurar el uso de índices en campos de búsqueda frecuente.\n"
        doc += f"- **[MEJORA]** Revise que los nombres de tablas mantengan coherencia (singular vs plural).\n"
    doc += f"\n"

    # SECCIÓN 5: CRÍTICA OBLIGATORIA
    doc += f"## 5. CRÍTICA OBLIGATORIA\n\n"
    critical_anomalies = [a for a in anomalies if a.get('severity') == 'high']
    if critical_anomalies:
        doc += f"El esquema presenta errores estructurales graves que deben ser abordados:\n\n"
        for anomaly in critical_anomalies:
            doc += f"- **[CRÍTICO]** **{anomaly.get('table')}**: {anomaly.get('message')}\n"
    elif norm_score < 70:
        doc += f"El diseño es funcional, pero el nivel de normalización ({norm_score}%) es bajo. Esto puede llevar a redundancia de datos o problemas de actualización a futuro. Considere aplicar hasta la 3FN.\n"
    else:
        doc += f"El diseño estructural es sólido. No se observan bloqueadores críticos. Sin embargo, en auditorías financieras se recomienda siempre asegurar que campos monetarios usen tipos exactos (ej. DECIMAL) y no aproximados (FLOAT).\n"
    doc += f"\n"

    return doc

def call_local_api(action, file_path=None, schema=None):
    try:
        if action == "analizar-esquema":
            boundary = '---PythonSkillBoundary---'
            data = []
            data.append(f'--{boundary}\nContent-Disposition: form-data; name="file"; filename="{os.path.basename(file_path)}"\nContent-Type: application/octet-stream\n\n'.encode('utf-8'))
            with open(file_path, 'rb') as f:
                data.append(f.read())
            data.append(f'\n--{boundary}--\n'.encode('utf-8'))
            
            body = b''.join(data)
            headers = {'Content-Type': f'multipart/form-data; boundary={boundary}'}
            req = urllib.request.Request(API_URL, data=body, headers=headers)
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode('utf-8'))

        elif action in ["documentar-db", "datos-prueba", "convertir"]:
            # Obtener el esquema analizado primero para estructurarlo correctamente
            analysis_res = call_local_api("analizar-esquema", file_path)
            if not analysis_res.get('success'):
                return {"success": False, "error": f"Error al pre-analizar el esquema: {analysis_res.get('error')}"}
            
            analysis = analysis_res.get('analysis', {})
            parsed_schema = analysis.get('schema', {})
            
            if action == "documentar-db":
                doc_markdown = generate_documentation_markdown(analysis)
                return {"success": True, "documentationMarkdown": doc_markdown}
                
            elif action == "convertir":
                conversions = analysis.get('conversions', {})
                return {"success": True, "conversions": conversions}
                
            elif action == "datos-prueba":
                payload = {
                    "action": "generate_data",
                    "schema": parsed_schema,
                    "config": {}
                }
                data = json.dumps(payload).encode('utf-8')
                headers = {'Content-Type': 'application/json'}
                req = urllib.request.Request(API_URL, data=data, headers=headers)
                with urllib.request.urlopen(req) as response:
                    return json.loads(response.read().decode('utf-8'))
        else:
            return {"success": False, "error": "Acción no reconocida"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def show_biblioteca():
    print("\n--- /biblioteca: Comandos Disponibles ---")
    print(" analizar-esquema : Analiza la estructura de la base de datos.")
    print(" documentar-db    : Genera documentación técnica completa.")
    print(" datos-prueba     : Genera datos de prueba.")
    print(" convertir        : Convierte esquemas a otros formatos.")
    print("------------------------------------------\n")

def main():
    print("DB-Skill Engine Iniciado (Modo Nativo Local).")
    while True:
        db_path = input("\n[Configuración] Ruta de BD: ").strip()
        if db_path.lower() == 'salir': break
        if not os.path.exists(db_path): 
            print("Archivo no encontrado.")
            continue

        while True:
            cmd = input("\n[Comando] > ").strip().lower()
            if cmd == "salir": sys.exit()
            elif cmd == "cambiar-db": break
            elif cmd in ["/biblioteca", "biblioteca"]: show_biblioteca()
            elif cmd in ["analizar-esquema", "documentar-db", "datos-prueba", "convertir"]:
                print(f"Ejecutando {cmd}...")
                res = call_local_api(cmd, file_path=db_path)
                print(json.dumps(res, indent=2))
            else: print("Comando no reconocido. Escribe '/biblioteca' para ver las opciones.")

if __name__ == "__main__":
    main()
