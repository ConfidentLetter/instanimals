// --- 1. Global State ---
const state = {
    isLoggedIn: !!localStorage.getItem('token'),
    isDarkMode: localStorage.getItem('theme') === 'dark',
    activeTab: 'explore',
    searchQuery: '',
    likedPosts: [],
    activeChatId: null,
    myProfile: JSON.parse(localStorage.getItem('user_profile')) || {
        name: "Felix Nature",
        bio: "Wildlife enthusiast. Discovering nature's wonders. 🌱",
        avatarSeed: "Felix"
    },
    map: null
};

// --- 2. Data ---
let posts = [
    { id: 1, poster: "John_Nature", text: "Caught this little fox taking a nap in the woods today. So peaceful!", media: "[https://images.unsplash.com/photo-1517683201413-571216591730?auto=format&fit=crop&w=1200&q=80](https://images.unsplash.com/photo-1517683201413-571216591730?auto=format&fit=crop&w=1200&q=80)", likes: 128, location: "California, USA", comments: [{ user: "NatureLens", text: "Amazing shot!" }] },
    { id: 2, poster: "Happy_Paws", isShelter: true, text: "Max is a 2-year-old Golden mix waiting for his forever home! ❤️", media: "[https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1200&q=80](https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1200&q=80)", likes: 2100, location: "New York, USA", comments: [] }
];

const notifications = [
    { id: 1, from: 'Mike', text: 'liked your moment', time: '2m ago' },
    { id: 2, from: 'WildLens', text: 'started following you', time: '1h ago' }
];

