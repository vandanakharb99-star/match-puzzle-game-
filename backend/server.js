const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory session store (use Redis or database in production)
const sessions = new Map();

// Pi Network token validation endpoint
app.post('/api/pi-auth', async (req, res) => {
    const { token, uid, username } = req.body;
    
    if (!token || !uid) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        // Verify token with Pi Network API
        const verifyResponse = await fetch('https://api.minepi.com/v2/me', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!verifyResponse.ok) {
            console.error('Pi verification failed:', verifyResponse.status);
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        const piUserData = await verifyResponse.json();
        
        // Create session
        const sessionToken = crypto.randomBytes(32).toString('hex');
        sessions.set(sessionToken, {
            uid: piUserData.uid,
            username: piUserData.username || username,
            token: token,
            createdAt: Date.now()
        });
        
        // Return session info
        res.json({
            success: true,
            sessionToken: sessionToken,
            user: {
                uid: piUserData.uid,
                username: piUserData.username || username
            }
        });
        
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// Verify session endpoint
app.get('/api/verify-session', async (req, res) => {
    const sessionToken = req.headers['authorization']?.split(' ')[1];
    
    if (!sessionToken || !sessions.has(sessionToken)) {
        return res.status(401).json({ authenticated: false });
    }
    
    const session = sessions.get(sessionToken);
    
    // Check if session expired (7 days)
    if (Date.now() - session.createdAt > 7 * 24 * 60 * 60 * 1000) {
        sessions.delete(sessionToken);
        return res.status(401).json({ authenticated: false, error: 'Session expired' });
    }
    
    res.json({ authenticated: true, user: { uid: session.uid, username: session.username } });
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    const sessionToken = req.headers['authorization']?.split(' ')[1];
    if (sessionToken) {
        sessions.delete(sessionToken);
    }
    res.json({ success: true });
});

// Save game progress (example)
app.post('/api/save-progress', async (req, res) => {
    const sessionToken = req.headers['authorization']?.split(' ')[1];
    
    if (!sessionToken || !sessions.has(sessionToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { level, score, highScore } = req.body;
    const session = sessions.get(sessionToken);
    
    // Save to database here
    console.log(`Saving progress for ${session.username}: Level ${level}, Score ${score}`);
    
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Pi Network backend running on port ${PORT}`);
});
