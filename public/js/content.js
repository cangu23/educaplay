const misiones = [];
const preguntas = []; // Nuevo array para todas las preguntas

function agregarMision(id, titulo, objetivo, descripcion, x, y, dimension, tipo, npc, boss, quizId, objetivoTotal) {
    misiones.push({
        id, titulo, objetivo, descripcion, x, y, dimension, tipo, 
        npc, boss, completada: false, quizId,
        preguntasRestantes: 7, // Requisito académico
        objetivosNecesarios: 7, // Actualizado a 7 por mapa
        objetivoTotal: objetivoTotal
    });
}

// Nueva función para agregar preguntas
function agregarPregunta(id, tipo, preguntaTexto, opciones, respuestaCorrecta, recompensa, castigo, nivelDificultad) {
    preguntas.push({
        id, tipo, preguntaTexto, opciones, respuestaCorrecta, castigo, recompensa, nivelDificultad
    });
}

// Banco de Preguntas: Principales (1-20) y Bonus (1-20)
const bancoPreguntas = [
    // --- PREGUNTAS PRINCIPALES ---
    { id: 1, tipo: 'mision', texto: "María recibe un correo indicando que ganó un celular, pero debe ingresar su contraseña institucional. ¿Qué amenaza es?", opciones: ["Malware", "Phishing", "Firewall", "VPN"], correcta: 1, recompensa: { xp: 100, item: 'health_pack' }, castigo: { vida: 1, xp: -50 } },
    { id: 2, tipo: 'mision', texto: "La tríada fundamental de la seguridad informática: Confidencialidad, Integridad y ____.", opciones: ["Conectividad", "Disponibilidad", "Productividad", "Legalidad"], correcta: 1, recompensa: { xp: 120 }, castigo: { vida: 1 } },
    { id: 3, tipo: 'mision', texto: "¿Cuál activo tiene mayor valor para una institución educativa?", opciones: ["Mouse", "Monitor", "Base de datos de estudiantes", "Impresora"], correcta: 2, recompensa: { xp: 150, item: 'shield' }, castigo: { vida: 1 } },
    { id: 4, tipo: 'mision', texto: "¿Qué componente realiza el procesamiento principal de la información?", opciones: ["Disco duro", "RAM", "CPU", "Tarjeta de red"], correcta: 2, recompensa: { xp: 100 }, castigo: { vida: 1 } },
    { id: 5, tipo: 'mision', texto: "¿Qué dispositivo permite conectar una red local con Internet?", opciones: ["Switch", "Router", "Hub", "Access Point"], correcta: 1, recompensa: { xp: 110 }, castigo: { vida: 1 } },
    { id: 6, tipo: 'mision', texto: "Programa diseñado para dañar, alterar o robar información:", opciones: ["Antivirus", "Firmware", "Malware", "Software Libre"], correcta: 2, recompensa: { xp: 130 }, castigo: { vida: 2 } },
    { id: 7, tipo: 'mision', texto: "¿Cuál contraseña es más segura?", opciones: ["123456", "password", "Nahomy2026", "N@h0my#2026!"], correcta: 3, recompensa: { xp: 200, item: 'health_pack' }, castigo: { vida: 1 } },
    { id: 8, tipo: 'mision', texto: "Riesgo de instalar software pirata en el laboratorio:", opciones: ["Ahorrar dinero", "Aumentar velocidad", "Malware y problemas legales", "Mejorar la seguridad"], correcta: 2, recompensa: { xp: 140 }, castigo: { vida: 1 } },
    { id: 9, tipo: 'mision', texto: "Antivirus actualizado pero se infecta constante. Causa probable:", opciones: ["Monitor dañado", "Usuario abre archivos sospechosos", "RAM insuficiente", "Teclado defectuoso"], correcta: 1, recompensa: { xp: 150 }, castigo: { vida: 1 } },
    { id: 10, tipo: 'mision', texto: "Binario 101101 a decimal:", opciones: ["43", "45", "47", "49"], correcta: 1, recompensa: { xp: 250, item: 'code_fragment' }, castigo: { vida: 2 } },
    { id: 11, tipo: 'mision', texto: "Empleado usa cuenta ajena para ver datos. ¿Qué vulneró?", opciones: ["Integridad", "Disponibilidad", "Confidencialidad", "Escalabilidad"], correcta: 2, recompensa: { xp: 160 }, castigo: { vida: 1 } },
    { id: 12, tipo: 'mision', texto: "Herramienta para descubrir equipos y servicios en red:", opciones: ["Word", "Excel", "Nmap", "Paint"], correcta: 2, recompensa: { xp: 180 }, castigo: { vida: 1 } },
    { id: 13, tipo: 'mision', texto: "Realiza respaldos pero nunca los verifica. Problema:", opciones: ["Ninguno", "Respaldos inútiles al restaurar", "Consume menos espacio", "Aumenta velocidad"], correcta: 1, recompensa: { xp: 170 }, castigo: { vida: 1 } },
    { id: 14, tipo: 'mision', texto: "¿Cuáles son amenazas externas?", opciones: ["Ransomware y Phishing", "Error humano", "Falla de disco", "Corte de luz"], correcta: 0, recompensa: { xp: 150 }, castigo: { vida: 1 } },
    { id: 15, tipo: 'mision', texto: "Archivos cifrados y piden rescate en dinero:", opciones: ["Spyware", "Troyano", "Ransomware", "Gusano"], correcta: 2, recompensa: { xp: 300, item: 'shield' }, castigo: { vida: 3 } },
    { id: 16, tipo: 'mision', texto: "Primera acción al encontrar USB con evidencias:", opciones: ["Abrir archivos", "Formatearla", "Crear copia forense", "Compartirla"], correcta: 2, recompensa: { xp: 200 }, castigo: { vida: 1 } },
    { id: 17, tipo: 'mision', texto: "Servidor: clave débil, desactualizado, puertos abiertos.", opciones: ["Clave débil", "Desactualizado", "Todos son críticos", "Ninguno"], correcta: 2, recompensa: { xp: 220 }, castigo: { vida: 2 } },
    { id: 18, tipo: 'mision', texto: "Usuario ve datos ajenos modificando la URL:", opciones: ["Fuerza bruta", "Broken Access Control", "Phishing", "Spoofing"], correcta: 1, recompensa: { xp: 240 }, castigo: { vida: 2 } },
    { id: 19, tipo: 'mision', texto: "PC comprometida en la red. Acción más adecuada:", opciones: ["Apagar red", "Ignorar", "Aislar equipo", "Reiniciar router"], correcta: 2, recompensa: { xp: 200 }, castigo: { vida: 1 } },
    { id: 20, tipo: 'mision', texto: "Credenciales obtenidas por ingeniería social. ¿Qué faltó?", opciones: ["Más PCs", "Otro antivirus", "Capacitación y MFA", "Cambiar S.O."], correcta: 2, recompensa: { xp: 500, item: 'health_pack' }, castigo: { vida: 3 } },

    // --- PREGUNTAS BONUS ---
    { id: 101, tipo: 'bonus', texto: "Encuentras USB en el patio. ¿Error principal?", opciones: ["No revisar", "No avisar", "Conectar dispositivo desconocido", "No etiquetar"], correcta: 2, recompensa: { xp: 50, item: 'code_fragment' }, castigo: { vida: 1, xp: -20 } },
    { id: 102, tipo: 'bonus', texto: "Correo del rector pide claves de alumnos urgentemente:", opciones: ["Enviarlas", "Ignorar", "Verificar autenticidad", "Reenviar"], correcta: 2, recompensa: { xp: 60 }, castigo: { vida: 1 } },
    { id: 103, tipo: 'bonus', texto: "Contraseña filtrada en redes sociales. Acción urgente:", opciones: ["Borrar post", "Cambiar contraseña", "Reiniciar PC", "Apagar Internet"], correcta: 1, recompensa: { xp: 70 }, castigo: { vida: 2 } },
    { id: 104, tipo: 'bonus', texto: "PC lenta tras descarga sospechosa. Hipótesis:", opciones: ["Fallo eléctrico", "Malware", "Monitor dañado", "Mouse"], correcta: 1, recompensa: { xp: 50 }, castigo: { vida: 1 } },
    { id: 105, tipo: 'bonus', texto: "Atacante accede pero no borra ni modifica nada. ¿Qué falló?", opciones: ["Disponibilidad", "Integridad", "Confidencialidad", "Respaldo"], correcta: 2, recompensa: { xp: 80 }, castigo: { vida: 1 } },
    { id: 106, tipo: 'bonus', texto: "Técnico comparte capturas con datos personales en grupo público:", opciones: ["Rendimiento", "Privacidad y protección de datos", "Productividad", "Disponibilidad"], correcta: 1, recompensa: { xp: 90 }, castigo: { vida: 2 } },
    { id: 107, tipo: 'bonus', texto: "¿Qué ventaja principal proporciona el cifrado?", opciones: ["Velocidad", "Tamaño", "Confidencialidad", "Mejorar RAM"], correcta: 2, recompensa: { xp: 100 }, castigo: { vida: 1 } },
    { id: 108, tipo: 'bonus', texto: "Atacante prueba miles de claves automáticamente:", opciones: ["Phishing", "Ingeniería social", "Fuerza bruta", "Sniffing"], correcta: 2, recompensa: { xp: 110 }, castigo: { vida: 1 } },
    { id: 109, tipo: 'bonus', texto: "Riesgo principal de WiFi pública gratuita:", opciones: ["Velocidad", "Intercepción de datos", "Cobertura", "Daño hardware"], correcta: 1, recompensa: { xp: 70 }, castigo: { vida: 1 } },
    { id: 110, tipo: 'bonus', texto: "¿Qué hace confiable a un respaldo?", opciones: ["Ser antiguo", "Sin verificar", "Poder restaurarse correctamente", "Estar en escritorio"], correcta: 2, recompensa: { xp: 120 }, castigo: { vida: 1 } },
    { id: 111, tipo: 'bonus', texto: "Página imita perfectamente a la de un banco:", opciones: ["Firewall", "Phishing", "Fragmentación", "Backups"], correcta: 1, recompensa: { xp: 80 }, castigo: { vida: 1 } },
    { id: 112, tipo: 'bonus', texto: "¿Cuál es la práctica más segura de acceso?", opciones: ["Misma clave siempre", "Claves en papel", "MFA (Multifactor)", "Compartir claves"], correcta: 2, recompensa: { xp: 150 }, castigo: { vida: 1 } },
    { id: 113, tipo: 'bonus', texto: "¿Por qué importa la cadena de custodia?", opciones: ["Mejorar Internet", "Validez de evidencias digitales", "Acelerar investigación", "Almacenamiento"], correcta: 1, recompensa: { xp: 130 }, castigo: { vida: 1 } },
    { id: 114, tipo: 'bonus', texto: "Servidor sin actualizar por 2 años. Riesgo:", opciones: ["Consumo eléctrico", "Vulnerabilidades conocidas", "Resolución", "Pérdida teclado"], correcta: 1, recompensa: { xp: 140 }, castigo: { vida: 2 } },
    { id: 115, tipo: 'bonus', texto: "Registros muestran miles de accesos fallidos desde una IP:", opciones: ["Error impresión", "Ataque Fuerza Bruta", "Problema eléctrico", "Error software"], correcta: 1, recompensa: { xp: 110 }, castigo: { vida: 1 } },
    { id: 116, tipo: 'bonus', texto: "Impedir acceso a carpetas no autorizadas. Principio:", opciones: ["Mínimo privilegio", "Velocidad", "Disponibilidad", "Escalabilidad"], correcta: 0, recompensa: { xp: 120 }, castigo: { vida: 1 } },
    { id: 117, tipo: 'bonus', texto: "¿Qué diferencia al Hacker Ético del atacante malicioso?", opciones: ["Usa Linux", "Más conocimientos", "Autorización para pruebas", "Usa antivirus"], correcta: 2, recompensa: { xp: 200, item: 'shield' }, castigo: { vida: 1 } },
    { id: 118, tipo: 'bonus', texto: "Persona autorizada elimina info crítica deliberadamente:", opciones: ["Externa", "Física", "Interna", "Natural"], correcta: 2, recompensa: { xp: 100 }, castigo: { vida: 2 } },
    { id: 119, tipo: 'bonus', texto: "Fase que sigue tras contener un incidente:", opciones: ["Detección", "Recuperación y restauración", "Reconocimiento", "Escaneo"], correcta: 1, recompensa: { xp: 110 }, castigo: { vida: 1 } },
    { id: 120, tipo: 'bonus', texto: "Falló todo por desconocimiento de empleados. Faltó:", opciones: ["Hardware", "Cableado", "Factor humano/Concientización", "Procesador"], correcta: 2, recompensa: { xp: 300, item: 'health_pack' }, castigo: { vida: 3 } }
];

