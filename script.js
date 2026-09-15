const socket = io(); // Conexión automática al dominio actual

const loginScreen = document.getElementById('login-screen');
const callScreen = document.getElementById('call-screen');
const salaInput = document.getElementById('sala-input');
const unirseBtn = document.getElementById('unirse-btn');

const localVideo = document.getElementById('local-video');
const videosContainer = document.getElementById('videos-container');

const micBtn = document.getElementById('mic-btn');
const camBtn = document.getElementById('cam-btn');
const hangupBtn = document.getElementById('hangup-btn');

let miStream;
let peers = {};
let salaActual;

const configuracionRTC = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

unirseBtn.addEventListener('click', async () => {
    const sala = salaInput.value.trim();
    if (!sala) {
        alert('Por favor ingresa un nombre de sala');
        return;
    }
    salaActual = sala;

    try {
        miStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = miStream;

        loginScreen.style.display = 'none';
        callScreen.style.display = 'flex';

        socket.emit('unirse-sala', sala);
    } catch (error) {
        console.error('Error al acceder a la cámara/micrófono:', error);
        alert('No se pudo acceder a la cámara o micrófono. Revisa los permisos.');
    }
});

socket.on('usuario-conectado', async (idSocket) => {
    console.log('Nuevo usuario conectado a la sala:', idSocket);
    const pc = crearPeerConnection(idSocket);
    const oferta = await pc.createOffer();
    await pc.setLocalDescription(oferta);
    socket.emit('oferta', { target: idSocket, offer: pc.localDescription });
});

socket.on('oferta', async (data) => {
    const pc = crearPeerConnection(data.sender);
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const respuesta = await pc.createAnswer();
    await pc.setLocalDescription(respuesta);
    socket.emit('respuesta', { target: data.sender, answer: pc.localDescription });
});

socket.on('respuesta', async (data) => {
    const pc = peers[data.sender];
    if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
});

socket.on('ice-candidate', async (data) => {
    const pc = peers[data.sender];
    if (pc && data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});

socket.on('usuario-desconectado', (idSocket) => {
    if (peers[idSocket]) {
        peers[idSocket].close();
        delete peers[idSocket];
    }
    const cajaRemota = document.getElementById(`caja-${idSocket}`);
    if (cajaRemota) cajaRemota.remove();
});

function crearPeerConnection(idSocket) {
    const pc = new RTCPeerConnection(configuracionRTC);
    peers[idSocket] = pc;

    miStream.getTracks().forEach(track => pc.addTrack(track, miStream));

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { target: idSocket, candidate: event.candidate });
        }
    };

    pc.ontrack = (event) => {
        let caja = document.getElementById(`caja-${idSocket}`);
        if (!caja) {
            caja = document.createElement('div');
            caja.className = 'caja-video';
            caja.id = `caja-${idSocket}`;

            const videoRemoto = document.createElement('video');
            videoRemoto.autoplay = true;
            videoRemoto.playsInline = true;
            videoRemoto.srcObject = event.streams[0];

            caja.appendChild(videoRemoto);
            videosContainer.appendChild(caja);
        }
    };

    return pc;
}

// Controles estilo Google Meet
micBtn.addEventListener('click', () => {
    const audioTrack = miStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        micBtn.classList.toggle('muted', !audioTrack.enabled);
        micBtn.textContent = audioTrack.enabled ? '🎤' : '🔇';
    }
});

camBtn.addEventListener('click', () => {
    const videoTrack = miStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        camBtn.classList.toggle('muted', !videoTrack.enabled);
        camBtn.textContent = videoTrack.enabled ? '📹' : '📷❌';
    }
});

hangupBtn.addEventListener('click', () => {
    if (miStream) {
        miStream.getTracks().forEach(track => track.stop());
    }
    window.location.reload();
});