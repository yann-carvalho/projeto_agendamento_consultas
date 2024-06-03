import express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import session from 'express-session';
import dotenv from 'dotenv';

dotenv.config({ path: '/home/yannsoares/UNIESP/projeto_agendamento_consultas/backend/file.env' });

const app = express();

const supabaseUrl = 'https://atevcpkhcqionsxeucsp.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const __dirname = path.dirname(new URL(import.meta.url).pathname);
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}));

// Serve index.html on the root route
app.use(express.static(path.join(__dirname, '../public')));

// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, '../public', 'index.html'));
// });

// User registration
app.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    console.log(req.body); // Linha para verificar os dados recebidos
    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const { data, error } = await supabase
            .from('users')
            .insert([{ name, email, password: hashedPassword, role }]);
        
        if (error) {
            throw error;
        }

        res.redirect('/register.html?registrationSuccess=true');
    } catch (error) {
        res.redirect('/register.html?internalServerError=true');
    }
});

// User login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .limit(1);

        if (error) {
            throw error;
        }

        if (users.length > 0) {
            const user = users[0];
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
    } catch (error) {
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
        const { data, error } = await supabase
            .from('appointments')
            .insert([{ user_id: req.session.userId, service_type: serviceType, appointment_date: appointmentDate, status: 'Scheduled' }]);
        
        if (error) {
            throw error;
        }

        res.redirect('/appointment.html?success=true');
    } catch (error) {
        res.redirect('/appointment.html?internalServerError=true');
    }
});

// Cancel appointment
app.delete('/appointments/:id', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', id)
            .eq('user_id', req.session.userId);

        if (error) {
            throw error;
        }

        if (data.length > 0) {
            res.json({ message: 'Appointment cancelled' });
        } else {
            res.status(404).json({ error: 'Appointment not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});