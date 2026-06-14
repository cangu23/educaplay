// lore.js
// Contiene el manual de instrucciones y el lore del juego.

const gameLore = {
    titulo: "CYBER EXPLORER: PROTOCOLO DE CONTENCIÓN",
    steps: [
        {
            title: "BIENVENIDO AGENTE",
            image: "assets/logo.png",
            text: "El Sistema Operativo Global está bajo ataque. Tu misión es purgar el malware y restaurar el sistema.",
            voice: "Bienvenido Agente. El sistema está bajo ataque. Debes restaurar la integridad del núcleo."
        },
        {
            title: "CONTROLES DE MOVIMIENTO",
            image: "keyboard-arrows", // Usaremos una clase CSS para esto
            text: "Usa las flechas ↑ ↓ ← → o las teclas W A S D para desplazarte por el ciberespacio.",
            voice: "Usa las teclas de dirección para moverte."
        },
        {
            title: "TU AGENTE",
            image: "player-card", // Clase CSS para el personaje
            text: "Este es tu personaje. Completa desafíos, supera obstáculos y progresa a través de los niveles.",
            voice: "Este es tu agente. Completa desafíos y progresa."
        },
        {
            title: "COMBATE Y ACCIÓN",
            image: "sword-icon", // Clase CSS para la espada
            text: "Presiona [ESPACIO] para usar tu espada y [X] para disparar energía. Mantén tu batería cargada.",
            voice: "Ataca con espacio y dispara con la tecla equis. Vigila tu energía."
        },
        {
            title: "RECOLECTA OBJETIVOS",
            image: "collectible-icon", // Clase CSS para un coleccionable genérico
            text: "Busca fragmentos, llaves y datos. El contador en el panel lateral te dirá cuánto falta. ¡Recógelos para avanzar!",
            voice: "Recolecta todos los objetivos para completar la misión. El contador te guiará."
        },
        {
            title: "POWER-UPS",
            image: "powerup-icon", // Clase CSS para un power-up
            text: "Estos son power-ups. Te ayudarán a recuperar salud o mejorar tus habilidades. ¡Úsalos sabiamente!",
            voice: "Estos son power-ups. Te ayudarán a recuperar salud o mejorar tus habilidades."
        },
        {
            title: "ENEMIGOS",
            image: "enemy-icon", // Clase CSS para un enemigo
            text: "Ten cuidado. Los enemigos pueden dañarte y reducir tu salud. ¡Evítalos o elimínalos!",
            voice: "Cuidado con los enemigos. Pueden dañarte."
        },
        {
            title: "EL PORTAL",
            image: "portal-icon", // Clase CSS para el portal
            text: "Después de completar todos los objetivos, busca el portal y presiona [E] para avanzar al siguiente nivel.",
            voice: "Busca el portal cuando termines tus objetivos y presiona E para entrar al siguiente nivel."
        }
    ]
};