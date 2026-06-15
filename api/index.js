require('dotenv').config();
const express = require('express');
const { createClient } = require('@libsql/client');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
app.use(express.json({ limit: '5mb' })); // Soporte para imágenes pesadas en Base64
app.use(cors());
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Secreto para JWT (En producción usar una variable de entorno JWT_SECRET)
const JWT_SECRET = process.env.JWT_SECRET || 'eduplay_ultra_secret_2024';

// Servir archivos estáticos (Necesario para local y como respaldo en Vercel)
app.use(express.static(path.join(__dirname, '../public')));

// Inicialización segura de la base de datos
let db;
try {
  const url = process.env.TURSO_URL;
  const token = process.env.TURSO_TOKEN;

  if (!url || !token) {
    console.error("CRITICAL: Missing Turso configuration. URL present:", !!url, "Token present:", !!token);
  } else {
    db = createClient({
      url: url,
      authToken: token,
    });
  }
} catch (err) {
  console.error("Error al configurar el cliente de Turso:", err.message);
}

// Middleware para restringir por rol (Asegurando consistencia)
const authorizeRole = (role) => {
  return (req, res, next) => {
    if (req.user && req.user.rol === role) next();
    else res.status(403).json({ error: 'Acceso denegado: Permisos insuficientes.' });
  };
};

// Middleware para verificar el Token JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN"

  if (!token) return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado.' });
    req.user = user;
    next();
  });
};

// Inicialización de tablas (Ejecución controlada)
async function initDB() {
  if (!db) return;
  try {
    // Creamos las tablas con la estructura definitiva y limpia
    await db.batch([
      `CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, rol TEXT, cedula TEXT UNIQUE, avatar TEXT DEFAULT 'agente_1', descripcion TEXT DEFAULT 'Explorador del ciberespacio.')`,
      `CREATE TABLE IF NOT EXISTS salas (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo_unico TEXT UNIQUE, docente_id INTEGER, duracion_minutos INTEGER, capacidad_max INTEGER, game_url TEXT DEFAULT 'local', activa INTEGER DEFAULT 1, fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS participantes_sala (id INTEGER PRIMARY KEY AUTOINCREMENT, sala_id INTEGER, estudiante_id INTEGER, UNIQUE(sala_id, estudiante_id))`,
      `CREATE TABLE IF NOT EXISTS progreso_estudiante (id INTEGER PRIMARY KEY AUTOINCREMENT, estudiante_id INTEGER, nivel_id INTEGER, score INTEGER DEFAULT 0, aciertos INTEGER DEFAULT 0, errores INTEGER DEFAULT 0, fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(estudiante_id, nivel_id))`,
      `CREATE TABLE IF NOT EXISTS chat_mensajes (id INTEGER PRIMARY KEY AUTOINCREMENT, sala_id INTEGER, username TEXT, mensaje TEXT, fecha DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS friends (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id1 INTEGER, user_id2 INTEGER, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id1, user_id2))`,
      `CREATE TABLE IF NOT EXISTS help_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER, teacher_id INTEGER, points_requested INTEGER, grade_points_equivalent REAL, status TEXT DEFAULT 'pending', request_date DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS posiciones_jugadores (usuario_id INTEGER PRIMARY KEY, sala_id TEXT, x REAL, y REAL, color TEXT, username TEXT, last_update DATETIME DEFAULT CURRENT_TIMESTAMP)`
    ]);

    // Población de datos DEMO (Solo se insertan si no existen)
    const demoUsers = [
      { u: 'profe_demo', p: 'demo123', r: 'profesor', c: '12345678' },
      { u: 'alumno_demo', p: 'demo123', r: 'estudiante', c: '87654321' }
    ];

    for (const user of demoUsers) {
      const hashed = await bcrypt.hash(user.p, 10);
      await db.execute({
        sql: "INSERT OR IGNORE INTO usuarios (username, password, rol, cedula) VALUES (?, ?, ?, ?)",
        args: [user.u, hashed, user.r, user.c]
      });
    }

    // Migración automática: Intentar agregar columnas si la tabla ya existía sin ellas
    try { await db.execute("ALTER TABLE progreso_estudiante ADD COLUMN aciertos INTEGER DEFAULT 0"); } catch (e) { /* Ya existe */ }
    try { await db.execute("ALTER TABLE progreso_estudiante ADD COLUMN errores INTEGER DEFAULT 0"); } catch (e) { /* Ya existe */ }

    console.log("Base de datos inicializada: Tablas creadas y cuentas demo listas.");
  } catch (e) {
    console.error("Fallo al inicializar tablas:", e.message);
  }
}

// Llamamos a initDB pero no bloqueamos el hilo principal
initDB().catch(console.error);

// --- MANEJO DE RUTAS ---

// Evitar error 500 por favicon.ico
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Ruta raíz para evitar el 404 al entrar al sitio
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '../public/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Frontend no encontrado. Verifique la estructura del proyecto.");
  }
});

