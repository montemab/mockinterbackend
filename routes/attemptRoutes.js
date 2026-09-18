const router = require('express').Router()
const { auth, allow } = require('../middleware/auth')
const validateId = require('../middleware/validateId')
const {submitAttempt,myAttempts,getAttempt,gradeAttempt,} = require('../controllers/attemptController')

router.post('/', auth, allow('student'), submitAttempt)

router.get('/me', auth, myAttempts)

router.get('/:id', auth, validateId('id'), getAttempt)

router.patch('/:id/grade', auth, allow('instructor', 'admin'), validateId('id'), gradeAttempt)

module.exports = router