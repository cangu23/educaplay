let canvas = document.getElementById("gameCanvas");
let ctx = null;

// --- CONFIGURACIÓN GLOBAL Y DIMENSIONES ---
const WORLD_WIDTH = 2500; 
const WORLD_HEIGHT = 2000;
const defaultCanvasWidth = window.innerWidth;
const defaultCanvasHeight = window.innerHeight;

// --- POOLS DE COMANDOS PARA ALEATORIEDAD ---
const comandoPools = {
    sql: ["sql-fix --sanitize", "db-patch --input", "query-filter --clean", "stmt-prepare --id", "mysql_secure_installation"],
    ssl: ["ssl-handshake --secure", "cert-verify --prod", "https-init --force", "tls-update --v3", "openssl-x509-check"],
    patch: ["PATCH-FIX --critical", "sys-repair --all", "kernel-update --now", "zero-day-block", "apt-get-dist-upgrade"],
    network: ["nmap -sV target", "ssh-harden --config", "firewall-apply --rules", "iptables -A INPUT", "fail2ban-client-start"],
    firewall: ["192.168.1.50", "10.0.0.21", "172.16.254.1", "8.8.8.8", "200.45.1.10"]
};

// Cache de elementos del DOM para evitar búsquedas repetidas
const domCache = {};

// --- SISTEMA DE SONIDO 8-BIT (Sintetizador Web Audio) ---
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}
// Added missing closing brace to fix syntax error


function play8BitSound(type) {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'collect') {
        // Sonido rápido ascendente (Blip!)
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'success') {
        // Arpegio de victoria (C-E-G)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // Do5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // Mi5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // Sol5
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    }
}

// --- MÚSICA DE FONDO 8-BIT ---
let musicEnabled = false;
let musicIndex = 0;
// Una melodía simple en arpegio (A3, C4, E4, G4, A4...)
const mainMelody = [220.00, 261.63, 329.63, 392.00, 440.00, 392.00, 329.63, 261.63];

function playMelodyLoop() {
    if (!musicEnabled) return;
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'square'; // Onda cuadrada para el toque retro auténtico
    osc.frequency.setValueAtTime(mainMelody[musicIndex], audioCtx.currentTime);
    
    // Volumen muy bajo para que sea música de fondo y no opaque los efectos
    gain.gain.setValueAtTime(0.015, audioCtx.currentTime); 
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
    
    musicIndex = (musicIndex + 1) % mainMelody.length;
    setTimeout(playMelodyLoop, 500); // Toca la siguiente nota cada medio segundo
}

// --- SISTEMA DE NARRACIÓN (TTS) ---
let currentSpeechRate = 1.0;
let lastSpokenText = ""; // Almacena el último texto para la función de rebobinar

function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    
    lastSpokenText = text; // Guardamos el texto actual
    if (domCache.speechControls) domCache.speechControls.classList.remove("hidden"); // Mostrar controles al empezar a hablar

    // Resetear el icono del botón de pausa al iniciar nueva locución
    if (domCache.pauseSpeechBtn) domCache.pauseSpeechBtn.innerText = "⏸";

    // Limpiar texto de artefactos de formato (como *** o markdown)
    const cleanText = text.replace(/[*#_>]/g, '').replace(/&gt;/g, '').trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    let voices = window.speechSynthesis.getVoices();
    
    // Priorizar voces naturales o específicas si están disponibles
    const preferredVoice = voices.find(v => v.lang.includes('es') && v.name.includes('Google')) || 
                          voices.find(v => v.lang.includes('es') && v.name.includes('Helena')) ||
                          voices.find(v => v.lang.includes('es'));
    
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.lang = 'es-ES';
    utterance.rate = currentSpeechRate; // 1.0 es el valor por defecto más natural
    utterance.pitch = 1.0; 
    
    // Manejo de fin de voz para limpiar UI si es necesario
    utterance.onend = () => { // Use domCache.quizModal
        // Solo ocultamos si no estamos en un modal que los requiera permanentemente
        if (estadoJuego === "JUGANDO" && !consolaActiva && domCache.quizModal.classList.contains("hidden")) {
            if (domCache.speechControls) domCache.speechControls.classList.add("hidden");
        }
    };

    window.speechSynthesis.speak(utterance);
}

function rewindSpeech() {
    // Reinicia la locución del último texto registrado
    if (lastSpokenText) speakText(lastSpokenText);
}

function togglePauseSpeech() {
    if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume(); // Use domCache.pauseSpeechBtn
        if (domCache.pauseSpeechBtn) domCache.pauseSpeechBtn.innerText = "⏸";
    } else {
        window.speechSynthesis.pause(); // Use domCache.pauseSpeechBtn
        if (domCache.pauseSpeechBtn) domCache.pauseSpeechBtn.innerText = "▶";
    }
}

function skipSpeech() { window.speechSynthesis.cancel(); }

function changeSpeechRate() {
    // Ciclo de velocidades: 1.0 -> 1.2 -> 1.5 -> 2.0 -> 0.8
    if (currentSpeechRate === 1.0) currentSpeechRate = 1.2;
    else if (currentSpeechRate === 1.2) currentSpeechRate = 1.5;
    else if (currentSpeechRate === 1.5) currentSpeechRate = 2.0;
    else if (currentSpeechRate === 2.0) currentSpeechRate = 0.8;
    else currentSpeechRate = 1.0;
    if (domCache.speedBtn) domCache.speedBtn.innerText = `${currentSpeechRate}x`;

    // Reiniciar la locución con la nueva velocidad para que el cambio sea inmediato
    if (window.speechSynthesis.speaking) {
        speakText(lastSpokenText);
    }
}

let camX = 0, camY = 0; // Definir globalmente para que todas las funciones de dibujo las vean

// Intentar inicializar el canvas si ya existe en el DOM
function initCanvas() {
    canvas = domCache.gameCanvas;
    if (canvas) {
        ctx = canvas.getContext("2d");
        if (ctx) {
            canvas.width = defaultCanvasWidth;
            canvas.height = defaultCanvasHeight;
            ctx.imageSmoothingEnabled = false;
            return true;
        }
    }
    return false;
}

// Inicializar cache de elementos del DOM
function initDomCache() {
    domCache.gameCanvas = document.getElementById("gameCanvas");
    domCache.loadingScreen = document.getElementById("loading-screen");
    domCache.skinSelector = document.getElementById("skin-selector");
    domCache.btnContinuar = document.getElementById("btn-continuar");
    domCache.navUserName = document.getElementById("nav-user-name");
    // Movido al HUD superior derecho
    domCache.scoreDisplay = document.getElementById("score-display");
    domCache.levelDisplay = document.getElementById("level");
    domCache.fragmentsCount = document.getElementById("fragments-count");
    domCache.userDisplay = document.getElementById("user-display");
    domCache.missionTracker = document.getElementById("mission-tracker");
    // Movido al HUD superior izquierdo
    domCache.livesDisplay = document.getElementById("lives-display");
    domCache.batteryBarHud = document.getElementById("battery-bar-hud");
    domCache.batteryVal = document.getElementById("battery-val");
    // La estamina permanece en el panel lateral
    domCache.staminaBarHud = document.getElementById("stamina-bar-hud");
    domCache.staminaVal = document.getElementById("stamina-val");
    domCache.codeFragmentsDisplay = document.getElementById("code-fragments-display");
    domCache.cooldownR = document.getElementById("cooldown-r");
    domCache.cooldownE = document.getElementById("cooldown-e");
    domCache.cooldownQ = document.getElementById("cooldown-q"); // Añadido para el nuevo elemento de habilidad
    domCache.quizModal = document.getElementById("quiz-modal");
    domCache.quizTitle = document.getElementById("quiz-title");
    domCache.quizQuestion = document.getElementById("quiz-question");
    domCache.optionsContainer = document.getElementById("options-container");
    domCache.feedback = document.getElementById("feedback");
    domCache.closeBtn = document.getElementById("close-btn");
    // Movido al HUD inferior izquierdo
    domCache.speechControls = document.getElementById("hud-speech-controls");
    domCache.pauseSpeechBtn = document.getElementById("pause-speech-btn");
    domCache.speedBtn = document.getElementById("speed-btn");
    domCache.gameOverScreen = document.getElementById("game-over-screen");
    domCache.countdownOverlay = document.getElementById("countdown-overlay");
    domCache.skinOptionsContainer = document.getElementById("skin-options-container");
    domCache.chatPanel = document.getElementById("chat-panel");
    domCache.gameContainer = document.getElementById("game-container");
    domCache.credentialsBox = document.getElementById("credentials-box");
    domCache.credentialsList = document.getElementById("credentials-list");
    domCache.credentialsTitle = document.getElementById("credentials-title");
    domCache.hudAccessCode = document.getElementById("hud-access-code");
    domCache.hudCredentialsList = document.getElementById("hud-credentials-list");
    domCache.hudAccessCodeTitle = document.getElementById("hud-access-code-title");
    domCache.shopModal = document.getElementById("shop-modal");
}

// --- SISTEMA DE TEXTOS FLOTANTES (Puntos, etc.) ---
let floatingTexts = [];
function crearFloatingText(x, y, text, color = "#facc15", life = 60, vy = -1) {
    floatingTexts.push({ x, y, text, color, life, vy });
}

// --- VARIABLES DE ACCIÓN ---
let screenShake = 0;
let npcs = [];
let proyectilesEnemigos = [];
let proyectilesJugador = [];
let missionItems = [];
let otrosJugadores = [];
let misionProgreso = 0;
let misionObjetivoRealizado = false; // Nueva bandera para tareas específicas (hackeo, cofres)
let apagonLuz = 0;
let damageFlash = 0;
let tieneLlave = false;
let consolaActiva = false;
let codeFragments = 0; // Nueva moneda del juego
let hackTimer = 0; // Tiempo restante para el hackeo
let hackTimerInterval = null; // ID del intervalo del cronómetro
let portalSwirlActive = false;
let portalSwirlX = 0;
let portalSwirlY = 0;

// --- LÓGICA DE INICIO ROBUSTA ---
function startup() {
    try {
        // Inicializar el cache de elementos si no se ha hecho
        if (!domCache.gameCanvas) initDomCache();
        
        // Configurar el canvas y el contexto
        if (initCanvas()) {
            // El bucle de juego (dibujar) se iniciará por seleccionarSkin()
        }

        if (domCache.loadingScreen) domCache.loadingScreen.classList.add("hidden");

        // IMPORTANTE: Mostrar el selector de personajes si estamos en la fase inicial
        if (estadoJuego === "SELECCION" && domCache.skinSelector) {
            domCache.skinSelector.classList.remove("hidden");
        }
    } catch (e) {
        console.error("Error durante el arranque del sistema:", e);
    }
}

// Asegurar inicio correcto
window.addEventListener('DOMContentLoaded', startup); // Intentar iniciar tan pronto como el DOM esté listo.
window.addEventListener('load', () => { // Fallback: si DOMContentLoaded no inició el bucle, intentar de nuevo después de que todos los recursos estén cargados.
    // No iniciar cuenta regresiva aquí, se activará al elegir personaje
    console.log("Sistemas listos. Esperando elección de Agente...");
});

let score = 0;
let fragmentosEncontrados = 0;
let juegoPausado = true;
let estadoJuego = "SELECCION";
let misionActivaIndex = 0;
let dimensionActual = "Archivo"; // Ajustado para coincidir con la primera misión de content.js
let questionsCorrectTotal = 0;
let questionsWrongTotal = 0;
let registroErrores = [];
let statsPorNivel = [];
let currentLevelCorrect = 0;
let enemiesToSpawn = 0;
let spawnTimer = 0;
let isCountingDown = false;
let loopIniciado = false; // Controla que el bucle de dibujo solo se inicie una vez
let currentTutorialStep = 0;
let nivelCompletado = false; // Nueva bandera para controlar el mensaje de victoria

// --- SISTEMA DE PARTÍCULAS ---
let particulas = [];
function crearParticula(x, y, color) {
    for(let i=0; i<3; i++) { // Genera 3 partículas por llamada
        particulas.push({
            x, y, 
            vx: (Math.random()-0.5)*4, // Velocidad aleatoria en X
            vy: (Math.random()-0.5)*4, // Velocidad aleatoria en Y
            life: 1.0, // Vida de la partícula (1.0 = 100%)
            color 
        });
    }
}

function lanzarConfeti() {
    const colores = ["#facc15", "#ffffff", "#eab308", "#71717a", "#fbbf24"];
    for (let i = 0; i < 120; i++) {
        particulas.push({
            x: camX + Math.random() * canvas.width,
            y: camY + canvas.height + 10, // Salen desde abajo hacia arriba
            vx: (Math.random() - 0.5) * 8,
            vy: -Math.random() * 12 - 10,
            life: 2.5,
            color: colores[Math.floor(Math.random() * colores.length)],
            size: Math.random() * 6 + 6, // Identificador de confeti
            rotate: Math.random() * Math.PI,
            vRotate: (Math.random() - 0.5) * 0.2
        });
    }
}

// --- SISTEMA DE MAPAS DINÁMICOS ---
// Ajustamos las rutas para que funcionen desde la carpeta /public/
const mapas = {
    "Archivo": { ambient: "#0a0a0a", accent: "#facc15" }, 
    "Océano": { ambient: "#0a0a0a", accent: "#38bdf8" },  
    "Bosque": { ambient: "#0a0a0a", accent: "#4ade80" },  
    "Laboratorio": { ambient: "#0a0a0a", accent: "#a78bfa" }, 
    "Núcleo": { ambient: "#050505", accent: "#ef4444" },  
    "Pueblo": { ambient: "#0a0a0a", accent: "#facc15" },
    "Centro Comercial": { ambient: "#0f172a", accent: "#f472b6" },
    "Data Center": { ambient: "#020617", accent: "#22d3ee" }
};

// Objetos decorativos que no están en la imagen de fondo
let decoraciones = [
    // Archivo
    { x: 300, y: 400, tipo: "servidor" }, { x: 800, y: 200, tipo: "pc" }, { x: 1200, y: 600, tipo: "mesa" },
    { x: 1500, y: 100, tipo: "archivador" }, { x: 200, y: 1200, tipo: "pc" }, { x: 1000, y: 1500, tipo: "planta" },
    { x: 450, y: 850, tipo: "pc" }, { x: 1400, y: 900, tipo: "mesa" }, { x: 2200, y: 300, tipo: "servidor" },
    { x: 1800, y: 1700, tipo: "archivador" }, { x: 600, y: 1600, tipo: "planta" }, { x: 1100, y: 1100, tipo: "pc" },
    
    // Océano (Cosas referentes)
    { x: 200, y: 200, tipo: "coral", dimension: "Océano" }, { x: 500, y: 800, tipo: "alga", dimension: "Océano" },
    { x: 1200, y: 300, tipo: "pez", dimension: "Océano" }, { x: 1800, y: 1500, tipo: "coral", dimension: "Océano" },
    { x: 2200, y: 100, tipo: "alga", dimension: "Océano" }, { x: 400, y: 1400, tipo: "submarino", dimension: "Océano" },
    { x: 900, y: 1100, tipo: "coral", dimension: "Océano" }, { x: 1500, y: 500, tipo: "alga", dimension: "Océano" },

    // Bosque (Más árboles)
    { x: 100, y: 100, tipo: "arbol", dimension: "Bosque" }, { x: 300, y: 400, tipo: "arbol", dimension: "Bosque" },
    { x: 600, y: 200, tipo: "arbol", dimension: "Bosque" }, { x: 1000, y: 800, tipo: "arbol", dimension: "Bosque" },
    { x: 1500, y: 1200, tipo: "arbol", dimension: "Bosque" }, { x: 2000, y: 500, tipo: "arbol", dimension: "Bosque" },
    { x: 1200, y: 1800, tipo: "arbol", dimension: "Bosque" }, { x: 800, y: 1500, tipo: "tronco", dimension: "Bosque" },
    { x: 400, y: 1600, tipo: "arbol", dimension: "Bosque" }, { x: 1800, y: 100, tipo: "arbol", dimension: "Bosque" },

    // Pueblo Digital (Casas, policías, estaciones)
    { x: 100, y: 100, tipo: "casa", dimension: "Pueblo" }, { x: 300, y: 150, tipo: "cafeteria", dimension: "Pueblo" },
    { x: 500, y: 50, tipo: "museo", dimension: "Pueblo" }, { x: 700, y: 200, tipo: "policia_station", dimension: "Pueblo" }, 
    { x: 800, y: 800, tipo: "estatua", dimension: "Pueblo" }, { x: 1500, y: 1000, tipo: "casa", dimension: "Pueblo" },
    { x: 900, y: 100, tipo: "casa", dimension: "Pueblo" }, { x: 1100, y: 300, tipo: "cesped", dimension: "Pueblo" },
    { x: 1300, y: 50, tipo: "reloj", dimension: "Pueblo" }, { x: 1500, y: 200, tipo: "casa", dimension: "Pueblo" },
    { x: 100, y: 500, tipo: "casa", dimension: "Pueblo" }, { x: 300, y: 600, tipo: "lampara", dimension: "Pueblo" },
    { x: 1800, y: 1200, tipo: "banco", dimension: "Pueblo" }, { x: 2200, y: 500, tipo: "casa", dimension: "Pueblo" }
];