// Usaremos un Router para manejar el prefijo /api de forma flexible
const apiRouter = express.Router();

// Salud/Check de la API
apiRouter.get('/', (req, res) => res.json({ message: "Eduplay API is online" }));

// Middleware para verificar DB en todas las rutas de la API
apiRouter.use((req, res, next) => {
  if (!db) {
    return res.status(503).json({ error: 'Servicio de base de datos no disponible temporalmente.' });
  }
  next();
});

// --- GESTIÓN DE SALAS ---
apiRouter.post('/salas/crear', authenticateToken, authorizeRole('profesor'), async (req, res) => {
  try {
    const { docente_id, duracion, capacidad, game_url } = req.body;
    const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
    await db.execute({
      sql: 'INSERT INTO salas (codigo_unico, docente_id, duracion_minutos, capacidad_max, game_url) VALUES (?, ?, ?, ?, ?)',
      args: [codigo, docente_id, duracion, capacidad, game_url]
    });
    res.json({ status: 'success', codigo });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo crear la sala: ' + e.message });
  }
});

// --- RUTAS PROTEGIDAS (Ejemplos) ---
// Podrías aplicar el middleware a rutas específicas o a todo el router excepto auth
apiRouter.get('/docente/resumen-global/:id', authenticateToken, authorizeRole('profesor'), async (req, res) => {
    // SEGURIDAD: Validar que el profesor solo acceda a su propio ID
    if (req.user.id != req.params.id) {
        return res.status(403).json({ error: 'No tienes permiso para ver este resumen.' });
    }
    try {
        const totalSalas = await db.execute({ sql: "SELECT COUNT(*) as count FROM salas WHERE docente_id = ?", args: [req.params.id] });
        
        const totalEstudiantes = await db.execute({ 
          sql: "SELECT COUNT(DISTINCT estudiante_id) as count FROM participantes_sala ps JOIN salas s ON ps.sala_id = s.id WHERE s.docente_id = ?", 
          args: [req.params.id] 
        });
        
        const promedioGeneral = await db.execute({ 
          sql: "SELECT AVG(score) as avg FROM progreso_estudiante pe JOIN usuarios u ON pe.estudiante_id = u.id JOIN participantes_sala ps ON u.id = ps.estudiante_id JOIN salas s ON ps.sala_id = s.id WHERE s.docente_id = ?", 
          args: [req.params.id] 
        });

        const metricasCiber = await db.execute({
          sql: `SELECT SUM(p.aciertos) as total_a, SUM(p.errores) as total_e 
                FROM progreso_estudiante p 
                JOIN participantes_sala ps ON p.estudiante_id = ps.estudiante_id 
                JOIN salas s ON ps.sala_id = s.id 
                WHERE s.docente_id = ?`,
          args: [req.params.id]
        });

        const solicitudesP = await db.execute({
          sql: "SELECT COUNT(*) as count FROM help_requests WHERE teacher_id = ? AND status = 'pending'",
          args: [req.params.id]
        });

        res.json({
          salas_activas: totalSalas.rows[0].count,
          estudiantes_totales: totalEstudiantes.rows[0].count,
          rendimiento_promedio: Math.round(promedioGeneral.rows[0].avg || 0),
          total_aciertos: metricasCiber.rows[0].total_a || 0,
          total_errores: metricasCiber.rows[0].total_e || 0,
          ayudas_pendientes: solicitudesP.rows[0].count || 0
        });
    } catch (e) {
        res.status(500).json({ error: 'Error al generar resumen global' });
    }
});

// --- NUEVO: MONITOREO EN VIVO (GOD MODE) ---
// Permite al profesor ver el estado real de todos los alumnos en una sala específica
apiRouter.get('/docente/sala-live/:salaId', authenticateToken, authorizeRole('profesor'), async (req, res) => {
    try {
        // Verificamos que la sala pertenezca al docente
        const checkSala = await db.execute({
            sql: "SELECT id FROM salas WHERE id = ? AND docente_id = ?",
            args: [req.params.salaId, req.user.id]
        });

        if (checkSala.rows.length === 0) return res.status(403).json({ error: "No autorizado." });

        const result = await db.execute({
            sql: `SELECT u.username, u.id, p.x, p.y, p.color, 
                         COALESCE(SUM(pr.score), 0) as current_score,
                         MAX(pr.fecha_actualizacion) as last_action
                  FROM participantes_sala ps
                  JOIN usuarios u ON ps.estudiante_id = u.id
                  LEFT JOIN posiciones_jugadores p ON u.id = p.usuario_id
                  LEFT JOIN progreso_estudiante pr ON u.id = pr.estudiante_id
                  WHERE ps.sala_id = ?
                  GROUP BY u.id`,
            args: [req.params.salaId]
        });
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: "Error en monitoreo live: " + e.message });
    }
});

