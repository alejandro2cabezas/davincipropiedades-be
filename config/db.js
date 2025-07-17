const mysql = require("mysql2/promise");

const dbConfig = {database: "inmobiliaria_davinci_db", host: "localhost", port: 3306, user: "root", password: ""};
const pool = mysql.createPool({...dbConfig, waitForConnections: true, connectionLimit: 10, queueLimit: 0});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("Conectado a la base de datos MySql");
    connection.release();
  } catch (error) {
    console.error("Error al conectar a la base de datos:", error.message);
  }
}

module.exports = { pool, testConnection };