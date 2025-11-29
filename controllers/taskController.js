const asyncHandler = require('express-async-handler');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// @desc    Get tasks
// @route   GET /api/tasks
// @access  Private
const getTasks = asyncHandler(async (req, res) => {
    const tasks = await Task.find({ user: req.user.id });
    res.status(200).json(tasks);
});

// @desc    Set task
// @route   POST /api/tasks
// @access  Private
const createTask = asyncHandler(async (req, res) => {
    if (!req.body.title) {
        res.status(400);
        throw new Error('Please add a text field');
    }

    let assignedUser = req.user.id;
    let isProjectLeader = false;

    // Check if user is the Team Leader of the selected project
    if (req.body.projectId) {
        const project = await Project.findById(req.body.projectId);
        if (project && project.teamLeader.toString() === req.user.id) {
            isProjectLeader = true;
        }
    }

    // If Team Leader (by role or by project assignment), allow assigning to others
    if ((req.user.role === 'team-leader' || isProjectLeader) && req.body.assignedTo) {
        assignedUser = req.body.assignedTo;
    }

    const task = await Task.create({
        title: req.body.title,
        description: req.body.description,
        status: req.body.status,
        priority: req.body.priority,
        category: req.body.category,
        dueDate: req.body.dueDate,
        tags: req.body.tags,
        user: assignedUser,
        project: req.body.projectId // Ensure this is passed from frontend
    });

    // Send email to assigned user if it's not the creator
    if (assignedUser !== req.user.id) {
        const user = await User.findById(assignedUser);
        if (user) {
            const message = `You have been assigned a new task: ${req.body.title}. \n\nDescription: ${req.body.description}\nDue Date: ${req.body.dueDate}`;
            try {
                await sendEmail({
                    email: user.email,
                    subject: 'New Task Assignment',
                    message
                });
            } catch (error) {
                console.log('Email could not be sent');
            }
        }
    }

    res.status(200).json(task);
});

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
const updateTask = asyncHandler(async (req, res) => {
    const task = await Task.findById(req.params.id);

    if (!task) {
        res.status(400);
        throw new Error('Task not found');
    }

    // Check for user (Allow Team Leader to update any task in their project? Or just the assigned user?)
    // For now, stick to assigned user or maybe Team Leader.
    // User said "cooperate mark to task complete".
    if (!req.user) {
        res.status(401);
        throw new Error('User not found');
    }

    // Allow if user is the assigned user OR if user is the Team Leader of the project
    let isAuthorized = task.user.toString() === req.user.id;

    if (!isAuthorized && task.project) {
        const project = await Project.findById(task.project);
        if (project && project.teamLeader.toString() === req.user.id) {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
        res.status(401);
        throw new Error('User not authorized');
    }

    const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
    });

    // Check if task is completed
    if (req.body.status === 'done' && task.status !== 'done') {
        // Send mail to Team Leader
        if (task.project) {
            const project = await Project.findById(task.project).populate('teamLeader', 'name email').populate('manager', 'name email');

            if (project && project.teamLeader) {
                const message = `Task "${task.title}" has been completed by ${req.user.name}.`;
                try {
                    await sendEmail({
                        email: project.teamLeader.email,
                        subject: `Task Completed: ${task.title}`,
                        message
                    });
                } catch (error) {
                    console.log('Email could not be sent');
                }
            }

            // Check if ALL tasks in project are complete
            const tasks = await Task.find({ project: task.project });
            const allComplete = tasks.every(t => t.status === 'done');

            if (allComplete) {
                // Update project status
                project.status = 'completed';
                await project.save();

                // Send mail to Manager
                if (project.manager) {
                    const message = `All tasks in project "${project.title}" are complete. The project is now marked as COMPLETED.`;
                    try {
                        await sendEmail({
                            email: project.manager.email,
                            subject: `Project Completed: ${project.title}`,
                            message
                        });
                    } catch (error) {
                        console.log('Email could not be sent');
                    }
                }
            }
        }
    }

    res.status(200).json(updatedTask);
});

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
const deleteTask = asyncHandler(async (req, res) => {
    const task = await Task.findById(req.params.id);

    if (!task) {
        res.status(400);
        throw new Error('Task not found');
    }

    // Check for user
    if (!req.user) {
        res.status(401);
        throw new Error('User not found');
    }

    // Make sure the logged in user matches the task user
    if (task.user.toString() !== req.user.id) {
        res.status(401);
        throw new Error('User not authorized');
    }

    await task.deleteOne();

    res.status(200).json({ id: req.params.id });
});

module.exports = {
    getTasks,
    createTask,
    updateTask,
    deleteTask,
};