// --- NUEVO: SISTEMA DE RECOMPENSAS (BOOST) ---
// Permite al profesor dar un "empujón" de puntos o vida a un alumno en apuros
apiRouter.post('/docente/intervenir-alumno', authenticateToken, authorizeRole('profesor'), async (req, res) => {
    const { estudiante_id, tipo, valor } = req.body; // tipo: 'score' | 'lives'
    try {
        if (tipo === 'score') {
            await db.execute({
                sql: `UPDATE progreso_estudiante SET score = score + ? 
                      WHERE estudiante_id = ? AND nivel_id = (SELECT MAX(nivel_id) FROM progreso_estudiante WHERE estudiante_id = ?)`,
                args: [valor, estudiante_id, estudiante_id]
            });
        }
        
        // Enviamos notificación al chat de la sala para que el alumno lo vea
        await db.execute({
            sql: 'INSERT INTO chat_mensajes (sala_id, username, mensaje) VALUES ((SELECT sala_id FROM participantes_sala WHERE estudiante_id = ? LIMIT 1), ?, ?)',
            args: [estudiante_id, '🎁 SISTEMA', `El profesor ha enviado un bono de ${tipo === 'score' ? valor + ' puntos' : 'vitalidad'}.`]
        });
        
        res.json({ status: 'success', message: 'Intervención realizada con éxito.' });
    } catch (e) {
        res.status(500).json({ error: "Fallo al intervenir: " + e.message });
    }
});

// --- NUEVO: EXPORTACIÓN DE RESULTADOS (CSV READY) ---
apiRouter.get('/docente/exportar-datos/:salaId', authenticateToken, authorizeRole('profesor'), async (req, res) => {
    try {
        const result = await db.execute({
            sql: `SELECT 
                    u.cedula, u.username, 
                    SUM(p.score) as puntaje_total, 
                    SUM(p.aciertos) as total_aciertos, 
                    SUM(p.errores) as total_errores,
                    MAX(p.fecha_actualizacion) as completado_en
                  FROM participantes_sala ps
                  JOIN usuarios u ON ps.estudiante_id = u.id
                  LEFT JOIN progreso_estudiante p ON u.id = p.estudiante_id
                  WHERE ps.sala_id = ?
                  GROUP BY u.id`,
            args: [req.params.salaId]
        });

        // Preparar formato CSV simple
        let csv = "Cedula,Usuario,Puntaje,Aciertos,Errores,Fecha\n";
        result.rows.forEach(r => {
            csv += `${r.cedula},${r.username},${r.puntaje_total},${r.total_aciertos},${r.total_errores},${r.completado_en}\n`;
        });

        res.header('Content-Type', 'text/csv');
        res.attachment(`reporte_sala_${req.params.salaId}.csv`);
        res.send(csv);
    } catch (e) {
        res.status(500).json({ error: "Error al exportar: " + e.message });
    }
});

// --- NUEVO: BROADCAST (Mensajes del profesor a toda la sala) ---
apiRouter.post('/docente/broadcast', authenticateToken, authorizeRole('profesor'), async (req, res) => {
    const { sala_id, mensaje } = req.body;
    try {
        await db.execute({
            sql: 'INSERT INTO chat_mensajes (sala_id, username, mensaje) VALUES (?, ?, ?)',
            args: [sala_id, '🔔 SISTEMA (PROFESOR)', mensaje]
        });
        res.json({ status: 'success', message: 'Mensaje global enviado.' });
    } catch (e) {
        res.status(500).json({ error: 'Error al enviar broadcast.' });
    }
});

// --- NUEVO: MODERACIÓN DE CHAT ---
apiRouter.post('/docente/limpiar-chat', authenticateToken, authorizeRole('profesor'), async (req, res) => {
    const { sala_id } = req.body;
    try {
        await db.execute({
            sql: 'DELETE FROM chat_mensajes WHERE sala_id = ?',
            args: [sala_id]
        });
        await db.execute({
            sql: 'INSERT INTO chat_mensajes (sala_id, username, mensaje) VALUES (?, ?, ?)',
            args: [sala_id, '🛡️ MODERACIÓN', 'El historial de chat ha sido reiniciado por el profesor.']
        });
        res.json({ status: 'success' });
    } catch (e) {
        res.status(500).json({ error: 'No se pudo limpiar el chat.' });
    }
});

apiRouter.post('/auth/register', async (req, res) => {
  const { username, password, rol, cedula } = req.body;

  // Validación de campos obligatorios
  if (!username || !password || !rol || !cedula) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: Usuario, Contraseña, Rol y Cédula' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.execute({
      sql: 'INSERT INTO usuarios (username, password, rol, cedula) VALUES (?, ?, ?, ?)',
      args: [username, hashedPassword, rol, cedula]
    });
    res.json({ status: 'success' });
  } catch (e) {
    console.error("Error en registro:", e.message);
    
    if (e.message.includes("UNIQUE constraint failed")) {
        return res.status(400).json({ error: 'El nombre de usuario o la cédula ya están en uso.' });
    }
    
    res.status(500).json({ error: 'Error interno al guardar en la base de datos: ' + e.message });
  }
});