const contacts = [{ id: 1, name: "Happy Paws Shelter", lastMsg: "Thanks for your inquiry!", avatar: "Happy", online: true }];
let chatHistory = { 1: [{ sender: 'them', text: 'Hello! How can we help you today?', time: '10:00' }] };
// --- 3. UI Logic ---
function showToast(title, msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<div class="user-avatar" style="width:32px; height:32px; font-size:12px;">!</div><div><div style="font-weight:800; color:var(--text);">${title}</div><div style="font-size:12px; color:var(--muted);">${msg}</div></div>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function switchTab(tabId) {
    state.activeTab = tabId;
    state.activeChatId = null;
    renderApp();
    document.getElementById('main-view').scrollTo(0, 0);
}

function goBack() {
    if (state.activeChatId) state.activeChatId = null;
    else state.activeTab = 'explore';
    renderApp();
}

// --- 4. Auth & Post Functions ---
function openLoginModal(mode = 'login') {
    const modal = document.getElementById('modal-root');
    const content = modal.querySelector('.modal-content');
    const isLogin = mode === 'login';
    content.innerHTML = `
        <div style="position:absolute; top:16px; right:16px; cursor:pointer; color:#ccc;" onclick="closeModal()">✕</div>
        <h2 style="font-weight:900; font-size:24px; margin-bottom:8px; text-align:center;">${isLogin ? 'Welcome Back' : 'Create Account'}</h2>
        <div style="display:grid; gap:12px; margin-top:20px;">
            <input type="email" id="auth-email" placeholder="Email Address" class="input">
            <input type="password" id="auth-pass" placeholder="Password (min 6 chars)" class="input">
            <button class="btn btn-primary" style="margin-top:10px;" onclick="handleAuthSubmit('${mode}')">${isLogin ? 'Sign In' : 'Join Now'}</button>
            <p style="font-size:12px; margin-top:10px; cursor:pointer; text-align:center;" onclick="openLoginModal('${isLogin ? 'signup' : 'login'}')">
                ${isLogin ? "No account? Join now" : "Already have an account? Login"}
            </p>
        </div>`;
    modal.style.display = 'grid';
}

async function handleAuthSubmit(mode) {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    if(!email.includes('@')) return showToast('Error', 'Invalid email address');
    if(pass.length < 6) return showToast('Error', 'Password must be 6+ chars');

    localStorage.setItem('token', 'mock_token');
    state.isLoggedIn = true;
    closeModal();
    renderApp();
    showToast("Welcome", mode === 'login' ? "Logged in!" : "Registered!");
}

function openCreatePostModal() {
    if(!state.isLoggedIn) return openLoginModal();
    const modal = document.getElementById('modal-root');
    const content = modal.querySelector('.modal-content');
    content.innerHTML = `
        <div style="position:absolute; top:16px; right:16px; cursor:pointer; color:#ccc;" onclick="closeModal()">✕</div>
        <h2 style="font-weight:900; font-size:20px; margin-bottom:16px;">Create Moment</h2>
        <textarea id="post-text-input" class="input" style="height:120px; resize:none;" placeholder="What's happening in nature?"></textarea>
        <button class="btn btn-primary" style="width:100%; margin-top:10px;" onclick="handlePostSubmit()">Post Moment</button>`;
    modal.style.display = 'grid';
}

function handlePostSubmit() {
    const text = document.getElementById('post-text-input').value.trim();
    if(!text) return showToast('Error', 'Content cannot be empty');
    posts.unshift({ id: Date.now(), poster: state.myProfile.name, text, media: "", likes: 0, location: "Local", comments: [] });
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

// --- 5. Social Interactivity ---
function toggleComments(postId) {
    const el = document.getElementById(`comments-${postId}`);
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

function submitComment(postId) {
    if(!state.isLoggedIn) return openLoginModal();
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    if(!text) return;
    posts.find(p => p.id === postId).comments.push({ user: state.myProfile.name, text });
    input.value = '';
    renderApp();
    document.getElementById(`comments-${postId}`).style.display = 'block';
}

function toggleLike(postId) {
    if(!state.isLoggedIn) return openLoginModal();
    const post = posts.find(p => p.id === postId);
    if(state.likedPosts.includes(postId)) {
        state.likedPosts = state.likedPosts.filter(id => id !== postId);
        post.likes--;
    } else {
        state.likedPosts.push(postId);
        post.likes++;
    }
    renderApp();
}

function sendChat() {
    if(!state.isLoggedIn) return openLoginModal();
    const input = document.getElementById('chat-input');
    if(!input || !input.value.trim()) return;
    const history = chatHistory[state.activeChatId] || (chatHistory[state.activeChatId] = []);
    history.push({ sender: 'me', text: input.value.trim(), time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
    input.value = '';
    renderApp();
}

// --- 6. Maps & Search ---
async function performShelterSearch(loc) {
    const status = document.getElementById('shelter-status');
    if(!loc.trim()) return status.innerText = "Please enter location.";
    status.innerText = "Searching...";
    
    const resGeo = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc)}&format=json&limit=1`);
    const geoData = await resGeo.json();
    if (!geoData.length) return status.innerText = "Not found.";

    const geo = { lat: +geoData[0].lat, lon: +geoData[0].lon };
    
    const q = `[out:json][timeout:25];(node["amenity"="animal_shelter"](around:20000,${geo.lat},${geo.lon});way["amenity"="animal_shelter"](around:20000,${geo.lat},${geo.lon}););out center tags;`;
    const resOver = await fetch('[https://overpass-api.de/api/interpreter](https://overpass-api.de/api/interpreter)', { method: 'POST', body: q });
    const data = await resOver.json();
    
    const list = document.getElementById('shelter-results');
    list.innerHTML = '';
    if (state.map) state.map.remove();
    state.map = L.map('map').setView([geo.lat, geo.lon], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.map);

    data.elements.forEach(s => {
        const detailHtml = `<div class="shelter-detail-pop"><strong>${s.tags.name || 'Shelter'}</strong><div class="detail-item">🕒 Hours: ${s.tags.opening_hours || 'Varies'}</div></div>`;
        const row = document.createElement('div');
        row.className = 'shelter-result';
        row.innerHTML = `<div class="mini-icon">${(s.tags.name || 'S')[0]}</div><div style="flex:1"><strong>${s.tags.name || 'Shelter'}</strong></div>`;
        row.onclick = () => { state.map.setView([s.lat, s.lon], 15); L.popup().setLatLng([s.lat, s.lon]).setContent(detailHtml).openOn(state.map); };
        list.appendChild(row);
        L.marker([s.lat, s.lon]).addTo(state.map).bindPopup(detailHtml);
    });
    status.innerText = `Found ${data.elements.length} centers.`;
}

// --- 7. Main Rendering Engine ---
function renderApp() {
    const contentArea = document.getElementById('content-area');
    const headerTitle = document.querySelector('#header-title h2');
    const headerLeft = document.getElementById('header-left');
    const userSummary = document.getElementById('user-profile-summary');

    userSummary.innerHTML = state.isLoggedIn ? `
        <div class="user-avatar" onclick="switchTab('profile')" style="cursor:pointer"><img src="[https://api.dicebear.com/7.x/avataaars/svg?seed=$](https://api.dicebear.com/7.x/avataaars/svg?seed=$){state.myProfile.avatarSeed}"></div>
        <div class="user-meta" onclick="switchTab('profile')" style="cursor:pointer"><div class="name">${state.myProfile.name}</div><div class="handle">@user</div></div>` 
        : `<button class="btn btn-ghost" style="width:100%" onclick="openLoginModal()">Sign In</button>`;

    const titles = { 'explore': 'Explore', 'adopt': 'Find Shelters', 'search': 'Search', 'notifications': 'Activity', 'friends': 'Messages', 'settings': 'Settings', 'profile': 'My Profile', 'edit-profile': 'Edit Profile' };
    headerTitle.innerText = state.activeChatId ? "Chat" : titles[state.activeTab];
    headerLeft.innerHTML = (state.activeTab !== 'explore' || state.activeChatId) ? `<button onclick="goBack()" class="header-btn"><i data-lucide="chevron-left"></i></button>` : '';

    contentArea.innerHTML = '';
    switch (state.activeTab) {
        case 'explore': posts.forEach(p => contentArea.insertAdjacentHTML('beforeend', createPostCard(p))); break;
        case 'adopt': renderAdoptView(contentArea); break;
        case 'search': renderSearchView(contentArea); break;
        case 'notifications': renderNotificationsView(contentArea); break;
        case 'friends': state.activeChatId ? renderChatView(contentArea) : renderFriendsListView(contentArea); break;
        case 'settings': renderSettingsView(contentArea); break;
        case 'profile': renderProfileView(contentArea); break;
        case 'edit-profile': renderEditProfileView(contentArea); break;
    }

    document.querySelectorAll('#nav-menu a').forEach(link => link.classList.toggle('active', link.id.includes(state.activeTab)));
    if(window.lucide) lucide.createIcons();
}

function createPostCard(p) {
    const liked = state.likedPosts.includes(p.id);
    return `<div class="card fade-in"><div class="card-pad"><div style="display:flex; gap:12px; margin-bottom:14px;"><div class="user-avatar" style="width:40px; height:40px;"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${p.poster}"></div><div><div class="name" style="font-size:14px;">@${p.poster}</div><div class="handle" style="font-size:11px;">${p.location}</div></div></div><p style="text-align:left; margin-bottom:14px;">${p.text}</p>${p.media?`<img src="${p.media}" style="width:100%; border-radius:12px; margin-bottom:14px;">`:''}<div style="display:flex; gap:12px;"><button onclick="toggleLike(${p.id})" class="btn btn-ghost" style="color:${liked?'var(--accent)':''}"><i data-lucide="heart" style="${liked?'fill:var(--accent)':''}"></i> ${p.likes}</button><button onclick="toggleComments(${p.id})" class="btn btn-ghost"><i data-lucide="message-circle"></i> Comment (${p.comments.length})</button></div></div><div class="comment-area" id="comments-${p.id}"><div style="margin-bottom:12px;">${p.comments.map(c=>`<div class="comment-item"><span class="comment-user">@${c.user}</span><span>${c.text}</span></div>`).join('') || '<p style="color:#ccc; font-size:12px;">No comments yet.</p>'}</div><div style="display:flex; gap:8px;"><input type="text" id="comment-input-${p.id}" class="input" style="padding:8px 12px; font-size:13px;" placeholder="Add comment..."><button class="btn btn-primary" style="padding:8px 16px; font-size:12px;" onclick="submitComment(${p.id})">Post</button></div></div></div>`;
}

function renderAdoptView(c) {
    c.innerHTML = `<div class="card card-pad" style="background:var(--accentSoft); text-align:left;"><h3 class="section-title" style="color:var(--accent)">Find Shelters</h3><div style="display:flex; gap:10px; margin-top:10px;"><input type="text" id="shelter-loc" class="input" placeholder="City or ZIP" style="flex:1;"><button class="btn btn-primary" onclick="performShelterSearch(document.getElementById('shelter-loc').value)">Search</button></div><div id="shelter-status" style="font-size:11px; font-weight:800; color:var(--accent); margin-top:10px;">ENTER LOCATION</div></div><div id="map"></div><div id="shelter-results" style="margin-top:20px;"></div>`;
    setTimeout(() => { if(!state.map) { state.map = L.map('map').setView([37.338, -121.886], 11); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.map); } }, 100);
}

function renderSettingsView(c) {
    c.innerHTML = `<div class="card card-pad" style="text-align:left;"><h3 class="section-title">Settings</h3><div style="margin-top:20px; display:grid; gap:16px;"><div style="display:flex; justify-content:space-between; align-items:center;"><span>Night Mode</span><label class="toggle-switch"><input type="checkbox" onchange="toggleDarkMode()" ${state.isDarkMode?'checked':''}><span class="slider"></span></label></div>${state.isLoggedIn?`<button class="btn btn-ghost" style="width:100%; color:red; border-color:#ffcccc" onclick="handleLogout()">Sign Out</button>`:`<button class="btn btn-primary" style="width:100%" onclick="openLoginModal()">Login</button>`}</div></div>`;
}

function toggleDarkMode() {
    state.isDarkMode = !state.isDarkMode;
    document.body.classList.toggle('dark-mode', state.isDarkMode);
    localStorage.setItem('theme', state.isDarkMode ? 'dark' : 'light');
}

function renderSearchView(c) {
    c.innerHTML = `<div class="card card-pad"><input type="text" id="main-search" class="input" placeholder="Search..." value="${state.searchQuery}"></div><div id="results"></div>`;
    const input = document.getElementById('main-search');
    input.oninput = () => {
        state.searchQuery = input.value;
        const list = document.getElementById('results');
        list.innerHTML = '';
        posts.filter(p => p.text.toLowerCase().includes(state.searchQuery.toLowerCase())).forEach(p => list.insertAdjacentHTML('beforeend', createPostCard(p)));
        if(window.lucide) lucide.createIcons();
    };
    input.focus();
}

function renderChatView(c) {
    const h = chatHistory[state.activeChatId] || [];
    c.innerHTML = `<div class="card" style="height:calc(100vh - 160px); display:flex; flex-direction:column"><div id="chat-scroller" class="no-scrollbar" style="flex:1; padding:20px; overflow-y:auto; display:flex; flex-direction:column; gap:10px; background:var(--bg)">${h.map(m => `<div style="align-self:${m.sender==='me'?'flex-end':'flex-start'}; background:${m.sender==='me'?'var(--accent)':'var(--panel)'}; color:${m.sender==='me'?'#fff':''}; padding:10px 14px; border-radius:14px;">${m.text}</div>`).join('')}</div><div class="card-pad" style="border-top:1px solid var(--border); display:flex; gap:10px"><input id="chat-input" class="input" placeholder="Type..." onkeydown="if(event.key==='Enter') sendChat()"><button class="btn btn-primary" onclick="sendChat()">Send</button></div></div>`;
    const s = document.getElementById('chat-scroller'); if(s) s.scrollTop = s.scrollHeight;
}

function renderFriendsListView(c) {
    if(!state.isLoggedIn) { c.innerHTML = `<p style="text-align:center; padding:40px">Please login.</p>`; return; }
    c.innerHTML = `<div class="card">${contacts.map(con => `<div class="card-pad" onclick="state.activeChatId=${con.id}; renderApp()" style="cursor:pointer; border-bottom:1px solid var(--border); display:flex; gap:12px; align-items:center"><div class="user-avatar"><img src="[https://api.dicebear.com/7.x/avataaars/svg?seed=$](https://api.dicebear.com/7.x/avataaars/svg?seed=$){con.avatar}"></div><div><div class="name">${con.name}</div><div class="handle">${con.lastMsg}</div></div></div>`).join('')}</div>`;
}

function renderProfileView(c) {
    c.innerHTML = `<div class="card card-pad" style="text-align:center"><div class="user-avatar" style="width:100px; height:100px; margin:0 auto 16px"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${state.myProfile.avatarSeed}"></div><h2 class="section-title" style="text-align:center">${state.myProfile.name}</h2><p class="section-sub" style="text-align:center; margin-bottom:20px">${state.myProfile.bio}</p><button class="btn btn-ghost" onclick="state.activeTab='edit-profile'; renderApp()">Edit Profile</button></div>`;
}

function renderEditProfileView(c) {
    c.innerHTML = `<div class="card card-pad" style="text-align:left"><h3 class="section-title">Edit Profile</h3><div style="display:grid; gap:16px; margin-top:15px;"><div><label style="font-size:11px; font-weight:800; color:var(--accent);">USERNAME</label><input type="text" id="edit-name" class="input" value="${state.myProfile.name}"></div><div><label style="font-size:11px; font-weight:800; color:var(--accent);">BIO</label><textarea id="edit-bio" class="input" style="height:100px; resize:none;">${state.myProfile.bio}</textarea></div><div style="display:flex; gap:10px"><button class="btn btn-ghost" style="flex:1" onclick="switchTab('profile')">Cancel</button><button class="btn btn-primary" style="flex:1" onclick="handleEditSave()">Save</button></div></div></div>`;
}

function handleEditSave() {
    const n = document.getElementById('edit-name').value;
    const b = document.getElementById('edit-bio').value;
    if(!n.trim()) return;
    state.myProfile.name = n; state.myProfile.bio = b;
    localStorage.setItem('user_profile', JSON.stringify(state.myProfile));
    switchTab('profile');
}

function renderNotificationsView(c) {
    if(!state.isLoggedIn) { c.innerHTML = `<p style="text-align:center; padding:40px">Please login.</p>`; return; }
    c.innerHTML = `<div class="card">${notifications.map(n => `<div class="card-pad" style="border-bottom:1px solid var(--border); text-align:left"><b>@${n.from}</b> ${n.text}</div>`).join('')}</div>`;
}

// --- 8. Init ---
document.addEventListener('DOMContentLoaded', () => {
    if(state.isDarkMode) document.body.classList.add('dark-mode');
    ['explore', 'adopt', 'search', 'notifications', 'friends', 'settings'].forEach(t => {
        const el = document.getElementById(`nav-${t}`);
        if(el) el.onclick = (e) => { e.preventDefault(); switchTab(t); };
    });

    // Binding functions to window
    window.switchTab = switchTab; window.goBack = goBack; window.openLoginModal = openLoginModal;
    window.closeModal = closeModal; window.handleAuthSubmit = handleAuthSubmit;
    window.openCreatePostModal = openCreatePostModal; window.handlePostSubmit = handlePostSubmit;
    window.toggleComments = toggleComments; window.submitComment = submitComment;
    window.toggleLike = toggleLike; window.sendChat = sendChat;
    window.performShelterSearch = performShelterSearch; window.toggleDarkMode = toggleDarkMode;
    window.handleEditSave = handleEditSave; window.handleLogout = handleLogout;
    
    renderApp();
});