const items = [
    { x: 400, y: 500, tipo: "espada", activo: true },
    { x: 1800, y: 300, tipo: "espada", activo: true },
    { x: 1000, y: 1000, tipo: "pistola", activo: true }
];

let cofres = [
    { x: 1400, y: 800, abierto: false, recompensa: "HASH_V1", dimension: "Archivo" }
];

const secretos = [
    { x: 500, y: 800, activo: true }, { x: 1500, y: 200, activo: true }, { x: 2000, y: 1500, activo: true },
    { x: 700, y: 100, activo: true }, { x: 1800, y: 1200, activo: true }
];

let enemigos = [];
let collisionData = null; // No se usará para colisiones de imagen, pero se mantiene para compatibilidad con puedeCaminar

function cargarNivel(nombre, onReadyCallback) {
    console.log("Iniciando carga de dimensión:", nombre);
    
    const loadingScreen = domCache.loadingScreen;
    
    try {
        // Reset de estado
        tieneLlave = false;
        misionProgreso = 0;
        nivelCompletado = false; // Resetear estado de victoria
        jugador.missionInventory = []; // Limpiar inventario de misión al cambiar de nivel
        misionObjetivoRealizado = false;

        // Mostrar Briefing de Misión al cargar
        if (typeof misiones !== 'undefined' && misiones[misionActivaIndex]) {
            const m = misiones[misionActivaIndex];
            const toast = document.createElement("div");
            toast.className = "mission-toast";
            toast.innerHTML = `<h2>MISIÓN: ${m.titulo}</h2><p>> OBJETIVO: ${m.objetivo}</p><p style="font-size:0.8rem; color:var(--primary-color); font-weight:bold;">CONTROLES: [WASD] Moverse | [ESPACIO] Atacar | [E] Interactuar</p>`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 12000); // 12 segundos para leer
        }

        if (loadingScreen) loadingScreen.classList.remove("hidden");

        juegoPausado = true;
        npcs = []; 
        
        setTimeout(() => {
            // OCULTAR SIEMPRE LA PANTALLA DE CARGA
            if (loadingScreen) loadingScreen.classList.add("hidden");

            if (domCache.skinSelector && estadoJuego === "SELECCION") domCache.skinSelector.classList.remove("hidden");
            
            // juegoPausado se mantiene true para que la cuenta regresiva funcione
            
            // Población procedural del nivel
            spawnEnemigos(15 + (misionActivaIndex * 8));
            generarMapaDenso();
            
            if (misiones[misionActivaIndex]) {
                spawnNPC(misiones[misionActivaIndex].npc);
            }

            // Colocar llave y cofre según el nivel
            if (dimensionActual === "Archivo") {
                items.push({ x: 400, y: 1500, tipo: "key_card", activo: true });
            }

            if (!loopIniciado) {
                loopIniciado = true;
                dibujar();
            }

            // Call the callback when loading is complete
            if (onReadyCallback) {
                onReadyCallback();
            }
        }, 100);
    } catch (err) {
        console.error("Fallo crítico en cargarNivel:", err);
        if (loadingScreen) loadingScreen.classList.add("hidden");
    }
}

function generarMapaDenso() {
    // Limpiar decoraciones previas de la dimensión actual para reconstruir la ciudad
    decoraciones = decoraciones.filter(d => d.dimension === undefined || d.dimension !== dimensionActual);

    const step = 450; // Tamaño del bloque (coincide con las calles)
    const safetyMargin = 60; // No poner nada cerca de las calles

    // 1. Generar Edificios Principales (Uno por bloque, centrado)
    const urbanTypes = ["skyscraper", "banco", "museo", "policia_station", "mall"];
    
    for (let x = 0; x < WORLD_WIDTH; x += step) {
        for (let y = 0; y < WORLD_HEIGHT; y += step) {
            // Solo hay un 70% de probabilidad de edificio para dejar espacios vacíos (plazas)
            if (Math.random() > 0.3) {
                const buildX = x + step / 2 - 40;
                const buildY = y + step / 2 - 40;
                
                decoraciones.push({
                    x: buildX,
                    y: buildY,
                    tipo: urbanTypes[Math.floor(Math.random() * urbanTypes.length)],
                    dimension: dimensionActual
                });
            }
        }
    }

    // 2. Mobiliario urbano (Evitando las calles y otros objetos)
    const streetDetails = ["vending_machine", "street_light", "bench", "planta"];
    let intentos = 0;
    let colocados = 0;

    while (colocados < 100 && intentos < 500) {
        intentos++;
        const rx = Math.random() * (WORLD_WIDTH - 50);
        const ry = Math.random() * (WORLD_HEIGHT - 50);

        // REGLA 1: No estar en la calle (múltiplos de 450 con margen)
        const inStreetX = (rx % step < safetyMargin) || (rx % step > step - safetyMargin);
        const inStreetY = (ry % step < safetyMargin) || (ry % step > step - safetyMargin);

        if (!inStreetX && !inStreetY) {
            // REGLA 2: No encimarse a otro objeto
            const overlap = decoraciones.some(d => Math.hypot(d.x - rx, d.y - ry) < 60);
            
            if (!overlap) {
                decoraciones.push({
                    x: rx, y: ry,
                    tipo: streetDetails[Math.floor(Math.random() * streetDetails.length)],
                    dimension: dimensionActual
                });
                colocados++;
            }
        }
    }
}

function mostrarGameOver() {
    juegoPausado = true;
    const goScreen = domCache.gameOverScreen;
    if (goScreen) {
        goScreen.classList.remove("hidden");
        play8BitSound('success'); // Podrías añadir un sonido de error
    }
}

// Funciones faltantes para evitar errores de referencia
// Mejora visual del mapa: Suelo con textura digital
function dibujarSueloDecorativo() {
    const colorBase = mapas[dimensionActual]?.accent || "#facc15";
    ctx.save();
    // Calles Digitales (Grillas de Neón)
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = colorBase;
    ctx.lineWidth = 100;
    // Horizontales
    for(let y = 450; y < WORLD_HEIGHT; y += 450) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_WIDTH, y); ctx.stroke();
        ctx.save(); ctx.setLineDash([40, 40]); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_WIDTH, y); ctx.stroke(); ctx.restore();
    }
    // Verticales
    for(let x = 450; x < WORLD_WIDTH; x += 450) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_HEIGHT); ctx.stroke();
        ctx.save(); ctx.setLineDash([40, 40]); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_HEIGHT); ctx.stroke(); ctx.restore();
    }

    // Brillo ambiental de datos
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = colorBase;
    for(let i=0; i<150; i++) {
        ctx.fillRect((Math.sin(i) * 10000) % WORLD_WIDTH, (Math.cos(i) * 10000) % WORLD_HEIGHT, 2, 2);
    }
    ctx.restore();
}

function dispararPistola() {
    const vx = jugador.direccion === "Left" ? -8 : (jugador.direccion === "Right" ? 8 : 0);
    const vy = jugador.direccion === "Up" ? -8 : (jugador.direccion === "Down" ? 8 : 0);
    if (vx === 0 && vy === 0) return false;
    proyectilesJugador.push({ x: jugador.x + 15, y: jugador.y + 15, vx, vy, vida: 100, damage: jugador.pistolaDamage });
    return true;
}

function mostrarAvisoDisparo() {
    console.log("¡Pistola obtenida! Presiona X para disparar.");
}

function spawnNPC(datos) {
    if (!datos || typeof misiones === 'undefined' || !misiones[misionActivaIndex]) return;
    
    let mensajeFinal = datos.mensaje;

    // Aseguramos que si es la Misión 1 (ID: 1), el bot (María) mencione el código de acceso correcto.
    if (misiones[misionActivaIndex].id === 1) {
        mensajeFinal = "Hola, soy María. El sistema ha detectado un ataque de Fuerza Bruta. Para restaurar el acceso, debes recolectar los 4 fragmentos del código secreto: 7, u, r, 6. ¡Búscalos por el mapa!";
    }

    npcs.push({
            x: misiones[misionActivaIndex].x - 150, // Spawn cerca del objetivo
            y: misiones[misionActivaIndex].y + 50,
        w: 30, // Ancho del NPC para colisiones
        h: 45, // Alto del NPC para colisiones (basado en el dibujo)
        nombre: datos.nombre,
            mensaje: mensajeFinal, // El mensaje que contiene la pista de la misión
        color: "#fff",
        charIndex: 0,
        style: Math.floor(Math.random() * 4), // 0: Calvo, 1: Pinchos, 2: Gorra, 3: Melena
        lastCharTime: 0,
            lineas: [], // Para almacenar el texto envuelto
        // Propiedades para NPCs vendedores
        isShopkeeper: datos.isShopkeeper || false,
        itemSold: datos.itemSold || null,
        price: datos.price || 0,
        // Nuevas propiedades para movimiento
        vx: (Math.random() - 0.5) * 2, // Dirección inicial aleatoria
        vy: (Math.random() - 0.5) * 2,
        vel: 0.5 + Math.random() * 0.5, // Velocidad más lenta que el jugador
        patrolTimer: 0 // Forzará un cambio de dirección inmediato al inicio
    });
}

function iniciarCuentaRegresiva() {
    if (isCountingDown) return; // Evitar múltiples ejecuciones
    console.log("Iniciando protocolo de despliegue...");
    isCountingDown = true;
    juegoPausado = true;
    const overlay = domCache.countdownOverlay;
    if (!overlay) {
        console.error("ERROR: countdownOverlay no encontrado.");
        return;
    }
    overlay.style.display = "flex";
    let count = 3;
    overlay.innerText = count;
    
    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            overlay.innerText = count;
        } else if (count === 0) {
            overlay.innerText = "¡YA!";
        } else {
            clearInterval(interval);
            overlay.style.display = "none";
            isCountingDown = false;
            juegoPausado = false;
            // Iniciar spawn de enemigos del nivel
            jugador.invulnerable = 180; // Dar 3 segundos de invulnerabilidad al inicio (60 FPS * 3 segundos)
            enemiesToSpawn = 15 + (misionActivaIndex * 8);
        }
    }, 1000);
}

function updateGradualSpawn() {
    if (!juegoPausado && enemiesToSpawn > 0) {
        spawnTimer--;
        if (spawnTimer <= 0) {
            let ex, ey;
            do {
                ex = Math.random() * WORLD_WIDTH;
                ey = Math.random() * WORLD_HEIGHT;
            } while(!puedeCaminar(ex, ey));
            
            enemigos.push({
                x: ex, y: ey, w: 25, h: 25,
                vel: 1.8 + Math.random(), vida: 1,
                vx: Math.random()-0.5, vy: Math.random()-0.5,
                tipo: "patrulla"
            });
            enemiesToSpawn--;
            spawnTimer = 60; // Aparece uno cada segundo (60 frames)
        }
    }
}

function spawnEnemigos(cantidad, append = false) {
    const misionActual = misiones[misionActivaIndex];

    if (!append) {
        enemigos = [];
        proyectilesEnemigos = [];
        missionItems = [];
        jugador.missionInventory = [];
        misionProgreso = 0;

        // Generar items de misión según el nivel actual
        if (misionActual) {
            let tipoItem = "";
            let numItems = 0;
            let chars = "";

            if (misionActual.id === 1) { tipoItem = "simbolo"; numItems = 4; chars = "7ur6"; }
            else if (misionActual.id === 3) { tipoItem = "codigo"; numItems = 4; }
            else if (misionActual.id === 4) { tipoItem = "token"; numItems = 4; }
            else if (misionActual.id === 5) { tipoItem = "patch"; numItems = 1; }

            if (tipoItem) {
                for (let i = 0; i < numItems; i++) {
                    let rx, ry;
                    do {
                        rx = 300 + Math.random() * (WORLD_WIDTH - 600);
                        ry = 300 + Math.random() * (WORLD_HEIGHT - 600);
                    } while (!puedeCaminar(rx, ry));

                    missionItems.push({
                        x: rx, y: ry,
                        tipo: tipoItem,
                        char: chars ? chars[i] : null,
                        activo: true
                    });
                }
            }
        }

        items.forEach(it => it.activo = true);
        enemiesToSpawn = cantidad;

        // Spawn inicial inmediato de algunos enemigos para que el usuario 
        // vea las amenazas durante la cuenta regresiva.
        for (let i = 0; i < 5; i++) {
            let ex, ey;
            do {
                ex = 100 + Math.random() * (WORLD_WIDTH - 200);
                ey = 100 + Math.random() * (WORLD_HEIGHT - 200);
            } while(!puedeCaminar(ex, ey) || Math.hypot(ex - jugador.x, ey - jugador.y) < 300);
            
            enemigos.push({
                x: ex, y: ey, w: 25, h: 25,
                vel: 1.5 + Math.random(), vida: 1,
                vx: Math.random()-0.5, vy: Math.random()-0.5,
                tipo: "patrulla"
            });
        }
    } else {
        enemiesToSpawn += cantidad;
    }

    // NPCs de soporte
    npcs.push({ 
        x: 700, y: 250, w: 30, h: 45, 
        nombre: "Oficial", mensaje: "Cuidado con los ladrones amarillos, ¡roban tus puntos!", 
        color: "#38bdf8", vx: 0, vy: 0, vel: 0, patrolTimer: 999, style: 2, isNearPlayer: false,
        isShopkeeper: false, 
        charIndex: 0, lastCharTime: 0, lineas: []
    });

    // Spawn del BOSS en la posición de la misión
    if (misionActual && misionActual.boss) {
        enemigos.push({
            x: misionActual.x, y: misionActual.y,
            w: 60, h: 60,
            vel: 1.5 + (misionActivaIndex * 0.5),
            vida: misionActual.boss.vida,
            ultimoDisparo: 0,
            ultimoApagon: 0,
            modoAtaque: misionActual.boss.attackType || "FAN",
            tipo: "boss",
            nombre: misionActual.boss.nombre,
            color: misionActual.boss.color
        });
    }
}

// Configuración del Jugador
const jugador = {
    x: WORLD_WIDTH / 2, // Iniciar en el centro del mapa
    y: WORLD_HEIGHT / 2, 
    w: 30, 
    h: 30,
    color: "#dcdcdc", 
    vel: 5,
    direccion: "Down",
    vidas: 7,
    vidasMax: 7,
    invulnerable: 0,
    ultimoDaño: 0,
    shieldActive: 0,
    tieneEspada: false,
    espadaDamage: 1, // Daño de la espada
    tienePistola: false,
    pistolaObtenida: false, // Para controlar el aviso de la pistola
    pistolaDamage: 1, // Daño de la pistola
    bateria: 100,
    bateriaMax: 100,
    stamina: 100,
    staminaMax: 100,
    cooldowns: { e: 0, r: 0, q: 0 },
    dx: 0, dy: 0, // Seguimiento de velocidad para IA predictiva
    cooldownDisparo: 0,
    atacando: 0,
    inventory: [], // Inventario de consumibles (botiquines)
    missionInventory: [] // Inventario de objetos de misión (letras, tokens)
};

// Función para encontrar un sitio libre si aparecemos en zona negra
function buscarSitioSeguro() {
    if (!puedeCaminar(jugador.x, jugador.y)) {
        console.log("Jugador atrapado, buscando zona segura...");
        for (let i = 0; i < WORLD_WIDTH; i += 50) {
            for (let j = 0; j < WORLD_HEIGHT; j += 50) {
                if (puedeCaminar(i, j)) {
                    jugador.x = i;
                    jugador.y = j;
                    return;
                }
            }
        }
    }
}

window.addEventListener('load', () => {
    // El evento 'load' solo lo usamos para elementos visuales secundarios que pueden esperar
    const btnContinuar = document.getElementById("btn-continuar");
    if (domCache.btnContinuar && localStorage.getItem("cyberExplorer_SaveData")) {
        btnContinuar.classList.remove("hidden");
    }
    
    // Asegurar que el nombre del agente esté actualizado
    const navUser = document.getElementById("nav-user-name");
    if (navUser) navUser.innerText = (localStorage.getItem('username') || "Agente").toUpperCase();
});

const teclas = {};
window.onkeydown = (e) => { teclas[e.key] = true; };
window.onkeyup = (e) => { teclas[e.key] = false; };

// Evitar que el personaje siga caminando si la ventana pierde el foco
window.onblur = () => { 
    for (let k in teclas) teclas[k] = false; 
};

// --- SISTEMA DE PERSISTENCIA ---
window.guardarProgreso = function() {
    const datos = {
        score,
        misionActivaIndex,
        color: jugador.color,
        dimension: dimensionActual,
        posX: jugador.x,
        posY: jugador.y
    };
    localStorage.setItem("cyberExplorer_SaveData", JSON.stringify(datos));
};

window.continuarPartida = function() {
    const save = localStorage.getItem("cyberExplorer_SaveData");
    if (save) {
        const datos = JSON.parse(save);
        score = datos.score;
        misionActivaIndex = datos.misionActivaIndex;
        dimensionActual = datos.dimension;
        jugador.x = datos.posX;
        jugador.y = datos.posY;
        
        if (domCache.scoreDisplay) domCache.scoreDisplay.innerText = score;
        if (domCache.levelDisplay) domCache.levelDisplay.innerText = dimensionActual;
        if (domCache.fragmentsCount) domCache.fragmentsCount.innerText = `${fragmentosEncontrados} / ${secretos.length}`;
        
        seleccionarSkin(null, datos.color);
    } else if (domCache.skinSelector) { // Si no hay partida guardada, mostrar selector
        domCache.skinSelector.classList.remove("hidden");
    }
};