apiRouter.post('/auth/recover-password', async (req, res) => {
  const { username, cedula, newPassword } = req.body;
  if (!username || !cedula || !newPassword) {
    return res.status(400).json({ error: 'Faltan datos para la recuperación' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await db.execute({
      sql: 'UPDATE usuarios SET password = ? WHERE username = ? AND cedula = ?',
      args: [hashedPassword, username, cedula]
    });
    
    if (result.rowsAffected > 0) res.json({ status: 'success', message: 'Contraseña actualizada correctamente' });
    else res.status(404).json({ error: 'Datos no coinciden' });
  } catch (e) { 
    console.error(e);
    res.status(500).json({ error: 'Error al recuperar cuenta' }); 
  }
});

apiRouter.post('/auth/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Usuario o Cédula y contraseña requeridos' });
  }

  try {
    const result = await db.execute({ sql: 'SELECT * FROM usuarios WHERE username = ? OR cedula = ?', args: [identifier, identifier] });
    const user = result.rows[0];
    if (user && await bcrypt.compare(password, user.password)) {
      // Generar Token de Sesión Real
      const token = jwt.sign(
        { id: user.id, username: user.username, rol: user.rol },
        JWT_SECRET, { expiresIn: '8h' });
      res.json({ status: 'success', token, user: { id: user.id, username: user.username, rol: user.rol } });
    } else { res.status(401).json({ error: 'Credenciales inválidas' }); }
  } catch (e) {
    console.error("Error en login:", e.message);
    res.status(500).json({ error: 'Error interno en el servidor: ' + e.message });
  }
});

// --- RANKING GLOBAL ---
apiRouter.get('/ranking', async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT u.username, u.avatar, SUM(p.score) as total_score 
            FROM usuarios u 
            JOIN progreso_estudiante p ON u.id = p.estudiante_id 
            WHERE u.rol = 'estudiante' 
            GROUP BY u.id 
            ORDER BY total_score DESC 
            LIMIT 5`,
      args: []
    });
    res.json(result.rows);
  } catch (e) {
    console.error("Error en ranking:", e.message);
    res.status(500).json({ error: 'Error al obtener ranking global' });
  }
});

// --- PERFIL DE USUARIO ---
apiRouter.get('/user/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT id, username, rol, avatar, descripcion FROM usuarios WHERE id = ?', args: [req.params.id] });
    const stats = await db.execute({ sql: 'SELECT SUM(score) as total FROM progreso_estudiante WHERE estudiante_id = ?', args: [req.params.id] });
    res.json({ ...result.rows[0], total_score: stats.rows[0]?.total || 0 });
  } catch (e) { console.error("Error al obtener perfil de usuario:", e.message); res.status(500).json({ error: e.message }); }
});

apiRouter.post('/user/update', authenticateToken, async (req, res) => {
  const { avatar, descripcion } = req.body;
  const userId = req.user.id; // SEGURIDAD: Solo se actualiza el perfil del dueño del token
  try {
    await db.execute({ sql: 'UPDATE usuarios SET avatar = ?, descripcion = ? WHERE id = ?', args: [avatar, descripcion, userId] });
    res.json({ status: 'success', message: 'Protocolo de identidad actualizado.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/user/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;
  try {
    const result = await db.execute({ sql: 'SELECT password FROM usuarios WHERE id = ?', args: [userId] });
    const user = result.rows[0];
    
    if (user && await bcrypt.compare(currentPassword, user.password)) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.execute({ sql: 'UPDATE usuarios SET password = ? WHERE id = ?', args: [hashedPassword, userId] });
      res.json({ status: 'success', message: 'Contraseña actualizada con éxito.' });
    } else {
      res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Error al cambiar contraseña: ' + e.message });
  }
});

// --- BÚSQUEDA DE USUARIOS ---
apiRouter.get('/users/search', authenticateToken, async (req, res) => {
  const { q, viewerId } = req.query;
  if (!q || q.length < 2) return res.json([]);
  try {
    const sql = viewerId ? 
      `SELECT u.id, u.username, u.rol, u.avatar, f.status AS friendship_status, f.user_id1 AS sender_id 
       FROM usuarios u 
       LEFT JOIN friends f ON (f.user_id1 = ? AND f.user_id2 = u.id) OR (f.user_id1 = u.id AND f.user_id2 = ?)
       WHERE u.username LIKE ? AND u.id != ? LIMIT 10` :
      "SELECT id, username, rol, avatar FROM usuarios WHERE username LIKE ? LIMIT 10";
    const args = viewerId ? [viewerId, viewerId, `%${q}%`, viewerId] : [`%${q}%`];
    const result = await db.execute({
      sql, args
    });
    res.json(result.rows);
  } catch (e) { console.error("Error en búsqueda de usuarios:", e.message); res.status(500).json({ error: e.message }); }
});

// --- CHAT ---
apiRouter.get('/chat/:salaId', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM chat_mensajes WHERE sala_id = ? ORDER BY fecha DESC LIMIT 50', args: [req.params.salaId] });
    res.json(result.rows.reverse());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/chat/send', authenticateToken, async (req, res) => {
  const { sala_id, username, mensaje } = req.body;
  try {
    await db.execute({ sql: 'INSERT INTO chat_mensajes (sala_id, username, mensaje) VALUES (?, ?, ?)', args: [sala_id, username, mensaje] });
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- AMISTADES ---
apiRouter.post('/friends/request', authenticateToken, async (req, res) => {
  const { sender_id, receiver_id } = req.body;
  if (sender_id === receiver_id) return res.status(400).json({ error: 'No puedes enviarte una solicitud a ti mismo.' });
  try {
    // Verificar si ya existe una solicitud o amistad
    const existing = await db.execute({
      sql: `SELECT * FROM friends WHERE 
            (user_id1 = ? AND user_id2 = ?) OR 
            (user_id1 = ? AND user_id2 = ?)`,
      args: [sender_id, receiver_id, receiver_id, sender_id]
    });
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe una solicitud o amistad con este usuario.' });
    }

    await db.execute({
      sql: 'INSERT INTO friends (user_id1, user_id2, status) VALUES (?, ?, ?)',
      args: [sender_id, receiver_id, 'pending']
    });
    res.json({ status: 'success', message: 'Solicitud de amistad enviada.' });
  } catch (e) { console.error("Error al enviar solicitud de amistad:", e.message); res.status(500).json({ error: e.message }); }
});

apiRouter.post('/friends/accept', authenticateToken, async (req, res) => {
  const { request_id } = req.body;
  try {
    const result = await db.execute({
      sql: 'UPDATE friends SET status = ? WHERE id = ? AND status = ?',
      args: ['accepted', request_id, 'pending']
    });
    if (result.rowsAffected > 0) {
      res.json({ status: 'success', message: 'Solicitud de amistad aceptada.' });
    } else {
      res.status(404).json({ error: 'Solicitud no encontrada o ya procesada.' });
    }
  } catch (e) { console.error("Error al aceptar solicitud de amistad:", e.message); res.status(500).json({ error: e.message }); }
});

apiRouter.get('/friends/pending/:userId', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT f.id, u.username as sender_username, u.id as sender_id 
            FROM friends f JOIN usuarios u ON f.user_id1 = u.id 
            WHERE f.user_id2 = ? AND f.status = 'pending'`,
      args: [req.params.userId]
    });
    res.json(result.rows);
  } catch (e) { console.error("Error al obtener solicitudes pendientes:", e.message); res.status(500).json({ error: e.message }); }
});