// Definimos los 5 niveles épicos
// Definimos los 5 niveles educativos con mecánicas interactivas
agregarMision(
    1, "Nivel 1: Brute Force Defense", "Cifrado de Credenciales", 
    "REQUISITOS: 1. Obtener Key-Card. 2. Recolectar 4 fragmentos de clave. 3. Abrir el Nodo de Datos (Cofre).", 
    1200, 800, "Archivo", "simbolos",
    { nombre: "Maria", mensaje: "¡Saludos, Agente! Soy María, una informante clave. He estado rastreando tu progreso y sé que eres un ciber-explorador excepcional. Necesito tu ayuda con una amenaza de fuerza bruta. El internet está corrompido. Tu primera tarea es encontrar la Key-Card y luego recolectar 4 fragmentos de clave para abrir el Nodo de Datos al ESTE. ¡Las credenciales '7ur6QQ@@54' te esperan allí!", isShopkeeper: true, itemSold: "health_pack", price: 5 },
    { nombre: "SENTINEL-LOG", vida: 5, color: "#facc15", attackType: "plasma" },
    1, // Referencia a la pregunta de misión 1
    6  // 1 Key-Card + 4 fragmentos + 1 cofre = 6
);

agregarMision(
    2, "Nivel 2: SQL Injection", "Sanitización de Inputs", 
    "REQUISITOS: Localizar la terminal central y completar el protocolo de sanitización SQL exitosamente.", 
    1500, 1200, "Océano", "consola", // Misión 2: Arquitecto
    { nombre: "Arquitecto", mensaje: "Agente, soy el Arquitecto de este sector. Un ataque de inyección SQL ha comprometido nuestros sistemas. Necesitamos que localices la terminal central y ejecutes el protocolo de sanitización. El comando clave es 'ADMIN_PASS_99'. ¡La integridad de nuestros datos depende de ti!" },
    { nombre: "BUFFER-OVERFLOW", vida: 8, color: "#38bdf8", attackType: "ray" },
    2, // Referencia a la pregunta de misión 2
    1  // 1 Terminal (misionObjetivoRealizado)
);

