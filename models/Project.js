const mongoose = require('mongoose');

const projectSchema = mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please add a project title']
    },
    description: {
        type: String
    },
    manager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    teamLeader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    status: {
        type: String,
        enum: ['active', 'completed', 'on-hold'],
        default: 'active'
    },
    deadline: {
        type: Date
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Project', projectSchema);