apiRouter.get('/friends/:userId', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT u.id, u.username, u.avatar, u.descripcion 
            FROM friends f 
            JOIN usuarios u ON (f.user_id1 = u.id AND f.user_id2 = ?) OR (f.user_id2 = u.id AND f.user_id1 = ?)
            WHERE (f.user_id1 = ? OR f.user_id2 = ?) AND f.status = 'accepted' AND u.id != ?`,
      args: [req.params.userId, req.params.userId, req.params.userId, req.params.userId, req.params.userId]
    });
    res.json(result.rows);
  } catch (e) { console.error("Error al obtener lista de amigos:", e.message); res.status(500).json({ error: e.message }); }
});

apiRouter.post('/friends/reject', authenticateToken, async (req, res) => {
  const { request_id } = req.body;
  try {
    await db.execute({
      sql: 'DELETE FROM friends WHERE id = ? AND status = ?',
      args: [request_id, 'pending']
    });
    res.json({ status: 'success', message: 'Solicitud rechazada.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/friends/remove', authenticateToken, async (req, res) => {
  const { user_id1, user_id2 } = req.body;
  try {
    await db.execute({
      sql: 'DELETE FROM friends WHERE (user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?)',
      args: [user_id1, user_id2, user_id2, user_id1]
    });
    res.json({ status: 'success', message: 'Amigo eliminado.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/friends/status/:userId1/:userId2', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM friends WHERE (user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?)',
      args: [req.params.userId1, req.params.userId2, req.params.userId2, req.params.userId1]
    });
    const row = result.rows[0];
    if (!row) return res.json({ status: 'not_friends' });
    if (row.status === 'accepted') return res.json({ status: 'friends' });
    if (row.user_id1 == req.params.userId1) {
      return res.json({ status: 'pending_sent' });
    } else {
      return res.json({ status: 'pending_received', request_id: row.id });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- AYUDA ACADÉMICA ---
apiRouter.post('/help/request', authenticateToken, async (req, res) => {
  const { student_id, teacher_id, points_requested, grade_points_equivalent } = req.body;
  try {
    await db.execute({
      sql: 'INSERT INTO help_requests (student_id, teacher_id, points_requested, grade_points_equivalent) VALUES (?, ?, ?, ?)',
      args: [student_id, teacher_id, points_requested, grade_points_equivalent]
    });
    res.json({ status: 'success', message: 'Solicitud de ayuda enviada.' });
  } catch (e) { console.error("Error al solicitar ayuda:", e.message); res.status(500).json({ error: e.message }); }
});

apiRouter.get('/help/requests/:teacherId', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT hr.id, u.username as student_username, hr.points_requested, hr.grade_points_equivalent, hr.status, hr.request_date FROM help_requests hr JOIN usuarios u ON hr.student_id = u.id WHERE hr.teacher_id = ? ORDER BY hr.request_date DESC', args: [req.params.teacherId] });
    res.json(result.rows);
  } catch (e) { console.error("Error al obtener solicitudes de ayuda para docente:", e.message); res.status(500).json({ error: e.message }); }
});

apiRouter.post('/help/request/status', authenticateToken, async (req, res) => {
  const { request_id, status } = req.body; // status: 'approved' o 'rejected'
  try {
    const result = await db.execute({
      sql: 'UPDATE help_requests SET status = ? WHERE id = ?',
      args: [status, request_id]
    });
    if (result.rowsAffected > 0) {
      return res.json({ status: 'success', message: `Solicitud ${status}.` });
    } else {
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- MULTIJUGADOR (POSICIONES) ---
apiRouter.post('/game/position', authenticateToken, async (req, res) => {
  const { usuario_id, sala_id, x, y, color, username } = req.body;
  try {
    await db.execute({
      sql: `INSERT INTO posiciones_jugadores (usuario_id, sala_id, x, y, color, username, last_update) 
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(usuario_id) DO UPDATE SET x=excluded.x, y=excluded.y, last_update=CURRENT_TIMESTAMP, sala_id=excluded.sala_id`,
      args: [usuario_id, sala_id, x, y, color, username]
    });
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/game/positions/:salaId', authenticateToken, async (req, res) => {
  try {
    // Solo obtenemos jugadores activos en los últimos 30 segundos
    const result = await db.execute({
      sql: "SELECT * FROM posiciones_jugadores WHERE sala_id = ? AND last_update > datetime('now', '-30 seconds')",
      args: [req.params.salaId]
    });
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- NUEVO: TOP ALUMNOS (Ranking del Docente) ---
apiRouter.get('/docente/top-performers/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT u.username, SUM(p.score) as total_score, SUM(p.aciertos) as aciertos
            FROM usuarios u
            JOIN participantes_sala ps ON u.id = ps.estudiante_id
            JOIN salas s ON ps.sala_id = s.id
            JOIN progreso_estudiante p ON u.id = p.estudiante_id
            WHERE s.docente_id = ?
            GROUP BY u.id ORDER BY total_score DESC LIMIT 5`,
      args: [req.params.id]
    });
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener top alumnos' });
  }
});

