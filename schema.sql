CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT CHECK(rol IN ('estudiante', 'profesor')) NOT NULL
);

CREATE TABLE IF NOT EXISTS salas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_unico TEXT UNIQUE NOT NULL,
    docente_id INTEGER,
    duracion_minutos INTEGER DEFAULT 30,
    capacidad_max INTEGER DEFAULT 10,
    game_url TEXT DEFAULT 'local',
    activa INTEGER DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (docente_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS participantes_sala (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sala_id INTEGER,
    estudiante_id INTEGER,
    FOREIGN KEY (sala_id) REFERENCES salas(id),
    FOREIGN KEY (estudiante_id) REFERENCES usuarios(id),
    UNIQUE(sala_id, estudiante_id)
);

CREATE TABLE IF NOT EXISTS progreso_estudiante (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estudiante_id INTEGER,
    nivel_id INTEGER,
    score INTEGER DEFAULT 0,
    completado INTEGER DEFAULT 0,
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (estudiante_id) REFERENCES usuarios(id),
    UNIQUE(estudiante_id, nivel_id)
);