window.seleccionarSkin = function(buttonElement, color) {
    // Si buttonElement no se proporciona (ej. al continuar una partida),
    // buscamos el botón correspondiente al color.
    if (!buttonElement) {
        if (domCache.skinOptionsContainer) {
            buttonElement = Array.from(domCache.skinOptionsContainer.children).find(btn => btn.dataset.color === color);
        }
    }

    // Eliminar la clase 'selected' de todos los botones de skin
    if (domCache.skinOptionsContainer) {
        Array.from(domCache.skinOptionsContainer.children).forEach(btn => {
            btn.classList.remove("selected");
        });
    }

    // Añadir la clase 'selected' al botón clickeado o encontrado
    if (buttonElement && buttonElement.classList) buttonElement.classList.add("selected");

    jugador.color = color;
    estadoJuego = "JUGANDO";
    // juegoPausado se gestionará por cargarNivel y luego por mostrarManual/iniciarCuentaRegresiva
    if (domCache.skinSelector) domCache.skinSelector.classList.add("hidden");

    const username = window.CURRENT_USER || "EXPLORADOR"; // Use domCache.userDisplay
    if (domCache.userDisplay) domCache.userDisplay.innerText = "AGENTE: " + username.toUpperCase();
    
    guardarProgreso();
    
    // Cargar el nivel y luego manejar el inicio del juego (manual o cuenta regresiva)
    cargarNivel(dimensionActual, () => { // Se pasa un callback para ejecutar después de que el nivel cargue
        buscarSitioSeguro();
        
        // Mostrar manual automáticamente la primera vez que inicia el juego
        if (misionActivaIndex === 0 && score === 0) {
            window.mostrarManual(); // El botón de cerrar del manual llamará a iniciarCuentaRegresiva()
        } else {
            iniciarCuentaRegresiva(); // Iniciar la cuenta regresiva directamente si no es la primera partida
        }

        // Iniciar la música de fondo al comenzar la partida
        if (!musicEnabled) {
            musicEnabled = true;
            playMelodyLoop();
        } else if (audioCtx && audioCtx.state === 'suspended') { // Reanudar música si estaba pausada por el navegador
            audioCtx.resume();
        }

        console.log("Skin seleccionado, iniciando bucle de dibujo y juego");
        if (!loopIniciado) {
            loopIniciado = true;
            dibujar(); // Iniciar el bucle de dibujo solo una vez, después de la configuración inicial
        }

        // Iniciar actualización del HUD de forma eficiente (fuera del loop de 60fps)
        if (!window.hudUpdateInterval) window.hudUpdateInterval = setInterval(actualizarHUD, 100);
    }); // Fin del callback de cargarNivel
};

// Función de detección de colisión
function puedeCaminar(x, y, width = jugador.w, height = jugador.h) {
    // Límites del mundo
    if (x < 0 || x + width > WORLD_WIDTH || y < 0 || y + height > WORLD_HEIGHT) return false;
    
    // Colisión con decoraciones sólidas
    for (const d of decoraciones) {
        if (d.dimension && d.dimension !== dimensionActual) continue;
        
        // Algunos tipos son sólidos
        if (["servidor", "casa", "policia_station", "arbol", "museo", "banco", "submarino", "skyscraper", "vending_machine"].includes(d.tipo)) {
            const dx = Math.abs(x - d.x);
            const dy = Math.abs(y - d.y);
            // AABB collision check (simplified for decorations)
            const decorWidth = 40; // Ancho aproximado de la mayoría de las decoraciones
            const decorHeight = 70; // Alto aproximado de la mayoría de las decoraciones
            if (x < d.x + decorWidth && x + width > d.x &&
                y < d.y + decorHeight && y + height > d.y) return false;
        }
    }
    return true;
}

function verificarColisionGlobal(nx, ny) {
    // Usamos la función genérica puedeCaminar con las dimensiones del jugador
    return puedeCaminar(nx, ny, jugador.w, jugador.h);
}

function actualizarEnemigos() {
    if (juegoPausado || estadoJuego !== "JUGANDO") return;

    if (screenShake > 0) screenShake--;
    if (consolaActiva) return; // Pausar enemigos si estamos hackeando

    // Colisión de Proyectiles del Jugador con Enemigos
    proyectilesJugador = proyectilesJugador.filter((p) => {
        let hit = false;
        for (let i = enemigos.length - 1; i >= 0; i--) {
            let e = enemigos[i];
            const dist = Math.hypot(p.x - e.x, p.y - e.y);
            if (dist < 30) {
                e.vida -= p.damage;
                crearParticula(e.x, e.y, "#a52a2a");
                hit = true;
                let pointsGained = 0;
                if (e.vida <= 0) { 
                    score += e.tipo === "boss" ? 2000 : 150;
                    if (Math.random() < 0.2) {
                        items.push({ x: e.x, y: e.y, tipo: "health_pack", activo: true });
                    }
                    if (Math.random() < 0.6) { // 60% de probabilidad de soltar un fragmento de código
                        items.push({ x: e.x, y: e.y, tipo: "code_fragment", activo: true });
                    }
                    enemigos.splice(i, 1);
                    pointsGained = e.tipo === "boss" ? 2000 : 150;
                    crearFloatingText(e.x, e.y - 20, `+${pointsGained} PTS`, "#facc15");
                    play8BitSound('collect'); // Sonido al derrotar
                }
            }
        }
        return !hit;
    });

    for (let i = enemigos.length - 1; i >= 0; i--) {
        let e = enemigos[i];
        const dist = Math.hypot(jugador.x - e.x, jugador.y - e.y);
        
        // INTELIGENCIA COLECTIVA: Si un enemigo ve al jugador, alerta a los cercanos
        if (dist < 400) { // Radio de detección aumentado para mayor intensidad
            if (!e.alertado) e.alertado = true;
        } else if (dist > 600) {
            e.alertado = false; // El enemigo pierde el interés si te alejas lo suficiente
        }

        // COMPORTAMIENTO LADRON
        if (e.tipo === "ladron") {
            if (!e.hasStolen) {
                let angle = Math.atan2(jugador.y - e.y, jugador.x - e.x);
                e.x += Math.cos(angle) * e.vel;
                e.y += Math.sin(angle) * e.vel;
                if (dist < 40) {
                    score = Math.max(0, score - 250);
                    e.hasStolen = true;
                    crearParticula(jugador.x, jugador.y, "#ff0000");
                }
            } else {
                // Escapar después de robar
                let angle = Math.atan2(e.y - jugador.y, e.x - jugador.x);
                e.x += Math.cos(angle) * e.vel;
                e.y += Math.sin(angle) * e.vel;
            }
        } else if (e.alertado) {
                for (let j = 0; j < enemigos.length; j++) {
                    let otro = enemigos[j];
                    if (Math.hypot(e.x - otro.x, e.y - otro.y) < 150) { otro.alertado = true; } // Cadena de alerta aumentada
                }
            }

        // COMPORTAMIENTO SEGÚN ESTADO
        if (e.alertado && e.tipo !== "ladron") {
            // Persecución: Se mueve hacia el jugador
            let dx = jugador.x - e.x;
            let dy = jugador.y - e.y;
            const angle = Math.atan2(dy, dx);
            
            let moveX = Math.cos(angle) * e.vel;
            let moveY = Math.sin(angle) * e.vel;

            // IA DE DESLIZAMIENTO: Intentar esquivar obstáculos si el camino directo está bloqueado
            if (puedeCaminar(e.x + moveX, e.y + moveY)) {
                e.x += moveX;
                e.y += moveY;
            } else if (puedeCaminar(e.x + moveX, e.y)) {
                e.x += moveX; // Deslizar en X
            } else if (puedeCaminar(e.x, e.y + moveY)) {
                e.y += moveY; // Deslizar en Y
            }

            // Asegurar que no se salgan del mapa
            e.x = Math.max(0, Math.min(e.x, WORLD_WIDTH - e.w));
            e.y = Math.max(0, Math.min(e.y, WORLD_HEIGHT - e.h));

            // INTELIGENCIA DEL JEFE: Patrones de ataque variables
            if (e.tipo === "boss") {
                const ahora = Date.now();
                if (ahora - (e.ultimoDisparo || 0) > 2000) { // Dispara cada 2 segundos
                    
                    if (e.modoAtaque === "plasma") { // Ataque de plasma (ráfaga)
                        // Ráfaga en abanico
                        const anguloBase = Math.atan2(jugador.y - e.y, jugador.x - e.x);
                        for (let i = -1; i <= 1; i++) {
                            const angulo = anguloBase + (i * 0.3);
                            proyectilesEnemigos.push({
                                x: e.x + e.w / 2, y: e.y + e.h / 2,
                                vx: Math.cos(angulo) * 4, vy: Math.sin(angulo) * 4,
                                color: e.color || "#ff0000"
                            });
                        }
                        e.modoAtaque = "ray"; // Siguiente ataque
                    } else if (e.modoAtaque === "ray") { // Ataque de rayo (predictivo)
                        // DISPARO PREDICTIVO: Apuntar a donde el jugador estará
                        const t = 30; // Tiempo estimado de viaje del proyectil
                        const predX = jugador.x + (jugador.dx * jugador.vel * t);
                        const predY = jugador.y + (jugador.dy * jugador.vel * t);
                        const anguloPred = Math.atan2(predY - e.y, predX - e.x);
                        
                        proyectilesEnemigos.push({
                            x: e.x + e.w / 2, y: e.y + e.h / 2,
                            vx: Math.cos(anguloPred) * 8, vy: Math.sin(anguloPred) * 8, // Más rápido
                            color: e.color || "#ff0000",
                            tipo: "ray" // Para dibujar diferente
                        });
                        e.modoAtaque = "mine"; // Siguiente ataque
                    } else if (e.modoAtaque === "mine") { // Ataque de mina (deja objetos explosivos)
                        proyectilesEnemigos.push({
                            x: e.x + e.w / 2, y: e.y + e.h / 2,
                            vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, // Se dispersan un poco
                            color: e.color || "#ff0000",
                            tipo: "mine",
                            vida: 180 // Dura 3 segundos
                        });
                        e.modoAtaque = "plasma"; // Siguiente ataque
                    } else { // Fallback a predictivo si no hay tipo definido
                        // DISPARO PREDICTIVO: Apuntar a donde el jugador estará
                        const t = 30; // Tiempo estimado de viaje del proyectil
                        const predX = jugador.x + (jugador.dx * jugador.vel * t);
                        const predY = jugador.y + (jugador.dy * jugador.vel * t);
                        const anguloPred = Math.atan2(predY - e.y, predX - e.x);
                        
                        proyectilesEnemigos.push({
                            x: e.x + e.w / 2, y: e.y + e.h / 2,
                            vx: Math.cos(anguloPred) * 6, vy: Math.sin(anguloPred) * 6,
                            color: e.color || "#ff0000"
                        });
                        e.modoAtaque = "plasma";
                    }
                    e.ultimoDisparo = ahora;
                }

                // HABILIDAD FINAL BOSS: Apagón del sistema (Nivel 5)
                if (misionActivaIndex === 4 && ahora - (e.ultimoApagon || 0) > 15000) {
                    apagonLuz = 400; // Duración del apagón (~6.5 seg)
                    e.ultimoApagon = ahora;
                }
            }
        } else {
            // Patrulla Erratica (IA Base)
            let nX = e.x + e.vx * e.vel;
            let nY = e.y + e.vy * e.vel;

            if (puedeCaminar(nX, nY)) {
                e.x = nX;
                e.y = nY;
            } else {
                // Cambiar dirección aleatoria al chocar
                e.vx = (Math.random() - 0.5) * 2;
                e.vy = (Math.random() - 0.5) * 2;
            }

            // Asegurar que no se salgan del mapa
            e.x = Math.max(0, Math.min(e.x, WORLD_WIDTH - e.w));
            e.y = Math.max(0, Math.min(e.y, WORLD_HEIGHT - e.h));
        }

        // COLISIÓN CON JUGADOR (Daño/Penalización)
        const colSize = e.tipo === "boss" ? 60 : 40;
        if (dist < colSize) {
            if (jugador.atacando > 0) { // Si el jugador está atacando con la espada
                e.vida--;
                screenShake = 10; // ¡KABOOM!
                crearParticula(e.x, e.y, e.tipo === "boss" ? "#ff0000" : "#22b14c");
                crearFloatingText(e.x, e.y - 20, `+${e.tipo === "boss" ? 2000 : 100} PTS`, "#facc15");
                jugador.atacando = 0; // Reset ataque tras impacto

                if (e.vida <= 0) {
                    score += e.tipo === "boss" ? 2000 : 100;
                    if (e.tipo === "boss") {
                        crearFloatingText(e.x, e.y - 20, `+${2000} PTS`, "#facc15");
                        misionObjetivoRealizado = true;
                        misionProgreso++; // El boss cuenta como objetivo cumplido
                    }
                    // No agregar secretos aquí, se generan al inicio del nivel
                    // secretos.push({ x: e.x, y: e.y, activo: true });
                    // 20% de probabilidad de soltar una cápsula de reparación
                    if (Math.random() < 0.2) {
                        items.push({ x: e.x, y: e.y, tipo: "health_pack", activo: true });
                    }
                    enemigos.splice(i, 1);
                    continue;
                }
            } else if (jugador.invulnerable <= 0) { // Si el jugador no está atacando y no es invulnerable
                jugador.vidas--;
                jugador.invulnerable = 60; // ~1 seg invulnerable (más difícil)
                jugador.ultimoDaño = Date.now();
                damageFlash = 20;
                screenShake = 15; // Use domCache.quizModal
                crearParticula(jugador.x, jugador.y, "#ff0000");
                if (jugador.vidas <= 0) {
                    mostrarGameOver();
                } else {
                    // Activar pregunta Bonus al recibir daño
                    if (!juegoPausado) {
                        // Solo una pregunta al azar de tipo bonus
                        const bonusPreg = bancoPreguntas.filter(p => p.tipo === 'bonus').sort(() => 0.5 - Math.random())[0];
                        abrirQuiz(bonusPreg, true);
                    }
                }
            }
        }
    }

    // Respawn suave: si quedan pocos enemigos, generar uno nuevo para que el mapa no quede vacío
    if (enemigos.length < 5 && Math.random() > 0.99) {
        let ex, ey;
        do {
            ex = 300 + Math.random() * (WORLD_WIDTH - 600);
            ey = 300 + Math.random() * (WORLD_HEIGHT - 600);
        } while(collisionData && !puedeCaminar(ex, ey));

        enemigos.push({
            x: ex, y: ey,
            w: 25, h: 25,
            vel: 1.2 + Math.random() * 1.5,
            vida: 1,
            vx: Math.random() > 0.5 ? 1 : -1,
            vy: Math.random() > 0.5 ? 1 : -1,
            tipo: Math.random() > 0.6 ? "seguidor" : "patrulla"
        });
    }
}

