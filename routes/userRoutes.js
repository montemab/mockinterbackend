const router = require('express').Router()
const { auth } = require('../middleware/auth')
const { updateProfile } = require('../controllers/userController')

router.put('/profile', auth, updateProfile)

module.exports = router