agregarMision(
    3, "Nivel 3: Man-in-the-Middle", "Certificados SSL", 
    "Interceptaron el tráfico. Debes recolectar los fragmentos de certificados y validarlos en la consola para activar HTTPS.", 
    800, 1500, "Bosque", "combate_consola",
    { nombre: "Técnico", mensaje: "Soy el Técnico de seguridad. ¡Tenemos un ataque Man-in-the-Middle! El tráfico está siendo interceptado. Tu misión es recuperar los fragmentos de certificados SSL dispersos y validarlos en la consola más cercana para restablecer la conexión HTTPS segura. ¡Date prisa!" },
    { nombre: "PHISH-STALKER", vida: 10, color: "#f472b6", attackType: "mine" }, // Boss for this level
    3, // Quiz ID
    5 // 4 fragmentos de certificados + 1 consola (misionObjetivoRealizado) = 5
);

agregarMision(
    4, "Nivel 4: El Gran Cortafuegos", "Filtrado de Paquetes", 
    "Debes recolectar 4 'Tokens de Confianza' para configurar el Firewall correctamente.",
    1400, 500, "Laboratorio", "firewall", // Misión 4: Admin-Z
    { nombre: "Admin-Z", mensaje: "Agente, soy Admin-Z. Nuestro cortafuegos ha sido vulnerado. Necesitamos urgentemente 4 'Tokens de Confianza' para reconfigurarlo. Los sensores detectan señales cerca de los terminales del NORTE. ¡Sin un firewall robusto, el sistema caerá!" },
    { nombre: "RANSOM-CORE", vida: 12, color: "#4ade80", attackType: "plasma" }, // Boss for this level
    4 // Quiz ID
);

agregarMision(
    5, "Nivel 5: El Núcleo Zero-Day", "Parche Crítico", 
    "El sistema va a colapsar. Encuentra la vulnerabilidad y ejecuta el parche crítico en la consola para salvar el S.O.", 
    1700, 1450, "Núcleo", "final_consola", // Misión 5: S.O.G.
    { nombre: "S.O.G.", mensaje: "¡Agente! Soy la conciencia del Sistema Operativo Global. Mi integridad está al 5%. Un exploit de día cero me está destruyendo. Debes encontrar la vulnerabilidad y ejecutar el parche crítico 'PATCH-FIX' en la consola central. ¡El Virus Maestro lo protege! Eres nuestra última esperanza." },
    { nombre: "ULTIMATE-EXPLOIT", vida: 25, color: "#ffffff", attackType: "ray" }, // Boss for this level
    5 // Quiz ID
);