// --- NUEVO: ALERTAS DE RIESGO (Alumnos con muchos errores o bajo score) ---
apiRouter.get('/docente/alumnos-riesgo/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT u.username, SUM(p.errores) as total_errores, AVG(p.score) as avg_score
            FROM usuarios u
            JOIN participantes_sala ps ON u.id = ps.estudiante_id
            JOIN salas s ON ps.sala_id = s.id
            JOIN progreso_estudiante p ON u.id = p.estudiante_id
            WHERE s.docente_id = ?
            GROUP BY u.id HAVING total_errores > 10 OR avg_score < 500
            ORDER BY total_errores DESC`,
      args: [req.params.id]
    });
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener alumnos en riesgo' });
  }
});

// --- DETALLE DE PROGRESO INDIVIDUAL (PARA EL MODAL DEL PROFESOR) ---
apiRouter.get('/docente/detalle-estudiante/:idEstudiante', authenticateToken, authorizeRole('profesor'), async (req, res) => {
    try {
        // SEGURIDAD: Verificar que el estudiante pertenece a alguna sala del docente que consulta
        const vinculacion = await db.execute({
            sql: `SELECT 1 FROM participantes_sala ps 
                  JOIN salas s ON ps.sala_id = s.id 
                  WHERE ps.estudiante_id = ? AND s.docente_id = ? LIMIT 1`,
            args: [req.params.idEstudiante, req.user.id]
        });

        if (vinculacion.rows.length === 0) {
            return res.status(403).json({ error: "No tienes permiso para auditar a este estudiante." });
        }

        const progreso = await db.execute({
            sql: `SELECT nivel_id, score, aciertos, errores, fecha_actualizacion FROM progreso_estudiante WHERE estudiante_id = ? ORDER BY nivel_id ASC`,
            args: [req.params.idEstudiante]
        });
        res.json(progreso.rows);
    } catch (e) {
        res.status(500).json({ error: 'Error al obtener detalle individual: ' + e.message });
    }
});

// --- NUEVO: ANÁLISIS DETALLADO POR NIVEL ---
// Permite al profesor ver en qué niveles específicos fallan más los estudiantes
apiRouter.get('/docente/analisis-detallado/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT 
              p.nivel_id, 
              AVG(p.score) as avg_score, 
              AVG(p.aciertos) as avg_aciertos, 
              AVG(p.errores) as avg_errores,
              COUNT(DISTINCT p.estudiante_id) as total_estudiantes
            FROM progreso_estudiante p
            JOIN participantes_sala ps ON p.estudiante_id = ps.estudiante_id
            JOIN salas s ON ps.sala_id = s.id
            WHERE s.docente_id = ?
            GROUP BY p.nivel_id
            ORDER BY p.nivel_id ASC`,
      args: [req.params.id]
    });
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al generar análisis detallado: ' + e.message });
  }
});

