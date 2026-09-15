const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir archivos estáticos desde la carpeta actual
app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // Unir al usuario a la sala específica solicitada
    socket.on('unirse-sala', (sala) => {
        socket.join(sala);
        socket.salaActual = sala;

        // Notificar a los demás en la misma sala que alguien nuevo entró
        socket.to(sala).emit('usuario-conectado', socket.id);
    });

    // Reenviar la oferta WebRTC al destinatario correcto
    socket.on('oferta', (data) => {
        io.to(data.target).emit('oferta', { sender: socket.id, offer: data.offer });
    });

    // Reenviar la respuesta WebRTC
    socket.on('respuesta', (data) => {
        io.to(data.target).emit('respuesta', { sender: socket.id, answer: data.answer });
    });

    // Reenviar los candidatos ICE para establecer la conexión de red
    socket.on('ice-candidate', (data) => {
        io.to(data.target).emit('ice-candidate', { sender: socket.id, candidate: data.candidate });
    });

    // Manejar desconexiones limpias de la sala
    socket.on('disconnect', () => {
        if (socket.salaActual) {
            socket.to(socket.salaActual).emit('usuario-desconectado', socket.id);
        }
        console.log('Usuario desconectado:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});