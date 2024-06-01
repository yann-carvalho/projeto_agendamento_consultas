const express = require('express');
const path = require('path');
const app = express();
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'db_extensao_2',
    password: 'postgres',
    port: 5432,
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
}));

// Serve index.html on the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// User registration
app.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    console.log(req.body); // Linha para verificar os dados recebidos
    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const result = await pool.query(
            'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id', 
            [name, email, hashedPassword, role]
        );
        res.status(201).json({ message: 'User registered successfully', userId: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// User login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (await bcrypt.compare(password, user.password)) {
                req.session.userId = user.id;
                // Redireciona para dashboard.html se o login for bem-sucedido
                res.redirect('/dashboard.html');
            } else {
                // Redireciona para login.html com a mensagem de credenciais inválidas
                res.redirect('/login.html?invalidCredentials=true');
            }
        } else {
            // Redireciona para login.html com a mensagem de credenciais inválidas
            res.redirect('/login.html?invalidCredentials=true');
        }
    } catch (err) {
        // Redireciona para login.html com a mensagem de erro interno do servidor
        res.redirect('/login.html?internalServerError=true');
    }
});

// Create appointment
app.post('/appointments', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { serviceType, appointmentDate } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO appointments (user_id, service_type, appointment_date, status) VALUES ($1, $2, $3, $4) RETURNING id',
            [req.session.userId, serviceType, appointmentDate, 'Scheduled']
        );
        res.status(201).json({ message: 'Appointment created successfully', appointmentId: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Cancel appointment
app.delete('/appointments/:id', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM appointments WHERE id = $1 AND user_id = $2 RETURNING id',
            [id, req.session.userId]
        );
        if (result.rows.length > 0) {
            res.json({ message: 'Appointment cancelled' });
        } else {
            res.status(404).json({ error: 'Appointment not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});