function dibujarEnemigos() {
    enemigos.forEach(e => {
        const isMoving = Math.abs(e.vx) > 0.1 || Math.abs(e.vy) > 0.1;
        const walkCycle = isMoving ? Math.sin(Date.now() * 0.01) * 5 : 0;
        
        ctx.save();
        ctx.translate(e.x, e.y);
        
        // Sombra sutil
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath(); ctx.ellipse(12, 32, 10, 4, 0, 0, Math.PI*2); ctx.fill();

        const mainColor = e.tipo === "boss" ? "#ffffff" : (e.tipo === "ladron" ? "#a855f7" : "#facc15");
        
        // Piernas
        ctx.fillStyle = "#111";
        ctx.fillRect(5, 22, 6, 10 + walkCycle); 
        ctx.fillRect(14, 22, 6, 10 - walkCycle); 

        // Torso Humanoide (Hombros redondeados)
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(2, 8, 21, 16, 5); else ctx.rect(2, 8, 21, 16);
        ctx.fill();

        // Brazos
        ctx.fillRect(-1, 10 + walkCycle/2, 4, 10);
        ctx.fillRect(22, 10 - walkCycle/2, 4, 10);

        // Cabeza/Casco
        ctx.fillStyle = "#000";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(6, 0, 13, 11, 4); else ctx.rect(6, 0, 13, 11);
        ctx.fill();

        // Visor/Ojos
        ctx.fillStyle = e.alertado ? "#ef4444" : "#000";
        ctx.fillRect(8, 4, 3, 2); ctx.fillRect(14, 4, 3, 2);

        if(e.tipo === "boss") {
            // Aura para el jefe
            ctx.strokeStyle = e.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(-5, -5, e.w + 10, e.h + 10);
            
            // Corona/Antenas de virus
            ctx.fillStyle = e.color;
            ctx.fillRect(5, -5, 2, 5);
            ctx.fillRect(18, -5, 2, 5);

            // Nombre del Boss flotando
            ctx.fillStyle = "#fff"; ctx.font = "bold 10px Arial";
            ctx.fillText(e.nombre, 0, -10);
        }
        // Indicador de Alerta (Signo de exclamación estilo retro)
        if (e.alertado && e.tipo !== "boss") { // Solo para virus normales
            ctx.fillStyle = "#ffb000";
            ctx.font = "bold 16px Arial";
            ctx.fillText("!", 10, -5);
        }

        // Detalles visuales para jefes
        if (e.tipo === "boss") {
            ctx.fillStyle = e.color;
            if (e.modoAtaque === "plasma") {
                ctx.beginPath();
                ctx.arc(0, 0, e.w/3, 0, Math.PI * 2);
                ctx.fill();
            } else if (e.modoAtaque === "ray") {
                ctx.fillRect(-e.w/2, -e.h/4, e.w, e.h/2);
            } else if (e.modoAtaque === "mine") {
                ctx.beginPath();
                ctx.arc(0, 0, e.w/2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    });
}

function actualizarProyectilesEnemigos() {
    if (juegoPausado || estadoJuego !== "JUGANDO") return;

    proyectilesEnemigos = proyectilesEnemigos.filter(p => {
        p.x += p.vx;
        p.y += p.vy;

        // Eliminar si sale de los límites del mundo
        if (p.x < 0 || p.x > WORLD_WIDTH || p.y < 0 || p.y > WORLD_HEIGHT) return false;

        // Colisión con el jugador
        if (p.tipo === "mine") { // Las minas no desaparecen al tocar al jugador, explotan
            if (p.vida <= 0) { // La mina explota por tiempo
                crearParticula(p.x, p.y, p.color); // Efecto de explosión
                const dist = Math.hypot(jugador.x + jugador.w / 2 - p.x, jugador.y + jugador.h / 2 - p.y);
                if (dist < 40 && jugador.invulnerable <= 0) { // Radio de explosión
                    jugador.vidas--;
                    jugador.invulnerable = 90;
                    damageFlash = 25; // Use domCache.gameOverScreen
                    screenShake = 20;
                    if (jugador.vidas <= 0) { mostrarGameOver(); } // Call mostrarGameOver
                }
                return false;
            }
            p.vida--;
        }
        const dist = Math.hypot(jugador.x + jugador.w / 2 - p.x, jugador.y + jugador.h / 2 - p.y);
        if (dist < 20 && jugador.invulnerable <= 0) {
            jugador.vidas--;
            jugador.invulnerable = 90; // ~1.5 seg invulnerable
            damageFlash = 20;
            screenShake = 15;
            crearParticula(jugador.x, jugador.y, "#ff0000");
            if (jugador.vidas <= 0) {
                mostrarGameOver();
            }
            return false; // El proyectil desaparece al impactar
        }
        return true;
    });
}

function actualizarProyectilesJugador() {
    proyectilesJugador = proyectilesJugador.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        // Colisión con paredes o límites
        if (!puedeCaminar(p.x, p.y) || p.x < 0 || p.x > WORLD_WIDTH) return false;
        p.vida--;
        return p.vida > 0;
    });
}

function dibujarProyectilesJugador() {
    proyectilesJugador.forEach(p => {
        // No restamos camX/camY aquí porque ya estamos dentro del contexto traducido en dibujar()
        ctx.save();
        ctx.shadowBlur = 5;
        ctx.shadowColor = "#ffb000";
        ctx.fillStyle = "#fff";
        ctx.fillRect(p.x, p.y, 4, 4);
        ctx.restore();
    });
}

function dibujarProyectilesEnemigos() {
    proyectilesEnemigos.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        if (p.tipo === "ray") {
            ctx.fillStyle = p.color;
            ctx.fillRect(-8, -2, 16, 4); // Rayo delgado y largo
        } else if (p.tipo === "mine") {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2); // Mina redonda
            ctx.fill();
        } else { // Plasma (por defecto)
            ctx.fillStyle = p.color;
            ctx.fillRect(-4, -4, 8, 8); // Proyectil cuadrado estilo pixel
        }
        ctx.restore();
    });
}

function useInventoryItem() {
    if (juegoPausado || estadoJuego !== "JUGANDO") return;

    const healthPackIndex = jugador.inventory.findIndex(item => item.type === 'health_pack');
    if (healthPackIndex !== -1) {
        if (jugador.vidas < jugador.vidasMax) { // Solo usar si no tiene la vida completa
            jugador.vidas = Math.min(jugador.vidas + 1, jugador.vidasMax); // Restaura 1 vida
            jugador.inventory.splice(healthPackIndex, 1); // Elimina el ítem del inventario
            crearParticula(jugador.x + 15, jugador.y + 15, "#00ff00"); // Partícula verde para curación
            // Actualizar HUD de vidas inmediatamente
            const vh = domCache.livesDisplay;
            if (vh) {
                vh.innerHTML = "";
                for(let i=0; i<jugador.vidasMax; i++) { // Iterate up to jugador.vidasMax
                    const img = document.createElement("img");
                    img.src = i < jugador.vidas ? "assets/heart_full.png" : "assets/heart_empty.png";
                    img.className = "heart";
                    vh.appendChild(img);
                }
            }
        }
    }
}

/**
 * Updates the state of all NPCs (movement, interaction detection).
 */
function actualizarNPCs() {
    if (juegoPausado || estadoJuego !== "JUGANDO") return;

    npcs.forEach(npc => {
        // Movimiento de patrulla errática
        npc.patrolTimer--;
        if (npc.patrolTimer <= 0) {
            npc.vx = (Math.random() - 0.5) * 2;
            npc.vy = (Math.random() - 0.5) * 2;
            npc.patrolTimer = 120 + Math.random() * 180; // Cambiar dirección cada 2-5 segundos
        }

        let nX = npc.x + npc.vx * npc.vel;
        let nY = npc.y + npc.vy * npc.vel;

        // Colisión con límites del mundo
        nX = Math.max(0, Math.min(nX, WORLD_WIDTH - npc.w));
        nY = Math.max(0, Math.min(nY, WORLD_HEIGHT - npc.h));

        // Colisión con decoraciones y proximidad al jugador
        const distToPlayer = Math.hypot(nX + npc.w/2 - (jugador.x + jugador.w/2), nY + npc.h/2 - (jugador.y + jugador.h/2));
        
        if (puedeCaminar(nX, nY, npc.w, npc.h) && distToPlayer > 50) {
            npc.x = nX;
            npc.y = nY;
        } else {
            // Si choca, cambia de dirección inmediatamente
            npc.vx = (Math.random() - 0.5) * 2;
            npc.vy = (Math.random() - 0.5) * 2;
            npc.patrolTimer = 60; // Intenta cambiar de dirección más rápido
        }

        // Interacción con el jugador
        const dist = Math.hypot(jugador.x + jugador.w / 2 - (npc.x + npc.w / 2), jugador.y + jugador.h / 2 - (npc.y + npc.h / 2));
        const wasNear = npc.isNearPlayer;
        if (dist < 80) { // Si el jugador está cerca
            npc.isNearPlayer = true;
            if (domCache.speechControls) domCache.speechControls.classList.remove("hidden");
            
            // NUEVO: Lógica de Tienda
            if (npc.isShopkeeper && teclas['e'] && !consolaActiva) {
                juegoPausado = true;
                if (domCache.shopModal) {
                    domCache.shopModal.classList.remove("hidden");
                    speakText("Bienvenido agente. ¿Necesitas suministros para tu misión?");
                }
            }
            
            if (!wasNear && npc.mensaje && 'speechSynthesis' in window) {
                speakText(npc.mensaje);
            }
        } else {
            npc.isNearPlayer = false;
        }
    });
}

/**
 * Draws all NPCs on the canvas.
 */
function dibujarNPCs() {
    npcs.forEach(npc => {
        const isMoving = Math.abs(npc.vx) > 0.1 || Math.abs(npc.vy) > 0.1;
        const walkCycle = isMoving ? Math.sin(Date.now() * 0.01) * 3 : 0; // Lighter bob for NPCs

        ctx.save();
        ctx.translate(npc.x, npc.y);

        // Sombra
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath(); ctx.ellipse(npc.w / 2, npc.h, npc.w / 3, npc.h / 8, 0, 0, Math.PI * 2); ctx.fill();

        // Piernas
        ctx.fillStyle = "#333";
        ctx.fillRect(npc.w * 0.2, npc.h * 0.6 + walkCycle, npc.w * 0.2, npc.h * 0.4);
        ctx.fillRect(npc.w * 0.6, npc.h * 0.6 - walkCycle, npc.w * 0.2, npc.h * 0.4);

        // Cuerpo
        ctx.fillStyle = npc.color;
        ctx.fillRect(0, npc.h * 0.2, npc.w, npc.h * 0.5);

        // Cabeza
        ctx.fillStyle = "#222";
        ctx.fillRect(npc.w * 0.1, 0, npc.w * 0.8, npc.h * 0.3);

        // Estilo de cabello/sombrero
        if (npc.style === 1) { // Pinchos
            ctx.fillStyle = "#444";
            ctx.beginPath();
            ctx.moveTo(npc.w * 0.2, 0);
            ctx.lineTo(npc.w * 0.3, -5);
            ctx.lineTo(npc.w * 0.4, 0);
            ctx.lineTo(npc.w * 0.5, -5);
            ctx.lineTo(npc.w * 0.6, 0);
            ctx.lineTo(npc.w * 0.7, -5);
            ctx.lineTo(npc.w * 0.8, 0);
            ctx.fill();
        } else if (npc.style === 2) { // Gorra
            ctx.fillStyle = "#555";
            ctx.fillRect(npc.w * 0.05, -5, npc.w * 0.9, 10);
            ctx.fillRect(npc.w * 0.05, -5, npc.w * 0.2, 15); // Visor de la gorra
        } else if (npc.style === 3) { // Melena
            ctx.fillStyle = "#666";
            ctx.beginPath();
            ctx.arc(npc.w / 2, npc.h * 0.1, npc.w * 0.45, 0, Math.PI, true); // Semi-círculo para el cabello
            ctx.fill();
        }

        // Ojos/Visor (simple)
        ctx.fillStyle = "#fff";
        ctx.fillRect(npc.w * 0.3, npc.h * 0.1, npc.w * 0.1, npc.h * 0.05);
        ctx.fillRect(npc.w * 0.6, npc.h * 0.1, npc.w * 0.1, npc.h * 0.05);

        // Mensaje del NPC si el jugador está cerca
        if (npc.isNearPlayer && npc.mensaje) {
             ctx.save();
             ctx.setTransform(1, 0, 0, 1, 0, 0); // Dibujar en espacio de pantalla
             const screenX = npc.x - camX + npc.w / 2;
             const screenY = npc.y - camY - 20;
 
             ctx.font = "bold 12px 'Courier New'";
             ctx.textAlign = "center";
             ctx.textBaseline = "top";
 
             const maxWidth = 180;
             const lineHeight = 16;
             const words = npc.mensaje.split(' ');
             let line = '';
             let lines = [];
 
             for (let n = 0; n < words.length; n++) {
                 let testLine = line + words[n] + ' ';
                 if (ctx.measureText(testLine).width > maxWidth && n > 0) {
                     lines.push(line);
                     line = words[n] + ' ';
                 } else {
                     line = testLine;
                 }
             }
             lines.push(line);
 
             let maxW = 0;
             lines.forEach(l => {
                 const w = ctx.measureText(l).width;
                 if (w > maxW) maxW = w;
             });
 
             const padding = 8;
             const boxWidth = maxW + padding * 2;
             const boxHeight = lines.length * lineHeight + padding * 2;
 
             ctx.fillStyle = "rgba(0,0,0,0.85)";
             ctx.strokeStyle = npc.color;
             ctx.lineWidth = 2;
             ctx.beginPath();
             if (ctx.roundRect) ctx.roundRect(screenX - boxWidth / 2, screenY - boxHeight, boxWidth, boxHeight, 5);
             else ctx.rect(screenX - boxWidth / 2, screenY - boxHeight, boxWidth, boxHeight);
             ctx.fill(); ctx.stroke();
 
             ctx.fillStyle = "white";
             lines.forEach((l, i) => {
                 ctx.fillText(l.trim(), screenX, screenY - boxHeight + padding + (i * lineHeight));
             });
             ctx.restore();
        }

        ctx.restore();
    });
}

// NUEVO: Función para comprar items
window.comprarItem = function(itemType, costo) {
    if (codeFragments >= costo) {
        codeFragments -= costo;
        if (itemType === 'health_pack') {
            jugador.inventory.push({ type: 'health_pack', name: 'Botiquín' });
            crearFloatingText(jugador.x, jugador.y, "+1 BOTIQUÍN", "#4ade80");
        } else if (itemType === 'shield') {
            jugador.shieldActive = 600; // 10 segundos de escudo
            crearFloatingText(jugador.x, jugador.y, "ESCUDO ACTIVADO", "#38bdf8");
        }
        play8BitSound('success');
        if (domCache.codeFragmentsDisplay) domCache.codeFragmentsDisplay.innerText = codeFragments;
    } else {
        speakText("No tienes suficientes fragmentos de código.");
        crearFloatingText(jugador.x, jugador.y, "FALTAN RECURSOS", "#ef4444");
    }
};

/**
 * Updates the game state (Physics, Input, Logic)
 * Separated from rendering for better performance and clarity.
 */
function updateGame() {
    if (juegoPausado || estadoJuego !== "JUGANDO") return;

    updateGradualSpawn();
    
    let dx = 0;
    let dy = 0;

    if (teclas["ArrowUp"] || teclas["w"]) { dy = -1; jugador.direccion = "Up"; }
    if (teclas["ArrowDown"] || teclas["s"]) { dy = 1; jugador.direccion = "Down"; }
    if (teclas["ArrowLeft"] || teclas["a"]) { dx = -1; jugador.direccion = "Left"; }
    if (teclas["ArrowRight"] || teclas["d"]) { dx = 1; jugador.direccion = "Right"; }

    if (jugador.invulnerable > 0) jugador.invulnerable--;
    if (jugador.shieldActive > 0) jugador.shieldActive--;
    if (jugador.atacando > 0) jugador.atacando--;
    if (apagonLuz > 0) apagonLuz--;

    if (Date.now() - jugador.ultimoDaño > 10000 && jugador.vidas < jugador.vidasMax && Date.now() % 600 === 0) {
        jugador.vidas++;
    }

    for (let k in jugador.cooldowns) if (jugador.cooldowns[k] > 0) jugador.cooldowns[k]--;

    let currentVel = jugador.vel;
    if (teclas["Shift"] && jugador.stamina > 0) {
        currentVel = jugador.vel * 1.6;
        jugador.stamina -= 0.8;
    } else if (jugador.stamina < jugador.staminaMax) {
        jugador.stamina += 0.3;
    }

    if (teclas["r"] && jugador.cooldowns.r <= 0 && jugador.bateria >= 40) {
        jugador.shieldActive = 180;
        jugador.bateria -= 40;
        jugador.cooldowns.r = 600; // Use domCache.cooldownR
        play8BitSound('success');
    }

    if (teclas[" "] && jugador.tieneEspada && jugador.atacando <= 0) {
        jugador.atacando = 15;
        crearParticula(jugador.x + 15, jugador.y + 15, "#22b14c");
    }

    if (teclas["x"] && jugador.tienePistola && jugador.cooldownDisparo <= 0 && jugador.bateria >= 20) {
        if (dispararPistola()) {
            jugador.bateria -= 20;
            jugador.cooldownDisparo = 20; // Use domCache.cooldownE
            screenShake = 5;
        }
    }
    if (jugador.cooldownDisparo > 0) jugador.cooldownDisparo--;
    if (jugador.bateria < jugador.bateriaMax) jugador.bateria += 0.15;

    if (dx !== 0 && dy !== 0) {
        dx *= Math.SQRT1_2;
        dy *= Math.SQRT1_2;
    }
    
    jugador.dx = dx;
    jugador.dy = dy;

    let nX = jugador.x + dx * currentVel;
    let nY = jugador.y + dy * currentVel;

    nX = Math.max(0, Math.min(nX, WORLD_WIDTH - jugador.w));
    nY = Math.max(0, Math.min(nY, WORLD_HEIGHT - jugador.h));

    if (verificarColisionGlobal(nX, nY)) {
        jugador.x = nX;
        jugador.y = nY;
    }

    if (Date.now() % 60 === 0) syncPosition();

    actualizarEnemigos();
    actualizarNPCs(); // Call the new NPC update function
    actualizarProyectilesJugador();
    actualizarProyectilesEnemigos();

    // Generate Portal Swirl Particles if active
    if (portalSwirlActive && Date.now() % 5 === 0) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 20;
        particulas.push({
            x: portalSwirlX + Math.cos(angle) * dist,
            y: portalSwirlY + Math.sin(angle) * dist,
            vx: -Math.cos(angle) * 2,
            vy: -Math.sin(angle) * 2,
            life: 0.8,
            color: mapas[dimensionActual]?.accent || "#facc15",
            size: 2,
            type: 'portal_swirl'
        });
    }
}

