// ========================================================
// 1. INICIALIZAR LA BASE DE DATOS LOCAL CON DEXIE
// ========================================================
const db = new Dexie("SpacePlayerDB");
db.version(1).stores({
    songs: "++id, name, data"
});

// SELECTORES DE ELEMENTOS DE LA INTERFAZ
const audioUpload = document.getElementById('audio-upload');
const playPauseBtn = document.getElementById('btn-play-pause');
const prevBtn = document.getElementById('btn-prev');
const nextBtn = document.getElementById('btn-next');
const progressBar = document.getElementById('progress-bar');
const songTitle = document.getElementById('song-title');
const songArtist = document.getElementById('song-artist');
const currentTimeEl = document.getElementById('current-time');
const totalDurationEl = document.getElementById('total-duration');
const songsList = document.getElementById('songs-list');

// SELECTORES DE VISTAS Y VENTANAS FLOTANTES
const tabNowPlaying = document.getElementById('tab-now-playing');
const tabLibrary = document.getElementById('tab-library');
const viewNowPlaying = document.getElementById('view-now-playing');
const viewLibrary = document.getElementById('view-library');

const btnEqualizer = document.getElementById('btn-equalizer');
const modalEq = document.getElementById('modal-eq');
const closeEq = document.getElementById('close-eq');

const btnSettings = document.getElementById('btn-settings');
const modalSettings = document.getElementById('modal-settings');
const closeSettings = document.getElementById('close-settings');
const btnClearDb = document.getElementById('btn-clear-db');

// CONFIGURACIÓN DEL MOTOR DE AUDIO NATIVO
const audio = new Audio();
audio.crossOrigin = "anonymous";
let playlist = [];
let currentSongIndex = 0;

// VARIABLES PARA EL ECUALIZADOR (WEB AUDIO API)
let audioCtx;
let trackNode;
let bassFilter, midFilter, trebleFilter;

// ========================================================
// 2. ANIMACIÓN DEL FONDO ESPACIAL (Canvas 2D)
// ========================================================
const canvas = document.getElementById('space-bg');
const ctx = canvas.getContext('2d');
let stars = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Generar coordenadas aleatorias para 60 estrellas
for (let i = 0; i < 60; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2,
        speed: Math.random() * 0.4 + 0.1,
        alpha: Math.random()
    });
}

