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

