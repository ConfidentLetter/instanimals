// --- 1. Global State Management ---
const state = {
    activeTab: 'explore',
    searchQuery: '',
    filterBreed: 'All',
    likedPosts: [],
    savedPosts: [],
    viewingPostId: null,
    viewingUserName: null,
    activeChatId: null,
    isMobileSidebarOpen: false
};

const myProfile = {
    name: "Felix",
    bio: "Passionate about wildlife and nature photography. Capturing the tiny wonders of our planet. 🌱",
    avatarSeed: "Felix"
};

// --- 2. Mock Data ---
let posts = [
    { id: 1, poster: "John_Nature", text: "Found this little Red Fox napping in California forest today.", media: "https://images.unsplash.com/photo-1517683201413-571216591730?auto=format&fit=crop&w=1200&q=80", likes: 128, breed: "Fox", location: "California" },
    { id: 2, poster: "Happy_Paws", isShelter: true, text: "Max is a 2-year-old Golden Retriever mixed looking for a forever home!", media: "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1200&q=80", likes: 2100, breed: "Dog", location: "New York" },
    { id: 3, poster: "Luna_Cat", text: "New family member is still a bit shy.", media: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1200&q=80", likes: 540, breed: "Cat", location: "Texas" }
];

const notifications = [
    { id: 1, type: 'like', from: 'Mike', text: 'liked your photo', time: '2m ago', postId: 1 },
    { id: 2, type: 'follow', from: 'Wildlife_Pro', text: 'started following you', time: '1h ago', postId: null }
];

const contacts = [
    { id: 1, name: "Happy Paws Shelter", lastMsg: "Thank you for your application!", avatar: "Happy" },
    { id: 2, name: "Husky Jack", lastMsg: "See you at the park tomorrow?", avatar: "Jack" }
];

let chatHistory = {
    1: [{ sender: 'them', text: 'Hi! How can we help you today?', time: '10:00' }]
};