function animateSpace() {
    let gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#04040c');
    gradient.addColorStop(0.5, '#090716');
    gradient.addColorStop(1, '#020205');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 242, 254, ${star.alpha})`;
        ctx.fill();

        star.y += star.speed;
        star.alpha += (Math.random() - 0.5) * 0.04;

        if (star.alpha < 0.1) star.alpha = 0.1;
        if (star.alpha > 0.8) star.alpha = 0.8;

        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    });

    requestAnimationFrame(animateSpace);
}
animateSpace();

// ========================================================
// 3. ENRUTAMIENTO DEL ECUALIZADOR HARDWARE
// ========================================================
function initAudioContext() {
    if (audioCtx) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    trackNode = audioCtx.createMediaElementSource(audio);

    bassFilter = audioCtx.createBiquadFilter();
    bassFilter.type = "lowshelf";
    bassFilter.frequency.value = 220;

    midFilter = audioCtx.createBiquadFilter();
    midFilter.type = "peaking";
    midFilter.Q.value = 1;
    midFilter.frequency.value = 1100;

    trebleFilter = audioCtx.createBiquadFilter();
    trebleFilter.type = "highshelf";
    trebleFilter.frequency.value = 4500;

    trackNode.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);
    trebleFilter.connect(audioCtx.destination);
}

document.getElementById('eq-bass').addEventListener('input', (e) => {
    if(bassFilter) bassFilter.gain.value = e.target.value;
});
document.getElementById('eq-mid').addEventListener('input', (e) => {
    if(midFilter) midFilter.gain.value = e.target.value;
});
document.getElementById('eq-treble').addEventListener('input', (e) => {
    if(trebleFilter) trebleFilter.gain.value = e.target.value;
});

// ========================================================
// 4. CONTROL DE PANTALLAS (Pestañas superiores)
// ========================================================
tabNowPlaying.addEventListener('click', () => {
    tabNowPlaying.classList.add('active');
    tabLibrary.classList.remove('active');
    viewNowPlaying.classList.remove('hidden');
    viewLibrary.classList.add('hidden');
});

tabLibrary.addEventListener('click', () => {
    tabLibrary.classList.add('active');
    tabNowPlaying.classList.remove('active');
    viewLibrary.classList.remove('hidden');
    viewNowPlaying.classList.add('hidden');
    renderLibrary();
});

btnEqualizer.addEventListener('click', () => { 
    initAudioContext(); 
    modalEq.classList.remove('hidden'); 
});
closeEq.addEventListener('click', () => modalEq.classList.add('hidden'));

btnSettings.addEventListener('click', () => modalSettings.classList.remove('hidden'));
closeSettings.addEventListener('click', () => modalSettings.classList.add('hidden'));

// ========================================================
// 5. CONTROLADORES DE LA BIBLIOTECA Y REPRODUCCIÓN
// ========================================================
async function loadPlaylist() {
    playlist = await db.songs.toArray();
}

async function renderLibrary() {
    await loadPlaylist();
    songsList.innerHTML = "";
    
    if (playlist.length === 0) {
        songsList.innerHTML = `<p style="text-align:center; color:rgba(255,255,255,0.3); margin-top:30px; font-size:14px;">No hay canciones guardadas.</p>`;
        return;
    }

    playlist.forEach((song, index) => {
        const li = document.createElement('li');
        if (index === currentSongIndex && !audio.paused) {
            li.classList.add('playing');
        }
        li.innerHTML = `
            <span>${song.name}</span>
            <span class="material-icons" style="font-size:20px;">play_circle</span>
        `;
        li.addEventListener('click', () => {
            currentSongIndex = index;
            loadSong(currentSongIndex);
            playSong();
            tabNowPlaying.click();
        });
        songsList.appendChild(li);
    });
}

audioUpload.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    for (const file of files) {
        await db.songs.add({
            name: file.name.replace(/\.[^/.]+$/, ""),
            data: file
        });
    }
    
    await loadPlaylist();
    await renderLibrary();
    
    currentSongIndex = playlist.length - files.length;
    loadSong(currentSongIndex);
    playSong();
});

function loadSong(index) {
    if (!playlist[index]) return;
    const song = playlist[index];
    songTitle.innerText = song.name;
    songArtist.innerText = "Biblioteca Local";
    
    if(audio.src) URL.revokeObjectURL(audio.src);
    audio.src = URL.createObjectURL(song.data);

    // Actualizar metadatos del sistema al cargar canción nueva
    actualizarPantallaDeBloqueo();
}

function playSong() {
    if (!audio.src) return;
    initAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    audio.play();
    playPauseBtn.innerText = 'pause';
    
    // Sincronizar estado de reproducción con el sistema operativo
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "playing";
    }
}

function pauseSong() {
    audio.pause();
    playPauseBtn.innerText = 'play_arrow';
    
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "paused";
    }
}

// 🔥 FUNCIÓN DE INTEGRACIÓN MAESTRA PARA IPHONE (MEDIA SESSION)
function actualizarPantallaDeBloqueo() {
    if ('mediaSession' in navigator && playlist[currentSongIndex]) {
        const song = playlist[currentSongIndex];
        
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.name,
            artist: "Biblioteca Local",
            album: "Space Player Premium",
            artwork: [
                { src: 'https://img.icons8.com/fluent/512/space-hover.png', sizes: '512x512', type: 'image/png' }
            ]
        });

        // Configurar acciones de los botones de hardware de iOS
        navigator.mediaSession.setActionHandler('play', playSong);
        navigator.mediaSession.setActionHandler('pause', pauseSong);
        
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            if (playlist.length === 0) return;
            currentSongIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
            loadSong(currentSongIndex);
            playSong();
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
            if (playlist.length === 0) return;
            currentSongIndex = (currentSongIndex + 1) % playlist.length;
            loadSong(currentSongIndex);
            playSong();
        });
    }
}

playPauseBtn.addEventListener('click', () => {
    if (playlist.length === 0) return;
    if (audio.paused) {
        if (!audio.src) loadSong(currentSongIndex);
        playSong();
    } else {
        pauseSong();
    }
});

nextBtn.addEventListener('click', () => {
    if (playlist.length === 0) return;
    currentSongIndex = (currentSongIndex + 1) % playlist.length;
    loadSong(currentSongIndex);
    playSong();
});

prevBtn.addEventListener('click', () => {
    if (playlist.length === 0) return;
    currentSongIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
    loadSong(currentSongIndex);
    playSong();
});

// ========================================================
// 6. CONTROL DE LA LÍNEA DE TIEMPO
// ========================================================
audio.addEventListener('timeupdate', () => {
    if (isNaN(audio.duration)) return;
    progressBar.value = (audio.currentTime / audio.duration) * 100;

    let cMin = Math.floor(audio.currentTime / 60);
    let cSec = Math.floor(audio.currentTime % 60);
    currentTimeEl.innerText = `${cMin}:${cSec < 10 ? '0' : ''}${cSec}`;
});

audio.addEventListener('loadeddata', () => {
    let tMin = Math.floor(audio.duration / 60);
    let tSec = Math.floor(audio.duration % 60);
    totalDurationEl.innerText = `${tMin}:${tSec < 10 ? '0' : ''}${tSec}`;
});

progressBar.addEventListener('input', () => {
    if (!audio.duration) return;
    audio.currentTime = (progressBar.value * audio.duration) / 100;
});

audio.addEventListener('ended', () => nextBtn.click());

btnClearDb.addEventListener('click', async () => {
    if(confirm("¿Seguro que quieres borrar toda la música guardada?")) {
        await db.songs.clear();
        playlist = [];
        audio.src = "";
        songTitle.innerText = "Sin canciones";
        songArtist.innerText = "Importa música para empezar";
        pauseSong();
        await renderLibrary();
        modalSettings.classList.add('hidden');
    }
});

window.onload = async () => {
    await loadPlaylist();
    if(playlist.length > 0) {
        loadSong(0);
    }
};

// ========================================================
// 7. REGISTRO DEL SERVICE WORKER (PWA)
// ========================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => {
                console.log('¡PWA lista para instalar con éxito!', reg);
                // Si el service worker cambió, forzar su activación inmediata
                if (reg.waiting) {
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
            })
            .catch(err => console.error('Error al registrar PWA:', err));
    });
}
