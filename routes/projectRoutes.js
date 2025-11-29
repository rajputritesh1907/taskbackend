const express = require('express');
const router = express.Router();
const { getProjects, createProject, deleteProject } = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getProjects)
    .post(protect, createProject);

router.route('/:id')
    .delete(protect, deleteProject)
    .put(protect, require('../controllers/projectController').updateProject); // Assuming updateProject is already exported and used elsewhere or we can just import it above

module.exports = router;
