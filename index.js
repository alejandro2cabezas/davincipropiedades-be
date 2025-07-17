const express = require("express");
const cors = require("cors");
const { pool, testConnection } = require("./config/db");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { authenticateToken } = require("./middleware/auth");

const app = express();
const port = 3000;
// agrego mi localhost de vite con react
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

testConnection();


// --------------------- ENDPOINTS DE LOGEO Y REGISTRO ---------------------


app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.execute("SELECT * FROM usuarios WHERE email = ?", [email]);
    if (rows.length === 0) return res.status(401).json({ error: "Email o contraseña incorrectos" });

    const user = rows[0];
    const isValidPassword = password === user.password; // contrasenas hasheadas luego

    if (!isValidPassword) return res.status(401).json({ error: "Email o contraseña incorrectos" });

    // Generar token
    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Devolver usuario sin contraseña + token
    const { password: _, ...userWithoutPassword } = user;
    res.json({usuario: userWithoutPassword, token});
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.post("/register", authenticateToken, async (req, res) => {
  const { email, password, nombre, apellido, telefono } = req.body;

  try {
    const [result] = await pool.execute(
      "INSERT INTO usuarios (nombre, apellido, email, telefono, password, rol) VALUES (?, ?, ?, ?, ?, ?)",
      [nombre || "", apellido || "", email, telefono || "", password, "cliente"]
    );
    const [newUser] = await pool.execute(
      "SELECT id, nombre, apellido, email, rol FROM usuarios WHERE id = ?",
      [result.insertId]
    );
    res.status(201).json({ usuario: newUser[0] });
  } catch (error) {
    console.error("Error en registro:", error);
    if (error.code === "ER_DUP_ENTRY")
      return res.status(400).json({ error: "Este email ya está registrado" });
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


// --------------------- ENDPOINTS DE USUARIOS ---------------------


app.get("/usuarios", authenticateToken, async (req, res) => {
  try {
    // desestructuro las rows de cada query
    const [rows] = await pool.execute("SELECT * FROM usuarios");
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/usuarios/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute("SELECT * FROM usuarios WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.post("/usuarios", authenticateToken, async (req, res) => {
  const { nombre, apellido, email, telefono, password, rol } = req.body;
  try {
    const [result] = await pool.execute(
      "INSERT INTO usuarios (nombre, apellido, email, telefono, password, rol) VALUES (?, ?, ?, ?, ?, ?)",
      [nombre, apellido, email, telefono, password, rol || "cliente"]
    );
    res.status(201).json({ id: result.insertId, mensaje: "Usuario creado exitosamente" });
  } catch (error) {
    console.error("Error al crear usuario:", error);
    if (error.code === "ER_DUP_ENTRY") return res.status(400).json({ error: "El email ya existe" });
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


app.put("/usuarios/:id", authenticateToken, async (req, res) => {
  // actualizar usuario desde admin panel
  const { id } = req.params;
  const { nombre, apellido, email, telefono, password, rol } = req.body;
  
  try {
    const [result] = await pool.execute(
      "UPDATE usuarios SET nombre = ?, apellido = ?, email = ?, telefono = ?, password = ?, rol = ? WHERE id = ?",
      [nombre, apellido, email, telefono, password, rol, id]
    );
    
    if (result.affectedRows === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    
    res.json({ mensaje: "Usuario actualizado exitosamente" });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.delete("/usuarios/:id", authenticateToken, async (req, res) => {
  // eliminar usuario específico
  const { id } = req.params;
  
  try {
    const [result] = await pool.execute("DELETE FROM usuarios WHERE id = ?", [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    
    res.json({ mensaje: "Usuario eliminado exitosamente" });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


// --------------------- ENDPOINTS DE PROPIEDADES ---------------------


app.get("/propiedades", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT p.*, t.tipo, u.ciudad, u.provincia, 
      (SELECT url_imagen FROM imagenes_propiedad WHERE propiedad_id = p.id LIMIT 1) AS url_imagen 
      FROM propiedades p 
      JOIN tipos_propiedad t ON p.tipo_id = t.id 
      JOIN ubicaciones u ON p.ubicacion_id = u.id`
    );
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener propiedades:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/propiedades/destacadas", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT p.*, t.tipo, u.ciudad, u.provincia, 
      (SELECT url_imagen FROM imagenes_propiedad WHERE propiedad_id = p.id LIMIT 1) AS url_imagen 
      FROM propiedades p 
      JOIN tipos_propiedad t ON p.tipo_id = t.id 
      JOIN ubicaciones u ON p.ubicacion_id = u.id
      WHERE destacada = 1`
    );
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener propiedades destacadas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.post("/propiedades", authenticateToken, async (req, res) => {
  const { titulo, descripcion, precio, superficie, tipo, habitaciones, banos, ubicacion, url_imagen, usuario_id, destacada } = req.body;

  try {
    const [tipoRows] = await pool.execute("SELECT id FROM tipos_propiedad WHERE tipo = ?", [tipo]);
    if (tipoRows.length === 0) return res.status(400).json({error: "Tipo de propiedad no válido"});

    let ubicacion_id;
    const [ubicacionRows] = await pool.execute( "SELECT id FROM ubicaciones WHERE ciudad = ?", [ubicacion] );

    if (ubicacionRows.length === 0) {
      const [result] = await pool.execute("INSERT INTO ubicaciones (ciudad, provincia) VALUES (?, ?)", [ubicacion, "Buenos Aires"]);
      ubicacion_id = result.insertId;
    } else {
      ubicacion_id = ubicacionRows[0].id;
    }

    const [result] = await pool.execute(
      "INSERT INTO propiedades (titulo, descripcion, precio, superficie, habitaciones, banos, tipo_id, ubicacion_id, usuario_id, destacada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [titulo, descripcion, precio, superficie, habitaciones, banos, tipoRows[0].id, ubicacion_id, usuario_id, destacada]
    );

    if (url_imagen) await pool.execute("INSERT INTO imagenes_propiedad (propiedad_id, url_imagen) VALUES (?, ?)",[result.insertId, url_imagen]);
    res.status(201).json({ id: result.insertId, mensaje: "Propiedad creada exitosamente" });
  } catch (error) {
    console.error("Error al crear propiedad:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/propiedades/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(
      `SELECT p.*, t.tipo, u.ciudad, u.provincia, u.direccion,
      (SELECT url_imagen FROM imagenes_propiedad WHERE propiedad_id = p.id LIMIT 1) AS url_imagen 
      FROM propiedades p 
      JOIN tipos_propiedad t ON p.tipo_id = t.id 
      JOIN ubicaciones u ON p.ubicacion_id = u.id 
      WHERE p.id = ?`,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Propiedad no encontrada" });

    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener propiedad:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/propiedades/usuario/:usuario_id", authenticateToken, async (req, res) => {
  //propiedades de un usuario específico
  const { usuario_id } = req.params;
  
  try {
    const [rows] = await pool.execute(
      `SELECT p.*, t.tipo, u.ciudad, u.provincia, 
      (SELECT url_imagen FROM imagenes_propiedad WHERE propiedad_id = p.id LIMIT 1) AS url_imagen 
      FROM propiedades p 
      JOIN tipos_propiedad t ON p.tipo_id = t.id 
      JOIN ubicaciones u ON p.ubicacion_id = u.id 
      WHERE p.usuario_id = ?`,
      [usuario_id]
    );
    
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener propiedades del usuario:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


app.put("/propiedades/:id", authenticateToken, async (req, res) => {
  // actualizar propiedad desde admin panel
  const { id } = req.params;
  const { titulo, descripcion, precio, superficie, habitaciones, banos, tipo, ubicacion, url_imagen } = req.body;
  
  try {
    // obtener tipo_id
    const [tipoRows] = await pool.execute("SELECT id FROM tipos_propiedad WHERE tipo = ?", [tipo]);
    if (tipoRows.length === 0) return res.status(400).json({ error: "Tipo de propiedad no válido" });
    
    // obtener o crear ubicacion_id
    let ubicacion_id;
    const [ubicacionRows] = await pool.execute("SELECT id FROM ubicaciones WHERE ciudad = ?", [ubicacion]);
    
    if (ubicacionRows.length === 0) {
      const [result] = await pool.execute("INSERT INTO ubicaciones (ciudad, provincia) VALUES (?, ?)", [ubicacion, "Buenos Aires"]);
      ubicacion_id = result.insertId;
    } else {
      ubicacion_id = ubicacionRows[0].id;
    }
    
    //actualizar propiedad
    const [result] = await pool.execute(
      "UPDATE propiedades SET titulo = ?, descripcion = ?, precio = ?, superficie = ?, habitaciones = ?, banos = ?, tipo_id = ?, ubicacion_id = ? WHERE id = ?",
      [titulo, descripcion, precio, superficie, habitaciones, banos, tipoRows[0].id, ubicacion_id, id]
    );
    
    if (result.affectedRows === 0) return res.status(404).json({ error: "Propiedad no encontrada" });
    //actualizar imagen si se proporciona
    if (url_imagen) await pool.execute("UPDATE imagenes_propiedad SET url_imagen = ? WHERE propiedad_id = ?", [url_imagen, id]);
    
    res.json({ mensaje: "Propiedad actualizada exitosamente" });
  } catch (error) {
    console.error("Error al actualizar propiedad:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.delete("/propiedades/:id", authenticateToken, async (req, res) => {
  // eliminar propiedad específica
  const { id } = req.params;
  
  try {
    const [result] = await pool.execute("DELETE FROM propiedades WHERE id = ?", [id]);
    
    if (result.affectedRows === 0) return res.status(404).json({ error: "Propiedad no encontrada" });
    
    res.json({ mensaje: "Propiedad eliminada exitosamente" });
  } catch (error) {
    console.error("Error al eliminar propiedad:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


// --------------------- ENDPOINTS DE PUBLICACIONES FAVORITAS ---------------------


app.get("/favoritos/:usuario_id", authenticateToken, async (req, res) => {
  const { usuario_id } = req.params;

  try {
    const [rows] = await pool.execute(
      `SELECT p.*, t.tipo, u.ciudad, u.provincia, f.fecha_agregado, (SELECT url_imagen FROM imagenes_propiedad WHERE propiedad_id = p.id LIMIT 1) AS url_imagen FROM favoritos f JOIN propiedades p ON f.propiedad_id = p.id JOIN tipos_propiedad t ON p.tipo_id = t.id JOIN ubicaciones u ON p.ubicacion_id = u.id WHERE f.usuario_id = ?`,
      [usuario_id]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener favoritos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.post("/favoritos", authenticateToken, async (req, res) => {
  const { usuario_id, propiedad_id } = req.body;

  try {
    // ver si ya existe el favorito
    const [existing] = await pool.execute("SELECT id FROM favoritos WHERE usuario_id = ? AND propiedad_id = ?", [usuario_id, propiedad_id]);

    if (existing.length > 0) {
      // si existe se elimina de favoritos
      await pool.execute("DELETE FROM favoritos WHERE usuario_id = ? AND propiedad_id = ?", [usuario_id, propiedad_id]);
      res.json({ mensaje:"Favorito eliminado", action: "removed" });
    } else {
      // si no existe se agrega
      await pool.execute("INSERT INTO favoritos (usuario_id, propiedad_id) VALUES (?, ?)", [usuario_id, propiedad_id]);
      res.json({mensaje: "Favorito agregado", action: "added"});
    }
  } catch (error) {
    console.error("Error al manejar favorito:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/favoritos/:usuario_id/:propiedad_id", authenticateToken, async (req, res) => {
  const { usuario_id, propiedad_id } = req.params;

  try {
    const [rows] = await pool.execute(
      "SELECT id FROM favoritos WHERE usuario_id = ? AND propiedad_id = ?",
      [usuario_id, propiedad_id]
    );

    res.json({ isFavorito: rows.length > 0 });
  } catch (error) {
    console.error("Error al verificar favorito:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


// --------------------- ADMIN PANEL - RESETEAR TODOS LOS VALORES GUARDADOS ---------------------


app.delete("/resetAll", authenticateToken, async (req, res) => {
  // resetear toda la base de datos en el admin panel
  try {
    //deshabilita temporalmente las foreign key checks para evitar errores
    await pool.execute("SET FOREIGN_KEY_CHECKS = 0");
    // Eliminar todos los datos de todas las tablas
    await pool.execute("DELETE FROM favoritos");
    await pool.execute("DELETE FROM reservas");
    await pool.execute("DELETE FROM ventas");
    await pool.execute("DELETE FROM imagenes_propiedad");
    await pool.execute("DELETE FROM propiedades");
    await pool.execute("DELETE FROM agentes");
    await pool.execute("DELETE FROM usuarios");
    await pool.execute("DELETE FROM ubicaciones");
    // Reiniciar los AUTO_INCREMENT para que los IDs vuelvan a empezar desde 1
    await pool.execute("ALTER TABLE usuarios AUTO_INCREMENT = 1");
    await pool.execute("ALTER TABLE agentes AUTO_INCREMENT = 1");
    await pool.execute("ALTER TABLE ubicaciones AUTO_INCREMENT = 1");
    await pool.execute("ALTER TABLE propiedades AUTO_INCREMENT = 1");
    await pool.execute("ALTER TABLE imagenes_propiedad AUTO_INCREMENT = 1");
    await pool.execute("ALTER TABLE favoritos AUTO_INCREMENT = 1");
    await pool.execute("ALTER TABLE reservas AUTO_INCREMENT = 1");
    await pool.execute("ALTER TABLE ventas AUTO_INCREMENT = 1");
    // Reactivar las foreign key checks
    await pool.execute("SET FOREIGN_KEY_CHECKS = 1");

    res.json({ mensaje: "Toda la base de datos ha sido reseteada exitosamente" });
  } catch (error) {
    console.error("Error al resetear base de datos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// --------------------- INICIO DE LISTENER ---------------------

app.listen(port, () => { console.log(`Servidor corriendo`) });