"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const User_1 = require("../models/User");
const router = express_1.default.Router();
router.post('/insert', async (req, res) => {
    try {
        console.log('inserting');
        const { username, email, first_name, last_name, gender, birth_date, profile_picture, bio, facebook_link, instagram_link, role, firebase_id } = req.body;
        const requiredFields = ['username', 'email', 'first_name', 'last_name', 'firebase_id'];
        const missingFields = requiredFields.filter((field) => !req.body[field]);
        if (missingFields.length > 0) {
            const missingFieldsList = missingFields.join(', ');
            return res.status(400).json({
                error: `Missing required fields: ${missingFieldsList}`,
                missing_fields: missingFields,
            });
        }
        const existingUser = await User_1.User.findOne({
            $or: [{ email }, { username }],
        });
        if (existingUser) {
            const conflictMessages = [];
            if (existingUser.email === email) {
                conflictMessages.push('Email already exists.');
            }
            if (existingUser.username === username) {
                conflictMessages.push('Username already exists.');
            }
            return res.status(409).json({
                error: conflictMessages.join(' '),
            });
        }
        const newUser = new User_1.User({
            username,
            email,
            first_name,
            last_name,
            gender: gender || '',
            birth_date: birth_date || '',
            profile_picture: profile_picture || '',
            bio: bio || '',
            facebook_link: facebook_link || '',
            instagram_link: instagram_link || '',
            role: role || 'user',
            firebase_id,
            social: {
                total_likes: 0,
                total_shares: 0,
                total_saves: 0,
            },
            created_on: new Date(),
            updated_on: new Date(),
        });
        await newUser.save();
        res.status(200).json({ message: 'User registered successfully', user: newUser });
    }
    catch (error) {
        console.error('Error inserting user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.get('/:mongoId', async (req, res) => {
    try {
        console.log('Get user');
        const { mongoId } = req.params;
        const firebase = req.query.firebase === 'true';
        console.log(mongoId, ' xxxx ', firebase);
        let user;
        if (firebase) {
            user = await User_1.User.findOne({ firebase_id: mongoId });
        }
        else {
            user = await User_1.User.findById(mongoId);
        }
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(user);
    }
    catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post('/:id/update', async (req, res) => {
    try {
        console.log('Update user');
        const userId = req.params.id;
        const updates = req.body;
        updates.updated_on = new Date();
        const updatedUser = await User_1.User.findByIdAndUpdate(userId, updates, { new: true });
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(updatedUser);
    }
    catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.delete('/:id/delete', async (req, res) => {
    try {
        console.log('Delete user');
        const userId = req.params.id;
        const deletedUser = await User_1.User.findByIdAndDelete(userId);
        if (!deletedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ message: 'User deleted successfully', user: deletedUser });
    }
    catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
exports.default = router;
//# sourceMappingURL=userRouter.js.map