// Establish a Socket.io connection
const socket = io('https://discussion-p6i2.onrender.com');

let currentUser = null;
let selectedPostType = 'discussion';
let selectedImage = null;

// DOM Elements
const loginOverlay = document.getElementById('loginOverlay');
const mainContainer = document.getElementById('mainContainer');
const nameInput = document.getElementById('nameInput');
const roleSelect = document.getElementById('roleSelect');
const userInfo = document.getElementById('userInfo');
const onlineUsersList = document.getElementById('onlineUsersList');
const postContent = document.getElementById('postContent');
const feed = document.getElementById('feed');
const loadingSpinner = document.getElementById('loadingSpinner');
const imageInput = document.getElementById('imageInput');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');

// Login function
function login() {
    const name = nameInput.value.trim();
    const role = roleSelect.value;

    if (name && role) {
        currentUser = { name, role };
        socket.emit('user login', currentUser);
        loginOverlay.style.display = 'none';
        mainContainer.style.display = 'grid';
        updateUserInfo();
    } else {
        alert('Please enter your name and select a role.');
    }
}

// Update user info in the sidebar
function updateUserInfo() {
    userInfo.querySelector('.user-details').innerHTML = `
        <strong>${currentUser.name}</strong>
        <span class="role-badge ${currentUser.role}">${currentUser.role}</span>
    `;
}

// Handle post type selection
document.querySelectorAll('.type-button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.type-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        selectedPostType = button.dataset.type;
    });
});

// Handle image upload
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            selectedImage = e.target.result;
            imagePreview.src = selectedImage;
            imagePreviewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

// Remove uploaded image
function removeImage() {
    selectedImage = null;
    imagePreview.src = '';
    imagePreviewContainer.style.display = 'none';
    imageInput.value = '';
}

// Initialize emoji picker
function initializeEmojiPicker() {
    const picker = new EmojiMart.Picker({
        onSelect: emoji => {
            postContent.value += emoji.native;
        }
    });
    document.getElementById('emojiPicker').appendChild(picker);
}

// Toggle emoji picker
function toggleEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
}

// Create a new post
function createPost() {
    const content = postContent.value.trim();
    if (content || selectedImage) {
        const post = {
            author: currentUser.name,
            role: currentUser.role,
            type: selectedPostType,
            content: content,
            image: selectedImage,
            timestamp: new Date().toISOString(),
            likes: 0,
            comments: []
        };
        socket.emit('new post', post);
        postContent.value = '';
        removeImage();
    }
}

// Display a post in the feed
function displayPost(post) {
    const postElement = document.createElement('div');
    postElement.className = 'post';
    postElement.dataset.id = post.id;
    postElement.dataset.type = post.type;
    
    const isLiked = post.likedBy && post.likedBy.includes(currentUser.id);
    const likeButtonClass = isLiked ? 'liked' : '';

    postElement.innerHTML = `
        <div class="post-header">
            <div class="author-info">
                <div class="author-avatar">
                    <i class="fas fa-user-circle"></i>
                </div>
                <div class="author-details">
                    <strong>${post.author}</strong>
                    <span class="role-badge ${post.role}">${post.role}</span>
                    <span class="timestamp">${new Date(post.timestamp).toLocaleString()}</span>
                </div>
            </div>
            <div class="post-type">${post.type}</div>
        </div>
        <div class="post-content">${post.content}</div>
        ${post.image ? `<img src="${post.image}" alt="Post image" class="post-image">` : ''}
        <div class="post-footer">
            <button class="reaction-button like-button ${likeButtonClass}" onclick="likePost('${post.id}')">
                <i class="fas fa-thumbs-up"></i>
                <span class="like-count">${post.likes || 0}</span>
            </button>
            <button class="reaction-button comment-button" onclick="toggleComments('${post.id}')">
                <i class="fas fa-comment"></i>
                <span class="comment-count">${post.comments.length}</span>
            </button>
        </div>
        <div class="comments-section" style="display: none;">
            <div class="comments-list">
                ${post.comments.map(comment => createCommentHTML(comment)).join('')}
            </div>
            <div class="comment-input-container">
                <input type="text" placeholder="Write a comment..." class="comment-input">
                <button class="send-comment" onclick="addComment('${post.id}')">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    `;
    feed.prepend(postElement);
}

function createCommentHTML(comment) {
    return `
        <div class="comment" data-id="${comment.id}">
            <div class="comment-author">
                <strong>${comment.author}</strong>
                <span class="role-badge ${comment.authorRole}">${comment.authorRole}</span>
            </div>
            <div class="comment-content">${comment.content}</div>
            <div class="comment-timestamp">
                ${new Date(comment.timestamp).toLocaleString()}
            </div>
        </div>
    `;
}

function likePost(postId) {
    socket.emit('like post', postId);
}

function toggleComments(postId) {
    const post = document.querySelector(`.post[data-id="${postId}"]`);
    const commentsSection = post.querySelector('.comments-section');
    commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
}

function addComment(postId) {
    const post = document.querySelector(`.post[data-id="${postId}"]`);
    const commentInput = post.querySelector('.comment-input');
    const content = commentInput.value.trim();
    
    if (content) {
        socket.emit('new comment', {
            postId,
            comment: content
        });
        commentInput.value = '';
    }
}

function updateOnlineUsers(users) {
    onlineUsersList.innerHTML = '';
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'online-user';
        userElement.innerHTML = `
            <i class="fas fa-user-circle"></i>
            <span>${user.name}</span>
            <span class="role-badge ${user.role}">${user.role}</span>
        `;
        onlineUsersList.appendChild(userElement);
    });
}

// Filter posts
document.querySelectorAll('.filter-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        const filterType = button.dataset.filter;
        
        document.querySelectorAll('.post').forEach(post => {
            if (filterType === 'all' || post.dataset.type === filterType) {
                post.style.display = 'block';
            } else {
                post.style.display = 'none';
            }
        });
    });
});

// Socket event listeners
socket.on('user joined', (users) => {
    updateOnlineUsers(users);
});

socket.on('user left', (users) => {
    updateOnlineUsers(users);
});

socket.on('new post', (post) => {
    displayPost(post);
});

socket.on('post liked', ({ postId, likes, likedBy }) => {
    const post = document.querySelector(`.post[data-id="${postId}"]`);
    if (post) {
        const likeButton = post.querySelector('.like-button');
        const likeCount = post.querySelector('.like-count');
        
        likeCount.textContent = likes;
        
        if (likedBy.includes(currentUser.id)) {
            likeButton.classList.add('liked');
        } else {
            likeButton.classList.remove('liked');
        }
    }
});

socket.on('new comment', ({ postId, comment, commentCount }) => {
    const post = document.querySelector(`.post[data-id="${postId}"]`);
    if (post) {
        const commentsList = post.querySelector('.comments-list');
        const commentCountElement = post.querySelector('.comment-count');
        
        commentsList.insertAdjacentHTML('beforeend', createCommentHTML(comment));
        commentCountElement.textContent = commentCount;
        
        // Show comments section if it's hidden
        const commentsSection = post.querySelector('.comments-section');
        commentsSection.style.display = 'block';
    }
});

// Initialize the app
function init() {
    loadingSpinner.style.display = 'flex';
    // Simulate loading delay
    setTimeout(() => {
        loadingSpinner.style.display = 'none';
        loginOverlay.style.display = 'flex';
    }, 1500);
    initializeEmojiPicker();
}

init();
