const asyncHandler = require('express-async-handler');
const Project = require('../models/Project');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// @desc    Get projects
// @route   GET /api/projects
// @access  Private
const getProjects = asyncHandler(async (req, res) => {
    let query = {};

    // If manager, get projects created by them
    if (req.user.role === 'manager') {
        query.manager = req.user.id;
    }
    // If team leader or co-operator, get projects assigned to them as leader
    else if (req.user.role === 'team-leader' || req.user.role === 'co-operator') {
        // Find projects where user is team leader OR user is in members
        query.$or = [
            { teamLeader: req.user.id },
            { members: req.user.id }
        ];
    }

    const projects = await Project.find(query)
        .populate('teamLeader', 'name email')
        .populate('manager', 'name email')
        .populate('members', 'name email');

    res.status(200).json(projects);
});

// @desc    Create project
// @route   POST /api/projects
// @access  Private (Manager only)
const createProject = asyncHandler(async (req, res) => {
    if (req.user.role !== 'manager') {
        res.status(403);
        throw new Error('Only managers can create projects');
    }

    const { title, description, teamLeaderId, deadline, members } = req.body;

    if (!title) {
        res.status(400);
        throw new Error('Please add a title');
    }

    // Verify Team Leader exists
    let teamLeader = null;
    if (teamLeaderId) {
        teamLeader = await User.findById(teamLeaderId);
        if (!teamLeader) {
            res.status(400);
            throw new Error('Invalid Team Leader');
        }
        // Allow both team-leader and co-operator to be assigned as project leader
        if (teamLeader.role !== 'team-leader' && teamLeader.role !== 'co-operator') {
            res.status(400);
            throw new Error('User must be a Team Leader or Co-operator');
        }
    }

    const project = await Project.create({
        title,
        description,
        manager: req.user.id,
        teamLeader: teamLeaderId,
        members: members || [],
        deadline
    });

    const populatedProject = await Project.findById(project._id)
        .populate('teamLeader', 'name email')
        .populate('members', 'name email');

    // Send email to Team Leader
    if (teamLeader) {
        const message = `You have been assigned a new project: ${title}. \n\nDescription: ${description}\nDeadline: ${deadline}`;
        try {
            await sendEmail({
                email: teamLeader.email,
                subject: 'New Project Assignment',
                message
            });
        } catch (error) {
            console.log('Email could not be sent');
        }
    }

    res.status(201).json(populatedProject);
});

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private (Manager/Team Leader)
const updateProject = asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id)
        .populate('teamLeader', 'name email')
        .populate('members', 'name email')
        .populate('manager', 'name email');

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    // Check permissions
    if (req.user.role !== 'manager' && req.user.role !== 'team-leader') {
        res.status(403);
        throw new Error('Not authorized to update project');
    }

    const updatedProject = await Project.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
    }).populate('teamLeader', 'name email')
        .populate('members', 'name email')
        .populate('manager', 'name email');

    // Check for status changes
    if (req.body.status && req.body.status !== project.status) {
        // If Manager holds the project
        if (req.body.status === 'on-hold' && req.user.role === 'manager') {
            // Send mail to Team Leader and Cooperate (Members)
            const recipients = [];
            if (updatedProject.teamLeader) recipients.push(updatedProject.teamLeader.email);
            if (updatedProject.members) {
                updatedProject.members.forEach(member => recipients.push(member.email));
            }

            if (recipients.length > 0) {
                const message = `The project "${updatedProject.title}" has been put on HOLD by the Manager.`;
                try {
                    // Send individually or bcc
                    recipients.forEach(async (email) => {
                        await sendEmail({
                            email,
                            subject: `Project On Hold: ${updatedProject.title}`,
                            message
                        });
                    });
                } catch (error) {
                    console.log('Email could not be sent');
                }
            }
        }

        // If Project is Complete (usually triggered by system or manager, but user said "if all task is complete then show project is complete")
        // But also "send mail to manager"
        if (req.body.status === 'completed') {
            // Send mail to Manager
            if (updatedProject.manager) {
                const message = `The project "${updatedProject.title}" has been marked as COMPLETED.`;
                try {
                    await sendEmail({
                        email: updatedProject.manager.email,
                        subject: `Project Completed: ${updatedProject.title}`,
                        message
                    });
                } catch (error) {
                    console.log('Email could not be sent');
                }
            }
        }
    }

    res.status(200).json(updatedProject);
});

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private (Manager only)
const deleteProject = asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id)
        .populate('teamLeader', 'name email')
        .populate('members', 'name email');

    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    // Check permissions
    if (req.user.role !== 'manager') {
        res.status(403);
        throw new Error('Only managers can delete projects');
    }

    // Send email to Team Leader and Members
    const recipients = [];
    if (project.teamLeader) recipients.push(project.teamLeader.email);
    if (project.members) {
        project.members.forEach(member => recipients.push(member.email));
    }

    if (recipients.length > 0) {
        const message = `The project "${project.title}" has been DELETED by the Manager.`;
        try {
            recipients.forEach(async (email) => {
                await sendEmail({
                    email,
                    subject: `Project Deleted: ${project.title}`,
                    message
                });
            });
        } catch (error) {
            console.log('Email could not be sent');
        }
    }

    await project.deleteOne();

    res.status(200).json({ id: req.params.id });
});

module.exports = {
    getProjects,
    createProject,
    createProject,
    updateProject,
    deleteProject
};
