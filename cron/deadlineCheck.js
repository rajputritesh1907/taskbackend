const cron = require('node-cron');
const Project = require('../models/Project');
const Task = require('../models/Task');
const sendEmail = require('../utils/sendEmail');

const checkDeadlines = () => {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
        console.log('Checking deadlines...');
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Check Projects
        const projects = await Project.find({
            deadline: { $lte: tomorrow, $gte: now },
            status: 'active'
        }).populate('teamLeader', 'name email');

        projects.forEach(async (project) => {
            if (project.teamLeader) {
                const message = `Project "${project.title}" is nearing its deadline (${project.deadline}).`;
                try {
                    await sendEmail({
                        email: project.teamLeader.email,
                        subject: `Deadline Alert: ${project.title}`,
                        message
                    });
                } catch (error) {
                    console.log('Email could not be sent');
                }
            }
        });

        // Check Tasks
        const tasks = await Task.find({
            dueDate: { $lte: tomorrow, $gte: now },
            status: { $ne: 'done' }
        }).populate('user', 'name email');

        tasks.forEach(async (task) => {
            if (task.user) {
                const message = `Task "${task.title}" is nearing its deadline (${task.dueDate}).`;
                try {
                    await sendEmail({
                        email: task.user.email,
                        subject: `Deadline Alert: ${task.title}`,
                        message
                    });
                } catch (error) {
                    console.log('Email could not be sent');
                }
            }
        });
    });
};

module.exports = checkDeadlines;
