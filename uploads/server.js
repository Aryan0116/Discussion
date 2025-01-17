// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

// Store users and posts in memory (replace with database in production)
const users = new Map();
const posts = [];

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle user join
    socket.on('join', (userData) => {
        users.set(socket.id, {
            username: userData.username,
            role: userData.role
        });
        io.emit('user-joined', {
            id: socket.id,
            ...userData
        });
    });

    // Handle new post
    socket.on('new-post', (postData) => {
        const user = users.get(socket.id);
        if (user) {
            const post = {
                id: Date.now(),
                userId: socket.id,
                username: user.username,
                role: user.role,
                content: postData.content,
                likes: 0,
                comments: [],
                timestamp: new Date()
            };
            posts.unshift(post);
            io.emit('post-created', post);
        }
    });

    // Handle new comment
    socket.on('new-comment', (commentData) => {
        const user = users.get(socket.id);
        if (user) {
            const post = posts.find(p => p.id === commentData.postId);
            if (post) {
                const comment = {
                    id: Date.now(),
                    userId: socket.id,
                    username: user.username,
                    role: user.role,
                    content: commentData.content,
                    timestamp: new Date()
                };
                post.comments.push(comment);
                io.emit('comment-created', {
                    postId: post.id,
                    comment: comment
                });
            }
        }
    });

    // Handle like
    socket.on('like-post', (postId) => {
        const post = posts.find(p => p.id === postId);
        if (post) {
            post.likes++;
            io.emit('post-liked', {
                postId: post.id,
                likes: post.likes
            });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            users.delete(socket.id);
            io.emit('user-left', socket.id);
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});