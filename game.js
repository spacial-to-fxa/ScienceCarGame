// ==========================================
// 1. FIREBASE CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCBaqxZfgxYFqJN1Yz7LPbV00B_ZNoBxUs",
  authDomain: "science-racing-p6.firebaseapp.com",
  projectId: "science-racing-p6",
  storageBucket: "science-racing-p6.firebasestorage.app",
  messagingSenderId: "375550267936",
  appId: "1:375550267936:web:7ad24d0b6de728a2cce245"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ==========================================
// 2. AUDIO SYSTEM (ระบบเสียง)
// ==========================================
const sounds = {
    bgm: new Audio('bgm.mp3'),
    engine: new Audio('engine.mp3'),
    correct: new Audio('correct.mp3'),
    wrong: new Audio('wrong.mp3')
};

// ตั้งค่าเสียง
sounds.bgm.loop = true;    // เล่นวนซ้ำ
sounds.bgm.volume = 0.5;   // ลดเสียงเพลงลงหน่อย
sounds.engine.loop = true; // เสียงเครื่องยนต์ดังตลอด
sounds.engine.volume = 0.3;

function playSound(name) {
    // เช็คว่าไฟล์มีจริงไหมก่อนเล่นเพื่อกัน error
    if(sounds[name]) {
        sounds[name].currentTime = 0; // เริ่มเล่นใหม่ตั้งแต่ต้น
        sounds[name].play().catch(e => console.log("ยังไม่ได้โหลดเสียง: " + name));
    }
}

// ==========================================
// 3. GAME VARIABLES
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let player = { name: "", email: "", score: 0, dbId: null };
let currentLevel = 1;
let allQuestions = [];
let levelQuestions = [];
let qIndex = 0;

let timeLeft = 10;
let timerInterval = null;
let isDragging = false;
let isGameActive = false;
let car = { x: 0, y: 0, w: 0, h: 0 }; 

// ตัวแปรสำหรับถนนเลื่อน
let roadOffset = 0; 
let roadSpeed = 8; // ความเร็วถนน

// ==========================================
// 4. INPUT HANDLING
// ==========================================
function startDrag(e) {
    if (!isGameActive) return;
    isDragging = true;
    moveCar(e);
}
function stopDrag() { isDragging = false; }
function drag(e) {
    if (isDragging && isGameActive) moveCar(e);
}

function moveCar(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX = e.clientX;
    if(e.touches && e.touches.length > 0) clientX = e.touches[0].clientX;

    car.x = clientX - rect.left - (car.w / 2);
    
    // Smooth boundary
    if (car.x < 0) car.x = 0;
    if (car.x > canvas.width - car.w) car.x = canvas.width - car.w;
}

canvas.addEventListener('mousedown', startDrag);
canvas.addEventListener('mousemove', drag);
canvas.addEventListener('mouseup', stopDrag);
canvas.addEventListener('mouseleave', stopDrag);
canvas.addEventListener('touchstart', startDrag, {passive: false});
canvas.addEventListener('touchmove', drag, {passive: false});
canvas.addEventListener('touchend', stopDrag);

// ==========================================
// 5. GAME SYSTEM
// ==========================================
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    car.w = canvas.width * 0.13; 
    if(car.w > 100) car.w = 100;
    car.h = car.w * 1.6;
    car.y = canvas.height - car.h - 50;
    if(car.x === 0) car.x = (canvas.width / 2) - (car.w / 2);
}
window.addEventListener('resize', resize);
resize();

function initLeaderboard() {
    const list = document.getElementById('top-players-list');
    db.collection("scores").orderBy("score", "desc").limit(5)
      .onSnapshot(snapshot => {
          list.innerHTML = "";
          snapshot.forEach(doc => {
              const d = doc.data();
              const li = document.createElement("li");
              li.innerHTML = `<span>${d.name}</span> <span>${d.score} ⭐</span>`;
              list.appendChild(li);
          });
      });
}
initLeaderboard();

async function startGame() {
    const name = document.getElementById('player-name').value;
    const email = document.getElementById('player-email').value;

    if(!name || !email) { alert("กรุณากรอกข้อมูลให้ครบ"); return; }
    player.name = name; player.email = email;

    // เริ่มเล่นเสียงเพลงและเครื่องยนต์
    playSound('bgm');
    playSound('engine');

    try {
        const doc = await db.collection("scores").add({
            name: player.name, email: player.email, score: 0, timestamp: new Date()
        });
        player.dbId = doc.id;
    } catch(e) { console.log("Offline Mode"); }

    try {
        const res = await fetch('questions.json');
        allQuestions = await res.json();
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
        loadLevel(1);
        gameLoop();
    } catch(e) { alert("Error loading JSON"); }
}

function loadLevel(lvl) {
    currentLevel = lvl;
    qIndex = 0;
    levelQuestions = allQuestions.filter(q => q.level === currentLevel);
    document.getElementById('level-val').innerText = currentLevel;
    
    // เปลี่ยนความเร็วรถตามด่าน (ด่านสูงยิ่งเร็ว)
    roadSpeed = 8 + (lvl * 2);
    
    showQuestion();
}

