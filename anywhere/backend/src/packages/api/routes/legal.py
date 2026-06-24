import os
from flask import Blueprint, send_from_directory

# Definimos el Blueprint sin prefijo de URL para que queden en la raíz (ej: dominio.com/privacidad.html)
bp = Blueprint('legal', __name__)

# Definimos la ruta absoluta hacia tu carpeta frontend basándonos en tus logs anteriores
# Ajusta esta ruta si tu carpeta frontend está en otra ubicación
FRONTEND_DIR = '/home/danielwaltherberns/Code/crowsource/anywhere/frontend'

@bp.route('/privacidad.html')
def privacidad():
    """Sirve la Política de Privacidad estática."""
    return send_from_directory(FRONTEND_DIR, 'privacidad.html')

@bp.route('/terminos.html')
def terminos():
    """Sirve los Términos de Servicio estáticos."""
    return send_from_directory(FRONTEND_DIR, 'terminos.html')