apiRouter.get('/docente/stats/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT s.id, s.codigo_unico, s.activa, COUNT(ps.estudiante_id) as alumnos, COALESCE(AVG(p.score), 0) as promedio 
            FROM salas s 
            LEFT JOIN participantes_sala ps ON s.id = ps.sala_id
            LEFT JOIN progreso_estudiante p ON ps.estudiante_id = p.estudiante_id
            WHERE s.docente_id = ? GROUP BY s.id ORDER BY s.fecha_creacion DESC`,
      args: [req.params.id]
    });
    
    const stats = result.rows.map(row => ({
      id: row.id,
      codigo_unico: row.codigo_unico,
      activa: row.activa,
      alumnos: row.alumnos,
      promedio: Math.round(row.promedio)
    }));
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

apiRouter.get('/docente/resultados/:id', authenticateToken, async (req, res) => {
  const salaFiltro = req.query.sala;
  let sql = `
    SELECT 
      s.codigo_unico as sala_codigo,
      s.fecha_creacion,
      u.id as alumno_id,
      u.username as alumno_nombre, 
      COALESCE(MAX(p.nivel_id), 0) as max_nivel_id, 
      COALESCE(SUM(p.score), 0) as total_score,
      COALESCE(SUM(p.aciertos), 0) as total_aciertos,
      COALESCE(SUM(p.errores), 0) as total_errores,
      MAX(p.fecha_actualizacion) as ultima_actividad
    FROM salas s
    INNER JOIN participantes_sala ps ON s.id = ps.sala_id
    INNER JOIN usuarios u ON ps.estudiante_id = u.id
    LEFT JOIN progreso_estudiante p ON u.id = p.estudiante_id
    WHERE s.docente_id = ?
  `;
  
  const args = [req.params.id];
  
  if (salaFiltro) {
    sql += " AND s.codigo_unico = ?";
    args.push(salaFiltro);
  }
  
  sql += " GROUP BY s.id, s.codigo_unico, u.id, u.username, s.fecha_creacion ORDER BY s.fecha_creacion DESC, total_score DESC";

  try {
    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (e) {
    console.error("CRITICAL SQL ERROR:", e.message, e.stack);
    res.status(500).json({ error: 'Fallo en consulta de resultados: ' + e.message });
  }
});

apiRouter.get('/salas/status/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT (duracion_minutos * 60) - (strftime('%s', 'now') - strftime('%s', fecha_creacion)) as segundos_restantes FROM salas WHERE id = ?",
      args: [req.params.id]
    });
    res.json({ tiempo_restante: result.rows[0] ? Math.max(0, result.rows[0].segundos_restantes) : 0 });
  } catch (e) {
    res.status(500).json({ error: 'Error al consultar estado de sala' });
  }
});

apiRouter.post('/salas/unirse', authenticateToken, async (req, res) => {
  try {
    const { codigo, estudiante_id } = req.body;
    const result = await db.execute({ sql: 'SELECT * FROM salas WHERE codigo_unico = ? AND activa = 1', args: [codigo] });
    const sala = result.rows[0];
    if (!sala) return res.status(404).json({ error: 'Sala no encontrada' });
    
    await db.execute({
      sql: 'INSERT OR IGNORE INTO participantes_sala (sala_id, estudiante_id) VALUES (?, ?)',
      args: [sala.id, estudiante_id]
    });

    let destination = (sala.game_url === 'local') ? '/game.html' : sala.game_url;
    res.json({ status: 'success', salaId: sala.id, redirect: destination, params: `?sala=${codigo}&user_id=${estudiante_id}` });
  } catch (e) {
    res.status(500).json({ error: 'Error al unirse a la sala' });
  }
});

apiRouter.post('/salas/borrar', authenticateToken, async (req, res) => {
  const { sala_id, docente_id } = req.body;
  try {
    await db.execute({
      sql: 'UPDATE salas SET activa = 0 WHERE id = ? AND docente_id = ?',
      args: [sala_id, docente_id]
    });
    res.json({ status: 'success', message: 'Sala eliminada correctamente' });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo borrar la sala' });
  }
});

apiRouter.post('/salas/toggle-status', authenticateToken, async (req, res) => {
  const { sala_id, activa } = req.body;
  try {
    await db.execute({
      sql: 'UPDATE salas SET activa = ? WHERE id = ?',
      args: [activa ? 1 : 0, sala_id]
    });
    res.json({ status: 'success' });
  } catch (e) {
    res.status(500).json({ error: 'Error al cambiar estado de la sala' });
  }
});

apiRouter.post('/game/score', authenticateToken, async (req, res) => {
  try {
    const { estudiante_id, nivel_id, score, aciertos, errores } = req.body;

    // --- SISTEMA ANTI-CHEAT (DATOS REALES) ---
    // 1. Cada nivel tiene exactamente 7 preguntas (según content.js)
    if ((aciertos + errores) > 7) {
        return res.status(400).json({ error: "Inconsistencia de datos: El total de respuestas supera el límite del nivel." });
    }

    // 2. Validación de puntaje máximo lógico (Cada acierto da ~500 max + bonus)
    const MAX_PUNTOS_POR_NIVEL = 5000; 
    if (score > MAX_PUNTOS_POR_NIVEL) {
        return res.status(400).json({ error: "Puntaje fuera de rango de seguridad." });
    }

    await db.execute({
      sql: `INSERT INTO progreso_estudiante (estudiante_id, nivel_id, score, aciertos, errores) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(estudiante_id, nivel_id) DO UPDATE SET 
              score = MAX(score, excluded.score), 
              aciertos = excluded.aciertos,
              errores = excluded.errores,
              fecha_actualizacion = CURRENT_TIMESTAMP`,
      args: [estudiante_id, nivel_id, score, aciertos, errores]
    });
    res.json({ status: 'success' });
  } catch (e) {
    res.status(500).json({ error: 'Error al guardar puntaje' });
  }
});

// En producción, esto debería ir a Redis o una tabla de la DB. 
// Para salir de beta, al menos lo asociamos a un tracking más limpio.
const importJobs = new Map();

apiRouter.get('/docente/import-progress/:id', authenticateToken, (req, res) => {
  res.json(importJobs.get(req.params.id) || { progress: 0 });
});

// --- IMPORTACIÓN DE NOTAS DESDE DOCUMENTO ---
apiRouter.post('/docente/importar-notas', authenticateToken, upload.single('archivo'), async (req, res) => {
  // Obtenemos el ID del docente para trackear su progreso específico
  const docenteId = req.body.docente_id;

  if (!req.file) {
    return res.status(400).json({ error: 'No se ha seleccionado ningún archivo.' });
  }

  try {
    // Leer el buffer del archivo subido
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convertir a JSON y normalizar encabezados (quitar espacios y minúsculas)
    const rawData = xlsx.utils.sheet_to_json(worksheet);
    
    if (rawData.length === 0) {
      return res.status(400).json({ error: 'El documento está vacío.' });
    }

    const data = rawData.map(row => {
      const normalized = {};
      for (let key in row) {
        normalized[key.trim().toLowerCase()] = row[key];
      }
      return normalized;
    });

    // Validación de columnas requeridas
    const firstRowKeys = Object.keys(data[0] || {});
    const requiredColumns = ['id_matricula', 'nota_aporte', 'nota_examen'];
    const missing = requiredColumns.filter(col => !firstRowKeys.includes(col));

    if (missing.length > 0) {
      // Mensaje de error exacto solicitado por el usuario
      const missingUpper = missing.map(m => m === 'id_matricula' ? m : m.toUpperCase());
      return res.status(400).json({ error: `Faltan columnas requeridas: ${missingUpper.join(', ')}` });
    }

    if (docenteId) importJobs.set(docenteId, { progress: 0 });

    // Procesar cada fila e insertar/actualizar en la base de datos
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const totalScore = Number(row.nota_aporte || 0) + Number(row.nota_examen || 0);
      
      // Asumimos que id_matricula corresponde al ID del estudiante
      await db.execute({
        sql: `INSERT INTO progreso_estudiante (estudiante_id, nivel_id, score) 
              VALUES (?, 1, ?) 
              ON CONFLICT(estudiante_id, nivel_id) 
              DO UPDATE SET score = MAX(score, excluded.score), fecha_actualizacion = CURRENT_TIMESTAMP`,
        args: [row.id_matricula, totalScore]
      });

      // Actualizar progreso en memoria
      if (docenteId) {
        importJobs.set(docenteId, { progress: Math.round(((i + 1) / data.length) * 100) });
      }
    }

    // Limpiar el progreso después de 10 segundos de haber terminado
    if (docenteId) setTimeout(() => importJobs.delete(docenteId), 10000);

    res.json({ status: 'success', message: `${data.length} registros procesados correctamente.` });
  } catch (e) {
    console.error("Error al importar notas:", e.message);
    res.status(500).json({ error: 'Error al procesar el documento: ' + e.message });
  }
});

// Montar el router en /api
// Esto permite que Express responda tanto a /api/auth/login como a /auth/login si el proxy de Vercel elimina el prefijo
app.use('/api', apiRouter);

// Manejador de errores para rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada en la API' });
});

// Manejador de errores global para evitar caídas (500)
app.use((err, req, res, next) => {
  console.error("ERROR NO CONTROLADO:", err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor solo si se ejecuta localmente (Vercel ignora esto)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor local corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;