function dibujar() {
    requestAnimationFrame(dibujar);
    
    if (!ctx || !canvas) return;
    if (estadoJuego !== "JUGANDO" && estadoJuego !== "SELECCION") return;

    updateGame();

    const dx = jugador.dx;
    const dy = jugador.dy;
    const mision = misiones[misionActivaIndex];

    const assets = mapas[dimensionActual] || mapas["Archivo"];
    const colorBase = assets.accent;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = assets.ambient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. ACTUALIZAR CÁMARA (Después del movimiento para evitar jitter)
    camX = Math.max(0, Math.min(jugador.x - canvas.width / 2, WORLD_WIDTH - canvas.width));
    camY = Math.max(0, Math.min(jugador.y - canvas.height / 2, WORLD_HEIGHT - canvas.height));
    
    // --- RENDERIZADO (DIBUJO) ---
    ctx.save();
    if (screenShake > 0) {
        ctx.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake);
    }
    ctx.translate(-camX, -camY);

    // Actualizar y dibujar Partículas
    // Dibujar y actualizar textos flotantes
    floatingTexts = floatingTexts.filter(ft => {
        ft.y += ft.vy;
        ft.life--;
        ctx.globalAlpha = ft.life / 60; // Fade out over 60 frames
        ctx.fillStyle = ft.color;
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
        return ft.life > 0;
    });
    ctx.globalAlpha = 1.0; // Reset alpha

    particulas = particulas.filter(p => {
        p.x += p.vx; p.y += p.vy; 
        if (p.size) { // Lógica para confeti (con gravedad y rotación)
            p.vy += 0.22; 
            p.rotate += p.vRotate;
            p.life -= 0.01;
        } else {
            p.life -= 0.03;
        }

        if (p.life > 0) {
            ctx.globalAlpha = Math.min(p.life, 1.0);
            ctx.fillStyle = p.color;
            if (p.type === 'portal_swirl') { // Dibujar partículas de remolino
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.size) { // Confeti
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotate);
                ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
                ctx.restore();
            } else {
                ctx.fillRect(p.x, p.y, 2, 2);
            }
            return true;
        }
        return false;
    });
    ctx.globalAlpha = 1.0;

    // Efecto de rastro del jugador
    // Asegurarse de que las partículas de rastro se creen en las coordenadas del mundo
    // y se dibujen correctamente con la cámara.
    // Las partículas ya se actualizan y dibujan dentro del ctx.save/restore,
    // así que solo necesitamos asegurarnos de que se creen con las coordenadas correctas.
    if ((dx !== 0 || dy !== 0) && Math.random() > 0.8) { 
        crearParticula(jugador.x + 15, jugador.y + 30, "#444"); // Efecto de polvo/rastro al caminar
    }

    // Dibujar fondo
    let grd = ctx.createRadialGradient(
        jugador.x + 15, jugador.y + 15, 50, 
        WORLD_WIDTH/2, WORLD_HEIGHT/2, WORLD_WIDTH
    );
    grd.addColorStop(0, assets.ambient);
    grd.addColorStop(1, "#000");
    
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Polvo Ambiental (Ciber-partículas)
    ctx.fillStyle = "rgba(250, 204, 21, 0.05)";
    ctx.fillStyle = "rgba(250, 204, 21, 0.05)"; // Color de acento para el polvo ambiental
    for(let i=0; i<10; i++) {
        ctx.fillRect((Date.now()/5 + i*300) % WORLD_WIDTH, (i*400) % WORLD_HEIGHT, 2, 2);
    }

    // Efectos de atmósfera por nivel (SIN IMÁGENES)
    if (dimensionActual === "Océano") {
        // Efecto de burbujas/partículas de agua
        ctx.fillStyle = "rgba(77, 148, 255, 0.1)";
        for(let i=0; i<15; i++) {
            ctx.beginPath();
            ctx.arc((Date.now() + i*500) % WORLD_WIDTH, (i*200) % WORLD_HEIGHT, 2, 0, Math.PI*2);
            ctx.fill();
        }
    }
    if (dimensionActual === "Núcleo") {
        // Brillo rojizo pulsante
        ctx.fillStyle = `rgba(255, 0, 0, ${0.05 + Math.sin(Date.now()*0.002)*0.03})`;
        ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    }

    // Dibujar decoración de suelo universal
    dibujarSueloDecorativo();
    
    // Dibujar Grid Cyberpunk más visible
    ctx.strokeStyle = assets.accent + "15"; 
    ctx.lineWidth = 1;
    for(let i=0; i<WORLD_WIDTH; i+=60) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,WORLD_HEIGHT); ctx.stroke(); } // Cuadrícula más densa
    for(let j=0; j<WORLD_HEIGHT; j+=60) { ctx.beginPath(); ctx.moveTo(0,j); ctx.lineTo(WORLD_WIDTH,j); ctx.stroke(); }

    const decorationDrawers = {
        "servidor": (d) => {
            ctx.fillStyle = "#312e81";
            ctx.fillRect(d.x, d.y, 40, 70);
            ctx.fillStyle = (Math.floor(Date.now()/300)%2==0) ? "#4ade80" : "#14532d";
            ctx.fillRect(d.x+10, d.y+10, 20, 4);
            ctx.fillStyle = (Math.floor(Date.now()/500)%2==0) ? "#f87171" : "#7f1d1d";
            ctx.fillRect(d.x+10, d.y+20, 20, 4);
        },
        "pc": (d) => {
            // Mesa detallada
            ctx.fillStyle = "#1a1a1a";
            ctx.fillRect(d.x, d.y + 25, 60, 5); // Superficie
            ctx.fillStyle = "#111";
            ctx.fillRect(d.x + 5, d.y + 30, 5, 20); // Pata izq
            ctx.fillRect(d.x + 50, d.y + 30, 5, 20); // Pata der
            
            // Monitor
            ctx.fillStyle = "#050505";
            ctx.fillRect(d.x + 15, d.y, 30, 20);
            ctx.fillStyle = "#262626";
            ctx.fillRect(d.x + 28, d.y + 20, 4, 5); // Soporte
            
            // EFECTO DE VISIBILIDAD: Brillo si es necesaria para la misión
            const mision = misiones[misionActivaIndex];
            const distAMision = mision ? Math.hypot(d.x - mision.x, d.y - mision.y) : 999;
            const esTerminalCentral = mision && mision.tipo === "consola" && distAMision < 200;
            const esNecesaria = mision && (esTerminalCentral || mision.tipo === "combate_consola" || mision.tipo === "final_consola");

            if (esTerminalCentral) {
                // Efecto de baliza en el suelo para la Terminal Central
                ctx.save();
                ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.01) * 0.2;
                ctx.fillStyle = "#4ade80";
                ctx.beginPath();
                ctx.arc(d.x + 30, d.y + 30, 40 + Math.sin(Date.now() * 0.005) * 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                ctx.shadowBlur = 20;
                ctx.shadowColor = "#4ade80";
            } else if (esNecesaria) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = "#38bdf8";
            }

            const dist = Math.hypot(jugador.x - (d.x + 30), jugador.y - (d.y + 15));
            // Mostrar label de Terminal Central desde más lejos
            if (dist < (esTerminalCentral ? 350 : 120)) {
                // Efecto Estática/Error al acercarse (FNAF Style)
                ctx.fillStyle = (Math.random() > 0.8) ? "#a52a2a" : (Math.random() > 0.5 ? "#333" : "#000");
                ctx.fillRect(d.x + 18, d.y + 3, 24, 14);
                ctx.fillStyle = "white";
                ctx.font = "bold 5px monospace";
                if (Math.random() > 0.7) ctx.fillText("SYSTEM ERR", d.x + 19, d.y + 12);

                if (esNecesaria) {
                    ctx.fillStyle = "#4ade80"; ctx.font = "bold 24px 'Courier New'";
                    const label = esTerminalCentral ? "TERMINAL CENTRAL" : (npcs.some(n => n.isNearPlayer && n.isShopkeeper) ? "COMERCIAR" : "ACCEDER SISTEMA");
                    ctx.fillText(`[E] ${label}`, d.x - 40, d.y - 25);
                    if (teclas['e'] && !consolaActiva && !juegoPausado) {
                    const cat = dimensionActual === "Océano" ? "sql" : (dimensionActual === "Bosque" ? "ssl" : (dimensionActual === "Núcleo" ? "patch" : "network"));
                    iniciarCombateConsola(cat, () => {
                        score += 500;
                        misionObjetivoRealizado = true;
                        misionProgreso++; // Hackear la consola cuenta para el progreso
                        console.log("Sistema parcheado localmente.");
                    });
                    }
                } else {
                    ctx.fillStyle = "#64748b"; ctx.font = "7px Arial";
                    ctx.fillText("SISTEMA BLOQUEADO", d.x + 10, d.y - 5);
                }
            } else {
                ctx.fillStyle = (Math.floor(Date.now()/1000)%2==0) ? "#1a1a1a" : assets.accent + "22";
                ctx.fillRect(d.x + 18, d.y + 3, 24, 14); // Pantalla tenue
            }
            ctx.shadowBlur = 0; // Reset brillo
        },
        "archivador": (d) => {
            ctx.fillStyle = "#455a64";
            ctx.fillRect(d.x, d.y, 35, 60);
            ctx.fillStyle = "#263238";
            ctx.fillRect(d.x + 5, d.y + 10, 25, 10);
            ctx.fillRect(d.x + 5, d.y + 25, 25, 10);
            ctx.fillRect(d.x + 5, d.y + 40, 25, 10);
        },
        "planta": (d) => {
            ctx.fillStyle = "#5d4037"; 
            ctx.fillRect(d.x + 5, d.y + 50, 30, 25);
            ctx.fillStyle = "#3e2723";
            ctx.fillRect(d.x + 17, d.y + 20, 6, 30);
            ctx.fillStyle = "#1b5e20";
            ctx.beginPath();
            ctx.arc(d.x + 20, d.y + 10, 45, 0, Math.PI * 2); 
            ctx.fill();
        },
        "mesa": (d) => {
            ctx.fillStyle = "#5d4037";
            ctx.fillRect(d.x, d.y, 80, 40);
            ctx.fillStyle = "#3e2723";
            ctx.fillRect(d.x + 5, d.y + 5, 70, 30);
        },
        "casa": (d) => {
            ctx.fillStyle = "#6d4c41"; // Techo
            ctx.beginPath();
            ctx.moveTo(d.x, d.y + 50);
            ctx.lineTo(d.x + 50, d.y);
            ctx.lineTo(d.x + 100, d.y + 50);
            ctx.fill();
            ctx.fillStyle = "#8d6e63"; // Paredes
            ctx.fillRect(d.x, d.y + 50, 100, 70);
            ctx.fillStyle = "#4e342e"; // Puerta
            ctx.fillRect(d.x + 40, d.y + 80, 20, 40);
        },
        "cafeteria": (d) => {
            ctx.fillStyle = "#424242"; // Paredes
            ctx.fillRect(d.x, d.y, 120, 80);
            ctx.fillStyle = "#616161"; // Mostrador
            ctx.fillRect(d.x + 10, d.y + 50, 100, 20);
            ctx.fillStyle = "#ffb000"; // Luz de letrero
            ctx.fillRect(d.x + 30, d.y + 10, 60, 15);
            ctx.fillStyle = "#111";
            ctx.font = "bold 10px 'Courier New'";
            ctx.fillText("CAFE", d.x + 45, d.y + 22);
        },
        "museo": (d) => {
            ctx.fillStyle = "#546e7a"; // Edificio
            ctx.fillRect(d.x, d.y, 150, 100);
            ctx.fillStyle = "#78909c"; // Columnas
            ctx.fillRect(d.x + 20, d.y + 10, 10, 80);
            ctx.fillRect(d.x + 120, d.y + 10, 10, 80);
            ctx.fillStyle = "#ffb000";
            ctx.font = "bold 12px 'Courier New'";
            ctx.fillText("MUSEUM", d.x + 50, d.y + 50);
        },
        "policia": (d) => {
            ctx.fillStyle = "#3f51b5"; // Edificio
            ctx.fillRect(d.x, d.y, 100, 80);
            ctx.fillStyle = "#c62828"; // Luz de emergencia
            ctx.beginPath();
            ctx.arc(d.x + 20, d.y + 10, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#111";
            ctx.font = "bold 10px 'Courier New'";
            ctx.fillText("POLICE", d.x + 25, d.y + 40);
        },
        "cassette": (d) => {
            ctx.fillStyle = "#424242";
            ctx.fillRect(d.x, d.y, 30, 20);
            ctx.fillStyle = "#212121";
            ctx.fillRect(d.x + 5, d.y + 5, 20, 10);
            ctx.fillStyle = "#e0e0e0";
            ctx.fillRect(d.x + 7, d.y + 7, 16, 6);
        },
        "vecino_casa": (d) => {
            ctx.fillStyle = "#795548";
            ctx.fillRect(d.x, d.y, 80, 60);
            ctx.fillStyle = "#a1887f";
            ctx.fillRect(d.x + 10, d.y + 10, 60, 40);
        },
        "arbol": (d) => {
            ctx.fillStyle = "#5d4037"; ctx.fillRect(d.x+15, d.y+40, 10, 20); // Tronco
            ctx.fillStyle = "#1b5e20"; ctx.beginPath(); ctx.arc(d.x+20, d.y+25, 25, 0, Math.PI*2); ctx.fill(); // Copas
        },
        "coral": (d) => {
            ctx.fillStyle = "#f87171"; ctx.fillRect(d.x, d.y+10, 10, 20);
            ctx.fillRect(d.x-5, d.y+5, 20, 5);
        },
        "alga": (d) => {
            ctx.fillStyle = "#4ade80"; 
            let wave = Math.sin(Date.now()*0.005 + d.x)*10;
            ctx.beginPath(); ctx.moveTo(d.x, d.y+40);
            ctx.quadraticCurveTo(d.x+wave, d.y+20, d.x, d.y); ctx.stroke();
        },
        "submarino": (d) => {
            ctx.fillStyle = "#facc15"; ctx.fillRect(d.x, d.y, 60, 30);
            ctx.fillStyle = "#38bdf8"; ctx.fillRect(d.x+40, d.y+5, 10, 10);
        },
        "policia_station": (d) => {
            ctx.fillStyle = "#1e3a8a"; ctx.fillRect(d.x, d.y, 100, 80);
            ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif"; ctx.fillText("POLICIA", d.x+25, d.y+20);
            ctx.fillStyle = (Date.now()%1000 < 500) ? "#ef4444" : "#3b82f6";
            ctx.beginPath(); ctx.arc(d.x+10, d.y+5, 5, 0, Math.PI*2); ctx.fill();
        },
        "banco": (d) => {
            ctx.fillStyle = "#475569"; ctx.fillRect(d.x, d.y, 120, 90);
            ctx.fillStyle = "#facc15"; ctx.font = "bold 12px sans-serif"; ctx.fillText("BANCO", d.x+40, d.y+30);
            ctx.fillStyle = "#111"; ctx.fillRect(d.x+50, d.y+60, 20, 30); // Puerta
        },
        "mall": (d) => {
            // Dibujo de Centro Comercial
            ctx.fillStyle = "#1e293b"; ctx.fillRect(d.x - 20, d.y, 140, 100);
            ctx.fillStyle = "#f472b6"; ctx.globalAlpha = 0.3;
            ctx.fillRect(d.x - 10, d.y + 10, 120, 40); ctx.globalAlpha = 1.0;
            ctx.fillStyle = "#fff"; ctx.font = "bold 12px sans-serif";
            ctx.fillText("NEON MALL", d.x + 15, d.y + 35);
            // Puerta de entrada
            ctx.fillStyle = "#334155"; ctx.fillRect(d.x + 40, d.y + 70, 40, 30);

            // Lógica de Entrada
            if (Math.hypot(jugador.x - (d.x + 60), jugador.y - (d.y + 85)) < 60) {
                ctx.fillStyle = "#fff"; ctx.font = "bold 20px Arial";
                ctx.fillText("[E] ENTRAR AL MALL", d.x - 30, d.y + 60);
                if (teclas['e'] && !juegoPausado) {
                    dimensionActual = "Centro Comercial";
                    jugador.x = 1250; jugador.y = 1000; // Teletransporte al centro del interior
                    cargarNivel(dimensionActual, iniciarCuentaRegresiva);
                    if (domCache.levelDisplay) domCache.levelDisplay.innerText = dimensionActual;
                }
            }
        },
        "skyscraper": (d) => {
            const grad = ctx.createLinearGradient(d.x, d.y, d.x, d.y + 160);
            grad.addColorStop(0, "#1e1b4b"); grad.addColorStop(1, "#312e81");
            ctx.fillStyle = grad; ctx.fillRect(d.x, d.y, 80, 160);
            ctx.fillStyle = "#facc15"; // Ventanas
            for(let r=0; r<8; r++) {
                for(let c=0; c<3; c++) {
                    if (Math.random() > 0.4) ctx.fillRect(d.x + 12 + (c*22), d.y + 15 + (r*18), 8, 8);
                }
            }
            // Opción de entrar al Data Center
            if (Math.hypot(jugador.x - (d.x + 40), jugador.y - (d.y + 140)) < 50) {
                ctx.fillStyle = "#22d3ee"; ctx.font = "bold 16px Arial";
                ctx.fillText("[E] ACCESO SERVIDORES", d.x - 30, d.y + 180);
                if (teclas['e'] && !juegoPausado) {
                    dimensionActual = "Data Center";
                    jugador.x = 500; jugador.y = 500;
                    cargarNivel(dimensionActual, iniciarCuentaRegresiva);
                    if (domCache.levelDisplay) domCache.levelDisplay.innerText = dimensionActual;
                }
            }

            ctx.strokeStyle = "#6366f1"; ctx.lineWidth = 2; ctx.strokeRect(d.x, d.y, 80, 160);
            // Cartel de Neón
            ctx.fillStyle = colorBase; ctx.font = "bold 8px Courier New";
            ctx.fillText("DATA_BLOCK", d.x + 10, d.y + 10);
        },
        "vending_machine": (d) => {
            ctx.fillStyle = "#1e293b"; ctx.fillRect(d.x, d.y, 35, 55);
            ctx.fillStyle = "#38bdf8"; ctx.fillRect(d.x+5, d.y+5, 25, 15); // Pantalla
            ctx.fillStyle = "#fff"; ctx.font = "bold 6px Arial"; ctx.fillText("CODE_JUICE", d.x+6, d.y+15);
            ctx.shadowBlur = 10; ctx.shadowColor = "#38bdf8"; ctx.strokeStyle = "#38bdf8"; ctx.strokeRect(d.x, d.y, 35, 55); ctx.shadowBlur = 0;
        },
        "street_light": (d) => {
            ctx.fillStyle = "#475569"; ctx.fillRect(d.x + 18, d.y, 4, 70);
            const time = Date.now() * 0.003;
            ctx.save();
            ctx.shadowBlur = 20 + Math.sin(time) * 10; ctx.shadowColor = colorBase;
            ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(d.x+20, d.y, 10, 0, Math.PI*2); ctx.fill();
            ctx.restore();
            // Brillo de suelo
            const radG = ctx.createRadialGradient(d.x+20, d.y+70, 5, d.x+20, d.y+70, 50);
            radG.addColorStop(0, colorBase + "33"); radG.addColorStop(1, "transparent");
            ctx.fillStyle = radG; ctx.beginPath(); ctx.arc(d.x+20, d.y+70, 50, 0, Math.PI*2); ctx.fill();
        },
        "bench": (d) => {
            ctx.fillStyle = "#1e293b"; ctx.fillRect(d.x, d.y + 15, 50, 6); // Asiento
            ctx.fillRect(d.x + 5, d.y + 21, 6, 10); ctx.fillRect(d.x + 39, d.y + 21, 6, 10); // Patas
        }
    };
    

    // Dibujar Decoraciones (Servidores con luces)
    decoraciones.forEach(d => {
        if (d.dimension === dimensionActual || !d.dimension) {
            const drawer = decorationDrawers[d.tipo];
            if (drawer) {
                drawer(d, assets.accent);
            }
        }
    });

    // Dibujar Objetivos de Misión (Ámbar retro)
    missionItems.forEach(mi => {
        if (!mi.activo) return;
        const bob = Math.sin(Date.now() * 0.005) * 8;
        
        // Sombra de item
        ctx.save();
        ctx.translate(mi.x, mi.y);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(0, 20 - bob/2, 10 + bob/4, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(mi.x, mi.y + bob);
        
        // DIBUJO ÚNICO
        // Efecto de brillo pulsante para los ítems de misión
        const glowIntensity = 10 + Math.sin(Date.now() * 0.008) * 5; // Pulsa entre 5 y 15
        ctx.shadowBlur = glowIntensity;
        ctx.shadowColor = "#facc15"; // Color ámbar para los ítems de misión

        if (mi.tipo === "simbolo") {
            const char = mi.char || "?";
            ctx.fillStyle = "#facc15";
            ctx.font = "bold 24px 'Courier New'";
            ctx.textAlign = "center";
            ctx.fillText(char, 0, 8);
        } else if (mi.tipo === "token") {
            ctx.fillStyle = "#4ade80"; // Verde esmeralda
            ctx.beginPath();
            ctx.moveTo(0, -12); ctx.lineTo(10, 0); ctx.lineTo(0, 12); ctx.lineTo(-10, 0);
            ctx.closePath();
            ctx.fill();
        } else if (mi.tipo === "codigo" || mi.tipo === "mfa") {
            ctx.fillStyle = "#38bdf8";
            ctx.fillRect(-10, -10, 20, 20);
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.strokeRect(-6, -6, 12, 12);
        } else if (mi.tipo === "patch") {
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = "#ef4444";
            ctx.fillRect(-4, -12, 8, 24);
            ctx.fillRect(-12, -4, 24, 8);
        } else {
            // Fallback: rombo ámbar
            ctx.rotate(Date.now() / 500);
            ctx.fillStyle = "#ffb000";
            ctx.fillRect(-8, -8, 16, 16);
        }
        
        ctx.restore();
        
        if (Math.hypot(jugador.x - mi.x, jugador.y - mi.y) < 40) {
            // Restablecer el shadowBlur a 0 después de dibujar el item
            // para que no afecte a otros elementos que se dibujen después.
            ctx.shadowBlur = 0; 

            mi.activo = false;
            misionProgreso++;
            jugador.missionInventory.push({...mi}); // Guardar en inventario visual
            score += 100;
            crearParticula(mi.x, mi.y, "#ffb000");
            play8BitSound('collect');
        }
    });

    // Dibujar Secretos (Data Fragments)
    secretos.forEach(s => {
        if(!s.activo) return;
        const bob = Math.sin(Date.now() * 0.005 + 1) * 8; // Offset de fase

        // Sombra
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(0, 20 - bob/2, 8 + bob/4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(s.x, s.y + bob);
        ctx.rotate(Date.now() / 1000);
        ctx.fillStyle = "#22b14c"; 
        ctx.fillRect(-8, -8, 16, 16); // Fragmentos de datos
        ctx.restore();
        
        if(Math.hypot(jugador.x - s.x, jugador.y - s.y) < 40) {
            s.activo = false;
            fragmentosEncontrados++;
            score += 50; // Use domCache.fragmentsCount
            crearFloatingText(s.x, s.y - 20, "+50 PTS", "#facc15");
            if (domCache.fragmentsCount) domCache.fragmentsCount.innerText = `${fragmentosEncontrados} / ${secretos.length}`;
            crearParticula(s.x, s.y, "#fff"); // Partículas al recoger
        }
    });

    // Dibujar Items (Espada, etc)
    items.forEach(item => {
        if (!item.activo) return;
        
        const bob = Math.sin(Date.now() * 0.005 + 2) * 8;

        // Sombra
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(0, 25 - bob/2, 12 + bob/4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(item.x, item.y + bob);
        ctx.rotate(Math.sin(Date.now()/500) * 0.3);

        // Aplicar brillo pulsante a la Key-Card
        if (item.tipo === "key_card") {
            const glowIntensity = 10 + Math.sin(Date.now() * 0.008) * 5;
            ctx.shadowBlur = glowIntensity;
            ctx.shadowColor = "#38bdf8"; // Azul neón para la Key-Card
        }
        if (item.tipo === "espada") {
            ctx.fillStyle = "#dcdcdc"; // Color de la espada
            ctx.fillRect(-2, -15, 4, 25); 
            ctx.fillStyle = "#ffaa00";
            ctx.fillRect(-6, 5, 12, 4);
        } else if (item.tipo === "health_pack") {
            ctx.fillStyle = "#fff";
            ctx.fillRect(-8, -8, 16, 16);
            ctx.fillStyle = "#facc15"; // Amarillo del sistema
            ctx.fillRect(-6, -2, 12, 4);
            ctx.fillRect(-2, -6, 4, 12);
        } else if (item.tipo === "key_card") {
            ctx.fillStyle = "#38bdf8"; // Azul neón
            ctx.fillRect(-10, -6, 20, 12);
            ctx.fillStyle = "#fff";
            ctx.fillRect(2, -2, 4, 4); // El "chip" de la tarjeta
        }
        ctx.shadowBlur = 0; // Restablecer el brillo después de dibujar el item
        ctx.restore();

        if (Math.hypot(jugador.x - item.x, jugador.y - item.y) < 40) {
            item.activo = false;
            if (item.tipo === "espada") {
                jugador.tieneEspada = true;
                score += 500;
                crearFloatingText(item.x, item.y - 20, "+500 PTS", "#facc15");
            } else if (item.tipo === "pistola") {
                jugador.tienePistola = true;
                score += 1000;
                mostrarAvisoDisparo();
            } else if (item.tipo === "cassette_item") {
                // Lógica para recoger cassette
                score += 50; // Esto debería ser para misiones, no para items de tienda
                crearFloatingText(item.x, item.y - 20, "+50 PTS", "#facc15");
            } else if (item.tipo === "code_fragment") {
                codeFragments += 1;
                score += 5; // Pequeño bonus por recoger
                play8BitSound('collect');
                crearFloatingText(item.x, item.y - 20, "+5 PTS", "#facc15");
                // Podríamos añadir un contador de cassettes en el jugador
            } else if (item.tipo === "health_pack") {
                jugador.inventory.push({ type: 'health_pack', name: 'Botiquín' });
                score += 50;
                play8BitSound('collect');
                crearFloatingText(item.x, item.y - 20, "+50 PTS", "#facc15");

            } else if (item.tipo === "key_card") {
                tieneLlave = true;
                score += 200;
                play8BitSound('collect');
            }
        }
    });

    // Dibujar Cofres (Nodos de Datos)
    cofres.forEach(c => {
        if (c.dimension !== dimensionActual) return;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.fillStyle = c.abierto ? "#22c55e" : "#475569";
        ctx.fillRect(-20, -15, 40, 30);
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(-15, -5, 30, 5); // Cerradura
        
        const d = Math.hypot(jugador.x - c.x, jugador.y - c.y);
        if (d < 50 && !c.abierto) {
            ctx.fillStyle = "white";
            ctx.font = "bold 16px Arial";
            ctx.fillText(tieneLlave ? "[E] ABRIR NODO" : "NECESITAS KEY-CARD", -60, -30);
            if (teclas['e'] && tieneLlave) {
                c.abierto = true;
                score += 1000;
                crearFloatingText(c.x, c.y - 20, "+1000 PTS", "#facc15");
                if (c.recompensa) {
                    jugador.missionInventory.push({ type: "data_hash", value: c.recompensa });
                }
                misionProgreso++;
                play8BitSound('success');
            }
        }
        ctx.restore();
    });

    dibujarEnemigos();
        dibujarNPCs();
    dibujarProyectilesJugador();
    dibujarProyectilesEnemigos();

    // Misión Activa
    // Solo dibujamos misiones si estamos en modo JUGANDO
    if (mision) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = assets.accent; // Color del portal según el nivel
        
        if (misionProgreso >= mision.objetivoTotal) {
            ctx.fillStyle = assets.accent + "33"; // Más visible si está completo
            // Activar el remolino del portal
            portalSwirlActive = true;
            portalSwirlX = mision.x;
            portalSwirlY = mision.y;
        } else {
            ctx.fillStyle = "rgba(255, 176, 0, 0.1)"; // Menos visible si no está completo
            portalSwirlActive = false; // Desactivar remolino si no está completo
        }

        ctx.beginPath();
        ctx.arc(mision.x, mision.y, 25 + Math.sin(Date.now()/200)*5, 0, Math.PI * 2); // Efecto pulsante
        ctx.fill();
        ctx.strokeStyle = "#ffb000";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Lógica de interacción con el portal
        if (!juegoPausado && Math.hypot(jugador.x + jugador.w/2 - mision.x, jugador.y + jugador.h/2 - mision.y) < 30) { // Player is near portal
            if (misionProgreso >= mision.objetivoTotal) { // Check against mission's total objectives
                // Solo abrir el quiz una vez, después de un pequeño retraso para que el remolino comience
                if (domCache.quizModal.classList.contains("hidden")) {
                    nivelCompletado = true; // Mark level as completed for display
                    setTimeout(() => {
                        // Buscamos la pregunta específica para esta misión (ID de misión coincide con ID de pregunta)
                        const preguntaMision = bancoPreguntas.find(p => p.tipo === 'mision' && p.id === mision.id);
                        abrirQuiz(preguntaMision, false);
                    }, 500); // 0.5 segundos de retraso
                }
            } else {
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0); // HUD space
                ctx.fillStyle = "white";
                ctx.font = "bold 16px 'Courier New'";
                ctx.textAlign = "center"; // Display current progress vs total objectives
                ctx.fillText(`ACCESO BLOQUEADO: RECOLECTA LOS OBJETIVOS (${misionProgreso}/${mision.objetivoTotal})`, canvas.width/2, 120);
                ctx.restore();
            }
        } else {
            portalSwirlActive = false; // Desactivar remolino si el jugador se aleja
        }
    } // <-- Cierre de la condición 'if (mision)' que faltaba

    // --- 2. DIBUJAR JUGADOR (DENTRO DE LA CÁMARA) ---
    const isMoving = dx !== 0 || dy !== 0;
    const walkCycle = isMoving ? Math.sin(Date.now() * 0.015) : 0;
    const bob = walkCycle * 2;

    const p = jugador;

    // Animación de Estocada (Lunge) al atacar
    let lungeX = 0, lungeY = 0;
    if (p.atacando > 0) {
        let lungePower = Math.sin((p.atacando / 15) * Math.PI) * 15;
        if (p.direccion === "Up") lungeY = -lungePower;
        if (p.direccion === "Down") lungeY = lungePower;
        if (p.direccion === "Left") lungeX = -lungePower;
        if (p.direccion === "Right") lungeX = lungePower;
    }

    ctx.save();
    ctx.translate(p.x + lungeX, p.y + bob + lungeY);

    // Efecto de invulnerabilidad (parpadeo)
    if (p.invulnerable > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
        ctx.globalAlpha = 0.3;
    }

    // Efecto visual de Escudo (Firewall)
    if (p.shieldActive > 0) {
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(15, 15, 30, 0, Math.PI * 2); ctx.stroke();
    }

    // Piernas animadas
    ctx.fillStyle = "#333";
    const legOffset = walkCycle * 5;
    ctx.fillRect(5, 25, 8, 10 + legOffset);
    ctx.fillRect(17, 25, 8, 10 - legOffset);

    // Dibujar espada
    if (p.tieneEspada) {
        ctx.save();
        let ex = 15, ey = 15, er = 0;
        if (p.direccion === "Right") { ex = 35; er = Math.PI / 2; }
        else if (p.direccion === "Left") { ex = -5; er = -Math.PI / 2; }
        else if (p.direccion === "Down") { ey = 35; er = Math.PI; }
        else if (p.direccion === "Up") { ey = -5; er = 0; }

        if (p.atacando > 0) {
            // Arco de ataque fluido
            let progress = (15 - p.atacando) / 15;
            er += (progress - 0.5) * 3;
        }

        ctx.translate(ex, ey);
        ctx.rotate(er);
        ctx.fillStyle = "#22b14c";
        ctx.fillRect(-2, -20, 4, 20);
        ctx.restore();
    }

    // Cuerpo
    ctx.fillStyle = p.color;
    ctx.fillRect(0, 10, p.w, p.h - 10);

    // Cabeza
    ctx.fillStyle = "#111";
    ctx.fillRect(2, 0, p.w - 4, 15);

    // Visor con pestañeo aleatorio
    const blinking = Math.sin(Date.now() * 0.005) > 0.98;
    if (!blinking) {
        ctx.fillStyle = "#fff";
        const eyeSize = 4;
        if (p.direccion === "Down") {
            ctx.fillRect(5, 8, eyeSize, eyeSize);
            ctx.fillRect(p.w - 5 - eyeSize, 8, eyeSize, eyeSize);
        } else if (p.direccion === "Left") {
            ctx.fillRect(2, 8, eyeSize, eyeSize);
        } else if (p.direccion === "Right") {
            ctx.fillRect(p.w - 2 - eyeSize, 8, eyeSize, eyeSize);
        }
    }

    ctx.restore(); // Restaurar contexto del jugador

    ctx.restore(); // Finalizar traducción de cámara

    // --- NUEVO: HUD DE INSTRUCCIONES INFERIOR ---
    if (estadoJuego === "JUGANDO") {
        if (mision) {
            ctx.save();
            const hw = 500, hh = 60;
            const hx = (canvas.width - hw) / 2;
            const hy = canvas.height - hh - 20;

            // Fondo del mensaje
            ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
            ctx.strokeStyle = assets.accent;
            ctx.lineWidth = 2;
            ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(hx, hy, hw, hh, 10); else ctx.rect(hx, hy, hw, hh);
            ctx.fill(); ctx.stroke();

            // Texto de instrucción
            ctx.fillStyle = "#fff"; ctx.font = "bold 13px Arial"; ctx.textAlign = "center";
            ctx.fillText(`HOLA AGENTE, EL PROTOCOLO REFIERE:`, canvas.width / 2, hy + 22);
            ctx.fillStyle = assets.accent; ctx.font = "italic 12px Courier New";
            ctx.fillText(`Debes ir con ${mision.npc.nombre} para recibir instrucciones tácticas.`, canvas.width / 2, hy + 42);
            ctx.restore();
        }
    }

    // --- BARRA DE VIDA DEL JEFE (Si hay uno cerca) ---
    const boss = enemigos.find(e => e.tipo === "boss");
    if (boss) {
        const distAlBoss = Math.hypot(jugador.x - boss.x, jugador.y - boss.y);
        if (distAlBoss < 600) {
            const bw = 400, bh = 15;
            const bx = (canvas.width - bw) / 2;
            const by = 40;
            // Fondo barra
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(bx, by, bw, bh);
            // Vida actual
            const vidaPct = boss.vida / misiones[misionActivaIndex].boss.vida;
            ctx.fillStyle = boss.color; // Color del jefe
            ctx.fillRect(bx, by, bw * vidaPct, bh);
            // Nombre del Boss
            ctx.fillStyle = "white";
            ctx.font = "bold 14px 'Courier New'";
            ctx.textAlign = "center";
            ctx.fillText(boss.nombre.toUpperCase(), canvas.width / 2, by - 10);
        }
    }

    // --- EFECTO RETRO FNAF (Post-procesado) ---
    // 1. Scanlines
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    for(let i=0; i<canvas.height; i+=4) {
        ctx.fillRect(0, i, canvas.width, 1);
    }
    // 2. Grano / Estática
    if (Math.random() > 0.9) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.fillRect(Math.random()*canvas.width, Math.random()*canvas.height, 2, 2);
    }

    // --- LUCES DE EMERGENCIA (Parpadeo rojo antes del apagón) ---
    if (apagonLuz > 0 && apagonLuz < 60 && Math.floor(Date.now()/100)%2 === 0) { // Parpadea en los últimos 1 segundo
        ctx.save();
        ctx.fillStyle = "rgba(255, 0, 0, 0.1)"; // Rojo tenue
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // CORRECCIÓN: El apagón debe usar coordenadas de pantalla (Screen Space)
    if (apagonLuz > 0) {
        ctx.save();
        // Convertir posición del jugador a coordenadas de pantalla
        const screenX = jugador.x + 15 - camX;
        const screenY = jugador.y + 15 - camY;
        
        let grdLinterna = ctx.createRadialGradient(
            screenX, screenY, 30,
            screenX, screenY, 200
        );
        grdLinterna.addColorStop(0, "rgba(0,0,0,0)"); 
        grdLinterna.addColorStop(1, "rgba(0,0,0,0.98)"); // El resto del mapa es oscuridad
        ctx.fillStyle = grdLinterna;
        ctx.fillRect(0, 0, canvas.width, canvas.height); // Cubre todo el canvas
        ctx.restore();
    }

    // --- EFECTO DE DAÑO (FLASH ROJO) ---
    if (damageFlash > 0) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // HUD space (ignora cámara)
        ctx.fillStyle = `rgba(255, 0, 0, ${damageFlash / 60})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        damageFlash--;
    }

    // --- TEXTO DE MISIÓN COMPLETADA ---
    if (nivelCompletado && juegoPausado && domCache.quizModal.classList.contains("hidden")) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // HUD space
        ctx.fillStyle = "white";
        ctx.font = "bold 48px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(99, 102, 241, 0.8)";
        ctx.fillText("¡MISIÓN COMPLETADA!", canvas.width / 2, 100);
        ctx.restore();
    }

    if (estadoJuego === "JUGANDO") {
        const minimapWidth = 150;
        const minimapHeight = 100;
        const minimapX = canvas.width - minimapWidth - 10; // 10px padding from right
        const minimapY = 10; // 10px padding from top

        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(minimapX, minimapY, minimapWidth, minimapHeight);

        ctx.strokeStyle = "#22b14c";
        ctx.lineWidth = 1;
        ctx.strokeRect(minimapX, minimapY, minimapWidth, minimapHeight);

        const scaleX = minimapWidth / WORLD_WIDTH;
        const scaleY = minimapHeight / WORLD_HEIGHT;

        // DIBUJAR COMPUTADORAS EN EL MINIMAPA (Puntos verdes)
        decoraciones.forEach(d => {
            if (d.tipo === "pc" && (d.dimension === dimensionActual || !d.dimension)) {
                ctx.fillStyle = "#4ade80";
                ctx.fillRect(minimapX + d.x * scaleX - 1, minimapY + d.y * scaleY - 1, 3, 3);
            }
        });

        // Dibujar NPCs en el minimapa
        npcs.forEach(n => {
            ctx.fillStyle = n.isShopkeeper ? "#38bdf8" : "white"; // Diferenciar vendedores
            ctx.fillRect(minimapX + n.x * scaleX, minimapY + n.y * scaleY, 2, 2);
        });

        // Dibujar misiones activas (Portal/Boss)
        misiones.forEach(mision => {
            if (!mision.completada) {
                const isCurrent = misiones.indexOf(mision) === misionActivaIndex;
                ctx.fillStyle = isCurrent ? "#4ade80" : "#ffb000";
                const pulse = isCurrent ? Math.sin(Date.now() * 0.01) * 2 : 0;
                
                ctx.beginPath();
                ctx.arc(minimapX + mision.x * scaleX, minimapY + mision.y * scaleY, (isCurrent ? 4 : 3) + pulse, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // Dibujar Objetivos (Solo si el jugador está cerca para dificultad)
        missionItems.forEach(mi => {
            if (mi.activo) {
                const distAlJugador = Math.hypot(jugador.x - mi.x, jugador.y - mi.y);
                if (distAlJugador < 600) { // Rango de detección de radar
                    ctx.fillStyle = "#ffb000";
                    ctx.fillRect(minimapX + mi.x * scaleX, minimapY + mi.y * scaleY, 2, 2);
                }
            }
        });

        // Dibujar Cofres en el minimapa (Punto Dorado)
        cofres.forEach(c => {
            if (c.dimension === dimensionActual && !c.abierto) {
                ctx.fillStyle = "#fbbf24";
                ctx.fillRect(minimapX + c.x * scaleX - 2, minimapY + c.y * scaleY - 2, 4, 4);
            }
        });

        // Dibujar jugador
        ctx.fillStyle = jugador.color;
        ctx.fillRect(minimapX + jugador.x * scaleX - 2, minimapY + jugador.y * scaleY - 2, 4, 4);
        ctx.restore();
    }

    // --- ACTUALIZAR HUD (Elementos HTML) ---
    // Use cached DOM elements
    if (domCache.scoreDisplay) domCache.scoreDisplay.innerText = score;

    // Rastreador de misiones detallado en el Sidebar
    if (domCache.missionTracker && misiones[misionActivaIndex]) { // Ensure mission exists
        const mis = misiones[misionActivaIndex];

        let objectivesStatus = [];
        let totalObjectives = 0;
        let completedObjectives = 0;

        // Dynamic objective tracking based on mission type and items
        if (mis.tipo === "simbolos") { // Mission 1: Brute Force Defense (Key-Card, Fragments, Chest)
            const collectedFragments = jugador.missionInventory.filter(item => item.tipo === "simbolo").length;
            const totalFragments = missionItems.filter(item => item.tipo === "simbolo").length;
            const chestOpened = cofres.some(c => c.dimension === dimensionActual && c.abierto);

            objectivesStatus.push({ text: "Obtener Key-Card", completed: tieneLlave });
            objectivesStatus.push({ text: `Recolectar fragmentos de clave (${collectedFragments}/${totalFragments})`, completed: collectedFragments >= totalFragments });
            objectivesStatus.push({ text: "Abrir el Nodo de Datos (Cofre)", completed: chestOpened });
            totalObjectives = 3;
        } else if (mis.tipo === "consola") { // Mission 2: SQL Injection (Terminal)
            objectivesStatus.push({ text: "Completar protocolo de sanitización SQL", completed: misionObjetivoRealizado });
            totalObjectives = 1;
        } else if (mis.tipo === "combate_consola") { // Mission 3: Man-in-the-Middle (Certificates, Console)
            const collectedCertificates = jugador.missionInventory.filter(item => item.tipo === "codigo").length;
            const totalCertificates = missionItems.filter(item => item.tipo === "codigo").length;

            objectivesStatus.push({ text: `Recolectar fragmentos de certificados (${collectedCertificates}/${totalCertificates})`, completed: collectedCertificates >= totalCertificates });
            objectivesStatus.push({ text: "Validar certificados en consola", completed: misionObjetivoRealizado });
            totalObjectives = 2;
        } else if (mis.tipo === "firewall") { // Mission 4: El Gran Cortafuegos (Tokens)
            const collectedTokens = jugador.missionInventory.filter(item => item.tipo === "token").length;
            const totalTokens = missionItems.filter(item => item.tipo === "token").length;

            objectivesStatus.push({ text: `Recolectar Tokens de Confianza (${collectedTokens}/${totalTokens})`, completed: collectedTokens >= totalTokens });
            totalObjectives = 1; // Only one main objective for this mission type
        } else if (mis.tipo === "final_consola") { // Mission 5: El Núcleo Zero-Day (Vulnerability, Boss, Console)
            const bossDefeated = enemigos.filter(e => e.tipo === "boss").length === 0;
            const vulnerabilityFound = jugador.missionInventory.filter(item => item.tipo === "patch").length > 0; // Assuming 'patch' is the vulnerability item

            objectivesStatus.push({ text: "Encontrar vulnerabilidad", completed: vulnerabilityFound });
            objectivesStatus.push({ text: "Derrotar al Virus Maestro", completed: bossDefeated });
            objectivesStatus.push({ text: "Ejecutar parche crítico en consola", completed: misionObjetivoRealizado });
            totalObjectives = 3;
        }

        completedObjectives = objectivesStatus.filter(obj => obj.completed).length;
        
        // Update misionProgreso based on actual completed objectives for portal check
        misionProgreso = completedObjectives;
        mis.objetivoTotal = totalObjectives; // Ensure total objectives is set for the mission object

        domCache.missionTracker.innerHTML = `
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--primary-color); margin-bottom: 4px;">${mis.titulo}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.3; margin-bottom: 10px;">${mis.descripcion}</div>
            <ul style="list-style: none; padding: 0; margin: 0 0 10px 0; font-size: 0.8rem;">
                ${objectivesStatus.map(obj => `
                    <li style="color: ${obj.completed ? 'var(--success-color)' : 'var(--text-muted)'}; text-decoration: ${obj.completed ? 'line-through' : 'none'}; margin-bottom: 5px;">
                        ${obj.text}
                    </li>
                `).join('')}
            </ul>
            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: 600; margin-bottom: 4px;">
                <span>Progreso General</span>
                <span>${completedObjectives} / ${totalObjectives}</span>
            </div>
            <div class="hud-bar-container" style="height: 6px; margin: 0;">
                <div class="hud-bar-fill" style="width: ${Math.min((completedObjectives/totalObjectives)*100, 100)}%; background: var(--accent-color);"></div>
            </div> 
        `;
    }

    // Actualizar Barras HUD
    const bPct = (jugador.bateria / jugador.bateriaMax) * 100;
    if (domCache.batteryBarHud) domCache.batteryBarHud.style.width = bPct + "%";
    if (domCache.batteryVal) domCache.batteryVal.innerText = Math.floor(bPct) + "%";
    
    const sPct = (jugador.stamina / jugador.staminaMax) * 100;
    if (domCache.staminaBarHud) domCache.staminaBarHud.style.width = sPct + "%";
    if (domCache.staminaVal) domCache.staminaVal.innerText = Math.floor(sPct) + "%";

    if (domCache.codeFragmentsDisplay) domCache.codeFragmentsDisplay.innerText = codeFragments;

    // Cooldowns
    if (domCache.cooldownR) domCache.cooldownR.style.display = jugador.cooldowns.r > 0 ? 'block' : 'none';
    if (domCache.cooldownE) domCache.cooldownE.style.display = jugador.cooldowns.e > 0 ? 'block' : 'none';
    
    // Vidas
    if (domCache.livesDisplay) {
        domCache.livesDisplay.innerHTML = Array(jugador.vidasMax).fill(0).map((_, i) => 
            `<div style="width:12px; height:12px; margin-right:5px; display:inline-block; background:${i < jugador.vidas ? '#facc15' : '#262626'}; border-radius:2px;"></div>`
        ).join('');
    }
}

function enviarPuntajeAlServidor(aciertos = 0, errores = 0) {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    fetch("/api/game/score", { // Endpoint correcto para guardar puntaje
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
            estudiante_id: userId,
            nivel_id: misiones[misionActivaIndex]?.id || 1,
            score: score, // Enviar el puntaje actual
            aciertos: aciertos,
            errores: errores
        })
    })
    .then(response => response.json())
    .then(data => console.log("Sincronización con el servidor:", data.status, data.message))
    .catch(err => console.error("Error al sincronizar puntaje:", err));
}

function syncPosition() {
    const userId = localStorage.getItem('userId');
    const salaId = localStorage.getItem('salaId');
    if (!userId || !salaId || juegoPausado) return;

    fetch('/api/game/position', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
            usuario_id: userId,
            sala_id: salaId,
            x: jugador.x, y: jugador.y,
            color: jugador.color, username: localStorage.getItem('username')
        })
    }).catch(() => {}); // Silencioso para no saturar consola
}

/**
 * Actualiza los elementos de la interfaz de usuario (HUD) en el DOM.
 * Separado del bucle de renderizado para mejorar el rendimiento al reducir el layout thrashing.
 */
let lastHUDMissionState = "";
function actualizarHUD() {
    if (estadoJuego !== "JUGANDO") return;

    if (domCache.scoreDisplay) domCache.scoreDisplay.innerText = score;

    // Rastreador de misiones detallado en el Sidebar
    if (domCache.missionTracker && misiones[misionActivaIndex]) {
        const mis = misiones[misionActivaIndex];
        let objectivesStatus = [];

        // Evaluamos el progreso basándonos en el inventario y estado global
        if (mis.tipo === "simbolos") {
            const totalFragments = 4;
            const collectedCount = jugador.missionInventory.filter(i => i.tipo === "simbolo").length;
            const chestOpened = cofres.some(c => c.dimension === dimensionActual && c.abierto);
            objectivesStatus = [
                { text: "Obtener Key-Card", completed: tieneLlave },
                { text: `Recolectar fragmentos de clave (${collectedCount}/${totalFragments})`, completed: collectedCount >= totalFragments },
                { text: "Abrir el Nodo de Datos (Cofre)", completed: chestOpened }
            ];
        } else if (mis.tipo === "consola") {
                objectivesStatus = [
                    { text: "Localizar Terminal Central", completed: false }, // Se marca al estar cerca
                    { text: "Completar sanitización SQL", completed: misionObjetivoRealizado }
                ];
                if (Math.hypot(jugador.x - mis.x, jugador.y - mis.y) < 200) objectivesStatus[0].completed = true;
        } else if (mis.tipo === "combate_consola") {
            const collectedCerts = jugador.missionInventory.filter(item => item.tipo === "codigo").length;
            objectivesStatus = [
                { text: `Fragmentos certificados (${collectedCerts}/4)`, completed: collectedCerts >= 4 },
                { text: "Validar certificados en consola", completed: misionObjetivoRealizado }
            ];
        } else if (mis.tipo === "firewall") {
            const collectedTokens = jugador.missionInventory.filter(item => item.tipo === "token").length;
            objectivesStatus = [{ text: `Tokens de Confianza (${collectedTokens}/4)`, completed: collectedTokens >= 4 }];
        } else if (mis.tipo === "final_consola") {
            const bossDefeated = enemigos.filter(e => e.tipo === "boss").length === 0;
            const vulnerabilityFound = jugador.missionInventory.filter(item => item.tipo === "patch").length > 0;
            objectivesStatus = [
                { text: "Encontrar vulnerabilidad", completed: vulnerabilityFound },
                { text: "Derrotar al Virus Maestro", completed: bossDefeated },
                { text: "Ejecutar parche crítico en consola", completed: misionObjetivoRealizado }
            ];
        }

        const totalObjectives = objectivesStatus.length;
        const completedObjectives = objectivesStatus.filter(obj => obj.completed).length;
        misionProgreso = completedObjectives;
        mis.objetivoTotal = totalObjectives;

        // Comprobar si el estado ha cambiado para evitar actualizaciones innecesarias del DOM
        const invCount = jugador.missionInventory ? jugador.missionInventory.length : 0;
        const stateKey = `M${misionActivaIndex}-P${completedObjectives}-I${invCount}`;

        if (stateKey !== lastHUDMissionState) {
            lastHUDMissionState = stateKey;

            // --- LÓGICA DE LAS CREDENCIALES VERTICALES ---
            const fragmentMissions = ["simbolos", "combate_consola", "firewall"];
            const isFragmentMission = fragmentMissions.includes(mis.tipo);

            if (isFragmentMission && domCache.credentialsBox && domCache.credentialsList) {
                domCache.credentialsBox.classList.remove("hidden");
                if (domCache.hudAccessCode) domCache.hudAccessCode.classList.remove("hidden");
                let targets = [];
                let accentColor = "#facc15"; // Amarillo por defecto
                
                if (mis.tipo === "simbolos") {
                    targets = ["7", "u", "r", "6"];
                    accentColor = "#facc15";
                    if (domCache.credentialsTitle) domCache.credentialsTitle.innerText = "CÓDIGO DE ACCESO";
                    if (domCache.hudAccessCodeTitle) domCache.hudAccessCodeTitle.innerText = "CÓDIGO DE ACCESO";
                } else if (mis.tipo === "combate_consola") {
                    targets = ["C1", "C2", "C3", "C4"];
                    accentColor = "#38bdf8";
                    if (domCache.credentialsTitle) domCache.credentialsTitle.innerText = "CERTIFICADOS SSL";
                    if (domCache.hudAccessCodeTitle) domCache.hudAccessCodeTitle.innerText = "CERTIFICADOS SSL";
                } else if (mis.tipo === "firewall") {
                    targets = ["T1", "T2", "T3", "T4"];
                    accentColor = "#4ade80";
                    if (domCache.credentialsTitle) domCache.credentialsTitle.innerText = "TOKENS DE RED";
                    if (domCache.hudAccessCodeTitle) domCache.hudAccessCodeTitle.innerText = "TOKENS DE RED";
                }

                const buildItemsHtml = (size, fontSize, shadowSize) => targets.map((t, i) => {
                    let found = false;
                    if (mis.tipo === "simbolos") {
                        found = jugador.missionInventory.some(item => item.tipo === "simbolo" && item.char === t);
                    } else {
                        const type = mis.tipo === "combate_consola" ? "codigo" : "token";
                        found = jugador.missionInventory.filter(item => item.tipo === type).length > i;
                    }

                    const color = found ? accentColor : "#555";
                    const shadow = found ? `0 0 ${shadowSize} ${accentColor}` : "none";
                    const border = found ? `2px solid ${accentColor}` : "2px solid #333";
                    
                    return `<div style="width: ${size}; height: ${size}; border: ${border}; background: #050505; color: ${color}; display: flex; align-items: center; justify-content: center; border-radius: 6px; font-family: 'Courier New', monospace; font-weight: bold; font-size: ${fontSize}; box-shadow: ${shadow}; transition: all 0.4s ease;">${found ? t : '?'}</div>`;
                }).join("");

                domCache.credentialsList.innerHTML = buildItemsHtml("50px", "1.3rem", "15px");
                if (domCache.hudCredentialsList) {
                    domCache.hudCredentialsList.innerHTML = buildItemsHtml("30px", "0.9rem", "10px");
                }
            } else if (domCache.credentialsBox) {
                domCache.credentialsBox.classList.add("hidden");
                if (domCache.hudAccessCode) domCache.hudAccessCode.classList.add("hidden");
            }

        // Actualización optimizada del Sidebar
        domCache.missionTracker.innerHTML = `
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--primary-color); margin-bottom: 2px;">${mis.titulo}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.3; margin-bottom: 10px;">${mis.descripcion}</div>
            <ul style="list-style: none; padding: 0; margin: 10px 0; font-size: 0.8rem;">
                ${objectivesStatus.map(obj => `
                    <li style="color: ${obj.completed ? 'var(--success-color)' : 'var(--text-muted)'}; text-decoration: ${obj.completed && !obj.html ? 'line-through' : 'none'}; margin-bottom: 5px;">
                        ${obj.completed ? '✅' : '⬜'} ${obj.html ? obj.html : obj.text}
                    </li>
                `).join('')}
            </ul>
            <div class="hud-bar-container" style="height: 6px; margin: 0;">
                <div class="hud-bar-fill" style="width: ${totalObjectives > 0 ? (completedObjectives / totalObjectives) * 100 : 0}%; background: var(--accent-color);"></div>
            </div> 
        `;
        }
    }

    // Barras HUD
    const bPct = (jugador.bateria / jugador.bateriaMax) * 100;
    if (domCache.batteryBarHud) domCache.batteryBarHud.style.width = bPct + "%";
    if (domCache.batteryVal) domCache.batteryVal.innerText = Math.floor(bPct) + "%";
    
    const sPct = (jugador.stamina / jugador.staminaMax) * 100;
    if (domCache.staminaBarHud) domCache.staminaBarHud.style.width = sPct + "%";
    if (domCache.staminaVal) domCache.staminaVal.innerText = Math.floor(sPct) + "%";

    if (domCache.codeFragmentsDisplay) domCache.codeFragmentsDisplay.innerText = codeFragments;

    if (domCache.cooldownR) domCache.cooldownR.style.display = jugador.cooldowns.r > 0 ? 'block' : 'none';
    if (domCache.cooldownE) domCache.cooldownE.style.display = jugador.cooldowns.e > 0 ? 'block' : 'none';
    
    if (domCache.livesDisplay) {
        domCache.livesDisplay.innerHTML = Array(jugador.vidasMax).fill(0).map((_, i) => 
            `<div style="width:12px; height:12px; margin-right:5px; display:inline-block; background:${i < jugador.vidas ? '#facc15' : '#262626'}; border-radius:2px;"></div>`
        ).join('');
    }
}

function getMissionProgress() {
    const mis = misiones[misionActivaIndex];
    if (!mis || !mis.objetivoTotal) return 0;
    return Math.min(Math.round((misionProgreso / mis.objetivoTotal) * 100), 100);
}

// Función para abrir una única pregunta (Desafío o Bonus)
function abrirQuiz(pregunta, esBonus = false) {
    if (!pregunta) return;

    juegoPausado = true;
    const modal = domCache.quizModal;
    const title = domCache.quizTitle;
    const question = domCache.quizQuestion;
    const container = domCache.optionsContainer;
    const feed = domCache.feedback;
    const closeBtn = domCache.closeBtn;

    modal.classList.remove("hidden"); // Use domCache.speechControls
    feed.classList.add("hidden");
    closeBtn.classList.add("hidden");
    container.innerHTML = "";

    title.innerText = esBonus ? "¡INTERCEPCIÓN DETECTADA!" : `DESAFÍO DE MISIÓN: NIVEL ${misionActivaIndex + 1}`;
    question.innerText = pregunta.texto;

    if (domCache.speechControls) domCache.speechControls.classList.remove("hidden");

    // Implementación de Lectura en Voz Alta para Quizzes
    speakText(pregunta.texto);

    pregunta.opciones.forEach((opt, index) => {
        const btn = document.createElement("button");
        btn.className = "btn btn-secondary";
        btn.style.width = "100%";
        btn.style.marginBottom = "10px";
        btn.innerText = opt;
        btn.onclick = () => {
            // Lógica de validación inmediata
            feed.classList.remove("hidden");
            if (index === pregunta.correcta) {
                currentLevelCorrect++;
                questionsCorrectTotal++;
                feed.innerText = "¡CORRECTO! " + (pregunta.recompensa?.item ? "Recibiste: " + pregunta.recompensa.item : "");
                feed.style.background = "#dcfce7";
                feed.style.color = "#15803d";
                score += pregunta.recompensa?.xp || 100;
                crearFloatingText(jugador.x, jugador.y - 50, `+${pregunta.recompensa?.xp || 100} PTS`, "#4ade80");
                if (pregunta.recompensa?.item) jugador.inventory.push({ type: pregunta.recompensa.item });
                play8BitSound('success');
            } else {
                questionsWrongTotal++;
                feed.innerText = "ERROR. Penalización aplicada.";
                feed.style.background = "#fee2e2";
                feed.style.color = "#b91c1c";
                jugador.vidas -= (pregunta.castigo?.vida || 1);
                crearFloatingText(jugador.x, jugador.y - 50, `-${pregunta.castigo?.vida || 1} VIDA`, "#ef4444");
                score += (pregunta.castigo?.xp || 0);
                if (jugador.vidas <= 0) {
                    modal.classList.add("hidden"); // Use domCache.speechControls
                    mostrarGameOver();
                    return;
                }
                // Registrar error en el historial académico
                registroErrores.push({ nivel: misionActivaIndex + 1, pregunta: pregunta.texto });
            }
            
            // Configurar cierre único
            closeBtn.classList.remove("hidden");
            closeBtn.innerText = "CONTINUAR OPERACIÓN";
            closeBtn.onclick = () => {
                finalizarQuizUnico(esBonus);
            };
        };
        container.appendChild(btn);
    });
}

function finalizarQuizUnico(esBonus) {
    domCache.quizModal.classList.add("hidden");
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    domCache.speechControls.classList.add("hidden");
    // juegoPausado will be set to false by iniciarCuentaRegresiva or directly for bonus quizzes

    // Limpiar cualquier efecto visual de daño persistente si el jugador no ha muerto
    if (jugador.vidas > 0) {
        damageFlash = 0;
        screenShake = 0;
    }

    // If it's a bonus quiz, the game needs to be unpaused immediately.
    if (!esBonus) {
        const aciertosNivel = currentLevelCorrect;
        const erroresNivel = 7 - aciertosNivel; // Basado en el estándar de 7 preguntas por nivel

        statsPorNivel.push({
            nivel: misionActivaIndex + 1,
            correctas: aciertosNivel
        });

        // Enviamos el puntaje del nivel actual ANTES de incrementar el índice de misión
        enviarPuntajeAlServidor(aciertosNivel, erroresNivel);
        currentLevelCorrect = 0;

        misionActivaIndex++;
        lanzarConfeti();
        play8BitSound('success');

        if (misionActivaIndex >= 5) {
            guardarProgreso();
            mostrarReporteFinal();
            return;
        }

        if (typeof misiones !== 'undefined' && misiones[misionActivaIndex]) {
            const proximaMision = misiones[misionActivaIndex];
            // SIEMPRE cargar el nivel para resetear estados, limpiar items antiguos y spawnear nuevos
            dimensionActual = proximaMision.dimension;
            cargarNivel(dimensionActual, iniciarCuentaRegresiva);
            if (domCache.levelDisplay) domCache.levelDisplay.innerText = dimensionActual;
        }
        guardarProgreso();
    } else {
        juegoPausado = false; // Unpause the game for bonus quizzes
    }
}

function mostrarReporteFinal() {
    juegoPausado = true;
    const modal = domCache.quizModal;
    const container = domCache.optionsContainer;
    const qText = domCache.quizQuestion;
    qText.innerText = "REPORTE ACADÉMICO - SEGURIDAD INFORMÁTICA";
    const ptsMateria = (questionsCorrectTotal * 0.10).toFixed(2);
    let html = `
        <div class="report-header-info">
            <span>ESTUDIANTE: <b>${(localStorage.getItem('username') || 'AGENTE').toUpperCase()}</b></span>
            <span>NOTA FINAL: <b style="color:var(--primary-color)">${ptsMateria} / 3.50</b></span>
        </div>
        <table class="report-table">
            <thead><tr><th>NIVEL</th><th>ACIERTOS</th><th>PUNTOS</th></tr></thead>
            <tbody>`;
    statsPorNivel.forEach(s => {
        html += `<tr><td>Nivel ${s.nivel}</td><td>${s.correctas}/7</td><td>${(s.correctas * 0.10).toFixed(2)}</td></tr>`;
    });
    html += `</tbody></table>`;
    if (registroErrores.length > 0) {
        html += `<h4 style="margin-top:15px; color:#f87171">VULNERABILIDADES (ERRORES):</h4>`;
        registroErrores.forEach(e => {
            html += `<div class="error-detail"><b>Nivel ${e.nivel}:</b> ${e.pregunta}</div>`;
        });
    }
    container.innerHTML = html;
    const pdfBtn = document.createElement("button");
    pdfBtn.className = "btn btn-secondary";
    pdfBtn.style.width = "100%";
    pdfBtn.style.marginTop = "15px";
    pdfBtn.style.backgroundColor = "var(--success-color)";
    pdfBtn.style.color = "black";
    pdfBtn.innerText = "📥 EXPORTAR REPORTE A PDF";
    pdfBtn.onclick = () => {
        const element = document.getElementById('options-container');
        const opt = {
            margin: 0.5,
            filename: `Reporte_Seguridad_Informatica_${localStorage.getItem('username') || 'Agente'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, backgroundColor: '#0a0a0a', useCORS: true },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save(); // Use domCache.closeBtn
    };
    container.appendChild(pdfBtn);
    modal.classList.remove("hidden");
    const closeBtn = domCache.closeBtn;
    closeBtn.classList.remove("hidden");
    closeBtn.innerText = "ENVIAR INFORME AL PROFESOR";
    closeBtn.onclick = () => window.location.href = "student_dashboard.html"; // Use domCache.quizModal
}

