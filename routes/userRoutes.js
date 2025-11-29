const express = require('express');
const router = express.Router();
const { registerUser } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// Get users by role
router.get('/', protect, async (req, res) => {
    const { role } = req.query;
    const query = role ? { role } : {};

    try {
        const users = await User.find(query).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a user (Manager creating Team Leader, etc.)
router.post('/', protect, async (req, res) => {
    // Reuse register logic but ensure the creator has permissions if needed
    // For now, allow managers to create users
    if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized to create users' });
    }

    // Call registerUser or duplicate logic? 
    // registerUser sends a token and logs them in. We just want to create.

    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Please add all fields' });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
    }

    // Force role to be team-leader if manager is creating? 
    // Or allow them to specify. User said "manager can add team leaders".

    const user = await User.create({
        name,
        email,
        password,
        role: role || 'team-leader'
    });

    if (user) {
        res.status(201).json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        });
    } else {
        res.status(400).json({ message: 'Invalid user data' });
    }
});

// Delete user (Manager removing Team Leader or Cooperate)
router.delete('/:id', protect, async (req, res) => {
    if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized to delete users' });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Send email to the removed user
    const message = `You have been removed from the team by the Manager.`;
    try {
        await sendEmail({
            email: user.email,
            subject: 'You have been removed',
            message
        });
    } catch (error) {
        console.log('Email could not be sent');
    }

    await user.deleteOne();

    res.json({ message: 'User removed' });
});

module.exports = router;
