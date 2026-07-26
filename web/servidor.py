#!/usr/bin/env python3
"""
ArriendoMapa — servidor local
Ejecuta:  python servidor.py     (o doble clic en INICIAR.bat en Windows)
No necesita instalar nada: usa solo la librería estándar de Python.
"""
import http.server
import os
import socket
import socketserver
import sys
import threading
import webbrowser

PUERTOS = [8000, 8080, 8888, 5500, 3001]
CARPETA = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=CARPETA, **kwargs)

    def end_headers(self):
        # sin caché para ver cambios al instante al recargar
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, formato, *args):
        # solo mostrar errores, no cada archivo servido
        if args and len(args) > 1 and str(args[1]).startswith(("4", "5")):
            sys.stderr.write("  ⚠ %s\n" % (formato % args))


def puerto_libre():
    for p in PUERTOS:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                s.bind(("127.0.0.1", p))
            return p
        except OSError:
            continue
    # cualquiera que el sistema tenga libre
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main():
    faltan = [f for f in ("index.html", "datos.js") if not os.path.exists(os.path.join(CARPETA, f))]
    if faltan:
        print("✗ Faltan archivos en esta carpeta: " + ", ".join(faltan))
        print("  Asegúrate de ejecutar el script dentro de la carpeta 'web'.")
        input("\nEnter para cerrar...")
        return

    puerto = puerto_libre()
    url = f"http://localhost:{puerto}/"

    print("\n" + "═" * 52)
    print("  🏠  ARRIENDOMAPA — servidor local")
    print("═" * 52)
    print(f"\n  ▶ Mapa vectorial :  {url}")
    print(f"  ▶ Versión clásica:  {url}index-clasico.html")
    print(f"\n  Carpeta: {CARPETA}")
    print("\n  Abriendo el navegador…")
    print("  (para detener el servidor: Ctrl + C)\n")
    print("═" * 52 + "\n")

    threading.Timer(1.0, lambda: webbrowser.open(url)).start()

    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("127.0.0.1", puerto), Handler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n  Servidor detenido. ¡Hasta luego!\n")
    except OSError as e:
        print(f"\n✗ No se pudo iniciar el servidor: {e}\n")
        input("Enter para cerrar...")


if __name__ == "__main__":
    main()
