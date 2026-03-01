// --- 1. Global State Management ---
const state = {
    isLoggedIn: false,
    activeTab: 'explore',
    searchQuery: '',
    likedPosts: [],
    savedPosts: [],
    viewingPostId: null,
    viewingUserName: null,
    activeChatId: null,
    isMobileSidebarOpen: false
};

const myProfile = {
    name: "Felix Nature",
    handle: "@felix_wild",
    bio: "Passionate about wildlife photography and nature conservation. 🌲",
    avatarSeed: "Felix"
};

// --- 2. Mock Data ---
let posts = [
    { id: 1, poster: "John_Nature", text: "Spotted this little Red Fox napping in a California forest today. So peaceful!", media: "https://images.unsplash.com/photo-1517683201413-571216591730?auto=format&fit=crop&w=1200&q=80", likes: 128, breed: "Fox", location: "California, USA" },
    { id: 2, poster: "Happy_Paws", isShelter: true, text: "Meet Max! He's a 2-year-old Golden mix waiting for his forever home. ❤️", media: "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1200&q=80", likes: 2100, breed: "Dog", location: "New York, USA" },
    { id: 3, poster: "Luna_Cat", text: "The new family member is still a bit shy, but absolutely adorable.", media: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1200&q=80", likes: 540, breed: "Cat", location: "Austin, Texas" }
];

const notifications = [
    { id: 1, type: 'like', from: 'Mike', text: 'liked your photo', time: '2m ago', postId: 1 },
    { id: 2, type: 'follow', from: 'Wildlife_Pro', text: 'started following you', time: '1h ago', postId: null }
];

const contacts = [
    { id: 1, name: "Happy Paws Shelter", lastMsg: "Thanks for your inquiry!", avatar: "Happy", online: true },
    { id: 2, name: "Husky Jack", lastMsg: "Going to the park tomorrow?", avatar: "Jack", online: false }
];

let chatHistory = {
    1: [{ sender: 'them', text: 'Hello! How can we help you with the adoption process today?', time: '10:00' }]
};

// --- 3. Core Functional Logic ---

/**
 * Display a temporary floating message
 */
function showToast(title, msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="user-avatar" style="width:32px; height:32px;">!</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-msg">${msg}</div>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
/**
 * Handle Tab Switching
 */
function switchTab(tabId) {
    state.activeTab = tabId;
    state.activeChatId = null;
    state.viewingPostId = null;
    state.viewingUserName = null;
    renderApp();
    document.getElementById('main-view').scrollTo(0, 0);
}

/**
 * Navigate backward in context
 */
function goBack() {
    if (state.activeChatId) state.activeChatId = null;
    else if (state.viewingPostId) state.viewingPostId = null;
    else if (state.viewingUserName) state.viewingUserName = null;
    else state.activeTab = 'explore';
    renderApp();
}

/**
 * Handle Like Interaction
 */
function toggleLike(postId) {
    if(!state.isLoggedIn) { openLoginModal(); return; }
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (state.likedPosts.includes(postId)) {
        state.likedPosts = state.likedPosts.filter(id => id !== postId);
        post.likes--;
    } else {
        state.likedPosts.push(postId);
        post.likes++;
        showToast('Liked!', `You liked @${post.poster}'s post.`);
    }
    renderApp();
}

/**
 * Open Conversation
 */
function openChat(chatId) {
    if(!state.isLoggedIn) { openLoginModal(); return; }
    state.activeChatId = chatId;
    state.activeTab = 'friends';
    renderApp();
}

/**
 * Send Chat Message
 */
function sendChat() {
    const input = document.getElementById('chat-input');
    if(!input || !input.value.trim()) return;
    
    if(!chatHistory[state.activeChatId]) chatHistory[state.activeChatId] = [];
    chatHistory[state.activeChatId].push({ sender: 'me', text: input.value.trim(), time: 'Now' });
    input.value = '';
    renderApp();
}

/**
 * Visit User Profile
 */
function navigateToUser(name) {
    state.viewingUserName = name;
    state.activeTab = 'profile';
    renderApp();
}

// --- 4. Login System Logic ---

function openLoginModal() {
    const modalRoot = document.getElementById('modal-root');
    const content = modalRoot.querySelector('.modal-content');
    content.innerHTML = `
        <div style="position:absolute; top:16px; right:16px; cursor:pointer; color:#ccc;" onclick="closeModal()">✕</div>
        <h2 style="font-weight:900; font-size:24px; margin-bottom:8px; text-align:center;">Welcome Back</h2>
        <p style="color:var(--muted); font-size:14px; margin-bottom:24px; text-align:center;">Please login to join the community.</p>
        <div style="display:grid; gap:12px;">
            <input type="email" placeholder="Email" class="input">
            <input type="password" placeholder="Password" class="input">
            <button class="btn primary" style="margin-top:10px;" onclick="handleLogin()">Sign In</button>
            <p style="font-size:12px; margin-top:16px; text-align:center;">Don't have an account? <span style="color:var(--accent); font-weight:700; cursor:pointer;">Join now</span></p>
        </div>
    `;
    modalRoot.style.display = 'grid';
}

function closeModal() {
    document.getElementById('modal-root').style.display = 'none';
}

function handleLogin() {
    state.isLoggedIn = true;
    closeModal();
    showToast('Success', 'Logged in successfully!');
    renderApp();
}

function handleLogout() {
    state.isLoggedIn = false;
    state.likedPosts = [];
    state.activeTab = 'explore';
    showToast('Signed Out', 'You have been logged out safely.', 'error');
    renderApp();
}

// --- 5. Render Engine ---

function renderApp() {
    const contentArea = document.getElementById('content-area');
    const headerTitle = document.querySelector('#header-title h2');
    const headerLeft = document.getElementById('header-left');
    const userSummary = document.getElementById('user-profile-summary');

    // Update Header Content
    if (state.activeChatId) {
        const contact = contacts.find(c => c.id === state.activeChatId);
        headerTitle.innerText = contact ? contact.name : "Chat";
    } else if (state.viewingUserName) {
        headerTitle.innerText = `@${state.viewingUserName}`;
    } else {
        const titles = { 'explore': 'Explore', 'adopt': 'Adopt', 'search': 'Search', 'notifications': 'Activity', 'friends': 'Messages', 'settings': 'Settings', 'profile': 'My Profile' };
        headerTitle.innerText = titles[state.activeTab] || "instanimals";
    }

    // Toggle Back Button Visibility
    headerLeft.innerHTML = (state.activeTab !== 'explore' || state.activeChatId || state.viewingPostId || state.viewingUserName) 
        ? `<button onclick="goBack()" class="header-btn"><i data-lucide="chevron-left"></i></button>` 
        : '';

    // Update Sidebar Profile Section
    if (state.isLoggedIn) {
        userSummary.innerHTML = `
            <div class="user-avatar" onclick="switchTab('profile')" style="cursor:pointer">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${myProfile.avatarSeed}">
            </div>
            <div class="user-meta" onclick="switchTab('profile')" style="cursor:pointer">
                <div class="name">${myProfile.name}</div>
                <div class="handle">${myProfile.handle}</div>
            </div>
        `;
    } else {
        userSummary.innerHTML = `
            <button class="btn ghost" style="width:100%;" onclick="openLoginModal()">Sign In</button>
        `;
    }

    // Dynamic Content Routing
    contentArea.innerHTML = '';
    switch (state.activeTab) {
        case 'explore': renderExplore(contentArea); break;
        case 'adopt': renderAdopt(contentArea); break;
        case 'search': renderSearch(contentArea); break;
        case 'notifications': renderNotifications(contentArea); break;
        case 'friends': state.activeChatId ? renderChat(contentArea) : renderFriendsList(contentArea); break;
        case 'settings': renderSettings(contentArea); break;
        case 'profile': renderProfile(contentArea); break;
    }

    updateSidebarActiveLinks();
    if(window.lucide) lucide.createIcons();
}

// --- 6. View Components ---

function createPostCard(post) {
    const isLiked = state.likedPosts.includes(post.id);
    return `
        <div class="card card-pad fade-in">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
                <div class="user-avatar" style="width:40px; height:40px; cursor:pointer;" onclick="navigateToUser('${post.poster}')">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${post.poster}">
                </div>
                <div style="cursor:pointer; text-align:left;" onclick="navigateToUser('${post.poster}')">
                    <div class="name" style="font-size:14px;">@${post.poster}</div>
                    <div class="section-sub" style="font-size:11px;">${post.location}</div>
                </div>
            </div>
            <p style="margin-bottom:14px; line-height:1.5; color:var(--text); text-align:left;">${post.text}</p>
            ${post.media ? `<img src="${post.media}" style="width:100%; border-radius:var(--radiusSm); margin-bottom:14px; display:block;">` : ''}
            <div style="display:flex; gap:16px;">
                <button onclick="toggleLike(${post.id})" class="btn ghost" style="padding:8px 14px; display:flex; align-items:center; gap:6px; color:${isLiked ? 'var(--accent)' : 'inherit'}">
                    <i data-lucide="heart" style="${isLiked ? 'fill:var(--accent)' : ''}"></i> ${post.likes}
                </button>
                <button class="btn ghost" style="padding:8px 14px; display:flex; align-items:center; gap:6px;" onclick="showToast('Comments', 'Comments are restricted in demo mode.', 'error')">
                    <i data-lucide="message-circle"></i> Comment
                </button>
            </div>
        </div>
    `;
}

function renderExplore(container) {
    posts.forEach(p => container.insertAdjacentHTML('beforeend', createPostCard(p)));
}

function renderAdopt(container) {
    container.innerHTML = `
        <div class="card card-pad" style="background:var(--accentSoft); border-color:#ffd6cf; text-align:left;">
            <h3 class="section-title" style="color:var(--accent)">Adopt a Companion</h3>
            <p class="section-sub">Connect with verified animal shelters to provide a forever home.</p>
        </div>
    `;
    posts.filter(p => p.isShelter).forEach(p => container.insertAdjacentHTML('beforeend', createPostCard(p)));
}

function renderSearch(container) {
    container.innerHTML = `
        <div class="card card-pad">
            <input type="text" class="input" placeholder="Search for species, locations..." oninput="state.searchQuery = this.value; renderApp()">
        </div>
    `;
    const filtered = posts.filter(p => p.text.toLowerCase().includes(state.searchQuery.toLowerCase()) || p.poster.toLowerCase().includes(state.searchQuery.toLowerCase()));
    filtered.forEach(p => container.insertAdjacentHTML('beforeend', createPostCard(p)));
}

function renderNotifications(container) {
    if(!state.isLoggedIn) { container.innerHTML = `<div class="card card-pad" style="text-align:center;"><p>Please login to see your activity.</p><button class="btn primary" style="margin-top:16px;" onclick="openLoginModal()">Sign In</button></div>`; return; }
    container.innerHTML = `<div class="card">
        ${notifications.map(n => `
            <div class="card-pad" style="display:flex; gap:14px; align-items:center; border-bottom:1px solid var(--border); text-align:left;">
                <div class="user-avatar" style="width:40px; height:40px;"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${n.from}"></div>
                <div style="flex:1;">
                    <span style="font-weight:900">@${n.from}</span> ${n.text}
                    <div class="section-sub" style="font-size:11px;">${n.time}</div>
                </div>
            </div>`).join('')}
    </div>`;
}

function renderFriendsList(container) {
    if(!state.isLoggedIn) { container.innerHTML = `<div class="card card-pad" style="text-align:center;"><p>Please login to view your messages.</p><button class="btn primary" style="margin-top:16px;" onclick="openLoginModal()">Sign In</button></div>`; return; }
    container.innerHTML = `<div class="card">
        <h4 style="font-size:11px; font-weight:900; color:#ccc; text-transform:uppercase; letter-spacing:1.5px; margin:20px 0 10px 20px; text-align:left;">Direct Messages</h4>
        ${contacts.map(c => `
            <div onclick="openChat(${c.id})" class="card-pad" style="display:flex; gap:14px; align-items:center; border-bottom:1px solid var(--border); cursor:pointer; text-align:left;">
                <div class="user-avatar" style="width:48px; height:48px; position:relative;">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${c.avatar}">
                    ${c.online ? '<div style="position:absolute; bottom:0; right:0; width:12px; height:12px; background:#2ecc71; border:2px solid #fff; border-radius:50%;"></div>' : ''}
                </div>
                <div style="flex:1; overflow:hidden;">
                    <div class="name">${c.name}</div>
                    <div class="section-sub" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.lastMsg}</div>
                </div>
            </div>`).join('')}
    </div>`;
}

function renderChat(container) {
    const history = chatHistory[state.activeChatId] || [];
    container.innerHTML = `
        <div class="card" style="height:calc(100vh - 160px); display:flex; flex-direction:column; overflow:hidden;">
            <div id="chat-scroller" class="no-scrollbar" style="flex:1; padding:20px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; background:#fcfcfc;">
                ${history.map(m => `
                    <div style="align-self: ${m.sender === 'me' ? 'flex-end' : 'flex-start'}; max-width:80%;">
                        <div class="card card-pad" style="padding:10px 14px; border-radius:14px; background:${m.sender === 'me' ? 'var(--accent)' : 'var(--panel)'}; color:${m.sender === 'me' ? '#fff' : 'inherit'}; box-shadow:none; border-color:${m.sender === 'me' ? 'transparent' : 'var(--border)'}">
                            ${m.text}
                        </div>
                    </div>`).join('')}
            </div>
            <div class="card-pad" style="border-top:1px solid var(--border); display:flex; gap:10px;">
                <input id="chat-input" class="input" placeholder="Type a message..." onkeydown="if(event.key==='Enter') sendChat()">
                <button onclick="sendChat()" class="btn primary">Send</button>
            </div>
        </div>`;
    const s = document.getElementById('chat-scroller');
    s.scrollTop = s.scrollHeight;
}

function renderProfile(container) {
    const isMe = !state.viewingUserName;
    const name = isMe ? myProfile.name : state.viewingUserName;
    container.innerHTML = `
        <div class="card card-pad" style="text-align:center;">
            <div class="user-avatar" style="width:100px; height:100px; margin:0 auto 16px;">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${name}">
            </div>
            <h2 class="section-title" style="text-align:center;">${name}</h2>
            <p class="section-sub" style="margin-bottom:16px; text-align:center;">Discovering wildlife one capture at a time.</p>
            <div style="display:flex; justify-content:center; gap:10px;">
                ${isMe ? '<button class="btn ghost">Edit Profile</button>' : `<button onclick="openChat(1)" class="btn primary">Send Message</button>`}
            </div>
        </div>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-top:24px;">
            ${[1,2,3,4,5,6].map(() => `<div style="aspect-ratio:1; background:#fff; border-radius:14px; border:1px solid var(--border); display:grid; place-items:center; color:#eee;"><i data-lucide="camera"></i></div>`).join('')}
        </div>
    `;
}

function renderSettings(container) {
    container.innerHTML = `
        <div class="card card-pad" style="text-align:left;">
            <h3 class="section-title">Settings</h3>
            <div style="margin-top:20px; display:grid; gap:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>Push Notifications</span> 
                    <input type="checkbox" checked style="accent-color:var(--accent); width:18px; height:18px;">
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>Private Account</span> 
                    <input type="checkbox">
                </div>
                ${state.isLoggedIn ? `<button onclick="handleLogout()" class="btn ghost" style="color:#e74c3c; border-color:#ffcccc; margin-top:20px;">Log Out</button>` : `<button onclick="openLoginModal()" class="btn primary" style="margin-top:20px;">Sign In</button>`}
            </div>
        </div>
    `;
}

/**
 * Update the CSS active class on the sidebar based on state
 */
function updateSidebarActiveLinks() {
    document.querySelectorAll('#nav-menu a').forEach(link => {
        const tab = link.id.split('-')[1];
        link.classList.toggle('active', tab === state.activeTab);
    });
}

// --- 7. Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Navigation Listeners
    ['explore', 'adopt', 'search', 'notifications', 'friends', 'settings'].forEach(tab => {
        const el = document.getElementById(`nav-${tab}`);
        if(el) el.onclick = (e) => { e.preventDefault(); switchTab(tab); };
    });

    // Create post button behavior
    document.getElementById('btn-create-post').onclick = () => {
        if(!state.isLoggedIn) { openLoginModal(); return; }
        showToast('Info', 'Posting feature is restricted in demo mode.', 'error');
    };

    // Global Function Exposure for inline HTML events
    window.toggleLike = toggleLike;
    window.goBack = goBack;
    window.openChat = openChat;
    window.sendChat = sendChat;
    window.navigateToUser = navigateToUser;
    window.switchTab = switchTab;
    window.openLoginModal = openLoginModal;
    window.closeModal = closeModal;
    window.handleLogin = handleLogin;
    window.handleLogout = handleLogout;

    // Initial View
    renderApp();
});

