const WebSocket = require('ws');
const http = require('http');
const express = require('express');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store active connections and their associated notes
const connections = new Map();

wss.on('connection', (ws, req) => {
    const noteId = new URL(req.url, 'http://localhost').searchParams.get('noteId');
    
    if (!connections.has(noteId)) {
        connections.set(noteId, new Set());
    }
    connections.get(noteId).add(ws);

    // Send message to all clients editing the same note
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        connections.get(noteId).forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    });

    // Handle client disconnection
    ws.on('close', () => {
        if (connections.has(noteId)) {
            connections.get(noteId).delete(ws);
            if (connections.get(noteId).size === 0) {
                connections.delete(noteId);
            }
        }
    });
});

// Serve static files
app.use(express.static('.'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 