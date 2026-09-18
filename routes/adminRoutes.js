const router = require('express').Router()
const { auth, allow } = require('../middleware/auth')
const validateId = require('../middleware/validateId')
const c = require('../controllers/adminController')

router.use(auth, allow('admin'))

router.get('/users', c.listUsers)

router.post('/users', c.createUser)

router.patch('/users/:id/status', validateId('id'), c.updateUserStatus)

router.get('/sets', c.listAllSets)

router.patch('/sets/:id/status', validateId('id'), c.updateSetStatus)

router.get('/stats', c.stats)

module.exports = router