function iniciarCombateConsola(tipo, callbackExito) {
    consolaActiva = true;
    juegoPausado = true;
    hackTimer = 15;
    const pool = comandoPools[tipo] || comandoPools.network;
    const comandoRequerido = pool[Math.floor(Math.random() * pool.length)];
    let promptText = `<p>> REQUERIDO: <span style="color:#fff; font-weight:bold;">${comandoRequerido}</span></p>`; // Use domCache.optionsContainer
    const expectedInput = tipo === "firewall" ? `deny ${comandoRequerido}` : comandoRequerido; // Use domCache.quizModal
    if (domCache.quizModal) domCache.quizModal.classList.remove("hidden");
    if (domCache.optionsContainer) domCache.optionsContainer.innerHTML = `
        <div id="hacker-console" style="display:block;">
            <div id="hack-timer" style="color: #f00; font-weight: bold;">TIEMPO: ${hackTimer}s</div>
            ${promptText}
            <span>root@cyber_explorer:~$ </span>
            <input type="text" id="console-input" autofocus style="background:transparent; border:none; color:#0f0; outline:none; width:60%;">
        </div>`;
    const input = document.getElementById("console-input"); // Must be retrieved dynamically as it's created in innerHTML
    setTimeout(() => input.focus(), 10);
    hackTimerInterval = setInterval(() => {
        hackTimer--;
        const td = document.getElementById("hack-timer"); // Must be retrieved dynamically as it's created in innerHTML
        if (td) td.innerText = `TIEMPO: ${hackTimer}s`; // Use domCache.quizModal
        if (hackTimer <= 0) {
            clearInterval(hackTimerInterval);
            if (domCache.quizModal) domCache.quizModal.classList.add("hidden");
            consolaActiva = false; juegoPausado = false;
            jugador.vidas--;
            if (jugador.vidas <= 0) mostrarGameOver();
        }
    }, 1000);
    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            clearInterval(hackTimerInterval);
            if (input.value.trim() === expectedInput) {
                callbackExito();
                if (domCache.quizModal) domCache.quizModal.classList.add("hidden");
                consolaActiva = false; juegoPausado = false;
                play8BitSound('success');
            } else {
                jugador.vidas--;
                input.value = "";
            }
        }
    });
}

