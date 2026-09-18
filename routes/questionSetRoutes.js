const router = require('express').Router()
const { auth, allow } = require('../middleware/auth')
const validateId = require('../middleware/validateId')
const c = require('../controllers/questionSetController')

router.get('/', auth, c.listSets)

router.get('/:id', auth, validateId('id'), c.getSet)

router.get('/:id/performance', auth, allow('instructor', 'admin'), validateId('id'), c.getSetPerformance)

router.post('/', auth, allow('instructor', 'admin'), c.createSet)

router.put('/:id', auth, allow('instructor', 'admin'), validateId('id'), c.updateSet)

router.delete('/:id', auth, allow('instructor', 'admin'), validateId('id'), c.deleteSet)

router.patch('/:id/archive', auth, allow('instructor', 'admin'), validateId('id'), c.archiveSet)

router.post('/:id/questions', auth, allow('instructor', 'admin'), validateId('id'), c.addQuestion)

router.put('/:id/questions/:qid', auth, allow('instructor', 'admin'), validateId('id', 'qid'), c.updateQuestion)

router.delete('/:id/questions/:qid', auth, allow('instructor', 'admin'), validateId('id', 'qid'), c.deleteQuestion)

module.exports = router