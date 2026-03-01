// --- 1. Global State ---
const state = {
    isLoggedIn: !!localStorage.getItem('token'),
    activeTab: 'explore',
    searchQuery: '',
    likedPosts: [],
    likedAnimals: {},
    animalComments: {},
    activeChatId: null,
    shelterLocation: '',
    myProfile: JSON.parse(localStorage.getItem('user_profile')) || {
        name: "Felix Nature",
        handle: "Felix",
        bio: "Wildlife enthusiast. Discovering nature's wonders. 🌱",
        avatarSeed: "Felix"
    },
};

// --- Tab/Path Mapping (Fix 6: URL-based navigation) ---
const TAB_PATHS = {
    explore: '/',
    adopt: '/adopt',
    search: '/search',
    notifications: '/notifications',
    friends: '/messages',
    profile: '/profile',
    'edit-profile': '/edit-profile'
};
const PATH_TABS = Object.fromEntries(Object.entries(TAB_PATHS).map(([k, v]) => [v, k]));

// --- ElevenLabs TTS (proxied through backend — key never exposed to client) ---
let _ttsAudio = null;

async function speakAnimalDescription(btn) {
    const card = btn.closest('.animal-card');
    const text = card?.dataset?.desc;
    if (!text) return;

    // Toggle off if already playing
    if (_ttsAudio && !_ttsAudio.paused) {
        _ttsAudio.pause();
        _ttsAudio = null;
        btn.classList.remove('tts-playing');
        return;
    }

    btn.classList.add('tts-playing');
    try {
        const gender = (card.dataset.gender || 'male').toLowerCase();
        const res = await fetch('/generate-animal-speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, gender })
        });
        if (!res.ok) throw new Error(`Server ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        _ttsAudio = new Audio(url);
        _ttsAudio.play();
        _ttsAudio.onended = () => { btn.classList.remove('tts-playing'); URL.revokeObjectURL(url); };
    } catch (err) {
        console.error('TTS error:', err);
        btn.classList.remove('tts-playing');
        showToast('Audio', 'Could not play description.');
    }
}

// --- Animal card interactions ---
function toggleAnimalStar(id, btn) {
    if (!state.isLoggedIn) { openLoginPanel(); return; }
    const isNowLiked = !state.likedAnimals[id];
    state.likedAnimals[id] = isNowLiked;
    btn.classList.toggle('starred', isNowLiked);
    if (isNowLiked) {
        btn.classList.add('star-pop');
        setTimeout(() => btn.classList.remove('star-pop'), 520);
    }
    const label = btn.querySelector('.action-label');
    if (label) label.textContent = isNowLiked ? 'Starred' : 'Star';
}

function triggerShareAnim(btn) {
    btn.classList.add('share-fly');
    setTimeout(() => btn.classList.remove('share-fly'), 600);
    navigator.clipboard?.writeText(window.location.href);
    showToast('Shared!', 'Link copied to clipboard.');
}

function toggleCommentWidget(id, btn) {
    if (!state.isLoggedIn) { openLoginPanel(); return; }
    const drawer = document.getElementById(`comments-${id}`);
    if (!drawer) return;
    const opening = !drawer.classList.contains('open');
    drawer.classList.toggle('open', opening);
    if (opening) {
        renderCommentList(id);
        setTimeout(() => document.getElementById(`comment-input-${id}`)?.focus(), 50);
    }
}

function renderCommentList(id) {
    const list = document.getElementById(`comment-list-${id}`);
    if (!list) return;
    const comments = state.animalComments[id] || [];
    list.innerHTML = comments.length
        ? comments.map(c => `<div class="comment-item"><span class="comment-user">${c.user}</span>${c.text}</div>`).join('')
        : '<div class="comment-empty">No comments yet — be the first!</div>';
}

function submitAnimalComment(id) {
    if (!state.isLoggedIn) { openLoginPanel(); return; }
    const input = document.getElementById(`comment-input-${id}`);
    const text = input?.value.trim();
    if (!text) return;
    if (!state.animalComments[id]) state.animalComments[id] = [];
    state.animalComments[id].push({ user: state.myProfile.name, text });
    input.value = '';
    renderCommentList(id);
}

// --- Login side panel ---
function openLoginPanel(mode = 'login') {
    const inner = document.getElementById('login-panel-inner');
    const isLogin = mode === 'login';
    inner.innerHTML = `
        <div class="panel-logo">
            <img src="https://firebasestorage.googleapis.com/v0/b/instanimals-8f702.firebasestorage.app/o/Instanimals%20LOGO.png?alt=media&token=e5116a91-9459-4330-b0a4-5b6c6b26d020" alt="Instanimals">
            <span>Instanimals</span>
        </div>
        <div class="panel-heading">
            <h2>${isLogin ? 'Welcome back' : 'Create account'}</h2>
            <p>${isLogin ? 'Sign in to star animals, comment, and connect with shelters.' : 'Join to find animals, connect with shelters, and help pets find homes.'}</p>
        </div>
        <div id="panel-auth-error" class="panel-error"></div>
        <div class="panel-fields">
            <div class="panel-field">
                <label>Email</label>
                <input type="email" id="panel-email" class="input" placeholder="you@example.com">
            </div>
            ${!isLogin ? `<div class="panel-field"><label>Username</label><input type="text" id="panel-username" class="input" placeholder="Choose a username"></div>` : ''}
            <div class="panel-field">
                <label>Password</label>
                <input type="password" id="panel-pass" class="input" placeholder="Min. 6 characters">
            </div>
            <button class="btn btn-primary panel-submit" onclick="handlePanelAuth('${mode}')">
                ${isLogin ? 'Sign In' : 'Create Account'}
            </button>
        </div>
        <div class="panel-switch" onclick="openLoginPanel('${isLogin ? 'signup' : 'login'}')">
            ${isLogin ? "No account yet? <strong>Sign up free</strong>" : "Already have an account? <strong>Sign in</strong>"}
        </div>`;
    document.getElementById('login-panel').classList.add('open');
    document.getElementById('login-panel-overlay').classList.add('open');
}

function closeLoginPanel() {
    document.getElementById('login-panel').classList.remove('open');
    document.getElementById('login-panel-overlay').classList.remove('open');
}

async function handlePanelAuth(mode) {
    const email = document.getElementById('panel-email')?.value.trim();
    const pass  = document.getElementById('panel-pass')?.value;
    const errEl = document.getElementById('panel-auth-error');
    const showErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; errEl.classList.add('panel-error'); };
    if (!email?.includes('@')) return showErr('Invalid email address.');
    if (pass?.length < 6)     return showErr('Password must be 6+ characters.');
    try {
        const isSignup = mode === 'signup';
        const username = isSignup ? (document.getElementById('panel-username')?.value.trim() || email.split('@')[0]) : undefined;
        const body = isSignup ? { email, password: pass, username } : { email, password: pass };
        const res  = await fetch(isSignup ? '/api/signup' : '/api/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) return showErr(data.message || 'Something went wrong.');
        state.myProfile.name = data.username;
        state.myProfile.handle = data.handle || data.username;
        state.myProfile.avatarSeed = data.username;
        localStorage.setItem('token', email);
        localStorage.setItem('user_profile', JSON.stringify(state.myProfile));
        state.isLoggedIn = true;
        closeLoginPanel();
        renderApp();
        showToast('Welcome', isSignup ? 'Account created!' : 'Signed in!');
    } catch {
        showErr('Something went wrong. Please try again.');
    }
}

// --- 2. Data ---
<<<<<<< HEAD
let animals = [];
let posts = [
    { id: 1, poster: "John_Nature", text: "Caught this little fox taking a nap in the woods today. So peaceful!", media: "https://images.unsplash.com/photo-1517683201413-571216591730?auto=format&fit=crop&w=1200&q=80", likes: 128, location: "California, USA", comments: [{ user: "NatureLens", text: "Amazing shot!" }] },
    { id: 2, poster: "Happy_Paws", isShelter: true, website: "happypaws.org", text: "Max is a 2-year-old Golden mix waiting for his forever home! ❤️", media: "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1200&q=80", likes: 2100, location: "New York, USA", comments: [] },
    { id: 3, poster: "WildLens", text: "A stunning morning at the lake — spotted this heron right at sunrise. Nature never disappoints. 🌅", media: "https://images.unsplash.com/photo-1444464666168-49d633b86797?auto=format&fit=crop&w=1200&q=80", likes: 340, location: "Oregon, USA", comments: [{ user: "BirdWatch22", text: "What a capture!" }] },
    { id: 4, poster: "San_Jose_Animal_Care", isShelter: true, website: "sanjoseanimals.org", text: "Meet Luna! This 3-year-old tabby is looking for a quiet home. She loves cozy blankets and afternoon naps 🐱", media: "https://images.unsplash.com/photo-1519052537078-e6302a4968d4?auto=format&fit=crop&w=1200&q=80", likes: 876, location: "San José, CA", comments: [] },
    { id: 5, poster: "TrailPhoto", text: "Found this little turtle crossing the trail today. Took my time and waited for it to pass safely 🐢", media: "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?auto=format&fit=crop&w=1200&q=80", likes: 512, location: "Texas, USA", comments: [{ user: "NatureKid", text: "So cute 🐢" }] }
=======

let posts = [
    { id: 1, poster: "John_Nature", text: "Caught this little fox taking a nap in the woods today. So peaceful!", media: "https://images.unsplash.com/photo-1517683201413-571216591730?auto=format&fit=crop&w=1200&q=80", likes: 128, location: "California, USA", comments: [{ user: "NatureLens", text: "Amazing shot!" }] },
    { id: 2, poster: "Happy_Paws", isShelter: true, text: "Max is a 2-year-old Golden mix waiting for his forever home! ❤️", media: "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1200&q=80", likes: 2100, location: "New York, USA", comments: [] }
>>>>>>> da60d5599a336114ec306397310eced1516e3057
];

const notifications = [
    { id: 1, from: 'Mike', text: 'liked your moment', time: '2m ago' },
    { id: 2, from: 'WildLens', text: 'started following you', time: '1h ago' }
];

const contacts = [{ id: 1, name: "Happy Paws Shelter", lastMsg: "Thanks for your inquiry!", avatar: "Happy", online: true }];
let chatHistory = { 1: [{ sender: 'them', text: 'Hello! How can we help you today?', time: '10:00' }] };

// --- 3. Helpers ---
// Fix 3: Format shelter names from raw handle format
function formatShelterName(raw) {
    return raw
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
}

function handleFaviconError(img) {
    img.style.display = 'none';
    img.insertAdjacentHTML('afterend', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="var(--accent)" width="22" height="22"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7H4z"/></svg>');
}

// --- 4. UI Logic ---
function showToast(title, msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast fade-in';
    toast.innerHTML = `<div class="user-avatar" style="width:32px; height:32px; font-size:12px;">!</div><div><div style="font-weight:800; color:var(--text);">${title}</div><div style="font-size:12px; color:var(--muted);">${msg}</div></div>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showAuthError(msg) {
    const existing = document.getElementById('auth-error');
    if (existing) existing.remove();
    const errDiv = document.createElement('div');
    errDiv.id = 'auth-error';
    errDiv.className = 'auth-error';
    errDiv.textContent = msg;
    const firstInput = document.getElementById('auth-email');
    if (firstInput) firstInput.parentNode.insertBefore(errDiv, firstInput);
}

// Fix 6: switchTab uses history.pushState
function switchTab(tabId, pushState = true) {
    state.activeTab = tabId;
    state.activeChatId = null;
    if (pushState) {
        const path = TAB_PATHS[tabId] || '/';
        history.pushState({ tab: tabId }, '', path);
    }
    renderApp();
    const mainView = document.getElementById('main-view');
    if(mainView) mainView.scrollTo(0, 0);
}

function goBack() {
    if (state.activeChatId) {
        state.activeChatId = null;
        renderApp();
    } else {
        history.back();
    }
}

// --- 5. Auth & Post Functions ---
function openLoginModal(mode = 'login') {
    const modal = document.getElementById('modal-root');
    const content = modal.querySelector('.modal-content');
    const isLogin = mode === 'login';
    content.innerHTML = `
        <div style="position:absolute; top:16px; right:16px; cursor:pointer; color:var(--muted);" onclick="closeModal()">✕</div>
        <h2 style="font-weight:900; font-size:24px; margin-bottom:8px; text-align:center;">${isLogin ? 'Welcome Back' : 'Create Account'}</h2>
        <div style="display:grid; gap:12px; margin-top:20px;">
            <input type="email" id="auth-email" placeholder="Email Address" class="input">
            ${!isLogin ? `<input type="text" id="auth-username" placeholder="Username" class="input">` : ''}
            <input type="password" id="auth-pass" placeholder="Password (min 6 chars)" class="input">
            <button class="btn btn-primary" style="margin-top:10px;" onclick="handleAuthSubmit('${mode}')">${isLogin ? 'Sign In' : 'Join Now'}</button>
            <p style="font-size:12px; margin-top:10px; cursor:pointer; text-align:center; color:var(--muted);" onclick="openLoginModal('${isLogin ? 'signup' : 'login'}')">
                ${isLogin ? "No account? Join now" : "Already have an account? Login"}
            </p>
        </div>`;
    modal.style.display = 'grid';
}

// Fix 4: Auth via backend endpoints
async function handleAuthSubmit(mode) {
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-pass').value;
    if (!email.includes('@')) return showAuthError('Invalid email address');
    if (pass.length < 6) return showAuthError('Password must be 6+ characters');

    try {
        const isSignup = mode === 'signup';
        const username = isSignup ? ((document.getElementById('auth-username')?.value || '').trim() || email.split('@')[0]) : undefined;
        const endpoint = isSignup ? '/api/signup' : '/api/login';
        const body = isSignup ? { email, password: pass, username } : { email, password: pass };

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (!res.ok) return showAuthError(data.message);

        state.myProfile.name = data.username;
        state.myProfile.handle = data.handle || data.username;
        state.myProfile.avatarSeed = data.username;
        localStorage.setItem('token', email);
        localStorage.setItem('user_profile', JSON.stringify(state.myProfile));
        state.isLoggedIn = true;
        closeModal();
        renderApp();
        showToast("Welcome", isSignup ? "Account created!" : "Logged in!");
    } catch (e) {
        showAuthError('Something went wrong. Please try again.');
    }
}

function openCreatePostModal() {
    if (!state.isLoggedIn) return openLoginModal();
    const modal = document.getElementById('modal-root');
    const content = modal.querySelector('.modal-content');
    content.innerHTML = `
        <div style="position:absolute; top:16px; right:16px; cursor:pointer; color:var(--muted);" onclick="closeModal()">✕</div>
        <h2 style="font-weight:900; font-size:20px; margin-bottom:16px;">Create Moment</h2>
        <textarea id="post-text-input" class="input" style="height:120px; resize:none;" placeholder="What's happening in nature?"></textarea>
        <button class="btn btn-primary" style="width:100%; margin-top:10px;" onclick="handlePostSubmit()">Post Moment</button>`;
    modal.style.display = 'grid';
}

function handlePostSubmit() {
    const text = document.getElementById('post-text-input').value.trim();
<<<<<<< HEAD
    if (!text) return showToast('Error', 'Content cannot be empty');
    posts.unshift({ id: Date.now(), poster: state.myProfile.name, text, media: "", likes: 0, location: "Local", comments: [] });
=======
    if(!text) return showToast('Error', 'Content cannot be empty');
    posts.unshift({ id: Date.now(), poster: state.myProfile.name, text, media: "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?auto=format&fit=crop&w=1200&q=80", likes: 0, location: "Local", comments: [] });
>>>>>>> da60d5599a336114ec306397310eced1516e3057
    closeModal();
    switchTab('explore');
    showToast('Success', 'Moment shared!');
}

function closeModal() { document.getElementById('modal-root').style.display = 'none'; }

function handleLogout() {
    localStorage.clear();
    state.isLoggedIn = false;
    switchTab('explore');
}

// --- 6. Social Interactivity ---
function toggleComments(postId) {
    const el = document.getElementById(`comments-${postId}`);
    if(el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

function submitComment(postId) {
    if (!state.isLoggedIn) return openLoginModal();
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    if (!text) return;
    posts.find(p => p.id === postId).comments.push({ user: state.myProfile.name, text });
    input.value = '';
    renderApp();
    document.getElementById(`comments-${postId}`).style.display = 'block';
}

function toggleLike(postId) {
    if (!state.isLoggedIn) return openLoginModal();
    const post = posts.find(p => p.id === postId);
    if (state.likedPosts.includes(postId)) {
        state.likedPosts = state.likedPosts.filter(id => id !== postId);
        post.likes--;
    } else {
        state.likedPosts.push(postId);
        post.likes++;
    }
    renderApp();
}

function sendChat() {
    if (!state.isLoggedIn) return openLoginModal();
    const input = document.getElementById('chat-input');
    if (!input || !input.value.trim()) return;
    const history = chatHistory[state.activeChatId] || (chatHistory[state.activeChatId] = []);
    history.push({ sender: 'me', text: input.value.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    input.value = '';
    renderApp();
}

<<<<<<< HEAD
// --- 7. Maps & Search ---
function performShelterSearch(loc) {
    if (!loc.trim()) return;
    state.shelterLocation = loc.trim();
    const frame = document.getElementById('shelter-map-frame');
    if (frame) {
        frame.src = `https://maps.google.com/maps?q=${encodeURIComponent('animal shelters near ' + loc)}&output=embed`;
=======
// --- 6. Maps & Search ---
async function performShelterSearch(loc) {
    const status = document.getElementById('shelter-status');
    if(!loc.trim()) return status.innerText = "Please enter location.";
    status.innerText = "Searching... (Takes 2-3 seconds)";
    
    try {
  
        const resGeo = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc)}&format=json&limit=1`);
        const geoData = await resGeo.json();
        if (!geoData.length) {
            status.innerText = "Location not found.";
            return;
        }

        const geo = { lat: +geoData[0].lat, lon: +geoData[0].lon };
        const q = `[out:json][timeout:25];(node["amenity"="animal_shelter"](around:20000,${geo.lat},${geo.lon});way["amenity"="animal_shelter"](around:20000,${geo.lat},${geo.lon}););out center tags;`;
        
 
        const resOver = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q });
        const data = await resOver.json();
        
        const list = document.getElementById('shelter-results');
        list.innerHTML = '';
        if (state.map) state.map.remove();
        state.map = L.map('map').setView([geo.lat, geo.lon], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.map);

        const shelters = (data.elements || []).map(el => {
            const tags = el.tags || {};
            const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
            const cityStateZip = [tags['addr:city'], tags['addr:state'], tags['addr:postcode']].filter(Boolean).join(', ');
            const fullAddr = [street, cityStateZip].filter(Boolean).join(', ') || tags['addr:full'] || 'Detailed address not listed on map';

            return {
                name: tags.name || 'Shelter Center',
                addr: fullAddr,
                hours: tags.opening_hours || 'Contact for info',
                phone: tags.phone || tags['contact:phone'] || 'N/A',
                website: tags.website || tags['contact:website'] || '',
                lat: el.lat || el.center?.lat,
                lon: el.lon || el.center?.lon
            };
        });

        if (!shelters.length) {
            list.innerHTML = '<p style="padding:20px; color:var(--muted); text-align:center;">No shelters found in this range.</p>';
        } else {
            shelters.forEach(s => {
                const detailHtml = `
                    <div class="shelter-detail-pop">
                        <strong style="color:var(--accent2); font-size:14px;">${s.name}</strong>
                        <div class="detail-item"><i data-lucide="map-pin"></i><span style="flex:1;">${s.addr}</span></div>
                        <div class="detail-item"><i data-lucide="clock"></i><span>Hours: ${s.hours}</span></div>
                        <div class="detail-item"><i data-lucide="phone"></i><span>${s.phone}</span></div>
                        ${s.website ? `<div class="detail-item"><i data-lucide="link"></i><a href="${s.website}" target="_blank" style="color:var(--accent)">Website</a></div>` : ''}
                    </div>`;
                const row = document.createElement('div');
                row.className = 'shelter-result fade-in';
                row.innerHTML = `<div class="mini-icon">${s.name[0]}</div><div style="flex:1"><strong>${s.name}</strong><div style="font-size:12px; color:var(--muted); margin-top:4px;">${s.addr}</div></div>`;
                row.onclick = () => { 
                    state.map.setView([s.lat, s.lon], 15); 
                    L.popup().setLatLng([s.lat, s.lon]).setContent(detailHtml).openOn(state.map); 
                    if(window.lucide) lucide.createIcons();
                };
                list.appendChild(row);
                L.marker([s.lat, s.lon]).addTo(state.map).bindPopup(detailHtml).on('click', () => {
                    if(window.lucide) setTimeout(() => lucide.createIcons(), 10);
                });
            });
        }
        status.innerText = `Found ${shelters.length} centers.`;
        if(window.lucide) lucide.createIcons();

    } catch (err) {
        status.innerText = "Error connecting to map server.";
>>>>>>> da60d5599a336114ec306397310eced1516e3057
    }
}

// --- 8. Gate View (unauthenticated) ---
function renderGateView(contentArea) {
    const previews = [
        { name: "Buddy",  image: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&q=80" },
        { name: "Luna",   image: "https://images.unsplash.com/photo-1519052537078-e6302a4968d4?w=600&q=80" },
        { name: "Max",    image: "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=600&q=80" },
        { name: "Rocky",  image: "https://images.unsplash.com/photo-1552053831-71594a27632d?w=600&q=80" },
    ];
    const previewHtml = previews.map(a => `
        <div class="gate-preview-card">
            <img src="${a.image}" alt="${a.name}">
            <div class="gate-preview-label">${a.name}</div>
        </div>`).join('');

    contentArea.innerHTML = `
        <div class="gate-wrapper">
            <div class="gate-blur-section">
                <div class="gate-grid">${previewHtml}</div>
                <div class="gate-lock">🔒</div>
            </div>
            <div class="card card-pad gate-cta">
                <h2 class="section-title" style="text-align:center; font-size:24px; margin-bottom:6px;">Find animals near you</h2>
                <p class="section-sub" style="text-align:center; margin:0 0 24px; font-size:14px; line-height:1.6;">Join Instanimals to see adoptable pets, connect with local shelters, and help animals in need.</p>
                <button class="btn btn-primary" style="width:100%; margin-bottom:12px;" onclick="window.location.href='/pages/form.html'">Become a Foster Family</button>
                <button class="btn btn-ghost" style="width:100%;" onclick="openLoginModal()">Log In</button>
                <p style="font-size:12px; text-align:center; color:var(--muted); margin-top:16px;">
                    Just want an account? <span style="color:var(--accent); cursor:pointer; font-weight:800;" onclick="openLoginModal('signup')">Sign up here.</span>
                </p>
            </div>
        </div>`;
}

// --- 9. Main Rendering Engine ---
function renderApp() {
    const contentArea = document.getElementById('content-area');
    const headerTitle = document.querySelector('#header-title h2');
    const headerLeft = document.getElementById('header-left');
    const userSummary = document.getElementById('user-profile-summary');

    if(!contentArea || !headerTitle || !headerLeft || !userSummary) return;

    userSummary.innerHTML = state.isLoggedIn ? `
        <div class="user-avatar" onclick="switchTab('profile')" style="cursor:pointer"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${state.myProfile.avatarSeed}"></div>
<<<<<<< HEAD
        <div class="user-meta" onclick="switchTab('profile')" style="cursor:pointer"><div class="name">${state.myProfile.name}</div><div class="handle">@${state.myProfile.handle || state.myProfile.name}</div></div>`
=======
        <div class="user-meta" onclick="switchTab('profile')" style="cursor:pointer"><div class="name">${state.myProfile.name}</div><div class="handle">@user</div></div>` 
>>>>>>> da60d5599a336114ec306397310eced1516e3057
        : `<button class="btn btn-ghost" style="width:100%" onclick="openLoginModal()">Sign In</button>`;

    const titles = { 'explore': 'Explore', 'adopt': 'Find Shelters', 'search': 'Search', 'notifications': 'Activity', 'friends': 'Messages', 'settings': 'Settings', 'profile': 'My Profile', 'edit-profile': 'Edit Profile' };
    headerTitle.innerText = state.activeChatId ? "Chat" : (state.isLoggedIn ? titles[state.activeTab] : 'Instanimals');
    headerLeft.innerHTML = (state.isLoggedIn && (state.activeTab !== 'explore' || state.activeChatId)) ? `<button onclick="goBack()" class="header-btn"><i data-lucide="chevron-left"></i></button>` : '';

    contentArea.innerHTML = '';

    if (!state.isLoggedIn) {
        renderGateView(contentArea);
    } else {
        switch (state.activeTab) {
            case 'explore':
                if (!animalsLoaded) {
                    contentArea.innerHTML = `<div class="loading-dots">
                        <div class="loading-dot"></div>
                        <div class="loading-dot"></div>
                        <div class="loading-dot"></div>
                    </div>`;
                    loadAnimals();
                } else if (animals.length === 0) {
                    contentArea.innerHTML = '<div style="text-align:center; padding:40px; color:var(--muted); font-weight:700;">No animals found. Try again later.</div>';
                } else {
                    animals.forEach(a => contentArea.insertAdjacentHTML('beforeend', createAnimalCard(a)));
                }
                break;
            case 'adopt': renderAdoptView(contentArea); break;
            case 'search': renderSearchView(contentArea); break;
            case 'notifications': renderNotificationsView(contentArea); break;
            case 'friends': state.activeChatId ? renderChatView(contentArea) : renderFriendsListView(contentArea); break;
            case 'profile': renderProfileView(contentArea); break;
            case 'edit-profile': renderEditProfileView(contentArea); break;
        }
    }

<<<<<<< HEAD
    document.querySelectorAll('#nav-menu a').forEach(link => link.classList.toggle('active', link.id.includes(state.activeTab)));
    document.querySelectorAll('#bottom-nav a').forEach(link => link.classList.toggle('active', link.id.includes(state.activeTab)));
    if (window.lucide) lucide.createIcons();
=======
    document.querySelectorAll('#nav-menu a').forEach(link => {
        const id = link.id.split('-')[1];
        link.classList.toggle('active', id === state.activeTab);
    });

    if(window.lucide) lucide.createIcons();
>>>>>>> da60d5599a336114ec306397310eced1516e3057
}

// Fix 2 & 3: Shelter favicon/person icon and formatted name
function createPostCard(p) {
    const liked = state.likedPosts.includes(p.id);
<<<<<<< HEAD
    const displayName = p.isShelter ? formatShelterName(p.poster) : `@${p.poster}`;
    let avatarContent;
    if (p.isShelter) {
        if (p.website) {
            avatarContent = `<img src="https://www.google.com/s2/favicons?domain=${p.website}&sz=64" onerror="handleFaviconError(this)" style="width:24px;height:24px;">`;
        } else {
            avatarContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="var(--accent)" width="22" height="22"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7H4z"/></svg>`;
        }
    } else {
        avatarContent = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${p.poster}">`;
    }
    return `<div class="card fade-in"><div class="card-pad"><div style="display:flex; gap:12px; margin-bottom:14px;"><div class="user-avatar" style="width:40px; height:40px;">${avatarContent}</div><div><div class="name" style="font-size:14px;">${displayName}</div><div class="handle" style="font-size:11px;">${p.location}</div></div></div><p style="text-align:left; margin-bottom:14px;">${p.text}</p>${p.media ? `<img src="${p.media}" style="width:100%; border-radius:12px; margin-bottom:14px;">` : ''}<div style="display:flex; gap:12px;"><button onclick="toggleLike(${p.id})" class="btn btn-ghost" style="color:${liked ? 'var(--accent)' : ''}"><i data-lucide="heart" style="${liked ? 'fill:var(--accent)' : ''}"></i> ${p.likes}</button><button onclick="toggleComments(${p.id})" class="btn btn-ghost"><i data-lucide="message-circle"></i> Comment (${p.comments.length})</button></div></div><div class="comment-area" id="comments-${p.id}"><div style="margin-bottom:12px;">${p.comments.map(c => `<div class="comment-item"><span class="comment-user">@${c.user}</span><span>${c.text}</span></div>`).join('') || '<p style="color:#ccc; font-size:12px;">No comments yet.</p>'}</div><div style="display:flex; gap:8px;"><input type="text" id="comment-input-${p.id}" class="input" style="padding:8px 12px; font-size:13px;" placeholder="Add comment..."><button class="btn btn-primary" style="padding:8px 16px; font-size:12px;" onclick="submitComment(${p.id})">Post</button></div></div></div>`;
}

function createAnimalCard(a) {
    const shelterName = a.shelter || 'Local Shelter';
    const firstLetter = shelterName[0].toUpperCase();
    const caption = a.description
        ? a.description.slice(0, 220) + (a.description.length > 220 ? '…' : '')
        : '';
    const meta = [a.age, a.size, a.gender].filter(Boolean).join(' · ');
    const ttsText = a.description ||
        [a.name, a.breeds ? `a ${a.breeds}` : null, a.age, a.gender ? `${a.gender.toLowerCase()}` : null]
            .filter(Boolean).join(', ') + '. Looking for a loving home!';
    const descAttr = ttsText.replace(/"/g, '&quot;');
    const genderAttr = (a.gender || '').toLowerCase();
    const isStarred = !!state.likedAnimals[a.id];

    const urgencyMap = {
        critical: { label: 'Critical', color: '#e53e3e', bg: '#fff5f5', border: '#feb2b2' },
        high:     { label: 'High',     color: '#dd6b20', bg: '#fffaf0', border: '#fbd38d' },
        medium:   { label: 'Medium',   color: '#b7791f', bg: '#fffff0', border: '#f6e05e' },
        low:      { label: 'Low',      color: '#276749', bg: '#f0fff4', border: '#9ae6b4' },
    };
    const urgency = urgencyMap[a.urgency] || null;
    const urgencyBadge = urgency
        ? `<span class="urgency-badge" style="background:${urgency.bg}; color:${urgency.color}; border-color:${urgency.border};">${urgency.label} Urgency</span>`
        : '';

    return `<div class="animal-card fade-in" data-desc="${descAttr}" data-gender="${genderAttr}">
        <div class="animal-card-header">
            <div class="animal-avatar">${firstLetter}</div>
            <div style="flex:1; min-width:0;">
                <div class="animal-shelter-name">${shelterName}</div>
                ${a.location ? `<div class="animal-shelter-loc">${a.location}</div>` : ''}
            </div>
            ${urgencyBadge}
            <button class="tts-btn" onclick="speakAnimalDescription(this)" title="Listen"><i data-lucide="volume-2"></i></button>
        </div>
        ${a.image ? `
        <div class="animal-img-wrap">
            <img class="animal-img" src="${a.image}" alt="${a.name}" onerror="this.parentElement.style.display='none'">
            <div class="animal-img-overlay"></div>
            <div class="animal-name-badge">${a.name}</div>
        </div>` : ''}
        <div class="animal-body">
            <div class="animal-meta-row">
                ${a.breeds ? `<span class="animal-breed-tag">${a.breeds}</span>` : ''}
                ${meta ? `<span class="animal-meta-text">${meta}</span>` : ''}
            </div>
            ${caption ? `<p class="animal-caption">${caption}</p>` : ''}
        </div>
        <div class="animal-actions">
            <button class="animal-btn star-btn ${isStarred ? 'starred' : ''}" onclick="toggleAnimalStar('${a.id}', this)">
                <i data-lucide="star"></i>
                <span class="action-label">${isStarred ? 'Starred' : 'Star'}</span>
            </button>
            <button class="animal-btn comment-btn" onclick="toggleCommentWidget('${a.id}', this)">
                <i data-lucide="message-square"></i>
                <span class="action-label">Comment</span>
            </button>
            <button class="animal-btn share-btn" onclick="triggerShareAnim(this)">
                <i data-lucide="send"></i>
                <span class="action-label">Share</span>
            </button>
            <button class="animal-btn" onclick="showToast('Adopt ♡', 'Contact your local shelter to meet ${a.name}!')">
                <i data-lucide="heart"></i>
                <span class="action-label">Adopt</span>
            </button>
        </div>
        <div class="comment-drawer" id="comments-${a.id}">
            <div class="comment-list" id="comment-list-${a.id}"></div>
            <div class="comment-input-row">
                <input type="text" class="input comment-input" id="comment-input-${a.id}"
                    placeholder="Write a comment…"
                    onkeydown="if(event.key==='Enter') submitAnimalComment('${a.id}')">
                <button class="animal-btn" style="flex:0; padding:8px 12px; border:none;"
                    onclick="submitAnimalComment('${a.id}')">
                    <i data-lucide="send"></i>
                </button>
            </div>
        </div>
    </div>`;
}

function renderAdoptView(c) {
    const savedLoc = state.shelterLocation || '';
    const mapQuery = savedLoc ? `animal shelters near ${savedLoc}` : 'animal shelters';
    const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;
    c.innerHTML = `
        <div class="card card-pad" style="background:var(--accentSoft);">
            <h3 class="section-title" style="color:var(--accent)">Find Shelters</h3>
            <div style="display:flex; gap:10px; margin-top:10px;">
                <input type="text" id="shelter-loc" class="input" placeholder="City, ZIP, or address"
                    style="flex:1;" value="${savedLoc}"
                    onkeydown="if(event.key==='Enter') performShelterSearch(this.value)">
                <button class="btn btn-primary" onclick="performShelterSearch(document.getElementById('shelter-loc').value)">Search</button>
            </div>
        </div>
        <div style="border-radius:var(--radius); overflow:hidden; margin-top:16px; box-shadow:var(--shadow);">
            <iframe id="shelter-map-frame" src="${mapSrc}"
                width="100%" height="500" style="border:0; display:block;"
                allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade">
            </iframe>
        </div>`;
=======
    return `
        <div class="card fade-in">
            <div class="card-pad">
                <div style="display:flex; gap:12px; margin-bottom:14px;">
                    <div class="user-avatar" style="width:40px; height:40px;"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${p.poster}"></div>
                    <div style="text-align:left;"><div class="name" style="font-size:14px;">@${p.poster}</div><div class="handle" style="font-size:11px;">${p.location}</div></div>
                </div>
                <p style="text-align:left; margin-bottom:14px; line-height:1.5;">${p.text}</p>
                ${p.media ? `<img src="${p.media}" style="width:100%; border-radius:12px; margin-bottom:14px;">` : ''}
                <div style="display:flex; gap:12px;">
                    <button onclick="toggleLike(${p.id})" class="btn btn-ghost" style="color:${liked ? 'var(--accent)' : 'var(--text)'}; display:flex; align-items:center; gap:6px;"><i data-lucide="heart" style="${liked ? 'fill:var(--accent)' : ''}; width:16px;"></i> ${p.likes}</button>
                    <button onclick="toggleComments(${p.id})" class="btn btn-ghost" style="display:flex; align-items:center; gap:6px;"><i data-lucide="message-circle" style="width:16px;"></i> Comment (${p.comments.length})</button>
                </div>
            </div>
            <div class="comment-area" id="comments-${p.id}">
                <div style="margin-bottom:12px;">${p.comments.map(c=>`<div class="comment-item"><span class="comment-user">@${c.user}</span><span>${c.text}</span></div>`).join('') || '<p style="color:var(--muted); font-size:12px;">No comments yet.</p>'}</div>
                <div style="display:flex; gap:8px;">
                    <input type="text" id="comment-input-${p.id}" class="input" style="padding:8px 12px; font-size:13px;" placeholder="Add a comment...">
                    <button class="btn btn-primary" style="padding:8px 16px; font-size:12px;" onclick="submitComment(${p.id})">Post</button>
                </div>
            </div>
        </div>`;
}

function renderAdoptView(c) {
    c.innerHTML = `<div class="card card-pad" style="background:var(--accentSoft); text-align:left;"><h3 class="section-title" style="color:var(--accent)">Find Shelters</h3><div style="display:flex; gap:10px; margin-top:10px;"><input type="text" id="shelter-loc" class="input" placeholder="City or ZIP" style="flex:1;"><button class="btn btn-primary" onclick="performShelterSearch(document.getElementById('shelter-loc').value)">Search</button></div><div id="shelter-status" style="font-size:11px; font-weight:800; color:var(--accent); margin-top:10px;">ENTER LOCATION</div></div><div id="map"></div><div id="shelter-results" style="margin-top:20px;"></div>`;
    setTimeout(() => { if(!state.map) { state.map = L.map('map').setView([37.338, -121.886], 11); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.map); } }, 100);
}

function renderSettingsView(c) {
    c.innerHTML = `<div class="card card-pad" style="text-align:left;"><h3 class="section-title">Settings</h3><div style="margin-top:20px; display:grid; gap:16px;"><div style="display:flex; justify-content:space-between; align-items:center;"><span>Night Mode</span><label class="toggle-switch"><input type="checkbox" onchange="toggleDarkMode()" ${state.isDarkMode?'checked':''}><span class="slider"></span></label></div>${state.isLoggedIn?`<button class="btn btn-ghost" style="width:100%; color:red; border-color:#ffcccc;" onclick="handleLogout()">Sign Out</button>`:`<button class="btn btn-primary" style="width:100%" onclick="openLoginModal()">Login</button>`}</div></div>`;
}

function toggleDarkMode() {
    state.isDarkMode = !state.isDarkMode;
    document.body.classList.toggle('dark-mode', state.isDarkMode);
    localStorage.setItem('theme', state.isDarkMode ? 'dark' : 'light');
>>>>>>> da60d5599a336114ec306397310eced1516e3057
}

function renderSearchView(c) {
    c.innerHTML = `<div class="card card-pad"><input type="text" id="main-search" class="input" placeholder="Search..." value="${state.searchQuery}"></div><div id="results"></div>`;
    const input = document.getElementById('main-search');
<<<<<<< HEAD
    input.oninput = () => {
        state.searchQuery = input.value;
        const list = document.getElementById('results');
        list.innerHTML = '';
        posts.filter(p => p.text.toLowerCase().includes(state.searchQuery.toLowerCase())).forEach(p => list.insertAdjacentHTML('beforeend', createPostCard(p)));
        if (window.lucide) lucide.createIcons();
    };
    input.focus();
=======
    if(input) {
        input.oninput = () => {
            state.searchQuery = input.value;
            const list = document.getElementById('results');
            if(list) {
                list.innerHTML = '';
                posts.filter(p => p.text.toLowerCase().includes(state.searchQuery.toLowerCase())).forEach(p => list.insertAdjacentHTML('beforeend', createPostCard(p)));
            }
            if(window.lucide) lucide.createIcons();
        };
        input.focus();
    }
>>>>>>> da60d5599a336114ec306397310eced1516e3057
}

function renderChatView(c) {
    const h = chatHistory[state.activeChatId] || [];
<<<<<<< HEAD
    c.innerHTML = `<div class="card" style="height:calc(100vh - 160px); display:flex; flex-direction:column"><div id="chat-scroller" class="no-scrollbar" style="flex:1; padding:20px; overflow-y:auto; display:flex; flex-direction:column; gap:10px; background:var(--bg)">${h.map(m => `<div style="align-self:${m.sender === 'me' ? 'flex-end' : 'flex-start'}; background:${m.sender === 'me' ? 'var(--accent)' : 'var(--panel)'}; color:${m.sender === 'me' ? '#fff' : ''}; padding:10px 14px; border-radius:14px;">${m.text}</div>`).join('')}</div><div class="card-pad" style="border-top:1px solid var(--border); display:flex; gap:10px"><input id="chat-input" class="input" placeholder="Type..." onkeydown="if(event.key==='Enter') sendChat()"><button class="btn btn-primary" onclick="sendChat()">Send</button></div></div>`;
    const s = document.getElementById('chat-scroller'); if (s) s.scrollTop = s.scrollHeight;
}

function renderFriendsListView(c) {
    if (!state.isLoggedIn) { c.innerHTML = `<p style="text-align:center; padding:40px">Please login.</p>`; return; }
=======
    c.innerHTML = `<div class="card" style="height:calc(100vh - 160px); display:flex; flex-direction:column"><div id="chat-scroller" class="no-scrollbar" style="flex:1; padding:20px; overflow-y:auto; display:flex; flex-direction:column; gap:10px; background:var(--bg)">${h.map(m => `<div style="align-self:${m.sender==='me'?'flex-end':'flex-start'}; background:${m.sender==='me'?'var(--accent)':'var(--panel)'}; color:${m.sender==='me'?'#fff':'var(--text)'}; padding:10px 14px; border-radius:14px;">${m.text}</div>`).join('')}</div><div class="card-pad" style="border-top:1px solid var(--border); display:flex; gap:10px"><input id="chat-input" class="input" placeholder="Type a message..." onkeydown="if(event.key==='Enter') sendChat()"><button class="btn btn-primary" onclick="sendChat()">Send</button></div></div>`;
    const s = document.getElementById('chat-scroller'); if(s) s.scrollTop = s.scrollHeight;
}

function renderFriendsListView(c) {
    if(!state.isLoggedIn) { c.innerHTML = `<p style="text-align:center; padding:40px; color:var(--muted);">Please login to view messages.</p>`; return; }
>>>>>>> da60d5599a336114ec306397310eced1516e3057
    c.innerHTML = `<div class="card">${contacts.map(con => `<div class="card-pad" onclick="state.activeChatId=${con.id}; renderApp()" style="cursor:pointer; border-bottom:1px solid var(--border); display:flex; gap:12px; align-items:center"><div class="user-avatar"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${con.avatar}"></div><div><div class="name">${con.name}</div><div class="handle">${con.lastMsg}</div></div></div>`).join('')}</div>`;
}

function renderProfileView(c) {
    c.innerHTML = `<div class="card card-pad" style="text-align:center"><div class="user-avatar" style="width:100px; height:100px; margin:0 auto 16px"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${state.myProfile.avatarSeed}"></div><h2 class="section-title" style="text-align:center">${state.myProfile.name}</h2><p class="section-sub" style="text-align:center; margin-bottom:20px">${state.myProfile.bio}</p><div style="display:flex; gap:10px; justify-content:center;"><button class="btn btn-ghost" onclick="state.activeTab='edit-profile'; renderApp()">Edit Profile</button><button class="btn btn-ghost" style="color:#c0392b; border-color:#fdb8b8;" onclick="handleLogout()">Sign Out</button></div></div>`;
}

function renderEditProfileView(c) {
    c.innerHTML = `<div class="card card-pad" style="text-align:left"><h3 class="section-title">Edit Profile</h3><div style="display:grid; gap:16px; margin-top:15px;"><div><label style="font-size:11px; font-weight:800; color:var(--accent);">USERNAME</label><input type="text" id="edit-name" class="input" value="${state.myProfile.name}"></div><div><label style="font-size:11px; font-weight:800; color:var(--accent);">BIO</label><textarea id="edit-bio" class="input" style="height:100px; resize:none;">${state.myProfile.bio}</textarea></div><div style="display:flex; gap:10px"><button class="btn btn-ghost" style="flex:1" onclick="switchTab('profile')">Cancel</button><button class="btn btn-primary" style="flex:1" onclick="handleEditSave()">Save</button></div></div></div>`;
}

function handleEditSave() {
    const n = document.getElementById('edit-name').value;
    const b = document.getElementById('edit-bio').value;
    if (!n.trim()) return;
    state.myProfile.name = n; state.myProfile.bio = b;
    localStorage.setItem('user_profile', JSON.stringify(state.myProfile));
    switchTab('profile');
}

function renderNotificationsView(c) {
<<<<<<< HEAD
    if (!state.isLoggedIn) { c.innerHTML = `<p style="text-align:center; padding:40px">Please login.</p>`; return; }
=======
    if(!state.isLoggedIn) { c.innerHTML = `<p style="text-align:center; padding:40px; color:var(--muted);">Please login to view activity.</p>`; return; }
>>>>>>> da60d5599a336114ec306397310eced1516e3057
    c.innerHTML = `<div class="card">${notifications.map(n => `<div class="card-pad" style="border-bottom:1px solid var(--border); text-align:left"><b>@${n.from}</b> ${n.text}</div>`).join('')}</div>`;
}

// --- 9. Init ---
let reachedEndShown = false;
let animalsLoaded = false;

async function loadAnimals() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('/api/adoptable-animals', { signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            animals = data;
        }
    } catch (e) {
        // keep animals empty, fallback message shown
    }
    animalsLoaded = true;
    renderApp();
}

document.addEventListener('DOMContentLoaded', () => {
<<<<<<< HEAD
    // Sync with system dark mode preference
    const darkMatcher = window.matchMedia('(prefers-color-scheme: dark)');
    document.body.classList.toggle('dark-mode', darkMatcher.matches);
    darkMatcher.addEventListener('change', e => document.body.classList.toggle('dark-mode', e.matches));

    // Fix 6: Parse initial URL to determine starting tab
    const initialTab = PATH_TABS[window.location.pathname] || 'explore';
    state.activeTab = initialTab;
    history.replaceState({ tab: initialTab }, '', window.location.pathname);

    // Sidebar nav bindings
    ['explore', 'adopt', 'search', 'notifications', 'friends'].forEach(t => {
=======
    if(state.isDarkMode) document.body.classList.add('dark-mode');
    
    ['explore', 'adopt', 'search', 'notifications', 'friends', 'settings'].forEach(t => {
>>>>>>> da60d5599a336114ec306397310eced1516e3057
        const el = document.getElementById(`nav-${t}`);
        if (el) el.onclick = (e) => { e.preventDefault(); switchTab(t); };
    });

<<<<<<< HEAD
    // Bottom nav bindings
    ['explore', 'adopt', 'search', 'notifications'].forEach(t => {
        const el = document.getElementById(`mobile-nav-${t}`);
        if (el) el.onclick = (e) => { e.preventDefault(); switchTab(t); };
    });

    // Fix 6: Back/forward button support
    window.addEventListener('popstate', (e) => {
        const tab = e.state?.tab || 'explore';
        state.activeTab = tab;
        state.activeChatId = null;
        renderApp();
        document.getElementById('main-view').scrollTo(0, 0);
    });

    // Fix 5: Infinite scroll illusion
    const mainView = document.getElementById('main-view');
    mainView.addEventListener('scroll', () => {
        if (state.activeTab !== 'explore') return;
        const { scrollTop, scrollHeight, clientHeight } = mainView;
        if (scrollTop + clientHeight >= scrollHeight - 10 && !reachedEndShown) {
            reachedEndShown = true;
            const endMsg = document.createElement('div');
            endMsg.className = 'end-of-feed';
            endMsg.textContent = "You've reached the end!";
            document.getElementById('content-area').appendChild(endMsg);
            setTimeout(() => {
                endMsg.remove();
                mainView.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => { reachedEndShown = false; }, 800);
            }, 1500);
        }
    });

    // Expose to window for inline HTML handlers
    window.switchTab = switchTab; window.goBack = goBack; window.openLoginModal = openLoginModal;
    window.closeModal = closeModal; window.handleAuthSubmit = handleAuthSubmit;
    window.openCreatePostModal = openCreatePostModal; window.handlePostSubmit = handlePostSubmit;
    window.toggleComments = toggleComments; window.submitComment = submitComment;
    window.toggleLike = toggleLike; window.sendChat = sendChat;
    window.performShelterSearch = performShelterSearch;
    window.handleEditSave = handleEditSave; window.handleLogout = handleLogout;
    window.handleFaviconError = handleFaviconError;
    window.loadAnimals = loadAnimals;
    window.speakAnimalDescription = speakAnimalDescription;
    window.toggleAnimalStar = toggleAnimalStar;
    window.triggerShareAnim = triggerShareAnim;
    window.toggleCommentWidget = toggleCommentWidget;
    window.submitAnimalComment = submitAnimalComment;
    window.openLoginPanel = openLoginPanel;
    window.closeLoginPanel = closeLoginPanel;
    window.handlePanelAuth = handlePanelAuth;

=======
    window.switchTab = switchTab; 
    window.goBack = goBack; 
    window.openLoginModal = openLoginModal;
    window.closeModal = closeModal; 
    window.handleAuthSubmit = handleAuthSubmit;
    window.openCreatePostModal = openCreatePostModal; 
    window.handlePostSubmit = handlePostSubmit;
    window.toggleComments = toggleComments; 
    window.submitComment = submitComment;
    window.toggleLike = toggleLike; 
    window.sendChat = sendChat;
    window.performShelterSearch = performShelterSearch; 
    window.toggleDarkMode = toggleDarkMode;
    window.handleEditSave = handleEditSave; 
    window.handleLogout = handleLogout;
    
>>>>>>> da60d5599a336114ec306397310eced1516e3057
    renderApp();
});