const mongoose = require('mongoose');

const taskSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
    },
    title: {
        type: String,
        required: [true, 'Please add a text value']
    },
    description: {
        type: String,
    },
    status: {
        type: String,
        enum: ['todo', 'in-progress', 'done', 'cancelled'],
        default: 'todo'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    category: {
        type: String,
        default: 'General'
    },
    dueDate: {
        type: Date
    },
    tags: {
        type: [String],
        default: []
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Task', taskSchema);
