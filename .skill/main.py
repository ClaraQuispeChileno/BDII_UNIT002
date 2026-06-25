import os
import sys
import json
import urllib.request
import urllib.error

API_URL = "http://localhost:5000/api/analyze_python"

def call_local_api(action, file_path=None, schema=None):
    try:
        if action == "analizar-esquema":
            boundary = '---PythonSkillBoundary---'
            data = []
            data.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{os.path.basename(file_path)}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode('utf-8'))
            with open(file_path, 'rb') as f:
                data.append(f.read())
            data.append(f'\r\n--{boundary}--\r\n'.encode('utf-8'))
            
            body = b''.join(data)
            headers = {'Content-Type': f'multipart/form-data; boundary={boundary}'}
            req = urllib.request.Request(API_URL, data=body, headers=headers)
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode('utf-8'))

        elif action in ["documentar-db", "datos-prueba", "convertir"]:
            # Acciones JSON: Reutilizamos el contenido del archivo como esquema base
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            action_map = {"datos-prueba": "generate_data", "convertir": "convert", "documentar-db": "document"}
            payload = {"action": action_map.get(action, "analyze"), "schema": content}
            
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