function showQuestion() {
    if(qIndex >= levelQuestions.length) {
        if(currentLevel < 5) loadLevel(currentLevel + 1);
        else { 
            // จบเกม ปิดเสียง
            sounds.bgm.pause();
            sounds.engine.pause();
            alert("🏆 จบเกม! คะแนนรวม: " + player.score); 
            location.reload(); 
        }
        return;
    }

    const q = levelQuestions[qIndex];
    document.getElementById('question-overlay').style.display = 'block';
    document.getElementById('q-text').innerText = `${qIndex+1}. ${q.question}`;
    
    const container = document.getElementById('options-display');
    container.innerHTML = "";
    const prefix = ["A", "B", "C", "D", "E"];
    
    q.options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'option-text';
        div.innerHTML = `<b>${prefix[idx]}</b> ${opt}`;
        container.appendChild(div);
    });

    timeLeft = 10;
    isGameActive = true;
    updateTimerUI();
    
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerUI();
        if(timeLeft <= 0) {
            clearInterval(timerInterval);
            checkAnswer();
        }
    }, 1000);
}

function updateTimerUI() {
    const el = document.getElementById('time-val');
    el.innerText = timeLeft;
    el.parentElement.style.background = timeLeft <= 3 ? "red" : "rgba(255,0,0,0.8)";
}

function checkAnswer() {
    isGameActive = false;
    
    const laneWidth = canvas.width / 5;
    const centerCarX = car.x + (car.w / 2);
    const selectedLane = Math.floor(centerCarX / laneWidth);
    
    const q = levelQuestions[qIndex];
    const correctLane = q.correctIndex;
    const laneNames = ["A", "B", "C", "D", "E"];

    if(selectedLane === correctLane) {
        player.score++;
        playSound('correct'); // เสียงถูกต้อง
        if(player.dbId) db.collection("scores").doc(player.dbId).update({ score: player.score });
    } else {
        playSound('wrong'); // เสียงผิด
        alert(`❌ ผิด! คุณอยู่เลน ${laneNames[selectedLane] || '?'}\nเฉลย: เลน ${laneNames[correctLane]}\n(${q.reason})`);
    }

    document.getElementById('score-val').innerText = player.score;
    qIndex++;
    setTimeout(showQuestion, 1500);
}

// ==========================================
// 6. DRAW LOOP & ANIMATION (ส่วนที่ทำให้ขยับ)
// ==========================================
function getRoadColor() {
    const c = ["#34495e", "#5d4037", "#283593", "#1b5e20", "#212121"];
    return c[currentLevel-1] || "#333";
}

function draw() {
    // --- 1. คำนวณการเคลื่อนที่ถนน ---
    // ถ้าเกมกำลังเล่นอยู่ ให้ถนนเลื่อน
    if(isGameActive) {
        roadOffset += roadSpeed;
        // ถ้าเลื่อนเกินระยะ 1 ช่วงเส้นประ ให้รีเซ็ตกลับ เพื่อความเนียน
        if(roadOffset > 60) roadOffset = 0; 
    }

    // --- 2. วาดถนน ---
    ctx.fillStyle = getRoadColor();
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const laneWidth = canvas.width / 5;
    const labels = ["A", "B", "C", "D", "E"];

    ctx.textAlign = "center";
    ctx.font = "bold 50px Kanit";

    for(let i=0; i<5; i++) {
        // วาดเส้นแบ่งเลน (ขยับได้)
        if(i > 0) {
            ctx.strokeStyle = "rgba(255,255,255,0.4)";
            ctx.setLineDash([30, 30]); // เส้นประยาว 30 เว้น 30
            ctx.lineDashOffset = -roadOffset; // <-- จุดสำคัญที่ทำให้ขยับ!
            
            ctx.beginPath();
            ctx.moveTo(i*laneWidth, 0);
            ctx.lineTo(i*laneWidth, canvas.height);
            ctx.stroke();
        }

        // ตัวอักษรบอกเลน (ให้มันเลื่อนลงมาด้วยเพื่อความสมจริง หรือจะฟิกซ์ไว้ก็ได้)
        // อันนี้ขอฟิกซ์ไว้ที่พื้นจะได้ดูง่ายครับ
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillText(labels[i], (i*laneWidth) + (laneWidth/2), canvas.height - 150);
    }

    // --- 3. วาดรถ ---
    // เพิ่มเอฟเฟกต์รถสั่นเบาๆ เวลาวิ่ง
    let shake = isGameActive ? (Math.random() * 2 - 1) : 0;

    ctx.shadowBlur = 15; ctx.shadowColor = "black";
    ctx.fillStyle = "#ff1744"; 
    ctx.fillRect(car.x + shake, car.y, car.w, car.h);
    
    ctx.fillStyle = "#b71c1c";
    ctx.fillRect(car.x + 5 + shake, car.y + 15, car.w - 10, car.h - 30);
    ctx.shadowBlur = 0;
    
    // ไฟท้าย (กระพริบ)
    ctx.fillStyle = (Math.floor(Date.now() / 200) % 2 === 0) ? "#ff0000" : "#800000";
    ctx.fillRect(car.x + 5 + shake, car.y + car.h - 10, 10, 5); // ซ้าย
    ctx.fillRect(car.x + car.w - 15 + shake, car.y + car.h - 10, 10, 5); // ขวา
}

function gameLoop() {
    draw();
    requestAnimationFrame(gameLoop);
}