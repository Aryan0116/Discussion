const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const uuid = require('uuid');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "https://discussion-p6i2.onrender.com",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5000000 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'));
        }
        cb(null, true);
    }
});

// In-memory data storage
let onlineUsers = [];
let posts = [];
let notifications = [];

// Helper Functions
function createNotification(type, content, userId) {
    const notification = {
        id: uuid.v4(),
        type,
        content,
        timestamp: new Date().toISOString(),
        userId
    };
    notifications.push(notification);
    return notification;
}

// Socket.io connection handler
io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('user login', (user) => {
        user.id = socket.id;
        onlineUsers.push(user);
        socket.user = user;

        socket.emit('login success', user);
        io.emit('update online users', onlineUsers);
        socket.emit('initial posts', posts);

        const userNotifications = notifications.filter(n => n.userId === user.id);
        socket.emit('notifications', userNotifications);

        const notification = createNotification(
            'user_joined',
            `${user.name} joined the platform`,
            null
        );
        socket.broadcast.emit('new notification', notification);
    });

    socket.on('new post', (postData) => {
        const post = {
            id: uuid.v4(),
            ...postData,
            authorId: socket.user.id,
            timestamp: new Date().toISOString(),
            likes: 0,
            likedBy: [],
            comments: []
        };
        posts.unshift(post);
        io.emit('new post', post);
    });

    socket.on('like post', (postId) => {
        const post = posts.find(p => p.id === postId);
        if (post) {
            const userIndex = post.likedBy.findIndex(userId => userId === socket.user.id);
            if (userIndex === -1) {
                post.likes++;
                post.likedBy.push(socket.user.id);
            } else {
                post.likes--;
                post.likedBy.splice(userIndex, 1);
            }
            io.emit('post liked', {
                postId,
                likes: post.likes,
                likedBy: post.likedBy
            });
        }
    });

    socket.on('new comment', ({ postId, comment }) => {
        const post = posts.find(p => p.id === postId);
        if (post) {
            const newComment = {
                id: uuid.v4(),
                content: comment,
                author: socket.user.name,
                authorId: socket.user.id,
                authorRole: socket.user.role,
                timestamp: new Date().toISOString()
            };
            post.comments.push(newComment);
            io.emit('comment added', {
                postId,
                comment: newComment,
                commentCount: post.comments.length
            });
        }
    });

    socket.on('upload image', (imageData) => {
        const fileName = `${Date.now()}-${uuid.v4()}.jpg`;
        const filePath = path.join(__dirname, 'public/uploads', fileName);
        
        fs.writeFile(filePath, imageData.split(';base64,').pop(), {encoding: 'base64'}, (err) => {
            if (err) {
                socket.emit('upload error', err.message);
            } else {
                socket.emit('upload success', `/uploads/${fileName}`);
            }
        });
    });

    socket.on('filter posts', (filter) => {
        let filteredPosts = posts;
        if (filter !== 'all') {
            filteredPosts = posts.filter(post => post.type === filter);
        }
        socket.emit('filtered posts', filteredPosts);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        if (socket.user) {
            onlineUsers = onlineUsers.filter(user => user.id !== socket.user.id);
            io.emit('update online users', onlineUsers);

            const notification = createNotification(
                'user_left',
                `${socket.user.name} left the platform`,
                null
            );
            socket.broadcast.emit('new notification', notification);
        }
    });
});

// API Routes
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (req.file) {
        res.json({ url: `/uploads/${req.file.filename}` });
    } else {
        res.status(400).json({ message: 'No file uploaded' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message || 'Something broke!' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});
