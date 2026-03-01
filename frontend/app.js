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