const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'todo_app'
});
db.connect(err => {
    if (err) throw err;
    console.log('Connected to MySQL');
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'secretkey',
    resave: false,
    saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));

// Inject error HTML into forms
function injectErrorHTML(filePath, errorMsg, res) {
    fs.readFile(filePath, 'utf8', (err, html) => {
        if (err) return res.status(500).send('Server error');
        const updatedHtml = html.replace(
            '</form>',
            `<div class="error-message">${errorMsg}</div></form>`
        );
        res.send(updatedHtml);
    });
}

// Auth routes
app.get('/', (req, res) => {
    if (req.session.userId) return res.redirect('/index.html');
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err) return res.status(500).send('Database error');
        if (results.length > 0) {
            return injectErrorHTML(path.join(__dirname, 'public', 'register.html'), 'Username already taken', res);
        }
        db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], (err) => {
            if (err) return res.status(500).send('Error registering user');
            res.redirect('/');
        });
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, results) => {
        if (err) return res.status(500).send('Login error');
        if (results.length === 0) {
            return injectErrorHTML(path.join(__dirname, 'public', 'login.html'), 'Invalid username or password', res);
        }
        req.session.userId = results[0].id;
        res.redirect('/index.html');
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Task routes
app.get('/tasks', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    db.query('SELECT * FROM tasks WHERE user_id = ?', [req.session.userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err });
        }

        // Format due_date to 'YYYY-MM-DD' string manually to avoid timezone issues
        const formattedTasks = results.map(task => {
            let formattedDueDate = null;

            if (task.due_date instanceof Date) {
                const year = task.due_date.getFullYear();
                const month = (task.due_date.getMonth() + 1).toString().padStart(2, '0');
                const day = task.due_date.getDate().toString().padStart(2, '0');
                formattedDueDate = `${year}-${month}-${day}`;
            }

            return {
                ...task,
                due_date: formattedDueDate
            };
        });

        res.json(formattedTasks);
    });
});


app.post('/tasks', (req, res) => {
    const { task, due_date, priority, category } = req.body;
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    db.query(
        'INSERT INTO tasks (user_id, task, due_date, priority, category) VALUES (?, ?, ?, ?, ?)',
        [userId, task, due_date, priority, category],
        (err) => {
            if (err) return res.status(500).json({ error: err });
            res.sendStatus(200);
        }
    );
});

app.put('/tasks/:id', (req, res) => {
    const { task, due_date, priority, category, completed } = req.body;
    const userId = req.session.userId;
    const taskId = req.params.id;

    db.query(
        'UPDATE tasks SET task = ?, due_date = ?, priority = ?, category = ?, completed = ? WHERE id = ? AND user_id = ?',
        [task, due_date, priority, category, completed ? 1 : 0, taskId, userId],
        (err) => {
            if (err) return res.status(500).send('Error updating task');
            res.sendStatus(200);
        }
    );
});

app.delete('/tasks/:id', (req, res) => {
    const taskId = req.params.id;
    const userId = req.session.userId;
    db.query('DELETE FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId], (err) => {
        if (err) return res.status(500).send('Error deleting task');
        res.sendStatus(200);
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
