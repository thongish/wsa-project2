require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mysql = require('mysql2/promise');
const path = require('path');
const methodOverride = require('method-override');

const app = express();
const PORT = process.env.PORT || 3000;

// MySQL connection
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Express middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(methodOverride('_method'));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
}));

// Passport config
app.use(passport.initialize());
app.use(passport.session());

// Serialize user (stores user in session)
passport.serializeUser((user, done) => {
    done(null, user);
});
passport.deserializeUser((user, done) => {
    done(null, user);
});

// Google OAuth strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',
}, (accessToken, refreshToken, profile, done) => {
    // You can store user info in DB here if needed
    return done(null, profile);
}));

// Routes

app.get('/', async (req, res) => {
    try {
        const [projects] = await db.query('SELECT * FROM projects');
        res.render('index', { projects });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/dashboard');
    }
);

app.get('/dashboard', ensureAuth, async (req, res) => {
    res.send(`
    <h1>Hello, ${req.user.displayName}!</h1>
    <a href="/">Back to Portfolio</a><br>
    <a href="/projects">View Projects</a><br>
    <a href="/logout">Logout</a>
  `);
});

// Example protected route
app.get('/projects', ensureAuth, async (req, res) => {
    try {
        const [projects] = await db.query('SELECT * FROM projects');
        res.render('projects', { projects });
    } catch (err) {
        console.error(err);
        res.status(500).send('DB error');
    }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

// Show form to create a new project
app.get('/projects/new', ensureAuth, (req, res) => {
    res.render('new-project'); // you'll make this view too
});

// Handle create
app.post('/projects', ensureAuth, async (req, res) => {
    const { title, description } = req.body;
    await db.query('INSERT INTO projects (title, description) VALUES (?, ?)', [title, description]);
    res.redirect('/projects');
});

// Show form to edit
app.get('/projects/:id/edit', ensureAuth, async (req, res) => {
    const [rows] = await db.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    const project = rows[0];
    res.render('edit-project', { project });
});

// Handle update
app.put('/projects/:id', ensureAuth, async (req, res) => {
    const { title, description } = req.body;
    await db.query('UPDATE projects SET title = ?, description = ? WHERE id = ?', [title, description, req.params.id]);
    res.redirect('/projects');
});

// Handle delete
app.delete('/projects/:id', ensureAuth, async (req, res) => {
    await db.query('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.redirect('/projects');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

// Logout
app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

// Middleware to protect routes
function ensureAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
