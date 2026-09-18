const { isStr, isOptionalStr } = require('../utils/validators')

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, bio } = req.body

    if (name !== undefined && !isStr(name, 2, 80))
      return res.status(422).json({ message: 'Name must be 2-80 chars' })
    if (!isOptionalStr(bio, 200))
      return res.status(422).json({ message: 'Bio must be ≤ 200 chars' })

    if (name !== undefined) req.user.name = name.trim()
    if (bio !== undefined) req.user.bio = bio.trim()

    await req.user.save()
    res.json({
      user: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        status: req.user.status,
        bio: req.user.bio,
      },
    })
  } catch (err) {
    next(err)
  }
}