function toggleChat() {
    if (domCache.chatPanel) domCache.chatPanel.classList.toggle('minimized');
}

function toggleFullscreen() {
    const container = domCache.gameContainer;
    if (container) {
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => console.log(err));
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }
}

/**
 * Function to show the game manual/tutorial.
 * Defined as a hoisted function to prevent ReferenceErrors when called from other parts of the script.
 */
function mostrarManual() {
    if (typeof gameLore === 'undefined') return;
    juegoPausado = true;
    currentTutorialStep = 0; // Reset to first step
    updateTutorialUI();
}
window.mostrarManual = mostrarManual;

/**
 * Updates the tutorial modal UI with the current step's content.
 * Uses the CSS components defined in style.css.
 */
function updateTutorialUI() {
    const step = gameLore.steps[currentTutorialStep];
    const modal = domCache.quizModal;
    if (!modal) return;
    
    modal.classList.remove("hidden");
    
    if (domCache.quizTitle) domCache.quizTitle.innerText = `TUTORIAL: ${step.title}`;
    
    let visualElementHtml = '';
    if (step.image === "keyboard-arrows") {
        visualElementHtml = `
            <div class="keyboard-arrows">
                <div class="key-row"><div class="key">↑</div></div>
                <div class="key-row"><div class="key">←</div><div class="key">↓</div><div class="key">→</div></div>
            </div>`;
    } else if (step.image === "player-card") {
        visualElementHtml = `
            <div class="player-card">
                <div class="player-head"></div><div class="player-body"></div><div class="player-legs"></div>
            </div>`;
    } else if (step.image === "sword-icon") {
        visualElementHtml = `<div class="sword-icon"></div><div class="collectible-counter">Espadas: 0/10</div>`;
    } else if (step.image === "collectible-icon") {
        visualElementHtml = `<div class="collectible-icon"></div><div class="collectible-counter">Objetivos: 0/X</div>`;
    } else if (step.image === "powerup-icon") {
        visualElementHtml = `
            <div class="powerup-icon">
                <div class="powerup-cross-h"></div><div class="powerup-cross-v"></div>
            </div>`;
    } else if (step.image === "enemy-icon") {
        visualElementHtml = `
            <div class="enemy-icon"><div class="enemy-eye"></div></div>
            <div class="enemy-warning-text">¡PELIGRO!</div>`;
    } else if (step.image === "portal-icon") {
        visualElementHtml = `<div class="portal-effect"></div><div class="portal-interaction-text">Presiona [E]</div>`;
    } else if (step.image.startsWith("assets/")) {
        visualElementHtml = `<img src="${step.image}" style="height:80px; margin-bottom: 20px;">`;
    } else {
        visualElementHtml = `<div style="font-size: 5rem; margin-bottom: 20px;">${step.image}</div>`;
    }

    if (domCache.quizQuestion) {
        domCache.quizQuestion.innerHTML = `<div style="text-align: center; padding: 20px;">${visualElementHtml}<p style="font-size: 1.2rem; line-height: 1.6; color: var(--text-main);">${step.text}</p></div>`;
    }
    
    if (domCache.optionsContainer) domCache.optionsContainer.innerHTML = ""; 
    speakText(step.voice || step.text);

    if (domCache.closeBtn) {
        domCache.closeBtn.classList.remove("hidden");
        domCache.closeBtn.style.display = "block";
        
        if (currentTutorialStep < gameLore.steps.length - 1) {
            domCache.closeBtn.innerText = "SIGUIENTE PASO ➔";
            domCache.closeBtn.onclick = () => { currentTutorialStep++; updateTutorialUI(); };
        } else {
            domCache.closeBtn.innerText = "INICIAR MISIÓN";
            domCache.closeBtn.onclick = () => {
                modal.classList.add("hidden");
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                if (domCache.speechControls) domCache.speechControls.classList.add("hidden");
                iniciarCuentaRegresiva();
            };
        }
    }
}
